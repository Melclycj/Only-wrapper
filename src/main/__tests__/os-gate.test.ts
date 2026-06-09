// Covers D-05 / SC4: parseWindowsBuild extracts the BUILD (3rd) component of an
// os.release() string; isUnsupportedWindows gates ONLY win32 hosts with a
// parseable build below MIN_WINDOWS_BUILD (17763 = Windows 10 1809, the ConPTY
// floor). Fail-OPEN on an unparseable release; non-win32 never gated.
//
// Pure-helper test (mirrors shell-discovery.test.ts): fixture os.release()
// strings, no real os call.

import { describe, it, expect } from 'vitest';
import {
  MIN_WINDOWS_BUILD,
  parseWindowsBuild,
  isUnsupportedWindows,
} from '../os-gate';

describe('MIN_WINDOWS_BUILD (D-05)', () => {
  it('is the Windows 10 1809 ConPTY floor (17763)', () => {
    expect(MIN_WINDOWS_BUILD).toBe(17763);
  });
});

describe('parseWindowsBuild (D-05)', () => {
  it('reads the BUILD (3rd) component of a major.minor.build release', () => {
    expect(parseWindowsBuild('10.0.17763')).toBe(17763);
    expect(parseWindowsBuild('10.0.17134')).toBe(17134);
  });

  it('ignores a 4th component (UBR) and reads the build', () => {
    expect(parseWindowsBuild('10.0.22631.1')).toBe(22631);
  });

  it('returns null for an unparseable release', () => {
    expect(parseWindowsBuild('garbage')).toBeNull();
    expect(parseWindowsBuild('')).toBeNull();
  });
});

describe('isUnsupportedWindows (D-05 / SC4)', () => {
  it('blocks a win32 build below the 17763 floor', () => {
    expect(isUnsupportedWindows('win32', '10.0.17134')).toBe(true);
  });

  it('allows a win32 build AT the floor (inclusive-OK)', () => {
    expect(isUnsupportedWindows('win32', '10.0.17763')).toBe(false);
  });

  it('allows a win32 build above the floor', () => {
    expect(isUnsupportedWindows('win32', '10.0.22631')).toBe(false);
  });

  it('never gates a non-win32 platform', () => {
    expect(isUnsupportedWindows('darwin', '25.0.0')).toBe(false);
    expect(isUnsupportedWindows('linux', '6.1.0')).toBe(false);
  });

  it('fails OPEN on an unparseable win32 release (does NOT block)', () => {
    expect(isUnsupportedWindows('win32', 'unparseable')).toBe(false);
  });
});
