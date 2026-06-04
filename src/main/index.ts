import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { buildWebPreferences } from './window-config';
import { PtyManager } from './pty-manager';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Single PtyManager owns all live PTY children (one this phase; N in Phase 3).
// Instantiated at module scope so the before-quit hook can dispose it even if
// the window is already gone.
const ptyManager = new PtyManager();

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: buildWebPreferences(path.join(__dirname, '../preload/index.js')),
  });

  // Wire the validated PTY IPC handlers to this window. The renderer (02-03)
  // originates the actual ptyCreate() call when its TerminalPane mounts and
  // auto-starts the single session (D-02) — here we just make the surface live.
  ptyManager.registerIpc(win);

  // Orphan-safe cleanup: kill every PTY when this window closes (Pitfall 6, T-02-06).
  // detachWindow() FIRST so node-pty's synchronous final onData/onExit flushes during
  // disposeAll() never hit a destroyed BrowserWindow (TERM-06/08 shutdown crash guard).
  win.on('closed', () => {
    ptyManager.detachWindow();
    ptyManager.disposeAll();
  });

  // Load renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

// Minimal IPC handler for Phase 1 walking skeleton
ipcMain.handle('api:get-version', () => app.getVersion());

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Final backstop: ensure no PTY child outlives the app (Pitfall 6, T-02-06), and
// tear down the process-global PTY IPC handlers symmetrically (CR-01).
app.on('before-quit', () => {
  ptyManager.disposeAll();
  ptyManager.unregisterIpc();
});
