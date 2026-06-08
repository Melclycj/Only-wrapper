// FIX C unit guard (06.1-04 round 3 — DEFECT C: two Start buttons on the active
// dormant entry). For the ACTIVE not_started session BOTH primary Starts rendered:
//   - the sidebar Inactive-entry ▶ (24×24, .row-control-start, data-testid="start-session")
//   - the IdleCard large "▶ Start session" (.idle-start-button, data-testid="idle-start-session")
// Two copies of the PRIMARY Start (distinct from the intentional "Start ▶" vs
// "Start without command ⏵" pair, which is a DIFFERENT affordance).
//
// The pure predicate startAffordances(row, { isActive, activeIsCard }) is the single
// source of truth both Sidebar and the test consume (the node Vitest env has no
// jsdom/testing-library — Phase 3 forbids adding test packages, so the decision is
// modeled as a pure reducer, mirroring session-status.ts / session-close.ts).
//
// INVARIANT: exactly ONE primary Start affordance per dormant entry id —
//   - non-active dormant row → the sidebar ▶ is the single primary Start.
//   - active dormant row → the IdleCard "▶ Start session" is the single primary;
//     the sidebar ▶ is SUPPRESSED so the two no longer co-render.
// A running row has NO primary Start anywhere. The "Start without command" ⏵ is a
// SEPARATE affordance and is NOT counted as a primary Start.

import { describe, it, expect } from 'vitest';
import { startAffordances, type StartAffordanceInput } from '../start-affordances';

function dormant(over: Partial<StartAffordanceInput> = {}): StartAffordanceInput {
  return {
    status: 'not_started',
    isActive: false,
    activeIsCard: false,
    startupCommand: undefined,
    ...over,
  };
}

describe('startAffordances — exactly one primary Start per dormant entry (DEFECT C)', () => {
  it('a NON-active dormant row → sidebar ▶ is the single primary Start (no IdleCard)', () => {
    const a = startAffordances(dormant({ isActive: false }));
    expect(a.sidebarStart).toBe(true);
    // The IdleCard only renders for the ACTIVE session; a non-active row has no card.
    expect(a.idleCardStart).toBe(false);
    expect(a.primaryStartCount).toBe(1);
  });

  it('an ACTIVE dormant row → IdleCard "▶ Start session" is the single primary; sidebar ▶ is suppressed', () => {
    const a = startAffordances(dormant({ isActive: true, activeIsCard: true }));
    expect(a.sidebarStart).toBe(false); // suppressed — the card owns the primary Start
    expect(a.idleCardStart).toBe(true);
    expect(a.primaryStartCount).toBe(1); // NOT 2 — the duplicate is gone
  });

  it('a running row has NO primary Start affordance anywhere', () => {
    const a = startAffordances(dormant({ status: 'running', isActive: true }));
    expect(a.sidebarStart).toBe(false);
    expect(a.idleCardStart).toBe(false);
    expect(a.primaryStartCount).toBe(0);
  });

  it('the "Start without command" ⏵ is a SEPARATE affordance, not counted as a primary Start', () => {
    const a = startAffordances(
      dormant({ isActive: true, activeIsCard: true, startupCommand: 'claude --rc' }),
    );
    expect(a.startNoCmd).toBe(true); // the secondary affordance still shows
    expect(a.primaryStartCount).toBe(1); // still exactly one PRIMARY start
  });

  it('every dormant entry — active or not — has exactly one reachable primary Start', () => {
    expect(startAffordances(dormant({ isActive: false })).primaryStartCount).toBe(1);
    expect(
      startAffordances(dormant({ isActive: true, activeIsCard: true }))
        .primaryStartCount,
    ).toBe(1);
  });
});
