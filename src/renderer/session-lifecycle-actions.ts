// RENDERER ONLY — the pure Remove/Delete decision reducer (12-06, IN-02 extraction).
//
// Imports NOTHING from React / xterm / electron (mirrors session-close.ts) so the
// "which branch does confirmClose take?" decision is unit-testable in the Node/Vitest
// env, and so SessionManager.tsx sheds enough lines to stay < 800 once 12-06 adds the
// restart-to-apply prompt state/handlers.
//
// This is a BEHAVIOR-PRESERVING extraction of the predicate that confirmClose used to
// inline (SessionManager.confirmClose, the `isConfiguredLive` branch). The DECISION
// logic lives here; SessionManager keeps the React/IPC side effects (ptyStop/ptyClose +
// setState) and simply switches on the `kind` this returns.
//
// Two-bucket lifecycle (D-03/D-06):
//   • REMOVE a CONFIGURED LIVE session → kill the PTY, KEEP the recipe → Inactive List
//     (window.api.ptyStop + optimistic flip to not_started). kind: 'configured-remove'.
//   • REMOVE an EPHEMERAL live session OR DELETE a dormant one → permanent: main kills
//     any PTY AND drops the record (window.api.ptyClose + drop the row). kind:
//     'permanent-close'.

import type { LogicalId, SessionRecord } from '../shared/types';

/** The remove-mode the confirm modal was opened with (D-03/D-06). */
export type RemoveMode = 'remove' | 'delete';

/**
 * The decision result. `configured-remove` keeps the recipe (PTY stop + dormant flip);
 * `permanent-close` drops the record entirely (PTY close + row removal). confirmClose
 * executes the matching side effects.
 */
export type RemoveAction =
  | { kind: 'configured-remove' }
  | { kind: 'permanent-close' };

/**
 * Decide how to dispose of `row` for the given `removeMode`.
 *
 * Reproduces confirmClose's `isConfiguredLive` predicate byte-for-byte:
 *   isConfiguredLive =
 *     removeMode === 'remove' && row !== null && row.configured === true &&
 *     row.status !== 'not_started'
 *
 * A configured LIVE Remove keeps the recipe (`configured-remove`); everything else —
 * a Delete (always permanent, dormant target), or a Remove of an ephemeral/unconfigured
 * or already-dormant row — is a `permanent-close`.
 */
export function resolveRemoveAction(
  row: SessionRecord | null,
  removeMode: RemoveMode,
): RemoveAction {
  const isConfiguredLive =
    removeMode === 'remove' &&
    row !== null &&
    row.configured === true &&
    row.status !== 'not_started';
  return isConfiguredLive ? { kind: 'configured-remove' } : { kind: 'permanent-close' };
}

/**
 * The renderer row carries transient, never-persisted overlays (errorMessage/agentState)
 * on top of the authoritative SessionRecord. The lifecycle reducers below are generic over
 * this shape so they preserve those fields while transforming status/ptyPid.
 */
type LifecycleRow = SessionRecord & {
  errorMessage?: string;
  agentState?: unknown;
};

/**
 * REMOVE a configured live session (the `configured-remove` branch): flip `id` to dormant
 * (not_started) and drop the dead pid + stale overlays so the row lands in the Inactive
 * List as a clean restartable recipe. activeId is UNCHANGED (the active session stays
 * selected so the user sees where it went — its SessionView unmounts, the IdleCard takes
 * over). Pure — the caller issues window.api.ptyStop(id) alongside this.
 */
export function flipToDormant<T extends LifecycleRow>(
  sessions: T[],
  id: LogicalId,
): T[] {
  return sessions.map((r) =>
    r.logicalId === id
      ? {
          ...r,
          status: 'not_started' as const,
          ptyPid: undefined,
          agentState: undefined,
          errorMessage: undefined,
        }
      : r,
  );
}

/**
 * GAP-12-C (12-10 round 3) — the SINGLE source of truth for "a spawn just returned, fold
 * the {pid} result into the row the user acted on." Both handleStart (dormant ▶ Start) and
 * handleRestart ("Restart to apply?") call this so the two paths can NEVER diverge again —
 * the round-2 fix touched only handleRestart and left handleStart's pid<=0 unhandled, which
 * is the exact gap the operator hit ("after I start it just returned to home").
 *
 * Semantics:
 *   • pid > 0  → a REAL pty: optimistic flip to 'running', clear any stale errorMessage. The
 *     onPtyStatus subscription then keeps it live (existing behavior).
 *   • pid <= 0 → a FAILED spawn (a deleted-after-save / corrupt-store cwd reaching create()):
 *     main has ALREADY broadcast {status:'error', notice:'Working directory not found…'} over
 *     onPtyStatus. But that broadcast carries a `notice`, so applyStatusEvent's ITEM-4 guard
 *     keeps the row INFORMATIONAL (status unchanged) — on a dormant row that means it stays
 *     'not_started' and the IdleCard shows its DORMANT (Start) branch, hiding the captured
 *     error ("returned to home"). So the HANDLER owns the lifecycle flip here: set status to
 *     'error' and drop the dead pid. status:'error' makes the row a CARD (activeIsCard) AND
 *     trips the IdleCard error branch (isError = status==='error') so the captured message is
 *     SURFACED where the user acted. We do NOT clobber an errorMessage the notice already set
 *     (the `??` keeps a real "Working directory not found: …" if it landed first); a fallback
 *     literal covers the case where the pid<=0 reply wins the race against the notice push.
 *     This does NOT touch applyStatusEvent — the ITEM-4 notice-informational guard stays GREEN.
 */
export function resolveSpawnResult<T extends LifecycleRow>(
  row: T,
  result: { pid: number },
): T {
  if (result.pid > 0) {
    return { ...row, ptyPid: result.pid, status: 'running' as const, errorMessage: undefined };
  }
  // pid <= 0 — failed spawn: flip to a VISIBLE error card, drop the dead pid. Preserve a
  // notice-supplied errorMessage if one already landed; otherwise a generic literal so the
  // error card is never blank if the invoke reply beats the onPtyStatus notice push.
  return {
    ...row,
    status: 'error' as const,
    ptyPid: undefined,
    errorMessage:
      row.errorMessage ??
      "Couldn't start session — check the working directory and shell.",
  };
}
