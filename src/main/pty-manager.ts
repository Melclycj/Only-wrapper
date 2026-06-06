// MAIN-PROCESS ONLY — owns the live node-pty children. node-pty is a native
// module banned in renderer/shared by ESLint + the sandbox (CLAUDE.md "never run
// node-pty in renderer"). This module is the producer side of the PTY round-trip.
//
// Security posture (02-RESEARCH Security Domain V5/V7/V12, threat_model 02-02):
//   - EVERY IPC arg is validated here before it reaches the native PTY:
//       * id     → must be a known live LogicalId (unknown/forged ids ignored — T-02-04)
//       * cols/rows → clamped to 1..1000 (resize-bomb DoS guard — T-02-03)
//       * data   → must be a string (type guard — T-02-02)
//   - PTY output bytes are NEVER logged (may contain secrets/keystrokes — T-02-05/V7).
//   - PTY children are killed on window close + before-quit (no orphans — T-02-06).
//
// Identity (IDENT-02): the spawned OS PID is stored SEPARATELY from the LogicalId
// map key. A PID (number) is never assigned into a LogicalId (branded string).

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import * as pty from 'node-pty';
import { ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron';
import type { IPty } from 'node-pty';
import type {
  LogicalId,
  SessionStatus,
  SessionRecord,
  SessionIconSpec,
} from '../shared/types';
import { newLogicalId } from '../shared/id-factory';
import { resolveShell } from './shell-resolver';
import { selectShellProvider, type DiscoveredShell } from './shell-discovery';
import { selectReadinessProbe } from './readiness-probe';

/** IPC channel names (payloads carry `id` so the design scales to N sessions). */
export const PTY_CHANNELS = {
  create: 'pty:create',
  write: 'pty:write',
  resize: 'pty:resize',
  pause: 'pty:pause',
  resume: 'pty:resume',
  data: 'pty:data',
  exit: 'pty:exit',
  // 03-01 lifecycle channels (per-session status machine + stop/restart/list).
  status: 'pty:status',
  stop: 'pty:stop',
  restart: 'pty:restart',
  list: 'pty:list',
  // D-03a destructive close: kill the PTY AND remove the SessionRecord (close+remove).
  close: 'pty:close',
  // 04-01 identity: persist edited profile fields onto the kept record (no-op on
  // unknown id; type-guarded; startupCommand stored-only — TERM-05 deferred).
  updateProfile: 'pty:update-profile',
  // 05-01 persistence + discovery channels. `discover` is request-response (invoke);
  // `persistOrder`/`persistUi` are fire-and-forget (.on) and VALIDATE-IN-MAIN before
  // any state mutation (T-05-01). The store wiring (lowdb) lands in Plan 05-02 — for
  // now the setters guard + mutate in-memory record state so the channel surface is
  // complete and security-validated now.
  discover: 'shell:discover',
  persistOrder: 'store:persist-order',
  persistUi: 'store:persist-ui',
} as const;

/**
 * Grace window between SIGTERM (ask politely) and SIGKILL (force) on POSIX stop.
 * Short by design (tune 500–1500 ms). Windows ConPTY has no signal model, so the
 * grace timer is POSIX-only — win32 uses a single unconditional kill() (Pattern 4).
 */
export const STOP_GRACE_MS = 800;

/** Dimension clamp bounds — resize-bomb DoS guard (Security V5, T-02-03). */
export const MIN_DIMENSION = 1;
export const MAX_DIMENSION = 1000;

/**
 * Clamp a terminal dimension (cols/rows) to a sane 1..1000 range.
 *
 * Pure validation helper (unit-tested directly):
 *   - 0, negative, NaN, Infinity, non-finite → MIN_DIMENSION (1)
 *   - > MAX_DIMENSION → MAX_DIMENSION (1000)
 *   - fractional → floored
 */
export function clampDimension(n: number): number {
  const floored = Math.floor(n);
  // Math.floor(NaN) === NaN; `|| MIN_DIMENSION` maps NaN/0 → 1.
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, floored || MIN_DIMENSION));
}

/** Type guard for PTY write payloads — only real strings may reach pty.write (T-02-02). */
export function isStringData(data: unknown): data is string {
  return typeof data === 'string';
}

/** Options for spawning a new PTY (renderer-supplied; validated before use). */
export interface PtyCreateOptions {
  cols: number;
  rows: number;
  cwd?: string;
  /**
   * When present, RESTART reuses this LogicalId (IDENT-02). When absent, a fresh
   * LogicalId is minted. The renderer passes the id of the session being restarted,
   * or undefined for a brand-new session — it never invents ids.
   */
  id?: LogicalId;
  /** Display name carried on the kept SessionRecord (defaults applied on first spawn). */
  name?: string;
  /** Display order carried on the kept SessionRecord. */
  order?: number;
}

/** The result of a successful spawn: stable logical id + the live OS PID. */
export interface PtyCreateResult {
  id: LogicalId;
  /** OS process id — stored/returned SEPARATELY from the LogicalId (IDENT-02). */
  pid: number;
}

