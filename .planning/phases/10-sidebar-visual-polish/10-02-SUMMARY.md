---
phase: 10-sidebar-visual-polish
plan: 02
subsystem: renderer
tags: [sidebar, two-line-rows, active-card, waiting-wash, recipe-cards, ghost-start, tokens, d-01, d-13, ui-lab]
requires:
  - src/renderer/row-secondary.ts (Plan 01 — secondaryText/cwdTail for the .row-secondary line)
  - src/renderer/status-colors.ts (presentation(status, agent) → { label, accent })
  - src/renderer/tokens.css (the --space-* / --accent-* / --radius-* / --shadow-* / --ink-* var() source)
provides:
  - ".row-text + .row-secondary two-line row structure (consumed by the sidebar smoke + ui-lab)"
  - "data-agent attribute on .sidebar-row (the D-09 waiting seam)"
  - ".sidebar-section-count + the [data-agent='waiting'] selector + the dashed recipe-card / ghost-▶ rules"
  - "ui-lab surfaces: inactive-recipes (drivable) + sidebar-waiting (SkipSurface) + their DESIGN-RUBRIC sections"
affects:
  - tests/ui-lab/surfaces.ts (two new surface entries)
  - tests/ui-lab/DESIGN-RUBRIC.md (two new checklist sections + a collapsed-continuity line)
tech-stack:
  added: []
  patterns:
    - "per-row inline --accent channel lifted to the row container; data-attribute CSS seam (data-agent)"
    - "per-button opacity hover-reveal (NOT parent-container opacity) so an always-on child can override it"
    - "first consumer of the Phase-9 --space-* scale (tokens-first geometry)"
key-files:
  created:
    - .planning/phases/10-sidebar-visual-polish/deferred-items.md
  modified:
    - src/renderer/Sidebar.tsx
    - src/renderer/sidebar.css
    - tests/ui-lab/surfaces.ts
    - tests/ui-lab/DESIGN-RUBRIC.md
decisions:
  - "Hover-reveal uses PER-BUTTON opacity on .row-control, not a container opacity — a child cannot exceed its parent's opacity, so a container fade would have made the D-13 always-visible dormant Start impossible to override"
  - "sidebar-waiting is a SkipSurface (agentState='waiting' needs a real idle agent process — not deterministically drivable in the harness); D-09 is proven instead by the unit data-agent contract + Plan 03's manual gate (per the plan's explicit instruction)"
  - "The old .status-badge span was removed (no smoke/ui-lab selects it — grep-confirmed); .row-secondary now carries the status dot + word"
  - "34px icon tile kept a literal (an element dimension, UI-SPEC Spacing-Scale exception); the left edge bar rides a 3px transparent border-left so active/waiting only change its COLOR (no layout shift)"
metrics:
  duration: ~12 min
  completed: 2026-06-11
  tasks: 2
  files: 5
---

# Phase 10 Plan 02: Sidebar Visual Polish Summary

Restyled the session sidebar to an intentional two-line visual hierarchy (UI-02 / SC1–SC4),
implementing the locked D-01..D-13 decisions and closing the three Phase-9 sidebar gaps:
name-crush (Gap 1), unanchored inactive rows (Gap 5), and weak active distinction. This is the
first real surface to compose the Phase-9 token foundation and the first consumer of the
`--space-*` scale.

## What Was Built

### Task 1 — Two-line row restructure + row --accent/data-agent + section counts (Sidebar.tsx) · commit `033735f`
- Imported `secondaryText` from `./row-secondary` (Plan 01) and render it on a NEW `.row-secondary`
  line wrapped with `.row-name` in a NEW `.row-text` flex column (D-01/D-03): line 1 = full-width
  session name (ellipsis), line 2 = a status-colored dot + `secondaryText({status, cwd, startupCommand}, stat.label)`.
