// Pure coverage for the RENDERER clampToViewport math (10-01 Task 1, D-14).
//
// clampToViewport keeps a measured menu box inside the viewport with a uniform margin.
// Per axis: pos = max(margin, min(desired, size - extent - margin)). This file covers the
// fits-as-is case, both overflow directions, the off-the-top-left clamp, and the
// menu-larger-than-viewport degenerate case (margin must win, never going negative).

import { describe, it, expect } from 'vitest';
import { clampToViewport } from '../viewport-clamp';

describe('clampToViewport — D-14 measure-then-clamp math', () => {
  it('passes a fully-inside box through unchanged', () => {
    expect(clampToViewport(10, 10, 140, 200, 1280, 800, 8)).toEqual({ left: 10, top: 10 });
  });

  it('pulls a right-overflowing box back to viewport-w - w - margin', () => {
    expect(clampToViewport(1200, 10, 140, 200, 1280, 800, 8)).toEqual({ left: 1132, top: 10 });
  });

  it('pulls a bottom-overflowing box up to viewport-h - h - margin', () => {
    expect(clampToViewport(10, 700, 140, 200, 1280, 800, 8)).toEqual({ left: 10, top: 592 });
  });

  it('clamps an off-the-top-left box down to the margin on both axes', () => {
    expect(clampToViewport(2, 2, 140, 200, 1280, 800, 8)).toEqual({ left: 8, top: 8 });
  });

  it('clamps both axes when the box overflows the bottom-right corner', () => {
    expect(clampToViewport(1200, 700, 140, 200, 1280, 800, 8)).toEqual({ left: 1132, top: 592 });
  });

  it('lets the margin win when the box is wider than the viewport (never goes negative)', () => {
    // inner min → 1280 - 2000 - 8 = -728; outer max pulls it back to the margin.
    expect(clampToViewport(50, 10, 2000, 200, 1280, 800, 8)).toEqual({ left: 8, top: 10 });
  });

  it('lets the margin win when the box is taller than the viewport', () => {
    expect(clampToViewport(10, 50, 140, 2000, 1280, 800, 8)).toEqual({ left: 10, top: 8 });
  });

  it('respects a zero margin', () => {
    expect(clampToViewport(1200, 700, 140, 200, 1280, 800, 0)).toEqual({ left: 1140, top: 600 });
  });
});
