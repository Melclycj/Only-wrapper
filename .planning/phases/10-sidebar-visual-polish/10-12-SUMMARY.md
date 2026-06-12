---
phase: 10-sidebar-visual-polish
plan: 12
subsystem: renderer-sidebar
tags: [gap-closure, GAP-10-H, GAP-10-I, start-affordances, waiting-treatment, D-09, renderer-only]
requires:
  - "10-11 (GAP-10-G active-row control zero-collapse — the round-3 gate state this round diagnoses against)"
  - "src/renderer/start-affordances.ts (the R3 2026-06-09 dedup reducer — consumed, not changed)"
provides:
  - "GAP-10-H pinned: the ACTIVE/selected dormant row presents EXACTLY ONE Start-labeled control, locked by a unit truth-table + a live-DOM ui-lab assertion"
  - "GAP-10-I implemented: waiting = amber wash ONLY (no edge bar), expanded + collapsed; the obsolete WR-04 compound selector removed"
affects:
  - "src/renderer/Sidebar.tsx (render-path gate comment hardened; activeIsCard alignment locked)"
  - "src/renderer/sidebar.css (waiting wash-only; WR-04 removed; active edge bar D-05/D-06 preserved)"
  - "src/renderer/__tests__/start-affordances.test.ts (GAP-10-H truth-table block)"
  - "tests/ui-lab/surfaces.ts (assertSingleStartAffordance + sidebar-waiting expects updated)"
tech-stack:
  added: []
  patterns:
    - "diagnose-first (proven 10-07 shape): reproduce + root-cause with captured evidence BEFORE any fix"
    - "deterministic DOM machine-check (assertSingleStartAffordance, assertNameNotCrushed style) over eye-scored PNG verification"
    - "sanctioned spec change via CSS rule deletion (not a check relaxation) — assertNameNotCrushed untouched"
key-files:
  created:
    - ".planning/spikes/004-dormant-start-dup/README.md"
    - ".planning/spikes/004-dormant-start-dup/trace-affordances.cjs (throwaway diagnosis driver — NOT a shipped path)"
  modified:
    - "src/renderer/Sidebar.tsx"
    - "src/renderer/sidebar.css"
    - "src/renderer/__tests__/start-affordances.test.ts"
    - "tests/ui-lab/surfaces.ts"
decisions:
  - "GAP-10-H root cause = render-path VERIFICATION gap, not a pure-predicate defect — the reducer + Sidebar inputs are correct in every state; the missing guarantee was a live-DOM exactly-one-Start machine check"
  - "GAP-10-I = sanctioned D-09 amendment (operator 2026-06-12): waiting wash-only; the active row's own status-colored edge bar (D-05/D-06) stays"
metrics:
  duration: ~18min
  completed: 2026-06-12
  tasks: 3
  files: 6
---

# Phase 10 Plan 12: Round-4 Gap-Closure (GAP-10-H duplicate Start + GAP-10-I waiting wash-only) Summary

