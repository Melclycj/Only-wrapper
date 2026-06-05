// Wave 0 RED stub (04-01 Task 1) — covers SESS-03 / D-09 icon-spec builders.
//
// INTENTIONALLY FAILS RED until 04-01 Task 2 implements src/renderer/icon-spec.ts
// (emojiSpec / colorSpec / COLOR_INITIAL). Targets the React/xterm/electron-free
// pure module so it runs in the Node/Vitest env (mirrors session-close.test.ts).

import { describe, it, expect } from 'vitest';
import { emojiSpec, colorSpec, COLOR_INITIAL } from '../icon-spec';
import type { SessionIconSpec } from '../../shared/types';

describe('icon-spec builders (SESS-03, D-09)', () => {
  it('emojiSpec wraps a value into an emoji SessionIconSpec', () => {
    expect(emojiSpec('🛋️')).toEqual({ type: 'emoji', value: '🛋️' });
  });

  it('emojiSpec stores a free-text emoji grapheme verbatim (no split — Pitfall 6)', () => {
    // A flag emoji is a multi-codepoint grapheme cluster; it must be stored whole.
    const flag = '🇯🇵';
    expect(emojiSpec(flag)).toEqual({ type: 'emoji', value: flag });
    expect(emojiSpec(flag).value).toBe(flag);
  });

  it('colorSpec wraps a value into a color SessionIconSpec', () => {
    expect(colorSpec('oklch(0.7 0.1 60)')).toEqual({
      type: 'color',
      value: 'oklch(0.7 0.1 60)',
    });
  });

  it('COLOR_INITIAL returns the uppercased first letter of the name for a color spec', () => {
    const spec: SessionIconSpec = { type: 'color', value: '#fff' };
    expect(COLOR_INITIAL(spec, 'dev')).toBe('D');
    expect(COLOR_INITIAL(spec, 'api server')).toBe('A');
  });

  it('COLOR_INITIAL falls back to a bullet for an empty name on a color spec', () => {
    const spec: SessionIconSpec = { type: 'color', value: '#fff' };
    expect(COLOR_INITIAL(spec, '')).toBe('•');
    expect(COLOR_INITIAL(spec, '   ')).toBe('•');
  });

  it('COLOR_INITIAL returns empty string for a non-color spec', () => {
    expect(COLOR_INITIAL({ type: 'emoji', value: '🛋️' }, 'dev')).toBe('');
  });
});
