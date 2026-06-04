// Wave 0 RED E2E smoke stub — covers SC3 (resize → SIGWINCH → tput cols).
//
// INTENTIONALLY FAILS RED until Plans 02-03 / 02-04 wire the resize path
// (addon-fit → pty.resize → SIGWINCH). The booted app has no terminal yet, so
// `tput cols` never round-trips. When 02-03/02-04 land, this goes GREEN and
// this banner is deleted.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import { sendKeys, readBuffer, resizeWindow } from './helpers/xterm-driver';

/**
 * Extract the column count that the shell printed in response to the MOST RECENT
 * `tput cols` command. The login shell prints a "Restored session: <date>" banner
 * and the prompt contains the host name, so a naive "last number in the buffer"
 * read would pick up banner/clock digits. We instead find the last `tput cols`
 * ECHO and take the first standalone integer that appears AFTER it — that is the
 * command's actual output, immune to banner/prompt noise.
 */
function colsFromBuffer(buf: string): number | null {
  // Collapse whitespace so the command echo and its output sit on one line.
  const flat = buf.replace(/\s+/g, ' ');
  const idx = flat.lastIndexOf('tput cols');
  if (idx === -1) return null;
  const after = flat.slice(idx + 'tput cols'.length);
  const m = after.match(/\b(\d{2,3})\b/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Run `tput cols` and return the column count once the output has STABILISED.
 * Reading immediately after sendKeys races the PTY round-trip (the echoed command
 * text appears before its numeric output, and a login banner may still be
 * rendering), so we poll until two consecutive reads of the post-echo number
 * agree — yielding the real, settled `tput cols` result.
 */
async function readStableCols(): Promise<number> {
  await sendKeys('tput cols');
  await browser.keys(['Enter']);
  let last: number | null = null;
  let stableCount = 0;
  await browser.waitUntil(
    async () => {
      const n = colsFromBuffer(await readBuffer());
      if (n !== null && n === last) {
        stableCount += 1;
      } else {
        stableCount = 0;
      }
      last = n;
      return stableCount >= 2; // two agreeing reads → output settled
    },
    { timeout: 3000, interval: 60, timeoutMsg: 'tput cols output never settled' },
  );
  return last as number;
}

describe('PTY resize smoke (SC3)', () => {
  it('reports a new column count via tput cols within 1s of a window resize', async () => {
    // Record the initial column count (settled `tput cols` output).
    const before = await readStableCols();
    expect(before).not.toBeNull();

    // Resize the window — addon-fit recomputes cols → pty.resize → SIGWINCH.
    // Driven through the Electron main process (BrowserWindow.setSize) because
    // the CDP window-rect command is unavailable under @wdio/electron-service.
    const resizeStart = Date.now();
    await resizeWindow(600, 800);

    // The fit addon is debounced (100ms) before it calls window.api.ptyResize,
    // which then drives the PTY resize → SIGWINCH. Wait for the renderer's
    // authoritative term.cols to actually change (proves fit ran + ptyResize was
    // issued) before asking the shell for `tput cols` — otherwise the command can
    // race ahead of SIGWINCH and report the stale width. This wait is itself part
    // of the SC3 budget measured below.
    await browser.waitUntil(
      async () => {
        const cols = await browser.execute(
          () => (window as unknown as { __term?: { cols: number } }).__term?.cols,
        );
        return typeof cols === 'number' && cols !== before;
      },
      { timeout: 1000, interval: 30, timeoutMsg: 'term.cols did not change within 1s of resize' },
    );
    // SC3: the PTY column count must update within 1 second of the resize. The
    // waitUntil above (timeout 1000ms) is the actual budget gate; capture the
    // elapsed for an explicit assertion too.
    const reflowElapsed = Date.now() - resizeStart;
    expect(reflowElapsed).toBeLessThan(1000); // SC3 1-second reflow budget

    // Confirm the SHELL itself saw the new width (SIGWINCH round-trip): tput cols
    // must now report the new, narrower column count.
    const after = await readStableCols();
    expect(after).not.toBe(before);
  });
});
