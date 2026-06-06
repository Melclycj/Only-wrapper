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

import { clickAddSession } from './helpers/xterm-driver';

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

describe('Persistence smoke (SC1/SC2, D-13, Pitfall 1)', () => {
  it('lowdb loads in the BUILT app: the store file is created + parseable (Pitfall 1)', async () => {
    // The renderer auto-starts a session on boot (D-02) → ptyCreate → main create()
    // → store signal → debounced write. The store file's existence + valid JSON
    // proves `await import('lowdb')` resolved at runtime in the packaged app.
    const store = await waitForStore();
    expect(store.exists).toBe(true);
    expect(store.parsed).not.toBeNull();
    // The schema shape is intact (version number + sessions array) — a real lowdb write.
    expect(typeof store.parsed?.version).toBe('number');
    expect(Array.isArray(store.parsed?.sessions)).toBe(true);
  });

  it('a created session profile is written to the store file (SC1/SC2 round-trip)', async () => {
    // Snapshot the persisted session count, add a session, then assert the store
    // grew — the profile round-trips to disk (the debounce + signal path is real).
    const before = await waitForStore();
    const beforeCount = (before.parsed?.sessions ?? []).length;

    await clickAddSession();

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
});
