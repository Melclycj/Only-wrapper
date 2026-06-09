import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { buildWebPreferences } from './window-config';
import { PtyManager } from './pty-manager';
import { SessionStore } from './session-store';
import { validateBounds } from './window-bounds';
import { matchSwitchKey, matchClearKey, type KeyInput } from './switch-keys';
import { handleWindowClosed, handleWindowAllClosed } from './lifecycle';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Single PtyManager owns all live PTY children (one this phase; N in Phase 3).
// Instantiated at module scope so the before-quit hook can dispose it even if
// the window is already gone.
const ptyManager = new PtyManager();

// The lowdb-backed persistence store (05-02). Constructed at module scope; its
// file path is resolved INSIDE load() (whenReady-time — Pitfall 3). The
// before-quit flush reads its dirty flag, so it must outlive the window.
const store = new SessionStore();

/**
 * Re-entrancy guard for the before-quit flush (RESEARCH Pattern 3): the first
 * before-quit preventDefault()s, flushes the trailing debounced write, then calls
 * app.quit() again — which re-fires before-quit. This flag makes the second pass
 * fall through to the real teardown instead of flushing forever.
 */
let quitting = false;

/**
 * Push the current live+dormant snapshot AND the validated UI prefs into the store
 * and let its debounce coalesce the write (D-13). Wired as the PtyManager store
 * change-signal so EVERY record/ui mutation persists.
 */
function syncStore(): void {
  // D-02: persist ONLY configured records — an unedited `+ New` ephemeral session
  // never reaches disk (the filter lives at the snapshot source; setSessions stays
  // a dumb setter). listConfiguredSessions() filters listSessions() to
  // configured===true. The renderer still sees every session via the pty:list
  // (listSessions) path — this filter only governs what the store snapshot holds.
  store.setSessions(ptyManager.listConfiguredSessions());
  store.setUi(ptyManager.getUiState());
}

function createWindow(): void {
  // Restore validated window bounds BEFORE the window shows (Pitfall 5): saved
  // bounds on a now-disconnected monitor → DEFAULT_BOUNDS (validateBounds). The
  // store may not have loaded on the very first activate; data?.ui?.bounds is
  // undefined-safe and validateBounds maps undefined → DEFAULT_BOUNDS.
  const savedBounds = store.data?.ui?.bounds;
  const bounds = validateBounds(
    savedBounds,
    screen.getAllDisplays().map((d) => ({ workArea: d.workArea })),
  );

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    webPreferences: buildWebPreferences(path.join(__dirname, '../preload/index.js')),
  });

  // Wire the validated PTY IPC handlers to this window. The renderer (02-03)
  // originates the actual ptyCreate() call when its TerminalPane mounts and
  // auto-starts the single session (D-02) — here we just make the surface live.
  ptyManager.registerIpc(win);

  // Persist window bounds on move/resize (D-12): write through setUiState (which
  // validates + holds + signals the store, so the debounce coalesces the burst of
  // resize events into one trailing write — Pitfall 5).
  const persistBounds = (): void => {
    if (win.isDestroyed()) return;
    const b = win.getBounds();
    ptyManager.setUiState({
      collapsed: ptyManager.getUiState().collapsed,
      bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
    });
  };
  win.on('moved', persistBounds);
  win.on('resize', persistBounds);

  // Keyboard session-switch interception (NAV-05, D-12/D-13 — "app always wins").
  // The switch chords (Cmd/Ctrl+1-9, Cmd/Ctrl+Shift+]/[) are intercepted in MAIN via
  // before-input-event — the ONLY mechanism that reliably wins over a focused xterm on
  // Windows Ctrl combos. matchSwitchKey (pure, electron-free) resolves the intent; on a
  // match we preventDefault() (the chord NEVER reaches the renderer/xterm/PTY — works
  // even inside vim/tmux/fzf) and push the SwitchIntent on the 'session:switch' channel
  // that the Plan-01 onSwitchSession preload subscription listens on. NON-matches return
  // null and fall through untouched (T-04-07). NOT a Menu accelerator (preventDefault
  // would suppress it — Electron #19279) and NOT a system-wide global shortcut
  // (silent-fail, macOS-layout bug — RESEARCH Anti-Patterns).
  win.webContents.on('before-input-event', (event, input) => {
    const key = input as unknown as KeyInput;
    const intent = matchSwitchKey(key);
    if (intent) {
      event.preventDefault();
      win.webContents.send('session:switch', intent);
      return;
    }
    // Clear chord (Cmd+K / Ctrl+Shift+K — D-13). It rides the SAME 'session:switch'
    // channel as a { kind: 'clear' } intent (NO new bridge key), and is intercepted
    // here so the chord NEVER reaches xterm/the PTY (app-wins, works inside vim/tmux).
    const clear = matchClearKey(key);
    if (clear) {
      event.preventDefault();
      win.webContents.send('session:switch', clear);
    }
  });

  // Orphan-safe cleanup + DEFECT B store flush when this window closes (Pitfall 6,
  // T-02-06). handleWindowClosed detaches the window FIRST (so node-pty's final
  // onData/onExit flushes during disposeAll() never hit a destroyed BrowserWindow —
  // TERM-06/08 shutdown guard), then FLUSHES the store (a session Started right before a
  // dev window-close on macOS — where no before-quit fires — must be durable), then
  // disposeAll()s every PTY. The handler is extracted to lifecycle.ts so it is unit-tested.
  win.on('closed', () => {
    void handleWindowClosed(ptyManager, store);
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

// Folder-picker (06-01, the new `pickDirectory` bridge key). Main OWNS the native
// open-directory dialog and returns ONLY a string path (never an fs handle — V12,
// T-06-01); the renderer never touches the filesystem. Returns null on cancel/empty.
ipcMain.handle('dialog:pick-directory', async (): Promise<string | null> => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
});

// Persistence lifecycle (05-02): on whenReady, load the store, hydrate the dormant
// records into the PtyManager, wire the store change-signal, THEN create the window
// (so createWindow can read the restored bounds). Every step is awaited before the
// window opens so a restored session is visible on first paint (PERS-02).
app.whenReady().then(async () => {
  const data = await store.load();
  ptyManager.hydrate(data.sessions); // restored records → dormant (not_started)
  ptyManager.setStoreSignal(syncStore); // every mutation debounce-writes (D-13)
  createWindow();
});

app.on('window-all-closed', () => {
  // DEFECT B: flush the store on ALL platforms before any quit decision so the last window
  // closing never drops a pending debounced write, THEN apply the platform quit policy
  // (non-darwin quits; darwin stays resident — the dock-relaunch path).
  void handleWindowAllClosed(store).finally(() => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Final backstop: ensure no PTY child outlives the app (Pitfall 6, T-02-06), tear
// down the process-global PTY IPC handlers symmetrically (CR-01), AND flush the
// trailing debounced store write so a quit right after a mutation never loses it
// (D-13, RESEARCH Pattern 3). The re-entrancy guard makes the flush-then-quit a
// single round-trip: preventDefault() once, flush, app.quit() (which re-fires
// before-quit with `quitting` true → fall through to teardown).
app.on('before-quit', (event) => {
  if (!quitting && store.isDirty()) {
    quitting = true;
    event.preventDefault();
    void store.flush().finally(() => app.quit());
    return;
  }
  ptyManager.disposeAll();
  ptyManager.unregisterIpc();
});
