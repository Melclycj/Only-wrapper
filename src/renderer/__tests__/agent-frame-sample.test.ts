// GAP-10-J scroll-invariance regression (10-14, round-5 gap-closure). THE lock for
// the "scrolling the session history flips the sidebar status" defect: the operator
// reported "when i scrolling the session history up, the status changes from free to
// in progress to waiting for you." Root cause — SessionView's viewportLines() sampled
// the agent-state classifier frame from `term.buffer.active.getLine(b.viewportY + i)`.
// `viewportY` is the VISIBLE viewport top, which MOVES into scrollback when the user
// scrolls up, so classify() re-read an OLD permission menu and the status flipped.
//
// The fix samples from the LIVE TAIL — `buffer.baseY` (the top of the live region;
// baseY === viewportY only when scrolled to the bottom, viewportY < baseY when scrolled
// up). We drive the PURE sampleAgentFrame helper (no DOM, no xterm) with a fake buffer
// and prove: (1) the sampled frame is IDENTICAL whether scrolled to bottom or up into
// scrollback; (2) an OLD 'waiting' menu sitting in scrollback no longer classifies as
// 'waiting' (classify reads the live shell tail at baseY); (3) a buffer whose LIVE tail
// actually holds a menu still classifies 'waiting' (the sampler still sees a real prompt).

import { describe, it, expect } from 'vitest';
import { sampleAgentFrame } from '../agent-tick';
import { classify } from '../../shared/agent-state';

// Minimal structural fake of xterm's IBuffer: a line map + baseY/viewportY. getLine
// returns a { translateToString } shim for present lines, undefined for absent ones
// (mirroring xterm's getLine, which returns undefined past the buffer end).
function fakeBuffer(
  lineMap: Record<number, string>,
  baseY: number,
  viewportY: number,
): {
  baseY: number;
  viewportY: number;
  getLine(line: number): { translateToString(trim: boolean): string } | undefined;
} {
  return {
    baseY,
    viewportY,
    getLine(line: number) {
      if (line in lineMap) {
        const text = lineMap[line];
        return { translateToString: () => text };
      }
      return undefined;
    },
  };
}

// An OLD permission menu (classify → 'waiting') left in SCROLLBACK at rows 0..3, while
// the LIVE tail at baseY..baseY+rows is a plain shell prompt (classify → 'free').
const ROWS = 6;
const BASE_Y = 200;

function scrollbackMenuLiveShell(viewportY: number) {
  const lineMap: Record<number, string> = {
    // OLD waiting menu in scrollback (the user scrolled up to here).
    0: 'Do you want to proceed?',
    1: '❯ 1. Yes, run it',
    2: '  2. No, cancel',
    3: '  3. Always allow',
    // LIVE tail at baseY — a plain shell prompt + blank padding.
    [BASE_Y]: 'user@host project %',
    [BASE_Y + 1]: '',
    [BASE_Y + 2]: '',
    [BASE_Y + 3]: '',
    [BASE_Y + 4]: '',
    [BASE_Y + 5]: '',
  };
  return fakeBuffer(lineMap, BASE_Y, viewportY);
}

// A buffer whose LIVE tail at baseY actually holds a permission menu (classify →
// 'waiting') — the sampler must still detect a genuine live prompt.
function liveTailMenu() {
  const lineMap: Record<number, string> = {
    [BASE_Y]: 'Do you want to proceed?',
    [BASE_Y + 1]: '❯ 1. Yes, run it',
    [BASE_Y + 2]: '  2. No, cancel',
    [BASE_Y + 3]: '  3. Always allow',
    [BASE_Y + 4]: '',
    [BASE_Y + 5]: '',
  };
  return fakeBuffer(lineMap, BASE_Y, BASE_Y);
}

describe('sampleAgentFrame — GAP-10-J scroll invariance', () => {
  it('samples the LIVE tail (baseY), identical whether scrolled to bottom or up', () => {
    // Scrolled to bottom: viewportY === baseY.
    const atBottom = sampleAgentFrame(scrollbackMenuLiveShell(BASE_Y), ROWS);
    // Scrolled UP into the old scrollback menu: viewportY far below baseY.
    const scrolledUp = sampleAgentFrame(scrollbackMenuLiveShell(0), ROWS);

    // The sampled line set is IDENTICAL — scroll position must not change the frame.
    expect(scrolledUp).toEqual(atBottom);
    // And it is the LIVE tail (shell prompt), not the scrollback menu.
    expect(atBottom[0]).toBe('user@host project %');
  });

  it('does NOT classify as waiting when only SCROLLBACK holds a menu (both scroll positions)', () => {
    const atBottom = classify(sampleAgentFrame(scrollbackMenuLiveShell(BASE_Y), ROWS));
    const scrolledUp = classify(sampleAgentFrame(scrollbackMenuLiveShell(0), ROWS));

    expect(atBottom).not.toBe('waiting');
    expect(scrolledUp).not.toBe('waiting');
    // The live shell tail is authoritative FREE.
    expect(atBottom).toBe('free');
    expect(scrolledUp).toBe('free');
  });

  it('still classifies as waiting when the LIVE tail at baseY holds a real menu', () => {
    const frame = sampleAgentFrame(liveTailMenu(), ROWS);
    expect(classify(frame)).toBe('waiting');
  });

  it('yields empty strings for lines past the buffer end (preserves the ln ? : "" semantics)', () => {
    // A buffer with only baseY populated; the remaining rows return undefined → ''.
    const buf = fakeBuffer({ [BASE_Y]: 'only one line' }, BASE_Y, BASE_Y);
    const frame = sampleAgentFrame(buf, ROWS);
    expect(frame).toHaveLength(ROWS);
    expect(frame[0]).toBe('only one line');
    expect(frame.slice(1)).toEqual(['', '', '', '', '']);
  });
});
