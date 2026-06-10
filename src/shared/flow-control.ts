// Pure, electron-free, node-pty-free flow-control accounting (SC5).
//
// This is the RENDERER's half of the canonical xterm.js watermark backpressure
// pattern (https://xtermjs.org/docs/guides/flowcontrol/). Flow control is
// renderer-driven (02-RESEARCH §Flow Control, recommendation (a)): the renderer
// counts bytes queued into xterm via the term.write() callback and decides when
// to call window.api.ptyPause()/ptyResume(); main just pauses/resumes the
// node-pty child. This module is the accountant the renderer actually USES — it
// lives in shared/ (pure TypeScript, no electron/node-pty import) so the
// renderer can import it AND Vitest can exercise it in a plain Node env. It is
// NOT dead code: TerminalPane wires every method (add/drain + the pause/resume
// edge predicates) into the live PTY data stream.
//
// RESEARCH Pattern 4: HIGH=100000 / LOW=10000 are the documented call-site
// defaults (see WATERMARK_HIGH / WATERMARK_LOW below); createWatermark takes
// them as params so the thresholds remain tunable.

/** Documented default thresholds from 02-RESEARCH Pattern 4 (xterm.js guide). */
export const WATERMARK_HIGH = 100000;
export const WATERMARK_LOW = 10000;

/**
 * A watermark accountant: tracks the running unacknowledged byte total and
 * exposes hysteresis edge predicates so the caller toggles pause/resume ONCE per
 * transition (no resume spam, no lost resume — CR-02).
 */
export interface Watermark {
  /** Add `n` bytes to the running total (a chunk was queued into xterm). */
  add(n: number): void;
  /** Subtract `n` bytes (a chunk was parsed by xterm); clamps the total at 0. */
  drain(n: number): void;
  /** True once the running total is strictly above HIGH — time to pause(). */
  shouldPause(): boolean;
  /** True once the running total is strictly below LOW — safe to resume(). */
  shouldResume(): boolean;
  /** Current running byte total (read-only view). */
  readonly total: number;
}

/**
 * Create a watermark accountant for backpressure.
 *
 * Contract (02-RESEARCH Pattern 4, asserted by flow-control.test.ts):
 *   - total starts at 0; shouldPause() false, shouldResume() true
 *   - add(n) increments total
 *   - drain(n) decrements total but clamps at 0 (never negative)
 *   - shouldPause()  === total > high  (strictly above HIGH)
 *   - shouldResume() === total < low   (strictly below LOW)
 *
 * @param high HIGH watermark — pause the PTY once the backlog exceeds this.
 * @param low  LOW watermark — resume the PTY once the backlog drops below this.
 */
export function createWatermark(high: number, low: number): Watermark {
  let total = 0;

  return {
    add(n: number): void {
      total += n;
    },
    drain(n: number): void {
      // Clamp at 0 so an over-eager drain can never make the total negative.
      total = Math.max(total - n, 0);
    },
    shouldPause(): boolean {
      return total > high;
    },
    shouldResume(): boolean {
      return total < low;
    },
    get total(): number {
      return total;
    },
  };
}
