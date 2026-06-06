// Covers D-12 / Pitfall 5: validateBounds rejects off-screen saved bounds (a rect
// whose top-left falls on a now-disconnected monitor) and accepts on-screen bounds.
// GREEN as of Plan 05-01 (src/main/window-bounds.ts).
//
// Pure-helper test: pass mock `displays` work-area arrays — no Electron screen API.

import { describe, it, expect } from 'vitest';
import { validateBounds, DEFAULT_BOUNDS } from '../window-bounds';

const primary = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
const secondary = { workArea: { x: 1920, y: 0, width: 2560, height: 1440 } };

describe('validateBounds (D-12 / Pitfall 5)', () => {
  it('returns saved bounds when the top-left intersects a display work-area', () => {
    const saved = { x: 100, y: 100, width: 1200, height: 800 };
    expect(validateBounds(saved, [primary])).toEqual(saved);
  });

  it('accepts bounds on a secondary display', () => {
    const saved = { x: 2000, y: 200, width: 1000, height: 700 };
    expect(validateBounds(saved, [primary, secondary])).toEqual(saved);
  });

  it('rejects bounds on a now-disconnected monitor → DEFAULT_BOUNDS', () => {
    // saved on the secondary monitor, but only the primary is connected now.
    const saved = { x: 2000, y: 200, width: 1000, height: 700 };
    expect(validateBounds(saved, [primary])).toEqual(DEFAULT_BOUNDS);
  });

  it('returns DEFAULT_BOUNDS when saved is undefined (first run)', () => {
    expect(validateBounds(undefined, [primary])).toEqual(DEFAULT_BOUNDS);
  });

  it('rejects malformed bounds (non-positive width/height) → DEFAULT_BOUNDS', () => {
    expect(validateBounds({ x: 0, y: 0, width: 0, height: 800 }, [primary])).toEqual(
      DEFAULT_BOUNDS,
    );
    expect(validateBounds({ x: 0, y: 0, width: 1200, height: -1 }, [primary])).toEqual(
      DEFAULT_BOUNDS,
    );
  });

  it('rejects everything when there are no connected displays', () => {
    const saved = { x: 100, y: 100, width: 1200, height: 800 };
    expect(validateBounds(saved, [])).toEqual(DEFAULT_BOUNDS);
  });
});
