import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true, // REQUIRED — default since v12
      nodeIntegration: false, // REQUIRED — never enable
      sandbox: true, // REQUIRED — default since v20; explicit for D-07 guard test
      preload: path.join(__dirname, '../preload/index.js'),
    },
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
