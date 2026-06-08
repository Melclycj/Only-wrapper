// App-restart restore → Inactive List, first Start has NO separator (Plan 06.1-04, D-08).
//
// D-08 has two guarantees, and this smoke proves BOTH against the REAL built app + a REAL
// PTY:
//   (A) PERSISTENCE: a CONFIGURED session is written to the persistence store, so a
//       relaunch would restore it. We assert the configured record lands on disk under
//       app.getPath('userData') (the same proof the persistence smoke uses). On the next
//       boot main's hydrate()+coerceOnLoad turns that record into a dormant `not_started`
//       Inactive-List entry (unit-proven in store-schema / pty-lifecycle).
//   (B) NO SEPARATOR ON A DORMANT FIRST START: a dormant Inactive-List entry's FIRST
//       Start spawns a fresh process under a brand-new SessionView (hasRunBefore=false),
//       so it must show NO "— restarted —" separator (that separator is reserved for the
//       IN-PLACE restart of a still-LIVE session — D-07). This is the "fresh terminal
//       prints — restarted —" bug, fixed.
//
// WHY NOT A LITERAL OS RELAUNCH: @wdio/electron-service hands each launch an EPHEMERAL
// Chromium temp userData dir and browser.reloadSession() drops the CDP bridge + fails to
// reconnect a relaunched session (ECONNREFUSED) — the documented "WDIO cannot drive a
// full quit/relaunch" limitation the persistence/reorder smokes also note. We therefore
// drive the SAME renderer code path that a restore produces: a configured session Removed
// from the Working Area lands in the Inactive List as a genuine dormant `not_started`
// entry — byte-identical in shape to a boot-restored record (coerced not_started, pid
// cleared) — and its first Start exercises exactly the dormant→live fresh-SessionView seam
// D-08 governs. The persistence half (A) is proven via the on-disk store. Together these
// cover D-08 end-to-end with real UI + real PTY; the literal quit/reopen is the
// human-verify checkpoint (Task 3).
//
// Deterministic waits only (browser.waitUntil) — no waitForTimeout/sleep.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  clickAddSession,
  clickByTestId,
  clickSidebarRow,
  readBufferOf,
  waitForTextIn,
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

/** Open the edit modal for the session row `id` (double-click the row). */
async function openEdit(id: string): Promise<void> {
  await browser.execute((sid: string) => {
    const row = document.querySelector<HTMLElement>(
      `.sidebar-row[data-session-id="${sid}"]`,
    );
    row?.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
    );
  }, id);
  await browser.waitUntil(
    async () =>
      browser.execute(
        () =>
          document.querySelector('[data-testid="session-edit-modal"]') !== null,
      ),
    { timeout: 5000, timeoutMsg: 'edit modal did not open' },
  );
}

/** Type `value` into the edit modal's name field (data-testid="edit-name"). */
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

/**
 * Whether the persisted store file (main process, app.getPath('userData')) contains a
 * session record whose name === `name`. Proves the configured record was written to disk
 * — i.e. it would be restored on the next launch (D-08 persistence half).
 */
async function persistedHasName(name: string): Promise<boolean> {
  return browser.electron.execute((electron, n: string) => {
    const nodeFs = process.getBuiltinModule(
      'node:fs',
    ) as typeof import('node:fs');
    const nodePath = process.getBuiltinModule(
      'node:path',
    ) as typeof import('node:path');
    const file = nodePath.join(
      electron.app.getPath('userData'),
      'just-wrapper-store.json',
    );
    if (!nodeFs.existsSync(file)) return false;
    try {
      const parsed = JSON.parse(nodeFs.readFileSync(file, 'utf8')) as {
        sessions?: { name?: string; configured?: boolean }[];
      };
      return (parsed.sessions ?? []).some(
        (s) => s.name === n && s.configured === true,
      );
    } catch {
      return false;
    }
  }, name);
}

/**
 * The data-session-id of the sidebar row whose .row-name text === `name`, scoped to a
 * section by its container testid ('working-area' | 'inactive-list'), or '' when absent.
 */
async function rowIdByNameInSection(
  name: string,
  sectionTestId: 'working-area' | 'inactive-list',
): Promise<string> {
  return browser.execute(
    (n: string, section: string) => {
      const container = document.querySelector<HTMLElement>(
        `[data-testid="${section}"]`,
      );
      if (!container) return '';
      const rows = Array.from(
        container.querySelectorAll<HTMLElement>('.sidebar-row[data-session-id]'),
      );
      const match = rows.find(
        (r) => (r.querySelector('.row-name')?.textContent ?? '').trim() === n,
      );
      return match?.getAttribute('data-session-id') ?? '';
    },
    name,
    sectionTestId,
  );
}

