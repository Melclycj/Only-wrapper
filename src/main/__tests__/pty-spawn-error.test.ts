// SC2 spawn-error pre-validation — GREEN as of Plan 06-02 (was a Wave 0 RED scaffold).
//
// Covers the create() spawn-error path (D-01..D-05, WR-04/WR-05, D-14):
//   - an EXPLICIT-but-missing cwd → status 'error' + 'Working directory not found: <path>',
//     and node-pty.spawn is NEVER called (D-01/D-02, no silent $HOME).
//   - a stored (prior) cwd now missing with opts.cwd undefined → same error path.
//   - NO cwd anywhere → spawns in os.homedir() with no error (D-02 home-when-unspecified).
//   - pty.spawn() throwing synchronously → caught; status 'error' + generic message.
//   - skipStartupCommand → bare shell, no probe/inject even with a stored command (D-14).
//   - updateProfile trims startupCommand at persist (WR-05).
//
// Harness mirrors readiness-probe.test.ts Group 2: a FakeChild node-pty mock, a mocked
// electron ipcMain, a fakeWindow with webContents.send: vi.fn(), and a mocked node:fs so
// isValidCwd is deterministic (the "valid" dir exists; the "missing" dir does not).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LogicalId, SessionRecord } from '../../shared/types';

vi.mock('node:os', () => ({
  default: { homedir: () => '/Users/fake-home' },
  homedir: () => '/Users/fake-home',
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

// Deterministic filesystem for isValidCwd (absolute + statSync().isDirectory()).
// '/Users/fake-home' and '/exists/dir' are real directories; everything else throws
// ENOENT (a missing/forged cwd). path.isAbsolute is the real implementation.
const EXISTING_DIRS = new Set(['/Users/fake-home', '/exists/dir']);
vi.mock('node:fs', () => ({
  default: {
    statSync: (p: string) => {
      if (EXISTING_DIRS.has(p)) return { isDirectory: () => true };
      throw new Error('ENOENT');
    },
  },
  statSync: (p: string) => {
    if (EXISTING_DIRS.has(p)) return { isDirectory: () => true };
    throw new Error('ENOENT');
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
  _fireData: (d: string) => void;
}

const spawnedChildren: FakeChild[] = [];
let nextPid = 4000;

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
      return { dispose: () => void 0 };
    },
    onExit: (cb: ExitCb) => {
      exitCbs.push(cb);
      return { dispose: () => void 0 };
    },
    _fireExit: (e) => exitCbs.forEach((cb) => cb(e)),
    _fireData: (d) => dataCbs.forEach((cb) => cb(d)),
  };
}

// spawnMock may be told to throw synchronously (the rare EACCES-class case) via a flag.
let throwOnSpawn = false;
const spawnMock = vi.fn((): FakeChild => {
  if (throwOnSpawn) throw new Error('spawn EACCES');
  const child = makeFakeChild();
  spawnedChildren.push(child);
  return child;
});

vi.mock('node-pty', () => ({
  spawn: (...a: unknown[]) =>
    spawnMock(...(a as [string, string[], { cwd?: string }])),
}));

vi.mock('../shell-resolver', () => ({
  resolveShell: () => ({ shell: '/bin/zsh', args: ['-l'] }),
}));

import {
  PtyManager,
  PTY_CHANNELS,
  sanitizeNotice,
  type PtyCreateOptions,
} from '../pty-manager';

function fakeWindow(): never {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn(), isDestroyed: () => false },
  } as never;
}

type Win = ReturnType<typeof fakeWindow>;
function sends(win: Win): { mock: { calls: [string, Record<string, unknown>][] } } {
  return (win as unknown as { webContents: { send: { mock: { calls: [string, Record<string, unknown>][] } } } })
    .webContents.send;
}

/** All notice strings sent on the status channel for `id`. */
function noticesFor(win: Win, id: string): string[] {
  return sends(win)
    .mock.calls.filter(
      ([channel, payload]) =>
        channel === PTY_CHANNELS.status &&
        payload?.id === id &&
        typeof payload?.notice === 'string',
    )
    .map(([, payload]) => payload.notice as string);
}

/** The last status value broadcast for `id`. */
function lastStatusFor(win: Win, id: string): string | undefined {
  const statuses = sends(win)
    .mock.calls.filter(
      ([channel, payload]) =>
        channel === PTY_CHANNELS.status && payload?.id === id,
    )
    .map(([, payload]) => payload.status as string);
  return statuses[statuses.length - 1];
}

function dormant(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    logicalId: 'sess-1' as LogicalId,
    ptyPid: undefined,
    name: 'Sess',
    icon: { type: 'emoji', value: '🖥️' },
    cwd: '/exists/dir',
    shell: '/bin/zsh',
    startupCommand: undefined,
    status: 'not_started',
    order: 0,
    lastActive: 1_700_000_000_000,
    ...over,
  };
}

