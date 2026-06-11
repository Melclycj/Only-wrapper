---
phase: 10-sidebar-visual-polish
plan: 05
subsystem: ui
tags: [react, css, sidebar, agent-state, ui-lab, gap-closure]

# Dependency graph
requires:
  - phase: 10-02
    provides: the two-line sidebar row + hover-reveal control cluster + data-agent='waiting' CSS seam
  - phase: 10-03
    provides: the agent-state presentation overlay (presentation/AGENT_STYLE) + SessionView idle detector wiring
provides:
  - "GAP-10-A fix: hover-control cluster collapses to zero layout width at rest so the session name reclaims the rail"
  - "WR-04 fix: explicit, order-independent waiting-beats-active edge-bar precedence (+ collapsed-rail mirror)"
  - "WR-03 fix: data-agent is running-gated via a pure rowAgentAttr() helper — a finished row never carries stale amber"
  - "Pure unit coverage (sidebar-agent-attr.test.ts) for the running-gated seam"
  - "IN-05 fix: ui-lab sidebar-waiting surface unblocked via a deterministic styling-only data-agent DOM poke (produces a PNG)"
  - "WR-02 end-to-end live chain trace + conclusion (below)"
affects: [10-06, sidebar, agent-state, ui-lab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-width-at-rest hover-reveal: collapse max-width/padding/border-width to 0 (opacity-only transition) instead of opacity:0, so an unrevealed control reserves no layout box"
    - "Order-independent CSS precedence: match both the combined and the standalone selector in one rule so a future reorder cannot silently invert the winner"
    - "Render-time running-gate factored into a pure, unit-testable reducer (rowAgentAttr) — belt-and-suspenders over the store/reducer gates"
    - "ui-lab styling-only DOM seam: poke an attribute the CSS keys on to capture a treatment whose real driver is not deterministically scriptable"

key-files:
  created:
    - src/renderer/__tests__/sidebar-agent-attr.test.ts
  modified:
    - src/renderer/sidebar.css
    - src/renderer/Sidebar.tsx
    - src/renderer/row-secondary.ts
    - tests/ui-lab/surfaces.ts

key-decisions:
  - "max-width is layout-bound (web/performance.md) — kept OUT of the transition list so it snaps; only opacity animates"
  - ".row-controls container gap/margin zeroed at rest and restored on the reveal/dormant selectors so the cluster reserves truly zero width"
  - "data-agent gate factored as a pure helper (rowAgentAttr) rather than inlined, so the WR-03 invariant is unit-testable in the node Vitest env (no jsdom)"
  - "ui-lab seam is presentation-only — it does NOT exercise the real frame-stability detector (that stays covered by the replay oracle + manual gate)"

patterns-established:
  - "Zero-width-at-rest reveal cluster for sidebar rows"
  - "Order-independent edge-bar precedence pairing (active+waiting AND standalone waiting)"
  - "Pure running-gate seam (rowAgentAttr) backing a JSX attribute"

requirements-completed: [UI-02]

# Metrics
duration: ~8min
completed: 2026-06-11
---

# Phase 10 Plan 05: Sidebar Gap-Closure Summary

**Closed the two Phase-10 blockers — the hover-control cluster now collapses to zero width at rest (name legibility restored) and the amber "waiting" signal is running-gated, unit-tested, and capturable in ui-lab — plus made waiting-beats-active edge-bar precedence explicit (WR-04).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-11T09:55:00Z (approx)
- **Completed:** 2026-06-11T10:03:33Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- **GAP-10-A / WR-01:** the at-rest `.row-control` now collapses its layout box (`max-width/padding/border-width: 0` + `overflow: hidden`), and the `.row-controls` container's resting `gap`/`margin-left` are zeroed — so on the 220px rail a running non-active long-name row reserves ZERO control width and the name reclaims the space. The reveal selectors restore `max-width: 24px` on hover/active/focus; every control stays in the DOM for the E2E driver; the dormant ▶ Start keeps its reserved width (D-13 exemption).
- **WR-04:** an explicit `.sidebar-row.active[data-agent='waiting'], .sidebar-row[data-agent='waiting']` rule sets the amber `border-left` so amber wins over the active accent order-independently; mirrored in the collapsed rail.
- **WR-03 / GAP-10-B:** the `data-agent` JSX seam is now gated on `status === 'running' && agentState` via a new exported pure `rowAgentAttr(status, agentState)` helper in `row-secondary.ts`; a finished/exited/stopped/not_started row can never render stale amber. Backed by a new pure unit test (8 cases).
- **IN-05:** the ui-lab `sidebar-waiting` surface no longer throws `SkipSurface` — it sets `data-agent='waiting'` on a real row via a deterministic styling-only DOM poke and produces a PNG, giving the amber treatment automated regression coverage for the first time.

## Task Commits

1. **Task 1: Collapse hover-control box to zero width + explicit waiting-beats-active** — `08dcda8` (fix)
2. **Task 2 (RED): failing test for running-gated data-agent seam** — `6b77fc0` (test)
3. **Task 2 (GREEN): gate data-agent via pure rowAgentAttr seam** — `dd5138b` (feat)
4. **Task 3: unblock ui-lab sidebar-waiting via deterministic data-agent seam** — `bf29389` (test)

_Task 2 is TDD (RED → GREEN); no REFACTOR commit was needed (the GREEN implementation is already minimal)._

## Files Created/Modified
- `src/renderer/sidebar.css` — zero-width-at-rest `.row-control` + `.row-controls` gap/margin neutralization + restore-on-reveal; explicit order-independent waiting-beats-active edge bar (+ collapsed-rail mirror)
- `src/renderer/row-secondary.ts` — new exported pure `rowAgentAttr(status, agentState)` running-gate helper
- `src/renderer/Sidebar.tsx` — imports + uses `rowAgentAttr`; emits `data-agent` only when the gated value is defined
- `src/renderer/__tests__/sidebar-agent-attr.test.ts` — new pure-function test guarding the WR-03 invariant
- `tests/ui-lab/surfaces.ts` — `sidebar-waiting` prepare replaced with a deterministic styling-only `data-agent` poke

## WR-02 End-to-End Live Chain Trace + Conclusion

**Required by Task 2 acceptance.** The amber "Waiting for you" treatment never appeared live before this plan. The chain from agent output to the rendered attribute:

1. **Detection (NOT the failure).** `src/shared/agent-state.ts` `classify()` is the pure frame-stability recognizer. The oracle `src/shared/__tests__/agent-state-replay.test.ts` replays the REAL `claude --rc` capture (`.planning/spikes/002-real-agent-frames/capture-claude.jsonl`) through `@xterm/headless` + `classify()` and asserts **exactly 1 WAITING** across 11 settles. It is GREEN before and after this plan — so the recognizer demonstrably works. The WR-02 defect is therefore in **propagation/render**, not detection.
2. **Emission.** `src/renderer/SessionView.tsx` runs the detector inside an `id`-keyed effect (`emitAgent` at ~L357 → `onAgentStateRef.current(id, state)` at L360). It is gated on `agentRunning` (flipped true on the running broadcast at L481, false on leaving running at L505) and emits change-only. This path is sound: `onAgentStateRef` is a ref updated every render (L188-189) so the effect never re-binds/tears down the xterm.
3. **Store.** `src/renderer/SessionManager.tsx` `handleAgentState` (L564-572) writes `agentState` onto the matching row **only while `row.status === 'running'`** (functional `setSessions` update). A late classification cannot resurrect an overlay on a stopped row.
4. **Reducer.** `src/renderer/apply-status-event.ts:80` already clears `agentState` whenever a row leaves running (`const agentState = event.status === 'running' ? row.agentState : undefined;`), and the move-to-Inactive branch (L88-95) also drops it. The store already had a running gate at TWO points.
5. **Render (the fix site).** `src/renderer/Sidebar.tsx` previously emitted `data-agent` on `agentState` **truthiness alone** (old L242: `{...(agentState ? { 'data-agent': agentState } : {})}`). This was the ONE point in the chain NOT running-gated. With the steps above clearing `agentState` off non-running rows, the live amber failure was **not** a stale-amber leak here — it was the absence of capturable/regression proof (IN-05) plus the missing belt-and-suspenders render gate.

**Conclusion: chain-sound-once-WR-03 + IN-05-applied.** No detector-emission bug was found — `classify()`, `emitAgent`/`agentRunning`, `handleAgentState`, and `apply-status-event.ts:80` are all correct and already running-gated. The prior "amber never appeared live" symptom is explained by (a) the absent ui-lab capture coverage (now closed by IN-05, Task 3) and (b) the missing render-time gate, which is now hardened by the pure `rowAgentAttr` seam (WR-03, Task 2) as defense-in-depth — a third running-gate at the render boundary so no future store/reducer regression can surface stale amber. Evidence: the replay oracle (1 WAITING from the real capture, GREEN), `SessionManager.handleAgentState` L567 running guard, `apply-status-event.ts:80` running guard, and the new `sidebar-agent-attr.test.ts` (8 cases, GREEN).

## Decisions Made
- Kept `max-width` out of the `.row-control` transition (layout-bound per web/performance.md) — it snaps; only `opacity` animates.
- Zeroed the `.row-controls` container `gap`/`margin-left` at rest (not just the children) and restored them on the reveal + dormant selectors, so an all-collapsed cluster reserves truly zero width.
- Factored the running-gate into a pure `rowAgentAttr` helper rather than inlining the `s.status === 'running'` check in JSX, so the WR-03 invariant is unit-testable without jsdom.
- The ui-lab seam is presentation-only by design — it proves the CSS renders amber, not that the detector fires (that stays the replay oracle's job).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. All per-task verifications (grep + tokens-completeness + tsc), the full unit suite (365 tests / 42 files GREEN, including the 8 new cases), the agent-state-replay oracle (GREEN — not regressed by the seam factoring), and eslint on the touched Phase-10 files were clean.

## Known Stubs
None introduced. The ui-lab `data-agent` seam is a deterministic test-only DOM poke (harness code, never shipped) — not a production stub.

## Next Phase Readiness
- The code-level closes for GAP-10-A, GAP-10-B (WR-02/WR-03/IN-05), and WR-04 are complete and token-clean. GAP-10-C was correctly left untouched (no edge-bar color-semantics change).
- **Deferred to 10-06 (re-verify gate):** the packaged ui-lab capture (proving the amber PNG + the name-legibility fix visually), the smoke suite, and the BLOCKING human re-verify. This plan is code-only.

---
*Phase: 10-sidebar-visual-polish*
*Completed: 2026-06-11*
