// FIX 1 regression guard (06.1-04 gap-closure) — the settle-INDEPENDENT 'waiting'
// fast path. This is the REQUIRED lock for the amber-never-fires defect: the real
// `claude` permission screen keeps a continuously-repainting footer (elapsed-time /
// token counter), so the full-viewport hash NEVER settles. The OLD SEAM A only ran
// classify() after SETTLE_MS of an unchanged full frame, so it never fired and the
// session stayed 'in-progress' (blue) forever.
//
// We drive the PURE decideAgentTick helper (no DOM, no xterm) with a synthetic frame
// sequence whose MENU BODY is constant ("Do you want to proceed?" + a numbered menu)
// but whose bottom FOOTER line increments an elapsed-time counter every tick — so the
// full-frame hash changes on every single tick and never settles. The fix must still
// resolve this to 'waiting' within ~WAITING_TICKS (≈300ms) on the settle-independent
// path. A regression that reverts to settle-only would leave this 'in-progress' forever.

import { describe, it, expect } from 'vitest';
import {
  decideAgentTick,
  initAgentTickState,
  WAITING_TICKS,
} from '../agent-tick';
import { TICK_MS } from '../../shared/agent-state';

// A real-shaped Claude permission menu BODY (constant across ticks) — the same shape
// the replay oracle uses. The leading caret is the U+276F glyph (a non-decisive
// menu-item marker; classify() keys on the numbered-menu / footer signals, not it).
const MENU_BODY = [
  'Do you want to proceed?',
  '❯ 1. Yes, run it',
  '  2. No, cancel',
  '  3. Always allow',
];

// The footer line that CHURNS every tick — an elapsed-time + token counter + the
// "esc to interrupt" hint Claude shows live. This is what kept the full-frame hash
// from ever settling (the FIX-1 root cause).
function churningFooter(tick: number): string {
  const seconds = (tick * 0.1).toFixed(1);
  return `  ⏱ ${seconds}s · 1.2k tokens · esc to interrupt`;
}

function menuFrameAtTick(tick: number): string[] {
  return [...MENU_BODY, churningFooter(tick)];
}

describe('decideAgentTick — settle-independent waiting (FIX 1)', () => {
  it('resolves a churning-footer permission menu to "waiting" within ~WAITING_TICKS despite a never-settling hash', () => {
    const state = initAgentTickState(0);
    const verdicts: (string | null)[] = [];

    // Simulate ticks at TICK_MS cadence. Each tick the footer increments, so the
    // full-frame hash CHANGES every time and the settle window never elapses.
    for (let tick = 0; tick < 10; tick++) {
      const now = tick * TICK_MS;
      verdicts.push(decideAgentTick(state, menuFrameAtTick(tick), now));
    }

    // The hash truly never settles: every tick the frame changed (the footer moved),
    // so the settle-only path would emit 'in-progress' on every tick and NEVER
    // 'waiting'. Assert the fix instead reaches 'waiting' once the streak hits the
    // threshold (tick index WAITING_TICKS-1, 0-based).
    const firstWaitingIdx = verdicts.indexOf('waiting');
    expect(firstWaitingIdx).toBe(WAITING_TICKS - 1);

    // ...and once reached it STAYS waiting while the menu body persists (the footer
    // churn no longer suppresses it).
    for (let i = firstWaitingIdx; i < verdicts.length; i++) {
      expect(verdicts[i]).toBe('waiting');
    }

    // It resolved within ~300ms (WAITING_TICKS × TICK_MS), not "never".
    expect(firstWaitingIdx * TICK_MS).toBeLessThanOrEqual(WAITING_TICKS * TICK_MS);
  });

  it('a single transient menu-looking frame does NOT false-fire waiting (streak debounce)', () => {
    const state = initAgentTickState(0);
    // One menu frame, then back to a churning non-menu "Thinking…" frame.
    const v0 = decideAgentTick(state, menuFrameAtTick(0), 0);
    const v1 = decideAgentTick(
      state,
      ['✻ Thinking…', `  ⏱ 0.1s · esc to interrupt`],
      TICK_MS,
    );
    // A single waiting frame (streak 1 < WAITING_TICKS) must NOT emit 'waiting'.
    expect(v0).not.toBe('waiting');
    // The non-menu frame resets the streak and reads churning → in-progress.
    expect(v1).toBe('in-progress');
  });

  it('an animated non-menu frame (churning Thinking…) reads in-progress, never waiting', () => {
    const state = initAgentTickState(0);
    let sawWaiting = false;
    for (let tick = 0; tick < 8; tick++) {
      const frame = ['✻ Thinking…', `  ⏱ ${(tick * 0.1).toFixed(1)}s working`];
      const v = decideAgentTick(state, frame, tick * TICK_MS);
      if (v === 'waiting') sawWaiting = true;
      // A churning frame is always reported in-progress (it changed every tick).
      expect(v).toBe('in-progress');
    }
    expect(sawWaiting).toBe(false);
  });

  it('a settled shell prompt resolves to "free" via the settle path (unchanged frame)', () => {
    const state = initAgentTickState(0);
    const prompt = ['user@host project %'];
    // First tick registers the change (in-progress); hold the SAME frame until the
    // settle window elapses, then it must classify FREE.
    expect(decideAgentTick(state, prompt, 0)).toBe('in-progress');
    // Unchanged-but-not-yet-settled → hold (null).
    expect(decideAgentTick(state, prompt, TICK_MS)).toBeNull();
    // After SETTLE_MS of the unchanged prompt → settled → free.
    expect(decideAgentTick(state, prompt, 1000)).toBe('free');
  });
});
