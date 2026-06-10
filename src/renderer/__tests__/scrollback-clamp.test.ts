// Pure coverage for the RENDERER clampScrollback (07-03 Task 1, TERM-11 / D-04).
//
// Mirrors src/main/__tests__/scrollback-clamp.test.ts — the renderer copy must agree
// with the main helper EXACTLY (defense in depth: renderer clamp is the input UX,
// the main clamp is the persistence security boundary). Both clamp to [1000, 50000]
// with default 5000; non-finite / non-number → 5000; a fractional value is rounded.

import { describe, it, expect } from 'vitest';
import { clampScrollback } from '../scrollback-clamp';

describe('clampScrollback — renderer mirror (TERM-11, D-04)', () => {
  it('clamps a below-minimum value up to 1000', () => {
    expect(clampScrollback(999)).toBe(1000);
    expect(clampScrollback(0)).toBe(1000);
    expect(clampScrollback(-5000)).toBe(1000);
  });

  it('clamps an above-maximum value down to 50000', () => {
    expect(clampScrollback(99999)).toBe(50000);
    expect(clampScrollback(50001)).toBe(50000);
  });

  it('passes an in-range value through unchanged', () => {
    expect(clampScrollback(5000)).toBe(5000);
    expect(clampScrollback(1000)).toBe(1000);
    expect(clampScrollback(50000)).toBe(50000);
  });

  it('defaults to 5000 for undefined / null', () => {
    expect(clampScrollback(undefined)).toBe(5000);
    expect(clampScrollback(null)).toBe(5000);
  });

  it('defaults to 5000 for non-finite numbers (NaN / Infinity)', () => {
    expect(clampScrollback(Number.NaN)).toBe(5000);
    expect(clampScrollback(Number.POSITIVE_INFINITY)).toBe(5000);
    expect(clampScrollback(Number.NEGATIVE_INFINITY)).toBe(5000);
  });

  it('defaults to 5000 for a non-number input (string / object)', () => {
    expect(clampScrollback('5000')).toBe(5000);
    expect(clampScrollback({})).toBe(5000);
    expect(clampScrollback([])).toBe(5000);
  });

  it('rounds a fractional value (D-04 round semantics)', () => {
    expect(clampScrollback(3000.7)).toBe(3001);
    expect(clampScrollback(4999.6)).toBe(5000);
    expect(clampScrollback(2000.4)).toBe(2000);
  });
});