Two renderer-only round-4 gap closures sharing `sidebar.css` without a write conflict: **GAP-10-H** (the operator's "the start button on the inactive task does not remove the original start button") is diagnosed-first, root-caused as a render-path verification gap, and pinned with a unit truth-table plus a live-DOM `assertSingleStartAffordance`; **GAP-10-I** amends D-09 to the amber wash only (dropping the waiting edge bar + the obsolete WR-04 selector) per the operator's 2026-06-12 decision, while preserving the active row's own status-colored edge bar.

## Tasks Completed

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 | Diagnose-first: reproduce + root-cause GAP-10-H (no fix) | `9d316f7` | `.planning/spikes/004-dormant-start-dup/README.md` + `trace-affordances.cjs` |
| 2 | Fix the diagnosed GAP-10-H link + lock with regression checks | `ab4a0e5` | `Sidebar.tsx`, `start-affordances.test.ts`, `surfaces.ts` |
| 3 | GAP-10-I: amend D-09 to wash-only + update waiting harness | `4e03d84` | `sidebar.css`, `surfaces.ts` |

## GAP-10-H — diagnosis (Task 1)

### Per-state matrix (traced via `trace-affordances.cjs`, the pure reducer + the Sidebar/IdleCard render gates)

| State | `start-session` (sidebar ▶) | `start-no-cmd-session` (⏵) | `idle-start-session` (IdleCard ▶) | TOTAL Start-labeled |
|---|---|---|---|---|
| non-active dormant @rest, no cmd | yes | — | — | **1** |
| non-active dormant @rest, WITH cmd | yes | yes | — | **2** (legit ▶+⏵ pair, D-06) |
| ACTIVE/selected dormant, no cmd | — | — | yes | **1** |
| ACTIVE/selected dormant, WITH cmd | — | — | yes | **1** |
| dormant @hover (CSS-only) | yes | yes | — | **2** (▶+⏵; the ✎/🗑 reveal is not Start-labeled) |
| just-after-Start (optimistic running flip) | — | — | — | **0** |

Transition trace (the just-after-Start race): t0 active dormant → `idle-start-session` (1); t1 click→awaiting ptyCreate → `idle-start-session` (1); t2 setSessions running flip → none (0). **No frame paints two Start-labeled controls.**

### Diagnosed broken state path + root cause

The single failing surface is **state (2)/(2b): the ACTIVE/selected dormant row** — it must paint exactly one Start (the IdleCard `idle-start-session` ▶) with the sidebar ▶ and ⏵ DOM-suppressed. All 4 candidate hypotheses were **REJECTED** with captured evidence:
- (a) predicate misfire — the Sidebar row-local `activeIsCard` (`isActive && (not_started || error)`) is logically identical to `SessionManager.activeIsCard` when `isActive` is true.
- (b) ⏵ co-render — `startCtl.startNoCmd` is false on the active card row (already R3-proven).
- (c) status-flip race — the transition trace shows no two-Start frame; the optimistic `running` flip clears `not_started` atomically.
- (d) 10-11 zero-collapse / CSS exemption — `.sidebar-row[data-dormant] .row-control-start` styles a button only if React rendered it; on the active dormant row `startCtl.sidebarStart===false`, so the node is absent from the DOM — CSS cannot resurrect it.

**Confirmed 5th classification: render-path VERIFICATION gap, not a pure-predicate defect.** The reducer and Sidebar inputs are provably correct in every state, but only a unit test pinned it — there was no deterministic live-DOM guarantee that the selected dormant row paints exactly one Start. The fix target is therefore the render-path gate (reaffirmed/locked) plus the missing DOM count assertion, NOT a reducer rewrite.

## GAP-10-H — fix + regression pin (Task 2, the minimal diff)

- **`Sidebar.tsx`**: no logic change — the row-local `activeIsCard` was already correct. Locked it with a comment that requires it stay byte-identical to `SessionManager.activeIsCard` so a future edit can't desync the gate and re-introduce the duplicate.
- **`start-affordances.test.ts`**: added a `GAP-10-H` truth-table block — the active dormant card row asserts `totalStartCount === 1` WITH (`'claude --rc'`) and WITHOUT a saved command; the non-active recipe control stays `totalStartCount === 2`. (8 → 11 tests.)
- **`surfaces.ts`**: new local `assertSingleStartAffordance(id)` (same style as `assertNameNotCrushed` — throws a descriptive `Error`, not `SkipSurface`) that counts the rendered Start `data-testid`s (`start-session` + `start-no-cmd-session` in the row + `idle-start-session` in the terminal area) and fails if `> 1`. Wired into the `idle-card` surface `prepare()`, gated on the observable `idle-card` mount (`waitForTestId`), not a bare pause. `assertNameNotCrushed` / `assertLongNameDegradesGracefully` are byte-for-byte unchanged.

## GAP-10-I — D-09 amendment to wash-only (Task 3, the CSS diff)

Operator decision 2026-06-12 (verbatim): *"waiting dont show edge for now. Later i will add more dynamic effect to show stage of agent."* — a sanctioned spec change, NOT a check relaxation.

Removed (22 deletions in `sidebar.css`):
- the expanded waiting **border-left edge-bar** rule + the now-obsolete **WR-04 compound precedence selector** `.sidebar-row.active[data-agent='waiting']` (with the bar gone there is no precedence to arbitrate).
- the collapsed-rail waiting **edge-bar mirror** + its WR-04 collapsed selector — collapsed waiting now falls back to the amber `.collapsed-status-dot` (reads the row's `--accent`, amber while waiting).

**Confirmed preserved:**
- the expanded amber **WASH** `.sidebar-row[data-agent='waiting'] { background: color-mix(in oklch, var(--accent-waiting) 8%, transparent); }`.
- the **active row's own status-colored edge bar** (D-05/D-06): `.sidebar-row.active { border-left: 3px solid var(--accent); }` (expanded, line 92) and `.sidebar.collapsed .sidebar-row.active { border-left: 3px solid var(--accent); }` (collapsed, line 510).
- the collapsed `.collapsed-status-dot { background: var(--accent); }`.

`surfaces.ts`: the `sidebar-waiting` `expects` string updated from "amber left edge bar + a light amber tint wash" to "a light amber tint WASH ONLY (no edge bar)"; the data-agent poke + WR-05 `waitUntil` + WR-04 `cleanup` are intact.

## Verification

Per-task gates (the full suite + packaged `ui:shots:fresh` run in the 10-13 gate plan, NOT here):

- `npx vitest run src/renderer/__tests__/start-affordances.test.ts` → **11 passed** (the new GAP-10-H truth-table case(s) green).
- `npx vitest run src/renderer/__tests__/tokens-completeness.test.ts` → **14 passed** (no banned literal reintroduced by the CSS change).
- `npx tsc --noEmit` → exit **0**.
- Task-3 node CSS check → `OK: waiting wash-only; WR-04 removed; active edge bar preserved`.
- `git diff src/main/window-config.ts` (across all 3 commits) → **empty** (the 20-key bridge is untouched; `EXPECTED_API_KEYS` stays 20).
- **GAP-10-D/E/F/G untouched** — the only matches in the diff are unchanged context lines, not `+`/`-` edits to their behavior. No `data-testid`/class rename.

## Deviations from Plan

None — plan executed exactly as written. Task 1's diagnosis adjudicated all 4 pre-listed candidate hypotheses to a documented 5th classification (render-path verification gap), which the plan explicitly anticipates ("a render-path/state-flip NOT captured by the pure predicate" → add the ui-lab assertion). The Sidebar render-gate fix was a comment-lock (the predicate was already correct), and the regression pin landed in both the unit truth-table and the ui-lab DOM assertion, exactly per the Task-2 spec.

## Known Stubs

None introduced. The `trace-affordances.cjs` under the spike dir is a throwaway diagnosis driver (same class as the existing `.planning/spikes/*.cjs`, lint-deferred in `deferred-items.md`) — it is NOT wired into the shipped build.

## Self-Check: PASSED

- FOUND: `.planning/spikes/004-dormant-start-dup/README.md`
- FOUND: `.planning/spikes/004-dormant-start-dup/trace-affordances.cjs`
- FOUND commit `9d316f7` (Task 1 diagnosis)
- FOUND commit `ab4a0e5` (Task 2 GAP-10-H fix + regression)
- FOUND commit `4e03d84` (Task 3 GAP-10-I amendment)
