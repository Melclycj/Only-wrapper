---
phase: 07-terminal-search-scrollback-config
plan: 02
subsystem: renderer-search-ui
tags: [search, xterm, addon-search, overlay, find-chord, term-10, renderer-only]
requires:
  - "07-01: { kind: 'search' } SwitchIntent variant + matchSearchKey wired into before-input-event over the 'session:switch' channel"
  - "07-01: @xterm/addon-search@0.15.0 installed (pure JS, no native rebuild)"
  - "SessionView addon-mount/cleanup lifecycle (Fit/WebLinks/Unicode11/WebGL) + attachCustomKeyEventHandler focus gate"
  - "SessionManager onSwitchSession 'clear' branch + handleClear + startedSessions.map SessionView render"
provides:
  - "SearchBar.tsx — in-terminal find overlay (mono input, N-of-M count, prev/next, Aa case toggle, close) with always-decorations ISearchOptions"
  - "SearchAddon mounted once per SessionView term + disposed once before term.dispose() (Pitfall 4)"
  - "SessionManager searchOpenId state + onSwitchSession 'search' branch (toggles the active session's bar, never switches active)"
  - "handleCloseSearch + searchOpen/onCloseSearch props threaded to each SessionView"
  - ".search-bar overlay CSS (top-right card, row-control footprint, blue Aa-active accent, no animated layout props)"
affects:
  - "Plan 04 (macOS-first manual verification): the live N-of-M / find-chord / SC3 sign-off runs against this UI"
tech-stack:
  added: []
  patterns:
    - "Sibling-overlay isolation: SearchBar is a DOM sibling of .term-mount (never inside .xterm); <input> onKeyDown stopPropagation keeps chars/Esc off the PTY (Pitfall 3, SC3)"
    - "Decorations-gated count: opts.decorations ALWAYS passed so onDidChangeResults fires (Pitfall 1); resultIndex===-1 over-threshold sentinel handled"
    - "Load-once/dispose-once addon lifecycle on a keep-alive term (mirrors Fit/WebLinks/Unicode11)"
    - "Global-chord channel reuse: find chord rides 'session:switch' as { kind: 'search' } — zero new bridge key"
key-files:
  created:
    - "src/renderer/SearchBar.tsx"
  modified:
    - "src/renderer/SessionView.tsx"
    - "src/renderer/SessionManager.tsx"
    - "src/renderer/terminal.css"
decisions:
  - "SessionView render restructured: outer .session-view wrapper now holds an inner .term-mount div (xterm opens here) + the SearchBar sibling, so the overlay is never a child of .xterm. A new .term-mount { position:absolute; inset:0 } CSS rule fills the wrapper; the fit addon, ResizeObserver, and contextmenu listener all bind to the inner mount."
  - "searchReady useState added on SessionView: searchRef.current is null on the first paint (the addon is created in the mount effect after first render), so a boolean flips post-mount to hand the SearchBar the live addon instead of a stale null."
  - "Decoration colors kept as the UI-SPEC oklch values verbatim (the xterm JSDoc suggests #RRGGBB but the TS type is plain string; modern Chromium renders oklch fine and the UI-SPEC contract is locked)."
  - "Kept the open-effect keyed on `open` only (via queryRef/optsRef latest-value refs) so focus()/select() does not re-fire on every keystroke — re-selecting text on each char would break typing."
metrics:
  duration: ~14min
  tasks: 3
  files: 4
  completed: 2026-06-09
---

# Phase 7 Plan 02: TERM-10 Search Slice Summary

The user-facing terminal search feature, end-to-end: the find chord (Cmd+F mac / Ctrl+F win, intercepted main-side by Plan 01) now flows through a new renderer `'search'` branch into a `searchOpenId` state, which opens a VS Code-style `SearchBar` overlay over the active session's terminal. Typing searches the in-memory xterm scrollback via a `SearchAddon` mounted once per view; Enter/Shift+Enter navigate matches; a live "N of M" count (decorations-gated, with the `resultIndex===-1` over-threshold sentinel) reads from `onDidChangeResults`; an "Aa" toggle flips case-sensitivity; Esc/✕ dismisses. When closed the overlay is unmounted so it never intercepts a keystroke (SC3), and the search `<input>` `stopPropagation()`s so its chars never reach the PTY. Zero new bridge keys — the surface stays at 20.

## What Was Built

**Task 1 — SearchBar overlay + terminal.css styling (`9a7e833`)**
- New `src/renderer/SearchBar.tsx`: presentational sibling-overlay (`{ open, searchAddon, onClose }`), returns null when `!open`. Left→right single row: mono `<input>` → "N of M" count → ‹ prev → › next → Aa → ✕, with all 7 `data-testid` hooks and the exact UI-SPEC copy/aria.
- Always-present `ISearchOptions` with `caseSensitive` + the four verbatim UI-SPEC decoration colors (`matchBackground`/`activeMatchBackground`/`matchOverviewRuler`/`activeMatchColorOverviewRuler`) so `onDidChangeResults` fires (Pitfall 1).
- Count rendering per the copy table: empty query → nothing; `count===0` → "No matches" (`--ink-faint`, not red); `resultIndex===-1` → "{count}+ matches"; else "{index+1} of {count}".
- `onKeyDown` always `stopPropagation()`; Enter→next, Shift+Enter→prev, Escape→onClose (Pitfall 3). On open, auto-focus + select via latest-value refs (no keystroke churn).
- `.search-bar` overlay CSS in `terminal.css`: `top:8px right:8px z-index:5` `--surface` card, `--line` border, radius 10px, rail-tooltip shadow, 4px control gap; `.search-input` JetBrains Mono 14px with blue focus ring; nav/Aa/close reuse the `.row-control` 24×24 radius-7 footprint; `.search-case-active` blue engaged treatment. No animated width/height/top/left.

