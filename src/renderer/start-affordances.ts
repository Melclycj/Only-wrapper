// RENDERER ONLY — the pure "which Start affordances does a dormant entry render?" reducer
// (06.1-04 round 3, DEFECT C). The single source of truth shared by the Sidebar row and
// the IdleCard so the PRIMARY Start is rendered EXACTLY ONCE per dormant entry id.
//
// Imports NOTHING from React/xterm so the invariant is unit-testable in the Node/Vitest
// env (mirrors session-status.ts / session-close.ts; Phase 3 forbids adding test packages,
// so the DOM-render decision is modeled as a pure predicate).
//
// DEFECT C (the defect): for the ACTIVE not_started session BOTH primary Starts rendered —
// the sidebar Inactive-entry ▶ (.row-control-start, data-testid="start-session") AND the
// IdleCard large "▶ Start session" (.idle-start-button, data-testid="idle-start-session").
// Two copies of the SAME primary Start (distinct from the intentional "Start ▶" vs "Start
// without command ⏵" pair). The fix: render exactly ONE primary Start per dormant entry —
// the IdleCard owns it for the ACTIVE dormant row, and the sidebar ▶ is suppressed there;
// every NON-active dormant row keeps its sidebar ▶.

import type { SessionStatus } from '../shared/types';

/** The renderer-visible inputs the affordance decision keys on. */
export interface StartAffordanceInput {
  /** The row's current process status. */
  status: SessionStatus;
  /** Whether this row is the currently-active (selected) session. */
  isActive: boolean;
  /**
   * Whether the active session renders the in-place IdleCard (true when the active row is
   * `not_started` or `error` — SessionManager's `activeIsCard`). Only meaningful for the
   * active row; a non-active row never shows a card.
   */
  activeIsCard: boolean;
  /** The saved startup command, if any (drives the SEPARATE "Start without command" ⏵). */
  startupCommand?: string;
}

/** The resolved set of Start-related affordances for one row. */
export interface StartAffordances {
  /** Render the sidebar Inactive-entry ▶ primary Start for this row. */
  sidebarStart: boolean;
  /** Render the IdleCard "▶ Start session" primary Start for this row. */
  idleCardStart: boolean;
  /** Render the SEPARATE "Start without command" ⏵ (not a primary Start). */
  startNoCmd: boolean;
  /** How many PRIMARY Start affordances this row renders — MUST be ≤ 1 (DEFECT C). */
  primaryStartCount: number;
  /**
   * How many Start-LABELED controls this row renders TOTAL across the sidebar AND the
   * IdleCard — the sidebar ▶ + the "Start without command" ⏵ + the IdleCard ▶. For the
   * ACTIVE dormant row this MUST be exactly 1 (the IdleCard ▶) — R3 (2026-06-09): the
   * round-3 fix only deduped the PRIMARY ▶ and left the ⏵ co-rendering with the card, so
   * the user saw "two Start buttons of different size" and, clicking the small ⏵, hit the
   * skip-command path ("command not run on start", R1).
   */
  totalStartCount: number;
}

/**
 * Resolve the Start affordances for a single row.
 *
 * Rules:
 *   - A primary Start only exists for a DORMANT (`not_started`) row. A running row (or an
 *     `error` row, which shows the IdleCard Edit/Retry pair, not a primary Start) has none.
 *   - The ACTIVE dormant row → the IdleCard owns the single primary Start; the sidebar ▶
 *     is SUPPRESSED (DEFECT C — the two used to co-render).
 *   - A NON-active dormant row → the sidebar ▶ is the single primary Start (it has no card).
 *   - "Start without command" ⏵ is a SEPARATE affordance (dormant + a saved command); it is
 *     NOT counted in primaryStartCount. R3 (2026-06-09): it is ALSO suppressed on the ACTIVE
 *     dormant card row so that row collapses to exactly ONE Start-labeled control TOTAL — the
 *     IdleCard ▶ (handleStart → runs the saved command). A NON-active dormant recipe row keeps
 *     its sidebar ▶ + ⏵ pair (D-06), so it is NOT over-suppressed.
 */
export function startAffordances(input: StartAffordanceInput): StartAffordances {
  const dormant = input.status === 'not_started';
  // The IdleCard renders its primary "▶ Start session" only for the ACTIVE dormant row.
  // (For an active ERROR row the card shows Edit/Retry — not a primary Start.)
  const idleCardStart = dormant && input.isActive && input.activeIsCard;
  // The sidebar ▶ is the primary Start for every dormant row EXCEPT the active one whose
  // IdleCard already owns it — suppress the duplicate there (DEFECT C).
  const sidebarStart = dormant && !idleCardStart;
  // "Start without command" ⏵: a dormant row with a saved command — EXCEPT the active card
  // row, where the IdleCard ▶ is the sole Start surface (R3). Co-rendering the ⏵ there was
  // the "two Start buttons" defect AND, when clicked, the skip-command path (R1).
  const startNoCmd =
    dormant &&
    !idleCardStart &&
    (input.startupCommand ?? '').trim().length > 0;
  const primaryStartCount = (sidebarStart ? 1 : 0) + (idleCardStart ? 1 : 0);
  const totalStartCount = primaryStartCount + (startNoCmd ? 1 : 0);
  return {
    sidebarStart,
    idleCardStart,
    startNoCmd,
    primaryStartCount,
    totalStartCount,
  };
}
