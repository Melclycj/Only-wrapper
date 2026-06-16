// GAP-12-C regression (12-09) — a failed restart-to-apply must SURFACE, not be SWALLOWED.
//
// Relocated from .planning/spikes/005-restart-probe-timeout/gap-12-c-surface.diag.test.ts.txt
// (a diagnosis-only probe) and committed as a real regression. Pins TWO contracts:
//   1. applyStatusEvent is UNCHANGED — a notice-bearing 'error' event stays INFORMATIONAL
//      (status preserved; errorMessage captured) and a bare 'error' transition flips an
//      identity row to the Inactive List. The fix does NOT live in the reducer.
//   2. handleRestart's NEW pid<=0 branch clears the dead ptyPid so the renderer row the
//      restart leaves behind — composed with the create()-broadcast error event through
//      applyStatusEvent — is a CARD (not_started/error), never a stale-'running' row bound
//      to a dead PTY. Tested via the row-state shape the renderer produces (the pid<=0
//      branch maps the row to `{ ...row, ptyPid: undefined }`), not React internals.

import { describe, it, expect } from 'vitest';
import { applyStatusEvent, type StatusRow } from '../apply-status-event';
import { resolveSpawnResult } from '../session-lifecycle-actions';
import type { LogicalId } from '../../shared/types';

function runningRow(): StatusRow {
  return {
    logicalId: 'live-1' as LogicalId,
    ptyPid: 4242,
    name: 'API',
    icon: { type: 'emoji', value: '🖥️' },
    cwd: '/Users/dev/proj',
    shell: '/bin/zsh',
    startupCommand: 'echo hi',
    status: 'running',
    order: 0,
    lastActive: 1,
    configured: true,
  };
}

// A DORMANT (not_started) restored row — the dormant ▶ Start path's starting state. This is
// the row the operator acted on ("after I START it just returned to home"): the 12-09 fix
// only touched handleRestart, so a bad-cwd Start left THIS row swallowed.
function dormantRow(): StatusRow {
  return {
    logicalId: 'dorm-1' as LogicalId,
    ptyPid: undefined,
    name: 'API',
    icon: { type: 'emoji', value: '🖥️' },
    cwd: '/Users/dev/deleted-dir',
    shell: '/bin/zsh',
    startupCommand: 'echo hi',
    status: 'not_started',
    order: 0,
    lastActive: 1,
    configured: true,
  };
}

// The renderer's activeIsCard predicate (SessionManager): a row is a CARD (IdleCard, not a
// live SessionView) when its status is not_started OR error.
function isCard(row: StatusRow): boolean {
  return row.status === 'not_started' || row.status === 'error';
}

describe('GAP-12-C — applyStatusEvent contract is UNCHANGED', () => {
  it('an error event WITH a notice stays INFORMATIONAL — status stays running, errorMessage captured', () => {
    const row = runningRow();
    // Exactly what create() sends on a pid<=0 bad-cwd spawn (status:'error' + the
    // 'Working directory not found' notice on the same onPtyStatus event).
    const next = applyStatusEvent(row, {
      status: 'error',
      notice: 'Working directory not found: /no/such/dir',
    });

    // The ITEM-4 guard (notice = informational, never a lifecycle transition) keeps the
    // row's CURRENT status — the reducer is NOT where GAP-12-C is fixed.
    expect(next.status).toBe('running');
    expect(next.errorMessage).toBe('Working directory not found: /no/such/dir');
    // ptyPid is untouched by the notice branch — the reducer alone leaves a dead pid.
    expect(next.ptyPid).toBe(4242);
  });

  it('a bare error transition WITHOUT a notice flips an identity row to the Inactive List', () => {
    const row = runningRow();
    // A lifecycle 'error' with NO notice (the abnormal fork-then-die path sends the
    // notice separately) flips an identity row to not_started → Inactive List.
    const next = applyStatusEvent(row, { status: 'error' });
    expect(next.status).toBe('not_started'); // identity self-exit → Inactive List
    expect(next.ptyPid).toBeUndefined();
  });
});

describe('GAP-12-C — handleRestart pid<=0 leaves the row a CARD (no stale running PTY)', () => {
  it('the dead-pid clear + the create()-broadcast error event compose to an IdleCard, not a stale running row', () => {
    // handleRestart's NEW pid<=0 branch maps the previously-running row to drop its dead
    // ptyPid. We model that exact shape transform here (the renderer's setSessions map).
    const afterRestartFail: StatusRow = { ...runningRow(), ptyPid: undefined };

    // The dead-pid clear alone does NOT leave a stale live pid…
    expect(afterRestartFail.ptyPid).toBeUndefined();

    // …and the error event create() broadcasts over onPtyStatus then drives the row to a
    // card. A bare 'error' transition flips the identity row to not_started (IdleCard); a
    // notice-bearing error captures the message and the SUBSEQUENT bare-error lifecycle
    // broadcast flips it. Either way the resulting row is a CARD — never stale 'running'.
    const withNotice = applyStatusEvent(afterRestartFail, {
      status: 'error',
      notice: 'Working directory not found: /no/such/dir',
    });
    expect(withNotice.errorMessage).toBe(
      'Working directory not found: /no/such/dir',
    );

    const lifecycle = applyStatusEvent(withNotice, { status: 'error' });
    expect(lifecycle.status).toBe('not_started'); // identity self-exit → Inactive List
    expect(lifecycle.ptyPid).toBeUndefined(); // no stranded dead pid
    expect(isCard(lifecycle)).toBe(true); // renders the IdleCard, not a SessionView
  });
});

