// SEAM B — alt-screen + mouse-mode-safe frame reset at the restart + abnormal-exit
// seams (Plan 06.1-02; supersedes the Plan 06-04 term.reset() behavior).
//
// A kept-alive xterm can be stuck in the alternate-screen buffer AND/OR have mouse
// tracking left hot if a TUI (vim/less/claude --rc) was killed without sending its own
// rmcup / mouse-disable. SessionView SEAM B handles two seams (D-07/D-13):
//   - RESTART (second 'running' transition): write MOUSE_RESET (disable every mouse-
//     tracking + encoding mode — D-13) and, ONLY when actually in the alternate buffer,
//     \x1b[?1049l (exit alt-screen, preserve primary scrollback — D-07), then the
//     "— restarted —" separator. NEVER a full terminal reset. We assert prior primary-
//     screen scrollback SURVIVES ≥3 restarts (D-07) and mouseTrackingMode reads 'none'
//     after a restart (D-13).
//   - ABNORMAL EXIT (status 'exited'/'error' from a crash/kill, NOT a user stop):
//     MOUSE_RESET + \x1b[?1049l (scrollback-PRESERVING — RESEARCH Open Q1) so a frozen
//     alt-screen frame never survives the reopen AND the scroll-wheel scrolls the buffer
//     instead of garbling as `[%30/]` mouse-report bytes (D-13). We assert the alt-screen
//     frame marker is GONE after the kill and the wheel scrolls the buffer.
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
  clickByTestId,
  activeSessionId,
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

describe('Alt-screen + mouse-mode reset on restart + abnormal exit smoke (SEAM B — D-07/D-13, Plan 06.1-02)', () => {
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

  it('repeated Restart (≥3×) preserves primary-screen scrollback every time (D-07 — MOUSE_RESET + gated 1049l, never RIS)', async () => {
    await clickAddSession();
    const id = await lastSessionId();
    await clickSidebarRow(id);

    // Lay down a distinctive PRIMARY-screen scrollback marker we expect to SURVIVE
    // EVERY restart (SEAM B preserves the primary buffer — D-07 — and gates the
    // alt-screen exit on actually being in the alternate buffer so a plain-shell
    // restart never toggles/trims it; it NEVER calls a full terminal reset which
    // would wipe it).
    const keep = `KEEP_${Date.now()}`;
    await sendKeysTo(id, `echo ${keep}`);
    await browser.keys(['Enter']);
    await waitForTextIn(id, keep, 10000);

    // D-07 fix: the previous suite only restarted twice. Restart ≥3 times and assert
    // the marker survives ALL of them (a cumulative scrollback trim would drop it by
    // the 3rd restart).
    const RESTARTS = 3;
    for (let i = 0; i < RESTARTS; i++) {
      const before = await ptyPidOf(id);
      expect(before).toBeGreaterThan(0);
      await clickByTestId('header-restart');
      await browser.waitUntil(
        async () => {
          const n = await ptyPidOf(id);
          return n > 0 && n !== before;
        },
        {
          timeout: 15000,
          timeoutMsg: `Restart #${i + 1} did not yield a new ptyPid`,
        },
      );
      expect(await activeSessionId()).toBe(id);
      // The marker must still be present after THIS restart (asserted every iteration,
      // not just at the end).
      await waitForTextIn(id, keep, 10000);
    }

    await waitForTextIn(id, '— restarted', 10000);
    const buf = await readBufferOf(id);
    expect(buf).toContain('— restarted'); // the separator painted on the clean primary screen
    expect(buf).toContain(keep); // …and the prior scrollback SURVIVED all N restarts (D-07)
  });

  it('restart resets mouse-tracking mode to none (D-13 — a TUI that turned mouse reporting ON does not leave the wheel hot)', async () => {
    await clickAddSession();
    const id = await lastSessionId();
    await clickSidebarRow(id);

    // Make the session live + interactive first.
    const marker = `MOUSEON_${Date.now()}`;
    await sendKeysTo(id, `echo ${marker}`);
    await browser.keys(['Enter']);
    await waitForTextIn(id, marker, 10000);

    // Turn ON button-event mouse tracking (\x1b[?1002h) — what an alt-screen TUI does.
    // printf emits the raw DECSET into the PTY → xterm interprets it → mouseTrackingMode
    // becomes non-'none'. We assert it actually engaged before restarting.
    await sendKeysTo(id, `printf '\\033[?1002h'`);
    await browser.keys(['Enter']);
    await browser.waitUntil(
      async () => (await mouseTrackingModeOf(id)) !== 'none',
      {
        timeout: 10000,
        timeoutMsg: 'mouse tracking never engaged after \\x1b[?1002h',
      },
    );

    // Header-Restart kills + respawns under the same logical id. SEAM B writes
    // MOUSE_RESET on the restart's 'running' transition → mouseTrackingMode must read
    // 'none' (the killed TUI never sent its own mouse-disable; D-13).
    const before = await ptyPidOf(id);
    await clickByTestId('header-restart');
    await browser.waitUntil(
      async () => {
        const n = await ptyPidOf(id);
        return n > 0 && n !== before;
      },
      { timeout: 15000, timeoutMsg: 'Restart did not yield a new ptyPid' },
    );
    await browser.waitUntil(
      async () => (await mouseTrackingModeOf(id)) === 'none',
      {
        timeout: 10000,
        timeoutMsg: 'mouseTrackingMode was not reset to none after restart (D-13)',
      },
    );
    expect(await mouseTrackingModeOf(id)).toBe('none');
  });

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
