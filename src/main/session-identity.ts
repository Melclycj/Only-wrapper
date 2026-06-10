// MAIN-adjacent, electron-free + node-pty-free — the pure "does this session have
// IDENTITY (a recipe)?" predicate (06.1-04 FIX 4b). Kept in its own electron-free
// module (like shell-resolver) so the persist-policy rule is unit-testable in the
// plain Node/Vitest env.
//
// FIX 4b (persistence policy = IDENTITY/RECIPE — user decision, supersedes the
// original edit-only D-02): a session must PERSIST if it has identity, defined as ANY
// of:
//   - a non-empty startupCommand, OR
//   - a custom name (differs from the auto/default `Session N` name), OR
//   - a custom icon (differs from the default emoji), OR
//   - a non-default cwd (differs from the spawn-default home dir), OR
//   - a non-default shell (differs from the resolveShell() default).
//
// A bare blank `+ New` session — default name/icon/cwd/shell and no startupCommand —
// has NO identity and stays EPHEMERAL (never persists). The `configured` flag still
// means "the user explicitly edited metadata via the form" (updateProfile sets it);
// the PERSIST predicate is now "configured OR hasIdentity" so a recipe session created
// with a startupCommand/custom field — even WITHOUT a manual edit — is also kept.

import type { SessionRecord, SessionIconSpec } from '../shared/types';

/**
 * The default profile a bare `+ New` session is born with — supplied by the caller
 * (listConfiguredSessions resolves these from the SAME sources create() uses:
 * os.homedir() for cwd, resolveShell() for shell, the default emoji icon). Passing
 * them in (rather than importing os/shell-resolver here) keeps this module pure and
 * the predicate deterministically testable.
 */
export interface SessionDefaults {
  /** The default emoji icon a fresh session is given in create(). */
  icon: SessionIconSpec;
  /** The default cwd (os.homedir()) a no-cwd session spawns in. */
  cwd: string;
  /** The default shell (resolveShell().shell) a no-shell session spawns with. */
  shell: string;
}

/** The auto-name pattern a bare `+ New` session gets: "Session 1", "Session 2", … */
const AUTO_NAME_RE = /^Session \d+$/;

/** The bare fallback name create() uses when no name/prior name is present. */
const FALLBACK_NAME = 'Session';

function iconsEqual(a: SessionIconSpec, b: SessionIconSpec): boolean {
  return a.type === b.type && a.value === b.value;
}

/** Whether `name` is an auto-generated default name (not user-chosen identity). */
function isDefaultName(name: string): boolean {
  return name === FALLBACK_NAME || AUTO_NAME_RE.test(name);
}

/**
 * True when the session carries IDENTITY (a recipe worth persisting) — ANY of a
 * non-empty startupCommand, a custom name, a custom icon, a non-default cwd, or a
 * non-default shell. A bare blank `+ New` (all defaults, no command) → false.
 *
 * Pure: no I/O, no globals — `defaults` is supplied by the caller. Defensive on
 * optional fields (a missing cwd/shell is treated as "default", i.e. not identity).
 */
export function hasIdentity(
  record: SessionRecord,
  defaults: SessionDefaults,
): boolean {
  // A saved startup command is the strongest recipe signal.
  if ((record.startupCommand ?? '').trim().length > 0) return true;
  // A user-chosen (non-auto) name.
  if (!isDefaultName(record.name)) return true;
  // A custom icon (differs from the default emoji).
  if (!iconsEqual(record.icon, defaults.icon)) return true;
  // A non-default working directory (an empty/absent cwd is treated as default).
  if (record.cwd && record.cwd.length > 0 && record.cwd !== defaults.cwd) {
    return true;
  }
  // A non-default shell (an empty/absent shell is treated as default).
  if (record.shell && record.shell.length > 0 && record.shell !== defaults.shell) {
    return true;
  }
  return false;
}

/**
 * The PERSIST predicate (FIX 4b): a record is persisted if the user explicitly
 * configured it (the `configured` flag — set by updateProfile) OR it has identity
 * (a recipe). Pure; `defaults` supplied by the caller.
 */
export function shouldPersist(
  record: SessionRecord,
  defaults: SessionDefaults,
): boolean {
  return record.configured === true || hasIdentity(record, defaults);
}
