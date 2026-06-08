// RENDERER-adjacent, but DOM-free + xterm-free — the pure per-tick agent-state
// decision extracted from SessionView's SEAM A (FIX 1, 06.1-04 gap-closure). Kept
// in a React/xterm/DOM-free module (mirroring session-add / session-close / agent-
// state) so the settle-independent "waiting" verdict is unit-testable in the plain
// Node/Vitest env — feed it a sequence of frame strings, get back the state to emit.
//
// WHY THIS EXISTS (the FIX-1 defect): the original SEAM A only ran classify() AFTER
// the full-viewport hash was UNCHANGED for SETTLE_MS. The real `claude` permission
// screen has a continuously-repainting bottom line (elapsed-time / token counter /
// "esc to interrupt · Ns…"), so the full-frame hash NEVER stops changing → the frame
// never settles → classify() was never called → the session stayed 'in-progress'
// (blue) forever and the amber "waiting" verdict never fired live. The spike capture
// happened to contain a fully-static menu, which settled and masked the bug.
//
// THE FIX: on EVERY tick we ALSO run classify() on the current frame. If classify()
// returns 'waiting' for WAITING_TICKS consecutive ticks (~300ms of a stable menu
// BODY) we emit 'waiting' IMMEDIATELY — even though the full-frame hash is still
// churning from the live footer. This is safe from false positives because classify()
// only returns 'waiting' for genuine menus / confirmation prompts (proven by the
// replay oracle). The settle-then-classify path is preserved for 'in-progress'/'free'.
//
// The N-consecutive-ticks debounce avoids flicker on a single transient frame that
// momentarily looks like a menu mid-repaint (e.g. a partially-drawn line).

import { type AgentState, classify, SETTLE_MS, TICK_MS } from '../shared/agent-state';

/**
 * Consecutive ticks classify() must return 'waiting' before we emit 'waiting' on the
 * settle-INDEPENDENT fast path. 3 ticks × TICK_MS(100) ≈ 300ms — long enough that a
 * single transient mid-repaint frame doesn't false-fire, short enough that a real
 * permission prompt turns amber promptly even while its footer keeps churning.
 */
export const WAITING_TICKS = 3;

/**
 * Mutable cross-tick detector state. The caller (SessionView's setInterval) owns ONE
 * of these per mounted session and passes it into every tick. Kept as a plain object
 * (not closure-captured) so the decision is a pure (state, frame, now) → verdict
 * function the unit test can drive deterministically.
 */
export interface AgentTickState {
  /** FNV-1a hash of the last frame — drives the settle (frame-equality) detection. */
  lastHash: string | null;
  /** performance.now()-style timestamp of the last frame CHANGE (settle anchor). */
  changeAt: number;
  /** Count of consecutive ticks classify() returned 'waiting' (settle-independent path). */
  waitingStreak: number;
}

/** A fresh detector state (lastHash null → first tick always registers a change). */
export function initAgentTickState(now: number): AgentTickState {
  return { lastHash: null, changeAt: now, waitingStreak: 0 };
}

// FNV-1a — a fast, non-crypto frame-equality hash (record.cjs). NOT a security
// control (T-06.1: this is a frame-change check, not a digest). Exported so the
// SessionView SEAM A and the unit test hash frames identically.
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/**
 * Decide which AgentState a single tick should emit, MUTATING `state` in place
 * (lastHash / changeAt / waitingStreak) so the next tick continues the streak.
 *
 * Decision order (FIX 1):
 *   1. SETTLE-INDEPENDENT 'waiting' fast path — run classify() on EVERY frame. If it
 *      reads 'waiting', bump the streak; once the streak reaches WAITING_TICKS, emit
 *      'waiting' regardless of whether the full-frame hash is still changing (the live
 *      footer churn must not suppress a real permission prompt). A non-'waiting'
 *      classify resets the streak.
 *   2. Frame CHANGED since last tick → 'in-progress' (the animated "Thinking…" line
 *      churns the viewport) and re-arm the settle window.
 *   3. Frame UNCHANGED for >= SETTLE_MS → settled → classify() the settled frame
 *      ('waiting' | 'free'). (A settled menu also resolves here; the fast path just
 *      lets a churning-footer menu resolve to amber sooner.)
 *
 * @param state mutable cross-tick detector state (owned by the caller)
 * @param lines the current viewport lines (xterm translateToString(true) output)
 * @param now   a monotonic timestamp (performance.now() in the renderer)
 * @returns the AgentState this tick implies, or `null` to HOLD the last value (the
 *          unchanged-but-not-yet-settled case) — the caller emits change-only.
 */
export function decideAgentTick(
  state: AgentTickState,
  lines: string[],
  now: number,
): AgentState | null {
  // 1. Settle-INDEPENDENT 'waiting' fast path (the FIX-1 core). classify() only ever
  //    returns 'waiting' for a genuine menu / confirmation prompt (oracle-proven), so
  //    a sustained 'waiting' read is trustworthy even while the footer keeps the
  //    full-frame hash churning.
  const verdict = classify(lines);
  if (verdict === 'waiting') {
    state.waitingStreak += 1;
  } else {
    state.waitingStreak = 0;
  }

  // 2. Frame-change → settle bookkeeping (drives the in-progress / free path below).
  const h = fnv1a(lines.join('\n'));
  const changed = h !== state.lastHash;
  if (changed) {
    state.lastHash = h;
    state.changeAt = now;
  }

  // The settle-independent waiting verdict WINS once it has been stable for
  // WAITING_TICKS — a churning footer can no longer keep a real prompt blue.
  if (state.waitingStreak >= WAITING_TICKS) {
    return 'waiting';
  }

  // 3. Settle-dependent path for in-progress / free (UNCHANGED semantics from the
  //    original SEAM A): a changed frame is 'in-progress'; an unchanged frame that has
  //    held for >= SETTLE_MS is settled → classify(); an unchanged-but-not-yet-settled
  //    frame holds the prior value (null → emit nothing).
  if (changed) {
    return 'in-progress';
  }
  if (now - state.changeAt >= SETTLE_MS) {
    // Settled frame — classify() resolves a static menu to 'waiting' too (the fast
    // path above just gets there sooner when the footer churns).
    return verdict;
  }
  // Unchanged but not yet settled — HOLD the prior value (the original `else` branch
  // emitted nothing here; change-only emission preserves that).
  return null;
}

// Re-export the tick cadence so the SessionView SEAM A imports both the helper and
// the interval from one place (it already imports TICK_MS from agent-state).
export { TICK_MS };
