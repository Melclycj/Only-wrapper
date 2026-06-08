// MAIN-PROCESS ONLY — the app/window lifecycle handlers, extracted from index.ts so the
// store-durability contract is unit-testable in the Node/Vitest env (DEFECT B, round 3).
//
// Imports NOTHING from `electron` — it operates on the PtyManager + SessionStore it is
// handed, so pty-recipe-persistence.test.ts can drive the REAL close handler (not
// store.flush() directly) against a temp-file store with no Electron app.
//
// DEFECT B (the defect): on macOS, closing the dev window does NOT fire `before-quit`, and
// the OLD `win.on('closed')` handler only disposed the PTYs WITHOUT flushing the store. A
// session created within the ~300ms scheduleSave() debounce window (before any trailing
// write) was therefore LOST on a window-close — the on-disk file showed sessions:[] while a
// full quit (which DID flush via before-quit) kept it. UI prefs survived only because
// move/resize fire continuously and flush mid-run.
//
// THE FIX: flush the store on window close BEFORE disposing the PTYs, so a freshly-Started
// recipe is durable even on a dev window-close. window-all-closed flushes on ALL platforms
// before any quit, for symmetry.

import type { PtyManager } from './pty-manager';
import type { SessionStore } from './session-store';

/**
 * Handle a BrowserWindow `closed` event (wired into `win.on('closed')`).
 *
 * Order matters:
 *   1. detachWindow() FIRST — so node-pty's synchronous final onData/onExit flushes during
 *      disposeAll() never hit a now-destroyed BrowserWindow (TERM-06/08 shutdown guard).
 *   2. await store.flush() — DEFECT B: persist any pending debounced write so a session
 *      Started right before the close is durable (on macOS no before-quit fires here).
 *   3. disposeAll() — orphan-safe: kill every PTY child so none outlives the window
 *      (Pitfall 6, T-02-06).
 *
 * Returns the flush promise so callers/tests can await durability.
 */
export async function handleWindowClosed(
  ptyManager: PtyManager,
  store: SessionStore,
): Promise<void> {
  ptyManager.detachWindow();
  // Flush BEFORE disposeAll: the snapshot the store holds already reflects the latest
  // mutations (syncStore ran on each create/updateProfile), so the durable write must land
  // before we tear PTYs down. flush() is a no-op when nothing is pending.
  await store.flush();
  ptyManager.disposeAll();
}

/**
 * Handle the app `window-all-closed` event. DEFECT B: flush the store on ALL platforms
 * before any quit decision, so the last window closing never drops a pending write. The
 * caller decides whether to quit (non-darwin quits; darwin stays resident).
 */
export async function handleWindowAllClosed(store: SessionStore): Promise<void> {
  await store.flush();
}
