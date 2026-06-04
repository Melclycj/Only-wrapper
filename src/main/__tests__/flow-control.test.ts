// Wave 0 failing stub — covers SC5 flow-control accounting (watermark).
// This test INTENTIONALLY FAILS RED until Plan 02-02 creates
// src/main/flow-control.ts (the module does not exist yet, so the import below
// throws at load time and the whole suite is RED).
//
// Contract under test (02-RESEARCH Pattern 4 — canonical xterm.js watermark,
// https://xtermjs.org/docs/guides/flowcontrol/):
//   createWatermark(high, low) returns an accountant exposing:
//     - add(n):      add n bytes to the running total
//     - drain(n):    subtract n bytes; the total clamps at 0 (never negative)
//     - shouldPause():  true once total > HIGH (100000)
//     - shouldResume(): true once total < LOW  (10000)
//     - total:       the current readable running byte total
//
// The "watermark" keyword in this comment also satisfies the must-have grep.
//
// When Plan 02-02 turns these GREEN, delete this banner.

import { describe, it, expect } from 'vitest';
import { createWatermark } from '../flow-control';

const HIGH = 100000;
const LOW = 10000;

describe('watermark flow-control accounting (SC5, 02-RESEARCH Pattern 4)', () => {
  it('starts not paused and resumable (total 0)', () => {
    const wm = createWatermark(HIGH, LOW);
    expect(wm.total).toBe(0);
    expect(wm.shouldPause()).toBe(false);
  });

  it('signals PAUSE once the running total exceeds HIGH', () => {
    const wm = createWatermark(HIGH, LOW);
    wm.add(HIGH); // exactly at HIGH — not yet over
    expect(wm.shouldPause()).toBe(false);
    wm.add(1); // now strictly above HIGH
    expect(wm.total).toBe(HIGH + 1);
    expect(wm.shouldPause()).toBe(true);
  });

  it('signals RESUME once draining brings the total below LOW', () => {
    const wm = createWatermark(HIGH, LOW);
    wm.add(HIGH + 1);
    expect(wm.shouldPause()).toBe(true);
    wm.drain(HIGH); // total now LOW+1 ... still not below LOW
    expect(wm.shouldResume()).toBe(false);
    wm.drain(2); // cross below LOW
    expect(wm.total).toBeLessThan(LOW);
    expect(wm.shouldResume()).toBe(true);
  });

  it('never lets the total go negative (drain past zero clamps at 0)', () => {
    const wm = createWatermark(HIGH, LOW);
    wm.add(500);
    wm.drain(10000); // drain far more than was added
    expect(wm.total).toBe(0);
    expect(wm.total).toBeGreaterThanOrEqual(0);
  });
});
