// Wave 0 failing stub — covers SC3 / TERM-07 (lifecycle: stop grace timer,
// restart identity) and the os.homedir() cwd default (Warning fix).
//
// These tests INTENTIONALLY FAIL RED until Task 3 of plan 03-01 implements on
// src/main/pty-manager.ts:
//   - stop(id): POSIX kill('SIGTERM') → killTimer → kill('SIGKILL') after STOP_GRACE_MS;
//               win32 bare kill() (no signal — ConPTY throws on signal).
//   - restart(id): same logicalId map key, NEW ptyPid (IDENT-02).
//   - create() with cwd undefined/empty spawns with cwd === os.homedir() (MAIN resolves home).
//   - onExit clearing killTimer so SIGKILL never runs if the child exits first.
//
// Harness mirrors ipc-registration.test.ts: mock `electron` + `node-pty`, drive a
// fake IPty whose onData/onExit callbacks we capture so the test can fire them.
//
// When Task 3 turns these GREEN, delete this comment block.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock os.homedir so the cwd-default assertion is deterministic ─────────────
const FAKE_HOME = '/Users/fake-home';
vi.mock('node:os', () => ({
  default: { homedir: () => FAKE_HOME },
  homedir: () => FAKE_HOME,
}));

// Plan 06-02: create() now PRE-VALIDATES the resolved cwd (D-01) — an explicit cwd
// that is not an existing directory errors before spawning. These lifecycle fixtures
// spawn into the mocked FAKE_HOME (the no-cwd default's resolved value, reused on
// restart) and the explicit '/tmp/project', neither of which exists on the test host.
// Mock node:fs so exactly those fixture directories validate; everything else throws
// ENOENT. (The no-cwd path is unaffected — undefined cwd skips pre-validation entirely.)
vi.mock('node:fs', () => {
  // Inline literals (no module-scope const) — vi.mock factories are hoisted above
  // top-level declarations, so referencing FAKE_HOME here would be a TDZ error.
  const OK = new Set(['/Users/fake-home', '/tmp/project']);
  const statSync = (p: string): { isDirectory: () => boolean } => {
    if (OK.has(p)) return { isDirectory: () => true };
    throw new Error('ENOENT');
  };
  return { default: { statSync }, statSync };
});

// ── Mock electron.ipcMain (registerIpc touches it but these tests call create/
//    stop/restart directly; the handlers just need to exist without throwing) ──
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

// ── Mock node-pty: spawn() returns a controllable fake IPty with an incrementing
//    pid; captured onData/onExit callbacks let the test fire exit/data; spawn
//    options are recorded so the cwd-default assertion can inspect them. ────────
type ExitCb = (e: { exitCode: number; signal?: number }) => void;
type DataCb = (d: string) => void;

interface FakeChild {
  pid: number;
  kill: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  onData: (cb: DataCb) => { dispose: () => void };
  onExit: (cb: ExitCb) => { dispose: () => void };
  _fireExit: (e: { exitCode: number; signal?: number }) => void;
  _fireData: (d: string) => void;
}

const spawnCalls: Array<{ options: { cwd?: string } }> = [];
const spawnedChildren: FakeChild[] = [];
let nextPid = 1000;

function makeFakeChild(): FakeChild {
  const dataCbs: DataCb[] = [];
  const exitCbs: ExitCb[] = [];
  return {
    pid: nextPid++,
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onData: (cb: DataCb) => {
      dataCbs.push(cb);
      return {
        dispose: () => {
          const i = dataCbs.indexOf(cb);
          if (i >= 0) dataCbs.splice(i, 1);
        },
      };
    },
    onExit: (cb: ExitCb) => {
      exitCbs.push(cb);
      // Mirror node-pty's IDisposable contract: disposing removes the listener.
      return {
        dispose: () => {
          const i = exitCbs.indexOf(cb);
          if (i >= 0) exitCbs.splice(i, 1);
        },
      };
    },
    // Iterate over a snapshot so a listener disposing itself on first fire
    // (the CR-02 restart guard) does not perturb the in-flight iteration.
    _fireExit: (e) => [...exitCbs].forEach((cb) => cb(e)),
    _fireData: (d) => [...dataCbs].forEach((cb) => cb(d)),
  };
}

