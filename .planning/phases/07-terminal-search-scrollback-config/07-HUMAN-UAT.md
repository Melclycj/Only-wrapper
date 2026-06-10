---
status: signed-off
phase: 07-terminal-search-scrollback-config
source: [07-04-PLAN.md, 07-VALIDATION.md]
verified_by: human (macOS-first manual checklist)
started: 2026-06-09
updated: 2026-06-10
nyquist_signed_off: true
---

# Phase 7 — Human Verification (macOS-first)

Manual sign-off of the interactive search + scrollback surface per `07-VALIDATION.md`
Manual-Only Verifications. Run during the Plan 07-04 human-verify checkpoint.

**Outcome (initial run, 2026-06-09): NOT signed off — 5 defects found (3 High, 1 Medium, 1 Low).**
**Outcome (re-verify after 07-05 gap-closure, 2026-06-10): SIGNED OFF — all 5 gaps closed.**
`nyquist_compliant` / `wave_0_complete` are now TRUE; TERM-10 / TERM-11 marked Complete.

## Gap Resolution (07-05 gap-closure)

All 5 gaps were behavioral defects in the TERM-10 search slice (TERM-11 passed entirely on
the initial run). Closed in plan 07-05 and re-verified on macOS 2026-06-10:

| Gap | Resolution | Status |
|-----|------------|--------|
| G3 (no highlight) | **Root cause:** decoration colours were `oklch()` — xterm's `css.toColor` rejects translucent non-`rgba()` formats (throws "Unsupported css format" when alpha != 255), so the highlight never painted while the colour-agnostic count still worked. Fixed to regex-safe `rgba()`/hex. | resolved |
| G2 (no repaint until scroll) | Same oklch root cause for the active-match highlight; once the colour parses, the native decoration render + the addon's scroll-into-view paint the active match. The first-attempt `term.refresh` "flush" was wrong (it caused a scroll-freeze by re-hitting the throwing colour every frame) and was removed. | resolved |
| G4 (Aa advances) | `incremental: true` could not hold across a case flip (findNext always advances via `_findNextAndSelect`; on a case change the current selection no longer matches). Replaced with `clearSelection()` before the re-issued findNext → recompute lands on the first match of the new mode, no forward drift. | resolved |
| G1 (no auto-focus) | The rAF imperative focus did not stick. Replaced with the input's `autoFocus` (the bar returns null when closed, so the `<input>` is a fresh mount on every open) + SessionView guards its `term.focus()` on `!searchOpen`. | resolved |
| G5 (no refocus on close) | SessionView refocuses the term on the searchOpen true→false falling edge (was already fixed in the first 07-05 attempt). | resolved |

**Follow-up polish (signed off in the same re-verify):** the active match was initially
indistinguishable from the other matches (two alphas of one amber read the same on the dark
canvas; a faint-yellow wash was too light for white terminal text). Final scheme: a **dark amber**
wash for all matches (white text ≈ 7:1 contrast, readable) + a **bright-orange** active match
(the beacon) — distinguishable by hue + lightness while keeping match text readable.

## Verified PASS (9 / 14 checks)

| Check | Requirement | Result |
|-------|-------------|--------|
| 3 — Enter / Shift+Enter cycles active match fwd/back; "N of M" updates; wraps | TERM-10 / SC1 | ✅ |
| 5 — no-match shows "No matches" (not red) | TERM-10 / D-01 | ✅ |
| 6 — Esc / ✕ dismisses the bar | TERM-10 / SC3 | ✅ |
| 8 — macOS Ctrl+F does NOT open the search bar (no readline/PTY theft) | TERM-10 / D-03 | ✅ (search bar stayed closed under `claude`; key passed through) |
| 9 — sidebar gear opens Preferences showing current scrollback | TERM-11 / SC2 | ✅ |
| 10 — scrollback change live-applies to open + new sessions | TERM-11 / SC2 / D-05 | ✅ (live trim observed; exact 1000 not precisely measured) |
| 11 — out-of-range value snaps to nearest bound + hint | TERM-11 / D-04 | ✅ |
| 12 — lowering scrollback trims existing rows | TERM-11 / D-06 | ✅ (and raising the cap does NOT restore trimmed rows — confirmed expected) |
| 13 — value persists across full quit + reopen | TERM-11 / D-07 | ✅ |

## Gaps (must fix before sign-off)

### GAP-07-G2 — search match not repainted until manual scroll  [HIGH]
- **Check 1.** On a found match the viewport scroll position updates (scrollbar moves) but the
  **rendered terminal content does not repaint** — the active match is not visible until the user
  manually scrolls up/down to nudge a redraw.
