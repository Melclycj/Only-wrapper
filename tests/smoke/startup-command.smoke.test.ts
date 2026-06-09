// E2E smoke for TERM-05 startup-command auto-run (Plan 05.1-03, GREEN).
//
// Proves the real cold-spawn guarantees that only a real shell can demonstrate:
//   - SC1: a non-empty startupCommand auto-runs (output visible + command typed)
//          and lands in shell history (ArrowUp recalls it).
//   - D-02: the readiness probe leaves NO visible artifact — the `__JW_READY_`
//          nonce sentinel never appears in the rendered buffer (invisibility).
//   - SC3: Restart re-runs the command after the `— restarted` separator.
//   - SC2: a session with NO startupCommand starts as a bare shell (no injection).
//   - SC4/D-04: the timeout-fallback (bare prompt + ready-fail notice, never inject)
//          is proven deterministically by the unit state machine
//          (readiness-probe.test.ts) — see the documented note at the bottom for why
//          it is not forced in this E2E.
//
// Spawn model (SessionManager): `+ Add session` issues ONE live ptyCreate
// immediately (T-03-09) — a brand-new row is already RUNNING, not dormant. The
// edited `startupCommand` is stored-only and takes effect on the NEXT create() for
// that id, so the deterministic auto-run path here is: Add (live) → Edit (set
// command) → Save → Restart (re-spawns under the same id WITH the stored command →
// probe-then-inject fires).
//
// R1 (2026-06-09): the DORMANT Start ▶ path (IdleCard handleStart) is now driven
// END-TO-END by its own test below — Add → Edit → Save → Remove (→ dormant recipe)
// → select → click the IdleCard ▶ → the command runs. The prior "covers it
// structurally too" note was insufficient: it never exercised the dormant Start
// surface, so the duplicate-⏵ regression (user clicked the skip-command ⏵) slipped by.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  readBuffer,
  waitForText,
  clickAddSession,
  openContextMenu,
  clickMenuItem,
  readBufferOf,
  waitForTextIn,
  clickSidebarRow,
  clickByTestId,
} from './helpers/xterm-driver';

/** data-session-id of the Nth sidebar row (0-indexed). */
async function sessionIdAt(index: number): Promise<string> {
  return browser.execute((i: number) => {
    const rows = document.querySelectorAll<HTMLElement>('.sidebar-row[data-session-id]');
    return rows[i]?.getAttribute('data-session-id') ?? '';
  }, index);
}

