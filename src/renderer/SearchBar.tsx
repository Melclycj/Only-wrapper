// RENDERER ONLY — the in-terminal find overlay (07-02, TERM-10 / SC1 / SC3).
//
// A VS Code-style search bar that floats over the active session's terminal
// (07-UI-SPEC §1). It is a SIBLING DOM overlay (NOT inside `.xterm`), so its
// keystrokes never reach the PTY: the <input>'s onKeyDown calls stopPropagation()
// (07-RESEARCH Pitfall 3) and handles Enter/Shift+Enter/Esc locally. The query is
// matched against the active session's in-memory xterm buffer via the SearchAddon —
// it NEVER crosses IPC and is NEVER written into the PTY (consistent with handleClear
// never injecting `clear`). When `open` is false the component returns null, so a
// closed bar cannot intercept any keystroke (SC3 locked).
//
// The match count is read from the decorations-gated `onDidChangeResults` event
// (07-RESEARCH Pitfall 1): `opts.decorations` MUST always be passed or the event
// never fires. A `resultIndex === -1` value is the over-threshold sentinel — the
// count is shown without a current index ("{count}+ matches").
//
// Regex / whole-word are DEFERRED (D-01) — only case-sensitivity (Aa) ships here.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ISearchOptions, SearchAddon } from '@xterm/addon-search';
import { decideCaseToggle } from './search-recompute';

export interface SearchBarProps {
  open: boolean;
  // The SearchAddon loaded on this view's terminal (SessionView's searchRef.current).
  // Null until the term mounts; the bar tolerates a null addon (renders, no-op search).
  searchAddon: SearchAddon | null;
  onClose: () => void;
  /**
   * GAP-07-G4: reset the terminal's search-start position (SessionView clears the xterm
   * selection) so a case-mode toggle RE-HIGHLIGHTS from the top — landing deterministically
   * on the first match of the new mode instead of stepping +1 forward each click. Optional +
   * null-safe so the bar still works before the term mounts.
   */
  onResetSearchPosition?: () => void;
}

// Search-match decorations (07-UI-SPEC §Color, D-01). decorations MUST always be
// present so `onDidChangeResults` fires (Pitfall 1). The two overview-ruler fields
// are REQUIRED (non-optional) by the xterm ISearchDecorationOptions type. Amber wash
// for all matches; strong amber for the active match; blue active overview tick.
//
// GAP-07-G2/G3 ROOT CAUSE (07-05 re-verify): these were authored in oklch() to mirror
// 07-UI-SPEC §Color verbatim — but xterm's `css.toColor` only fast-paths #hex / rgb() /
// rgba(); every OTHER format (incl. oklch) falls to a <canvas> round-trip that THROWS
// "Unsupported css format" whenever the resulting alpha !== 255. The two TRANSLUCENT
// match backgrounds (alpha 0.32 / 0.7) therefore threw at RENDER time and never painted —
// the "N of M" count still worked because onDidChangeResults is colour-agnostic. That is
// the exact G3 (no highlight) + G2 (no active-match paint) symptom. Fix: keep the SAME
// visual amber/blue, but express it in regex-safe rgba()/hex so xterm can parse it
// (oklch(0.66 0.15 60) → rgb(211,120,18) / #d37812; oklch(0.62 0.14 248) → #328bd6).
// The COLOUR is unchanged — only the unparseable string FORMAT is corrected.
const MATCH_DECORATIONS = {
  matchBackground: 'rgba(211, 120, 18, 0.32)',
  activeMatchBackground: 'rgba(211, 120, 18, 0.7)',
  matchOverviewRuler: '#d37812',
  activeMatchColorOverviewRuler: '#328bd6',
} as const;

interface MatchState {
  // resultIndex from onDidChangeResults: 0-based active match, or -1 over threshold.
  index: number;
  // resultCount: total matches (capped at the addon's highlight limit).
  count: number;
}

const NO_MATCHES: MatchState = { index: 0, count: 0 };

