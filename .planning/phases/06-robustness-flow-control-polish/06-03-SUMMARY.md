---
phase: 06-robustness-flow-control-polish
plan: 03
subsystem: renderer
tags: [agent-state, term-09, sc4, presentation-overlay, idle-detector, zero-ipc, redos-safe, tdd]

# Dependency graph
requires:
  - phase: 06-robustness-flow-control-polish
    plan: 01
    provides: "pure shared/agent-state.ts (AgentState, IDLE_MS=800, classifyIdle, anchored ReDoS-safe PROMPT_RE)"
  - phase: 06-robustness-flow-control-polish
    plan: 02
    provides: "SessionRow per-row errorMessage state + onPtyStatus subscription (agentState added beside it, undisturbed)"
provides:
  - "AGENT_STYLE ramp + presentation(status, agent?) resolver in status-colors.ts — agent-state OVERLAY applied ONLY when status==='running' (D-07); amber oklch(0.66 0.15 60) reserved for 'waiting' in exactly one place"
  - "Renderer-side idle-timer detector in SessionView off the existing onPtyData stream (zero IPC): bounded ~4 KB rolling tail, single-slot timer cleared-before-re-arm AND in cleanup, gated on running, change-only emission via onAgentState"
  - "SessionManager renderer-only per-row agentState (never persisted, never IPC, D-06); set only while running, cleared on transition away from running (D-07/D-10)"
  - "Sidebar row badge/dot + collapsed-rail dot + rail-tooltip and IdentityHeader badge all routed through presentation() — agent-state overlay shown everywhere a status is shown (D-10)"
