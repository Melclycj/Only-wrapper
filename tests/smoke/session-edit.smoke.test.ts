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
  clickByTestId,
  setEditFieldByTestId,
  readEditFieldByTestId,
  hasTestId,
  ptyPidOf,
  waitForTextIn,
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

/** Whether the edit modal is currently mounted (`data-testid="session-edit-modal"`). */
async function editModalOpen(): Promise<boolean> {
  return hasTestId('session-edit-modal');
}

/** Open the edit modal for `id` via its context-menu → Edit, waiting until it mounts. */
async function openEdit(id: string): Promise<void> {
  await openContextMenu(id);
  await clickMenuItem('Edit');
  await browser.waitUntil(async () => editModalOpen(), {
    timeout: 3000,
    interval: 50,
    timeoutMsg: 'edit modal did not open after context-menu → Edit',
  });
}

describe('Session edit smoke (SESS-01/02/04)', () => {
  it('renames a session LIVE via the context menu, keeping the same logical id', async () => {
    await clickAddSession();
    const id = await sessionIdAt(0);

    await openEdit(id);

    const newName = 'Renamed Session';
    await setEditName(newName);
    await clickByTestId('edit-save'); // GAP-12-A: Save is driven by data-testid (not a context-menu item)

    await browser.waitUntil(async () => (await rowName(id)) === newName, {
      timeout: 3000,
      timeoutMsg: 'Sidebar row name did not update live after edit Save',
    });

    expect(await rowName(id)).toBe(newName);
    // Identity is stable across an edit (no respawn, no new id) — SESS-02.
    expect(await sessionIdAt(0)).toBe(id);
  });

  // SESS-05 (the automated half of SC2): the edit→Save→reopen cwd+startup ROUND-TRIP
  // on the running app. Proves main's persisted truth re-seeds the form on reopen —
  // ptyUpdateProfile persists the restart-applied fields, rehydrateProfiles re-reads
  // listSessions() through the tested mergeAuthoritativeProfiles reducer, and the modal's
  // seed effect rehydrates the inputs from session.cwd / session.startupCommand. The
  // native Browse… dialog is NOT automated here (that is the BLOCKING O-2 human gate).
  it('round-trips cwd + startup across edit → Save changes → reopen (SESS-05)', async () => {
    await clickAddSession();
    const id = await sessionIdAt(0);

    // A KNOWN absolute dir that exists on every host running the smoke (the harness's
    // own cwd) + a known startup string. CR-01 (main's cwd guard) accepts an existing
    // absolute path, so this round-trips through main's validation untouched.
    const knownCwd = process.cwd();
    const knownStartup = "echo 'sess05 round-trip'";

    await openEdit(id);
    await setEditFieldByTestId('edit-cwd', knownCwd);
    await setEditFieldByTestId('edit-startup', knownStartup);
    await clickByTestId('edit-save');

    // Save closes the modal (onSaveProfile → cancelEdit). Wait for the close so the
    // reopen below seeds from main's truth, not the stale in-flight form.
    await browser.waitUntil(async () => !(await editModalOpen()), {
      timeout: 3000,
      timeoutMsg: 'edit modal did not close after Save changes',
    });

    // Reopen the SAME row and assert the persisted values re-seeded the form. Poll the
    // reopen-and-read (no fixed timeout): rehydrateProfiles is async (listSessions IPC),
    // so the seeded value may land a tick after the modal mounts.
    await openEdit(id);
    await browser.waitUntil(
      async () => (await readEditFieldByTestId('edit-cwd')) === knownCwd,
      {
        timeout: 5000,
        interval: 100,
        timeoutMsg:
          'edit-cwd did not re-seed to the saved value after reopen (SESS-05 round-trip broken)',
      },
    );

    expect(await readEditFieldByTestId('edit-cwd')).toBe(knownCwd);
    expect(await readEditFieldByTestId('edit-startup')).toBe(knownStartup);
    // The round-trip preserved identity — same logical id, no respawn (SESS-02).
    expect(await sessionIdAt(0)).toBe(id);
  });

  // GAP-12-B (12-06): editing a LIVE session's launch field → Save → "Restart to apply?"
  // → Restart now MUST re-spawn the session (same logicalId, NEW ptyPid) and run the new
  // startup command. Proves the retained ptyRestart applies the edit (the feature the
  // operator expected — Phase 11 had removed every restart path).
  it('applies a changed startup command via Restart to apply (GAP-12-B)', async () => {
    await clickAddSession();
    const id = await sessionIdAt(0);
    // Record the initial ptyPid (main's source of truth) so we can prove a real respawn.
    const initialPid = await ptyPidOf(id);

    // A KNOWN startup command that prints a unique marker on the next launch, and a known
    // existing absolute cwd (process.cwd(), accepted by CR-01) so the restart succeeds.
    const marker = 'restart-apply-marker-12-06';
    await openEdit(id);
    await setEditFieldByTestId('edit-cwd', process.cwd());
    await setEditFieldByTestId('edit-startup', `echo '${marker}'`);
    await clickByTestId('edit-save');

    // Save closes the edit modal; the restart-to-apply prompt then appears (the session is
    // LIVE and a launch field changed).
    await browser.waitUntil(async () => !(await editModalOpen()), {
      timeout: 3000,
      timeoutMsg: 'edit modal did not close after Save changes',
    });
    await browser.waitUntil(async () => hasTestId('restart-apply-now'), {
      timeout: 3000,
      interval: 50,
      timeoutMsg:
        '"Restart to apply?" prompt did not appear after editing a LIVE launch field (GAP-12-B)',
    });

    // Restart now → ptyRestart re-spawns under the SAME logicalId with a NEW ptyPid.
    await clickByTestId('restart-apply-now');

    // (a) a real respawn — main reports a DIFFERENT ptyPid for the same logicalId.
    await browser.waitUntil(
      async () => {
        const pid = await ptyPidOf(id);
        return pid > 0 && pid !== initialPid;
      },
      {
        timeout: 8000,
        interval: 100,
        timeoutMsg:
          'ptyPid did not change after Restart now (expected a real respawn under the same logicalId)',
      },
    );
    expect(await ptyPidOf(id)).not.toBe(initialPid);

    // (b) the new startup command auto-ran on the restart — its marker is in the buffer.
    expect(await waitForTextIn(id, marker, 8000)).toBe(true);

    // Identity is stable across the restart — same logical id (IDENT-02).
    expect(await sessionIdAt(0)).toBe(id);
  });

  // GAP-12-B: "Later" dismisses the prompt WITHOUT restarting — the saved values still
  // persist (for the next Start), and the live PTY is untouched (same ptyPid, no respawn).
  it('Later dismisses the Restart-to-apply prompt without restarting (GAP-12-B)', async () => {
    await clickAddSession();
    const id = await sessionIdAt(0);
    const initialPid = await ptyPidOf(id);

    await openEdit(id);
    await setEditFieldByTestId('edit-cwd', process.cwd());
    await setEditFieldByTestId('edit-startup', "echo 'later-no-restart'");
    await clickByTestId('edit-save');

    await browser.waitUntil(async () => hasTestId('restart-apply-now'), {
      timeout: 3000,
      interval: 50,
      timeoutMsg: '"Restart to apply?" prompt did not appear (GAP-12-B Later case)',
    });

    // Click Later → the prompt closes and NO respawn happens.
    await clickByTestId('restart-apply-later');
    await browser.waitUntil(async () => !(await hasTestId('restart-apply-now')), {
      timeout: 3000,
      interval: 50,
      timeoutMsg: 'Restart-to-apply prompt did not close after clicking Later',
    });

    // The live PTY is untouched — same ptyPid, no respawn (IDENT-02 + no double-spawn).
    expect(await ptyPidOf(id)).toBe(initialPid);
    expect(await sessionIdAt(0)).toBe(id);
  });
});