/**
 * Pure status-derivation helper (SC4, TERM-08, RESEARCH Pattern 3).
 *
 *   - `userStopped` → 'stopped'  (a user-initiated stop, regardless of exitCode —
 *     a SIGKILL'd process reports a non-zero exitCode but the flag wins).
 *   - `exitCode === 0` → 'exited'  (clean exit).
 *   - otherwise → 'error'  (non-zero exit, not user-initiated).
 *
 * NEVER branches on `signal`: it is `undefined` on Windows and on clean exits, so
 * routing status through it would mis-classify (Pattern 3, Anti-Patterns).
 */
export function deriveStatus(input: {
  exitCode: number;
  userStopped: boolean;
}): SessionStatus {
  if (input.userStopped) return 'stopped';
  return input.exitCode === 0 ? 'exited' : 'error';
}

/**
 * Per-session state. The full `SessionRecord` is retained so stop/exit keep the
 * row restartable and `listSessions()` can return it. `pty` is the live handle;
 * `alive` flips false on exit (the record stays, the handle is logically dropped).
 */
interface PtySession {
  pty: IPty;
  alive: boolean;
  status: SessionStatus;
  killTimer?: NodeJS.Timeout;
  userStopped: boolean;
  record: SessionRecord;
}

/**
 * Owns the live node-pty children keyed by LogicalId (one this phase; N in
 * Phase 3). All renderer-supplied args are validated here before reaching node-pty.
 */
export class PtyManager {
  private readonly sessions = new Map<LogicalId, PtySession>();
  /**
   * Restored-but-not-yet-started session records (PERS-02, Pattern 4 option b).
   * A dormant record has NO live pty — it is hydrated from the store on boot and
   * lives here UNTIL create({id}) promotes it into a live PtySession. Keeping it
   * in a SEPARATE map preserves the "every PtySession has a live pty" invariant
   * (Pitfall 4 — no `write`/`resize`/`stop` ever touches an undefined pty).
   */
  private readonly dormantRecords = new Map<LogicalId, SessionRecord>();
  private win: BrowserWindow | null = null;
  /** True once the process-global IPC handlers are wired (idempotency guard — CR-01). */
  private ipcRegistered = false;
  /**
   * Store change-signal (05-02, D-13). Injected from index.ts as
   * `() => store.scheduleSave()`. EVERY record mutation (create/close/updateProfile/
   * setOrder/setUiState/hydrate-promotion) calls this so the lowdb store
   * debounce-writes. No-op until set (e.g. in unit tests with no store wired).
   */
  private storeSignal: (() => void) | null = null;
  /**
   * In-memory UI preferences (05-01, D-12). setUiState() validates-then-holds these;
   * Plan 05-02 wires them through the lowdb store (scheduleSave on mutation).
   */
  private readonly uiState: {
    collapsed?: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
  } = {};

