// RENDERER ONLY — a pure, electron/xterm-free decision for the search "Aa" case
// toggle (07-05 Task 1, TERM-10 / GAP-07-G4). Mirrors the shape of scrollback-clamp.ts:
// a tiny pure helper isolating the one branch that is unit-testable without a DOM/xterm.
//
// GAP-07-G4 (CORRECTED root cause): the Aa toggle DID re-issue the search with the new
// `caseSensitive` flag, but it routed through the plain `findNext` path, which ADVANCES
// to the next match — so each Aa click jumped the active match forward instead of just
// recomputing the count + highlights for the new case mode.
//
// This helper encodes only the "recompute vs no-op" decision: an empty bar has nothing
// to recompute (it stays calm, matching the empty-query clear path in runSearch); a
// non-empty query recomputes. The NON-ADVANCING guarantee is enforced at the SearchBar
// level — when `shouldRecompute` is true, the toggle re-issues the search with
// `incremental: true`, which (per @xterm/addon-search ISearchOptions) "expands the
// selection if it still matches the term the user typed" rather than stepping to the
// next match. That live behavior is confirmed on the macOS WebGL canvas in the 07-05
// human-verify (Task 3); the branch selection is what this helper makes unit-testable.
//
// PURE — no I/O, no electron, no React, no xterm; unit-tested directly
// (search-recompute.test.ts).

/** The decision an Aa case-toggle must make for a given query. */
export interface CaseToggleDecision {
  /**
   * True when the toggle should recompute the match set (count + decorations) for the
   * flipped case mode IN PLACE (without advancing the active match). False when the
   * query is empty — there is nothing to recompute and the bar stays calm.
   */
  shouldRecompute: boolean;
}

/**
 * Decide whether toggling case-sensitivity should recompute the search in place.
 *
 * - Non-empty query → `{ shouldRecompute: true }` (re-highlight + re-count for the new
 *   case mode without stepping the active match forward — the G4 fix).
 * - Empty query `''` → `{ shouldRecompute: false }` (nothing to recompute; mirrors the
 *   empty-query clear path in SearchBar.runSearch).
 */
export function decideCaseToggle(query: string): CaseToggleDecision {
  return { shouldRecompute: query.length > 0 };
}