// ── GAP-12-C round 3 (12-10): the SHARED resolveSpawnResult reducer — BOTH paths surface ──
//
// Round 2 fixed handleRestart only. The operator's re-gate showed handleStart (dormant ▶
// Start) STILL swallowed a failed spawn ("after I start it just returned to home"). Round 3
// routes BOTH handlers through resolveSpawnResult so the divergence cannot recur. These tests
// pin the reducer's contract on both the success and failure pid for the Start and Restart
// starting states, AND prove the failure SURFACES (status:'error' → the IdleCard error branch)
// rather than leaving the row on the dormant card with the error invisible.

describe('GAP-12-C round 3 — resolveSpawnResult surfaces a failed Start (the swallowed path)', () => {
  it('dormant ▶ Start with a bad cwd (pid -1) flips the row to a VISIBLE error card, not back to the dormant view', () => {
    const row = dormantRow();
    // BEFORE round 3: handleStart did nothing on pid<=0, so the row stayed not_started
    // (dormant IdleCard / Start button), hiding the error. resolveSpawnResult fixes that.
    const next = resolveSpawnResult(row, { pid: -1 });

    expect(next.status).toBe('error'); // ← the fix: a VISIBLE error, not 'not_started'
    expect(next.ptyPid).toBeUndefined(); // no stranded dead pid
    expect(isCard(next)).toBe(true); // still a card (IdleCard) …
    // … and now the IdleCard ERROR branch (isError = status==='error'), not the dormant
    // Start branch — so the failure is surfaced where the user acted.
    expect(next.status === 'error').toBe(true);
    // A fallback message is present even if the onPtyStatus notice has not landed yet (race).
    expect(next.errorMessage).toBeTruthy();
  });

  it('preserves a notice-supplied errorMessage when it landed BEFORE the pid<=0 reply', () => {
    // The onPtyStatus error+notice push can arrive first; applyStatusEvent captures it as
    // errorMessage (status stays not_started — ITEM-4 guard). Then the pid<=0 reply runs.
    const captured = applyStatusEvent(dormantRow(), {
      status: 'error',
      notice: 'Working directory not found: /Users/dev/deleted-dir',
    });
    expect(captured.status).toBe('not_started'); // ITEM-4 guard kept it informational
    expect(captured.errorMessage).toBe(
      'Working directory not found: /Users/dev/deleted-dir',
    );

    // resolveSpawnResult then flips to error AND keeps the specific message (no clobber).
    const next = resolveSpawnResult(captured, { pid: -1 });
    expect(next.status).toBe('error');
    expect(next.errorMessage).toBe(
      'Working directory not found: /Users/dev/deleted-dir',
    );
  });

  it('a successful Start (pid > 0) optimistically flips the dormant row to running and clears any stale error', () => {
    const row = { ...dormantRow(), errorMessage: 'stale from a prior failed try' };
    const next = resolveSpawnResult(row, { pid: 5151 });
    expect(next.status).toBe('running');
    expect(next.ptyPid).toBe(5151);
    expect(next.errorMessage).toBeUndefined(); // stale error cleared on a real spawn
    expect(isCard(next)).toBe(false); // a live SessionView, not a card
  });
});

describe('GAP-12-C round 3 — resolveSpawnResult surfaces a failed Restart too (render-path follow-up)', () => {
  it('a bad-cwd Restart (live row, pid -1) flips to a VISIBLE error card — not a stale running PTY and not the home view', () => {
    // The round-2 handleRestart only cleared the dead pid and RELIED on the broadcast error
    // winning; but the broadcast carries a notice (informational), so on a live row the
    // status never flipped. resolveSpawnResult owns the flip now.
    const next = resolveSpawnResult(runningRow(), { pid: -1 });
    expect(next.status).toBe('error'); // VISIBLE error card
    expect(next.ptyPid).toBeUndefined(); // dead pid dropped — no stale running PTY
    expect(isCard(next)).toBe(true); // IdleCard, not a SessionView bound to a dead PTY
    expect(next.errorMessage).toBeTruthy();
  });

  it('a successful Restart (pid > 0) keeps the live running flip', () => {
    const next = resolveSpawnResult(runningRow(), { pid: 9090 });
    expect(next.status).toBe('running');
    expect(next.ptyPid).toBe(9090);
    expect(next.errorMessage).toBeUndefined();
  });
});
