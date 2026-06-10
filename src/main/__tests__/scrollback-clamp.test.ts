// Wave 0 RED (07-01 Task 1) — covers clampScrollback (TERM-11, D-04).
//
// INTENTIONALLY RED until 07-01 Task 2 implements clampScrollback in
// src/main/store-schema.ts. Targets the pure, electron-free clamp helper (mirrors
// coerceOnLoad in the same module: in/out assertions, no I/O) so it runs in the
// Node/Vitest env with no Electron process.
//
// Contract (D-04): clamp any input to the inclusive range 1000–50000 with default
// 5000; non-finite / non-number → 5000; a fractional value is rounded.

import { describe, it, expect } from 'vitest';
import { clampScrollback } from '../store-schema';

describe('clampScrollback (TERM-11, D-04)', () => {
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

  it('rounds a fractional in-range value', () => {
    expect(clampScrollback(4999.6)).toBe(5000);
    expect(clampScrollback(2000.4)).toBe(2000);
  });
});
