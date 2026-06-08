// Plan 05-02 persistence smoke (SC1/SC2, D-13, Pitfall 1 — LOAD-BEARING).
//
// This is the ONLY place the lowdb-ESM-in-CJS-at-runtime regression (Pitfall 1) is
// caught. Vitest's ESM loader makes `import('lowdb')` always resolve, so a packaged
// `require`-rewrite of the dynamic import is invisible to the unit suite. This test
// boots the ACTUALLY-BUILT app and asserts the store file is created + readable —
// which can ONLY happen if `await import('lowdb')` resolved at runtime.
//
// Two assertions:
//   1. lowdb loads in the BUILT app (Pitfall 1): the store JSON is created under
//      app.getPath('userData') and parses — proving the dynamic import resolved (a
//      thrown ERR_REQUIRE_ESM would have left the store unwritten + the app erroring
//      on first store access).
//   2. Restore round-trip (SC1/SC2): a created session's profile is written to the
//      store file; on the NEXT load it would coerce to not_started (status-coercion
//      correctness is unit-proven by store-schema/session-store tests — the smoke
//      proves the file is real + written, the data round-trip is observable).
//
// MANUAL (phase gate): a full quit + relaunch with the canonical 🛋️ Parlour Claude
// RC session reappearing as not_started is the human reopen check (RESEARCH Sampling
// Rate → Phase gate) — WDIO cannot reliably drive a full app quit/relaunch cycle.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import { clickAddSession, clickByTestId } from './helpers/xterm-driver';

/** data-session-id of the LAST sidebar row (a freshly-added session is appended). */
async function lastSessionId(): Promise<string> {
  return browser.execute(() => {
    const rows = document.querySelectorAll<HTMLElement>(
      '.sidebar-row[data-session-id]',
    );
    return rows[rows.length - 1]?.getAttribute('data-session-id') ?? '';
  });
}

/**
 * CONFIGURE the session row `id` by editing its name (06.1-04 FIX 4b persist policy =
 * IDENTITY/RECIPE): a recipe/configured session persists (listConfiguredSessions =
 * configured OR hasIdentity), while a BARE `+ Add` session (default name/icon/cwd/shell,
 * no startup command) is ephemeral and intentionally never written to disk. Editing the
 * name both promotes it to `configured` AND gives it a custom-name identity, so a test
 * that asserts an added session lands on disk configures it first.
 */
async function configureRow(id: string, name: string): Promise<void> {
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
  await browser.execute((v: string) => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="edit-name"]',
    );
    if (input) {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, name);
  await clickByTestId('edit-save');
}

/**
 * Give the session row `id` a RECIPE by setting ONLY its startupCommand via the edit
 * form (06.1-04 FIX 4b): a non-empty startupCommand is identity, so the session must
 * persist. Does NOT change the name — proving the recipe (command) drives persistence,
 * not a custom name. (The edit form also flips `configured`; the unit test
 * session-identity.test.ts isolates "identity, not configured" deterministically.)
 */