  /**
   * Spawn a login PTY and key it by a fresh LogicalId.
   *
   * Spawns `$SHELL -l` (login → native PATH parity, TERM-03) with the full
   * inherited env plus TERM=xterm-256color / COLORTERM=truecolor (SC4/TERM-04),
   * cwd defaulting to the user's home (D-02). cols/rows are clamped (T-02-03).
   */
  create(opts: PtyCreateOptions): PtyCreateResult {
    // IDENT-02: restart passes the existing id (reuse); add passes none (mint).
    const id = opts.id ?? newLogicalId();

    // PERS-02 promotion (Pattern 4 option b): when create() is called for a
    // DORMANT id (the Start ▶ path), read its stored profile from dormantRecords
    // and remove it from there — below it is spawned as a live PtySession under the
    // SAME logicalId. A live record (restart) takes precedence over a dormant one.
    const dormant = this.dormantRecords.get(id);
    if (dormant) this.dormantRecords.delete(id);

    // A2 (04-01, Pitfall 3): prefer an EDITED shell stored on the kept record when
    // non-empty, else fall back to resolveShell()'s platform default. The edited
    // shell launches with no extra args (the user supplied a full invocation path);
    // resolveShell() supplies its own login args ('-l') in the fallback path.
    // A promoted dormant record's stored profile is the `prior` for a Start (▶).
    const prior = this.sessions.get(id)?.record ?? dormant;
    const { shell, args } =
      prior?.shell && prior.shell.length
        ? { shell: prior.shell, args: [] as string[] }
        : resolveShell();

    // cwd default is resolved HERE, in main. The renderer never computes home —
    // it passes `cwd: undefined` and main owns the os.homedir() fallback (D-02).
    // A promoted dormant record (Start ▶) respects its stored cwd when opts omits one.
    const cwd =
      opts.cwd && opts.cwd.length
        ? opts.cwd
        : prior?.cwd && prior.cwd.length
          ? prior.cwd
          : os.homedir();

    const child = pty.spawn(shell, args, {
      name: 'xterm-256color', // sets $TERM inside the child (SC4)
      cols: clampDimension(opts.cols),
      rows: clampDimension(opts.rows),
      cwd, // resolved in main — D-02 / TERM-04
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    // ptyPid is the OS PID — kept as a plain number, NEVER assigned into a
    // LogicalId (IDENT-02). The map key is the LogicalId; the PID is returned
    // separately for the SessionRecord.
    const ptyPid = child.pid;

    // On restart, reuse the kept record's display fields (name/icon/order/cwd/shell/
    // startupCommand); on first spawn, build a fresh record with sensible defaults.
    // `prior` was read above (A2 shell-honor). startupCommand is carried through but
    // NEVER written to the PTY — TERM-05 auto-run stays deferred.
    const record: SessionRecord = {
      logicalId: id,
      ptyPid,
      name: opts.name ?? prior?.name ?? 'Session',
      icon: prior?.icon ?? { type: 'emoji', value: '🖥️' },
      cwd, // the resolved cwd (so a restart respects the original directory)
      shell, // the edited shell (A2) or the resolveShell() default
      startupCommand: prior?.startupCommand, // stored-only carry-through (TERM-05 deferred)
      status: 'running',
      // Pitfall 6: a NEW session's order is max(existing order)+1, NOT
      // this.sessions.size — size collides with a restored record's order after an
      // add/close cycle. A restart/promotion reuses prior.order; opts.order wins.
      order: opts.order ?? prior?.order ?? this.nextOrder(),
      lastActive: Date.now(),
    };

    // Flow control (SC5) is renderer-driven: the renderer counts bytes via the
    // term.write() callback and calls ptyPause()/ptyResume() (02-RESEARCH §Flow
    // Control, recommendation (a)). Main just spawns + pause()/resume()s the PTY;
    // it keeps no watermark of its own (avoids the dead-accountant of WR-01).
    this.sessions.set(id, {
      pty: child,
      alive: true,
      status: 'running',
      userStopped: false,
      record,
    });

    // Lifecycle logging ONLY — never log raw PTY data (Security V7, T-02-05).
    console.log(`[pty] spawned ${shell} pid=${ptyPid} (session ${id})`);

    // Broadcast the spawn → 'running' transition for live status badges (SC4).
    this.setStatus(id, 'running', { ptyPid });

    // A spawn (new session OR a dormant promotion) mutates the persisted set —
    // signal the store to debounce-write (D-13).
    this.signalStore();

    // TERM-05 startup-command auto-run (D-02/D-05/SC1/SC2). ONE hook here covers
    // ALL three spawn entry points — new-with-command, Restart-respawn, and dormant
    // Start-promotion — because every one of them funnels through create() (D-05).
    //
    //   - Empty/whitespace startupCommand → wire normal forwarding and skip the
    //     probe entirely: a bare login shell, no injected input (SC2/TERM-03).
    //   - Non-empty startupCommand → run the invisible readiness probe: a transient
    //     onData interceptor BUFFERS bytes and NEVER calls this.send() for them
    //     (D-02 invisibility — the load-bearing lever), the no-side-effect nonce
    //     marker is written, and once probe.matches(buffer) confirms the shell has
    //     genuinely processed a line, the interceptor disposes, the buffered probe
    //     bytes are DISCARDED (never forwarded), normal forwarding is restored, and
    //     the command is injected ONCE as `cmd + '\r'` (CR — a real Enter; lands in
    //     shell history; bypasses the renderer bracketed-paste path that exists to
    //     PREVENT auto-execute — SC1).
    //
    // Security V7 (T-05.1-03): lifecycle logging only — the command, the probe
    // nonce, and the buffered (nonce-bearing) bytes are NEVER logged.
    const cmd = record.startupCommand?.trim();
    if (!cmd) {
      // No startup command → normal bare shell (SC2/TERM-03). No probe, no inject.
      this.wireNormalOnData(id, child);
    } else {
      // zsh + bash share the POSIX ':' no-op probe on macOS (D-03). Windows throws
      // (Phase-8 stub) — an unverified Windows shell must fail loudly, not mis-fire.
      const probe = selectReadinessProbe(process.platform).forShell(record.shell);
      let buffer = '';
      let settled = false;
      const offProbe = child.onData((data) => {
        // After the marker round-trips, forwarding is restored via wireNormalOnData;
        // this guard covers any byte that races in before the listener swap settles.
        if (settled) {
          this.send(PTY_CHANNELS.data, { id, data });
          return;
        }
        // Pre-match bytes are BUFFERED and NEVER sent — invisibility (D-02).
        buffer += data;
        if (probe.matches(buffer)) {
          settled = true;
          // TODO(Plan 03 / D-04): clear the READINESS_TIMEOUT_MS timer here so the
          // timeout-flush-and-notice branch never fires after a successful match.
          offProbe.dispose();
          // The buffered probe bytes (marker echo + nonce-bearing prompt) are
          // DISCARDED — they never reach the renderer (D-02 invisibility).
          this.wireNormalOnData(id, child);
          // Inject the user's saved command as a real Enter (CR 0x0D, NOT LF) so it
          // echoes visibly and lands in shell history (SC1). This is the main-side
          // write — NOT the renderer term.paste() bracketed-paste path (which exists
          // specifically to PREVENT auto-execute). T-05.1-01: same trust boundary as
          // the user typing their own saved command in their own shell.
          child.write(cmd + '\r');
        }
      });
      // Send the no-side-effect nonce probe to elicit a readiness round-trip. The
      // marker is `buildPosixProbe`'s ': <nonce>\r' — no user data is interpolated
      // (T-05.1-02), changes no shell state (D-01).
      child.write(probe.marker);
      // TODO(Plan 03 / D-04): on READINESS_TIMEOUT_MS with !settled → offProbe.dispose(),
      // FLUSH the buffered prompt via this.send(PTY_CHANNELS.data, { id, data: buffer })
      // so the bare shell is usable (SC4), wireNormalOnData(id, child), and emit the
      // ready-fail notice on onPtyStatus — but NEVER best-effort inject the command
      // (D-04). The timer is intentionally NOT implemented here (Plan 02 is happy-path
      // only); READINESS_TIMEOUT_MS is added in Plan 03.
    }

    child.onExit(({ exitCode }) => {
      console.log(`[pty] exit code=${exitCode} (session ${id})`);
      const s = this.sessions.get(id);
      // Clear any in-flight SIGKILL grace timer — the child exited first, so the
      // force-kill must never run (Pattern 3/4 grace-period race).
      if (s?.killTimer) {
        clearTimeout(s.killTimer);
        s.killTimer = undefined;
      }
      // Derive status from exitCode + the userStopped flag — NEVER from signal.
      const status = deriveStatus({
        exitCode,
        userStopped: s?.userStopped ?? false,
      });
      // KEEP the SessionRecord (status updated) so the row stays restartable and
      // listSessions() still returns it; drop ONLY the live pty handle (Pitfall 5).
      if (s) {
        s.alive = false;
        s.status = status;
        s.record.status = status;
        s.record.ptyPid = undefined; // the OS process is gone
      }
      this.setStatus(id, status, { exitCode });
      this.send(PTY_CHANNELS.exit, { id, exitCode });
      // The record's status/ptyPid changed → persist the new (dormant-on-restart)
      // shape so a quit right after an exit restores the correct status (D-13).
      this.signalStore();
    });

    return { id, pid: ptyPid };
  }

  /**
   * The shared normal-forwarding wiring (TERM-05 refactor). Forwards every PTY
   * output chunk straight to the renderer as a `pty:data` event. Called on BOTH
   * the empty-command path (a bare shell, immediately) AND the post-probe resume
   * path (after the readiness marker round-trips and the probe bytes are
   * discarded). ONE definition keeps the two paths byte-identical.
   *
   * The UTF-8 string is forwarded straight through — no binary re-encoding (would
   * risk splitting a multibyte char and corrupting CJK/emoji — SC4).
   */
  private wireNormalOnData(id: LogicalId, child: IPty): void {
    child.onData((data) => {
      this.send(PTY_CHANNELS.data, { id, data });
    });
  }

  /**
   * Update a session's status (in-memory + on its kept record) and broadcast a
   * `pty:status` event to the current window for live badge updates (SC4, Pattern 5).
   * Mirrors the onData send-target pattern (handlers read `this.win` lazily).
   */
  private setStatus(
    id: LogicalId,
    status: SessionStatus,
    extra?: { ptyPid?: number; exitCode?: number },
  ): void {
    const s = this.sessions.get(id);
    if (s) {
      s.status = status;
      s.record.status = status;
    }
    this.send(PTY_CHANNELS.status, { id, status, ...extra });
  }

  /**
   * Inject the store change-signal (05-02, D-13). index.ts calls this with
   * `() => store.scheduleSave()` after store.load()/hydrate() so every subsequent
   * record mutation debounce-writes. Idempotent; null clears it.
   */
  setStoreSignal(cb: (() => void) | null): void {
    this.storeSignal = cb;
  }

  /**
   * Fire the store change-signal if one is wired AND push the current live+dormant
   * snapshot to the store so the next debounced write persists the latest records.
   * A no-op when no signal is set (unit tests, pre-wiring).
   */
  private signalStore(): void {
    this.storeSignal?.();
  }

  /**
   * Next display order for a brand-new session (Pitfall 6): max(order) over every
   * KNOWN record — live AND dormant — plus 1. `-1` base so the first session gets
   * order 0. Never `this.sessions.size` (collides with restored orders).
   */
  private nextOrder(): number {
    let max = -1;
    for (const s of this.sessions.values()) {
      if (s.record.order > max) max = s.record.order;
    }
    for (const r of this.dormantRecords.values()) {
      if (r.order > max) max = r.order;
    }
    return max + 1;
  }

  /**
   * Hydrate the dormant-record map from the store on boot (PERS-02, Pattern 4
   * option b). Each record is already coerced to `not_started` + ptyPid-cleared by
   * the store (D-01/SC2). Records are stored WITHOUT spawning a pty — they become
   * live only when create({id}) promotes them (the Start ▶ path). Replaces any
   * prior dormant set (boot is a one-shot hydrate).
   */
  hydrate(records: SessionRecord[]): void {
    this.dormantRecords.clear();
    for (const rec of records) {
      this.dormantRecords.set(rec.logicalId, rec);
    }
  }

  /**
   * Safe send to the renderer — the ONLY path PTY events take to the window.
   *
   * On shutdown, `win.on('closed')` destroys the BrowserWindow, but node-pty may
   * still flush a final buffered onData/onExit chunk synchronously as its child is
   * killed (disposeAll). A bare `this.win?.webContents.send(...)` only guards null;
   * a DESTROYED-but-non-null window throws `TypeError: Object has been destroyed`,
   * repeating per buffered chunk (TERM-06/08 shutdown crash). Guard on BOTH the
   * window and its webContents being destroyed before sending.
   */
  private send(channel: string, payload: unknown): void {
    const w = this.win;
    if (w && !w.isDestroyed() && !w.webContents.isDestroyed()) {
      w.webContents.send(channel, payload);
    }
  }

  /**
   * Detach the renderer window target (set it to null) so any in-flight PTY flush
   * during shutdown becomes a no-op. Called from `win.on('closed')` BEFORE
   * disposeAll() so synchronous onData/onExit flushes from the kill never reach a
   * destroyed window (belt-and-braces with the isDestroyed() guard in send()).
   */
  detachWindow(): void {
    this.win = null;
  }

  /**
   * Stop a session gracefully. POSIX: SIGTERM → SIGKILL after STOP_GRACE_MS;
   * win32: a single bare kill() (ConPTY has NO signal model — kill('SIGTERM')
   * THROWS there, Pattern 4). The SessionRecord is KEPT (status → 'stopped' via
   * the userStopped flag when onExit fires). Unknown/forged id → ignored (T-03-01).
   */
  stop(id: LogicalId): void {
    const s = this.sessions.get(id);
    if (!s || !s.alive) return; // unknown/forged id or already dead (T-03-01)
    s.userStopped = true; // → exit maps to 'stopped' (deriveStatus)
    if (process.platform === 'win32') {
      s.pty.kill(); // ConPTY: unconditional terminate, NO signal arg
      return;
    }
    s.pty.kill('SIGTERM'); // POSIX: ask politely
    s.killTimer = setTimeout(() => {
      try {
        s.pty.kill('SIGKILL'); // force if it ignored SIGTERM
      } catch {
        // The handle may be dead between SIGTERM and the timer fire — node-pty
        // throws on kill of a dead child; cleanup must not crash.
      }
    }, STOP_GRACE_MS);
  }

  /**
   * Restart a session: stop the old PTY, await its exit, then create a NEW PTY
   * under the SAME logicalId (IDENT-02 — same id, new ptyPid). Orchestrated in main
   * so the Map invariant (one live pty per id) is enforced in one place (RESEARCH
   * Open Q1). Unknown id → no-op.
   */
  restart(id: LogicalId): Promise<PtyCreateResult> {
    const s = this.sessions.get(id);
    if (!s) {
      return Promise.reject(new Error(`restart: unknown session ${id}`)); // T-03-01
    }
    const record = s.record;
    return new Promise<PtyCreateResult>((resolve) => {
      const respawn = (): void => {
        // SessionRecord carries no cols/rows — the renderer re-fits + ptyResize()s
        // on attach (Pattern 8), so a sane default here is corrected immediately.
        const result = this.create({
          cols: 80,
          rows: 24,
          cwd: record.cwd,
          id, // reuse the SAME logicalId (IDENT-02)
          name: record.name,
          order: record.order,
        });
        resolve(result);
      };
      if (s.alive) {
        // Wait for the old PTY to exit before re-spawning (no two live ptys/id).
        s.pty.onExit(() => respawn());
        this.stop(id);
      } else {
        // Already exited/stopped — re-spawn immediately under the same id.
        respawn();
      }
    });
  }

  /**
   * Snapshot of all current SessionRecords — LIVE (incl. stopped/exited kept for
   * restart) MERGED with DORMANT (restored-not-yet-started) records, sorted by
   * `order` (PERS-02, Pattern 4). Main is the source of truth (RESEARCH Open Q2);
   * this is exactly what the store persists, so it returns dormant rows too so the
   * renderer renders restored sessions and a dormant→live promotion is seamless.
   */
  listSessions(): SessionRecord[] {
    const live = Array.from(this.sessions.values()).map((s) => s.record);
    const dormant = Array.from(this.dormantRecords.values());
    return [...live, ...dormant].sort((a, b) => a.order - b.order);
  }

  /** Write keystroke bytes to a PTY. Unknown/dead id OR non-string data → ignored. */
  write(id: LogicalId, data: unknown): void {
    if (!isStringData(data)) return; // type guard (T-02-02)
    const session = this.sessions.get(id);
    if (!session || !session.alive) return; // unknown/forged/dead id (T-02-04)
    session.pty.write(data);
  }

  /** Resize a PTY. Unknown/dead id → ignored; cols/rows clamped 1..1000 (T-02-03). */
  resize(id: LogicalId, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session || !session.alive) return; // unknown/dead id (T-02-04)
    session.pty.resize(clampDimension(cols), clampDimension(rows));
  }

  /** Pause a PTY (backpressure). Unknown/dead id → ignored. */
  pause(id: LogicalId): void {
    const session = this.sessions.get(id);
    if (!session || !session.alive) return;
    session.pty.pause();
  }

  /** Resume a paused PTY. Unknown/dead id → ignored. */
  resume(id: LogicalId): void {
    const session = this.sessions.get(id);
    if (!session || !session.alive) return;
    session.pty.resume();
  }

  /**
   * Destructive CLOSE (D-03a): kill a single PTY AND drop its SessionRecord from
   * the live map (close+remove primitive). Unlike stop() — which KEEPS the record
   * as 'stopped' for restart — close() permanently removes the session so it
   * vanishes from listSessions() and the renderer's reconcile poll never re-adds it.
   * Unknown/forged id → no-op (T-03-01: validated against the sessions store).
   */
  close(id: LogicalId): void {
    const session = this.sessions.get(id);
    if (!session) {
      // A dormant (restored-not-started) session can be discarded too — drop it
      // from the dormant map and persist the shrink (no pty to kill).
      if (this.dormantRecords.delete(id)) this.signalStore();
      return; // unknown/forged id otherwise (T-03-01)
    }
    if (session.killTimer) clearTimeout(session.killTimer);
    try {
      session.pty.kill();
    } catch {
      // Already-dead children throw on kill; ignore.
    }
    this.sessions.delete(id);
    this.signalStore(); // the persisted set shrank → debounce-write (D-13)
  }

  /**
   * Persist edited profile fields onto a session's kept record (04-01, D-02, SESS-01).
   *
   * id-validated + type-guarded mutation (mirrors close()'s unknown-id no-op and
   * isStringData's type guard):
   *   - unknown/forged id → no-op (T-04-01).
   *   - each of name/cwd/shell/startupCommand is written ONLY when `typeof === 'string'`
   *     (T-04-02 — a forged renderer payload with non-string fields is ignored).
   *   - icon is assigned when present (the renderer always sends a well-formed
   *     SessionIconSpec from the pure icon-spec builders).
   *
   * cwd/shell/startupCommand take effect on the NEXT restart (create() reads the
   * stored shell via the A2 guard, and respawns from record.cwd). name/icon are
   * mirrored here so a restart — which rebuilds the record from these fields — does
   * not revert a live edit (Pitfall 4). startupCommand is STORED ONLY: no code path
   * writes it to a PTY this phase (TERM-05 auto-run deferred, T-04-04).
   *
   * CR-02 (dual-map): the target is resolved from BOTH the live `sessions` map AND
   * the `dormantRecords` map (mirroring setOrder). A boot-restored session lives in
   * dormantRecords until Started, so editing its profile MUST land on the dormant
   * record — otherwise the edit is silently dropped and lost on the next boot.
   *
   * CR-01 (validate-in-main, RCE-class): `shell` and `cwd` cross the untrusted IPC
   * boundary and `create()` later spawns the shell as the executable in cwd. A
   * forged `pty:update-profile` payload must NOT be able to persist an arbitrary
   * binary or directory. So shell is accepted ONLY if it is empty (the "use the
   * resolveShell() default" affordance create() honors) OR in the discovered
   * allowlist; cwd is accepted ONLY if it is an absolute path to an EXISTING
   * directory. Non-allowlisted shells / invalid cwds are ignored, keeping the prior
   * value — the legitimate dropdown/edit flow only ever submits allowlisted shells
   * and real directories, so it is unaffected.
   */
  updateProfile(
    id: LogicalId,
    fields: {
      name?: string;
      icon?: SessionIconSpec;
      cwd?: string;
      shell?: string;
      startupCommand?: string;
    },
  ): void {
    // CR-02: resolve from BOTH maps — a restored (dormant) session is editable
    // before it is ever Started (mirrors setOrder's dual-map handling).
    const live = this.sessions.get(id);
    const target = live?.record ?? this.dormantRecords.get(id);
    if (!target) return; // truly unknown/forged id → no-op (T-04-01)

    if (typeof fields.name === 'string') target.name = fields.name;

    // CR-01: cwd must be an absolute path to an existing directory. statSync may
    // throw (ENOENT) — guard it; a forged/relative/non-existent cwd is ignored,
    // keeping the prior value so a malicious payload cannot redirect the spawn.
    if (typeof fields.cwd === 'string' && this.isValidCwd(fields.cwd)) {
      target.cwd = fields.cwd;
    }

    // CR-01: only an empty shell (→ resolveShell() default in create()) OR an
    // allowlisted discovered shell may persist. discoverShells() does disk I/O, so
    // it is called at most ONCE per update and only when a string shell was sent.
    if (typeof fields.shell === 'string' && this.isValidShell(fields.shell)) {
      target.shell = fields.shell;
    }

    if (typeof fields.startupCommand === 'string') {
      target.startupCommand = fields.startupCommand; // stored-only (T-04-04)
    }
    if (fields.icon) target.icon = fields.icon;
    this.signalStore(); // edited profile fields changed → debounce-write (D-13)
  }

  /**
   * CR-01 cwd validation: accept only an ABSOLUTE path to an EXISTING directory.
   * statSync throws on a missing path — caught so a forged payload is a silent
   * reject (prior cwd kept), never a crash.
   */
  private isValidCwd(cwd: string): boolean {
    if (!path.isAbsolute(cwd)) return false;
    try {
      return fs.statSync(cwd).isDirectory();
    } catch {
      return false; // non-existent / unreadable → reject, keep prior value
    }
  }

  /**
   * CR-01 shell validation: an EMPTY shell is valid (create() falls back to
   * resolveShell() — the documented "use default" affordance); a NON-empty shell
   * is valid ONLY if it is in the discovered allowlist. discoverShells() touches
   * the filesystem, so it is invoked once here, guarded behind the empty check.
   */
  private isValidShell(shell: string): boolean {
    if (shell.length === 0) return true; // empty → resolveShell() default (A2)
    return this.discoverShells().some((d) => d.path === shell);
  }

  /**
   * Return the platform-available shells for the edit-form dropdown (05-01).
   * Delegates to the per-platform provider (macOS reads /etc/shells + $SHELL,
   * filters on-disk, de-dupes — D-05/D-06; Windows is a Phase-8 stub). The
   * filesystem read is confined to main — the renderer never touches fs.
   */
  discoverShells(): DiscoveredShell[] {
    return selectShellProvider(process.platform).discover();
  }

  /**
   * Persist the user's sidebar order onto the kept records (05-01, NAV-04/D-08).
   *
   * VALIDATE-IN-MAIN (Shared Pattern B / T-05-01): each entry's `id` must be a
   * KNOWN LogicalId AND its `order` must be a finite number before any mutation.
   * Unknown ids and non-finite orders are silently skipped — a forged payload can
   * never write arbitrary data. Plan 05-02 wires the lowdb store behind this setter
   * (it currently mutates the in-memory record so the channel surface is complete).
   */
  setOrder(orders: unknown): void {
    if (!Array.isArray(orders)) return; // forged/non-array payload → no-op (T-05-01)
    for (const entry of orders) {
      if (!entry || typeof entry !== 'object') continue;
      const { id, order } = entry as { id?: unknown; order?: unknown };
      if (typeof id !== 'string' || typeof order !== 'number' || !Number.isFinite(order)) {
        continue; // type-guard each field (T-05-01)
      }
      // Apply to a live record OR a dormant (restored-not-started) record — a
      // restored session can be reordered before it is ever started (NAV-04).
      const live = this.sessions.get(id as LogicalId);
      if (live) {
        live.record.order = order;
        continue;
      }
      const dormant = this.dormantRecords.get(id as LogicalId);
      if (dormant) dormant.order = order; // unknown id otherwise → skip (T-05-01)
    }
    this.signalStore(); // reordered set → debounce-write (NAV-04/D-13)
  }

  /**
   * Persist UI preferences — sidebar collapse + window bounds (05-01, D-12).
   *
   * VALIDATE-IN-MAIN (Shared Pattern B / T-05-01): `collapsed` (when present) must
   * be a boolean; `bounds` (when present) must have finite x/y/width/height. A
   * forged payload is a silent no-op. Plan 05-02 wires the lowdb store behind this
   * setter; for now it guards + holds the value in-memory so the surface is complete.
   */
  setUiState(ui: unknown): void {
    if (!ui || typeof ui !== 'object') return; // forged payload → no-op (T-05-01)
    const { collapsed, bounds } = ui as { collapsed?: unknown; bounds?: unknown };
    if (typeof collapsed === 'boolean') {
      this.uiState.collapsed = collapsed;
    }
    if (bounds && typeof bounds === 'object') {
      const { x, y, width, height } = bounds as Record<string, unknown>;
      if (
        typeof x === 'number' && Number.isFinite(x) &&
        typeof y === 'number' && Number.isFinite(y) &&
        typeof width === 'number' && Number.isFinite(width) &&
        typeof height === 'number' && Number.isFinite(height)
      ) {
        this.uiState.bounds = { x, y, width, height };
      }
    }
    this.signalStore(); // collapse/bounds changed → debounce-write (D-12/D-13)
  }

  /**
   * Read the current validated UI preferences (collapse + bounds) so index.ts can
   * push them into the store's ui slot on every change (05-02, D-12). Returns a
   * shallow copy so callers cannot mutate the internal state.
   */
  getUiState(): { collapsed?: boolean; bounds?: { x: number; y: number; width: number; height: number } } {
    return { ...this.uiState };
  }

  /** Kill every live PTY + clear any grace timer — orphan-safe cleanup (Pitfall 6, T-02-06/T-03-05). */
  disposeAll(): void {
    for (const session of this.sessions.values()) {
      if (session.killTimer) clearTimeout(session.killTimer); // T-03-05: no leaked grace timer
      try {
        session.pty.kill();
      } catch {
        // Already-dead children throw on kill; cleanup must not crash quit.
      }
    }
    this.sessions.clear();
  }

  /**
   * Point PTY output (`pty:data`/`pty:exit`) at the current window, then wire the
   * validated IPC handlers ONCE.
   *
   * IPC handlers are **process-global**, not per-window (Electron has no
   * per-window `ipcMain`). The macOS close-then-reopen flow calls this again via
   * `app.on('activate') → createWindow()`; re-running `ipcMain.handle` would throw
   * "Attempted to register a second handler for 'pty:create'" and re-running
   * `ipcMain.on` would stack duplicate listeners that fire N times (CR-01).
   *
   * So: always update `this.win` (the send target — handlers read it lazily, so
   * `pty:data`/`pty:exit` always reach the *current* window), but register the
   * handlers only on the first call. Idempotent across N create/destroy cycles.
   */
  registerIpc(win: BrowserWindow): void {
    this.win = win;
    if (this.ipcRegistered) return; // idempotent — handlers are process-global (CR-01)
    this.ipcRegistered = true;

    ipcMain.handle(PTY_CHANNELS.create, (_event, opts: PtyCreateOptions) =>
      this.create(opts),
    );

    ipcMain.on(
      PTY_CHANNELS.write,
      (_event: IpcMainEvent, id: LogicalId, data: unknown) => this.write(id, data),
    );

    ipcMain.on(
      PTY_CHANNELS.resize,
      (_event: IpcMainEvent, id: LogicalId, cols: number, rows: number) =>
        this.resize(id, cols, rows),
    );

    ipcMain.on(PTY_CHANNELS.pause, (_event: IpcMainEvent, id: LogicalId) =>
      this.pause(id),
    );

    ipcMain.on(PTY_CHANNELS.resume, (_event: IpcMainEvent, id: LogicalId) =>
      this.resume(id),
    );

    // 03-01 lifecycle channels — registered inside the idempotency guard (T-03-02).
    // stop is fire-and-forget (.on); restart/list are request-response (.handle).
    // Each id-taking handler validates via the sessions/record store (T-03-01).
    ipcMain.on(PTY_CHANNELS.stop, (_event: IpcMainEvent, id: LogicalId) =>
      this.stop(id),
    );

    ipcMain.handle(PTY_CHANNELS.restart, (_event, id: LogicalId) =>
      this.restart(id),
    );

    ipcMain.handle(PTY_CHANNELS.list, () => this.listSessions());

    // D-03a destructive close — fire-and-forget (.on), inside the idempotency guard
    // (T-03-02). close() validates id against the sessions store (unknown → no-op).
    ipcMain.on(PTY_CHANNELS.close, (_event: IpcMainEvent, id: LogicalId) =>
      this.close(id),
    );

    // 04-01 identity — fire-and-forget (.on), inside the idempotency guard
    // (T-03-02). updateProfile() id-validates + type-guards (unknown id → no-op).
    ipcMain.on(
      PTY_CHANNELS.updateProfile,
      (
        _event: IpcMainEvent,
        id: LogicalId,
        fields: {
          name?: string;
          icon?: SessionIconSpec;
          cwd?: string;
          shell?: string;
          startupCommand?: string;
        },
      ) => this.updateProfile(id, fields),
    );

    // 05-01 persistence + discovery — inside the idempotency guard (T-03-02).
    // discover is request-response (.handle); persistOrder/persistUi are
    // fire-and-forget (.on) and validate-in-main before any mutation (T-05-01).
    ipcMain.handle(PTY_CHANNELS.discover, () => this.discoverShells());

    ipcMain.on(PTY_CHANNELS.persistOrder, (_event: IpcMainEvent, orders: unknown) =>
      this.setOrder(orders),
    );

    ipcMain.on(PTY_CHANNELS.persistUi, (_event: IpcMainEvent, ui: unknown) =>
      this.setUiState(ui),
    );
  }

  /**
   * Tear down the process-global IPC handlers and clear the window target.
   * Symmetric with `registerIpc`, so a subsequent `registerIpc` re-wires cleanly
   * (used on teardown; keeps re-activation crash-free — CR-01).
   */
  unregisterIpc(): void {
    ipcMain.removeHandler(PTY_CHANNELS.create);
    ipcMain.removeAllListeners(PTY_CHANNELS.write);
    ipcMain.removeAllListeners(PTY_CHANNELS.resize);
    ipcMain.removeAllListeners(PTY_CHANNELS.pause);
    ipcMain.removeAllListeners(PTY_CHANNELS.resume);
    // 03-01 lifecycle channels — symmetric teardown (T-03-02; keeps re-register clean).
    ipcMain.removeAllListeners(PTY_CHANNELS.stop);
    ipcMain.removeHandler(PTY_CHANNELS.restart);
    ipcMain.removeHandler(PTY_CHANNELS.list);
    ipcMain.removeAllListeners(PTY_CHANNELS.close); // D-03a destructive close (T-03-02)
    ipcMain.removeAllListeners(PTY_CHANNELS.updateProfile); // 04-01 identity (T-03-02)
    // 05-01 persistence + discovery — symmetric teardown (T-03-02).
    ipcMain.removeHandler(PTY_CHANNELS.discover);
    ipcMain.removeAllListeners(PTY_CHANNELS.persistOrder);
    ipcMain.removeAllListeners(PTY_CHANNELS.persistUi);
    this.ipcRegistered = false;
    this.win = null;
  }
}
