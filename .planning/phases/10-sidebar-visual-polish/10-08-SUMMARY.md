---
phase: 10-sidebar-visual-polish
plan: 08
subsystem: renderer-sidebar-css
tags: [css, sidebar, layout, gap-closure, GAP-10-E, WR-01, WR-02]
requires:
  - "src/renderer/sidebar.css (Plan 10-01 extraction + 10-06 GAP-10-A rest-collapse)"
  - "src/renderer/tokens.css (--space-* scale, Phase 9 UI-01)"
provides:
  - "Compacted leading gutter (drag-handle + icon tile + row gap) — more name width"
  - "True zero-width-at-rest hover controls (box-sizing:border-box clamps the bordered box)"
  - "Dormant recipe rows reserve no dead trailing gap between the ▶ and hidden controls"
affects:
  - "Sidebar row horizontal budget on the 220px rail — name legibility (SC2)"
tech-stack:
  added: []
  patterns:
    - "box-sizing:border-box to make max-width:0 clamp a bordered box (order-independent zero-collapse)"
    - "split a combined flex-gap reveal selector so dormant rest-state uses gap:0 + per-control margin"
key-files:
  created: []
  modified:
    - "src/renderer/sidebar.css"
decisions:
  - "WR-01 fixed via box-sizing:border-box (robust to future block reorder) over source-order merge"
  - "row-icon tile uses var(--space-8)=32px (token-sourced, within D-04 32-36px band) not literal 34px"
  - "drag-handle width var(--space-2)=8px and the -2px negative nudge dropped"
metrics:
  duration: ~6min
  tasks: 2
  files: 1
  completed: 2026-06-11
---

# Phase 10 Plan 08: Compact Leading Gutter + True Zero-Width Controls Summary

Closed GAP-10-E (operator "the front space is too wide — compact it") plus the two related code-review WARNINGs WR-01 and WR-02 — one cohesive CSS-sizing concern in `src/renderer/sidebar.css`, maximizing the horizontal width available to the session name on the 220px rail.

## What Changed

### Task 1 — Compact the leading gutter (GAP-10-E) · commit 14d1749

Exact CSS deltas in `.sidebar-row`-scoped selectors:

| Selector | Property | Before | After |
|----------|----------|--------|-------|
| `.sidebar-row` | inter-item `gap` | `var(--space-3)` (12px) | `var(--space-2)` (8px) |
| `.sidebar-row .row-icon` | `width` / `height` | `34px` | `var(--space-8)` (32px) |
| `.sidebar-row .row-drag-handle` | `width` | `12px` | `var(--space-2)` (8px) |
| `.sidebar-row .row-drag-handle` | `margin-left` | `-2px` | removed |

- Row horizontal padding stays `var(--space-3)` (UI-SPEC — only the inter-item gap compacts).
- Icon emoji `font-size: 18px` kept (no clipping at 32px; capture owned by 10-10).
- Drag-handle hover-reveal (opacity 0 → 1) unchanged.
- `.row-text { flex: 1 1 auto; min-width: 0 }` untouched — it claims the freed middle space.
- D-13 dormant `.row-control-start` reserved-width exemption (`max-width: 24px`) intact.
- Collapsed-rail layout dimensions untouched (52px icon-only rail).

### Task 2 — Real zero-width-at-rest (WR-01) + dormant trailing-gap fix (WR-02) · commit 0849d2d

- **WR-01:** Added `box-sizing: border-box` to the `.sidebar-row .row-control` rest block so `max-width: 0` clamps the FULL bordered box. Previously the later equal-specificity `border: 1px solid transparent` shorthand in the compact-button block clobbered the rest block's `border-width: 0` at content-box, so each hidden control still rendered ~2px. The fix is order-independent (survives a future reorder of the two `.row-control` blocks). The inaccurate "24px = the .row-control width below" comment corrected to state the box model — with border-box the revealed `max-width: 24px` IS the true border-to-border width.
- **WR-02:** Split the combined `.row-controls` reveal selector. `.sidebar-row[data-dormant] .row-controls` now uses `gap: 0` at rest (flex gap no longer inserts `--space-1` between the always-visible ▶ and the zero-collapsed hidden ✎/🗑), keeping only its leading `margin-left: var(--space-1)`. The always-visible ▶ gets its own `margin-left: var(--space-1)` so it still stands off the name (D-13 standing-invitation preserved). New `.sidebar-row[data-dormant]:hover/:focus-within/:focus-visible .row-controls` selectors restore `gap: var(--space-1)` so the revealed cluster spaces normally.

## Verification

- `tokens-completeness.test.ts` — GREEN, 14/14 (no banned literal reintroduced; every value resolves through `tokens.css` var()). Run after both tasks.
- `npx tsc --noEmit` — exit 0 (no TS touched; confirms clean build).
- grep contracts: `row-drag-handle` present, `row-icon` present, `box-sizing: border-box` present, `[data-dormant] .row-controls` present with `gap: 0`, D-13 `.row-control-start { max-width: 24px }` intact.
- No class names / `data-testid` selectors renamed — CSS value/sizing edits only (markup contract untouched, T-10-08-01 mitigated).
- The visual proof (compacted gutter, name no longer crushed, zero residual control width, no dormant trailing gap) is captured + scored in plan 10-10's packaged ui-lab run and confirmed at the human gate (per plan `<verification>`).

## Deviations from Plan

None — plan executed exactly as written. WR-01 took the preferred `box-sizing: border-box` approach (the plan's primary recommendation, robust to reordering) over the source-order-merge alternative.

## Known Stubs

None.

## Self-Check: PASSED

- `src/renderer/sidebar.css` — FOUND (modified, committed in 14d1749 + 0849d2d)
- Commit 14d1749 — FOUND in git log
- Commit 0849d2d — FOUND in git log