- LIFTED the per-row inline `--accent` from the dots up to the `.sidebar-row` container so the active
  edge bar (D-05) and the waiting wash (D-09) can read it (kept ALSO on the dots).
- Added `data-agent={agentState}` to the row — the D-09 seam. Per the OPEN-Q1 resolution `agentState`
  is present on NON-active running rows too, so the amber wash fires on a backgrounded waiting row
  with zero extra wiring.
- Removed the old `.status-badge` span (no smoke/ui-lab selects it — grep-confirmed); `.row-secondary`
  carries the dot + word now.
- Appended section counts: `WORKING AREA · {workingArea.length}` / `INACTIVE · {inactiveList.length}`
  via a new `.sidebar-section-count` span (D-12); renamed the visible "Inactive List" label to "Inactive".
- Every FROZEN selector preserved (grep-verified): `.row-name`, `data-session-id`, `data-dormant`,
  `.row-drag-handle`, `.rail-tooltip`, `.collapsed-status-dot.status-dot`, the `working-area`/`inactive-list`
  testids, and all six control `data-testid`s. All user strings render as React text nodes (T-10-08 / ASVS V7).

### Task 2 — Phase-10 visual rules (sidebar.css) + ui-lab evidence · commit `19d2a81`
- **D-05/D-06 active card:** `.sidebar-row.active` = filled `var(--surface)` + `var(--line)` border +
  `var(--shadow-pop)` lift + `border-left: 3px solid var(--accent)` (status-colored edge bar).
- **D-09 waiting wash:** a standalone `.sidebar-row[data-agent='waiting']` = amber edge bar +
  `color-mix(in oklch, var(--accent-waiting) 8%, transparent)` — STATIC (no animation), independent of `.active`.
- **D-01/D-03 geometry:** `.row-text` column (`min-width:0` for ellipsis) + `.row-secondary` (12px,
  `--ink-soft`, status dot) + a taller two-line row block using `--space-*` padding/gap.
- **D-04 icon tile:** `.row-icon` enlarged to a 34px rounded tile with a larger emoji optical size.
- **D-02 hover/keyboard reveal:** per-button `.row-control { opacity:0 }` revealed on
  `:hover`/`.active`/`:focus-within`/`:focus-visible`.
- **D-13 ghost ▶:** `.row-control-start` circular (`border-radius:999px`), outlined brand-blue, fills
  brand-blue on hover; EXEMPT from the reveal on dormant rows (`[data-dormant] .row-control-start { opacity:1 }`).
- **D-11 recipe cards:** `.sidebar-row[data-dormant]` gets a `1px dashed var(--line)` border + a recipe
  surface tint (`color-mix` over `--surface`).
- **D-12 divider:** `.sidebar-section + .sidebar-section` hairline `border-top` + `.sidebar-section-count` dim color.
- **D-07/D-10 collapsed continuity:** the collapsed hide rule now also hides `.row-text`/`.row-secondary`
  (no leaked secondary text); the active + waiting edge bars apply to the collapsed rail; the collapsed
  status dot grows 8px → 10px.
- **TOKENS-FIRST:** first consumer of the `--space-*` scale (12 uses); tokens-completeness green, no banned literals.
- **ui-lab evidence:** added `inactive-recipes` (create → edit to give it name+emoji+`npm run dev` startup
  command → Remove → confirm → assert it landed in the Inactive List; captures the dashed recipe card +
  ghost ▶ + startup-command secondary). Added `sidebar-waiting` as a `SkipSurface` (not deterministically
  drivable). Added matching `DESIGN-RUBRIC.md` sections for both + a collapsed-continuity line.

## Verification

- `npx vitest run` — full unit suite **357/357 GREEN** (includes `tokens-completeness` scanning sidebar.css
  with the new rules: every `var(--token)` resolves, no banned brand-blue/danger-red/Nunito/JetBrains literals).
