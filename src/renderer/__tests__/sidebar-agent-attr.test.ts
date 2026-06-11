// WR-03 invariant guard (Phase 10-05 Task 2 — GAP-10-B). The amber "Waiting for you"
// signal must render ONLY on a running session. The data-agent='waiting' attribute is the
// CSS seam that paints the amber edge bar + wash; if a finished/exited/stopped/not_started
// row could still carry a stale agentState='waiting', a dead session would falsely scream
// "I need you". The JSX seam in Sidebar.tsx is gated on status==='running' AND agentState,
// and that gate is factored into the pure rowAgentAttr() helper so it is unit-testable in
// the plain Node/Vitest env (no jsdom/testing-library — the project forbids adding test
// packages; mirrors start-affordances.test.ts / row-secondary's pure-reducer idiom).
//
// INVARIANT under test: rowAgentAttr(status, agentState) returns the agentState ONLY when
// status==='running' and agentState is truthy; for EVERY non-running status (even with a
// stale 'waiting' agentState) it returns undefined → no data-agent attribute → no amber.

import { describe, it, expect } from 'vitest';
import { rowAgentAttr } from '../row-secondary';
import type { SessionStatus } from '../../shared/types';

describe('rowAgentAttr — data-agent seam is running-gated (WR-03)', () => {
  it('running + waiting → "waiting" (the amber signal surfaces live)', () => {
    expect(rowAgentAttr('running', 'waiting')).toBe('waiting');
  });

  it('running + in-progress → "in-progress"', () => {
    expect(rowAgentAttr('running', 'in-progress')).toBe('in-progress');
  });

  it('running + free → "free"', () => {
    expect(rowAgentAttr('running', 'free')).toBe('free');
  });

  it('running + undefined → undefined (no overlay → no attribute)', () => {
    expect(rowAgentAttr('running', undefined)).toBeUndefined();
  });

  // WR-03 core: a finished row never carries amber, even if a stale agentState lingered.
  const nonRunning: SessionStatus[] = [
    'stopped',
    'exited',
    'error',
    'not_started',
  ];
  for (const status of nonRunning) {
    it(`${status} + stale "waiting" → undefined (a finished row never carries amber)`, () => {
      expect(rowAgentAttr(status, 'waiting')).toBeUndefined();
    });
  }
});