**Task 2 — SearchAddon lifecycle on SessionView (`41c2f92`)**
- Imported `SearchAddon` + `SearchBar`; added `searchRef` and a `searchReady` flag.
- Mounted `new SearchAddon()` once in the mount effect after Unicode11 (`term.loadAddon(search)`), kept for the term's whole life; disposed `searchRef.current?.dispose()` before `term.dispose()` in cleanup (Pitfall 4).
- Restructured the render: outer `.session-view` wrapper → inner `.term-mount` div (xterm opens here) + `<SearchBar>` sibling, so the overlay is never inside `.xterm`. The mount effect's `container` now resolves to `mountRef.current`.
- Added `searchOpen` / `onCloseSearch` props.

**Task 3 — SessionManager wiring (`9f1e1c2`)**
- Added `searchOpenId` state + a stable `handleCloseSearch`.
- Added the `onSwitchSession` `'search'` branch BEFORE the `resolveSwitch` fallthrough, mirroring `'clear'`: it reads the active id via the `setActiveId` functional updater and toggles `searchOpenId` for that id, returning before any switch (search never changes the active session). The effect dep array is unchanged (`[handleClear]`).
- Passed `searchOpen={s.logicalId === activeId && searchOpenId === s.logicalId}` + `onCloseSearch={handleCloseSearch}` to each `SessionView` (the bar shows only for the active, search-open session).

## Verification

- `npx tsc --noEmit`: clean (0 errors) across SearchBar/SessionView/SessionManager + all touched files.
- `npx eslint` on the three touched renderer files: clean (0 errors).
- `npm run test:unit`: **283 passed (35 files)** — unchanged from the 07-01 baseline (this slice adds no pure logic; it is renderer-only and manual/smoke-verified per 07-VALIDATION.md).
- `security.guard.test.ts`: **4 passed** — `EXPECTED_API_KEYS` is exactly 20; this slice adds ZERO bridge keys.
- `data-testid` count in SearchBar: 7 (`search-bar`, `search-input`, `search-count`, `search-prev`, `search-next`, `search-case`, `search-close`).
- `.search-bar` CSS confirmed to NOT animate width/height/top/left.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] SessionView render restructured to host the SearchBar as a true sibling**
- **Found during:** Task 2.
- **Issue:** The shipped SessionView rendered a single `<div ref={containerRef} className="session-view">` and opened xterm directly on it. There was no inner mount, so a SearchBar child would have landed inside `.xterm` — violating the Pitfall 3 / SC3 requirement that the overlay be a DOM sibling of the terminal (its events must never leak to the PTY).
- **Fix:** Wrapped the terminal in an outer `.session-view` div that now holds an inner `.term-mount` div (xterm opens on `mountRef.current`) + the `<SearchBar>` sibling. Added a `.term-mount { position:absolute; inset:0 }` rule so the mount fills the wrapper (the existing `.session-view .xterm` fill rules still apply since `.xterm` remains a descendant). The mount effect, ResizeObserver, and contextmenu listener now bind to the inner mount.
- **Files modified:** src/renderer/SessionView.tsx, src/renderer/terminal.css.
- **Commits:** `41c2f92` (SessionView), `9a7e833` (the `.term-mount` CSS rule shipped with Task 1's CSS).

**2. [Rule 3 — Blocking issue] `searchReady` flag to hand the SearchBar the live addon**
- **Found during:** Task 2.
- **Issue:** `searchRef.current` is null on the first render (the addon is constructed in the mount effect, which runs after first paint). A SearchBar rendered with `searchAddon={searchRef.current}` would capture that stale null and never search.
- **Fix:** Added a `searchReady` `useState`, flipped true right after `term.loadAddon(search)` and reset false in cleanup; the render passes `searchAddon={searchReady ? searchRef.current : null}`.
- **Files modified:** src/renderer/SessionView.tsx.
- **Commit:** `41c2f92`.

### Note (not a deviation)

The `react-hooks/exhaustive-deps` ESLint rule is not registered in this project's config, so the SearchBar open-effect uses `queryRef`/`optsRef` latest-value refs (rather than a disable comment) to re-run the prior query on open without re-firing `focus()`/`select()` on every keystroke.

## Known Stubs

None. Every wired path carries real data: the SearchBar receives the live `SearchAddon` off the mounted terminal, the query/case-toggle drive real `findNext`/`findPrevious` calls, and the count reads from the real `onDidChangeResults` event. No hardcoded empty values flow to render.

## Threat Flags

None. This slice adds zero new security surface: no new bridge key (the find chord rides the existing `'session:switch'` channel; `EXPECTED_API_KEYS` stays 20), no IPC for the search query (it is renderer-local against the in-memory xterm buffer), and the SearchBar `<input>` `stopPropagation()`s so it never injects into the PTY. All boundaries are accounted for in the plan's `<threat_model>` (T-07-03/04/05/02).

## Self-Check: PASSED
- Files: FOUND src/renderer/SearchBar.tsx, src/renderer/SessionView.tsx, src/renderer/SessionManager.tsx, src/renderer/terminal.css
- Commits: FOUND 9a7e833, 41c2f92, 9f1e1c2
