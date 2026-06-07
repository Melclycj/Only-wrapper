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

// Plan 06-02: create() now PRE-VALIDATES the resolved cwd (D-01), so a spawn into a
// non-existent directory errors before reaching node-pty. These fixtures spawn into
// the mocked FAKE_HOME and `/Users/dev/proj` (a dormant record cwd) which do not exist
// on the test host — and the CR-01 update-profile cases still need a REAL-valid cwd
// (process.cwd()) accepted and a bogus path rejected. Mock node:fs to treat exactly the
// fixture directories + the real process.cwd() as directories; everything else throws
// ENOENT (so the CR-01 'non-existent cwd is ignored' case keeps its meaning).
vi.mock('node:fs', () => {
  // Inline literals (no module-scope const) — vi.mock factories are hoisted above
  // top-level declarations, so referencing FAKE_HOME here would be a TDZ error.
  const OK = new Set(['/Users/fake-home', '/Users/dev/proj', process.cwd()]);
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
    onData: () => ({ dispose: () => {} }),
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
import type { LogicalId, SessionRecord } from '../../shared/types';

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
    vi.restoreAllMocks(); // isolate per-test discoverShells spies (CR-01)
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

    // CR-01: shell must be allowlisted + cwd must be a real absolute dir. Use the
    // process cwd (a real absolute dir, independent of the mocked node:os) as a
    // valid cwd, and stub discoverShells so the edited shell is in the allowlist.
    const validCwd = process.cwd();
    vi.spyOn(mgr, 'discoverShells').mockReturnValue([
      { path: '/bin/bash', label: 'bash' },
    ]);

    mgr.updateProfile(id, {
      name: 'API',
      icon: { type: 'color', value: '#abc' },
      cwd: validCwd,
      shell: '/bin/bash',
      startupCommand: 'npm run dev',
    });

    const rec = mgr.listSessions().find((s) => s.logicalId === id);
    expect(rec?.name).toBe('API');
    expect(rec?.icon).toEqual({ type: 'color', value: '#abc' });
    expect(rec?.cwd).toBe(validCwd);
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

    // CR-01: the edited shell must be allowlisted to persist.
    vi.spyOn(mgr, 'discoverShells').mockReturnValue([
      { path: '/bin/bash', label: 'bash' },
    ]);
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

// ─── CR-02: dormant-session profile edits persist (dual-map) ──────────────────

function dormantRecord(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    logicalId: 'restored-1' as LogicalId,
    ptyPid: undefined,
    name: 'Restored',
    icon: { type: 'emoji', value: '🛋️' },
    cwd: '/Users/dev/proj',
    shell: '/bin/zsh',
    startupCommand: undefined,
    status: 'not_started',
    order: 5,
    lastActive: 1_700_000_000_000,
    ...over,
  };
}

describe('PtyManager.updateProfile — dormant editing (CR-02)', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    spawnedChildren.length = 0;
    nextPid = 1000;
    spawnMock.mockClear();
    vi.restoreAllMocks();
  });

  it('edits a DORMANT (hydrated, not-started) record AND signals the store', () => {
    const mgr = new PtyManager();
    const signal = vi.fn();
    mgr.setStoreSignal(signal);
    mgr.hydrate([dormantRecord({ logicalId: 'restored-1' as LogicalId })]);

    mgr.updateProfile('restored-1' as LogicalId, {
      name: 'Edited Dormant',
      icon: { type: 'color', value: '#0af' },
    });

    // The dormant record reflects the edit via listSessions (CR-02 — no longer
    // silently dropped), and the store was signalled so it persists on next boot.
    const rec = mgr.listSessions().find((s) => s.logicalId === 'restored-1');
    expect(rec?.name).toBe('Edited Dormant');
    expect(rec?.icon).toEqual({ type: 'color', value: '#0af' });
    expect(signal).toHaveBeenCalled();
  });

  it('persists an allowlisted shell + real cwd onto a DORMANT record', () => {
    const mgr = new PtyManager();
    mgr.hydrate([dormantRecord({ logicalId: 'restored-1' as LogicalId })]);
    const validCwd = process.cwd();
    vi.spyOn(mgr, 'discoverShells').mockReturnValue([
      { path: '/bin/bash', label: 'bash' },
    ]);

    mgr.updateProfile('restored-1' as LogicalId, {
      shell: '/bin/bash',
      cwd: validCwd,
    });

    const rec = mgr.listSessions().find((s) => s.logicalId === 'restored-1');
    expect(rec?.shell).toBe('/bin/bash');
    expect(rec?.cwd).toBe(validCwd);
  });
});

