// SC5 / TERM-12 — header Clear/Remove controls + the Clear chord (Plan 06-04, D-11..D-13;
// 06.1-04 FIX 3 removed the header Restart ↻ button; Phase 11 / SESS-07 / D-01 removed the
// LAST restart entry point — the row context-menu Restart item).
//
// Asserts:
//   - The header Clear control wipes the visible buffer (drops scrollback) WITHOUT
//     killing the PTY — the live prompt survives and the terminal still echoes input
//     (D-12: client-side term.clear(), no shell injection).
//   - The Clear chord (Cmd+K mac / Ctrl+Shift+K win), intercepted MAIN-side in
//     before-input-event (matchClearKey → {kind:'clear'} on the EXISTING session:switch
//     channel), produces the same Clear effect — proving it never reaches xterm/PTY.
//   - The header has NO Restart (↻) button and NO Start button (06.1-04 FIX 3 / D-06):
//     the live header is Clear + Remove only.
//   - SESS-07 / D-01 (Phase 11): a live (running) row's context menu offers NO 'Restart'
//     item — every restart affordance is gone. Recycling is Remove → Inactive List →
//     Start ▶ (a fresh process), proven by startup-command.smoke + app-restart-restore.smoke.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  readBuffer,
  waitForText,
  sendKeys,
  ensureSession,
  pressClearChord,
  clickByTestId,
  hasTestId,
  activeSessionId,
  openContextMenu,
} from './helpers/xterm-driver';

/** Visible text labels of the currently-open context menu's items. */
async function contextMenuLabels(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>('.context-menu-item'),
    ).map((el) => (el.textContent ?? '').trim()),
  );
}

describe('Header Clear/Remove controls + Clear chord smoke (SC5 — Plan 06-04)', () => {
  before(async () => {
    await ensureSession();
  });

  it('the Clear control wipes the visible buffer without killing the PTY', async () => {
    // Build distinctive scrollback, then a fresh prompt-bearing sentinel so we can prove
    // the prompt line survives the clear.
    const marker = `CLEARME_${Date.now()}`;
    await sendKeys(`echo ${marker}`);
    await browser.keys(['Enter']);
    await waitForText(marker, 10000);
    expect(await readBuffer()).toContain(marker);

    // Click the header Clear button (D-12: term.clear() — drops scrollback, keeps prompt).
    await clickByTestId('clear-terminal');

    // The prior output is gone from the visible buffer…
    await browser.waitUntil(
      async () => !(await readBuffer()).includes(marker),
      { timeout: 5000, timeoutMsg: 'Clear did not drop the prior scrollback' },
    );

    // …but the PTY is ALIVE: a new keystroke still echoes (the terminal is not dead/blank).
    const after = `ALIVE_${Date.now()}`;
    await sendKeys(`echo ${after}`);
    await browser.keys(['Enter']);
    await waitForText(after, 10000);
    expect(await readBuffer()).toContain(after);
  });

  it('the Clear chord (Cmd+K / Ctrl+Shift+K) clears via the main-side interceptor', async () => {
    const marker = `CHORDME_${Date.now()}`;
    await sendKeys(`echo ${marker}`);
    await browser.keys(['Enter']);
    await waitForText(marker, 10000);
    expect(await readBuffer()).toContain(marker);

    // Drive the chord through the native before-input-event path (NOT browser.keys).
    await pressClearChord();

    await browser.waitUntil(
      async () => !(await readBuffer()).includes(marker),
      {
        timeout: 5000,
        timeoutMsg: 'Clear chord did not clear the active session (interceptor path)',
      },
    );

    // PTY still alive after the chord.
    const after = `CHORDALIVE_${Date.now()}`;
    await sendKeys(`echo ${after}`);
    await browser.keys(['Enter']);
    await waitForText(after, 10000);
    expect(await readBuffer()).toContain(after);
  });

  it('the live header is Clear + Remove only — NO Restart, NO Start (D-06 / 06.1-04 FIX 3)', async () => {
    // The session ensured above is running. The header Restart ↻ button was removed
    // (06.1-04 FIX 3, user decision) and there is no header Start. Clear + Remove remain.
    expect(await hasTestId('header-restart')).toBe(false);
    expect(await hasTestId('header-start')).toBe(false);
    expect(await hasTestId('clear-terminal')).toBe(true);
    expect(await hasTestId('header-remove')).toBe(true);
  });

  it('the row context menu offers NO Restart item — every restart affordance is gone (SESS-07 / D-01)', async () => {
    // The session ensured above is running (a live Working-Area row). Phase 11 deleted the
    // last restart entry point: the context-menu 'Restart' arm. Open the live row's menu
    // and assert its item labels do NOT include 'Restart' (recycle is Remove → Inactive
    // List → Start ▶, covered by startup-command.smoke + app-restart-restore.smoke).
    const id = await activeSessionId();
    expect(id).not.toBe('');

    await openContextMenu(id);
    // The menu paints synchronously off the contextmenu event; wait until its items render.
    await browser.waitUntil(
      async () => (await contextMenuLabels()).length > 0,
      { timeout: 5000, timeoutMsg: 'context menu did not open for the live row' },
    );
    const labels = await contextMenuLabels();
    expect(labels).not.toContain('Restart');
    // A live row still offers Edit + Remove (the surviving destructive verb); no Start either
    // (Start is a dormant-only arm). Close the menu so it cannot intercept later keystrokes.
    expect(labels).toContain('Remove');
    await browser.keys(['Escape']);
  });
});
