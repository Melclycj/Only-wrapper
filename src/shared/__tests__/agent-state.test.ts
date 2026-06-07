// RED→GREEN unit coverage of the pure agent-state classifier (TERM-09, SC4,
// D-06/D-08/D-09). Pure Node env — no Electron/xterm. Mirrors flow-control.test.ts.
//
// Covers every case in the Plan-01 Task-1 <behavior> block PLUS the explicit
// false-positive guards: a naked shell prompt ('$' / '%') is 'free', and a
// mid-sentence '?' is 'free' (PROMPT_RE is anchored with `\s*$`).

import { describe, it, expect } from 'vitest';
import {
  IDLE_MS,
  PROMPT_RE,
  lastNonEmptyLine,
  classifyIdle,
} from '../agent-state';

describe('lastNonEmptyLine (ANSI strip + trailing-blank skip)', () => {
  it('strips ANSI and returns the last non-blank line (trailing blanks skipped)', () => {
    expect(lastNonEmptyLine('earlier output\n\x1b[32mok\x1b[0m\n\n')).toBe('ok');
  });

  it('returns "" for an empty string', () => {
    expect(lastNonEmptyLine('')).toBe('');
  });

  it('returns "" for an all-whitespace tail', () => {
    expect(lastNonEmptyLine('   \n\t\n  ')).toBe('');
  });

  it('returns the last line when there are no trailing blanks', () => {
    expect(lastNonEmptyLine('first\nsecond\nthird')).toBe('third');
  });
});

describe('classifyIdle (conservative anchored PROMPT_RE — D-09)', () => {
  it("'Continue? [y/N] ' → waiting", () => {
    expect(classifyIdle('Continue? [y/N] ')).toBe('waiting');
  });

  it("'Are you sure? ' → waiting (trailing '?')", () => {
    expect(classifyIdle('Are you sure? ')).toBe('waiting');
  });

  it("'Proceed (yes/no): ' → free — the ':' suffix is NOT in the anchored set", () => {
    // PROMPT_RE is anchored with `\s*$`; '(yes/no)' followed by ':' is not at line
    // end, so the colon-suffixed prompt does NOT match. Documented per the <behavior>
    // block: the ':' suffix is OUT of set (a bare '(yes/no)' at line end WOULD match).
    expect(classifyIdle('Proceed (yes/no): ')).toBe('free');
    expect(classifyIdle('Proceed (yes/no)')).toBe('waiting');
  });

  it("'Selection ❯ ' → waiting (arrow-menu marker)", () => {
    expect(classifyIdle('Selection ❯ ')).toBe('waiting');
  });

  it("naked shell prompt 'user@host project %' → free ('%'/'$' NOT in set)", () => {
    expect(classifyIdle('user@host project %')).toBe('free');
    expect(classifyIdle('user@host project $')).toBe('free');
  });

  it("mid-sentence '?' → free (PROMPT_RE anchored with \\s*$)", () => {
    expect(classifyIdle('Why did this fail? Let me check the logs.')).toBe('free');
  });

  it("empty tail → free", () => {
    expect(classifyIdle('')).toBe('free');
  });

  it('case-insensitive y/n variants → waiting', () => {
    expect(classifyIdle('Overwrite? [Y/n] ')).toBe('waiting');
    expect(classifyIdle('Delete file (y/n) ')).toBe('waiting');
  });

  it('classifies the last non-empty line, ignoring trailing blanks', () => {
    expect(classifyIdle('building...\nDone? \n\n')).toBe('waiting');
  });
});

describe('exported constants', () => {
  it('IDLE_MS is 800 (D-08)', () => {
    expect(IDLE_MS).toBe(800);
  });

  it('PROMPT_RE is exported and anchored to end-of-line', () => {
    expect(PROMPT_RE.source.endsWith('\\s*$')).toBe(true);
  });
});
