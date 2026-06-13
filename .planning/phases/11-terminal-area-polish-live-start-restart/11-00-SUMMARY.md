---
phase: 11-terminal-area-polish-live-start-restart
plan: 00
subsystem: ui
tags: [react, electron, confirm-modal, agent-state, ui-lab, vitest]

# Dependency graph
requires:
  - phase: 10-sidebar-visual-polish
    provides: locked token system, the ui-lab surface registry + Surface shape, the data-agent styling seam
  - phase: 06.1-lifecycle-redesign
    provides: session-status.ts (resolveRowStatus / hasRendererIdentity) two-bucket reducer
provides:
  - "Pure electron-free buildConfirmBody(args) — the D-04 agent-aware confirm-body seam Plan 01 wires into SessionManager"
  - "O-1 A1 closure guard (session-status.recycle.test.ts) — proves no once-live row is dead-ended after the restart-UI removal in Plan 01"
  - "Two ui-lab evidence surfaces (terminal-card, agent-busy-confirm) for the Plan 03 packaged capture"
affects: [11-01, 11-02, 11-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure renderer copy-builder seam: electron-free, type-only AgentState import, unit-tested in the Node/Vitest env (mirrors session-status.ts / agent-state.ts)"
    - "Escalation-as-prefix: agent warning is prepended so the idle consequence sentence is never lost"
    - "Unit test proves the renderer-only-state BRANCH; the ui-lab surface scores only the modal CHROME"

key-files:
  created:
    - src/renderer/confirm-copy.ts
    - src/renderer/__tests__/confirm-copy.test.ts
    - src/renderer/__tests__/session-status.recycle.test.ts
  modified:
    - tests/ui-lab/surfaces.ts

key-decisions:
  - "Escalation fires on the canonical AgentState value 'in-progress' (the working state), not the literal 'working' the plan prose used — 'working' is not a member of the live union 'in-progress' | 'waiting' | 'free'"
  - "Kept the human word 'still working' in the copy literal (per the contract default) so the must_have `contains: still working` and the UI-SPEC wording both hold"
  - "Idle bodies kept as local literals in confirm-copy.ts (single source) and re-asserted byte-for-byte in the test, not re-imported, so a drift on either side fails the guard"

patterns-established:
  - "buildConfirmBody pure seam — Plan 01 replaces the inline SessionManager ternary with this builder"
  - "activeIsCard rule mirrored in the recycle test (status==='not_started'||'error') kept in lockstep with SessionManager.tsx ~615-616"

requirements-completed: [SESS-07, UI-03]

# Metrics
duration: 12min
completed: 2026-06-14
---

# Phase 11 Plan 00: Wave-0 Testable Seam + O-1 Closure + UI-Lab Evidence Slots Summary

**Pure electron-free `buildConfirmBody` D-04 escalation seam, a machine-checked O-1 A1 recycle guard proving no once-live row is dead-ended after the restart-UI removal, and two registered ui-lab evidence surfaces — all interface-first, zero user-visible change.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-14T01:50:00Z (approx)
- **Completed:** 2026-06-14T01:54:00Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `src/renderer/confirm-copy.ts` — a pure, electron-free `buildConfirmBody(args)` reproducing the 4 shipped idle bodies byte-for-byte and prepending the D-04 escalation prefix for the working / waiting agent states (10-test truth-table).
- `session-status.recycle.test.ts` — codifies the RESEARCH O-1 affordance table as assertions: identity exited/error → `not_started` (Inactive Start ▶); the residual non-active spawn-fail `error` row recovers via active → `activeIsCard` → IdleCard Retry. The green guard Plan 01's restart-UI deletion relies on.
- `tests/ui-lab/surfaces.ts` — `terminal-card` (framed live card) + `agent-busy-confirm` (escalated modal chrome) surfaces registered, with the PLANNER-NOTE that the copy branch is unit-proven and the surface scores chrome only.
- Full unit suite GREEN (46 files / 401 tests); `tsc --noEmit` and `eslint` clean on all touched files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract the pure buildConfirmBody builder** - `39102dc` (feat)
2. **Task 2: O-1 A1 closure recycle test** - `5c50bbd` (test)
3. **Task 3: Register terminal-card + agent-busy-confirm ui-lab surfaces** - `76a6682` (test)

## Files Created/Modified
- `src/renderer/confirm-copy.ts` - Pure `buildConfirmBody({ removeMode, configured, isRunning, agentState })` → escalation-prefixed body string (D-04); electron-free, type-only `AgentState` import, no raw-HTML escape hatch.
- `src/renderer/__tests__/confirm-copy.test.ts` - Truth-table: 5 idle branches (byte-identical to SessionManager.tsx ~706-712) + working/waiting/free/absent escalation assertions.
- `src/renderer/__tests__/session-status.recycle.test.ts` - O-1 A1: identity exited/error → not_started; non-active spawn-fail error → IdleCard Retry; no surviving row left without a Start ▶ / Retry path. References `resolveRowStatus`.
- `tests/ui-lab/surfaces.ts` - Two new Surface entries + PLANNER-NOTE; no existing surface disturbed.

## Decisions Made
- The plan/UI-SPEC prose used the label `agentState === 'working'`, but the live `AgentState` union (src/shared/agent-state.ts) is `'in-progress' | 'waiting' | 'free'`. The escalation therefore keys on `'in-progress'` (the mid-run state) and `'waiting'`. The human word "still working" is retained inside the copy literal so the UI-SPEC wording and the `contains: "still working"` must_have both hold. (See Deviation 1.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan literal `agentState === 'working'` does not type-check against the real AgentState union**
- **Found during:** Task 1 (buildConfirmBody)
- **Issue:** The PLAN/UI-SPEC repeatedly compared `agentState === 'working'`, but `AgentState` is `'in-progress' | 'waiting' | 'free'` — `'working'` is not a member, so a literal comparison would be a `tsc` type error and never fire. The "working" state is canonically `'in-progress'`.
- **Fix:** Escalation fires on `agentState === 'in-progress'` (working) and `'waiting'`; the copy literal keeps the human word "still working" per the contract default. The unit test asserts on `'in-progress'` accordingly.
- **Files modified:** src/renderer/confirm-copy.ts, src/renderer/__tests__/confirm-copy.test.ts
- **Verification:** `npx tsc --noEmit` exits 0; `npm run test:unit -- confirm-copy` 10/10 GREEN; `contains "still working"` and the byte-identical idle-body assertions hold.
- **Committed in:** 39102dc (Task 1 commit)

**2. [Rule 3 - Blocking] Acceptance grep gates tripped by explanatory comments containing the guarded literal**
- **Found during:** Task 1 (`dangerouslySetInnerHTML` count) + Task 3 (`copy BRANCH is proven by` count)
- **Issue:** A security comment literally spelled `dangerouslySetInnerHTML` (acceptance wanted `grep -c → 0`), and the PLANNER-NOTE wrapped "copy BRANCH" / "is proven by" across a line break (acceptance wanted `grep -c "copy BRANCH is proven by" → 1`).
- **Fix:** Reworded the security comment to "never reaches for the raw-HTML escape hatch" (intent preserved, literal gone → 0) and reflowed the PLANNER-NOTE so "copy BRANCH is proven by" sits on one line → 1.
- **Files modified:** src/renderer/confirm-copy.ts, tests/ui-lab/surfaces.ts
- **Verification:** `grep -c "dangerouslySetInnerHTML" → 0`; `grep -c "copy BRANCH is proven by" → 1`; eslint clean.
- **Committed in:** 39102dc (Task 1) / 76a6682 (Task 3)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both adjustments are correctness/gate-alignment fixes that preserve the planner's intent exactly (escalation on the real working state; the security & seam guards still assert what they were written to assert). No scope creep; no behavior change beyond the interface-first seam.

## Issues Encountered
None - the wave-0 work was self-contained; the only friction was the two grep/type alignments documented above.

## Threat Surface
No new security-relevant surface. T-11-01 (XSS): `buildConfirmBody` returns a plain string with zero raw-HTML usage; the caller renders it as a React text node. T-11-02 (IPC budget): no bridge key added — pure renderer module + tests + ui-lab registry; `EXPECTED_API_KEYS` stays 20. T-11-SC: zero packages added.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `buildConfirmBody` is the green, test-covered seam Plan 01 wires into the SessionManager ConfirmModal body prop (replacing the inline ternary) and is the basis for the restart-UI deletion (D-01) guarded by the O-1 recycle test.
- The `terminal-card` + `agent-busy-confirm` surfaces are wired and typecheck; they are captured/scored at the Plan 03 phase gate after the card (D-03) and copy (D-04) land — not run in this plan.
- No blockers. Note the canonical `AgentState` value is `'in-progress'`, not `'working'` — Plan 01's wiring must read `activeRecord.agentState` and pass it straight into `buildConfirmBody` (the builder already keys on the correct values).

## Self-Check: PASSED
- FOUND: src/renderer/confirm-copy.ts
- FOUND: src/renderer/__tests__/confirm-copy.test.ts
- FOUND: src/renderer/__tests__/session-status.recycle.test.ts
- FOUND: tests/ui-lab/surfaces.ts (modified)
- FOUND commit: 39102dc, 5c50bbd, 76a6682

---
*Phase: 11-terminal-area-polish-live-start-restart*
*Completed: 2026-06-14*