affects: [06-04-renderer-controls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentation OVERLAY resolver: presentation(status, agent?) returns the agent-state ramp only while running, else STATUS_STYLE[status] — the overlay never leaks past running (D-06/D-07)"
    - "Stable callback ref (onAgentStateRef) so the id-keyed mount effect never re-binds on parent re-render — the xterm instance is never torn down by a fresh closure"
    - "Single-slot idle timer: cleared-before-re-arm on each chunk AND in the effect cleanup, mirroring the resize-debounce discipline (Pitfall 6 / T-06-10 leak-safe)"
    - "Renderer-only row overlay field (agentState) beside errorMessage — read defensively in Sidebar since the SessionRecord prop type does not declare it"

key-files:
  created:
    - src/renderer/__tests__/status-colors.test.ts
  modified:
    - src/renderer/status-colors.ts
    - src/renderer/SessionView.tsx
    - src/renderer/SessionManager.tsx
    - src/renderer/Sidebar.tsx
    - src/renderer/IdentityHeader.tsx

decisions:
  - "presentation() overlay applies ONLY when status==='running' && agent is present — every other status (and running-with-no-agent-yet) returns STATUS_STYLE[status] unchanged (D-06/D-07)"
  - "amber oklch(0.66 0.15 60) appears in EXACTLY ONE place (the AGENT_STYLE.waiting ramp); the explanatory comment was reworded to avoid a second literal so the reserved-amber invariant holds under grep -c"
  - "onAgentState is routed through a ref so the id-keyed mount effect deps stay [id] — re-binding on every parent render would dispose+recreate the xterm (Pitfall 6)"
  - "agentState is accepted into a row only while that row.status==='running' (handleAgentState guard) AND cleared on any onPtyStatus transition away from running — defends against a late idle-timer fire resurrecting an overlay on a stopped session"

requirements-completed: [TERM-09]

# Metrics
duration: ~20min
completed: 2026-06-07
---

# Phase 6 Plan 03: Agent-State Presentation Layer Summary

**Shipped TERM-09/SC4 as an honest presentation overlay: a renderer-side idle-timer detector computes each running session's agent-state (blue "In progress" while output flows, amber "Waiting for you" when idle at a prompt, slate "Free" when idle without one) off the existing onPtyData stream with zero IPC, and the sidebar rows, collapsed rail, and identity header all render it via a single presentation() resolver that applies the overlay ONLY while status==='running'.**

## Performance
- **Duration:** ~20 min
- **Tasks:** 3 (Task 1 tdd="true" — implementation + test written and run RED→GREEN within the single task commit; MVP RED-first, TDD_MODE=false so no separate RED-commit gate)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

**Task 1 — color ramp + resolver (`11564bd`):**
- Added `AGENT_STYLE` (in-progress→blue `oklch(0.62 0.14 248)`, waiting→amber `oklch(0.66 0.15 60)`, free→slate `oklch(0.64 0.02 260)`) mirroring the `STATUS_STYLE` `{ label, accent }` shape with the authoritative UI-SPEC §Color oklch ramps.
- Exported `presentation(status, agent?)`: returns `AGENT_STYLE[agent]` only when `status === 'running' && agent`, else `STATUS_STYLE[status]`. `STATUS_STYLE` itself is unchanged in shape (process accents intact).
- `status-colors.test.ts` (9 cases) asserts every behavior-block case incl. the overlay-only-when-running rule: `presentation('exited','waiting')` returns the exited style, `presentation('error', anything)` returns red, not_started/stopped return their entries even when an agent-state is (wrongly) supplied.
- Amber `oklch(0.66 0.15 60)` appears in EXACTLY ONE place (`grep -c` = 1).

**Task 2 — detector + lift (`233868c`):**
- `SessionView` gained an `onAgentState(id, state)` prop. The detector lives inside the EXISTING `onPtyData` closure: on each chunk it emits `'in-progress'`, maintains a bounded `(agentTail + data).slice(-4096)` rolling tail, clears the single-slot idle-timer ref, then re-arms `setTimeout(() => emit(classifyIdle(agentTail)), IDLE_MS)`. The callback is routed through `onAgentStateRef` so the id-keyed mount effect never re-binds (no xterm teardown).
- The detector is gated on `agentRunning`, flipped true on a `'running'` status and false on any transition away from running (which also cancels the pending timer, clears the tail, and resets the change-tracker). Emission is change-only (`lastAgent`). The idle timer is cleared in the effect cleanup (no leak across unmount — T-06-10 / Pitfall 6).
- `SessionManager` added a renderer-only `agentState?: AgentState` to `SessionRow` (beside `errorMessage`, never persisted, never IPC — D-06); `handleAgentState` stores it only while the row is running; the onPtyStatus subscription clears it on any transition away from running (notice events leave it alone).

**Task 3 — consuming surfaces (`e466d03`):**
- `Sidebar` row `.status-badge`/`.status-dot`, the collapsed-rail `.collapsed-status-dot`, and the rail-tooltip all derive from `presentation(s.status, agentState)` (agentState read defensively off the row). `IdentityHeader` badge consumes `presentation(session.status, agentState)` with a threaded `agentState` prop fed `activeRecord.agentState`.
- No direct `STATUS_STYLE[]` lookups remain for any badge. Identical chip geometry; no animation/pulse/count badge introduced (calm by design, UI-SPEC §Interaction 1).

## Task Commits
1. **Task 1: agent-state color ramp + presentation() resolver** — `11564bd` (feat)
2. **Task 2: renderer-side detector + lift to SessionManager** — `233868c` (feat)
3. **Task 3: route Sidebar row/rail + IdentityHeader badges through presentation()** — `e466d03` (feat)

## Decisions Made
- The overlay applies ONLY when `status==='running' && agent` (D-06/D-07) — enforced in `presentation()` and asserted in the test.
- Amber lives in exactly one place; an explanatory comment was reworded to avoid a second literal (so the reserved-amber invariant holds under `grep -c`).
- `onAgentState` is routed through a ref to keep the mount effect deps `[id]` (re-binding would dispose+recreate the xterm — Pitfall 6).
- `handleAgentState` only writes `agentState` while the row is running, and the status subscription clears it on transition away from running — a late idle-timer fire can never resurrect an overlay on a stopped session.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Inlined the `slice(-4096)` literal instead of a named `AGENT_TAIL_BYTES` constant**
- **Found during:** Task 2
- **Issue:** The plan's acceptance criterion greps for `slice(-4096)` / `slice(-4_096)` literally. A named constant `AGENT_TAIL_BYTES = 4096` would have failed that grep, and leaving the unused constant after inlining would fail tsc/eslint (noUnusedLocals).
- **Fix:** Inlined `.slice(-4096)` with an explanatory comment (WR-03 / T-06-09 rationale) and removed the would-be-unused constant. Behavior identical — bounded ~4 KB rolling tail.
- **Files modified:** src/renderer/SessionView.tsx
- **Verification:** `grep -n "slice(-4096)"` matches; tsc + eslint clean
- **Committed in:** 233868c (Task 2)

**2. [Rule 3 - Blocking] Used `npm run test:unit` + `npx tsc --noEmit` + `npm run package` for the "npm test" / "npm run build" verifies**
- **Found during:** all tasks
- **Issue:** The plan's verify commands reference `npm test` (full suite incl. slow WDIO smoke) and `npm run build` (no such script). Per the executor BUILD/TEST note and the 06-01/06-02 precedent, the substitutes are `npm run test:unit` (vitest), `npx tsc --noEmit` (type check), and `npm run package` (build).
- **Fix:** Verified via `npm run test:unit` (190/190 GREEN), `npx tsc --noEmit` (exit 0), `npm run package` (arm64 packaging succeeded), and eslint on all touched files (clean).
- **Files modified:** none (verification only)
- **Committed in:** n/a (no code change)

---

**Total deviations:** 2 auto-fixed (1 literal-vs-constant to satisfy the grep criterion + keep the build clean, 1 build/test-command substitution per the verified project note). No scope creep — production behavior matches the plan's intent exactly.

## Issues Encountered
None beyond the deviations above.

## Known Stubs
None. The detector wires real data: it classifies the live `onPtyData` tail via `classifyIdle` (Plan 01) and lifts a real per-session `agentState` that the sidebar/rail/header render. No placeholder/empty-value data paths were introduced. The two Wave 0 smoke scaffolds (`alt-screen-reset`, `header-controls`) remain `describe.skip` and are owned by Plan 06-04, not this plan.

## Threat Flags
None — no new trust-boundary surface beyond the plan's `<threat_model>`. The detector runs the anchored ReDoS-safe `PROMPT_RE` (Plan 01) only on a bounded ~4 KB tail at most once per `IDLE_MS` (T-06-09 mitigated); the single-slot timer is cleared-before-re-arm and in cleanup, gated on running (T-06-10 mitigated); detection uses only output-activity timing + last-line shape, never interprets or stores conversation content (T-06-11 accept, privacy line honored). Zero IPC — no bridge surface added.

## Self-Check: PASSED

- Created file present: `src/renderer/__tests__/status-colors.test.ts` (FOUND).
- All three task commits verified in git history: `11564bd`, `233868c`, `e466d03` (FOUND).
- `npm run test:unit` GREEN (190/190); `npx tsc --noEmit` exit 0; `npm run package` succeeded; eslint clean on all touched files.
- Acceptance greps verified: `presentation(` in Sidebar + IdentityHeader; NO direct `STATUS_STYLE[` badge lookups; `onAgentState` in both SessionView + SessionManager; `classifyIdle`/`IDLE_MS` + `slice(-4096)` + `clearTimeout(idleTimer)` (cleanup) in SessionView; amber `oklch(0.66 0.15 60)` count = 1.

---
*Phase: 06-robustness-flow-control-polish*
*Completed: 2026-06-07*
