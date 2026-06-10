---
phase: 04-session-identity-sidebar-ui
plan: 04
subsystem: renderer-ui
tags: [sidebar, collapse, rail, tooltip, status-dot, nyquist, NAV-01, NAV-02, SESS-03]
requires:
  - "Sidebar (rows: icon + name + status badge + color-badge-with-initial) — 04-02"
  - "SessionManager (owns sessions/activeId, hosts IdentityHeader + context-menu state) — 04-02/03"
  - "status-colors.ts STATUS_STYLE (accent per status) — Phase 3"
  - "terminal.css tokens (--surface/--line/--radius/--accent, Nunito) — Phase 3"
provides:
  - "Sidebar `collapsed` prop + `onToggleCollapse` + pinned chevron toggle (data-testid=sidebar-collapse)"
  - ".sidebar.collapsed icon-only rail (CSS): hides name/badge/controls; shows .collapsed-status-dot + .rail-tooltip"
  - "SessionManager component-local `collapsed` state"
  - "Phase 4 Nyquist sign-off (04-VALIDATION.md nyquist_compliant: true, wave_0_complete: true)"
affects:
  - "src/renderer/Sidebar.tsx"
  - "src/renderer/SessionManager.tsx"
  - "src/renderer/terminal.css"
  - ".planning/phases/04-session-identity-sidebar-ui/04-VALIDATION.md"
tech-stack:
  added: []
  patterns:
    - "CSS-driven collapse via a `.collapsed` class on `.sidebar` (no JS layout math)"
    - "Custom hover/focus tooltip (`.rail-tooltip`) over native `title=` (D-11 / RESEARCH Pattern 6)"
    - "Shared status-dot class on the collapsed dot so STATUS_STYLE.accent renders identically expanded/collapsed"
key-files:
  created:
    - ".planning/phases/04-session-identity-sidebar-ui/04-04-SUMMARY.md"
  modified:
    - "src/renderer/Sidebar.tsx"
    - "src/renderer/SessionManager.tsx"
    - "src/renderer/terminal.css"
    - ".planning/phases/04-session-identity-sidebar-ui/04-VALIDATION.md"
decisions:
  - "Collapse is a pure CSS state toggle (`.collapsed` class) — only `.sidebar` rules change; `.session-view`/`.viewport-stack` visibility is untouched so the keep-alive panes stay measurable"
  - "The collapsed status dot carries BOTH `collapsed-status-dot` and `status-dot` classes so it reuses the badge dot swatch and the collapse E2E's `.status-dot` visibility check passes when the badge is hidden"
  - "Custom `.rail-tooltip` (instant, on-brand) over native `title=` per D-11"
  - "`collapsed` state is component-local in SessionManager (persistence is Phase 5 — D-11), so it is NOT mirrored to main"
  - "SessionManager wiring landed in the Task-1 commit (required props would otherwise break `tsc --noEmit`, the Task-1 gate) — Rule 3 blocking fix"
metrics:
  duration: "~5 min"
  completed: "2026-06-05"
  tasks: 2
  files_changed: 4
---

# Phase 4 Plan 04: Collapsible Sidebar Rail Summary

Pinned chevron toggle folds the session sidebar to a ~52px icon-only rail and back; collapsed rows hide name/badge/controls but keep their identifying icon (emoji or color-badge-with-initial) plus a status-color dot (NAV-01) and a custom hover tooltip, with the right-click context menu as the collapsed control surface — closing the Phase 4 Nyquist contract.

## What Was Built

**Task 1 — Sidebar collapse toggle + rail rendering + status dot + tooltip** (`src/renderer/Sidebar.tsx`, `src/renderer/terminal.css`, + `SessionManager.tsx` prop wiring):
- Added `collapsed: boolean` + `onToggleCollapse: () => void` props to `Sidebar`; `.sidebar` gets a `.collapsed` class when set.
- Pinned chevron toggle button at the top of the nav: `data-testid="sidebar-collapse"`, `aria-pressed={collapsed}`, `aria-label` flips Collapse/Expand sidebar.
- Each row renders a `.collapsed-status-dot status-dot` element colored from `STATUS_STYLE[s.status].accent` (NAV-01) and a `.rail-tooltip` reading `name · statusLabel`.
- `onContextMenu` confirmed at the `.sidebar-row` level (line 144) — works collapsed (Pitfall 5).
- `terminal.css`: `.sidebar.collapsed` folds to `flex-basis: 52px`; hides `.row-name`/`.status-badge`/`.row-controls`; centers the icon; reveals the dot (bottom-right, soft `--surface` ring) and the tooltip on row hover/focus (warm `--surface` card, `--radius`, Nunito). `.collapsed-status-dot` + `.rail-tooltip` are `display:none` by default and only shown under `.sidebar.collapsed`.
- `.session-view`/`.viewport-stack` rules untouched (keep-alive invariant preserved).

