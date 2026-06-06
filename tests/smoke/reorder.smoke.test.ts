// Plan 05-04 drag-to-reorder persistence smoke (NAV-04 / SC3 / D-08, D-13).
//
// Proves the reorder VERTICAL SLICE end-to-end in the BUILT app: a new custom order is
// persisted to the on-disk store (the same `window.api.persistOrder` IPC the sidebar
// drag wires to → main VALIDATES each {id, order} → store.scheduleSave debounced write),
// and the persisted `sessions` reflect that dense order on disk.
//
// WHY the gesture is driven via the bridge, not a raw pointer drag: dnd-kit's pointer
// DnD is hard to drive deterministically over CDP within a single smoke session (see
// 05-VALIDATION.md "Manual-Only Verifications" — "Real pointer drag gesture"). Per the
// 05-04 plan, when WDIO cannot reliably drive the pointer DnD we assert the persisted
// order after exercising the SAME persistOrder bridge the drag invokes, and mark the
// pure drag gesture as a MANUAL phase-gate step. The reorder REDUCER (move + dense
// reindex, Pitfall 6) is unit-proven (session-reorder.test.ts); the persistOrder
// main-side validation is unit-proven; this smoke proves the persisted write lands.
//
// MANUAL (phase gate): drag the 3rd sidebar row above the 1st, quit, reopen → the new
// order persists (05-VALIDATION.md Manual-Only Verifications row 2). WDIO cannot drive a
// full quit/relaunch nor a deterministic pointer drag — this is the human reorder check.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import { clickAddSession } from './helpers/xterm-driver';

/**
 * Read the persistence store file from the MAIN process (mirrors persistence.smoke):
 * returns its path + whether it exists + its parsed contents (or null). Runs in main via
 * browser.electron.execute so it reads the SAME app.getPath('userData') the store wrote.
 */
async function readStore(): Promise<{
  path: string;
  exists: boolean;
  parsed: { version?: number; sessions?: { logicalId?: string; order?: number }[] } | null;
}> {
  return browser.electron.execute((electron) => {
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
      parsed: {
        version?: number;
        sessions?: { logicalId?: string; order?: number }[];
      } | null;
    };
  });
}

/** The current sidebar rows' logical ids, in DOM (render) order — which is saved order. */
async function rowIdsInDomOrder(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '.sidebar-row[data-session-id]',
      ),
    ).map((el) => el.getAttribute('data-session-id') ?? ''),
  );
}

/**
 * Drive the reorder through the SAME bridge the sidebar drag invokes: call
 * window.api.persistOrder with the supplied {id, order} entries from the RENDERER. This
 * exercises the real renderer→main→store path (main validates each entry — T-05-01 —
 * before the debounced write). Returns nothing; the persisted order is asserted by
 * reading the store file afterward.
 */
async function persistOrderViaBridge(
  orders: { id: string; order: number }[],
): Promise<void> {
  await browser.execute((entries: { id: string; order: number }[]) => {
    // window.api.persistOrder is the 17th bridge key (fire-and-forget send) — the EXACT
    // call SessionManager.handleReorder makes after the pure reorder() dense reindex.
    (
      window as unknown as {
        api: { persistOrder: (o: { id: string; order: number }[]) => void };
      }
    ).api.persistOrder(entries);
  }, orders);
}

describe('Reorder persistence smoke (NAV-04 / SC3 / D-08, D-13)', () => {
  it('a persisted custom order round-trips to the store file (the reorder slice)', async () => {
    // Ensure at least 3 sessions exist (one may already be restored from a prior spec's
    // shared userData store; add until there are ≥3 rows to reorder).
    let ids = await rowIdsInDomOrder();
    while (ids.length < 3) {
      await clickAddSession();
      await browser.waitUntil(
        async () => (await rowIdsInDomOrder()).length > ids.length,
        {
          timeout: 8000,
          interval: 200,
          timeoutMsg: 'a newly-added session row did not appear within 8000ms',
        },
      );
      ids = await rowIdsInDomOrder();
    }

    // Build a NEW dense order: move the LAST row to the front (the canonical "drag the
    // 3rd row above the 1st" gesture), keeping the rest in their relative order. This is
    // exactly the array the pure reorder() reducer would produce (move + dense 0..n-1).
    const moved = ids[ids.length - 1];
    const rest = ids.slice(0, ids.length - 1);
    const newDomOrder = [moved, ...rest];
    const orders = newDomOrder.map((id, index) => ({ id, order: index }));

    // Drive the persist through the real bridge (the drag's persistOrder call).
    await persistOrderViaBridge(orders);

    // The debounced write must land the new dense order on disk — and it must match the
    // intended order for EVERY moved id (validated main-side, T-05-01: a known id + a
    // finite order; a forged entry would have been a silent no-op).
    let store = await readStore();
    await browser.waitUntil(
      async () => {
        store = await readStore();
        if (!store.exists || store.parsed === null) return false;
        const persisted = store.parsed.sessions ?? [];
        // Assert the persisted order for our reordered ids matches the new dense order.
        return orders.every((entry) => {
          const rec = persisted.find((s) => s.logicalId === entry.id);
          return rec !== undefined && rec.order === entry.order;
        });
      },
      {
        timeout: 8000,
        interval: 200,
        timeoutMsg: `reordered dense order was not persisted to ${store.path} within 8000ms`,
      },
    );

    // Final assertion (explicit, post-wait): the moved row is persisted at order 0 and the
    // orders are dense 0..k-1 with no duplicates (Pitfall 6 — no two records share order).
    const persisted = (store.parsed?.sessions ?? []).filter((s) =>
      orders.some((o) => o.id === s.logicalId),
    );
    const movedRec = persisted.find((s) => s.logicalId === moved);
    expect(movedRec?.order).toBe(0);
    const persistedOrders = persisted
      .map((s) => s.order)
      .filter((o): o is number => typeof o === 'number');
    expect(new Set(persistedOrders).size).toBe(persistedOrders.length);
  });

  it('the sidebar exposes a drag handle on every row (UI-SPEC §5 affordance)', async () => {
    // The ⠿ drag handle telegraphs draggability; it is always in the DOM (CSS fades it in
    // on hover) so the affordance is assertable. Every sidebar row carries one — the
    // visible cue for the NAV-04 reorder surface.
    const rowCount = await browser.execute(
      () =>
        document.querySelectorAll('.sidebar-row[data-session-id]').length,
    );
    const handleCount = await browser.execute(
      () =>
        document.querySelectorAll(
          '.sidebar-row[data-session-id] .row-drag-handle',
        ).length,
    );
    expect(rowCount).toBeGreaterThan(0);
    expect(handleCount).toBe(rowCount);
  });
});
