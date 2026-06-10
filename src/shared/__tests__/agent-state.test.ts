// Unit coverage of the frame-stability agent-state classifier (TERM-09, Axis 2,
// D-09/D-10). Pure Node env — no Electron/xterm. Mirrors flow-control.test.ts.
//
// Covers every case in Plan 06.1-01 Task-1 <behavior>: the WAITING signal set
// (claude footer / numbered menu / [y/n] / trailing '?' / password), the
// authoritative-FREE shell prompt, the 002 kill-finding (`❯`-only frames are FREE),
// empty inputs, and a ReDoS-bounded pathological line. classify() consumes a viewport
// LINE ARRAY (as xterm's translateToString(true) produces), not a single tail string.

import { describe, it, expect } from 'vitest';
import { classify, TICK_MS, SETTLE_MS } from '../agent-state';

describe('classify — WAITING signals (D-10)', () => {
  it("claude confirmation footer → 'waiting'", () => {
    expect(
      classify(['  Esc to cancel · Tab to amend · ctrl+e to explain']),
    ).toBe('waiting');
  });

  it("numbered menu (≥2 'N.' lines) → 'waiting'", () => {
    expect(
      classify([
        'Choose an option:',
        '❯ 1. Yes, run it',
        '  2. No, cancel',
        '  3. Always allow',
      ]),
    ).toBe('waiting');
  });

  it("a single numbered line is NOT a menu → 'free'", () => {
    expect(classify(['1. only one item'])).toBe('free');
  });

  it("[y/N] bracket → 'waiting'", () => {
    expect(classify(['Continue? [y/N] '])).toBe('waiting');
  });

  it("(y/n) / (yes/no) brackets → 'waiting' (case-insensitive)", () => {
    expect(classify(['Overwrite (y/n) '])).toBe('waiting');
    expect(classify(['Proceed (yes/no)'])).toBe('waiting');
    expect(classify(['Delete file (Y/N) '])).toBe('waiting');
  });

  it("trailing '?' → 'waiting'", () => {
    expect(classify(['Are you sure? '])).toBe('waiting');
  });

  it("password prompt → 'waiting'", () => {
    expect(classify(['Password: '])).toBe('waiting');
    expect(classify(["Enter passphrase for key '/id_rsa': "])).toBe(
      'waiting',
    );
  });
});

describe('classify — authoritative FREE (D-10)', () => {
  it("shell prompt '%' on the active line → 'free'", () => {
    expect(classify(['user@host project %'])).toBe('free');
  });

  it("shell prompt '$' on the active line → 'free'", () => {
    expect(classify(['user@host ~ $'])).toBe('free');
  });

  it('a shell prompt below a scrolled-up menu is still FREE (active line wins)', () => {
    expect(
      classify([
        '❯ 1. Yes',
        '  2. No',
        '  3. Always',
        'user@host project % ',
      ]),
    ).toBe('free');
  });
});

describe('classify — the 002 kill-finding: `❯` is NOT a signal (D-10)', () => {
  it("a frame containing ONLY the `❯` input caret (no footer/menu) → 'free'", () => {
    expect(classify(['  ❯ '])).toBe('free');
  });

  it("the ambient `❯` status bar (Claude idle input box) → 'free'", () => {
    expect(
      classify([
        '╭──────────────────────────────────────────╮',
        '│ ❯                                          │',
        '╰──────────────────────────────────────────╯',
        '  Remote Control active',
      ]),
    ).toBe('free');
  });
});

describe('classify — empty / idle inputs → free', () => {
  it("empty array → 'free'", () => {
    expect(classify([])).toBe('free');
  });

  it("a single empty string → 'free'", () => {
    expect(classify([''])).toBe('free');
  });

  it("idle text with no prompt signals → 'free'", () => {
    expect(classify(['idle text', ''])).toBe('free');
  });

  it("a mid-sentence '?' is NOT a trailing question → 'free'", () => {
    expect(classify(['Why did this fail? Let me check the logs.'])).toBe(
      'free',
    );
  });
});

describe('classify — ReDoS safety (T-06.1-01 / ASVS V5)', () => {
  it('a pathological 100k-char single line returns within the same call (bounded)', () => {
    const huge = 'a'.repeat(100_000);
    const start = Date.now();
    const result = classify([huge]);
    const elapsed = Date.now() - start;
    expect(result).toBe('free');
    // Linear, anchored regexes → no catastrophic backtracking. Generous ceiling.
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('exported tick/settle contract', () => {
  it('TICK_MS is within the Nyquist bound (≤250ms)', () => {
    expect(TICK_MS).toBe(100);
    expect(TICK_MS).toBeLessThanOrEqual(250);
  });

  it('SETTLE_MS is within the 400–600ms discretion window', () => {
    expect(SETTLE_MS).toBe(500);
    expect(SETTLE_MS).toBeGreaterThanOrEqual(400);
    expect(SETTLE_MS).toBeLessThanOrEqual(600);
  });
});
