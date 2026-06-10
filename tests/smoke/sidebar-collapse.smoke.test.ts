// Wave 0 RED E2E smoke stub (04-01 Task 1) — covers NAV-01/02 the collapsible
// sidebar: collapsing hides the per-row name but keeps the icon + status dot so a
// session stays identifiable in the narrow rail (D-11).
//
// INTENTIONALLY FAILS RED until plan 04 wires the collapse toggle + `.sidebar.collapsed`
// rules. The Phase-3 build this boots has no `[data-testid="sidebar-collapse"]`, so
// the assertions below cannot pass. When 04-04 lands, this goes GREEN.
//
// Test shape (NAV-01/02):
//   1. Add a session so a row exists.
//   2. Toggle collapse.
//   3. Assert the `.sidebar` has the `.collapsed` class, the row `.row-name` is
//      hidden (offsetParent === null), and the `.row-icon` + status dot remain
//      visible (the rail stays identifiable — D-11).

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import { clickAddSession, toggleCollapse } from './helpers/xterm-driver';

/** data-session-id of the first sidebar row. */
async function firstSessionId(): Promise<string> {
  return browser.execute(() => {
    const row = document.querySelector<HTMLElement>('.sidebar-row[data-session-id]');
    return row?.getAttribute('data-session-id') ?? '';
  });
}

/** Whether the sidebar currently carries the `.collapsed` class. */
async function isCollapsed(): Promise<boolean> {
  return browser.execute(() => {
    const sb = document.querySelector('.sidebar');
    return sb?.classList.contains('collapsed') ?? false;
  });
}

/** Visibility flags for a row's name / icon / status dot. */
async function rowVisibility(
  id: string,
): Promise<{ nameVisible: boolean; iconVisible: boolean; dotVisible: boolean }> {
  return browser.execute((sid: string) => {
    const row = document.querySelector<HTMLElement>(
      `.sidebar-row[data-session-id="${sid}"]`,
    );
    const vis = (sel: string): boolean => {
      const el = row?.querySelector<HTMLElement>(sel);
      return !!el && el.offsetParent !== null;
    };
    return {
      nameVisible: vis('.row-name'),
      iconVisible: vis('.row-icon'),
      dotVisible: vis('.status-dot'),
    };
  }, id);
}

describe('Sidebar collapse smoke (NAV-01/02, D-11)', () => {
  it('collapsing hides the row name but keeps the icon + status dot', async () => {
    await clickAddSession();
    const id = await firstSessionId();

    await toggleCollapse();

    await browser.waitUntil(async () => isCollapsed(), {
      timeout: 3000,
      timeoutMsg: 'Sidebar did not enter the collapsed state after toggle',
    });

    const vis = await rowVisibility(id);
    expect(vis.nameVisible).toBe(false); // name hidden in the rail
    expect(vis.iconVisible).toBe(true); // icon stays (identifiable)
    expect(vis.dotVisible).toBe(true); // status dot stays
  });
});