const baseOpts: PtyCreateOptions = { cols: 80, rows: 24 };

describe('PtyManager.create() spawn-error path (SC2 / D-01..D-05 — Plan 06-02)', () => {
  beforeEach(() => {
    spawnedChildren.length = 0;
    nextPid = 4000;
    spawnMock.mockClear();
    throwOnSpawn = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('errors on a non-existent EXPLICIT opts.cwd and NEVER spawns node-pty (D-01/D-02)', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);

    const result = mgr.create({
      ...baseOpts,
      id: 'sess-1' as LogicalId,
      cwd: '/Users/me/deleted-dir',
    });

    expect(result.pid).toBe(-1); // no live pty
    expect(spawnMock).not.toHaveBeenCalled(); // node-pty NEVER spawned with a bad cwd
    expect(lastStatusFor(win, 'sess-1')).toBe('error');
    expect(noticesFor(win, 'sess-1')).toContain(
      'Working directory not found: /Users/me/deleted-dir',
    );
  });

  it('does NOT spawn when the explicit cwd is a file/non-directory (D-01)', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);

    // '/some/file' is not in EXISTING_DIRS → statSync throws → isValidCwd false.
    mgr.create({ ...baseOpts, id: 'sess-1' as LogicalId, cwd: '/some/file' });

    expect(spawnMock).not.toHaveBeenCalled();
    expect(noticesFor(win, 'sess-1')).toContain(
      'Working directory not found: /some/file',
    );
  });

  it('honors a STORED (prior) cwd that is now missing as user intent — same error path (D-02)', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);
    // Dormant record carries an explicit cwd that no longer exists; opts.cwd undefined.
    mgr.hydrate([dormant({ cwd: '/Users/me/gone' })]);

    const result = mgr.create({ ...baseOpts, id: 'sess-1' as LogicalId });

    expect(result.pid).toBe(-1);
    expect(spawnMock).not.toHaveBeenCalled(); // NOT silently replaced by home
    expect(noticesFor(win, 'sess-1')).toContain(
      'Working directory not found: /Users/me/gone',
    );
  });

  it('spawns in os.homedir() with NO error when NO cwd is specified anywhere (D-02)', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);
    // Dormant record with an empty cwd, opts.cwd undefined → truly unspecified.
    mgr.hydrate([dormant({ cwd: '' })]);

    const result = mgr.create({ ...baseOpts, id: 'sess-1' as LogicalId });

    expect(result.pid).toBeGreaterThan(0); // a real (fake) pty spawned
    expect(spawnMock).toHaveBeenCalledTimes(1);
    // The resolved cwd is the mocked home directory.
    const spawnCwd = (spawnMock.mock.calls[0]?.[2] as { cwd?: string }).cwd;
    expect(spawnCwd).toBe('/Users/fake-home');
    expect(lastStatusFor(win, 'sess-1')).toBe('running');
    // No spawn-error notice on the happy path.
    expect(
      noticesFor(win, 'sess-1').some((n) =>
        n.startsWith('Working directory not found'),
      ),
    ).toBe(false);
  });

  it('catches a SYNCHRONOUS pty.spawn() throw → status error + generic message (D-05)', () => {
    throwOnSpawn = true;
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);

    // A valid cwd so pre-validation passes and we reach the (throwing) spawn.
    const result = mgr.create({
      ...baseOpts,
      id: 'sess-1' as LogicalId,
      cwd: '/exists/dir',
    });

    expect(result.pid).toBe(-1); // no live pty; no unhandled throw escaped
    expect(lastStatusFor(win, 'sess-1')).toBe('error');
    expect(noticesFor(win, 'sess-1')).toContain(
      "Couldn't start session: spawn EACCES",
    );
  });

  it('emits a generic notice on the ASYNC fork-then-die abnormal exit (D-05 / Pitfall 1)', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);
    mgr.hydrate([dormant({ cwd: '/exists/dir' })]);

    mgr.create({ ...baseOpts, id: 'sess-1' as LogicalId });
    const child = spawnedChildren[0];
    // The forked child failed (bad shell/cwd inside the fork) → abnormal exit code 1.
    child._fireExit({ exitCode: 1 });

    expect(lastStatusFor(win, 'sess-1')).toBe('error');
    expect(noticesFor(win, 'sess-1')).toContain(
      "Couldn't start session: the shell exited immediately",
    );
  });

  it('skipStartupCommand → bare shell: no probe marker written, command NOT injected (D-14)', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);
    // Stored startupCommand that WOULD normally auto-run.
    mgr.hydrate([dormant({ startupCommand: 'echo HI' })]);

    mgr.create({
      ...baseOpts,
      id: 'sess-1' as LogicalId,
      skipStartupCommand: true,
    });
    const child = spawnedChildren[0];

    // No probe marker and no injected command — a bare shell for this one launch.
    expect(child.write).not.toHaveBeenCalled();
    // The stored command is preserved (not cleared) for the next normal Start.
    expect(mgr.listSessions()[0].startupCommand).toBe('echo HI');
  });

  it('without skipStartupCommand, a stored command DOES drive the probe (control case)', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);
    mgr.hydrate([dormant({ startupCommand: 'echo HI' })]);

    mgr.create({ ...baseOpts, id: 'sess-1' as LogicalId });
    const child = spawnedChildren[0];

    // The probe marker (': <nonce>\r') is written → confirms skip-vs-normal divergence.
    expect(child.write).toHaveBeenCalled();
    const firstWrite = child.write.mock.calls[0]?.[0] as string;
    expect(firstWrite.startsWith(': __JW_READY_')).toBe(true);
  });
});

