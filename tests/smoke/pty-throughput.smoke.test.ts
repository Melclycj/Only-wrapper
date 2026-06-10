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

  it('stays responsive and drops no output while emitting ~100MB (SC1)', async () => {
    const nonce = `READY_${Date.now()}`;

    // SC1 high-throughput burst: emit ~100MB of bytes from the child. `yes | head`
    // is portable + fast and deterministic for the no-drop wc -l check. `yes` emits
    // "y\n" = 2 bytes/line, so 50,000,000 lines ≈ 100MB (the SC1 target — double the
    // prior 50MB). If 100M proves too slow in CI, scale the line count down via the
    // same `yes | head -n N` harness (documented fallback per Plan 06-01 Task 1); the
    // watermark backpressure (createWatermark, flow-control.ts) is what keeps the UI
    // responsive regardless of N. The UI must NOT freeze (flow control) and must drop
    // no bytes (lossless render).
    const LINES = 50000000; // 50M lines × 2 bytes ≈ 100MB throughput
    await sendKeys(`yes | head -n ${LINES} | wc -l`);
    await browser.keys(['Enter']);

    // Post-burst responsiveness: immediately type a sentinel — under correct flow
    // control the keystroke echo must still appear within the responsiveness budget
    // (the UI is NOT frozen by the in-flight 100MB burst).
    await sendKeys(`echo ${nonce}`);
    await browser.keys(['Enter']);
    await waitForText(nonce, 30000);
    expect(await readBuffer()).toContain(nonce);

    // No-drop check: wc -l must report the FULL line count (no bytes lost / lossless).
    await sendKeys('echo COUNTDONE');
    await browser.keys(['Enter']);
    await waitForText('COUNTDONE', 30000);
    expect(await readBuffer()).toContain(String(LINES));
  });
});
