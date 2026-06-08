// WR-02 regression — proves the optimistic "running" flip after a spawn/restart applies
// ONLY when pid > 0. A failed spawn (pid -1, SC2) must NOT flip the row to 'running' and
// clobber the error card main already broadcast over onPtyStatus.
//
// This targets the pure `optimisticRunningFlip` helper (React/xterm-free) rather than
// rendering SessionManager: the Vitest env here is `node` (no jsdom/testing-library, and
// Phase 3's scope audit forbids adding test packages). The helper is the SINGLE source of
// truth the Start AND Restart paths route through, so driving it directly proves the
// invariant at its source.

import { describe, it, expect } from 'vitest';
import { optimisticRunningFlip, type SpawnRow } from '../optimistic-spawn';
import type { LogicalId } from '../../shared/types';

function makeRow(over: Partial<SpawnRow> = {}): SpawnRow {
  return {
    logicalId: 'session-1' as LogicalId,
    ptyPid: undefined,
    name: 'Session 1',
    icon: { type: 'emoji', value: '🖥️' },
    cwd: '/Users/dev',
    shell: '/bin/zsh',
    startupCommand: undefined,
    status: 'not_started',
    order: 0,
    lastActive: 0,
    ...over,
  };
}

describe('optimisticRunningFlip (WR-02 — pid>0 guard)', () => {
  it('flips the matching row to running with the new pid when pid > 0', () => {
    const rows = [makeRow({ logicalId: 'session-1' as LogicalId })];
    const next = optimisticRunningFlip(rows, 'session-1' as LogicalId, 4242);
    expect(next[0].status).toBe('running');
    expect(next[0].ptyPid).toBe(4242);
  });

  it('clears a stale errorMessage on a successful (pid>0) flip', () => {
    const rows = [makeRow({ status: 'error', errorMessage: 'old failure' })];
    const next = optimisticRunningFlip(rows, 'session-1' as LogicalId, 99);
    expect(next[0].status).toBe('running');
    expect(next[0].errorMessage).toBeUndefined();
  });

  // ── THE DEFECT: a failed respawn returns pid -1; main has already broadcast 'error'
  //    + the notice. The optimistic flip must be a NO-OP so it cannot clobber the
  //    error card (the same inverse-guard handleStart has, now applied to restart). ──
  it('does NOT flip to running when pid <= 0 (failed spawn — preserves the error card)', () => {
    const rows = [makeRow({ status: 'error', errorMessage: 'Working directory not found: /nope' })];
    const next = optimisticRunningFlip(rows, 'session-1' as LogicalId, -1);
    expect(next).toBe(rows); // unchanged reference — no clobber
    expect(next[0].status).toBe('error');
    expect(next[0].errorMessage).toBe('Working directory not found: /nope');
  });

  it('treats pid 0 as a failed spawn (no flip)', () => {
    const rows = [makeRow({ status: 'error' })];
    const next = optimisticRunningFlip(rows, 'session-1' as LogicalId, 0);
    expect(next[0].status).toBe('error');
  });

  it('leaves non-matching rows untouched on a successful flip', () => {
    const rows = [
      makeRow({ logicalId: 'session-1' as LogicalId, status: 'running' }),
      makeRow({ logicalId: 'session-2' as LogicalId, status: 'not_started' }),
    ];
    const next = optimisticRunningFlip(rows, 'session-2' as LogicalId, 7);
    expect(next[0].status).toBe('running'); // unchanged
    expect(next[1].status).toBe('running'); // flipped
    expect(next[1].ptyPid).toBe(7);
  });
});
