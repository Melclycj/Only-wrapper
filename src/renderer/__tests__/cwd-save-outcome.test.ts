// GAP-12-E regression (12-09) — the pure save-time cwd-drop reducer.
//
// Like session-restart-prompt.test.ts / validate-session-form.test.ts this targets the
// React/xterm/electron-free helper (cwd-save-outcome.ts) so it runs in the `node` Vitest
// env with no jsdom. Proves cwdWasDropped reports a drop ONLY when main rejected a
// non-empty submitted cwd (kept the prior dir), never a false positive on an empty or
// unchanged submission, and is trim-insensitive. Also covers the cwdDropNoticeFor
// convenience that threads the per-session lookup + the frozen CWD_DROPPED_NOTICE.

import { describe, it, expect } from 'vitest';
import {
  cwdWasDropped,
  cwdDropNoticeFor,
  CWD_DROPPED_NOTICE,
} from '../cwd-save-outcome';

describe('cwdWasDropped', () => {
  it('true when a non-empty submitted cwd DIFFERS from the persisted cwd (main dropped it)', () => {
    expect(cwdWasDropped('/no/such/dir', '/Users/dev/proj')).toBe(true);
  });

  it('false when the submitted cwd EQUALS the persisted cwd (main accepted it)', () => {
    expect(cwdWasDropped('/Users/dev/proj', '/Users/dev/proj')).toBe(false);
  });

  it('false on an EMPTY submitted cwd (never a false positive — no actionable change)', () => {
    expect(cwdWasDropped('', '/Users/dev/proj')).toBe(false);
  });

  it('false on a WHITESPACE-ONLY submitted cwd (trimmed to empty → no drop)', () => {
    expect(cwdWasDropped('   ', '/Users/dev/proj')).toBe(false);
  });

  it('trim-insensitive: a submission differing only by surrounding whitespace is NOT a drop', () => {
    // main writes the raw submitted value on accept; an accepted path round-trips equal
    // after trimming, so a whitespace-only delta must NOT be reported as a drop.
    expect(cwdWasDropped('  /Users/dev/proj  ', '/Users/dev/proj')).toBe(false);
  });

  it('true when persisted is undefined but a non-empty cwd was submitted (main never persisted it)', () => {
    expect(cwdWasDropped('/no/such/dir', undefined)).toBe(true);
  });

  it('false when persisted is undefined AND the submission is empty', () => {
    expect(cwdWasDropped('', undefined)).toBe(false);
  });
});

describe('cwdDropNoticeFor', () => {
  const persisted = [
    { logicalId: 'a', cwd: '/Users/dev/proj' },
    { logicalId: 'b', cwd: '/home/me' },
  ];

  it('returns the frozen CWD_DROPPED_NOTICE when the targeted session DROPPED its cwd', () => {
    // submitted /no/such for session 'a' whose persisted cwd is still /Users/dev/proj.
    expect(cwdDropNoticeFor('a', '/no/such', persisted)).toBe(CWD_DROPPED_NOTICE);
  });

  it('returns null on a valid save (submitted equals the persisted cwd)', () => {
    expect(cwdDropNoticeFor('a', '/Users/dev/proj', persisted)).toBeNull();
  });

  it('returns null on no cwd change (empty submission)', () => {
    expect(cwdDropNoticeFor('a', '', persisted)).toBeNull();
  });

  it('returns the notice when the session id is absent from the snapshot (undefined persisted)', () => {
    expect(cwdDropNoticeFor('z', '/no/such', persisted)).toBe(CWD_DROPPED_NOTICE);
  });
});
