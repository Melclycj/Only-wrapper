// RED repro (06.1-04 gap-closure round 2, ITEM 3 — "a recipe (startupCommand,
// not manually edited) is NOT restored as a dormant Inactive-List entry after
// quit + reopen").
//
// This drives the FULL production persistence wiring (index.ts):
//   PtyManager.setStoreSignal(syncStore)  where syncStore = () => {
//     store.setSessions(ptyManager.listConfiguredSessions()); store.setUi(...);
//   }
// against a REAL SessionStore pointed at a temp file (the pathOverride seam), then
// simulates a quit (store.flush()) and a relaunch (a fresh SessionStore.load() +
// a fresh PtyManager.hydrate()) and asserts the recipe is restored as a dormant
// not_started Inactive-List entry.
//
// "Not manually edited" is modeled as: the session carries a startupCommand (a
// recipe) — identity under FIX 4b — WITHOUT configured===true. We strip the
// configured flag the way the round-1 lifecycle test does, so this proves IDENTITY
// alone (not the configured flag) drives persistence end-to-end through the REAL
// store round-trip.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FAKE_HOME = '/Users/fake-home';
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    default: { ...actual, homedir: () => FAKE_HOME },
    homedir: () => FAKE_HOME,
    tmpdir: actual.tmpdir,
  };
});

// node:fs must stay REAL for the store's lowdb file I/O, but create()'s cwd
// pre-validation calls statSync on FAKE_HOME (which does not exist). Wrap the real
// fs so FAKE_HOME validates as a directory and everything else is the genuine fs.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const statSync = ((p: fs.PathLike, ...rest: unknown[]) => {
    if (p === FAKE_HOME) return { isDirectory: () => true } as fs.Stats;
    return (actual.statSync as (...a: unknown[]) => fs.Stats)(p, ...rest);
  }) as typeof fs.statSync;
  return { ...actual, default: { ...actual, statSync }, statSync };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

const spawnedChildren: Array<{
  pid: number;
  _fireExit: (e: { exitCode: number }) => void;
  onExit: (cb: (e: { exitCode: number }) => void) => { dispose: () => void };
}> = [];
let nextPid = 5000;
function makeFakeChild(): unknown {
  const exitCbs: Array<(e: { exitCode: number }) => void> = [];
  const child = {
    pid: nextPid++,
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onData: () => ({ dispose: () => undefined }),
    onExit: (cb: (e: { exitCode: number }) => void) => {
      exitCbs.push(cb);
      return { dispose: () => undefined };
    },
    _fireExit: (e: { exitCode: number }) => [...exitCbs].forEach((cb) => cb(e)),
  };
  spawnedChildren.push(child);
  return child;
}
vi.mock('node-pty', () => ({ spawn: () => makeFakeChild() }));
vi.mock('../shell-resolver', () => ({
  resolveShell: () => ({ shell: '/bin/zsh', args: ['-l'] }),
}));

import { PtyManager } from '../pty-manager';
import { SessionStore } from '../session-store';
import { handleWindowClosed } from '../lifecycle';

function fakeWindow(): never {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn(), isDestroyed: () => false },
  } as never;
}

let tmpDir: string;
let storeFile: string;

