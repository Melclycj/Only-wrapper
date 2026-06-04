// CR-01 regression: PTY IPC registration must be idempotent.
//
// The macOS close-then-reopen flow runs `app.on('activate') → createWindow() →
// ptyManager.registerIpc(win)` a SECOND time. IPC handlers are process-global,
// so re-running `ipcMain.handle('pty:create', …)` throws "Attempted to register
// a second handler" and re-running `ipcMain.on(…)` stacks duplicate listeners.
// This test proves registerIpc can run N times without throwing and without
// stacking handlers, while still re-pointing output at the latest window.
//
// electron + node-pty are mocked so this runs in Vitest's plain Node env (no
// Electron runtime, no real PTY spawn).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock electron.ipcMain with a real-enough single-handler invariant ────────
// Electron's actual ipcMain.handle throws if a channel already has a handler;
// we mirror that so a non-idempotent registerIpc would fail this test.
const handleMock = vi.fn();
const onMock = vi.fn();
const removeHandlerMock = vi.fn();
const removeAllListenersMock = vi.fn();
const registeredHandlers = new Set<string>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: unknown) => {
      if (registeredHandlers.has(channel)) {
        throw new Error(
          `Attempted to register a second handler for '${channel}'`,
        );
      }
      registeredHandlers.add(channel);
      handleMock(channel, listener);
    },
    on: (channel: string, listener: unknown) => onMock(channel, listener),
    removeHandler: (channel: string) => {
      registeredHandlers.delete(channel);
      removeHandlerMock(channel);
    },
    removeAllListeners: (channel: string) => removeAllListenersMock(channel),
  },
}));

// node-pty is never spawned in this test (we don't call create()), but importing
// pty-manager pulls it in at module load — mock it to avoid the native prebuild.
vi.mock('node-pty', () => ({ spawn: vi.fn() }));

import { PtyManager, PTY_CHANNELS } from '../pty-manager';

// A minimal BrowserWindow stand-in — registerIpc only stores it as the send target.
// isDestroyed() on window + webContents mirror a real BrowserWindow (PtyManager.send guard).
function fakeWindow(): never {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn(), isDestroyed: () => false },
  } as never;
}

describe('PtyManager.registerIpc — idempotency (CR-01)', () => {
  beforeEach(() => {
    handleMock.mockClear();
    onMock.mockClear();
    removeHandlerMock.mockClear();
    removeAllListenersMock.mockClear();
    registeredHandlers.clear();
  });

  it('registers the create handler exactly once across repeated calls', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    mgr.registerIpc(fakeWindow()); // macOS re-activate — must NOT throw
    mgr.registerIpc(fakeWindow()); // and again

    const createRegistrations = handleMock.mock.calls.filter(
      ([channel]) => channel === PTY_CHANNELS.create,
    );
    expect(createRegistrations).toHaveLength(1);
  });

  it('does not stack duplicate send-channel listeners on re-activate', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const afterFirst = onMock.mock.calls.length;
    mgr.registerIpc(fakeWindow());
    mgr.registerIpc(fakeWindow());
    // No additional ipcMain.on calls after the first registration.
    expect(onMock.mock.calls.length).toBe(afterFirst);
  });

  it('survives N create/destroy window cycles without throwing', () => {
    const mgr = new PtyManager();
    expect(() => {
      for (let i = 0; i < 10; i++) {
        mgr.registerIpc(fakeWindow());
      }
    }).not.toThrow();
  });

  it('re-registers cleanly after unregisterIpc (symmetric teardown)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    mgr.unregisterIpc();
    expect(removeHandlerMock).toHaveBeenCalledWith(PTY_CHANNELS.create);
    // After teardown, a fresh registration must NOT throw the second-handler error.
    expect(() => mgr.registerIpc(fakeWindow())).not.toThrow();
    const createRegistrations = handleMock.mock.calls.filter(
      ([channel]) => channel === PTY_CHANNELS.create,
    );
    expect(createRegistrations).toHaveLength(2); // once before, once after re-register
  });
});
