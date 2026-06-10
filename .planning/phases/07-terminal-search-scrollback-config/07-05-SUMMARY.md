---
phase: 07-terminal-search-scrollback-config
plan: 05
gap_closure: true
subsystem: renderer-search-defect-fixes
tags: [term-10, search, webgl, decorations, oklch, focus, gap-closure, human-verified]
requires:
  - "07-02: SearchBar overlay + SearchAddon + sibling-overlay structure (the slice being fixed)"
  - "07-03: SessionView term + WebGL attach (owns the term the fixes plumb against)"
provides:
  - "search-recompute.ts — pure decideCaseToggle(query) gate for the G4 case-toggle recompute"
  - "Renderable search-match decorations (regex-safe rgba/hex, not oklch) — highlights actually paint on the WebGL canvas"
  - "G1 autoFocus, G4 reset-to-first recompute, G5 refocus-on-close — the full G1..G5 closure"
affects:
  - "Phase 7 sign-off: nyquist_compliant + wave_0_complete flipped true; TERM-10 / TERM-11 marked Complete"
key-files:
  created:
    - "src/renderer/search-recompute.ts"
    - "src/renderer/__tests__/search-recompute.test.ts"
  modified:
    - "src/renderer/SearchBar.tsx"
    - "src/renderer/SessionView.tsx"
decisions:
  - "G3/G2 ROOT CAUSE was the decoration colour FORMAT, not the renderer. The colours were authored in oklch() per 07-UI-SPEC §Color; xterm's css.toColor only fast-paths #hex/rgb()/rgba() and sends every other format through a <canvas> round-trip that throws 'Unsupported css format' when alpha != 255 — so the two TRANSLUCENT oklch match backgrounds never painted while the colour-agnostic onDidChangeResults count still worked. Converted to regex-safe rgba()/hex (same visual colour). oklch elsewhere in the app is fine: it renders via CSS (DOM), not xterm's parser."
  - "The plan's 'MATCH_DECORATIONS LOCKED / do not touch' constraint was based on the WRONG diagnosis ('colours are correct'). Deliberately overrode it (hard-rule: fix root cause, don't mechanically follow a plan premised on a wrong hypothesis) while preserving the design GOAL — same amber family, only the unparseable string format corrected."
  - "Removed the first-attempt term.refresh(0,rows-1) render-flush: it was the wrong G2/G3 hypothesis AND caused a scroll-freeze (forcing a full repaint re-hit the throwing oklch colour every frame). Once colours parse, native decoration render + the addon's scroll-into-view suffice — no manual flush."
  - "G4: incremental:true cannot hold across a case flip (findNext always advances via _findNextAndSelect; on a case change the current selection stops matching → it advances anyway — verified against the 0.15.0 addon source). Replaced with clearSelection() before the re-issued findNext: recompute lands on the FIRST match of the new mode (deterministic, no forward drift)."
  - "G1: the rAF imperative focus did not stick; switched to the input's autoFocus (reliable because the bar returns null when closed → the <input> is a fresh mount on every open) + SessionView guards term.focus() on !searchOpen so nothing re-steals."
  - "Active-match distinction (human-verify follow-up): two alphas of one amber were indistinguishable on the live canvas, and a faint-yellow wash was too light for white terminal text. Final: DARK amber wash for all matches (white text ~7:1, readable) + BRIGHT orange active match (the beacon) — distinct by hue+lightness, matches stay readable. Light colour lives only on the single active cell, not the many matches."
metrics:
  tasks: 3
  files: 4
  human_verify_rounds: 2 (initial fail → re-verify pass after iterative colour-contrast tuning)
  completed: 2026-06-10
  nyquist_flipped: true
---

# Phase 7 Plan 05: Search Defect Gap-Closure (G1..G5) Summary

Closed the 5 search defects (G1..G5) found in the Plan 07-04 macOS human-verify. All 5 were
behavioral defects in the TERM-10 search slice (implementation present, misbehaving on the live
WebGL canvas) — TERM-11 (scrollback) had passed entirely. The headline finding: the missing
highlights (G2/G3) were not a WebGL or decoration-config problem at all, but a **colour-format**
bug — the decoration colours were `oklch()`, which xterm's own parser cannot read. This was found
by reading xterm's `css.toColor` in the installed bundle, not by guessing. After the code fixes,
the active-match colour took a short iterative tuning loop with the user to land on a scheme that
is both distinguishable and keeps white terminal text readable.

## What Was Built

**Task 1 — G4 pure helper + Aa recompute (`315936f` RED, `cdda32c` GREEN, refined in `d102fd9`)**
- New `src/renderer/search-recompute.ts` — pure `decideCaseToggle(query): { shouldRecompute }`
  (non-empty → recompute, empty → no-op), mirroring the scrollback-clamp.ts pure-helper shape;
  unit-tested in `search-recompute.test.ts` (node env, no DOM).