const spawnMock = vi.fn((_shell: string, _args: string[], options: { cwd?: string }) => {
  const child = makeFakeChild();
  spawnCalls.push({ options });
  spawnedChildren.push(child);
  return child;
});

vi.mock('node-pty', () => ({ spawn: (...a: unknown[]) => spawnMock(...(a as [string, string[], { cwd?: string }])) }));

// shell-resolver is real-importable but we stub it to avoid platform branching here.
vi.mock('../shell-resolver', () => ({
  resolveShell: () => ({ shell: '/bin/zsh', args: ['-l'] }),
}));

import { PtyManager, type PtyCreateOptions } from '../pty-manager';
import type { SessionRecord } from '../../shared/types';

// A real BrowserWindow always exposes isDestroyed() on both the window and its
// webContents; the PtyManager.send() shutdown guard reads them, so the stub must too.
function fakeWindow(): never {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn(), isDestroyed: () => false },
  } as never;
}

const ORIGINAL_PLATFORM = process.platform;
function setPlatform(p: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: p, configurable: true });
}

describe('PtyManager lifecycle (SC3, TERM-07)', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    spawnedChildren.length = 0;
    nextPid = 1000;
    spawnMock.mockClear();
    setPlatform('darwin');
  });

  afterEach(() => {
    setPlatform(ORIGINAL_PLATFORM);
    vi.useRealTimers();
  });

  const baseOpts: PtyCreateOptions = { cols: 80, rows: 24 };

  it('create() with no cwd spawns in os.homedir() (MAIN resolves home, renderer passes undefined)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    mgr.create({ ...baseOpts, cwd: undefined });
    expect(spawnCalls[0].options.cwd).toBe(FAKE_HOME);
  });

  it('create() with an empty-string cwd also falls back to os.homedir()', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    mgr.create({ ...baseOpts, cwd: '' });
    expect(spawnCalls[0].options.cwd).toBe(FAKE_HOME);
  });

  it('create() with an explicit cwd honors it (no homedir override)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    mgr.create({ ...baseOpts, cwd: '/tmp/project' });
    expect(spawnCalls[0].options.cwd).toBe('/tmp/project');
  });

  it('stop() on POSIX sends SIGTERM then SIGKILL after STOP_GRACE_MS', () => {
    vi.useFakeTimers();
    setPlatform('darwin');
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);
    const child = spawnedChildren[0];

    mgr.stop(id);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(child.kill).not.toHaveBeenCalledWith('SIGKILL');

    // Advance past the grace window — SIGKILL must fire (process ignored SIGTERM).
    vi.advanceTimersByTime(5000);
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('stop() POSIX: an onExit firing first clears the timer so SIGKILL never runs', () => {
    vi.useFakeTimers();
    setPlatform('darwin');
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);
    const child = spawnedChildren[0];

    mgr.stop(id);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');

    // Process exits cleanly during the grace window → onExit clears killTimer.
    child._fireExit({ exitCode: 0 });
    vi.advanceTimersByTime(5000);
    expect(child.kill).not.toHaveBeenCalledWith('SIGKILL');
  });

  it('stop() on win32 calls bare kill() with NO signal arg (ConPTY throws on signal)', () => {
    setPlatform('win32');
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);
    const child = spawnedChildren[0];

    mgr.stop(id);
    expect(child.kill).toHaveBeenCalledWith();
    expect(child.kill).not.toHaveBeenCalledWith('SIGTERM');
    expect(child.kill).not.toHaveBeenCalledWith('SIGKILL');
  });

  it('restart() reuses the SAME logicalId and produces a NEW ptyPid (IDENT-02)', async () => {
    setPlatform('darwin');
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const first = mgr.create(baseOpts);
    const firstChild = spawnedChildren[0];

    const restartPromise = mgr.restart(first.id);
    // restart orchestrates stop → await exit → create-with-id; fire the old exit.
    firstChild._fireExit({ exitCode: 0 });
    const second = await restartPromise;

    expect(second.id).toBe(first.id); // same logicalId
    expect(second.pid).not.toBe(first.pid); // new ptyPid
    expect(spawnedChildren).toHaveLength(2);
  });

  it('after stop+exit the SessionRecord is retained in listSessions() with status "stopped"', () => {
    setPlatform('darwin');
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);
    const child = spawnedChildren[0];

    mgr.stop(id);
    child._fireExit({ exitCode: 0 }); // userStopped → 'stopped'

    const sessions = mgr.listSessions();
    const rec = sessions.find((s) => s.logicalId === id);
    expect(rec).toBeDefined();
    expect(rec?.status).toBe('stopped');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The two-bucket self-exit lifecycle (06.1-03), RE-SPEC'd for the FIX-4b persistence
// policy = IDENTITY/RECIPE (06.1-04, user decision superseding the original edit-only
// D-02).
//
// onExit now routes a self-exit that has IDENTITY (configured OR a recipe:
// startupCommand / custom name / icon / cwd / shell) → Inactive List (dormant
// 'not_started', order preserved); a BARE ephemeral self-exit (all defaults, no
// command) → gone; and leaves a user-stopped restart precursor in place.
// listConfiguredSessions() (the persisted snapshot) now keeps "configured OR
// hasIdentity" records, NOT only configured===true. A bare blank +New still never
// persists.
//
// NOTE on cwd: the mocked os.homedir() is FAKE_HOME (/Users/fake-home), so a session
// spawned with cwd:undefined resolves to FAKE_HOME — the DEFAULT cwd (no identity). A
// session spawned with the explicit '/tmp/project' has a NON-default cwd → it now has
// identity under FIX 4b. The bare-ephemeral fixtures therefore spawn with cwd:undefined.
// ─────────────────────────────────────────────────────────────────────────────
describe('two-bucket self-exit lifecycle (FIX 4b: identity/recipe ⇒ persist)', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    spawnedChildren.length = 0;
    nextPid = 1000;
    spawnMock.mockClear();
    setPlatform('darwin');
  });

  afterEach(() => {
    setPlatform(ORIGINAL_PLATFORM);
    vi.useRealTimers();
  });

  // A live session in a NON-default cwd — under FIX 4b this alone gives it identity.
  const liveOpts: PtyCreateOptions = { cols: 80, rows: 24, cwd: '/tmp/project' };
  // A truly BARE +New: cwd:undefined → resolves to FAKE_HOME (the default), default
  // icon, auto name, no startup command → ephemeral (no identity) under FIX 4b.
  const bareOpts: PtyCreateOptions = { cols: 80, rows: 24, cwd: undefined };

  it('configured (edited) self-exit → Inactive List (not_started), removed from the Working Area', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(bareOpts);
    const child = spawnedChildren[0];

    // Editing metadata promotes the session to "configured" (updateProfile sets it).
    mgr.updateProfile(id, { name: 'Parlour Claude RC' });

    // A self-exit (NOT user-initiated) after the session reached running.
    child._fireExit({ exitCode: 0 });

    const sessions = mgr.listSessions();
    const rec = sessions.find((s) => s.logicalId === id);
    // A configured self-exit drops to the Inactive List as a dormant, restartable
    // not_started entry.
    expect(rec).toBeDefined();
    expect(rec?.status).toBe('not_started');
    // RESEARCH A2: the moved record PRESERVES its `order` (first/only session → 0).
    expect(rec?.order).toBe(0);
    // The pid is dropped (the OS process is gone — it is a dormant recipe now).
    expect(rec?.ptyPid).toBeUndefined();
  });

  it('a RECIPE self-exit (startupCommand, never manually edited) → Inactive List (FIX 4b)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    // A bare-cwd session, but give it a startup command WITHOUT calling updateProfile
    // through the edit form's name path — set it directly so `configured` stays
    // undefined. updateProfile DOES set configured=true, so to isolate "identity, not
    // configured" we set startupCommand then clear the configured flag the test cares
    // about by NOT relying on it: we assert it persists on IDENTITY alone.
    const { id } = mgr.create(bareOpts);
    mgr.updateProfile(id, { startupCommand: 'claude --rc' });
    // updateProfile set configured=true; to prove IDENTITY (not configured) drives the
    // routing, strip configured off the live record before the exit.
    const rec0 = mgr
      .listSessions()
      .find((s) => s.logicalId === id) as SessionRecord;
    (rec0 as { configured?: boolean }).configured = undefined;

    const child = spawnedChildren[0];
    child._fireExit({ exitCode: 0 }); // self-exit

    const rec = mgr.listSessions().find((s) => s.logicalId === id);
    // FIX 4b: a command-bearing session (identity) self-exits into the Inactive List
    // as a dormant not_started recipe, NOT gone — even with configured undefined.
    expect(rec).toBeDefined();
    expect(rec?.status).toBe('not_started');
    expect(rec?.ptyPid).toBeUndefined();
  });

  it('a user-stopped (restart precursor) is NOT moved to dormant — stays restartable in place (D-05)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(liveOpts);
    const child = spawnedChildren[0];

    // Configure it, then USER-stop it (userStopped → 'stopped', NOT a self-exit).
    mgr.updateProfile(id, { name: 'Parlour Claude RC' });
    mgr.stop(id);
    child._fireExit({ exitCode: 0 }); // userStopped=true → deriveStatus → 'stopped'

    // A user stop is the restart precursor: the record must STAY as 'stopped' in the
    // live map (so restart() can respawn under the same logicalId), NOT move to the
    // Inactive List as 'not_started'.
    const rec = mgr.listSessions().find((s) => s.logicalId === id);
    expect(rec).toBeDefined();
    expect(rec?.status).toBe('stopped');
  });

  it('a BARE +New ephemeral self-exit → gone (absent from listSessions) (FIX 4b)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    // A truly bare session: default cwd (FAKE_HOME via cwd:undefined), default icon,
    // auto name, no startup command, never edited → no identity → ephemeral.
    const { id } = mgr.create(bareOpts);
    const child = spawnedChildren[0];

    child._fireExit({ exitCode: 0 }); // self-exit

    // A bare ephemeral self-exit vanishes entirely (not persisted, no Inactive entry).
    const sessions = mgr.listSessions();
    expect(sessions.some((s) => s.logicalId === id)).toBe(false);
  });

  it('listConfiguredSessions() keeps configured OR identity records, drops bare ephemerals (FIX 4b)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());

    // (a) a bare ephemeral (default everything, no command, never edited) → NOT persisted.
    const ephemeral = mgr.create(bareOpts);
    // (b) an explicitly-edited (configured) session → persisted.
    const configured = mgr.create(bareOpts);
    mgr.updateProfile(configured.id, { name: 'Kept Session' });
    // (c) a recipe session: a non-default cwd alone gives it identity (no edit needed).
    const recipe = mgr.create(liveOpts);

    const persisted = mgr.listConfiguredSessions();
    // The configured session is kept…
    expect(persisted.some((r) => r.logicalId === configured.id)).toBe(true);
    // …the recipe (non-default cwd) session is kept on IDENTITY alone…
    expect(persisted.some((r) => r.logicalId === recipe.id)).toBe(true);
    // …and the bare ephemeral is dropped.
    expect(persisted.some((r) => r.logicalId === ephemeral.id)).toBe(false);
  });

  it('a recipe session persists and RESTORES as a dormant Inactive-List entry on boot (FIX 4b round-trip)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    // A command-bearing session (identity) that self-exits → dormant in THIS process.
    const { id } = mgr.create(bareOpts);
    mgr.updateProfile(id, { startupCommand: 'codex' });
    spawnedChildren[0]._fireExit({ exitCode: 0 });

    // The persisted snapshot includes it (identity) — simulate a boot by hydrating a
    // FRESH manager from that snapshot (coerced to not_started, as the store does).
    const snapshot = mgr.listConfiguredSessions();
    expect(snapshot.some((r) => r.logicalId === id)).toBe(true);

    const booted = new PtyManager();
    booted.registerIpc(fakeWindow());
    booted.hydrate(
      snapshot.map((r) => ({ ...r, status: 'not_started', ptyPid: undefined })),
    );
    const restored = booted.listSessions().find((s) => s.logicalId === id);
    expect(restored).toBeDefined();
    expect(restored?.status).toBe('not_started'); // dormant Inactive-List entry
    expect(restored?.startupCommand).toBe('codex'); // the recipe survived the round-trip
  });
});