describe('recipe persistence round-trip (ITEM 3): an unedited startupCommand recipe restores dormant', () => {
  beforeEach(() => {
    spawnedChildren.length = 0;
    nextPid = 5000;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jw-recipe-'));
    storeFile = path.join(tmpDir, 'just-wrapper-store.json');
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('a recipe session (startupCommand, configured unset) self-exits, persists, and RESTORES as a dormant not_started entry after a quit+reopen', async () => {
    // ── Launch 1: real PtyManager + real store wired exactly like index.ts ──
    const store = new SessionStore(storeFile, 0); // 0ms debounce → write promptly
    await store.load();
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    // The production syncStore: persist listConfiguredSessions() (identity/recipe filter).
    mgr.setStoreSignal(() => {
      store.setSessions(mgr.listConfiguredSessions());
      store.setUi(mgr.getUiState());
    });

    // A session that becomes a RECIPE via a startupCommand. updateProfile sets
    // configured=true; strip it to prove IDENTITY alone (an "unedited recipe") persists.
    const { id } = mgr.create({ cols: 80, rows: 24, cwd: FAKE_HOME });
    mgr.updateProfile(id, { startupCommand: 'codex' });
    const liveRec = mgr.listSessions().find((s) => s.logicalId === id) as {
      configured?: boolean;
    };
    liveRec.configured = undefined; // identity, NOT configured

    // It self-exits (the recipe finished) → main routes it to dormant not_started.
    spawnedChildren[0]._fireExit({ exitCode: 0 });
    expect(
      mgr.listSessions().find((s) => s.logicalId === id)?.status,
    ).toBe('not_started');

    // Quit: flush the trailing debounced write so disk reflects the latest snapshot.
    await store.flush();

    // ── Launch 2: a fresh store + fresh PtyManager hydrate from disk (the reopen) ──
    const store2 = new SessionStore(storeFile, 0);
    const data = await store2.load();
    const mgr2 = new PtyManager();
    mgr2.registerIpc(fakeWindow());
    mgr2.hydrate(data.sessions);

    const restored = mgr2.listSessions().find((s) => s.logicalId === id);
    expect(restored).toBeDefined();
    expect(restored?.status).toBe('not_started'); // dormant Inactive-List entry
    expect(restored?.startupCommand).toBe('codex'); // the recipe survived
  });

  it('DEFECT B: a freshly-Started recipe is on disk after a WINDOW CLOSE (dev close, no before-quit) — driven through the real close handler', async () => {
    // DEFECT B (round 3): on macOS, closing the dev window does NOT fire before-quit, and
    // the OLD win.on('closed') handler only disposed PTYs WITHOUT flushing the store — so a
    // session created within the ~300ms debounce window (before any trailing write) was lost
    // on close (the on-disk file showed sessions:[]). This test drives the EXTRACTED close
    // handler (handleWindowClosed) — the same function index.ts wires into win.on('closed')
    // — and asserts the just-Started recipe is durable, WITHOUT ever calling store.flush()
    // directly (the pre-existing tests bypassed the handler that way).
    const store = new SessionStore(storeFile, 300); // realistic 300ms debounce
    await store.load();
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    mgr.setStoreSignal(() => {
      store.setSessions(mgr.listConfiguredSessions());
      store.setUi(mgr.getUiState());
    });

    // Start a recipe session, then IMMEDIATELY close the window (within the debounce
    // window — no trailing write has landed yet; store.isDirty() is true).
    const { id } = mgr.create({ cols: 80, rows: 24, cwd: FAKE_HOME });
    mgr.updateProfile(id, { startupCommand: 'codex' });
    expect(store.isDirty()).toBe(true); // pending, not yet written

    // The dev window closes. The handler MUST flush the store before/with disposeAll.
    await handleWindowClosed(mgr, store);

    // The on-disk file must now contain the recipe (durable on a window-close).
    const onDisk = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    const persisted = onDisk.sessions.find(
      (s: { logicalId: string }) => s.logicalId === id,
    );
    expect(persisted).toBeDefined();
    expect(persisted.startupCommand).toBe('codex');
    // Secondary hygiene: the persisted version is bumped to the current SCHEMA_VERSION.
    expect(onDisk.version).toBe(2);

    // And a reopen restores it as a dormant Inactive-List entry.
    const store2 = new SessionStore(storeFile, 0);
    const data = await store2.load();
    const mgr2 = new PtyManager();
    mgr2.registerIpc(fakeWindow());
    mgr2.hydrate(data.sessions);
    const restored = mgr2.listSessions().find((s) => s.logicalId === id);
    expect(restored?.status).toBe('not_started');
    expect(restored?.startupCommand).toBe('codex');
  });

  it('a recipe that is STILL RUNNING at quit persists and restores as dormant (no self-exit needed)', async () => {
    const store = new SessionStore(storeFile, 0);
    await store.load();
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    mgr.setStoreSignal(() => {
      store.setSessions(mgr.listConfiguredSessions());
      store.setUi(mgr.getUiState());
    });

    const { id } = mgr.create({ cols: 80, rows: 24, cwd: FAKE_HOME });
    mgr.updateProfile(id, { startupCommand: 'claude --rc' });
    const liveRec = mgr.listSessions().find((s) => s.logicalId === id) as {
      configured?: boolean;
    };
    liveRec.configured = undefined; // an unedited recipe (identity only)
    // Re-signal the store AFTER stripping configured so the persisted snapshot is
    // recomputed from listConfiguredSessions() with configured unset (identity only).
    store.setSessions(mgr.listConfiguredSessions());

    // The user QUITS while the recipe is still running (no self-exit).
    await store.flush();

    // Reopen.
    const store2 = new SessionStore(storeFile, 0);
    const data = await store2.load();
    const mgr2 = new PtyManager();
    mgr2.registerIpc(fakeWindow());
    mgr2.hydrate(data.sessions);

    const restored = mgr2.listSessions().find((s) => s.logicalId === id);
    expect(restored).toBeDefined();
    expect(restored?.status).toBe('not_started');
    expect(restored?.startupCommand).toBe('claude --rc');
  });
});
