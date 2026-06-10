// RENDERER ONLY — the PURE per-row reducer behind SessionManager's onPtyStatus
// subscription (06.1-04 gap-closure round 2). Extracted from the inline closure in
// SessionManager.tsx so the FULL status-event handling — including the FIX 4a self-exit
// flip AND the stale-running-notice guard (ITEM 4) — is unit-testable in the Node env
// (apply-status-event.test.ts), not just the resolveRowStatus sub-reducer.
//
// Imports NOTHING from React or xterm.
//
// ITEM 4 (the "revert to Working Area after ~1s" defect): main's TERM-05 readiness
// timer can fire AFTER a recipe session has already self-exited (the child died before
// the probe settled), broadcasting a stale pty:status with status:'running' carried as
// a `notice` event. The OLD renderer handler passed a notice's status straight through
// (`resolved = p.notice ? p.status : ...`), so that stale 'running' RESURRECTED a row
// that had correctly moved to the Inactive List — sending it back to the Working Area.
//
// THE FIX (renderer half, defense-in-depth — main is also hardened so the stale event is
// never sent): a `notice` event is INFORMATIONAL ONLY and must NEVER drive a lifecycle
// transition. It may carry an errorMessage/agentState side effect, but it must NOT change
// the row's `status`. So the reducer keeps the row's CURRENT status on a notice event
// rather than adopting the notice's (possibly stale) status field.

import type { SessionRecord, SessionStatus } from '../shared/types';
import type { AgentState } from '../shared/agent-state';
import { resolveRowStatus } from './session-status';

/** The renderer-only row shape (mirrors SessionManager's SessionRow). */
export type StatusRow = SessionRecord & {
  errorMessage?: string;
  agentState?: AgentState;
};

/** The pty:status event fields this reducer consumes. */
export interface StatusEvent {
  status: SessionStatus;
  ptyPid?: number;
  notice?: string;
}

/**
 * Apply a pty:status `event` to `row`, returning the next row (immutable).
 *
 * Branches:
 *   - NOTICE event (informational, NON-lifecycle): NEVER changes `status`. It may set
 *     an errorMessage (only on an error notice) and preserves the agentState. This is
 *     the ITEM-4 guard — a stale 'running' notice can no longer resurrect a dormant row.
 *   - LIFECYCLE transition: resolveRowStatus applies the FIX 4a self-exit→Inactive flip
 *     for identity rows; on a move-to-Inactive we drop the dead pid + stale overlay so
 *     the Inactive-List entry is a clean restartable recipe. Otherwise the status passes
 *     through, capturing the error message on 'error' and clearing it on any transition
 *     away from 'error'; the agent overlay is cleared on any transition away from 'running'.
 */
export function applyStatusEvent(row: StatusRow, event: StatusEvent): StatusRow {
  // ── NOTICE event: informational only — NEVER a lifecycle transition (ITEM 4). ──
  // A notice (the TERM-05 ready-fail, or an SC2 spawn-error message) rides the same
  // onPtyStatus channel but its `status` field is the CURRENT live status, not a
  // transition. The OLD code adopted that status (`resolved = notice ? status : …`),
  // so a stale 'running' ready-fail notice — which main could send AFTER a recipe had
  // self-exited — resurrected a dormant row back into the Working Area. Keep the row's
  // OWN status; only an error notice updates the captured errorMessage. agentState is
  // preserved (a notice is not a lifecycle change, so the overlay must not be touched).
  if (event.notice) {
    if (event.status === 'error') {
      return { ...row, errorMessage: event.notice };
    }
    return row;
  }

  // ── LIFECYCLE transition ──
  // FIX 4a (round 1) + DEFECT A (round 3): an IDENTITY row's terminal non-running status
  // ('exited' | 'error' | 'stopped') is presented as 'not_started' (resolveRowStatus) so
  // it moves to the Inactive List immediately (matching the dormant record main moved it
  // to). 'stopped' was added in round 3: the configured-live Remove path issues ptyStop →
  // main broadcasts 'stopped', and without this the row reverted back to the Working Area.
  // On that move we drop the dead pid + stale error/overlay so the Inactive-List entry is a
  // clean restartable recipe. Otherwise the status passes through: capture the error
  // message on 'error', clear it on any transition away from 'error', and clear the agent
  // overlay on any transition away from 'running'.
  const errorMessage =
    event.status === 'error' ? event.notice ?? row.errorMessage : undefined;
  const agentState = event.status === 'running' ? row.agentState : undefined;
  const resolved = resolveRowStatus(row, event.status);
  // A move to the Inactive List is any resolution to 'not_started' from a row that was NOT
  // already dormant — covering BOTH the FIX 4a self-exit flip ('exited'/'error' → not_started
  // for an identity row) AND the DEFECT A removeLive broadcast (main sends 'not_started'
  // directly for the configured-live Remove). On that move we drop the dead pid + stale
  // error/overlay so the Inactive-List entry is a clean restartable recipe.
  const movedToInactive = resolved === 'not_started' && row.status !== 'not_started';
  if (movedToInactive) {
    return {
      ...row,
      status: 'not_started',
      ptyPid: undefined,
      errorMessage: undefined,
      agentState: undefined,
    };
  }
  return {
    ...row,
    status: resolved,
    ptyPid: event.ptyPid ?? row.ptyPid,
    errorMessage,
    agentState,
  };
}