describe('updateProfile trims startupCommand at persist (WR-05)', () => {
  it('stores the trimmed startupCommand so it equals what create() injects', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);
    mgr.hydrate([dormant()]);

    mgr.updateProfile('sess-1' as LogicalId, {
      startupCommand: '   npm run dev   ',
    });

    expect(mgr.listSessions()[0].startupCommand).toBe('npm run dev');
  });

  it('an all-whitespace startupCommand trims to an empty string (bare-shell path)', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);
    mgr.hydrate([dormant()]);

    mgr.updateProfile('sess-1' as LogicalId, { startupCommand: '   ' });

    expect(mgr.listSessions()[0].startupCommand).toBe('');
  });
});

describe('sanitizeNotice (WR-04 control-char stripping)', () => {
  it('strips ESC and other C0 control chars so no ANSI escape rides the notice', () => {
    const dirty = 'Working directory not found: /tmp/\x1b[31mevil\x1b[0m';
    const clean = sanitizeNotice(dirty);
    expect(clean).not.toContain('\x1b');
    expect(clean).toContain('Working directory not found: /tmp/');
  });

  it('preserves TAB and ordinary printable text', () => {
    expect(sanitizeNotice('a\tb path/to/dir')).toBe('a\tb path/to/dir');
  });

  it('strips DEL and C1 control characters', () => {
    expect(sanitizeNotice('x\x7Fy\x9Az')).toBe('xyz');
  });
});
