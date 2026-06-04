// Wave 0 RED E2E smoke stub — covers SC3 (resize → SIGWINCH → tput cols).
//
// INTENTIONALLY FAILS RED until Plans 02-03 / 02-04 wire the resize path
// (addon-fit → pty.resize → SIGWINCH). The booted app has no terminal yet, so
// `tput cols` never round-trips. When 02-03/02-04 land, this goes GREEN and
// this banner is deleted.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import { sendKeys, readBuffer, waitForText } from './helpers/xterm-driver';

/** Extract the trailing integer (the `tput cols` output) from the buffer. */
function lastNumber(buf: string): number | null {
  const matches = buf.match(/\b(\d{2,3})\b/g);
  if (!matches || matches.length === 0) return null;
  return parseInt(matches[matches.length - 1], 10);
}

describe('PTY resize smoke (SC3)', () => {
  it('reports a new column count via tput cols within 1s of a window resize', async () => {
    // Record the initial column count.
    await sendKeys('tput cols');
    await browser.keys(['Enter']);
    await waitForText('tput cols', 3000);
    const before = lastNumber(await readBuffer());
    expect(before).not.toBeNull();

    // Resize the window — addon-fit recomputes cols → pty.resize → SIGWINCH.
    const { width, height } = await browser.getWindowSize();
    await browser.setWindowSize(Math.max(400, Math.round(width / 2)), height);

    // tput cols must change to match the new width within 1 second.
    await sendKeys('tput cols');
    await browser.keys(['Enter']);
    await browser.waitUntil(
      async () => {
        const after = lastNumber(await readBuffer());
        return after !== null && after !== before;
      },
      { timeout: 1000, interval: 50, timeoutMsg: 'tput cols did not change within 1s of resize' }
    );
    const after = lastNumber(await readBuffer());
    expect(after).not.toBe(before);
  });
});