**Task 2 — Wire collapse state in SessionManager + close Nyquist** (`src/renderer/SessionManager.tsx`, `04-VALIDATION.md`):
- `const [collapsed, setCollapsed] = useState(false)` (component-local — Phase 5 persistence per D-11); passes `collapsed` + `onToggleCollapse={() => setCollapsed((c) => !c)}` to `<Sidebar>`. (The wiring physically landed in the Task-1 commit to keep `tsc` green — see Deviations.)
- Ran the three Phase-4 E2E smoke tests — all GREEN. Repackaged the Electron app (`npm run package`) first because the existing `out/` bundle predated the Task-1 renderer edits.
- Finalized `04-VALIDATION.md`: flipped `nyquist_compliant: true`, `wave_0_complete: true`, `status: complete`; the 02/03/04 Per-Task Verification Map rows are now `✅ green`; all six Validation Sign-Off boxes checked with an approval note.

## Verification Evidence

- `npx tsc --noEmit` — clean (both task gates).
- `npm run test:unit` — **82 passing** (16 files).
- E2E (`wdio run` against a freshly-packaged app):
  - `sidebar-collapse.smoke.test.ts` ✓ — collapsing hides `.row-name`, keeps `.row-icon` + `.status-dot`.
  - `keyboard-switch.smoke.test.ts` ✓ (regression).
  - `session-edit.smoke.test.ts` ✓ (regression).
- Grep gates: `sidebar-collapse` / `collapsed-status-dot` / `rail-tooltip` / `sidebar.collapsed` present; `collapsed` in SessionManager; `nyquist_compliant: true` in 04-VALIDATION.md.

## Requirements Closed

- **NAV-01** — status legible in both modes (collapsed status dot). *(was already marked complete; reaffirmed)*
- **NAV-02** — expanded/collapsed modes; icon identifies when collapsed. **Now complete.**
- **SESS-03** — icon (emoji / color-badge-with-initial) stays visible when collapsed. **Now complete.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SessionManager prop wiring moved into the Task-1 commit**
- **Found during:** Task 1 (the `npx tsc --noEmit` gate).
- **Issue:** Making `collapsed`/`onToggleCollapse` required Sidebar props breaks `tsc` at the `<Sidebar>` mount in `SessionManager.tsx`. The plan assigns SessionManager to Task 2, but Task 1's verify gate is `tsc --noEmit`.
- **Fix:** Added the `collapsed` state + the two props to `SessionManager.tsx` in the Task-1 commit so `tsc` stays green atomically. Task 2's remaining work (the planned SessionManager content) was therefore already satisfied; Task 2's commit finalizes `04-VALIDATION.md`.
- **Files modified:** `src/renderer/SessionManager.tsx`.
- **Commit:** `8f78ebd`.

**2. [Rule 3 - Blocking] Repackaged the Electron app before the E2E run**
- **Found during:** Task 2.
- **Issue:** The existing `out/Just-Wrapper-darwin-arm64` bundle was built at 14:07, before the Task-1 renderer edits (committed 14:16), so its renderer bundle lacked the collapse toggle — the WDIO E2E boots that packaged app, so the collapse smoke test would have failed on a stale build.
- **Fix:** Ran `npm run package` to rebuild the renderer/main/preload bundles before `wdio run`.
- **Files modified:** none (build artifact only, under `out/` — gitignored).

## Known Stubs

None — the collapse slice is fully wired (real `STATUS_STYLE` colors, real session names, real context menu); no placeholder/empty data paths introduced.

## Self-Check: PASSED

- `src/renderer/Sidebar.tsx` — FOUND (collapse prop + toggle + dot + tooltip)
- `src/renderer/SessionManager.tsx` — FOUND (`collapsed` state + props)
- `src/renderer/terminal.css` — FOUND (`.sidebar.collapsed` / `.collapsed-status-dot` / `.rail-tooltip`)
- `.planning/phases/04-session-identity-sidebar-ui/04-VALIDATION.md` — FOUND (`nyquist_compliant: true`)
- Commit `8f78ebd` (feat) — FOUND
- Commit `7a577c3` (test/sign-off) — FOUND
