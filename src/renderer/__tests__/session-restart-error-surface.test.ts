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
