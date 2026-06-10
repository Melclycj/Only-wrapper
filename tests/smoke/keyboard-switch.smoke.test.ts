// Wave 0 RED E2E smoke stub (04-01 Task 1) — covers NAV-05 keyboard switching
// AND is the A1 PROOF (per 04-RESEARCH): it empirically confirms the Cmd/Ctrl+1-9
// chord drives the main-side before-input-event → session:switch → resolveSwitch
// path on the real Electron build.
//
// INTENTIONALLY FAILS RED until plans 02/03/04 wire the sidebar rows, the
// identity header, and the main-side before-input-event interceptor. The Phase-3
// build this boots has no `.identity-header` and no switch-key path, so the
// assertions below cannot pass. When 04-02..04 land, this goes GREEN.
//
// Test shape (NAV-05 / A1):
//   1. Add 2 sessions (so ≥2 rows exist).
//   2. Activate the first; record its data-session-id + identity-header text.
//   3. Press the position-2 chord (Cmd/Ctrl+2).
//   4. Assert the active data-session-id changed to the second row AND the
//      identity-header text changed (the switch is real, not a no-op).

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  clickAddSession,
  clickSidebarRow,
  pressSwitchChord,
  readIdentityHeader,
} from './helpers/xterm-driver';

/** data-session-id of the Nth sidebar row (0-indexed). */
async function sessionIdAt(index: number): Promise<string> {
  return browser.execute((i: number) => {
    const rows = document.querySelectorAll<HTMLElement>('.sidebar-row[data-session-id]');
    return rows[i]?.getAttribute('data-session-id') ?? '';
  }, index);
}

/** data-session-id of the currently-active sidebar row (`.sidebar-row.active`). */
async function activeSessionId(): Promise<string> {
  return browser.execute(() => {
    const row = document.querySelector<HTMLElement>('.sidebar-row.active[data-session-id]');
    return row?.getAttribute('data-session-id') ?? '';
  });
}

describe('Keyboard session switching smoke (NAV-05 / A1 proof)', () => {
  it('Cmd/Ctrl+2 switches the active session and updates the identity header', async () => {
    await clickAddSession();
    await clickAddSession();

    const first = await sessionIdAt(0);
    const second = await sessionIdAt(1);

    await clickSidebarRow(first);
    const headerBefore = await readIdentityHeader();
    expect(await activeSessionId()).toBe(first);

    // A1: the position-2 chord must reach main, preventDefault, and switch.
    await pressSwitchChord({ kind: 'position', index: 1 });

    await browser.waitUntil(async () => (await activeSessionId()) === second, {
      timeout: 3000,
      timeoutMsg: 'Cmd/Ctrl+2 did not switch the active session to the 2nd row',
    });

    expect(await activeSessionId()).toBe(second);
    expect(await readIdentityHeader()).not.toBe(headerBefore);
  });
});
