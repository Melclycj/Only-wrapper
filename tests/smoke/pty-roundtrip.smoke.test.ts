// Wave 0 RED E2E smoke stub — covers SC1 / TERM-02 (PTY round-trip),
// SC4 ($TERM=xterm-256color), and SC1 (Ctrl+C / SIGINT).
//
// INTENTIONALLY FAILS RED until Plans 02-03 / 02-04 wire a real PTY-backed
// xterm terminal into the renderer. The packaged Electron app this boots has no
// terminal surface yet, so sendKeys/readBuffer find no `.xterm-rows` and the
// assertions below cannot pass. When 02-03/02-04 land the TerminalPane + PTY
// IPC, these go GREEN and this banner is deleted.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import { sendKeys, readBuffer, waitForText } from './helpers/xterm-driver';

describe('PTY round-trip smoke (SC1, TERM-02, SC4)', () => {
  it('echoes typed input back through the PTY (echo hello)', async () => {
    await sendKeys('echo hello');
    await browser.keys(['Enter']);
    await waitForText('hello', 5000);
    expect(await readBuffer()).toContain('hello');
  });

  it('reports TERM=xterm-256color from the PTY environment (SC4)', async () => {
    await sendKeys('echo $TERM');
    await browser.keys(['Enter']);
    await waitForText('xterm-256color', 5000);
    expect(await readBuffer()).toContain('xterm-256color');
  });

  it('forwards Ctrl+C (0x03) as SIGINT and returns to the prompt (SC1)', async () => {
    await sendKeys('sleep 100');
    await browser.keys(['Enter']);
    // Send the raw Ctrl+C byte (ETX, 0x03) to interrupt the foreground job.
    await browser.keys(['']);
    // After SIGINT the shell prompt returns; a fresh echo must round-trip.
    await sendKeys('echo BACK_AT_PROMPT');
    await browser.keys(['Enter']);
    await waitForText('BACK_AT_PROMPT', 5000);
    expect(await readBuffer()).toContain('BACK_AT_PROMPT');
  });
});
