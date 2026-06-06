// Wave 0 RED E2E smoke scaffold for TERM-05 startup-command auto-run (Plan 05.1-01).
//
// INTENTIONALLY FAILS RED until Plans 02/03 implement the create() readiness-probe
// hook (probe-then-inject) AND a build ships it. The app this boots carries the
// `startupCommand` field stored-only (TERM-05 deferred through Phase 5), so a
// freshly-started session does NOT auto-run its command yet → the SC1 assertions
// below cannot pass. When Plans 02/03 land the probe hook + inject, these go GREEN
// and this banner is deleted.
//
// Covers (real cold spawn — the only place "no garble" + "lands in history" can be
// proven): SC1 (auto-run visible + history), D-02 (probe invisible — nonce absent),
// SC3 (restart re-runs), SC4/D-04 (timeout leaves a usable bare prompt).

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  readBuffer,
  waitForText,
  clickAddSession,
  openContextMenu,
  clickMenuItem,
} from './helpers/xterm-driver';

/** data-session-id of the Nth sidebar row (0-indexed). */
async function sessionIdAt(index: number): Promise<string> {
  return browser.execute((i: number) => {
    const rows = document.querySelectorAll<HTMLElement>('.sidebar-row[data-session-id]');
    return rows[i]?.getAttribute('data-session-id') ?? '';
  }, index);
}

/** Set the edit modal's startup-command field (`[data-testid="edit-startup"]`). */
async function setStartupCommand(value: string): Promise<void> {
  await browser.execute((v: string) => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="edit-startup"]',
    );
    if (input) {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, value);
}

/** Click a row control button by its data-testid for a given session id. */
async function clickRowControl(id: string, testid: string): Promise<void> {
  await browser.execute(
    (sid: string, tid: string) => {
      const row = document.querySelector<HTMLElement>(
        `.sidebar-row[data-session-id="${sid}"]`,
      );
      row?.querySelector<HTMLButtonElement>(`[data-testid="${tid}"]`)?.click();
    },
    id,
    testid,
  );
}

describe('Startup-command auto-run smoke (TERM-05: SC1/SC3/SC4/D-02/D-04)', () => {
  it('auto-runs a non-empty startupCommand on cold spawn — output visible, command typed (SC1)', async () => {
    // Create a session, then SET a benign visible startup command via the edit modal
    // (the session-edit.smoke.test.ts way), then Start it (cold spawn).
    await clickAddSession();
    const id = await sessionIdAt(0);

    await openContextMenu(id);
    await clickMenuItem('Edit');
    await setStartupCommand('echo JW_STARTUP_OK');
    await clickMenuItem('Save');

    // Start the (dormant) session — the cold spawn triggers probe-then-inject.
    await clickRowControl(id, 'start-session');

    // SC1: the command's OUTPUT appears AND the command text was typed at the prompt.
    await waitForText('JW_STARTUP_OK', 8000);
    const buf = await readBuffer();
    expect(buf).toContain('JW_STARTUP_OK'); // command output (SC1)
    expect(buf).toContain('echo JW_STARTUP_OK'); // the command typed at the prompt (SC1)

    // D-02: the readiness probe leaves NO artifact — the nonce sentinel never appears.
    expect(buf).not.toContain('__JW_READY_');
  });

  it('the auto-run command lands in history (ArrowUp recalls it) — SC1', async () => {
    // After the command above ran, up-arrow on the prompt recalls it.
    await browser.keys(['ArrowUp']);
    await browser.waitUntil(
      async () => (await readBuffer()).includes('echo JW_STARTUP_OK'),
      { timeout: 5000, timeoutMsg: 'ArrowUp did not recall the auto-run command' },
    );
    expect(await readBuffer()).toContain('echo JW_STARTUP_OK');
  });

  it('Restart re-runs the startupCommand after the "— restarted —" separator (SC3)', async () => {
    const id = await sessionIdAt(0);
    // Restart the running session (D-03a restart-identity half).
    await clickRowControl(id, 'restart-session');

    // SC3: after the restart separator, the command runs AGAIN (output reappears).
    await browser.waitUntil(
      async () => {
        const b = await readBuffer();
        return b.includes('restarted') && b.lastIndexOf('JW_STARTUP_OK') > b.indexOf('restarted');
      },
      { timeout: 8000, timeoutMsg: 'Startup command did not re-run after restart (SC3)' },
    );
    expect(await readBuffer()).toContain('JW_STARTUP_OK');
  });

  // SC4 / D-04 timeout-fallback (documented sketch — finalized in Plan 03 E2E bring-up):
  // A session whose readiness probe cannot settle within READINESS_TIMEOUT_MS must
  // leave a USABLE bare prompt (the buffered bytes are flushed) and surface the
  // ready-fail notice (reusing the onPtyStatus channel — decided in Plan 03), and it
  // must NOT garble or best-effort-inject. The deterministic timeout state machine is
  // proven in readiness-probe.test.ts; this E2E confirms the user-visible fallback:
  //
  //   it('timeout leaves a usable bare prompt + a ready-fail notice (SC4/D-04)', async () => {
  //     // Drive a session whose shell never echoes the nonce (Plan 03 fixture),
  //     // advance past READINESS_TIMEOUT_MS, then assert: a typed `echo BACK` round-trips
  //     // (prompt usable) AND the idle/notice surface shows the ready-fail hint AND
  //     // the saved command stays on the idle card.
  //   });
});
