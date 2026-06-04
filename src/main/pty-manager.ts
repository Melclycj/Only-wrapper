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
import * as pty from 'node-pty';
import { ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron';
import type { IPty } from 'node-pty';
import type { LogicalId } from '../shared/types';
import { newLogicalId } from '../shared/id-factory';
import { resolveShell } from './shell-resolver';
import { createWatermark, type Watermark } from './flow-control';

/** IPC channel names (payloads carry `id` so the design scales to N sessions). */
export const PTY_CHANNELS = {
  create: 'pty:create',
  write: 'pty:write',
  resize: 'pty:resize',
  pause: 'pty:pause',
  resume: 'pty:resume',
  data: 'pty:data',
  exit: 'pty:exit',
} as const;

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
}

/** The result of a successful spawn: stable logical id + the live OS PID. */
export interface PtyCreateResult {
  id: LogicalId;
  /** OS process id — stored/returned SEPARATELY from the LogicalId (IDENT-02). */
  pid: number;
}

interface PtySession {
  pty: IPty;
  /** Per-session backpressure accountant (SC5). */
  watermark: Watermark;
}

/**
 * Owns the live node-pty children keyed by LogicalId (one this phase; N in
 * Phase 3). All renderer-supplied args are validated here before reaching node-pty.
 */
export class PtyManager {
  private readonly sessions = new Map<LogicalId, PtySession>();
  private win: BrowserWindow | null = null;
  /** True once the process-global IPC handlers are wired (idempotency guard — CR-01). */
  private ipcRegistered = false;

  /**
   * Spawn a login PTY and key it by a fresh LogicalId.
   *
   * Spawns `$SHELL -l` (login → native PATH parity, TERM-03) with the full
   * inherited env plus TERM=xterm-256color / COLORTERM=truecolor (SC4/TERM-04),
   * cwd defaulting to the user's home (D-02). cols/rows are clamped (T-02-03).
   */
  create(opts: PtyCreateOptions): PtyCreateResult {
    const id = newLogicalId();
    const { shell, args } = resolveShell();

    const child = pty.spawn(shell, args, {
      name: 'xterm-256color', // sets $TERM inside the child (SC4)
      cols: clampDimension(opts.cols),
      rows: clampDimension(opts.rows),
      cwd: opts.cwd ?? os.homedir(), // D-02 / TERM-04
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

    const watermark = createWatermark(100000, 10000);
    this.sessions.set(id, { pty: child, watermark });

    // Lifecycle logging ONLY — never log raw PTY data (Security V7, T-02-05).
    console.log(`[pty] spawned ${shell} pid=${ptyPid} (session ${id})`);

    // Forward the UTF-8 string straight through — no binary re-encoding
    // (would risk splitting a multibyte char and corrupting CJK/emoji — SC4).
    child.onData((data) => {
      this.win?.webContents.send(PTY_CHANNELS.data, { id, data });
    });

    child.onExit(({ exitCode }) => {
      console.log(`[pty] exit code=${exitCode} (session ${id})`);
      this.sessions.delete(id);
      this.win?.webContents.send(PTY_CHANNELS.exit, { id, exitCode });
    });

    return { id, pid: ptyPid };
  }

  /** Write keystroke bytes to a PTY. Unknown id OR non-string data → ignored. */
  write(id: LogicalId, data: unknown): void {
    if (!isStringData(data)) return; // type guard (T-02-02)
    const session = this.sessions.get(id);
    if (!session) return; // unknown/forged id (T-02-04)
    session.pty.write(data);
  }

  /** Resize a PTY. Unknown id → ignored; cols/rows clamped 1..1000 (T-02-03). */
  resize(id: LogicalId, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session) return; // unknown id (T-02-04)
    session.pty.resize(clampDimension(cols), clampDimension(rows));
  }

  /** Pause a PTY (backpressure). Unknown id → ignored. */
  pause(id: LogicalId): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.pty.pause();
  }

  /** Resume a paused PTY. Unknown id → ignored. */
  resume(id: LogicalId): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.pty.resume();
  }

  /** Kill a single PTY and drop it from the live map. */
  kill(id: LogicalId): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.pty.kill();
    this.sessions.delete(id);
  }

  /** Kill every live PTY — orphan-safe cleanup (Pitfall 6, T-02-06). */
  disposeAll(): void {
    for (const { pty: child } of this.sessions.values()) {
      try {
        child.kill();
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
    this.ipcRegistered = false;
    this.win = null;
  }
}
