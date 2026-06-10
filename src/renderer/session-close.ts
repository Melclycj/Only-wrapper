// RENDERER ONLY — the pure destructive-close reducer (03-03 gap-closure, D-03a).
//
// Imports NOTHING from React or xterm so the "close removes exactly that row +
// reselects a valid active id" invariant is unit-testable in the Node/Vitest env
// (mirrors session-add.ts). SessionManager.confirmClose() calls window.api.ptyClose
// (the side effect) and then applies this PURE reducer to its (sessions, activeId).
//
// Main's close() permanently deletes the SessionRecord, so the reconcile poll never
// re-adds the closed id — the renderer just drops the row here.

import type { LogicalId, SessionRecord } from '../shared/types';

export interface CloseResult {
  sessions: SessionRecord[];
  activeId: LogicalId | null;
}

/**
 * Remove the session `id` from `sessions`. If it was the active row, reselect the
 * next remaining row (first of the post-removal list) — or null when none remain.
 * Closing a non-active row leaves `activeId` untouched. Unknown id → unchanged list
 * (defensive; the UI only ever closes a rendered row).
 */
export function closeSession(
  sessions: SessionRecord[],
  activeId: LogicalId | null,
  id: LogicalId,
): CloseResult {
  const next = sessions.filter((s) => s.logicalId !== id);
  if (activeId !== id) {
    return { sessions: next, activeId };
  }
  // The closed row WAS active — pick the next remaining row, or null if empty.
  const nextActive = next.length > 0 ? next[0].logicalId : null;
  return { sessions: next, activeId: nextActive };
}