- **Requirement:** TERM-10 / SC1 ("navigate through matching occurrences in the scrollback buffer"
  — the match must be visible after navigation).
- **Likely root cause:** WebGL renderer not refreshed after `findNext`/`findPrevious`
  `scrollToLine`. Candidate fixes: trigger a render after search (`term.refresh(0, term.rows-1)`
  or an explicit scroll sync), and/or addon load-order between `@xterm/addon-webgl` and
  `@xterm/addon-search`. Needs investigation against the live WebGL canvas.

### GAP-07-G3 — match decorations show no highlight color  [HIGH]
- **Check 2.** Matches are NOT visually highlighted (no amber/active highlight) even though the
  "N of M" count is correct, so `onDidChangeResults` fires but `decorations` do not paint.
- **Requirement:** TERM-10 / D-01 ("`decorations` — highlight all matches").
- **Likely root cause (CORRECTED after source read):** the decoration colors ARE already
  configured correctly — `SearchBar.tsx` `MATCH_DECORATIONS` passes `matchBackground` /
  `activeMatchBackground` / `matchOverviewRuler` / `activeMatchColorOverviewRuler` verbatim from
  07-UI-SPEC §Color, and `onDidChangeResults` fires (the count works). So this is NOT a missing-
  config bug. The decorations are configured but do not PAINT → strongly points to the
  `@xterm/addon-webgl` renderer not rendering inline search-match decorations (a known xterm
  WebGL/decoration interaction). Shares the GAP-07-G2 root area (WebGL not painting search
  output). REQUIRES research into xterm WebGL + SearchAddon decoration rendering, then verify on
  the live canvas — do NOT just re-add colors that are already present.

### GAP-07-G4 — "Aa" toggle navigates instead of recomputing  [HIGH]
- **Check 4.** Clicking "Aa" advances to the next matched target instead of re-running the search
  with the toggled `caseSensitive` option and recomputing the count + highlights.
- **Requirement:** TERM-10 / D-01 ("case-sensitive (Aa) toggle ... using its `caseSensitive`
  option").
- **Likely root cause (CORRECTED after source read):** the Aa handler DOES re-issue the search
  with the new `caseSensitive` flag (`SearchBar.tsx` toggle → `runSearch(query, { caseSensitive:
  next, ... })`), but `runSearch` calls `addon.findNext(...)`, which ADVANCES to the next match
  instead of re-evaluating in place. The fix is to make the toggle recompute the result set +
  count without advancing the active match (e.g. reset/`noScroll`-style re-search, or restore the
  prior active index after the recompute), so the count + highlights reflect the new case mode
  without jumping forward.

### GAP-07-G1 — search input does not auto-focus on open  [MEDIUM]
- **Check 1.** When the search bar opens, the `<input>` is not focused — the user must click it
  before typing.
- **Requirement:** TERM-10 / SC1 (the bar should be immediately usable).
- **Likely root cause (CORRECTED after source read):** a focus effect already exists
  (`SearchBar.tsx` on-open `useEffect` → `inputRef.current.focus()` + select), so this is NOT a
  missing-call bug — the effect runs but the input is not ending up focused. Likely a timing/race:
  the effect fires before the input is actually mounted/visible, or the terminal's focus
  management (xterm `term.focus()` / `attachCustomKeyEventHandler`) steals focus back after the
  bar opens, or the `searchReady` post-mount flip re-renders past the focus. Investigate the
  open→mount→focus ordering against the live DOM.

### GAP-07-G5 — terminal not auto-refocused after close  [LOW]
- **Check 7.** After closing the search bar, focus does not return to the terminal — the user must
  click the terminal again before typing reaches the shell. (Once re-clicked, typing works
  normally — no input interference, so SC3's no-interference contract holds.)
- **User note:** flagged as possibly-intended; lowest priority.
- **Likely root cause:** missing `term.focus()` on search-bar close.

## Notes / open observations
- Check 8 ("no reaction on Ctrl+F when claude is up"): the critical fidelity behavior holds — the
  search bar did **not** open on macOS Ctrl+F, and the key passed through to the PTY (`claude`'s
  TUI does not bind Ctrl+F, hence "no reaction"). Optional further confidence: in a plain
  zsh/bash readline prompt, Ctrl+F should move the cursor one char forward (forward-char).
- Check 10: live-apply works; the exact 1000-line boundary was not precisely measured (trim was
  observed, just not counted). Not treated as a gap.

*Re-verify all 5 gaps on macOS after the fixes land, then sign off to flip
`nyquist_compliant: true` + mark TERM-10 / TERM-11 complete.*
