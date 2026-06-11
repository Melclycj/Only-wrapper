---
phase: 10-sidebar-visual-polish
plan: 09
subsystem: ui-lab-harness
tags: [test-quality, ui-lab, harness, gap-closure, name-completeness, amber-evidence]
requires:
  - "tests/ui-lab/surfaces.ts existing Surface registry + driving utilities (rowText, addSession, openEditModal, setInputByTestId, clickByTestId)"
  - "src/shared/types.ts SessionStatus union"
  - "src/renderer/row-secondary.ts rowAgentAttr() helper"
provides:
  - "Machine-checked name-completeness assertion in the ui-lab harness (scrollWidth <= clientWidth on .row-name) — GAP-10-F closed"
  - "Long-name ellipsis-degradation fixture (graceful truncation, bounded box, no layout break)"
  - "Hardened sidebar-waiting surface: waitUntil-attribute-landed (WR-05) + cleanup hook (WR-04)"
  - "Corrected SessionStatus import path so the typed completeness guard is enforceable (WR-03)"
affects:
  - "Plan 10-10 packaged ui-lab capture run (now FAILS on a name crush; no longer leaks amber into later captures)"
tech-stack:
  added: []
  patterns:
    - "Harness assertions throw a descriptive Error (not SkipSurface) so visual-evidence regressions fail loudly"
    - "Fabricated DOM state is recorded in a module-scoped var + removed in cleanup so it never leaks across surfaces"
    - "waitUntil on observable DOM state replaces sleep-only settles (testing-policy)"
key-files:
  created: []
  modified:
    - "tests/ui-lab/surfaces.ts"
    - "src/renderer/__tests__/sidebar-agent-attr.test.ts"
decisions:
  - "Long-name fixture added as an extra session in sidebar-populated (not a new surface) to keep the registry order + existing surface ids unchanged"
  - "Kept a short 120ms paint settle in sidebar-waiting after the waitUntil (IN-01) — the WebGL amber edge-bar/wash paint can lag the attribute landing; the waitUntil now gates the no-op risk"
metrics:
  duration: "~10m"
  completed: "2026-06-11"
  tasks: 2
  files: 2
---

# Phase 10 Plan 09: ui-lab Name-Completeness + Amber-Evidence Honesty Summary

One cohesive harness/test-quality pass: made name-crush machine-checked (the operator's direct request, GAP-10-F) and made the amber-evidence surface honest — no leak (WR-04), no false-success (WR-05) — plus fixed the silently-erased typed completeness guard import (WR-03).

## What Was Built

### Task 1 — Name-completeness assertion (GAP-10-F)
`tests/ui-lab/surfaces.ts` gained three helpers + wiring:
- `rowNameMetrics(id)` — reads `.row-name` `scrollWidth`/`clientWidth`/`text`/computed `text-overflow` via `browser.execute`.
- `assertNameNotCrushed(id)` — throws a descriptive `Error` (NOT `SkipSurface`) when `scrollWidth > clientWidth`, so a medium-length name that should fit but is truncated FAILS the run instead of being eye-scored from a PNG.
- `assertLongNameDegradesGracefully(id)` — asserts an overlong name degrades via `text-overflow: ellipsis` with a bounded (`clientWidth > 0`) content box and no layout break.

Wired into `sidebar-populated.prepare`:
- After the canonical "Parlour Claude" rename is confirmed landing (existing `waitUntil rowText includes 'Parlour Claude'`), `assertNameNotCrushed(idB)` runs — gated on observable state, no added bare pause.
- A new long-name fixture session ("Marketing Parlour Long Session Name For Overflow Test") is created, renamed, and `assertLongNameDegradesGracefully(idLong)` runs.

Assertion shape recorded: **medium → not truncated (`scrollWidth <= clientWidth`); long → ellipsis (computed `text-overflow: ellipsis`, bounded box).**

### Task 2 — Harden sidebar-waiting + fix import (WR-03/04/05)
- **WR-03:** `src/renderer/__tests__/sidebar-agent-attr.test.ts` import changed `'../shared/types'` → `'../../shared/types'` (matches every sibling test). The path previously resolved to a nonexistent `src/renderer/shared/types`; because the import is type-only it was erased by esbuild and the suite passed silently with an unenforced guard. 8/8 cases still pass.
- **WR-05:** `sidebar-waiting.prepare` records the poked id and adds a `browser.waitUntil` (2000ms / 100ms interval / descriptive timeoutMsg) that re-reads the row and returns true only when `getAttribute('data-agent') === 'waiting'`. A silent no-op (selector miss / stale id) now FAILS the surface instead of capturing a plain row. The bare `pause(300)` was reduced to a short `pause(120)` paint settle (IN-01).
- **WR-04:** A `cleanup` hook was added to the `sidebar-waiting` Surface entry that `removeAttribute('data-agent')` on the recorded poked id (module-scoped `waitingPokedId`, NOT `ctx.ids[length-1]`). This stops the fabricated amber leaking into the `inactive-recipes` and `sidebar-collapsed` captures that run after it. Surface id/title/designRefs/expects and the registry order are unchanged.

## Verification

- `npx vitest run src/renderer/__tests__/sidebar-agent-attr.test.ts` → **Test Files 1 passed, Tests 8 passed (8)** (with the corrected import).
- `npx tsc --noEmit` → **exit 0** (clean across the codebase; note the repo tsconfig excludes `tests/**` and `src/**/__tests__/**`, so tsc validates the rest of the tree — the per-file gates are the grep + the runtime vitest run).
- Grep gates all PASS: `scrollWidth` + `row-name` present in surfaces.ts (Task 1); `'../../shared/types'` in the test, `waitUntil` + `cleanup` present in surfaces.ts (Task 2).
- No `console.*` added; no sleep-only wait added for the new assertions (all gate on observable DOM state).

These assertions are EXERCISED in plan 10-10's packaged ui-lab run (`npm run ui:shots`), which is NOT runnable from this isolated worktree (wdio launches a packaged Electron app). Static + unit verification is the scope here per the plan; the live run on the main checkout is owned by 10-10's gate. The run will now fail on a name crush and will not leak amber.

## Deviations from Plan

None — plan executed exactly as written. No package installs (zero supply-chain surface, per T-10-09-SC). No shipped code changed (test/harness edits only).

## Threat Surface

No new security-relevant surface. The `data-agent` DOM poke is harness-only, presentation-only, and now cleaned up (T-10-09-01 mitigated: the amber-evidence chain becomes trustworthy — no leak, no false success). T-10-09-02 (the test-only poke) remains accepted: it never touches PTY/IPC/persistence and is bounded to the ui-lab run.

## Self-Check: PASSED

- FOUND: tests/ui-lab/surfaces.ts (modified, contains `scrollWidth` + `row-name`)
- FOUND: src/renderer/__tests__/sidebar-agent-attr.test.ts (modified, imports `'../../shared/types'`)
- FOUND: commit ad860e6 (Task 1)
- FOUND: commit 980b0c6 (Task 2)
