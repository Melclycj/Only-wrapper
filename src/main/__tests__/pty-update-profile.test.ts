// Wave 0 RED stub (04-01 Task 1) — covers SESS-01 (all fields functional) +
// T-04-01/T-04-02/T-04-04 the id-validated, type-guarded updateProfile record write.
//
// INTENTIONALLY FAILS RED until 04-01 Task 3 implements PtyManager.updateProfile +
// create() honoring record.shell. Harness mirrors pty-lifecycle.test.ts: mock
// `electron` + `node-pty`, drive a fake IPty, and inspect spawn options + records.
//
// Asserted contracts:
//   - unknown/forged id → no-op (no throw)                              (T-04-01)
//   - non-string cwd/shell/startupCommand/name → ignored (type guard)   (T-04-02)
//   - a stored non-empty shell drives the next restart spawn            (A2/SESS-01)
//   - startupCommand is stored on the record ONLY — never spawned       (T-04-04)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const FAKE_HOME = '/Users/fake-home';
vi.mock('node:os', () => ({
  default: { homedir: () => FAKE_HOME },
  homedir: () => FAKE_HOME,
}));

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
  onData: (cb: DataCb) => void;
  onExit: (cb: ExitCb) => void;
  _fireExit: (e: { exitCode: number; signal?: number }) => void;
}

const spawnCalls: Array<{ shell: string; options: { cwd?: string } }> = [];
const spawnedChildren: FakeChild[] = [];
let nextPid = 1000;

function makeFakeChild(): FakeChild {
  const exitCbs: ExitCb[] = [];
  return {
    pid: nextPid++,
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onData: () => {},
    onExit: (cb: ExitCb) => {
      exitCbs.push(cb);
    },
    _fireExit: (e) => exitCbs.forEach((cb) => cb(e)),
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

function fakeWindow(): never {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn(), isDestroyed: () => false },
  } as never;
}

const baseOpts: PtyCreateOptions = { cols: 80, rows: 24 };

describe('PtyManager.updateProfile (SESS-01, T-04-01/02/04)', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    spawnedChildren.length = 0;
    nextPid = 1000;
    spawnMock.mockClear();
  });

  it('is a no-op for an unknown/forged id (no throw)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    expect(() =>
      mgr.updateProfile('forged' as LogicalId, { name: 'x' }),
    ).not.toThrow();
  });

  it('writes string name/cwd/shell/startupCommand + an icon onto the kept record', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);

    mgr.updateProfile(id, {
      name: 'API',
      icon: { type: 'color', value: '#abc' },
      cwd: '/tmp/proj',
      shell: '/bin/bash',
      startupCommand: 'npm run dev',
    });

    const rec = mgr.listSessions().find((s) => s.logicalId === id);
    expect(rec?.name).toBe('API');
    expect(rec?.icon).toEqual({ type: 'color', value: '#abc' });
    expect(rec?.cwd).toBe('/tmp/proj');
    expect(rec?.shell).toBe('/bin/bash');
    expect(rec?.startupCommand).toBe('npm run dev');
  });

  it('ignores non-string fields (type guard — T-04-02)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);
    const before = mgr.listSessions().find((s) => s.logicalId === id);
    const priorShell = before?.shell;

    // Forged renderer payload with non-string fields.
    mgr.updateProfile(id, {
      shell: 42 as unknown as string,
      cwd: { evil: true } as unknown as string,
      startupCommand: ['x'] as unknown as string,
    });

    const after = mgr.listSessions().find((s) => s.logicalId === id);
    expect(after?.shell).toBe(priorShell); // unchanged — non-string ignored
    expect(typeof after?.cwd).toBe('string');
  });

  it('a stored non-empty shell drives the next restart spawn (A2, SESS-01)', async () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);

    mgr.updateProfile(id, { shell: '/bin/bash' });

    const restartPromise = mgr.restart(id);
    spawnedChildren[0]._fireExit({ exitCode: 0 });
    await restartPromise;

    // The respawn used the edited shell, not resolveShell()'s /bin/zsh default.
    expect(spawnCalls[1].shell).toBe('/bin/bash');
  });

  it('falls back to resolveShell() when the stored shell is empty (A2 guard)', async () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);

    mgr.updateProfile(id, { shell: '' }); // empty → fallback

    const restartPromise = mgr.restart(id);
    spawnedChildren[0]._fireExit({ exitCode: 0 });
    await restartPromise;

    expect(spawnCalls[1].shell).toBe('/bin/zsh'); // resolveShell fallback
  });

  it('stores startupCommand on the record only — never writes it to the PTY (TERM-05 deferred)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);
    const child = spawnedChildren[0];

    mgr.updateProfile(id, { startupCommand: 'rm -rf /' });

    const rec = mgr.listSessions().find((s) => s.logicalId === id);
    expect(rec?.startupCommand).toBe('rm -rf /'); // stored
    expect(child.write).not.toHaveBeenCalled(); // never executed
  });
});
