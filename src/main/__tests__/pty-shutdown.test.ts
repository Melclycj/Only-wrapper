// Shutdown-crash guard (gap-closure, TERM-06/08) — proves PtyManager's send()
// path NEVER throws when the renderer window is gone/destroyed.
//
// Real bug: on quit, win.on('closed') destroys the BrowserWindow; node-pty then
// flushes a final buffered onData/onExit synchronously as disposeAll() kills the
// child. A bare `this.win?.webContents.send(...)` only guards null — a DESTROYED
// (non-null) window throws `TypeError: Object has been destroyed`, once per chunk.
//
// This is shutdown-timing (hard to reproduce in a real Electron quit), so the
// automated proxy is: (a) fire a captured onData/onExit AFTER detachWindow()
// (win=null) and assert no throw; (b) fire one with a DESTROYED-window stub and
// assert no throw + no send. Mirrors pty-lifecycle.test.ts's mock harness.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  _fireData: (d: string) => void;
}

const spawnedChildren: FakeChild[] = [];
let nextPid = 2000;

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
    },
    onExit: (cb: ExitCb) => {
      exitCbs.push(cb);
    },
    _fireExit: (e) => exitCbs.forEach((cb) => cb(e)),
    _fireData: (d) => dataCbs.forEach((cb) => cb(d)),
  };
}

const spawnMock = vi.fn(() => {
  const child = makeFakeChild();
  spawnedChildren.push(child);
  return child;
});

vi.mock('node-pty', () => ({
  spawn: (...a: unknown[]) => spawnMock(...(a as [])),
}));

vi.mock('../shell-resolver', () => ({
  resolveShell: () => ({ shell: '/bin/zsh', args: ['-l'] }),
}));

import { PtyManager, type PtyCreateOptions } from '../pty-manager';

/** A window whose webContents.send THROWS like Electron's destroyed-object error. */
function destroyedWindow(): {
  webContents: { send: ReturnType<typeof vi.fn>; isDestroyed: () => boolean };
  isDestroyed: () => boolean;
} {
  return {
    isDestroyed: () => true,
    webContents: {
      isDestroyed: () => true,
      send: vi.fn(() => {
        throw new TypeError('Object has been destroyed');
      }),
    },
  };
}

/** A healthy window — send() is recorded so we can assert it WAS used pre-shutdown. */
function liveWindow(): {
  webContents: { send: ReturnType<typeof vi.fn>; isDestroyed: () => boolean };
  isDestroyed: () => boolean;
} {
  return {
    isDestroyed: () => false,
    webContents: { isDestroyed: () => false, send: vi.fn() },
  };
}

const baseOpts: PtyCreateOptions = { cols: 80, rows: 24 };

describe('PtyManager shutdown-crash guard (TERM-06/08)', () => {
  beforeEach(() => {
    spawnedChildren.length = 0;
    nextPid = 2000;
    spawnMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('detachWindow() makes a later onData flush a no-op (no throw)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(liveWindow() as never);
    mgr.create(baseOpts);
    const child = spawnedChildren[0];

    // Simulate the shutdown ordering: window detached BEFORE the final flush.
    mgr.detachWindow();

    expect(() => child._fireData('final buffered chunk')).not.toThrow();
    expect(() => child._fireExit({ exitCode: 0 })).not.toThrow();
  });

  it('a DESTROYED-but-non-null window never receives a send (guarded, no throw)', () => {
    const mgr = new PtyManager();
    const live = liveWindow();
    mgr.registerIpc(live as never);
    mgr.create(baseOpts);
    const child = spawnedChildren[0];

    // Point the manager at a destroyed window (the real win.on('closed') race:
    // win still referenced but its native object is gone).
    const dead = destroyedWindow();
    mgr.registerIpc(dead as never);

    expect(() => child._fireData('chunk after destroy')).not.toThrow();
    expect(() => child._fireExit({ exitCode: 0 })).not.toThrow();
    // The isDestroyed() guard must short-circuit BEFORE webContents.send runs.
    expect(dead.webContents.send).not.toHaveBeenCalled();
  });

  it('disposeAll() after detachWindow() does not throw on flushing children', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(liveWindow() as never);
    mgr.create(baseOpts);
    mgr.create(baseOpts);

    // node-pty fakes flush an onExit synchronously when killed during disposeAll.
    for (const child of spawnedChildren) {
      child.kill.mockImplementation(() => child._fireExit({ exitCode: 0 }));
    }

    mgr.detachWindow();
    expect(() => mgr.disposeAll()).not.toThrow();
  });
});
