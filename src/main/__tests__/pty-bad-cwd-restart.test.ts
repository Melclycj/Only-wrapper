// GAP-12-C bad-cwd restart-to-apply REGRESSION (relocated from spike-005's
// gap-12-c-bad-cwd-restart.diag.test.ts.txt — now a committed, shipped test).
//
// Pins the GAP-12-C main-side contract for the operator's restart-to-apply flow:
//   1. updateProfile REJECTS a non-existent cwd (CR-01) and keeps the prior valid
//      cwd — a bad cwd typed into the edit form never persists onto the record.
//   2. A restart-after-a-bad-cwd-edit SUCCEEDS (pid>0) because the respawn uses the
//      PRIOR valid cwd — there is NO pid -1 and NO 'Working directory not found'
//      error notice on that path (the GAP-12-C premise of a failed restart does NOT
//      occur for an EDIT, because the edit was rejected at persist time).
//   3. The ONLY path to a create() pid -1 + the notice is a record whose cwd is
//      ALREADY bad reaching create() — e.g. a stored cwd whose directory was DELETED
//      after it was persisted (or a corrupt store). That deleted-dir record returns
//      pid -1 and broadcasts the 'Working directory not found' notice.
//
// Mirrors pty-update-profile.test.ts's mock harness verbatim so the result reflects
// the REAL updateProfile + restart + create() code paths (only node-pty / electron /
// fs / os are mocked at the boundary).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const FAKE_HOME = '/Users/fake-home';
vi.mock('node:os', () => ({
  default: { homedir: () => FAKE_HOME },
  homedir: () => FAKE_HOME,
}));

// Treat FAKE_HOME + the real process.cwd() as existing directories; everything else
// (the bad cwd) throws ENOENT — so isValidCwd rejects it exactly as in production.
vi.mock('node:fs', () => {
  const OK = new Set(['/Users/fake-home', process.cwd()]);
  const statSync = (p: string): { isDirectory: () => boolean } => {
    if (OK.has(p)) return { isDirectory: () => true };
    throw new Error('ENOENT');
  };
  return { default: { statSync }, statSync };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

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
}

const spawnCalls: Array<{ shell: string; options: { cwd?: string } }> = [];
const spawnedChildren: FakeChild[] = [];
let nextPid = 2000;

function makeFakeChild(): FakeChild {
  const exitCbs: ExitCb[] = [];
  return {
    pid: nextPid++,
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onData: () => ({ dispose: () => {} }),
    onExit: (cb: ExitCb) => {
      exitCbs.push(cb);
      return {
        dispose: () => {
          const i = exitCbs.indexOf(cb);
          if (i >= 0) exitCbs.splice(i, 1);
        },
      };
    },
    _fireExit: (e) => [...exitCbs].forEach((cb) => cb(e)),
  };
}

const spawnMock = vi.fn(
  (shell: string, _args: string[], options: { cwd?: string }) => {
    const child = makeFakeChild();
    spawnCalls.push({ shell, options });
    spawnedChildren.push(child);
    return child;
  },
);

vi.mock('node-pty', () => ({
  spawn: (...a: unknown[]) =>
    spawnMock(...(a as [string, string[], { cwd?: string }])),
}));

vi.mock('../shell-resolver', () => ({
  resolveShell: () => ({ shell: '/bin/zsh', args: ['-l'] }),
}));

import { PtyManager, type PtyCreateOptions } from '../pty-manager';
import type { LogicalId } from '../../shared/types';

interface StatusEvt {
  id: LogicalId;
  status: string;
  notice?: string;
  ptyPid?: number;
}

function captureWindow(events: StatusEvt[]): never {
  return {
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      send: (channel: string, payload: StatusEvt) => {
        if (channel === 'pty:status') events.push(payload);
      },
    },
  } as never;
}

const baseOpts: PtyCreateOptions = { cols: 80, rows: 24 };
const BAD_CWD = '/no/such/dir/operator-typo-xyz';

describe('GAP-12-C — bad-cwd restart-to-apply (regression)', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    spawnedChildren.length = 0;
    nextPid = 2000;
    spawnMock.mockClear();
    vi.restoreAllMocks();
  });

  it('updateProfile does NOT persist a non-existent cwd (keeps prior valid cwd)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(captureWindow([]));
    const { id } = mgr.create({ ...baseOpts, cwd: process.cwd() });
    const priorCwd = mgr.listSessions().find((s) => s.logicalId === id)?.cwd;

    // The renderer's edit-form submits the bad cwd via ptyUpdateProfile.
    mgr.updateProfile(id, { cwd: BAD_CWD, startupCommand: 'echo CHANGED' });

    const after = mgr.listSessions().find((s) => s.logicalId === id);
    expect(after?.cwd).toBe(priorCwd); // bad cwd REJECTED — prior value kept
    expect(after?.cwd).not.toBe(BAD_CWD);
    // The startupCommand DID persist (it is valid).
    expect(after?.startupCommand).toBe('echo CHANGED');
  });

  it('restart-to-apply after a bad-cwd edit SUCCEEDS (pid>0) using the prior cwd — NO pid -1, NO error notice', async () => {
    const events: StatusEvt[] = [];
    const mgr = new PtyManager();
    mgr.registerIpc(captureWindow(events));
    const { id } = mgr.create({ ...baseOpts, cwd: process.cwd() });

    // Live edit: bad cwd + a new startup command (the operator's flow).
    mgr.updateProfile(id, { cwd: BAD_CWD, startupCommand: 'echo CHANGED' });
    events.length = 0; // clear pre-restart events

    // Restart-to-apply → main.restart() → stop → onExit → create({cwd: record.cwd}).
    const p = mgr.restart(id);
    spawnedChildren[0]._fireExit({ exitCode: 0 });
    const result = await p;

    // The respawn used the PRIOR valid cwd (bad cwd never persisted), so create()
    // returns a REAL pid (>0) — the GAP-12-C premise of pid -1 does NOT occur here.
    expect(result.pid).toBeGreaterThan(0);
    expect(spawnCalls[1].options.cwd).toBe(process.cwd());
    // No 'Working directory not found' error notice was broadcast on restart.
    const errNotice = events.find(
      (e) => e.status === 'error' && /Working directory not found/.test(e.notice ?? ''),
    );
    expect(errNotice).toBeUndefined();
  });

  it('a dormant-record bad cwd that bypasses updateProfile makes create() return pid -1 + the notice', () => {
    // This is the ONLY path to the GAP-12-C premise: a record whose cwd is already
    // bad (e.g. a stored cwd whose directory was DELETED after it was persisted, or a
    // corrupt store) reaching create(). updateProfile's CR-01 guard prevents an EDIT
    // from creating this state, but a deleted-directory record can.
    const events: StatusEvt[] = [];
    const mgr = new PtyManager();
    mgr.registerIpc(captureWindow(events));

    // Spawn DIRECTLY with a bad explicit cwd (models record.cwd pointing at a since-
    // deleted dir on a subsequent create()/restart()).
    const result = mgr.create({ ...baseOpts, cwd: BAD_CWD });

    expect(result.pid).toBe(-1);
    const errNotice = events.find(
      (e) => e.status === 'error' && /Working directory not found/.test(e.notice ?? ''),
    );
    expect(errNotice).toBeDefined();
    expect(errNotice?.notice).toContain(BAD_CWD);
  });
});
