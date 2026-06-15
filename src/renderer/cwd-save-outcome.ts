// RENDERER ONLY — the pure save-time cwd-drop reducer (12-09, GAP-12-E).
//
// Imports NOTHING from React, xterm, or electron — so the "did main DROP the submitted
// cwd?" decision unit-tests in the Node/Vitest env (mirrors validate-session-form.ts /
// merge-profiles.ts). Main's CR-01 isValidCwd stays the SOLE validator of record; this
// reducer adds NO existence check and NO IPC. It only COMPARES the cwd the user submitted
// against the cwd main actually persisted (re-read via the EXISTING listSessions, the path
// rehydrateProfiles already uses) — when they differ, main rejected the submission and kept
// the prior directory, so the renderer must surface that instead of closing silently.
//
// The drop-notice copy is FROZEN here (12-UI-SPEC §Copywriting) so the test asserts against
// the exported constant, not a duplicated literal.

/**
 * The fixed inline notice shown under the cwd field when main DROPPED a submitted cwd
 * (kept the prior directory). A literal — NO path interpolation (T-12-09-02: no sensitive
 * path detail leaks; rendered as a React text node, auto-escaped).
 */
export const CWD_DROPPED_NOTICE =
  "That folder doesn't exist — kept the previous directory";

/**
 * Decide whether main DROPPED the submitted cwd at save.
 *
 * True ONLY when a NON-EMPTY submitted cwd differs from the main-authoritative persisted
 * cwd — i.e. the user typed/picked a directory and main rejected it (CR-01 isValidCwd kept
 * the prior value). Returns false when:
 *   - the submission is empty/whitespace (never a false positive — the user changed nothing
 *     actionable; an unspecified cwd is the legitimate default path),
 *   - the submission equals the persisted value (main accepted it),
 *   - the persisted value is undefined while the submission is empty.
 *
 * A persisted value that is undefined while the submission is NON-EMPTY counts as a drop
 * (main never persisted the submitted directory). Trim-insensitive on both sides so a
 * whitespace-only delta is not reported as a drop (matches the form-submit semantics —
 * an accepted path round-trips equal after trimming).
 */
export function cwdWasDropped(
  submittedCwd: string,
  persistedCwd: string | undefined,
): boolean {
  const submitted = submittedCwd.trim();
  if (submitted.length === 0) return false;
  const persisted = (persistedCwd ?? '').trim();
  return submitted !== persisted;
}
