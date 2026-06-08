// RENDERER ONLY — the pure "optimistic running flip after a spawn/restart" reducer
// (WR-02). Extracted from the inline closures in SessionManager (handleStart /
// handleStartNoCmd / handleRestart) so the pid>0 guard is a SINGLE source of truth and
// unit-testable in the Node/Vitest env (mirrors session-add.ts / apply-status-event.ts;
// imports NOTHING from React or xterm).
//
// WR-02 (the defect): handleStart/handleStartNoCmd guard the optimistic write with
// `pid > 0` — a failed spawn returns pid -1 (SC2) and main has ALREADY broadcast status
// 'error' + the notice over onPtyStatus, so flipping the row to 'running' would CLOBBER
// the error card. handleRestart did the optimistic flip UNCONDITIONALLY: restart() →
// create() returns pid -1 on a failed respawn (bad cwd / synchronous spawn throw) and
// broadcasts 'error', but the unconditional optimistic 'running' write raced — and could
// land AFTER the error broadcast — resurrecting a session that is actually errored.
//
// THE FIX: both the Start and Restart paths route their optimistic flip through this
// helper, which applies the running flip ONLY when pid > 0. On a failed spawn (pid <= 0)
// the rows pass through UNCHANGED, so the onPtyStatus error broadcast is the sole driver.

import type { SessionRecord } from '../shared/types';
import type { AgentState } from '../shared/agent-state';

/** The renderer-only row shape (mirrors SessionManager's SessionRow / StatusRow). */
export type SpawnRow = SessionRecord & {
  errorMessage?: string;
  agentState?: AgentState;
};

/**
 * Apply the optimistic "running" flip for a freshly-spawned/restarted session.
 *
 *   - pid <= 0 (failed spawn — SC2): return `rows` UNCHANGED. Main has already
 *     broadcast 'error' + the notice over onPtyStatus; the optimistic write must NOT
 *     clobber that error card (WR-02). This is the inverse-guard handleStart already had.
 *   - pid > 0 (real pty): flip the matching row to { ptyPid, status: 'running' } and
 *     clear any stale errorMessage so a prior error overlay does not linger. The
 *     onPtyStatus subscription then keeps the row live.
 *
 * Pure + immutable: returns a new array only when a row actually changes.
 */
export function optimisticRunningFlip(
  rows: readonly SpawnRow[],
  id: SessionRecord['logicalId'],
  pid: number,
): SpawnRow[] {
  if (pid <= 0) return rows as SpawnRow[]; // failed spawn → do NOT clobber the error card
  return rows.map((row) =>
    row.logicalId === id
      ? { ...row, ptyPid: pid, status: 'running', errorMessage: undefined }
      : row,
  );
}
