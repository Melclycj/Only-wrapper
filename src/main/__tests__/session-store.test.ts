// RED until Plan 05-02 implements src/main/session-store.ts
//
// This file establishes the SessionStore CONTRACT (PERS-01 / PERS-02 / D-13) so
// Plan 05-02 implements against fixed expectations:
//   - round-trip: write records → read back → all 8 SessionRecord fields intact,
//     every restored record coerced dormant (coerceOnLoad: status not_started,
//     ptyPid cleared — D-01/SC2).
//   - corrupt-file recovery: a malformed store JSON is backed up to `.corrupt-*`
//     and a fresh store is started — load() NEVER throws (D-13 / discretion).
//   - debounce + quit flush (D-13): scheduleSave() coalesces burst writes on a
//     ~300ms trailing timer; flush() writes the pending change; the trailing
//     write is never lost on quit.
//
// The expectations are written as `it.todo` markers (NOT live assertions) so the
// full Vitest suite COLLECTS this file without a missing-module import error while
// Plan 05-02 is still pending. Plan 05-02 replaces these todos with real tests that
// import `../session-store` and exercise the SessionStore class (round-trip via a
// temp file, an injected corrupt file, and Vitest fake timers for the debounce).

import { describe, it } from 'vitest';

describe('SessionStore (PERS-01 / PERS-02 / D-13) — RED until Plan 05-02', () => {
  // src/main/session-store.ts does not exist yet (Plan 05-02). These todos are the
  // contract the implementation must satisfy; flip each to a real test in 05-02.
  it.todo('round-trips all 8 SessionRecord fields through write → read');
  it.todo('coerces every restored record dormant on load (not_started, ptyPid cleared)');
  it.todo('backs up a corrupt store to .corrupt-* and starts fresh without throwing');
  it.todo('debounces scheduleSave() bursts on a ~300ms trailing timer (D-13)');
  it.todo('flush() writes the pending change so the trailing write is never lost on quit');
});
