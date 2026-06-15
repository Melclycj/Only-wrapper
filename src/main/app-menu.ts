// MAIN-PROCESS ONLY — pure application-menu template builder (12-05, GAP-12-D).
//
// Imports NOTHING runtime from 'electron' (the MenuItemConstructorOptions import is
// type-only — erased at runtime), mirroring lifecycle.ts / window-config.ts so it stays
// Vitest-importable in the Node env. index.ts feeds the result to
// Menu.setApplicationMenu(Menu.buildFromTemplate(...)) at whenReady.
//
// WHY this exists: no application Menu was ever set, so the standard macOS Edit
// shortcuts (Cmd+A select-all, Cmd+C/V/X, Cmd+Z) had no role — Cmd+A bubbled out and
// closed the edit modal, and copy/paste/cut/undo did not work in the form inputs
// (GAP-12-D). The fix is an explicit menu built from STANDARD roles only.
//
// The app-wins keyboard chords (Cmd/Ctrl+1-9 switch, Cmd+K clear, Cmd+F find) are
// deliberately NOT menu accelerators — they stay in index.ts's before-input-event
// interceptor so they win over a focused xterm (Electron #19279). This builder adds NO
// custom accelerator strings, only standard roles (whose defaults — Cmd+A/C/V/X/Z — do
// not collide with the 1-9 / K / F chords).

import type { MenuItemConstructorOptions } from 'electron';

/**
 * Build the application menu template for the given platform. Standard roles only — the
 * Edit submenu (undo/redo/cut/copy/paste/selectAll) restores OS-native text editing in
 * every focused input. On darwin the standard appMenu + windowMenu are included so
 * Cmd+Q / Cmd+M / Cmd+W behave natively; non-darwin keeps a minimal Edit-only menu.
 */
export function buildAppMenuTemplate(
  platform: NodeJS.Platform,
): MenuItemConstructorOptions[] {
  // Build the Edit submenu explicitly (rather than the single { role: 'editMenu' }) so
  // the unit test can read the individual roles. Behaviorally equivalent to the standard
  // Edit menu.
  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  };

  if (platform === 'darwin') {
    // macOS: the app menu (Cmd+Q etc.) must be first; the window menu enables Cmd+M/W.
    return [{ role: 'appMenu' }, editMenu, { role: 'windowMenu' }];
  }

  // Windows/Linux: a minimal Edit-only menu is enough to restore the editing roles.
  return [editMenu];
}
