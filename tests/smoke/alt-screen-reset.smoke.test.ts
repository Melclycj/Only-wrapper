// Wave 0 RED smoke scaffold — SC3 alt-screen reset at the restart seam
// (filled GREEN in Plan 06-04).
//
// TARGET BEHAVIOR (Plan 06-04 fills this in):
//   When a session that was inside the alternate screen buffer (e.g. a TUI like vim
//   or a full-screen agent view) is RESTARTED, SessionView writes `\x1b[?1049l` to
//   EXIT the alt-screen while PRESERVING scrollback, then renders the `— restarted
//   HH:MM —` separator and re-spawns. The restarted session must NOT leave the
//   terminal stuck in a frozen alt-screen frame, and prior scrollback stays visible.
//
// This is a `describe.skip` stub so it RESOLVES under the WDIO/mocha runner WITHOUT
// failing the suite (skipped specs are pending, not failing). It imports the canonical
// xterm-driver helpers so the module graph is wired and Plan 06-04's executor inherits
// a compiling contract to flip GREEN. When Plan 06-04 lands the alt-screen reset,
// replace `describe.skip` with `describe` and the real assertions, then delete this
// "RED" banner note.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  readBuffer,
  waitForText,
  sendKeys,
  ensureSession,
  openContextMenu,
  clickMenuItem,
} from './helpers/xterm-driver';

// Reference the imports so lint does not flag them as unused; the real spec in Plan
// 06-04 drives the full alt-screen-enter → restart → reset round-trip with these.
void readBuffer;
void waitForText;
void sendKeys;
void ensureSession;
void openContextMenu;
void clickMenuItem;

describe.skip('Alt-screen reset on restart smoke (SC3 — Plan 06-04)', () => {
  // it('exits the alt-screen buffer on restart, preserves scrollback, shows the — restarted — separator')
});
