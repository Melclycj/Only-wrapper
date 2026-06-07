// Wave 0 RED smoke scaffold — SC5 header Clear/Restart controls + Clear chord
// (filled GREEN in Plan 06-04).
//
// TARGET BEHAVIOR (Plan 06-04 fills this in):
//   - The session identity header exposes a Clear control and a Restart control.
//   - Clear wipes the visible terminal buffer (term.clear / reset) WITHOUT killing the
//     PTY (the running process and its scrollback-of-record survive logically).
//   - The Clear chord (Cmd+K on macOS / Ctrl+Shift+K on Windows) is intercepted MAIN-
//     side in before-input-event (matchClearKey → {kind:'clear'} on the EXISTING
//     'session:switch' channel) so it never reaches xterm/PTY, and produces the same
//     Clear effect as the header control.
//   - Restart re-spawns the session under the same logicalId (mirrors the context-menu
//     Restart) and renders the `— restarted —` separator.
//
// This is a `describe.skip` stub so it RESOLVES under the WDIO/mocha runner WITHOUT
// failing the suite (skipped specs are pending, not failing). It imports the canonical
// xterm-driver helpers so the module graph is wired and Plan 06-04's executor inherits
// a compiling contract to flip GREEN. When Plan 06-04 lands the header controls + Clear
// chord, replace `describe.skip` with `describe` and the real assertions, then delete
// this "RED" banner note.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  readBuffer,
  waitForText,
  sendKeys,
  ensureSession,
  pressSwitchChord,
} from './helpers/xterm-driver';

// Reference the imports so lint does not flag them as unused; the real spec in Plan
// 06-04 drives Clear (header + chord) and Restart with these helpers (the Clear chord
// will need a header-controls-specific driver akin to pressSwitchChord).
void readBuffer;
void waitForText;
void sendKeys;
void ensureSession;
void pressSwitchChord;

describe.skip('Header Clear/Restart controls + Clear chord smoke (SC5 — Plan 06-04)', () => {
  // it('Clear control wipes the visible buffer without killing the PTY')
  // it('the Clear chord (Cmd+K / Ctrl+Shift+K) clears via the main-side interceptor')
  // it('Restart re-spawns under the same logicalId with the — restarted — separator')
});
