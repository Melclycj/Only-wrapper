---
phase: 10-sidebar-visual-polish
plan: 03
subsystem: renderer-ui
tags: [context-menu, viewport-clamp, danger-affordance, sidebar-polish]
requires:
  - "src/renderer/viewport-clamp.ts (clampToViewport — Plan 10-01)"
  - "--color-danger token (tokens.css)"
provides:
  - "ContextMenuItem.danger?: boolean field"
  - ".context-menu-item-danger CSS rule"
  - "measure-then-clamp context-menu positioning (D-14)"
affects:
  - "src/renderer/ContextMenu.tsx"
  - "src/renderer/SessionManager.tsx"
  - "src/renderer/terminal.css"
tech-stack:
  added: []
  patterns:
    - "measure-then-clamp: useState(raw anchor) → useEffect measures getBoundingClientRect → clampToViewport → render clamped pos"
    - "danger item variant: base .context-menu-item class kept, .context-menu-item-danger appended (selector-safe)"
    - "color-mix(in oklch, var(--color-danger) 8%, transparent) danger-hover idiom (re-stated from .row-control-close)"
key-files:
  created: []
  modified:
    - "src/renderer/ContextMenu.tsx"
    - "src/renderer/SessionManager.tsx"
    - "src/renderer/terminal.css"
decisions:
  - "menuState.x/y stay raw clientX/clientY in SessionManager; the clamp lives entirely inside ContextMenu (single owner of positioning)"
  - "danger item keeps the base .context-menu-item class so the focus/roving-arrow querySelector and the ui-lab label reader still match — only appends the danger modifier"
metrics:
  duration: "~6 min"
  completed: "2026-06-11"
  tasks: 1
  files: 3
---

# Phase 10 Plan 03: Context-Menu Viewport Clamp + Danger Affordance Summary

Folded in the two no-debate Gap-4 fixes from the Phase-9 human gate: D-14 — the right-click context menu now measures its own rect after mount and clamps into the viewport via the Plan-01 `clampToViewport` (margin 8) so it never overlaps the sidebar header; and D-15 — the destructive Remove (live) / Delete (dormant) menu items render in the `--color-danger` ramp with a `color-mix` danger hover.

## What Was Built

**D-14 — viewport clamp (ContextMenu.tsx).** Added `const [pos, setPos] = useState({ left: x, top: y })` and a `[x, y]`-keyed effect that, after mount, reads `ref.current.getBoundingClientRect()` and sets `pos` to `clampToViewport(x, y, rect.width, rect.height, window.innerWidth, window.innerHeight, 8)`. The render now uses `style={{ left: pos.left, top: pos.top }}` instead of the raw `{ left: x, top: y }`. `clampToViewport` is imported from `./viewport-clamp`. The `.context-menu` stays `position: fixed`, which matches the window-relative coords the clamp computes. The fix is purely additive — the focus-first-item / Esc / click-outside / roving-arrow logic is untouched.

**D-15 — danger item (ContextMenu.tsx + SessionManager.tsx + terminal.css).** `ContextMenuItem` gained an optional `danger?: boolean`. The item button now renders `className={'context-menu-item' + (it.danger ? ' context-menu-item-danger' : '')}` — the base class is always kept so selectors (focus querySelector, ui-lab `contextMenuLabels()`, roving-arrow) still match. `SessionManager.tsx` sets `danger: true` on the `Remove` (live, `handleCloseRequest`) and `Delete` (dormant, `handleDeleteRequest`) items; Edit/Start/Restart/Start-without-command stay unflagged. `terminal.css` adds `.context-menu-item-danger { color: var(--color-danger); }` plus a `:hover, :focus-visible` rule using `color-mix(in oklch, var(--color-danger) 8%, transparent)` — tokens-first, no literal, mirroring the `.row-control-close:hover` danger treatment.

## Verification

- `npx vitest run src/renderer/__tests__/tokens-completeness.test.ts` → 14/14 pass (terminal.css still token-clean after the danger rule).
- `npx tsc --noEmit` → exit 0.
- `npx eslint src/renderer/ContextMenu.tsx src/renderer/SessionManager.tsx` (scoped to changed files) → exit 0, clean.
- `npm run test:unit` (full suite) → 357/357 pass across 41 files.
- Selector-contract preservation confirmed by source inspection: `data-testid="context-menu"`, `role="menu"`, base `.context-menu-item` class, and the item labels (Edit/Start/Restart/Start without command/Remove/Delete) are all unchanged, so the ui-lab `contextMenuLabels()` reader (surfaces.ts:142) and the label-driven smoke (`header-controls.smoke`) still resolve every item.

## Deviations from Plan

None — plan executed exactly as written. The two Gap-4 fixes (D-14 clamp, D-15 danger) landed in one atomic task commit as planned.

## Deferred Issues

- **`npm run test:smoke` could not run in this worktree** — the WDIO Electron smoke suite requires a packaged binary at `./out/Just-Wrapper-darwin-arm64/Just-Wrapper.app`, which is not built in the executor worktree. This is the documented per-wave check (the orchestrator runs it post-merge against a packaged build), not a per-plan executor gate, and not a code defect. The plan's per-commit `<verify>` (tokens-completeness + tsc + lint) is the binding gate and is green. Selector contract verified statically instead (see Verification).
- **Pre-existing lint errors in `.planning/spikes/*.cjs`** (8 errors, CommonJS `require()` in research spike scripts) — out of scope, exist on the base commit, untouched by this plan. Logged to `deferred-items.md`. Scoped lint on the three changed files is clean.

## Known Stubs

None. Both fixes are fully wired: the clamp runs on every menu open; the danger flag flows SessionManager → ContextMenu → CSS.

## Self-Check: PASSED

- `src/renderer/ContextMenu.tsx` contains `clampToViewport` (2 occurrences: import + call) — FOUND
- `src/renderer/terminal.css` contains `.context-menu-item-danger` (3 occurrences) — FOUND
- `src/renderer/SessionManager.tsx` `danger: true` count = 2 (Remove + Delete, ≥2 required) — FOUND
- Commit `ba3c37a` exists in `git log` — FOUND