export function SearchBar({
  open,
  searchAddon,
  onClose,
  onResetSearchPosition,
}: SearchBarProps): React.JSX.Element | null {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchState, setMatchState] = useState<MatchState>(NO_MATCHES);
  const inputRef = useRef<HTMLInputElement>(null);
  const countId = useId();

  // Latest-value ref for the reset callback so the toggle handler can call it WITHOUT
  // listing it in its dep array (it is a fresh closure on every SessionView render —
  // depending on it would needlessly re-create the callbacks).
  const onResetSearchPositionRef = useRef(onResetSearchPosition);
  onResetSearchPositionRef.current = onResetSearchPosition;

  // The always-decorations search options (Pitfall 1). Memoized on caseSensitive so a
  // toggle produces a fresh opts object that re-runs the query.
  const opts = useMemo<ISearchOptions>(
    () => ({ caseSensitive, decorations: { ...MATCH_DECORATIONS } }),
    [caseSensitive],
  );

  // Drive a search. Empty query → clear decorations + reset the count (an empty bar is
  // calm, no highlights). findNext always passes opts.decorations so the count event
  // fires for non-empty queries.
  const runSearch = useCallback(
    (term: string, searchOpts: ISearchOptions) => {
      const addon = searchAddon;
      if (!addon) return;
      if (term.length === 0) {
        addon.clearDecorations();
        setMatchState(NO_MATCHES);
        return;
      }
      addon.findNext(term, searchOpts);
    },
    [searchAddon],
  );

  // Subscribe to the decorations-gated result event while open. Unsubscribe on
  // close/unmount (no dangling listener — composes with the addon dispose in
  // SessionView, Pitfall 4).
  useEffect(() => {
    if (!open) return;
    const addon = searchAddon;
    if (!addon) return;
    const sub = addon.onDidChangeResults(({ resultIndex, resultCount }) => {
      setMatchState({ index: resultIndex, count: resultCount });
    });
    return () => sub.dispose();
  }, [open, searchAddon]);

  // Latest-value refs so the open effect can re-run the prior query + select it
  // WITHOUT depending on `query`/`opts` (which would re-fire focus()/select() on every
  // keystroke and break typing). The effect is keyed on `open` only; keystroke-driven
  // search is handled inline by handleQueryChange.
  const queryRef = useRef(query);
  queryRef.current = query;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // On open: select any prior query so re-typing replaces it (07-UI-SPEC §1) and re-run
  // the prior query so its highlights/count come back.
  //
  // GAP-07-G1 (07-05 re-verify): the rAF-scheduled focus() still did not STICK. The bar
  // returns null when closed, so the <input> is a FRESH mount on every open — the
  // reliable way to focus a fresh mount is the DOM's own `autoFocus` (applied at commit,
  // immune to the effect-timing / rAF-cleanup races that defeated the imperative focus).
  // The <input> now carries autoFocus; SessionView still guards its term.focus() on
  // !searchOpen so nothing re-steals it. This effect only restores the prior query
  // (select for replace) + re-highlights — focus is owned by autoFocus.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.select();
    runSearch(queryRef.current, optsRef.current);
  }, [open, runSearch]);

  // On close (open → false): clear decorations so a re-open starts clean and the
  // terminal is not left with stale highlights.
  useEffect(() => {
    if (open) return;
    searchAddon?.clearDecorations();
  }, [open, searchAddon]);

  const handleQueryChange = useCallback(
    (next: string) => {
      setQuery(next);
      runSearch(next, opts);
    },
    [runSearch, opts],
  );

  const handleToggleCase = useCallback(() => {
    setCaseSensitive((prev) => {
      const next = !prev;
      // GAP-07-G4 (07-05 re-verify): recompute the count + highlights for the FLIPPED case
      // mode WITHOUT drifting forward. The first attempt re-issued findNext with
      // `incremental: true` on the theory it would "expand the selection in place" — but
      // findNext ALWAYS advances via the addon's _findNextAndSelect, and on a case flip the
      // current selection no longer matches under the new mode, so incremental falls through
      // to the advancing branch anyway (verified against the 0.15.0 addon source) → the +1
      // jump persisted. Instead we CLEAR the term's search-start selection (SessionView's
      // onResetSearchPosition → term.clearSelection()) so the re-issued findNext searches
      // from the TOP and lands deterministically on the FIRST match of the new mode: no
      // unbounded forward drift, and toggling twice returns to the same (first) match.
      // _highlightAllMatches still re-fires because the options changed, so the count +
      // all-match decorations recompute for the flipped mode. decideCaseToggle gates this
      // (empty bar = no-op, mirroring runSearch's empty-query clear). Fresh opts built here
      // since `opts` (memo) has not recomputed yet in this updater.
      const addon = searchAddon;
      if (addon && decideCaseToggle(query).shouldRecompute) {
        onResetSearchPositionRef.current?.();
        addon.findNext(query, {
          caseSensitive: next,
          decorations: { ...MATCH_DECORATIONS },
        });
      }
      return next;
    });
  }, [searchAddon, query]);

  const handleNext = useCallback(() => {
    if (query.length === 0) return;
    searchAddon?.findNext(query, opts);
  }, [searchAddon, query, opts]);

  const handlePrev = useCallback(() => {
    if (query.length === 0) return;
    searchAddon?.findPrevious(query, opts);
  }, [searchAddon, query, opts]);

  // Input keydown: Enter → next, Shift+Enter → prev, Esc → close. ALWAYS
  // stopPropagation() so chars/Enter/Esc go to this DOM input, never the PTY
  // (Pitfall 3 — the bar is a sibling overlay, but stopPropagation belts-and-braces
  // against the global before-input-event chord listener).
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) handlePrev();
        else handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [handleNext, handlePrev, onClose],
  );

  if (!open) return null;

  // Count copy (07-UI-SPEC Copywriting table):
  //  - empty query → render nothing (calm open-empty state)
  //  - count === 0 → "No matches" (--ink-faint, NOT red — an empty result is not an error)
  //  - resultIndex === -1 (over threshold) → "{count}+ matches" (no current index)
  //  - else → "{index + 1} of {count}"
  let countText = '';
  let countMuted = false;
  if (query.length > 0) {
    if (matchState.count === 0) {
      countText = 'No matches';
      countMuted = true;
    } else if (matchState.index === -1) {
      countText = `${matchState.count}+ matches`;
    } else {
      countText = `${matchState.index + 1} of ${matchState.count}`;
    }
  }

  return (
    <div className="search-bar" data-testid="search-bar" role="search">
      {/* GAP-07-G1: autoFocus is the reliable focus path here — the bar returns null when
          closed, so this <input> is a fresh mount on every open, and the user reached it by
          an explicit Cmd+F (so grabbing focus is the expected, requested behavior, not a
          surprise focus-steal). */}
      <input
        ref={inputRef}
        type="text"
        className="search-input"
        data-testid="search-input"
        aria-label="Search terminal"
        aria-describedby={countText ? countId : undefined}
        placeholder="Search this terminal"
        value={query}
        spellCheck={false}
        autoComplete="off"
        autoFocus
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span
        id={countId}
        className={countMuted ? 'search-count search-count-empty' : 'search-count'}
        data-testid="search-count"
        aria-live="polite"
      >
        {countText}
      </span>
      <button
        type="button"
        className="search-control"
        data-testid="search-prev"
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
        onClick={handlePrev}
      >
        <span aria-hidden="true">{'‹'}</span>
      </button>
      <button
        type="button"
        className="search-control"
        data-testid="search-next"
        aria-label="Next match"
        title="Next match (Enter)"
        onClick={handleNext}
      >
        <span aria-hidden="true">{'›'}</span>
      </button>
      <button
        type="button"
        className={
          caseSensitive ? 'search-control search-case-active' : 'search-control'
        }
        data-testid="search-case"
        aria-label="Match case"
        aria-pressed={caseSensitive}
        title="Match case"
        onClick={handleToggleCase}
      >
        Aa
      </button>
      <button
        type="button"
        className="search-control"
        data-testid="search-close"
        aria-label="Close search"
        title="Close search (Esc)"
        onClick={onClose}
      >
        <span aria-hidden="true">{'✕'}</span>
      </button>
    </div>
  );
}
