// RENDERER ONLY — the pure restart-to-apply decision reducer (12-06, GAP-12-B).
//
// Imports NOTHING from React / xterm / electron (mirrors session-close.ts /
// session-edit.ts) so the "does a LIVE session need a Restart-to-apply prompt after
// Save?" invariant is unit-testable in the Node/Vitest env.
//
// Background (GAP-12-B): cwd/shell/startupCommand are "Applies on restart" fields, but
// Phase 11 (D-01) removed every restart UI — so after a Save those edits never took
// effect on a LIVE session. The operator decided (2026-06-15) to add a "Restart to
// apply?" prompt that fires AFTER Save when a LIVE session's launch fields changed. This
// reducer makes that decision; SessionManager performs the side effects (ptyRestart).
//
// A dormant / not_started / exited / error session does NOT prompt — its next Start
// already picks up the saved launch values, so no respawn-now is needed.

import type { LogicalId, SessionRecord, SessionStatus } from '../shared/types';

/** The three "Applies on restart" launch fields (D-02 restart half). */
export interface LaunchFields {
  cwd: string;
  shell: string;
  startupCommand: string;
}

/**
 * True iff ANY of the three launch fields differ between `before` and `after`.
 *
 * cwd and shell compare by exact string equality. startupCommand is TRIMMED before
 * comparing (mirroring updateProfile's WR-05 trim-at-persist semantics — main stores the
 * trimmed value), so a whitespace-only delta that main would normalize away does NOT
 * count as a change and never triggers a needless restart prompt.
 */
export function launchFieldsChanged(
  before: LaunchFields,
  after: LaunchFields,
): boolean {
  return (
    before.cwd !== after.cwd ||
    before.shell !== after.shell ||
    before.startupCommand.trim() !== after.startupCommand.trim()
  );
}

export interface RestartPromptInput {
  /** The edited session's CURRENT lifecycle status (read BEFORE the save persists). */
  status: SessionStatus;
  /** The launch fields as they were on the row before the edit. */
  before: LaunchFields;
  /** The launch fields the user just submitted. */
  after: LaunchFields;
}

/**
 * Decide whether a "Restart to apply?" prompt should appear after Save.
 *
 * Returns true iff the session is LIVE (`status === 'running'`) AND a launch field
 * actually changed. A non-running session (not_started / stopped / exited / error)
 * never prompts: its next Start spawns from the freshly-saved values, so there is
 * nothing to apply-now.
 */
export function needsRestartPrompt(input: RestartPromptInput): boolean {
  return (
    input.status === 'running' &&
    launchFieldsChanged(input.before, input.after)
  );
}

/**
 * Convenience for the save call site: given the PRE-save `row` (or null) and the just-
 * submitted launch `after` fields, return the row's logicalId iff it should prompt, else
 * null. Captures the before-fields off the row so SessionManager.handleSaveProfile stays a
 * one-liner (the row must be read BEFORE ptyUpdateProfile/rehydrate overwrite it).
 */
export function restartPromptIdFor(
  row: SessionRecord | null,
  after: LaunchFields,
): LogicalId | null {
  if (row === null) return null;
  const should = needsRestartPrompt({
    status: row.status,
    before: {
      cwd: row.cwd,
      shell: row.shell,
      startupCommand: row.startupCommand ?? '',
    },
    after,
  });
  return should ? row.logicalId : null;
}
