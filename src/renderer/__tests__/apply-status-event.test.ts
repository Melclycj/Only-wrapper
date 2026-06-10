// RED repro (06.1-04 gap-closure round 2, ITEM 4 — renderer half of the "revert to
// Working Area after ~1s" defect).
//
// The renderer's onPtyStatus handler (extracted to apply-status-event.ts) must treat a
// `notice` event as INFORMATIONAL ONLY: it may carry an errorMessage but it must NEVER
// change the row's lifecycle `status`. The old handler adopted the notice's status field,
// so main's stale TERM-05 ready-fail notice (status:'running', sent AFTER a recipe had
// self-exited and the row had correctly moved to the Inactive List) RESURRECTED the row
// back to 'running' → the Working Area. This test pins that a notice can never resurrect a
// dormant row, while the genuine lifecycle transitions (FIX 4a self-exit flip, error
// capture, agent-overlay clearing) keep working.

import { describe, it, expect } from 'vitest';
import { applyStatusEvent, type StatusRow } from '../apply-status-event';
import type { LogicalId } from '../../shared/types';

function recipeRow(over: Partial<StatusRow> = {}): StatusRow {
  return {
    logicalId: 'recipe-1' as LogicalId,
    ptyPid: 4242,
    name: 'Parlour Claude RC', // custom name → renderer-visible identity
    icon: { type: 'emoji', value: '🛋️' },
    cwd: '/Users/dev/proj',
    shell: '/bin/zsh',
    startupCommand: 'claude --rc',
    status: 'running',
    order: 0,
    lastActive: 1_700_000_000_000,
    configured: true,
    ...over,
  };
}

describe('applyStatusEvent — ITEM 4 stale-notice guard', () => {
  it('a stale running NOTICE does NOT resurrect a dormant (not_started) row to the Working Area', () => {
    // The row already moved to the Inactive List (FIX 4a applied on the earlier exit).
    const dormant = recipeRow({ status: 'not_started', ptyPid: undefined });
    // Main's still-armed readiness timer fires a stale running ready-fail notice.
    const next = applyStatusEvent(dormant, {
      status: 'running',
      notice: "Startup command didn't auto-run — shell wasn't ready in time.",
    });
    // The row MUST stay dormant (Inactive List), not revert to running (Working Area).
    expect(next.status).toBe('not_started');
    expect(next.ptyPid).toBeUndefined();
  });

  it('a notice event never changes status, even for a live running row', () => {
    const live = recipeRow({ status: 'running' });
    const next = applyStatusEvent(live, {
      status: 'running',
      notice: "Startup command didn't auto-run — shell wasn't ready in time.",
    });
    expect(next.status).toBe('running'); // unchanged — notice is informational
  });

  it('an error notice still captures the error message (without driving a transition)', () => {
    const errored = recipeRow({ status: 'error' });
    const next = applyStatusEvent(errored, {
      status: 'error',
      notice: 'Working directory not found: /gone',
    });
    expect(next.errorMessage).toBe('Working directory not found: /gone');
  });
});

describe('applyStatusEvent — preserves the FIX 4a + lifecycle behavior (regression guard)', () => {
  it('an identity row self-exit (exited) flips to not_started and drops the dead pid/overlay', () => {
    const live = recipeRow({ status: 'running', ptyPid: 4242, agentState: 'waiting' });
    const next = applyStatusEvent(live, { status: 'exited' });
    expect(next.status).toBe('not_started');
    expect(next.ptyPid).toBeUndefined();
    expect(next.agentState).toBeUndefined();
    expect(next.errorMessage).toBeUndefined();
  });

  it('an identity row self-exit (error) also flips to not_started (Inactive List)', () => {
    const live = recipeRow({ status: 'running' });
    const next = applyStatusEvent(live, { status: 'error' });
    expect(next.status).toBe('not_started');
  });

  it('a bare ephemeral row self-exit passes the raw status through (stays/leaves Working Area)', () => {
    const ephemeral = recipeRow({
      name: 'Session 1',
      startupCommand: undefined,
      configured: undefined,
      icon: { type: 'emoji', value: '🖥️' },
      status: 'running',
    });
    const next = applyStatusEvent(ephemeral, { status: 'exited' });
    expect(next.status).toBe('exited');
  });

  it('a running transition threads the new ptyPid and clears a stale error', () => {
    const errored = recipeRow({ status: 'error', errorMessage: 'old' });
    const next = applyStatusEvent(errored, { status: 'running', ptyPid: 9001 });
    expect(next.status).toBe('running');
    expect(next.ptyPid).toBe(9001);
    expect(next.errorMessage).toBeUndefined();
  });

  it('leaving running (stopped) clears the agent overlay AND passes through as stopped (restart safety — DEFECT A / SC3)', () => {
    // ROUND 3: 'stopped' must NOT flip to not_started here — a restart's transient
    // stopped→running would otherwise unmount the kept SessionView mid-restart (dropping
    // the '— restarted —' seam + startup re-run). The configured-live Remove is handled
    // main-side as a 'not_started' broadcast (the test below).
    const live = recipeRow({ status: 'running', agentState: 'in-progress' });
    const next = applyStatusEvent(live, { status: 'stopped' });
    expect(next.status).toBe('stopped');
    expect(next.agentState).toBeUndefined();
  });

  // ── ROUND 3 (DEFECT A): the removeLive() Remove path broadcasts 'not_started' ──
  it('an identity row "not_started" broadcast (the removeLive Remove path) moves to the Inactive List + drops the pid/overlay', () => {
    // removeLive() (confirmClose → ptyStop → IPC pty:stop) broadcasts the record's actual
    // terminal state, 'not_started'. The reducer must land it in the Inactive List with the
    // dead pid + stale overlay dropped, so the Removed configured session reads as a clean
    // dormant recipe and does NOT revert to the Working Area (DEFECT A).
    const live = recipeRow({ status: 'running', ptyPid: 4242, agentState: 'in-progress' });
    const next = applyStatusEvent(live, { status: 'not_started' });
    expect(next.status).toBe('not_started');
    expect(next.ptyPid).toBeUndefined();
    expect(next.agentState).toBeUndefined();
  });
});
