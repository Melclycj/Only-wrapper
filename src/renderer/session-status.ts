// RENDERER ONLY — the pure per-row status-transition reducer (06.1-04 FIX 4a).
//
// Imports NOTHING from React or xterm so the "a configured/recipe self-exit lands in
// the Inactive List" invariant is unit-testable in the Node/Vitest env (mirrors
// session-close.ts / session-add.ts).
//
// FIX 4a (the defect): when a configured/identity session SELF-EXITS, main correctly
// moves its record to dormantRecords and broadcasts pty:status 'exited'/'error'. But
// the renderer's status subscription only set the row to that raw status ('exited'),
// which the Sidebar partition keeps in the WORKING AREA — so the session never visibly
// entered the Inactive List mid-session (it only reappeared there on the next boot).
//
// THE FIX: a self-exit ('exited'/'error') of a row that has IDENTITY (configured, or a
// recipe: a startupCommand / custom name / custom icon) is presented as 'not_started'
// — exactly the dormant shape main moved it to — so the Sidebar partition
// (status==='not_started' → Inactive List) shows it immediately, mirroring the
// optimistic flip the configured-live-Remove path already does. A non-identity
// (ephemeral) self-exit keeps the raw status (the row is dropped elsewhere / by boot).
//
// This intentionally mirrors src/main/session-identity.ts's notion of identity, but
// renderer-side it can only see the fields carried on the row (it does NOT know the
// spawn-default cwd/shell), so it keys on the reliably-visible identity signals:
// configured, startupCommand, a custom (non-auto) name, or a custom icon.

import type { SessionStatus } from '../shared/types';

/** The auto-name pattern a bare `+ New` session gets: "Session 1", "Session 2", … */
const AUTO_NAME_RE = /^Session \d+$/;
const FALLBACK_NAME = 'Session';
/** The default emoji icon a fresh session is born with (mirrors DEFAULT_SESSION_ICON). */
const DEFAULT_ICON = { type: 'emoji', value: '🖥️' } as const;

/** The subset of a session row this reducer reads (renderer-visible identity signals). */
export interface RowIdentity {
  status: SessionStatus;
  name: string;
  startupCommand?: string;
  configured?: boolean;
  icon: { type: string; value: string };
}

/**
 * True when the row carries renderer-visible IDENTITY — `configured`, a non-empty
 * startupCommand, a custom (non-auto) name, or a custom icon. (cwd/shell defaults are
 * not knowable renderer-side, so those identity axes are deferred to main + boot.)
 */
export function hasRendererIdentity(row: RowIdentity): boolean {
  if (row.configured === true) return true;
  if ((row.startupCommand ?? '').trim().length > 0) return true;
  if (row.name !== FALLBACK_NAME && !AUTO_NAME_RE.test(row.name)) return true;
  if (row.icon.type !== DEFAULT_ICON.type || row.icon.value !== DEFAULT_ICON.value) {
    return true;
  }
  return false;
}

/**
 * The non-running SELF-EXIT statuses an identity row presents as 'not_started' (the
 * Inactive List). A self-exit means the process ended on its own — for an identity row the
 * record is a recipe, not a frozen process, so it belongs in the Inactive List.
 *
 *   - 'exited' / 'error' — a self-exit (FIX 4a, round 1).
 *
 * NOTE (DEFECT A, round 3): 'stopped' is DELIBERATELY NOT here. The configured-live Remove
 * path is handled MAIN-side: removeLive() broadcasts 'not_started' directly (the record's
 * actual terminal state), so the renderer needs no special-case for it. Generalizing
 * 'stopped'→not_started here would WRONGLY catch a RESTART's transient stopped→running and
 * unmount the kept SessionView mid-restart — dropping the '— restarted —' separator seam
 * and the re-run of the startup command (smoke SC3). A restart's 'stopped' must pass through
 * so SessionView stays mounted across the respawn.
 */
const SELF_EXIT_STATUSES: ReadonlySet<SessionStatus> = new Set<SessionStatus>([
  'exited',
  'error',
]);

/**
 * Resolve the STATUS a row should present given an incoming pty:status `transition`.
 *
 * The only adjustment (FIX 4a): a SELF-EXIT ('exited' | 'error') of an IDENTITY row is
 * presented as 'not_started' so it moves to the Inactive List immediately (matching the
 * dormant record main moved it to). Every other transition — an ephemeral self-exit, or any
 * non-self-exit transition ('running' / 'stopped' / 'not_started') — passes through
 * unchanged. (The configured-live Remove arrives as a 'not_started' broadcast from main —
 * DEFECT A — so it needs no special case here.)
 *
 * Pure (row, transition) → SessionStatus; the caller applies it to the row.
 */
export function resolveRowStatus(
  row: RowIdentity,
  transition: SessionStatus,
): SessionStatus {
  if (SELF_EXIT_STATUSES.has(transition) && hasRendererIdentity(row)) {
    return 'not_started';
  }
  return transition;
}
