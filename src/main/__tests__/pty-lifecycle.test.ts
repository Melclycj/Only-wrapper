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
// RED scaffolds — the D-05 / D-02 two-bucket lifecycle (Plan 06.1-03 turns GREEN).
//
// These pin the TARGET behavior of the new lifecycle so Plan 03 has an executable
// contract. They are honest RED (they fail with an assertion against the CURRENT
// onExit, which keeps a self-exited record live-but-dead in this.sessions instead
// of dropping it to dormant / deleting it). DO NOT mark green or delete until Plan
// 06.1-03 implements the self-exit → Inactive (configured) / gone (ephemeral) split
// and listConfiguredSessions().
// ─────────────────────────────────────────────────────────────────────────────
describe('two-bucket self-exit lifecycle (D-05 / D-02) — RED until Plan 06.1-03', () => {
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

  const liveOpts: PtyCreateOptions = { cols: 80, rows: 24, cwd: '/tmp/project' };

  it('configured self-exit → Inactive List (not_started), removed from the Working Area — RED until Plan 06.1-03', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(liveOpts);
    const child = spawnedChildren[0];

    // D-02: setting metadata promotes the session to "configured" (Plan 03 wires
    // updateProfile to set configured=true).
    mgr.updateProfile(id, { name: 'Parlour Claude RC' });

    // A self-exit (NOT user-initiated) after the session reached running.
    child._fireExit({ exitCode: 0 });

    const sessions = mgr.listSessions();
    const rec = sessions.find((s) => s.logicalId === id);
    // Plan-03 target: a configured self-exit drops to the Inactive List as a
    // dormant, restartable not_started entry (NOT the current live-but-dead 'exited').
    expect(rec).toBeDefined();
    expect(rec?.status).toBe('not_started');
  });

  it('ephemeral self-exit → gone (absent from listSessions) — RED until Plan 06.1-03', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    // No updateProfile call → the session stays ephemeral (configured undefined).
    const { id } = mgr.create(liveOpts);
    const child = spawnedChildren[0];

    child._fireExit({ exitCode: 0 }); // self-exit

    // Plan-03 target: an ephemeral self-exit vanishes entirely (not persisted, no
    // Inactive entry). The CURRENT onExit retains it as 'exited' → this is RED now.
    const sessions = mgr.listSessions();
    expect(sessions.some((s) => s.logicalId === id)).toBe(false);
  });

  it('listConfiguredSessions() returns only configured===true records (D-02) — RED until Plan 06.1-03', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());

    const ephemeral = mgr.create(liveOpts);
    const configured = mgr.create(liveOpts);
    mgr.updateProfile(configured.id, { name: 'Kept Session' });

    // Plan 03 adds listConfiguredSessions(); until then the method is absent →
    // this is honest RED (the guard assertion fails because it is not a function).
    const maybe = (mgr as unknown as {
      listConfiguredSessions?: () => SessionRecord[];
    }).listConfiguredSessions;
    expect(typeof maybe).toBe('function');

    const configuredOnly = maybe ? maybe.call(mgr) : [];
    expect(configuredOnly.every((r) => r.configured === true)).toBe(true);
    expect(configuredOnly.some((r) => r.logicalId === configured.id)).toBe(true);
    expect(configuredOnly.some((r) => r.logicalId === ephemeral.id)).toBe(false);
  });
});
