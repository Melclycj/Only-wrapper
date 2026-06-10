// SC5 / TERM-12 — header Clear/Remove controls + the Clear chord (Plan 06-04, D-11..D-13;
// 06.1-04 FIX 3 removed the header Restart ↻ button — user decision).
//
// Asserts:
//   - The header Clear control wipes the visible buffer (drops scrollback) WITHOUT
//     killing the PTY — the live prompt survives and the terminal still echoes input
//     (D-12: client-side term.clear(), no shell injection).
//   - The Clear chord (Cmd+K mac / Ctrl+Shift+K win), intercepted MAIN-side in
//     before-input-event (matchClearKey → {kind:'clear'} on the EXISTING session:switch
//     channel), produces the same Clear effect — proving it never reaches xterm/PTY.
//   - The header has NO Restart (↻) button and NO Start button (06.1-04 FIX 3 / D-06):
//     the live header is Clear + Remove only. Restart-in-place still exists via the
//     row/context-menu Restart (covered here via the context menu + by
//     startup-command.smoke.test.ts) — it re-spawns under the SAME logicalId with a NEW
//     ptyPid and renders the "— restarted —" separator.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  readBuffer,
  waitForText,
  sendKeys,
  ensureSession,
  clickAddSession,
  clickSidebarRow,
  sendKeysTo,
  readBufferOf,
  waitForTextIn,
  pressClearChord,
  clickByTestId,
  hasTestId,
  activeSessionId,
  ptyPidOf,
  openContextMenu,
  clickMenuItem,
} from './helpers/xterm-driver';

/** data-session-id of the LAST sidebar row (a freshly-added session is appended). */
async function lastSessionId(): Promise<string> {
  return browser.execute(() => {
    const rows = document.querySelectorAll<HTMLElement>(
      '.sidebar-row[data-session-id]',
    );
    return rows[rows.length - 1]?.getAttribute('data-session-id') ?? '';
  });
}

describe('Header Clear/Restart controls + Clear chord smoke (SC5 — Plan 06-04)', () => {
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

  it('Restart (via the row context menu) re-spawns under the same logicalId with a new ptyPid + the — restarted — separator', async () => {
    // Add a FRESH session so this SessionView captures its FIRST 'running' transition
    // (which arms the hasRunBefore restart seam) before we restart it — a reused/restored
    // session can mount AFTER its initial 'running' and miss it (the dormant-start seam
    // gap), which is out of scope here. Mirrors the startup-command smoke's restart setup.
    await clickAddSession();
    const id = await lastSessionId();
    expect(id).not.toBe('');
    await clickSidebarRow(id);

    // Drive a marker into the fresh session and wait for its echo — this proves the
    // SessionView is mounted, active, and has seen its first 'running' (so hasRunBefore
    // is armed). With multiple sessions mounted the single-pane __term fallback is
    // ambiguous, so address THIS pane by id (sendKeysTo/waitForTextIn).
    const marker = `PRERESTART_${Date.now()}`;
    await sendKeysTo(id, `echo ${marker}`);
    await browser.keys(['Enter']);
    await waitForTextIn(id, marker, 10000);

    const before = await ptyPidOf(id);
    expect(before).toBeGreaterThan(0);

    // Restart #1: re-spawns under the SAME logicalId with a NEW pid. The initial spawn's
    // 'running' is broadcast SYNCHRONOUSLY during ptyCreate — before SessionView's
    // onPtyStatus subscription binds — so this stopped→running transition is the one that
    // ARMS the hasRunBefore restart seam (the same behavior the startup-command smoke
    // relies on for its separator assertion). Proves the same-id/new-pid restart. The
    // header ↻ was removed (FIX 3); Restart now lives on the row context menu.
    await openContextMenu(id);
    await clickMenuItem('Restart');
    await browser.waitUntil(
      async () => {
        const now = await ptyPidOf(id);
        return now > 0 && now !== before;
      },
      { timeout: 15000, timeoutMsg: 'Restart did not yield a new ptyPid for the same logicalId' },
    );
    expect(await activeSessionId()).toBe(id);
    const afterFirst = await ptyPidOf(id);

    // Restart #2: now that hasRunBefore is armed, the second 'running' transition writes
    // the SC3 seam — \x1b[?1049l (exit any alt-screen, preserve scrollback) THEN the dim
    // "— restarted HH:MM —" separator into the kept-alive xterm (Phase-3 D-03 / D-15).
    await openContextMenu(id);
    await clickMenuItem('Restart');
    await browser.waitUntil(
      async () => {
        const now = await ptyPidOf(id);
        return now > 0 && now !== afterFirst;
      },
      { timeout: 15000, timeoutMsg: 'Second restart did not yield a new ptyPid' },
    );
    expect(await activeSessionId()).toBe(id);

    await waitForTextIn(id, '— restarted', 10000);
    expect(await readBufferOf(id)).toContain('— restarted');
  });
});