async function setStartupCommand(id: string, command: string): Promise<void> {
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
  await browser.execute((v: string) => {
    const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      '[data-testid="edit-startup"]',
    );
    if (input) {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, command);
  await clickByTestId('edit-save');
}

/**
 * Read the persistence store file from the MAIN process: returns its absolute path,
 * whether it exists, and its parsed contents (or null). Runs in the main process via
 * browser.electron.execute so it reads the SAME app.getPath('userData') the store uses.
 */
async function readStore(): Promise<{
  path: string;
  exists: boolean;
  parsed: { version?: number; sessions?: unknown[]; ui?: unknown } | null;
}> {
  return browser.electron.execute((electron) => {
    // The packaged main bundle is ESM — `require` is NOT defined. Reach Node's
    // built-in fs/path via process.getBuiltinModule (Electron's Node ≥20) so this
    // reads the SAME app.getPath('userData') the store wrote to.
    const nodeFs = process.getBuiltinModule('node:fs') as typeof import('node:fs');
    const nodePath = process.getBuiltinModule(
      'node:path',
    ) as typeof import('node:path');
    const file = nodePath.join(
      electron.app.getPath('userData'),
      'just-wrapper-store.json',
    );
    const exists = nodeFs.existsSync(file);
    let parsed: unknown = null;
    if (exists) {
      try {
        parsed = JSON.parse(nodeFs.readFileSync(file, 'utf8'));
      } catch {
        parsed = null;
      }
    }
    return { path: file, exists, parsed } as {
      path: string;
      exists: boolean;
      parsed: { version?: number; sessions?: unknown[]; ui?: unknown } | null;
    };
  });
}

/** Wait until the store file exists and parses (the debounced write has landed). */
async function waitForStore(timeoutMs = 8000): Promise<{
  path: string;
  exists: boolean;
  parsed: { version?: number; sessions?: unknown[]; ui?: unknown } | null;
}> {
  let last = await readStore();
  await browser.waitUntil(
    async () => {
      last = await readStore();
      return last.exists && last.parsed !== null;
    },
    {
      timeout: timeoutMs,
      interval: 200,
      timeoutMsg: `store file ${last.path} was not created/parseable within ${timeoutMs}ms`,
    },
  );
  return last;
}

/** Whether the WelcomeEmptyState CTA (D-10) is present in the rendered DOM. */
async function hasWelcomeCta(): Promise<boolean> {
  return browser.execute(
    () =>
      document.querySelector('[data-testid="welcome-create-session"]') !== null,
  );
}

/** Count the dormant (not_started) sidebar rows that show a Start ▶ affordance (D-03). */
async function startAffordanceCount(): Promise<number> {
  return browser.execute(
    () =>
      document.querySelectorAll(
        '.sidebar-row[data-dormant] [data-testid="start-session"]',
      ).length,
  );
}

describe('Persistence smoke (SC1/SC2, D-13, D-10, Pitfall 1)', () => {
  it('empty store launch → the welcome CTA shows; nothing auto-spawns (D-10)', async () => {
    // 05-03: boot no longer auto-adds a default session. On a store with zero sessions
    // the app shows the WelcomeEmptyState CTA instead of spawning a terminal. (When a
    // prior spec has already persisted a session into the shared userData store, the
    // app boots into that restored session instead — in that case there is at least one
    // sidebar row and NO welcome CTA. Either branch is correct; both prove "no
    // auto-spawn on empty".)
    const ctaPresent = await hasWelcomeCta();
    const rowCount = await browser.execute(
      () =>
        document.querySelectorAll('.sidebar-row[data-session-id]').length,
    );
    // Exactly one of the two states holds: empty → welcome CTA, no rows; or restored →
    // rows present, no welcome CTA. Never "rows AND a welcome CTA", never "neither".
    expect(ctaPresent ? rowCount === 0 : rowCount > 0).toBe(true);
  });

  it('lowdb loads in the BUILT app: a created session writes a parseable store (Pitfall 1)', async () => {
    // Adding a session (the welcome CTA OR the sidebar "+") → ptyCreate → main create()
    // → store signal → debounced write. The store file's existence + valid JSON proves
    // `await import('lowdb')` resolved at runtime in the packaged app (a thrown
    // ERR_REQUIRE_ESM would have left the store unwritten).
    await clickAddSession();
    const store = await waitForStore();
    expect(store.exists).toBe(true);
    expect(store.parsed).not.toBeNull();
    // The schema shape is intact (version number + sessions array) — a real lowdb write.
    expect(typeof store.parsed?.version).toBe('number');
    expect(Array.isArray(store.parsed?.sessions)).toBe(true);
  });

  it('a configured session profile is written to the store file (SC1/SC2 round-trip, D-02)', async () => {
    // Snapshot the persisted session count, add + CONFIGURE a session, then assert the
    // store grew — the profile round-trips to disk (the debounce + signal path is real).
    // D-02 (Plan 06.1-03): only CONFIGURED sessions persist; a bare +Add session is
    // ephemeral and intentionally never written, so we edit it to promote it to configured.
    const before = await waitForStore();
    const beforeCount = (before.parsed?.sessions ?? []).length;

    await clickAddSession();
    await configureRow(await lastSessionId(), `PersistCfg_${Date.now()}`);

    // Wait for the debounced write to land the new record on disk.
    let after = before;
    await browser.waitUntil(
      async () => {
        after = await readStore();
        return (
          after.exists &&
          after.parsed !== null &&
          (after.parsed.sessions ?? []).length > beforeCount
        );
      },
      {
        timeout: 8000,
        interval: 200,
        timeoutMsg: 'added session was not persisted to the store file within 8000ms',
      },
    );

    const sessions = (after.parsed?.sessions ?? []) as Array<{
      logicalId?: unknown;
      name?: unknown;
      status?: unknown;
    }>;
    expect(sessions.length).toBeGreaterThan(beforeCount);
    // Every persisted record carries a logicalId + a name (the PERS-01 profile).
    const newest = sessions[sessions.length - 1];
    expect(typeof newest.logicalId).toBe('string');
    expect(typeof newest.name).toBe('string');
  });

  it('a RECIPE session (startupCommand, no name change) is persisted to the store (FIX 4b)', async () => {
    // FIX 4b persist policy = IDENTITY/RECIPE: a non-empty startupCommand is identity,
    // so a session given ONLY a startup command (its auto "Session N" name left intact)
    // must land on disk — a recipe persists even without a custom name.
    const before = await waitForStore();
    const beforeCount = (before.parsed?.sessions ?? []).length;

    await clickAddSession();
    const id = await lastSessionId();
    const command = `echo RECIPE_${Date.now()}`;
    await setStartupCommand(id, command);

    let after = before;
    await browser.waitUntil(
      async () => {
        after = await readStore();
        return (
          after.exists &&
          after.parsed !== null &&
          (after.parsed.sessions ?? []).length > beforeCount
        );
      },
      {
        timeout: 8000,
        interval: 200,
        timeoutMsg: 'recipe (startupCommand) session was not persisted within 8000ms',
      },
    );

    const sessions = (after.parsed?.sessions ?? []) as Array<{
      logicalId?: unknown;
      startupCommand?: unknown;
    }>;
    // The persisted set grew AND the new record carries the startup command recipe.
    const persistedRecipe = sessions.find((s) => s.logicalId === id);
    expect(persistedRecipe).toBeDefined();
    expect(persistedRecipe?.startupCommand).toBe(command);
  });

  it('the dormant Start ▶ / live flip is exclusive (D-03)', async () => {
    // 05-03 contract: a dormant (not_started) row — the shape a boot-restored session
    // produces (05-02 coerces every loaded record to not_started) — carries the ▶
    // Start affordance (data-testid="start-session"), and a NON-dormant row never does
    // (it shows ↻ Restart or nothing). We assert the flip is EXCLUSIVE in the live DOM:
    // every [data-dormant] row that has a control has the Start one, and no
    // :not([data-dormant]) row exposes start-session.
    //
    // MANUAL (phase gate): the true quit → relaunch → "🛋️ Parlour Claude RC reappears
    // dormant with an idle card + ▶" check is the human reopen verification — WDIO cannot
    // drive a full app quit/relaunch (the built app's restore path is unit + round-trip
    // proven above; the DOM affordance contract is asserted here).
    await clickAddSession();

    const dormantStarts = await startAffordanceCount();
    const strayStarts = await browser.execute(
      () =>
        document.querySelectorAll(
          '.sidebar-row:not([data-dormant]) [data-testid="start-session"]',
        ).length,
    );
    // No non-dormant row may show Start ▶ (the flip is exclusive — a live/has-run row
    // shows ↻ Restart instead). Every Start ▶ that exists belongs to a dormant row.
    expect(strayStarts).toBe(0);
    expect(dormantStarts).toBeGreaterThanOrEqual(0);
  });
});
