// RENDERER ONLY — the pure status-summary count aggregation (GAP-11-A, Phase 11).
//
// Imports NOTHING from React/xterm so the aggregation invariant is unit-testable in the
// Node/Vitest env (mirrors session-status.ts / start-affordances.ts / session-close.ts —
// the established "pure reducer, React-free" precedent). The StatusSummary.tsx component
// renders the result; this module owns the WHAT (the counts), not the HOW (the pills).
//
// The mockup (.planning/design/rendered/switchboard-ide-view.png) shows a slim top strip
// aggregating live session counts by status: "2 Waiting · 5 Running · 2 Done · 1 Idle".
// We group by the SAME presentation language status-colors.ts already speaks (D-03), so the
// pill colors/labels are not re-derived here — this module only COUNTS; StatusSummary maps
// each group to presentation()'s accent.

import type { SessionStatus } from '../shared/types';
import type { AgentState } from '../shared/agent-state';

/** The four aggregation groups shown in the top strip (mockup order). */
export type StatusGroup = 'waiting' | 'running' | 'done' | 'idle';

/** The renderer-visible per-row inputs the aggregation keys on (a subset of SessionRow). */
export interface SummaryRow {
  status: SessionStatus;
  /** The renderer-only agent-state overlay (TERM-09 / D-06) — only meaningful while running. */
  agentState?: AgentState;
}

/** One aggregated group: which group, its live count, and its presentation status seed. */
export interface StatusGroupCount {
  group: StatusGroup;
  count: number;
  /** Human label shown in the pill (mockup: Waiting / Running / Done / Idle). */
  label: string;
  /**
   * The (status, agent) pair StatusSummary feeds to presentation() so the pill's accent is
   * drawn from the EXISTING status ramp — never re-derived (D-03). 'waiting' carries the
   * agent overlay; the rest are pure process statuses.
   */
  presentationStatus: SessionStatus;
  presentationAgent?: AgentState;
}

/**
 * Resolve which summary GROUP a single row falls into:
 *   - waiting → a running session whose agent overlay is 'waiting' (amber, highest signal).
 *   - running → any other running session (in-progress / free / no overlay yet) — blue.
 *   - done    → a cleanly-exited session ('exited' = Finished) — green.
 *   - idle    → a dormant or stopped session ('not_started' / 'stopped') — slate.
 *   - error   → 'error' rows are NOT summarized (they surface via the IdleCard error branch,
 *               not the top strip); they fall through to `null` and are omitted.
 *
 * Pure (row) → group | null; the caller tallies the non-null groups.
 */
export function rowGroup(row: SummaryRow): StatusGroup | null {
  if (row.status === 'running') {
    return row.agentState === 'waiting' ? 'waiting' : 'running';
  }
  if (row.status === 'exited') return 'done';
  if (row.status === 'not_started' || row.status === 'stopped') return 'idle';
  // 'error' → omitted (surfaced elsewhere).
  return null;
}

/** The fixed display order + label + presentation seed for each group (mockup order). */
const GROUP_META: ReadonlyArray<{
  group: StatusGroup;
  label: string;
  presentationStatus: SessionStatus;
  presentationAgent?: AgentState;
}> = [
  { group: 'waiting', label: 'Waiting', presentationStatus: 'running', presentationAgent: 'waiting' },
  { group: 'running', label: 'Running', presentationStatus: 'running' },
  { group: 'done', label: 'Done', presentationStatus: 'exited' },
  { group: 'idle', label: 'Idle', presentationStatus: 'not_started' },
];

/**
 * Aggregate a session list into ORDERED per-group counts, OMITTING zero-count groups
 * (an empty/zero group is hidden in the strip — mockup shows only the live counts).
 *
 * Pure (rows) → StatusGroupCount[]; returns [] when nothing falls into a shown group.
 */
export function summarizeStatuses(rows: ReadonlyArray<SummaryRow>): StatusGroupCount[] {
  const tally: Record<StatusGroup, number> = {
    waiting: 0,
    running: 0,
    done: 0,
    idle: 0,
  };
  for (const row of rows) {
    const g = rowGroup(row);
    if (g !== null) tally[g] += 1;
  }
  return GROUP_META.filter((m) => tally[m.group] > 0).map((m) => ({
    group: m.group,
    count: tally[m.group],
    label: m.label,
    presentationStatus: m.presentationStatus,
    presentationAgent: m.presentationAgent,
  }));
}
