// FIX C unit guard (06.1-04 round 3 — DEFECT C: two Start buttons on the active
// dormant entry). For the ACTIVE not_started session BOTH primary Starts rendered:
//   - the sidebar Inactive-entry ▶ (24×24, .row-control-start, data-testid="start-session")
//   - the IdleCard large "▶ Start session" (.idle-start-button, data-testid="idle-start-session")
// Two copies of the PRIMARY Start (distinct from the intentional "Start ▶" vs
// "Start without command ⏵" pair, which is a DIFFERENT affordance).
//
// REGRESSION (R3, 2026-06-09): the round-3 fix only deduped the PRIMARY Start; it
// left the "Start without command" ⏵ (data-testid="start-no-cmd-session") rendering
// on the ACTIVE dormant RECIPE row alongside the IdleCard ▶. The user saw "two Start
// buttons of different size" — the small sidebar ⏵ AND the large IdleCard ▶ — and,
// clicking the small one, hit handleStartNoCmd → skipStartupCommand → "command not
// run on start" (R1). The contract is now: on the ACTIVE dormant row, EXACTLY ONE
// Start-labeled control renders TOTAL (the IdleCard ▶, which runs the command). The
// new `totalStartCount` field counts ALL Start-labeled controls (primary ▶ + the
// secondary ⏵ + the IdleCard ▶) so this can never silently regress again. The pure-
// predicate test below MISSED R3 because it only asserted primaryStartCount and
// explicitly allowed startNoCmd on the active card — that wrong assumption is fixed.
//
// The pure predicate startAffordances(row, { isActive, activeIsCard }) is the single
// source of truth both Sidebar and the test consume (the node Vitest env has no
// jsdom/testing-library — the project forbids adding test packages, so the decision is
// modeled as a pure reducer, mirroring session-status.ts / session-close.ts).
//
// INVARIANT: exactly ONE primary Start affordance per dormant entry id —
//   - non-active dormant row → the sidebar ▶ is the single primary Start.
//   - active dormant row → the IdleCard "▶ Start session" is the single primary;
//     the sidebar ▶ is SUPPRESSED so the two no longer co-render.
// A running row has NO primary Start anywhere. The "Start without command" ⏵ is a
// SEPARATE affordance — counted in totalStartCount (it IS Start-labeled) but NOT in
// primaryStartCount — and is itself SUPPRESSED on the active dormant card row (R3).

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

  it('the "Start without command" ⏵ is a SEPARATE affordance — counted as Start-labeled, not as a PRIMARY Start (NON-active row)', () => {
    // A NON-active dormant recipe row legitimately shows its sidebar ▶ + ⏵ pair (D-06).
    const a = startAffordances(
      dormant({ isActive: false, startupCommand: 'claude --rc' }),
    );
    expect(a.startNoCmd).toBe(true); // the secondary affordance shows on a non-active row
    expect(a.primaryStartCount).toBe(1); // still exactly one PRIMARY start (sidebar ▶)
    expect(a.totalStartCount).toBe(2); // sidebar ▶ + ⏵ — both Start-labeled
  });

  it('every dormant entry — active or not — has exactly one reachable primary Start', () => {
    expect(startAffordances(dormant({ isActive: false })).primaryStartCount).toBe(1);
    expect(
      startAffordances(dormant({ isActive: true, activeIsCard: true }))
        .primaryStartCount,
    ).toBe(1);
  });

  // ── R3 regression (2026-06-09): on the ACTIVE dormant RECIPE row (a dormant
  //    session WITH a saved startupCommand, selected so its IdleCard shows) EXACTLY
  //    ONE Start-labeled control must render TOTAL — the IdleCard ▶ that RUNS the
  //    command. The sidebar ⏵ "Start without command" must be suppressed there (it is
  //    the small button the user was clicking → skipStartupCommand → R1). The pure
  //    predicate is the single source of truth the Sidebar gate consumes. ──
  it('R3: active dormant RECIPE row → exactly ONE total Start (the IdleCard ▶); sidebar ▶ AND ⏵ suppressed', () => {
    const a = startAffordances(
      dormant({ isActive: true, activeIsCard: true, startupCommand: 'claude --rc' }),
    );
    expect(a.sidebarStart).toBe(false); // primary ▶ suppressed (the card owns it)
    expect(a.startNoCmd).toBe(false); // R3: the ⏵ is ALSO suppressed on the active card
    expect(a.idleCardStart).toBe(true); // the IdleCard ▶ is the single Start
    expect(a.primaryStartCount).toBe(1);
    expect(a.totalStartCount).toBe(1); // R3: exactly ONE Start-labeled control TOTAL
  });

  it('R3 guard: a NON-active dormant recipe row is NOT over-suppressed (keeps its ⏵)', () => {
    const a = startAffordances(
      dormant({ isActive: false, startupCommand: 'claude --rc' }),
    );
    expect(a.sidebarStart).toBe(true); // non-active keeps its sidebar ▶
    expect(a.startNoCmd).toBe(true); // ...and its ⏵ (D-06)
    expect(a.totalStartCount).toBe(2);
  });

  it('R3: an active dormant row with NO saved command shows the single IdleCard ▶ and no ⏵', () => {
    const a = startAffordances(dormant({ isActive: true, activeIsCard: true }));
    expect(a.startNoCmd).toBe(false); // no command → no ⏵ anyway
    expect(a.idleCardStart).toBe(true);
    expect(a.totalStartCount).toBe(1);
  });
});
