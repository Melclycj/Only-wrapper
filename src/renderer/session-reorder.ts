// RENDERER ONLY — the pure drag-to-reorder reducer (NAV-04 / SC3 / D-08).
//
// Imports NOTHING from React or @dnd-kit so the "move + dense reindex" invariant
// is unit-testable in the Node/Vitest env (mirrors session-close.ts). The arrayMove
// is implemented inline here — @dnd-kit's arrayMove dependency is NOT added until
// Plan 05-04 (the reorder slice, where dnd-kit is gated behind a verify checkpoint).
//
// On drop, SessionManager calls reorder(sessions, fromId, toId) for the optimistic
// local update AND maps the result to {id, order} pairs for window.api.persistOrder
// → PtyManager.setOrder() → store.scheduleSave().

import type { LogicalId, SessionRecord } from '../shared/types';

/**
 * Move the row `fromId` to where `toId` currently sits (arrayMove semantics), then
 * reindex EVERY record's `order` densely 0..n-1 — no gaps, no duplicate `order`
 * values (Pitfall 6). Returns a NEW array of NEW record objects (immutable update).
 *
 * Unknown `fromId`/`toId` (defensive — the UI only ever drags a rendered row) →
 * the list is returned with `order` still reindexed densely (idempotent normalize).
 *
 * PURE — no React, no dnd-kit, no I/O. Unit-tested directly (session-reorder.test.ts).
 */
export function reorder(
  sessions: SessionRecord[],
  fromId: LogicalId,
  toId: LogicalId,
): SessionRecord[] {
  const next = [...sessions];
  const fromIndex = next.findIndex((s) => s.logicalId === fromId);
  const toIndex = next.findIndex((s) => s.logicalId === toId);
  if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
    // arrayMove (inline — no dnd-kit dependency yet): splice out, splice in.
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
  }
  // Dense reindex: order becomes the array position (0..n-1) for every row.
  return next.map((s, i) => ({ ...s, order: i }));
}
