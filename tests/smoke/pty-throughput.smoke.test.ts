// Wave 0 RED E2E smoke stub — covers SC5 (high-throughput responsiveness +
// no dropped output). The word "throughput" here also satisfies the must-have
// grep.
//
// INTENTIONALLY FAILS RED until Plans 02-03 / 02-04 wire the PTY + the
// canonical xterm.js watermark flow control. The booted app has no terminal
// yet, so neither the bulk emit nor the sentinel echo round-trips. When
// 02-03/02-04 land, this goes GREEN and this banner is deleted.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  sendKeys,
  readBuffer,
  waitForText,
  ensureSession,
} from './helpers/xterm-driver';

describe('PTY throughput smoke (SC5)', () => {
  // 05-03: boot no longer auto-spawns (D-10) — explicitly create the session this
  // single-pane test drives.
  before(async () => {
    await ensureSession();
  });

  it('stays responsive and drops no output while emitting ~50MB', async () => {
    const nonce = `READY_${Date.now()}`;

    // Emit ~50MB of bytes from the child. yes | head is portable and fast;
    // ~50MB ≈ 25,000,000 lines of "y\n". The UI must NOT freeze (flow control).
    await sendKeys('yes | head -n 25000000 | wc -l');
    await browser.keys(['Enter']);

    // Immediately type a sentinel — under correct flow control the keystroke
    // echo must still appear within the responsiveness budget (UI not frozen).
    await sendKeys(`echo ${nonce}`);
    await browser.keys(['Enter']);
    await waitForText(nonce, 15000);
    expect(await readBuffer()).toContain(nonce);

    // No-drop check: wc -l must report the full line count (no bytes lost).
    await sendKeys('echo COUNTDONE');
    await browser.keys(['Enter']);
    await waitForText('COUNTDONE', 15000);
    expect(await readBuffer()).toContain('25000000');
  });
});
