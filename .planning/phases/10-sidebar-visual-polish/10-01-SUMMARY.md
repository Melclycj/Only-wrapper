---
phase: 10-sidebar-visual-polish
plan: 01
subsystem: renderer
tags: [sidebar, css-extraction, pure-modules, tokens, d-03, d-14]
requires:
  - src/renderer/status-colors.ts (presentation().label — caller supplies it to secondaryText)
  - src/renderer/tokens.css (the var() source sidebar.css consumes)
provides:
  - "cwdTail / secondaryText (row-secondary.ts) — Plan 02 imports these for the .row-secondary line"
  - "clampToViewport (viewport-clamp.ts) — Plan 03 imports this for ContextMenu measure-then-clamp"
  - "src/renderer/sidebar.css — a clean file for Plan 02 to write the new sidebar geometry into"
affects:
  - src/renderer/index.tsx (CSS import order)
  - src/renderer/__tests__/tokens-completeness.test.ts (now scans sidebar.css)
  - tests/ui-lab/helpers.ts (live-CSS injection list)
tech-stack:
  added: []
  patterns:
    - "pure renderer module + Vitest-in-Node idiom (start-affordances.ts / scrollback-clamp.ts)"
    - "value-preserving CSS extraction with token-completeness + ui-lab injection touch-points"
key-files:
  created:
    - src/renderer/row-secondary.ts
    - src/renderer/viewport-clamp.ts
    - src/renderer/__tests__/row-secondary.test.ts
    - src/renderer/__tests__/viewport-clamp.test.ts
    - src/renderer/sidebar.css
  modified:
    - src/renderer/terminal.css
    - src/renderer/index.tsx
    - src/renderer/__tests__/tokens-completeness.test.ts
    - tests/ui-lab/helpers.ts
decisions:
  - "secondaryText receives an already-resolved status label (single-source rule) — it never re-derives presentation()/STATUS_STYLE"
  - "clampToViewport lives in its own viewport-clamp.ts (not inside row-secondary.ts) so D-14 has an isolated, named import surface for Plan 03"
  - "the CSS move is VERBATIM (byte-identical blocks) — zero rendered-pixel change; Plan 02 owns all visual edits"
metrics:
  duration: ~4 min
  completed: 2026-06-11
  tasks: 2
  files: 9
---

# Phase 10 Plan 01: Sidebar Visual Polish Foundation Summary

Established the Phase-10 foundation — two tested, electron/react-free pure renderer modules
(`row-secondary.ts` for the D-03 second-line text, `viewport-clamp.ts` for the D-14 context-menu
clamp) plus the value-preserving extraction of the sidebar's visual rules out of the now-overweight
`terminal.css` into a dedicated `sidebar.css`, with all three guard touch-points (import order,
token-completeness scan, ui-lab live-CSS injection) re-wired to follow the moved rules.

## What Was Built

### Task 1 — Pure modules (D-03 + D-14) with tests · commit `421eaa2`
- `row-secondary.ts`: `cwdTail(cwd)` returns the last path segment (separator-tolerant on `/` and
  `\`, trailing-separator-run safe); `secondaryText(row, label)` composes line-2 — a live row →
  `${label} · ${cwdTail}` (or `label` alone with no cwd), a recipe (`not_started`) row →
  trimmed `startupCommand` → `cwdTail` → `label`. The caller supplies `label` from
  `presentation().label`; this module never re-derives the status→label mapping (single-source rule).
- `viewport-clamp.ts`: `clampToViewport(x,y,w,h,vw,vh,margin)` snaps a measured menu box inside the
  viewport per axis as `max(margin, min(desired, size - extent - margin))`.
- 26 unit tests cover every D-03 branch (live/recipe, with/without cwd, empty/whitespace
  startupCommand, separator + edge cwds) and every D-14 corner (fits, right/bottom overflow,
  off-top-left, bottom-right corner, box-larger-than-viewport, zero margin).
- Both modules are pure: grep confirms no `@xterm` / `from 'react'` / `from 'electron'` imports.

### Task 2 — Extract sidebar.css + wire 3 touch-points · commit `9e070c0`
- Moved the sidebar block (`.sidebar*`, `.sidebar-row*`, `.status-badge*`, `.row-icon*`,
  `.row-control*`, `.row-drag-handle*`, `.add-session*`, `.sidebar-pinned`, `.sidebar-collapse/-prefs`,
  `.collapsed-status-dot`, `.rail-tooltip`, the `.sidebar.collapsed*` rules, and the `.row-icon-color`
  color-badge block) VERBATIM out of `terminal.css` into a new `src/renderer/sidebar.css`. Verified
  byte-identical (the moved blocks appear verbatim in sidebar.css).
- `terminal.css` 1243 → 858 lines; keeps `.context-menu*` (Plan 03's surface) and every non-sidebar
  rule (`.ide-layout` shell, `.terminal-area`, modals, search, identity-header, icon-picker, prefs).
- Three touch-points wired: `index.tsx` imports `./sidebar.css` immediately after `./terminal.css`
  (order: fonts → tokens.css → terminal.css → sidebar.css); `tokens-completeness.test.ts` reads
  `sidebar.css` and adds a var()-completeness test + a literal-absence block for it;
  `tests/ui-lab/helpers.ts` adds `src/renderer/sidebar.css` to the `UI_LAB_LIVE_CSS` injection list.

## Verification

- `npx vitest run` — full unit suite **357/357 GREEN** (includes the 26 new pure-module tests + the
  updated tokens-completeness now scanning sidebar.css).
- `npx tsc --noEmit` — exit 0.
- `npx eslint` on all new/modified files — exit 0.
- **Completeness-scan-covers-sidebar.css proof:** temporarily appended `var(--nope-not-a-token)` to
  sidebar.css → the completeness test FAILED on the sidebar.css assertion; reverted → 14/14 green.
  This proves the guard actually follows the moved rules (RESEARCH Pitfall 4).
- **Value-preserving claim:** the CSS move is byte-identical (verbatim block check passed). The
  packaged before/after ui-lab pixel comparison (`ui:shots:fresh`) is the visual proof and runs as
  the per-wave / phase-level check — not re-run inside this worktree (no rendered-pixel change is
  possible from a verbatim move + import-order addition).

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface

No new trust boundary (plan threat_model: two pure modules + a CSS file move; no IPC, no network,
no main-process code, `EXPECTED_API_KEYS` unchanged). T-10-05 (DoS) mitigation holds: `cwdTail` uses
a single linear split with no nested quantifier (no ReDoS); `clampToViewport` is O(1) math. No
packages installed (T-10-SC — no legitimacy checkpoint required).

## Known Stubs

None. Both pure modules are fully implemented and tested; the CSS extraction is complete and wired.
The downstream consumers (`secondaryText`/`cwdTail` in Plan 02's Sidebar.tsx, `clampToViewport` in
Plan 03's ContextMenu.tsx) are intentional forward dependencies named in the plan's
`<artifacts_this_phase_produces>` — not stubs.

## Self-Check: PASSED

- Files created exist: row-secondary.ts, viewport-clamp.ts, their two tests, sidebar.css — all present.
- Commits exist: `421eaa2` (Task 1), `9e070c0` (Task 2) — both in `git log`.
- terminal.css no longer contains `.sidebar-row {`; still contains `.context-menu {`.
- Full unit suite, tsc, eslint all green.