describe('App-restart restore → Inactive List + first Start has no separator smoke (D-08, Plan 06.1-04)', () => {
  it('a configured session persists + lands dormant in the Inactive List; its first Start shows NO "— restarted —" (D-08)', async () => {
    // 1) Create a live session and CONFIGURE it by editing its name (→ configured=true →
    //    it persists; D-02). A unique name lets us address this exact session amid the
    //    shared userData store.
    await clickAddSession();
    const liveId = await lastSessionId();
    expect(liveId).not.toBe('');

    const uniqueName = `RESTORE_${Date.now()}`;
    await openEdit(liveId);
    await setEditName(uniqueName);
    await clickByTestId('edit-save');

    // The renamed session is live in the Working Area under its new name.
    await browser.waitUntil(
      async () =>
        (await rowIdByNameInSection(uniqueName, 'working-area')) !== '',
      {
        timeout: 8000,
        timeoutMsg: 'configured session did not appear in the Working Area',
      },
    );

    // (A) PERSISTENCE half of D-08: the configured record is written to the on-disk store
    //     — so a relaunch WOULD restore it (the debounced write must land first).
    await browser.waitUntil(async () => persistedHasName(uniqueName), {
      timeout: 10000,
      interval: 200,
      timeoutMsg: `configured session "${uniqueName}" was not persisted to the store`,
    });

    // 2) REMOVE the live configured session → it lands in the Inactive List as a genuine
    //    dormant `not_started` entry (the same shape a boot-restore produces: pid cleared,
    //    status not_started). This is the restore-equivalent dormant state D-08 governs.
    await clickByTestId('header-remove'); // active session's header Remove
    // The ConfirmModal opens; its confirm button (data-testid="confirm-close") reads
    // "Remove" for a configured-live Remove. Wait for it, then confirm.
    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            document.querySelector('[data-testid="confirm-close"]') !== null,
        ),
      { timeout: 5000, timeoutMsg: 'Remove confirm modal did not open' },
    );
    expect(
      await browser.execute(
        () =>
          (
            document.querySelector('[data-testid="confirm-close"]')
              ?.textContent ?? ''
          ).trim(),
      ),
    ).toBe('Remove');
    await clickByTestId('confirm-close');

    // 3) The Removed configured session is now a dormant Inactive-List entry — NOT in the
    //    Working Area.
    let dormantId = '';
    await browser.waitUntil(
      async () => {
        dormantId = await rowIdByNameInSection(uniqueName, 'inactive-list');
        return dormantId !== '';
      },
      {
        timeout: 8000,
        timeoutMsg: `"${uniqueName}" did not move to the Inactive List after Remove`,
      },
    );
    expect(dormantId).not.toBe('');
    expect(await rowIdByNameInSection(uniqueName, 'working-area')).toBe('');

    // 4) Start the dormant entry. ROUND 3 (DEFECT C): selecting the dormant row makes it
    //    active → its in-place IdleCard renders, and the IdleCard's "▶ Start session" is the
    //    SINGLE primary Start for the active dormant row (the duplicate sidebar ▶ is now
    //    suppressed — exactly one primary Start per dormant entry). So Start via the IdleCard
    //    affordance (data-testid="idle-start-session"). A brand-new SessionView mounts
    //    (hasRunBefore=false) and spawns a FRESH process.
    await clickSidebarRow(dormantId);
    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            document.querySelector('[data-testid="idle-start-session"]') !== null,
        ),
      {
        timeout: 5000,
        timeoutMsg: 'IdleCard Start affordance did not render for the active dormant row',
      },
    );
    await clickByTestId('idle-start-session');

    // Wait for the freshly-spawned shell to paint a prompt so the buffer is populated.
    await waitForTextIn(dormantId, '$', 12000).catch(async () => {
      await waitForTextIn(dormantId, '%', 12000);
    });

    // (B) NO-SEPARATOR half of D-08: this FIRST Start of a dormant session must carry NO
    //     "— restarted " separator (the full literal — not a bare 'restarted' — so the
    //     check is robust to incidental shell output).
    const buf = await readBufferOf(dormantId);
    expect(buf).not.toContain('— restarted ');
  });
});