- `SearchBar.handleToggleCase` re-wired: gate on `decideCaseToggle`, then `clearSelection()` (via
  SessionView's `onResetSearchPosition`) before the re-issued `findNext` so the recompute lands on
  the first match of the new case mode — no forward drift (the first-attempt `incremental:true` was
  proven unable to hold across a case flip).

**Task 2 — G3/G2 colour fix, G1/G5 focus, freeze removal (`5163122`, `d102fd9`, colour tuning `838a5b3`)**
- **G3/G2 (the breakthrough):** `MATCH_DECORATIONS` converted from `oklch()` to regex-safe
  `rgba()`/hex. xterm's `css.toColor` throws "Unsupported css format" on translucent non-`rgba`
  colours, so the oklch match backgrounds silently failed to paint. Final colours: dark-amber wash
  `rgba(211,120,18,0.32)` for all matches (white text ~7:1, readable), bright-orange
  `rgba(255,145,40,0.9)` for the active match (the beacon), with matching overview-ruler ticks.
- **Freeze fix:** removed the first-attempt `term.refresh(0,rows-1)` render-flush (SessionView's
  `requestSearchRefresh` → replaced by the G4 `resetSearchPosition`). It was the wrong G2/G3
  hypothesis and caused a scroll-freeze by re-hitting the throwing oklch colour every frame.
- **G1:** input `autoFocus` (fresh mount on every open) + SessionView guards `term.focus()` on
  `!searchOpen` so the activate effect no longer re-steals focus out of the search input.
- **G5:** SessionView refocuses the term on the `searchOpen` true→false falling edge (active view).

**Task 3 — BLOCKING macOS-first re-verify + sign-off (this step)**
- The user re-ran G1..G5 on macOS. Initial re-verify still failed 4/5 (the first-attempt guesses);
  after the oklch root-cause fix + the focus/recompute corrections + an iterative active-match
  colour-contrast tuning loop, the user approved all 5 gaps closed with nothing regressed.
- On approval: `nyquist_compliant: true` + `wave_0_complete: true` in 07-VALIDATION.md; 07-HUMAN-UAT.md
  signed off with a per-gap resolution table; TERM-10 + TERM-11 marked Complete in REQUIREMENTS.md.

## Verification

- `npm run test:unit`: **292 passed (37 files)** — +2 from the new `search-recompute.test.ts` over
  the 290 baseline; all prior suites unchanged.
- `npx tsc --noEmit`: clean. `npx eslint` on the touched/created renderer files: clean.
- `src/shared/__tests__/security.guard.test.ts`: GREEN — `EXPECTED_API_KEYS` stays **20** (no bridge
  change; the fix is renderer-local — no IPC, no persistence, no new dependency).
- `MATCH_DECORATIONS` colours: changed by design (oklch→rgba, the G3 root-cause fix) — the visual
  amber/orange family is preserved; only the unparseable format and the contrast were corrected.
- macOS-first human-verify: all G1..G5 confirmed closed + the no-regression checks (Esc dismiss,
  closed-bar no-interference, macOS Ctrl+F readline survival) re-confirmed. User approved 2026-06-10.

## Deviations from Plan

1. **Overrode the "MATCH_DECORATIONS LOCKED" constraint.** The plan said the colours were correct
   and must not change. They were the actual root cause (unparseable oklch). Fixing them was required
   to close G2/G3; the design intent (same amber) was preserved.
2. **First-attempt fixes (incremental Aa / term.refresh flush) were wrong and were replaced**, not
   layered on. The first re-verify caught this (4/5 still failing + a new scroll-freeze); the root
   cause was then found by reading xterm's `css.toColor` and the addon's findNext source.
3. **Added an iterative active-match colour-contrast loop** (not in the plan) to satisfy the user's
   readability requirement (white terminal text on the highlight) — converged on dark-amber matches
   + bright-orange active.

## Known Stubs

None. Every wired path carries real behaviour. The G2/G3 WebGL visual outcomes and the G1/G5 live
focus behaviour were the explicitly-manual surfaces — all human-verified on macOS in Task 3.

## Threat Flags

None. Renderer-local fix: no new bridge key (`EXPECTED_API_KEYS` stays 20, security.guard GREEN),
no IPC, no persistence change, no new dependency. Decoration colours are DOM/canvas overlays via
`registerDecoration` — never written into the PTY (SC3 isolation preserved and re-confirmed).

## Self-Check: PASSED
- Files: FOUND src/renderer/search-recompute.ts, src/renderer/__tests__/search-recompute.test.ts, src/renderer/SearchBar.tsx, src/renderer/SessionView.tsx
- Commits: FOUND 315936f, cdda32c, aa9fb81, 5163122, d102fd9, ad6ec35, 6cc1bc4, 838a5b3
- Nyquist: flipped true on user sign-off (2026-06-10); TERM-10/TERM-11 Complete
