// SEAM B — alt-screen + mouse-mode-safe frame reset at the ABNORMAL-EXIT seam
// (Plan 06.1-02; supersedes the Plan 06-04 term.reset() behavior).
//
// A kept-alive xterm can be stuck in the alternate-screen buffer AND/OR have mouse
// tracking left hot if a TUI (vim/less/claude --rc) was killed without sending its own
// rmcup / mouse-disable. SessionView SEAM B handles this on:
//   - ABNORMAL EXIT (status 'exited'/'error' from a crash/kill, NOT a user stop):
//     MOUSE_RESET + \x1b[?1049l (scrollback-PRESERVING — RESEARCH Open Q1) so a frozen
//     alt-screen frame never survives the reopen AND the scroll-wheel scrolls the buffer
//     instead of garbling as `[%30/]` mouse-report bytes (D-13). We assert the alt-screen
//     frame marker is GONE after the kill and the wheel scrolls the buffer.
//
// NOTE (Phase 11 — SESS-07 / D-01 / D-05): SEAM B ALSO runs on the in-place RESTART
// 'running' transition (MOUSE_RESET + gated \x1b[?1049l + the "— restarted —" separator),
// but Phase 11 removed every restart UI entry point (sidebar ↻ + context-menu Restart).
// That seam machinery is KEPT but un-surfaced (D-01 "remove the UI, keep the mechanism"),
// so it is no longer reachable from any user action and cannot be driven from an E2E. The
// two restart-driving it-blocks that exercised it were removed in lockstep with the UI
// deletion (Plan 11-01). The recycle path (Remove → Inactive List → Start ▶) spawns a
// FRESH process which by design writes NO separator — covered by app-restart-restore.smoke
// + startup-command.smoke. The abnormal-exit coverage below is unaffected.
//
// We drive the alternate screen + mouse tracking portably via the raw DECSET escapes
// \x1b[?1049h / \x1b[?1002h (the same sequences vim/less/claude use) rather than
// depending on a specific TUI being installed — the behavior under test is the
// terminal-frame + mouse-mode reset, which is escape-sequence-driven, not TUI-specific.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  waitForTextIn,
  readBufferOf,
  ensureSession,
  clickAddSession,
  clickSidebarRow,
  sendKeysTo,
  ptyPidOf,
  killProcess,
  mouseTrackingModeOf,
  viewportYOf,
  scrollViewportUp,
  bufferTypeOf,
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