// ─── CR-01: shell allowlist + cwd validation at the persist boundary ──────────

describe('PtyManager.updateProfile — validate-in-main (CR-01)', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    spawnedChildren.length = 0;
    nextPid = 1000;
    spawnMock.mockClear();
    vi.restoreAllMocks();
  });

  it('rejects a NON-allowlisted shell path, keeping the prior value', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);
    const priorShell = mgr.listSessions().find((s) => s.logicalId === id)?.shell;

    vi.spyOn(mgr, 'discoverShells').mockReturnValue([
      { path: '/bin/zsh', label: 'zsh' },
    ]);

    // A forged payload trying to spawn an arbitrary binary on next restart.
    mgr.updateProfile(id, { shell: '/evil/binary' });

    const after = mgr.listSessions().find((s) => s.logicalId === id);
    expect(after?.shell).toBe(priorShell); // unchanged — forged shell ignored
  });

  it('accepts an allowlisted shell path', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);

    vi.spyOn(mgr, 'discoverShells').mockReturnValue([
      { path: '/opt/homebrew/bin/fish', label: 'fish' },
    ]);
    mgr.updateProfile(id, { shell: '/opt/homebrew/bin/fish' });

    const after = mgr.listSessions().find((s) => s.logicalId === id);
    expect(after?.shell).toBe('/opt/homebrew/bin/fish');
  });

  it('accepts an empty shell (the resolveShell() default affordance)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);
    // No allowlist needed — empty is the documented "use default" sentinel.
    const spy = vi.spyOn(mgr, 'discoverShells');
    mgr.updateProfile(id, { shell: '' });

    const after = mgr.listSessions().find((s) => s.logicalId === id);
    expect(after?.shell).toBe(''); // empty persisted → create() falls back to default
    expect(spy).not.toHaveBeenCalled(); // empty short-circuits the disk-touching discover
  });

  it('rejects a RELATIVE cwd, keeping the prior value', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);
    const priorCwd = mgr.listSessions().find((s) => s.logicalId === id)?.cwd;

    mgr.updateProfile(id, { cwd: 'relative/path' });

    const after = mgr.listSessions().find((s) => s.logicalId === id);
    expect(after?.cwd).toBe(priorCwd); // unchanged — relative rejected
  });

  it('rejects a NON-EXISTENT absolute cwd, keeping the prior value', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);
    const priorCwd = mgr.listSessions().find((s) => s.logicalId === id)?.cwd;

    mgr.updateProfile(id, { cwd: '/this/path/does/not/exist/at-all-xyz' });

    const after = mgr.listSessions().find((s) => s.logicalId === id);
    expect(after?.cwd).toBe(priorCwd); // unchanged — non-existent dir rejected
  });

  it('accepts a valid absolute existing directory cwd', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);
    const validCwd = process.cwd();

    mgr.updateProfile(id, { cwd: validCwd });

    const after = mgr.listSessions().find((s) => s.logicalId === id);
    expect(after?.cwd).toBe(validCwd);
  });

  it('regression: editing a LIVE session still works (name/icon)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const { id } = mgr.create(baseOpts);

    mgr.updateProfile(id, {
      name: 'Live Edit',
      icon: { type: 'color', value: '#f00' },
    });

    const after = mgr.listSessions().find((s) => s.logicalId === id);
    expect(after?.name).toBe('Live Edit');
    expect(after?.icon).toEqual({ type: 'color', value: '#f00' });
  });
});