- `npx tsc --noEmit` — exit 0 (both tasks).
- `npx eslint src/renderer/Sidebar.tsx tests/ui-lab/surfaces.ts` — exit 0.
- **Frozen-selector contract:** grep-verified all 14 frozen selectors + testids survive the restructure
  (the dominant risk, Pitfall 1). The collapse smoke's `.status-dot`-visible-when-collapsed assertion holds:
  the first `.status-dot` in DOM order is `.collapsed-status-dot.status-dot` (display:block when collapsed),
  while `.row-secondary` (and its dot) is hidden under `.sidebar.collapsed`.
- **Smoke + packaged ui-lab capture** are the per-wave / phase gate run by the orchestrator (the wdio/electron
  E2E harness needs a packaged build + display, not run inside this worktree per the plan's verification note).
  The structural TSX change requires `npm run ui:shots:fresh` (packaged) — live-CSS injection would preview
  the OLD markup (Pitfall 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hover-reveal opacity moved from the container to the individual buttons**
- **Found during:** Task 2 (authoring the D-02 reveal + the D-13 always-visible exemption).
- **Issue:** The plan's literal text put `opacity:0` on the `.row-controls` CONTAINER and `opacity:1` on
  `[data-dormant] .row-control-start`. CSS opacity creates a stacking context: a child element cannot
  render at a HIGHER opacity than its parent. With the container at `opacity:0`, the dormant Start would
  have stayed invisible — breaking D-13 (always-visible ghost ▶) and Gap-5 closure.
- **Fix:** Applied the hover-reveal `opacity` to the individual `.row-control` buttons (revealed on
  `:hover`/`.active`/`:focus-within`/`:focus-visible`) and kept `[data-dormant] .row-control-start { opacity:1 }`
  as a real override. Same visual contract, correct stacking semantics.
- **Files modified:** src/renderer/sidebar.css
- **Commit:** `19d2a81`

## Threat Surface

No new trust boundary (plan threat_model: renderer-only CSS/JSX restyle; no IPC, no network, no
main-process code, `EXPECTED_API_KEYS` unchanged at 20). T-10-08 (Tampering/XSS) mitigation applied:
all user-controlled strings (name, cwd tail, startupCommand) render as React text nodes via
`{secondaryText(...)}` / `{s.name}` — auto-escaped, no `dangerouslySetInnerHTML`/`innerHTML`/HTML
interpolation. T-10-SC: zero packages installed (no legitimacy checkpoint needed).

## Known Stubs

None. The two-line rows, active card, waiting wash, recipe cards, ghost ▶, and collapsed continuity
are all fully implemented and consume real data (the row's status/cwd/startupCommand/agentState).
`sidebar-waiting` is an intentional `SkipSurface` (documented, with the D-09 proof path stated) — not
a stub. The packaged visual capture is a downstream phase gate, not a stub in this plan's output.

## Deferred Issues

`npm run lint` reports 8 pre-existing errors in `.planning/spikes/*.cjs` (present at base commit
`2d365a8`, unrelated to the sidebar restyle). Logged to
`.planning/phases/10-sidebar-visual-polish/deferred-items.md` (commit `52ddfa6`). My own files
(`Sidebar.tsx`, `surfaces.ts`) lint clean; CSS is not eslint-scanned. Not fixed (out of scope).

## Self-Check: PASSED

- Files exist: src/renderer/Sidebar.tsx, src/renderer/sidebar.css, tests/ui-lab/surfaces.ts,
  tests/ui-lab/DESIGN-RUBRIC.md, deferred-items.md — all present.
- Commits exist: `033735f` (Task 1), `19d2a81` (Task 2), `52ddfa6` (deferred log) — all in `git log`.
- All 14 frozen selectors + new artifacts (.row-text, .row-secondary, data-agent, sidebar-section-count,
  secondaryText call) grep-confirmed present.
- Full unit suite 357/357, tsc 0, eslint (my files) 0, tokens-completeness 14/14 green.
