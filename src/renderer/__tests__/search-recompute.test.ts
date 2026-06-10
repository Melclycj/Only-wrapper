// Pure coverage for the RENDERER search-recompute helper (07-05 Task 1, TERM-10 / G4).
//
// GAP-07-G4: clicking "Aa" advanced the active match forward instead of recomputing
// the count + highlights in place. The recompute-vs-no-op branch is isolated here as a
// pure, xterm-free decision (mirrors scrollback-clamp.ts) so it unit-tests in the node
// Vitest env without a DOM/WebGL canvas. The non-advancing guarantee itself is enforced
// at the SearchBar level (the toggle routes through `incremental: true` findNext, which
// expands the current selection in place) and confirmed on the live macOS canvas in the
// 07-05 human-verify (Task 3).

import { describe, it, expect } from 'vitest';
import { decideCaseToggle } from '../search-recompute';

describe('decideCaseToggle — Aa recompute-in-place decision (TERM-10, G4)', () => {
  it('recomputes for a non-empty query', () => {
    expect(decideCaseToggle('ls')).toEqual({ shouldRecompute: true });
    expect(decideCaseToggle('test')).toEqual({ shouldRecompute: true });
    // A single non-whitespace char still has something to recompute.
    expect(decideCaseToggle('a')).toEqual({ shouldRecompute: true });
  });

  it('does NOT recompute for an empty query (an empty bar stays calm)', () => {
    expect(decideCaseToggle('')).toEqual({ shouldRecompute: false });
  });
});
