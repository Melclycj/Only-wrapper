// Pure status-summary aggregation truth table (GAP-11-A, Phase 11 T2).
//
// Verifies the React-free summarizeStatuses / rowGroup reducer (status-summary.ts) in the
// Node/Vitest env (mirrors session-status.test.ts / start-affordances.test.ts). The
// StatusSummary.tsx component is a thin presentational wrapper over this — the COUNT logic
// is proven here; the pill colors come from presentation() (already covered by
// status-colors.test.ts), so no DOM test is needed for the aggregation contract.

import { describe, it, expect } from 'vitest';
import {
  rowGroup,
  summarizeStatuses,
  type SummaryRow,
  type StatusGroup,
} from '../status-summary';

describe('rowGroup — per-row group resolution', () => {
  const cases: ReadonlyArray<[string, SummaryRow, StatusGroup | null]> = [
    ['running + waiting overlay → waiting', { status: 'running', agentState: 'waiting' }, 'waiting'],
    ['running + in-progress overlay → running', { status: 'running', agentState: 'in-progress' }, 'running'],
    ['running + free overlay → running', { status: 'running', agentState: 'free' }, 'running'],
    ['running + no overlay → running', { status: 'running' }, 'running'],
    ['exited → done', { status: 'exited' }, 'done'],
    ['not_started → idle', { status: 'not_started' }, 'idle'],
    ['stopped → idle', { status: 'stopped' }, 'idle'],
    ['error → omitted (null)', { status: 'error' }, null],
  ];
  for (const [name, row, expected] of cases) {
    it(name, () => {
      expect(rowGroup(row)).toBe(expected);
    });
  }
});

describe('summarizeStatuses — ordered, zero-omitting aggregation', () => {
  it('a mixed session list → correct per-status counts in mockup order', () => {
    // Mirrors the mockup strip: 2 Waiting · 5 Running · 2 Done · 1 Idle.
    const rows: SummaryRow[] = [
      { status: 'running', agentState: 'waiting' },
      { status: 'running', agentState: 'waiting' },
      { status: 'running', agentState: 'in-progress' },
      { status: 'running', agentState: 'free' },
      { status: 'running' },
      { status: 'running', agentState: 'in-progress' },
      { status: 'running' },
      { status: 'exited' },
      { status: 'exited' },
      { status: 'not_started' },
    ];
    const result = summarizeStatuses(rows);
    expect(result.map((g) => [g.group, g.count])).toEqual([
      ['waiting', 2],
      ['running', 5],
      ['done', 2],
      ['idle', 1],
    ]);
    // Labels match the mockup copy.
    expect(result.map((g) => g.label)).toEqual(['Waiting', 'Running', 'Done', 'Idle']);
  });

  it('omits zero-count groups (only non-empty groups render)', () => {
    const rows: SummaryRow[] = [
      { status: 'running' },
      { status: 'running' },
      { status: 'not_started' },
    ];
    const result = summarizeStatuses(rows);
    expect(result.map((g) => g.group)).toEqual(['running', 'idle']);
    expect(result.find((g) => g.group === 'waiting')).toBeUndefined();
    expect(result.find((g) => g.group === 'done')).toBeUndefined();
  });

  it('error + empty → empty array (nothing to show)', () => {
    expect(summarizeStatuses([])).toEqual([]);
    expect(summarizeStatuses([{ status: 'error' }, { status: 'error' }])).toEqual([]);
  });

  it('stopped sessions fold into Idle alongside not_started', () => {
    const result = summarizeStatuses([
      { status: 'stopped' },
      { status: 'not_started' },
      { status: 'stopped' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ group: 'idle', count: 3 });
  });

  it('the idle pill seeds presentation() with the slate (not_started) status', () => {
    const result = summarizeStatuses([{ status: 'stopped' }]);
    expect(result[0].presentationStatus).toBe('not_started');
    expect(result[0].presentationAgent).toBeUndefined();
  });

  it('the waiting pill seeds presentation() with the running+waiting overlay (amber)', () => {
    const result = summarizeStatuses([{ status: 'running', agentState: 'waiting' }]);
    expect(result[0].presentationStatus).toBe('running');
    expect(result[0].presentationAgent).toBe('waiting');
  });
});
