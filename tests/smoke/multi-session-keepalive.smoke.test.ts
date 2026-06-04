// Wave 0 RED E2E smoke stub — covers SC1 / TERM-06 (multi-session keep-alive)
// and SC2 (switch-to-hidden shows a current buffer, no blank/frozen frame).
//
// INTENTIONALLY FAILS RED until plans 03-02 / 03-03 wire the multi-session
// renderer (per-session xterm kept mounted, sidebar with `data-session-id` rows,
// `data-testid="add-session"` button). The packaged app this boots has only the
// single Phase-2 pane, so the N-pane driver finds no `[data-session-id]` panes
// and the assertions below cannot pass. When 03-02/03-03 land, these go GREEN.
//
// Test shape (SC1/SC2):
//   1. Open 3 sessions (A, B, C) via the sidebar add button.
//   2. In session A, start a background loop printer: `while true; do echo TICK; sleep 0.2; done`.
//   3. Switch to B, wait, switch back to A.
//   4. Assert A's visible TICK count ADVANCED while it was hidden (SC1 keep-alive)
//      and that the buffer is current with no blank frame (SC2).

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  clickAddSession,
  clickSidebarRow,
  sendKeysTo,
  readBufferOf,
  waitForTextIn,
} from './helpers/xterm-driver';

/** Count occurrences of "TICK" in a buffer snapshot. */
function countTicks(buffer: string): number {
  return (buffer.match(/TICK/g) ?? []).length;
}

/**
 * Resolve the LogicalId of the Nth sidebar session row (0-indexed). Returns the
 * `data-session-id` attribute of the matching sidebar row. RED until 03-02 wires
 * the sidebar rows.
 */
async function sessionIdAt(index: number): Promise<string> {
  return browser.execute((i: number) => {
    const rows = document.querySelectorAll<HTMLElement>('[data-session-id]');
    return rows[i]?.getAttribute('data-session-id') ?? '';
  }, index);
}

describe('Multi-session keep-alive smoke (SC1 / TERM-06, SC2)', () => {
  it('keeps a hidden session running and shows a current buffer on switch-back', async () => {
    // 1. Open 3 sessions (one may already exist on boot; add until ≥3).
    await clickAddSession();
    await clickAddSession();
    await clickAddSession();

    const a = await sessionIdAt(0);
    const b = await sessionIdAt(1);

    // 2. Background loop printer in session A.
    await clickSidebarRow(a);
    await sendKeysTo(a, 'while true; do echo TICK; sleep 0.2; done');
    await browser.keys(['Enter']);
    await waitForTextIn(a, 'TICK', 5000);
    const ticksBefore = countTicks(await readBufferOf(a));

    // 3. Switch to B, let A keep printing while hidden, switch back to A.
    await clickSidebarRow(b);
    await browser.pause(2000); // A is hidden but its PTY keeps producing output
    await clickSidebarRow(a);

    // 4. SC1: the TICK count advanced while A was hidden (PTY never paused).
    const ticksAfter = countTicks(await readBufferOf(a));
    expect(ticksAfter).toBeGreaterThan(ticksBefore);

    // 4b. SC2: the buffer is current (TICK visible — not a blank/frozen frame).
    expect(await readBufferOf(a)).toContain('TICK');
  });
});
