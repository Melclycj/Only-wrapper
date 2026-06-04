// IPC arg-validation unit tests (Security Domain V5, threat_model 02-02).
//
// These cover the PURE validation helpers exported from pty-manager.ts WITHOUT
// spawning a real node-pty (the spawn path is covered by the E2E smoke in
// 02-03/02-04). Importing pty-manager.ts also imports node-pty at module load;
// node-pty is marked `external` in vite.main.config.ts and loads its N-API
// prebuild fine under Vitest's Node env, so this import is safe here.
//
// Contracts under test:
//   - clampDimension: 0/NaN/negative → 1; >1000 → 1000; in-range floored; (T-02-03)
//   - isStringData: only real strings pass the write type-guard;            (T-02-02)

import { describe, it, expect } from 'vitest';
import {
  clampDimension,
  isStringData,
  MIN_DIMENSION,
  MAX_DIMENSION,
} from '../pty-manager';

describe('clampDimension — resize-bomb DoS guard (T-02-03, Security V5)', () => {
  it('maps 0 to the minimum dimension (1)', () => {
    expect(clampDimension(0)).toBe(MIN_DIMENSION);
    expect(clampDimension(0)).toBe(1);
  });

  it('clamps an over-large dimension down to MAX_DIMENSION (1000)', () => {
    expect(clampDimension(5000)).toBe(MAX_DIMENSION);
    expect(clampDimension(5000)).toBe(1000);
  });

  it('passes an in-range dimension through unchanged', () => {
    expect(clampDimension(80)).toBe(80);
    expect(clampDimension(24)).toBe(24);
  });

  it('maps NaN to the minimum dimension (1)', () => {
    expect(clampDimension(Number.NaN)).toBe(1);
  });

  it('maps negative dimensions to the minimum (1)', () => {
    expect(clampDimension(-5)).toBe(1);
    expect(clampDimension(-1000)).toBe(1);
  });

  it('maps non-finite Infinity to MAX_DIMENSION (1000)', () => {
    expect(clampDimension(Number.POSITIVE_INFINITY)).toBe(1000);
  });

  it('floors a fractional dimension', () => {
    expect(clampDimension(80.9)).toBe(80);
    expect(clampDimension(1.5)).toBe(1);
  });
});

describe('isStringData — write type guard (T-02-02, Security V5)', () => {
  it('accepts a string', () => {
    expect(isStringData('ls -la')).toBe(true);
    expect(isStringData('')).toBe(true);
  });

  it('rejects non-string data', () => {
    expect(isStringData(42)).toBe(false);
    expect(isStringData(null)).toBe(false);
    expect(isStringData(undefined)).toBe(false);
    expect(isStringData({})).toBe(false);
    expect(isStringData(['a'])).toBe(false);
    expect(isStringData(Buffer.from('x'))).toBe(false);
  });
});
