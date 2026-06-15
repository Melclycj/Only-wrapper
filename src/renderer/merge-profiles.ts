// RENDERER ONLY — the pure edit-prefill merge reducer (12-01, SESS-05).
//
// Imports ONLY ../shared/types (type-only) — no UI-framework or platform deps — so the
// authoritative-profile merge unit-tests in the Node/Vitest env (mirrors
// session-close.ts). Extracts the inline map from SessionManager.rehydrateProfiles
// (SessionManager.tsx:388-405): after a spawn or a save, main is the source of truth
// for the restart-applied fields (cwd/shell/startupCommand) — it VALIDATES/trims them
// (CR-01 + WR-05), so a submitted value may differ from what is actually persisted.
// Re-read window.api.listSessions() (no new bridge key) and merge the authoritative
// values back into the matching rows so the next edit-modal open prefills main's truth,
// not the optimistic local guess. The renderer-owned lifecycle fields are left exactly
// as-is here (they are owned by the onPtyStatus subscription, not by listSessions). No
// side effects: the caller (SessionManager) performs the setSessions.

import type { SessionRecord } from '../shared/types';

/**
 * Merge main's authoritative restart-fields back into renderer rows by logicalId.
 *
 * cwd/shell/startupCommand + configured adopt main's truth; the renderer-owned
 * lifecycle fields are left untouched (owned by onPtyStatus). Rows with no
 * authoritative match are returned unchanged (same reference — no clone). Pure —
 * caller does the setSessions.
 */
export function mergeAuthoritativeProfiles<T extends SessionRecord>(
  rows: readonly T[],
  authoritative: readonly SessionRecord[],
): T[] {
  const byId = new Map(authoritative.map((r) => [r.logicalId, r]));
  return rows.map((row) => {
    const truth = byId.get(row.logicalId);
    if (!truth) return row;
    return {
      ...row,
      cwd: truth.cwd,
      shell: truth.shell,
      startupCommand: truth.startupCommand,
      // Carry main's configured truth (D-02 — never downgrade a kept session).
      configured: truth.configured ?? row.configured,
    };
  });
}
