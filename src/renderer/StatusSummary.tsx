// RENDERER ONLY — the top status-summary strip (GAP-11-A, Phase 11, UI-03).
//
// A slim strip aggregating LIVE session counts by status — "2 Waiting · 5 Running ·
// 2 Done · 1 Idle" (mockup .planning/design/rendered/switchboard-ide-view.png). Placed
// at the TOP of the terminal area (near the app chrome), mirroring the mockup's placement.
//
// The WHAT (the per-group counts) is the pure, unit-tested summarizeStatuses reducer
// (status-summary.ts) — React/xterm-free so the aggregation truth table runs in Node.
// The HOW (the pills) lives here. Colors are NOT re-derived: each pill feeds its group's
// (status, agent) seed to presentation() (status-colors.ts), so the dot accent comes from
// the SAME status ramp the sidebar + identity header use (D-03). Reads renderer session
// state only — no IPC, no new bridge key (EXPECTED_API_KEYS unchanged at 20).

import type { SessionStatus } from '../shared/types';
import type { AgentState } from '../shared/agent-state';
import { presentation } from './status-colors';
import { summarizeStatuses, type SummaryRow } from './status-summary';

export interface StatusSummaryProps {
  /** The live session rows (status + the renderer-only agent overlay) to aggregate. */
  sessions: ReadonlyArray<SummaryRow & { status: SessionStatus; agentState?: AgentState }>;
}

export function StatusSummary({ sessions }: StatusSummaryProps): React.JSX.Element | null {
  const groups = summarizeStatuses(sessions);
  // Nothing to show (zero sessions, or only error rows) → render nothing (no empty strip).
  if (groups.length === 0) return null;
  return (
    <div className="status-summary" data-testid="status-summary">
      {groups.map((g) => {
        const style = presentation(g.presentationStatus, g.presentationAgent);
        return (
          <span
            key={g.group}
            className="status-summary-pill"
            data-group={g.group}
            style={{ '--accent': style.accent } as React.CSSProperties}
          >
            <span className="status-dot" aria-hidden="true" />
            <span className="status-summary-count">{g.count}</span>
            <span className="status-summary-label">{g.label}</span>
          </span>
        );
      })}
    </div>
  );
}
