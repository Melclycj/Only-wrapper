---
phase: 10-sidebar-visual-polish
plan: 11
subsystem: renderer-sidebar-css
tags: [gap-closure, css, sidebar, a11y, ui-02, GAP-10-G]
requires:
  - "10-05 rest-state zero-width control collapse"
  - "10-08 WR-01 box-sizing:border-box true-zero-width + gutter compaction"
  - "10-09 assertNameNotCrushed machine check"
provides:
  - "Active-row controls collapse to zero reserved width at rest (D-02 compliant), revealing on hover/focus only"
affects:
  - "src/renderer/sidebar.css active-row control-reveal selector groups"
tech-stack:
  added: []
  patterns:
    - "Active row now inherits the same rest-state zero-collapse as every non-active row; reveal only via :hover / :focus-within / :focus-visible"
key-files:
  created: []
  modified:
    - "src/renderer/sidebar.css"
decisions:
  - "Fix is CSS-only: removed .sidebar-row.active from the two control-reveal selector groups. The fixture (tests/ui-lab/surfaces.ts) and the 10-09 assertion threshold were NOT touched — the medium name fits because the CSS reclaimed the 52px, not because the check was relaxed."
metrics:
  duration: ~6min
  completed: 2026-06-12
---

# Phase 10 Plan 11: Close GAP-10-G — Active-Row Name Crush Summary

CSS-only fix removing the active sidebar row from both control-reveal selector groups so its Edit ✎ + Close ✕ controls collapse to zero reserved width at rest (D-02 compliant), freeing 52px back to the name and letting "Parlour Claude" render in full on the active row — `assertNameNotCrushed` now passes, `ui:shots:fresh` completes 11/11.

## What Was Built

GAP-10-G root cause: `src/renderer/sidebar.css` included `.sidebar-row.active` in the two control-REVEAL selector groups (the `.row-controls` container gap/margin restore and the per-`.row-control` max-width:24px/border restore). The 10-05 GAP-10-A fix and 10-08 gutter compaction reclaimed control width ONLY in the non-active/rest state; the active row's ~52px (8px container gap+margin + 2 controls × 24px) was never reclaimed, permanently crushing a 14-char medium name (scrollWidth=98 > clientWidth=51).

The fix restores the LOCKED design contract (CONTEXT.md D-02 / 10-UI-SPEC.md §Interaction Contract: controls are hover/keyboard-focus-revealed only, "including the active row", with NO reserved width).

### Exact CSS diff (src/renderer/sidebar.css)

Two `.sidebar-row.active` reveal clauses removed; explanatory comments updated.

**1. Container reveal group** — `.sidebar-row.active .row-controls` line deleted:
```css
/* before */
.sidebar-row:hover .row-controls,
.sidebar-row.active .row-controls,        /* ← removed */
.sidebar-row:focus-within .row-controls,
.sidebar-row:focus-visible .row-controls { gap: var(--space-1); margin-left: var(--space-1); }
/* after — :hover/:focus-within/:focus-visible remain */
```

**2. Per-control reveal group** — `.sidebar-row.active .row-control` line deleted:
```css
/* before */
.sidebar-row:hover .row-control,
.sidebar-row.active .row-control,         /* ← removed */
.sidebar-row:focus-within .row-control,
.sidebar-row:focus-visible .row-control { opacity: 1; max-width: 24px; padding: 0; border-width: 1px; }
/* after — :hover/:focus-within/:focus-visible remain */
```

Net effect: the active row now inherits the at-rest `.row-control { max-width: 0; overflow: hidden; padding: 0; border-width: 0; box-sizing: border-box }` and `.row-controls { gap: 0; margin-left: 0 }` blocks (unchanged). The Edit ✎ + Close ✕ still reveal on `:hover` (mouse), `:focus-within` (keyboard tab onto a control), and `:focus-visible` (keyboard row focus) — never hidden-and-unreachable.

### Preserved (regression guardrails — verified present + unchanged)

- `.sidebar-row.active` active-card styling (background/border/border-left/box-shadow).
- WR-04 amber-precedence compound selector `.sidebar-row.active[data-agent='waiting'], .sidebar-row[data-agent='waiting']`.
- Collapsed-rail active + amber mirror rules.
- D-13 dormant `.row-control-start` always-visible reserved-width exemption + its leading margin.
- `.sidebar-row.active .row-drag-handle { opacity: 1 }` reveal (drag handle out of GAP-10-G scope).

## Verification Results

**Task 1 (the CSS edit):**
- Task-1 node-grep verify: `OK: active control-reveal clauses removed; keyboard reveal + WR-04 intact`.
- Guardrail node-grep: drag-handle reveal OK, dormant Start exemption OK, active card styling OK.
- `npx tsc --noEmit`: exit 0 (`TSC_OK`).
- `npx vitest run tokens-completeness.test.ts`: 14/14 passed (no banned literal reintroduced).

**Task 2 (regression suite + acceptance check, against the PACKAGED app):**
- `npm run test:unit`: **42 files, 370/370 passed** (count unchanged from round-2 baseline; includes 10-07 real-frame regression test, spike-002 oracle, tokens-completeness, 10-09 sidebar-agent-attr import).
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: clean on all Phase-10 source/test files. **Only the 12 known pre-existing `.planning/spikes/*.cjs` errors remain** (tracked in deferred-items.md, commit 290ad3c — out of scope, untouched). No NEW lint error.
- `npm run test:smoke`: **15/15 spec files passed** against the packaged binary (keyboard-switch, reorder, session-edit, app-restart-restore, sidebar-collapse SC4 keep-alive — SC4 interactions unregressed).
- `UI_LAB_TAG=p10-gapfix-round3 npm run ui:shots:fresh`: **11/11 surfaces captured** (was 10/11 in round 2). The previously-failing `sidebar-populated` surface now PASSES — proving `assertNameNotCrushed` on the active-row "Parlour Claude" (scrollWidth <= clientWidth) AND `assertLongNameDegradesGracefully` (overlong name still ellipsizes). manifest.json written to `artifacts/ui-lab/p10-gapfix-round3/manifest.json` with all 11 surfaces.

Surfaces captured (11/11): empty-state, terminal-running, sidebar-populated, idle-card, context-menu, edit-modal, preferences-modal, search-bar, sidebar-waiting, inactive-recipes, sidebar-collapsed.

## Deviations from Plan

None — plan executed exactly as written. The fix was the two-clause deletion + comment updates the plan specified; the harness (`tests/ui-lab/surfaces.ts`) and the 10-09 assertion threshold were NOT modified (gap_closure_directive #3 honored). No package installs, no bridge-surface change (EXPECTED_API_KEYS stays 20).

## Self-Check: PASSED

- `src/renderer/sidebar.css` exists and was modified (commit 8802a17).
- Commit 8802a17 found in `git log`.
- ui-lab manifest at `artifacts/ui-lab/p10-gapfix-round3/manifest.json` exists with 11 captured surfaces.
