// SC3 / D-15 — alt-screen reset at the restart + abnormal-exit seams (Plan 06-04).
//
// Filled GREEN from the Wave 0 RED scaffold (Plan 06-01). A kept-alive xterm can be
// stuck in the alternate-screen buffer if a TUI (vim/less) was killed without a normal
// exit. SessionView handles two seams (D-15):
//   - RESTART (second 'running' transition): write \x1b[?1049l to EXIT the alt-screen
//     while PRESERVING primary-screen scrollback (Phase-3 D-03), then the "— restarted —"
//     separator. We assert prior primary-screen scrollback SURVIVES the restart.
//   - ABNORMAL EXIT (status 'exited'/'error' from a crash/kill, NOT a user stop): full
//     term.reset() (RIS) so a frozen alt-screen frame from a killed TUI never survives the
//     reopen. We assert the alt-screen frame marker is GONE after the kill.
//
// We drive the alternate screen portably via the raw DECSET escape \x1b[?1049h (the same
// sequence vim/less use via terminfo smcup) rather than depending on vim being installed
// and timing its startup — the SC3 behavior under test is the terminal-frame reset, which
// is escape-sequence-driven, not vim-specific.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  waitForTextIn,
  readBufferOf,
  ensureSession,
  clickAddSession,
  clickSidebarRow,
  sendKeysTo,
  clickByTestId,
  activeSessionId,
  ptyPidOf,
  killProcess,
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

describe('Alt-screen reset on restart + abnormal exit smoke (SC3 — Plan 06-04)', () => {
  before(async () => {
    await ensureSession();
  });

  it('abnormal exit resets a stuck alt-screen frame (killed TUI → clean frame, no remnants)', async () => {
    await clickAddSession();
    const id = await lastSessionId();
    await clickSidebarRow(id);

    // Establish a PRIMARY-screen marker first so we know the session is live + interactive.
    const primary = `PRIMARY_${Date.now()}`;
    await sendKeysTo(id, `echo ${primary}`);
    await browser.keys(['Enter']);
    await waitForTextIn(id, primary, 10000);

    // Enter the ALTERNATE screen (DECSET 1049h — what vim/less do via smcup) and paint a
    // distinctive frame marker there, then block so the process stays alive with the
    // alt-screen frame "stuck" (a killed vim never sends rmcup). printf is portable.
    const frame = `ALTFRAME_${Date.now()}`;
    await sendKeysTo(id, `printf '\\033[?1049h${frame}\\n'; sleep 60`);
    await browser.keys(['Enter']);
    await waitForTextIn(id, frame, 10000);
    expect(await readBufferOf(id)).toContain(frame);

    // Kill the PTY process ABNORMALLY (SIGKILL — a crash, NOT a user Close). The live
    // SessionView sees onPtyExit + an 'exited'/'error' status → term.reset() (RIS).
    const pid = await ptyPidOf(id);
    expect(pid).toBeGreaterThan(0);
    await killProcess(pid);

    // After the abnormal-exit reset the stuck alt-screen frame marker is GONE (the frame
    // was reset, not left frozen) and the exit notice paints on the clean primary screen.
    await waitForTextIn(id, '[process exited]', 10000);
    const buf = await readBufferOf(id);
    expect(buf).toContain('[process exited]');
    expect(buf).not.toContain(frame); // the alt-screen remnant did not survive (SC3)
  });

  it('restart exits the alt-screen but PRESERVES primary-screen scrollback (\\x1b[?1049l, not reset)', async () => {
    await clickAddSession();
    const id = await lastSessionId();
    await clickSidebarRow(id);

    // Lay down a distinctive PRIMARY-screen scrollback marker we expect to SURVIVE the
    // restart (the surgical \x1b[?1049l preserves the primary buffer — D-03 — unlike a
    // full reset() which would wipe it).
    const keep = `KEEP_${Date.now()}`;
    await sendKeysTo(id, `echo ${keep}`);
    await browser.keys(['Enter']);
    await waitForTextIn(id, keep, 10000);

    const before = await ptyPidOf(id);
    expect(before).toBeGreaterThan(0);

    // Restart #1 arms the hasRunBefore seam (the initial 'running' is broadcast before
    // SessionView's subscription binds — same behavior the header/startup smokes rely on).
    await clickByTestId('header-restart');
    await browser.waitUntil(
      async () => {
        const n = await ptyPidOf(id);
        return n > 0 && n !== before;
      },
      { timeout: 15000, timeoutMsg: 'Restart #1 did not yield a new ptyPid' },
    );
    const afterFirst = await ptyPidOf(id);

    // Restart #2 fires the SC3 restart seam: \x1b[?1049l (exit any alt-screen, preserve
    // scrollback) THEN the "— restarted —" separator.
    await clickByTestId('header-restart');
    await browser.waitUntil(
      async () => {
        const n = await ptyPidOf(id);
        return n > 0 && n !== afterFirst;
      },
      { timeout: 15000, timeoutMsg: 'Restart #2 did not yield a new ptyPid' },
    );
    expect(await activeSessionId()).toBe(id);

    await waitForTextIn(id, '— restarted', 10000);
    const buf = await readBufferOf(id);
    expect(buf).toContain('— restarted'); // the separator painted on the clean primary screen
    expect(buf).toContain(keep); // …and the prior scrollback SURVIVED (D-03 preserved, SC3)
  });
});
