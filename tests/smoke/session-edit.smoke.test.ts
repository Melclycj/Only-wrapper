// Wave 0 RED E2E smoke stub (04-01 Task 1) — covers SESS-01/02/04 the edit flow
// via the context menu, asserting a LIVE name update WITHOUT a new logical id
// (identity is stable across an edit — IDENT-01).
//
// INTENTIONALLY FAILS RED until plans 02/03 wire the context menu + SessionEditModal.
// The Phase-3 build this boots has no `.context-menu` and no edit modal, so the
// assertions below cannot pass. When 04-02/03 land, this goes GREEN.
//
// Test shape (SESS-01/02/04):
//   1. Add a session; record its data-session-id.
//   2. Open the row's context menu (right-click) and click "Edit".
//   3. Change the name field to a known value; Save.
//   4. Assert the sidebar row's `.row-name` shows the new name LIVE and the row's
//      data-session-id is UNCHANGED (live edit, no respawn/no new identity).

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
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

/** Visible `.row-name` text for the row with `data-session-id === id`. */
async function rowName(id: string): Promise<string> {
  return browser.execute((sid: string) => {
    const row = document.querySelector<HTMLElement>(
      `.sidebar-row[data-session-id="${sid}"]`,
    );
    const name = row?.querySelector<HTMLElement>('.row-name');
    return (name?.textContent ?? '').trim();
  }, id);
}

/** Type a new name into the edit modal's name field (`[data-testid="edit-name"]`). */
async function setEditName(value: string): Promise<void> {
  await browser.execute((v: string) => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="edit-name"]',
    );
    if (input) {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, value);
}

describe('Session edit smoke (SESS-01/02/04)', () => {
  it('renames a session LIVE via the context menu, keeping the same logical id', async () => {
    await clickAddSession();
    const id = await sessionIdAt(0);

    await openContextMenu(id);
    await clickMenuItem('Edit');

    const newName = 'Renamed Session';
    await setEditName(newName);
    await clickMenuItem('Save'); // Save button shares the menu-item click contract

    await browser.waitUntil(async () => (await rowName(id)) === newName, {
      timeout: 3000,
      timeoutMsg: 'Sidebar row name did not update live after edit Save',
    });

    expect(await rowName(id)).toBe(newName);
    // Identity is stable across an edit (no respawn, no new id) — SESS-02.
    expect(await sessionIdAt(0)).toBe(id);
  });
});