describe('Alt-screen + mouse-mode reset on abnormal exit smoke (SEAM B — D-07/D-13, Plan 06.1-02; restart-seam coverage retired in Plan 11-01 — restart UI removed)', () => {
  before(async () => {
    await ensureSession();
  });

  it('abnormal exit exits a stuck alt-screen frame back to the primary buffer (killed TUI → normal buffer, exit notice paints — D-13)', async () => {
    await clickAddSession();
    const id = await lastSessionId();
    await clickSidebarRow(id);

    // Establish a PRIMARY-screen marker first so we know the session is live + interactive.
    const primary = `PRIMARY_${Date.now()}`;
    await sendKeysTo(id, `echo ${primary}`);
    await browser.keys(['Enter']);
    await waitForTextIn(id, primary, 10000);

    // Enter the ALTERNATE screen (DECSET 1049h — what vim/less do via smcup), then block
    // so the process stays alive with the alt-screen "stuck" in the ALTERNATE buffer (a
    // killed vim never sends rmcup). We assert via buffer.active.type rather than a text
    // marker because SEAM B is now scrollback-PRESERVING (RESEARCH Open Q1 — no RIS), so
    // the primary buffer keeps the echoed command line; the meaningful signal is whether
    // the terminal is left STUCK in the alternate buffer or returned to the primary one.
    await sendKeysTo(id, `printf '\\033[?1049h'; sleep 60`);
    await browser.keys(['Enter']);
    await browser.waitUntil(
      async () => (await bufferTypeOf(id)) === 'alternate',
      {
        timeout: 10000,
        timeoutMsg: 'terminal never entered the alternate buffer',
      },
    );

    // Kill the PTY process ABNORMALLY (SIGKILL — a crash, NOT a user Close). The live
    // SessionView sees onPtyExit + an 'exited'/'error' status → SEAM B writes
    // MOUSE_RESET + ALT_SCREEN_EXIT (scrollback-preserving — never RIS).
    const pid = await ptyPidOf(id);
    expect(pid).toBeGreaterThan(0);
    await killProcess(pid);

    // After the abnormal-exit seam the terminal is back on the PRIMARY (normal) buffer —
    // the stuck alt-screen frame did NOT survive — and the exit notice paints there.
    await waitForTextIn(id, '[process exited]', 10000);
    await browser.waitUntil(
      async () => (await bufferTypeOf(id)) === 'normal',
      {
        timeout: 10000,
        timeoutMsg: 'terminal stayed in the alternate buffer after the kill (D-13)',
      },
    );
    expect(await bufferTypeOf(id)).toBe('normal'); // exited the alt-screen, not frozen
    expect(await readBufferOf(id)).toContain('[process exited]');
    expect(await mouseTrackingModeOf(id)).toBe('none'); // mouse released (D-13)
  });

  // NOTE (Plan 11-01): the two restart-seam it-blocks that previously lived here
  // ("repeated Restart ≥3× preserves scrollback" and "restart resets mouse-tracking to
  // none") drove the in-place restart via the context-menu Restart item. Phase 11
  // (SESS-07 / D-01) removed every restart UI entry point, so that seam is no longer
  // reachable from any user action and cannot be exercised in an E2E. The seam MACHINERY
  // is kept (D-01 "remove the UI, keep the mechanism") but is now dead at the UI surface.
  // The MOUSE_RESET + scrollback-preserving \x1b[?1049l logic is still covered below via
  // the ABNORMAL-EXIT half of SEAM B (the same write path, triggered by a kill instead of
  // a restart). The recycle path's no-separator fresh spawn is proven by
  // app-restart-restore.smoke + startup-command.smoke.

  it('scroll-wheel scrolls the buffer after a killed alt-screen + mouse-tracking TUI (D-13 — no [%30/] garble)', async () => {
    await clickAddSession();
    const id = await lastSessionId();
    await clickSidebarRow(id);

    // Produce enough scrollback that there is somewhere to scroll UP to, then enter the
    // alternate screen AND enable mouse tracking — exactly the state a killed vim/claude
    // leaves behind (a TUI that never sends rmcup or its mouse-disable). seq fills the
    // primary buffer; the printf turns on alt-screen + button-event mouse tracking and
    // blocks so the process is alive with mouse mode HOT.
    const tag = `WHEEL_${Date.now()}`;
    await sendKeysTo(id, `seq 1 200; echo ${tag}`);
    await browser.keys(['Enter']);
    await waitForTextIn(id, tag, 10000);

    await sendKeysTo(id, `printf '\\033[?1049h\\033[?1002h'; sleep 60`);
    await browser.keys(['Enter']);
    await browser.waitUntil(
      async () => (await mouseTrackingModeOf(id)) !== 'none',
      {
        timeout: 10000,
        timeoutMsg: 'mouse tracking never engaged in the alt-screen TUI',
      },
    );

    // Kill the PTY abnormally (SIGKILL) — the live SessionView's SEAM B abnormal-exit
    // path writes MOUSE_RESET + ALT_SCREEN_EXIT (scrollback-preserving). After this the
    // wheel must scroll xterm's own buffer, not be encoded as mouse-report bytes.
    const pid = await ptyPidOf(id);
    expect(pid).toBeGreaterThan(0);
    await killProcess(pid);
    await waitForTextIn(id, '[process exited]', 10000);
    await browser.waitUntil(
      async () => (await mouseTrackingModeOf(id)) === 'none',
      {
        timeout: 10000,
        timeoutMsg: 'mouseTrackingMode not reset to none after kill (D-13)',
      },
    );

    // Roll the wheel UP over the terminal (via xterm's native viewport-scroll path —
    // see scrollViewportUp). With mouse tracking OFF (asserted above), xterm scrolls its
    // OWN buffer → viewportY decreases. If the wheel were still captured as a mouse
    // report it would be encoded as PTY bytes (and, the PTY being dead, dropped) and
    // viewportY would NOT move — the D-13 regression. The mouseTrackingMode==='none'
    // assertion above is the root-cause proof; this asserts the observable consequence.
    const beforeY = await viewportYOf(id);
    expect(beforeY).toBeGreaterThan(0); // there is scrollback to scroll up into
    await scrollViewportUp(id, 20);
    await browser.waitUntil(
      async () => (await viewportYOf(id)) < beforeY,
      {
        timeout: 5000,
        timeoutMsg:
          'wheel did not scroll the xterm buffer (viewportY unchanged) — mouse mode may still be hot (D-13)',
      },
    );
    expect(await viewportYOf(id)).toBeLessThan(beforeY);

    // And no SGR mouse-report garble leaked into the rendered buffer (the `[%30/]`
    // symptom is mangled `\x1b[<…M` mouse-report bytes echoed by the shell).
    const buf = await readBufferOf(id);
    expect(buf).not.toMatch(/\[<\d+;\d+;\d+[Mm]/); // no raw SGR mouse report
    expect(buf).not.toContain('[%30/'); // the reported garble signature
  });
});
