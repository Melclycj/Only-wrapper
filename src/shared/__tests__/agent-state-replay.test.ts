// Offline classifier-regression ORACLE (TERM-09, Axis 2 — D-09/D-10). Replays the
// REAL `claude --rc` capture from spike 002 against the production frame-stability
// `classify()` and the same `@xterm/headless` viewport the app renders, asserting the
// kill-finding ground truth: 11 settles -> exactly 1 WAITING (the @29s confirmation),
// every other settle FREE. This is the test that fails loudly if anyone re-introduces
// the arrow caret (U+276F) as a waiting signal.
//
// CAPTURE SHAPE (important — drives the replay design): the spike recorder
// (`record.cjs`) writes a FORENSIC log, not raw PTY bytes. Each line of
// `capture-claude.jsonl` is a JSON event: `spawn` / `tick` (viewport hash) / `state` /
// `settle` / `exit`. A `settle` at `threshold === 400` carries the settled active line
// (`last`) and the per-signal booleans (`sig`) the recorder observed — there are NO raw
// `data` frames in the file (verified at authoring time: event counts are
// {spawn:1, tick:513, state:11, settle:28, exit:1}; 11 of the settles are at
// threshold 400). So this oracle CANNOT feed raw bytes through term.write. Instead it
// RECONSTRUCTS each settled viewport frame from the recorded `last` + `sig`, writes that
// frame into a real @xterm/headless Terminal (pinned 5.5.0 — byte-identical viewport to
// production), reads it back through the SAME `viewportLines()` shape `record.cjs` uses
// (b.viewportY .. +rows, translateToString(true)), and runs the production `classify()`.
// This keeps @xterm/headless genuinely in the loop AND ties the oracle to the shipping
// classifier — the spike's own `reanalyze.cjs` reproduces the identical 11->1 count.
//
// (Plan 06.1-01 Task 2; deviation noted in SUMMARY: the plan's literal "replay PTY data
// frames" is impossible against this forensic capture — there are no data frames — so the
// oracle is built the faithful way the spike itself proved the finding.)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Terminal } from '@xterm/headless';
import { classify, SETTLE_MS, type AgentState } from '../agent-state';

const CAPTURE_PATH = join(
  process.cwd(),
  '.planning',
  'spikes',
  '002-real-agent-frames',
  'capture-claude.jsonl',
);

const COLS = 80;
const ROWS = 24;

interface SettleSignals {
  trailing_question: boolean;
  yn_bracket: boolean;
  arrow_marker: boolean;
  numbered_menu: boolean;
  claude_footer: boolean;
  shell_prompt: boolean;
  password_prompt: boolean;
}

interface CaptureEvent {
  ms: number;
  ev: 'spawn' | 'tick' | 'state' | 'settle' | 'exit';
  threshold?: number;
  last?: string;
  verdict?: string;
  sig?: SettleSignals;
}

/** Read the forensic capture and return the settle events at the smallest threshold. */
function loadSettles(): CaptureEvent[] {
  const raw = readFileSync(CAPTURE_PATH, 'utf8').trim().split('\n');
  const events: CaptureEvent[] = raw.map((l) => JSON.parse(l) as CaptureEvent);
  return events.filter((e) => e.ev === 'settle' && e.threshold === 400);
}

/**
 * Reconstruct a representative settled viewport from a recorded settle event. The
 * recorder stored only the active line (`last`) and the per-signal booleans, so we
 * rebuild the cursor region those signals imply (a numbered menu when `numbered_menu`
 * fired) and append the recorded active line. classify() inspects the last 4 non-empty
 * lines, so this region is what it would have seen live.
 */
function reconstructFrame(e: CaptureEvent): string[] {
  const sig = e.sig as SettleSignals;
  const frame: string[] = [];
  if (sig.numbered_menu) {
    // The recorder saw >=2 "N." lines (a confirmation menu). Use Claude's real menu
    // shape; the leading caret is the U+276F glyph (non-decisive menu-item marker).
    frame.push('❯ 1. Yes, run it', '  2. No, cancel', '  3. Always allow');
  }
  frame.push(e.last ?? '');
  return frame;
}

/**
 * Mirror of `record.cjs` viewportLines (l.46-55): read the visible region of a headless
 * Terminal — b.viewportY .. +rows — as translateToString(true) lines. The SAME shape the
 * production renderer (SessionView SEAM A, Plan 02) ticks over.
 */
function viewportLines(term: Terminal): string[] {
  const b = term.buffer.active;
  const top = b.viewportY;
  const out: string[] = [];
  for (let i = 0; i < term.rows; i++) {
    const ln = b.getLine(top + i);
    out.push(ln ? ln.translateToString(true) : '');
  }
  return out;
}

/**
 * Write a reconstructed frame into a fresh headless Terminal and classify the parsed
 * viewport. xterm parses asynchronously; the write callback fires after the parse, so we
 * await it (deterministic — NO real timers, NO waitForTimeout) before reading the buffer.
 */
function classifySettleFrame(frame: string[]): Promise<AgentState> {
  return new Promise((resolve) => {
    const term = new Terminal({
      cols: COLS,
      rows: ROWS,
      scrollback: 2000,
      allowProposedApi: true,
    });
    term.write(frame.join('\r\n'), () => {
      const verdict = classify(viewportLines(term));
      term.dispose();
      resolve(verdict);
    });
  });
}

describe('agent-state offline replay oracle (capture-claude.jsonl)', () => {
  it('the capture exists and yields 11 settle events at the smallest threshold', () => {
    const settles = loadSettles();
    expect(settles).toHaveLength(11);
  });

  it('reproduces "11 settles -> exactly 1 WAITING" via @xterm/headless + classify()', async () => {
    const settles = loadSettles();
    let waitingCount = 0;
    let freeCount = 0;
    const waitingTimestamps: number[] = [];

    for (const settle of settles) {
      // Write the reconstructed settled frame into a real headless viewport, then read
      // it back the exact way production does and classify the live buffer lines.
      const verdict = await classifySettleFrame(reconstructFrame(settle));

      if (verdict === 'waiting') {
        waitingCount += 1;
        waitingTimestamps.push(settle.ms);
      } else {
        freeCount += 1;
      }
    }

    // The kill-finding ground truth (spike 002 reanalyze.cjs): exactly one WAITING.
    expect(waitingCount).toBe(1);
    expect(freeCount).toBe(10);
    // ...and it is the @29s confirmation (footer + numbered menu), nothing else.
    expect(waitingTimestamps).toHaveLength(1);
    expect(waitingTimestamps[0]).toBeGreaterThanOrEqual(28_000);
    expect(waitingTimestamps[0]).toBeLessThanOrEqual(30_000);
  });

  it('every non-@29s settle (idle box / splash / exit) classifies FREE — the caret is not a signal', async () => {
    const settles = loadSettles();
    for (const settle of settles) {
      const isTheConfirmation = settle.ms >= 28_000 && settle.ms <= 30_000;
      if (isTheConfirmation) continue;

      // Even when the recorder logged arrow_marker for this settle (it did on 10/11),
      // the production classifier must read FREE — the caret (U+276F) is NOT a signal.
      const verdict = await classifySettleFrame(reconstructFrame(settle));
      expect(verdict).toBe('free');
    }
  });

  it('the settle/threshold window is consistent with the shared SETTLE_MS contract', () => {
    // The capture's smallest threshold (400ms) is within the shared settle window
    // exported by agent-state.ts (the renderer settles at SETTLE_MS=500).
    expect(SETTLE_MS).toBeGreaterThanOrEqual(400);
  });
});
