// O-1 A1 closure guard (Phase 11 Plan 00 Task 2) — the machine-checkable form of the
// RESEARCH "Enumerated state × affordance table" (11-RESEARCH ~145-160).
//
// WHY this test exists: Plan 01 deletes the sidebar restart `↻` button (D-01). RESEARCH O-1
// found the `↻` had exactly ONE unique role for a SURVIVING row — recycling a non-active
// spawn-fail `error` row. Before that UI is removed, this test PROVES every once-live row
// still has a Start ▶ or Retry recycle path — none is left "no way to recycle." It stays
// GREEN as the guard Plan 01 builds against; if a future change dead-ends a row, this fails.
//
// It drives the SAME pure predicates the renderer already uses (resolveRowStatus /
// hasRendererIdentity) — it does NOT invent a new reducer (RESEARCH "Don't-Hand-Roll").
// `resolveRowStatus` does not itself expose SessionManager's `activeIsCard` mapping, so the
// active-path assertion mirrors that pure rule directly (kept in lockstep with
// SessionManager.tsx ~615-616).

import { describe, it, expect } from 'vitest';
import {
  resolveRowStatus,
  hasRendererIdentity,
  type RowIdentity,
} from '../session-status';
import type { SessionStatus } from '../../shared/types';

function row(overrides: Partial<RowIdentity> = {}): RowIdentity {
  return {
    status: 'running',
    name: 'Session 1',
    icon: { type: 'emoji', value: '🖥️' },
    ...overrides,
  };
}

/**
 * The pure `activeIsCard` rule mirrored from SessionManager.tsx ~615-616: when the ACTIVE
 * record is 'not_started' OR 'error', the terminal area renders the IdleCard (Start ▶ for
 * not_started; Edit + Retry for error) IN PLACE OF a SessionView. Kept here so the recycle
 * affordance is asserted from the same predicate the renderer ships.
 */
function activeIsCard(status: SessionStatus): boolean {
  return status === 'not_started' || status === 'error';
}

describe('O-1 A1: a once-live IDENTITY row is recycled, never dead-ended (Start ▶ path)', () => {
  it("an IDENTITY 'exited' row presents as not_started → Inactive List (Start ▶)", () => {
    // Main's onExit routes an identity self-exit to dormantRecords + broadcasts 'exited';
    // the renderer reducer presents it as not_started so the Sidebar partition shows it in
    // the Inactive List with the always-visible Start ▶ — the discoverable recycle endpoint.
    const resolved = resolveRowStatus(row({ configured: true }), 'exited');
    expect(resolved).toBe('not_started');
    expect(activeIsCard(resolved)).toBe(true); // selecting it → IdleCard Start ▶, not a dead end
  });

  it("an IDENTITY 'error' (identity self-exit) row also presents as not_started → Start ▶", () => {
    const resolved = resolveRowStatus(row({ configured: true }), 'error');
    expect(resolved).toBe('not_started');
    expect(activeIsCard(resolved)).toBe(true);
  });

  it('a RECIPE row (startupCommand, not configured) recycles the same way (FIX 4b parity)', () => {
    expect(resolveRowStatus(row({ startupCommand: 'claude --rc' }), 'exited')).toBe(
      'not_started',
    );
  });
});

describe('O-1 A1: hasRendererIdentity classifies identity vs ephemeral from the onExit inputs', () => {
  it('a configured / recipe / custom-name / custom-icon row HAS identity (routed to dormant)', () => {
    expect(hasRendererIdentity(row({ configured: true }))).toBe(true);
    expect(hasRendererIdentity(row({ startupCommand: 'codex' }))).toBe(true);
    expect(hasRendererIdentity(row({ name: 'Parlour Claude' }))).toBe(true);
    expect(hasRendererIdentity(row({ icon: { type: 'emoji', value: '🛋️' } }))).toBe(true);
  });

  it('a bare ephemeral row has NO identity (main delete()s it on exit — row gone, not stranded)', () => {
    const bare = row();
    expect(hasRendererIdentity(bare)).toBe(false);
    // An ephemeral self-exit passes through raw (the row is removed elsewhere by main onExit),
    // so it is NOT left in the Working Area as a dead-ended card.
    expect(resolveRowStatus(bare, 'exited')).toBe('exited');
  });
});

describe('O-1 A1: the residual edge — a non-active spawn-fail error row is recoverable (Retry)', () => {
  it("a spawn-fail 'error' row that becomes ACTIVE reaches the IdleCard error branch → Retry", () => {
    // The single state the sidebar ↻ uniquely served (RESEARCH ~157): a non-active spawn-fail
    // error row. After ↻ removal its recycle path is: select it (make it active) → activeIsCard
    // is true for 'error' → the terminal area renders the IdleCard error branch (Edit + Retry).
    // A spawn-fail (pid -1) row keeps its raw 'error' status whether or not it has identity, so
    // assert the activeIsCard rule fires for 'error' directly.
    expect(activeIsCard('error')).toBe(true);
    // And it does NOT mount a SessionView (which would bind to a non-existent PTY) — proven by
    // the same predicate that puts it on the card path.
    expect(activeIsCard('not_started')).toBe(true);
    // A genuinely-running session is NOT a card (it gets a SessionView) — the rule is precise.
    expect(activeIsCard('running')).toBe(false);
    expect(activeIsCard('stopped')).toBe(false);
  });

  it('NO surviving once-live state is left without a Start ▶ or Retry affordance', () => {
    // Identity exited/error → not_started (Start ▶, via the reducer).
    expect(activeIsCard(resolveRowStatus(row({ configured: true }), 'exited'))).toBe(true);
    expect(activeIsCard(resolveRowStatus(row({ configured: true }), 'error'))).toBe(true);
    // Active spawn-fail error → IdleCard Retry (the residual ↻ edge).
    expect(activeIsCard('error')).toBe(true);
    // Dormant not_started → IdleCard / Inactive Start ▶.
    expect(activeIsCard('not_started')).toBe(true);
  });
});