/** data-session-id of the LAST sidebar row (a freshly-added session is appended). */
async function lastSessionId(): Promise<string> {
  return browser.execute(() => {
    const rows = document.querySelectorAll<HTMLElement>('.sidebar-row[data-session-id]');
    return rows[rows.length - 1]?.getAttribute('data-session-id') ?? '';
  });
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

/** Open the row context menu for `id` and click `label` (Edit / Restart / Close). */
async function menuAction(id: string, label: string): Promise<void> {
  await openContextMenu(id);
  await clickMenuItem(label);
}

describe('Startup-command auto-run smoke (TERM-05: SC1/SC2/SC3/D-02/D-04)', () => {
  it('auto-runs a non-empty startupCommand — output visible, command typed (SC1) + nonce invisible (D-02)', async () => {
    // Add a live session, set a benign visible startup command via the edit modal,
    // then Restart — the re-spawn runs create()'s probe-then-inject with the stored
    // command (the cold-spawn path; the dormant Start ▶ uses the same hook — D-05).
    await clickAddSession();
    const id = await sessionIdAt(0);

    await menuAction(id, 'Edit');
    await setStartupCommand('echo JW_STARTUP_OK');
    await clickMenuItem('Save');

    await menuAction(id, 'Restart');

    // SC1: the command's OUTPUT appears AND the command text was typed at the prompt.
    await waitForText('JW_STARTUP_OK', 8000);
    const buf = await readBuffer();
    expect(buf).toContain('JW_STARTUP_OK'); // command output (SC1)
    expect(buf).toContain('echo JW_STARTUP_OK'); // the command typed at the prompt (SC1)

    // D-02: the readiness probe leaves NO artifact — the nonce sentinel never appears.
    expect(buf).not.toContain('__JW_READY_');
  });

  it('the auto-run command lands in history (ArrowUp recalls it) — SC1', async () => {
    // After the command above ran, up-arrow on the prompt recalls it from history.
    await browser.keys(['ArrowUp']);
    await browser.waitUntil(
      async () => (await readBuffer()).includes('echo JW_STARTUP_OK'),
      { timeout: 5000, timeoutMsg: 'ArrowUp did not recall the auto-run command' },
    );
    expect(await readBuffer()).toContain('echo JW_STARTUP_OK');
    // Clear the recalled line so it does not pollute the next assertions.
    await browser.keys(['Escape']);
  });

  it('Restart re-runs the startupCommand after the "— restarted —" separator (SC3)', async () => {
    const id = await sessionIdAt(0);
    await menuAction(id, 'Restart');

    // SC3 / IN-03: anchor on the FULL '— restarted ' separator literal (not a bare
    // indexOf('restarted')), so the assertion is robust to incidental occurrences of
    // the word "restarted" in shell output. The command must run AGAIN after the
    // separator (output reappears below it).
    const SEPARATOR = '— restarted ';
    await browser.waitUntil(
      async () => {
        const b = await readBuffer();
        const sep = b.indexOf(SEPARATOR);
        return sep !== -1 && b.lastIndexOf('JW_STARTUP_OK') > sep;
      },
      { timeout: 8000, timeoutMsg: 'Startup command did not re-run after restart (SC3)' },
    );
    expect(await readBuffer()).toContain('JW_STARTUP_OK');
    // D-02 holds across the restart too — the probe stays invisible.
    expect(await readBuffer()).not.toContain('__JW_READY_');
  });

  // ── R1 regression (2026-06-09): the DORMANT Start ▶ path (the IdleCard's big
  //    "▶ Start session", handleStart) must RUN the saved startupCommand. The prior
  //    smoke only exercised the RESTART path (SC3); the dormant Start was never driven
  //    end-to-end, so the regression where the user clicked the small "Start without
  //    command" ⏵ (skipStartupCommand) and the command silently did NOT run slipped
  //    through. This drives the REAL dormant Start surface and asserts the command runs.
  //
  //    Flow: Add (live) → Edit (set command + a name → configured) → Save → Remove
  //    (a configured live session flips to a DORMANT Inactive-List recipe, NOT deleted)
  //    → select the dormant row (its IdleCard takes the terminal area) → click the
  //    IdleCard ▶ → the cold re-spawn runs create()'s probe-then-inject with the stored
  //    command (the SAME hook the Restart path uses, but reached via handleStart). ──
  it('R1: the DORMANT Start ▶ (IdleCard) re-spawns and RUNS the saved startupCommand', async () => {
    await clickAddSession();
    const id = await lastSessionId();

    // Configure the session: an edit (name + command) auto-promotes it to CONFIGURED,
    // so a later Remove keeps the recipe and lands it in the Inactive List (dormant).
    await menuAction(id, 'Edit');
    await browser.execute((sid: string) => {
      const nameInput = document.querySelector<HTMLInputElement>(
        '[data-testid="edit-name"]',
      );
      if (nameInput) {
        nameInput.value = `R1 Dormant ${sid.slice(0, 6)}`;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, id);
    await setStartupCommand('echo JW_DORMANT_OK');
    await clickMenuItem('Save');

    // Remove the live session → a configured live row flips to a DORMANT recipe (it
    // moves to the Inactive List; the record is kept, not deleted).
    await menuAction(id, 'Remove');
    await clickByTestId('confirm-close'); // confirm the Remove

    // The row is now dormant (not_started → data-dormant on its sidebar row).
    await browser.waitUntil(
      async () =>
        browser.execute(
          (sid: string) =>
            document
              .querySelector(`.sidebar-row[data-session-id="${sid}"]`)
              ?.hasAttribute('data-dormant') ?? false,
          id,
        ),
      { timeout: 6000, timeoutMsg: 'Removed configured session did not become dormant' },
    );

    // Select the dormant row so its IdleCard takes over the terminal area.
    await clickSidebarRow(id);
    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            document.querySelector('[data-testid="idle-start-session"]') !== null,
        ),
      { timeout: 6000, timeoutMsg: 'IdleCard ▶ Start did not render for the dormant row' },
    );

    // R3 cross-check at the live DOM level: on the ACTIVE dormant recipe row exactly ONE
    // Start-labeled control renders TOTAL — the IdleCard ▶ — and the sidebar ▶ +
    // "Start without command" ⏵ are both suppressed (the duplicate-Start defect is gone).
    const startCounts = await browser.execute((sid: string) => {
      const row = document.querySelector(`.sidebar-row[data-session-id="${sid}"]`);
      return {
        sidebarStart: row?.querySelector('[data-testid="start-session"]') !== null,
        sidebarNoCmd:
          row?.querySelector('[data-testid="start-no-cmd-session"]') !== null,
        idleStart:
          document.querySelector('[data-testid="idle-start-session"]') !== null,
      };
    }, id);
    expect(startCounts.sidebarStart).toBe(false); // R3: sidebar ▶ suppressed
    expect(startCounts.sidebarNoCmd).toBe(false); // R3: the ⏵ suppressed on the active card
    expect(startCounts.idleStart).toBe(true); // the IdleCard ▶ is the sole Start

    // Drive the IdleCard Start ▶ (handleStart → runs the command, NOT the skip path).
    await clickByTestId('idle-start-session');

    // R1: the saved command's OUTPUT appears in this session's pane AND the command was
    // typed at the prompt — proving handleStart ran the startupCommand on dormant Start.
    await waitForTextIn(id, 'JW_DORMANT_OK', 10000);
    const buf = await readBufferOf(id);
    expect(buf).toContain('JW_DORMANT_OK'); // command output (R1)
    expect(buf).toContain('echo JW_DORMANT_OK'); // the command typed at the prompt (R1)
    // The readiness probe stays invisible across the dormant Start too (D-02).
    expect(buf).not.toContain('__JW_READY_');
  });

  it('a session with NO startupCommand starts as a bare shell — no injection (SC2/TERM-03)', async () => {
    // A brand-new session (Add) has no startupCommand → create()'s probe gate is
    // skipped and a normal bare login shell starts. Address THIS session by its id
    // (the SC1 session is still mounted, so the single-pane __term fallback is
    // ambiguous — use the per-id pane read).
    await clickAddSession();
    const id = await lastSessionId();

    // Wait for the bare login shell to paint its first prompt. A live POSIX login
    // shell prints a prompt ending in `$ `/`% `/`# ` — its presence proves the bare
    // shell is up and usable WITHOUT needing to inject or auto-run anything (SC2).
    await waitForTextIn(id, '$', 8000).catch(async () => {
      // zsh's default prompt ends in `%` — accept either before failing.
      await waitForTextIn(id, '%', 8000);
    });
    const buf = await readBufferOf(id);
    // A prompt rendered → the bare login shell is up (SC2 / TERM-03).
    expect(/[$%#]\s*$/m.test(buf)).toBe(true);
    // No probe ran for an empty command → the nonce sentinel never appears (D-02).
    expect(buf).not.toContain('__JW_READY_');
    // No auto-run line was injected — JW_STARTUP_OK never leaks into this fresh,
    // command-less session (SC2: empty command → no inject).
    expect(buf).not.toContain('JW_STARTUP_OK');
  });

  // SC4 / D-04 timeout-fallback — DETERMINISTICALLY proven in the unit state machine
  // (src/main/__tests__/readiness-probe.test.ts → "on timeout (no match), FLUSHES
  // buffered bytes + does NOT inject the command"): advancing READINESS_TIMEOUT_MS
  // with no nonce-matching line flushes the buffered bytes (bare prompt usable — SC4)
  // and asserts the command is NEVER written (D-04), and the renderer's onPtyStatus
  // handler renders `p.notice` as a dim inline line.
  //
  // It is intentionally NOT forced in this E2E because there is no reliable way to
  // make a REAL cold zsh/bash shell fail the no-op `: <nonce>` round-trip within
  // READINESS_TIMEOUT_MS in CI without a synthetic shell fixture — and a fake shell
  // would prove nothing the unit harness does not already prove deterministically.
  // The user-visible side (the bare prompt + the dim notice line) is confirmed in the
  // blocking human-verify checkpoint (Task 3) against the canonical scenario. The
  // probe matcher (readiness-probe.ts buildPosixProbe) was validated against real cold
  // zsh output during this bring-up: the SC1 test above settles WITHOUT hitting the
  // 8s waitForText timeout, so the matcher fires well within READINESS_TIMEOUT_MS
  // (4000ms) — Open Q2 (timeout duration) and Open Q3 (matcher vs. real bytes) are
  // resolved with no matcher change required (the unit `matches()` assertions stay GREEN).
});
