---
phase: 11-terminal-area-polish-live-start-restart
plan: 01
subsystem: ui
tags: [react, electron, confirm-modal, context-menu, restart-removal, recycle, smoke, wdio]

# Dependency graph
requires:
  - phase: 11-00
    provides: "pure electron-free buildConfirmBody(args) (D-04 seam); session-status.recycle.test.ts (O-1 A1 guard); terminal-card + agent-busy-confirm ui-lab surfaces"
  - phase: 06.1-lifecycle-redesign
    provides: "two-bucket Working-Area / Inactive-List partition; SEAM B alt-screen/mouse-reset machinery; the — restarted — separator seam"
provides:
  - "Restart-free live vocabulary: every restart UI entry point (sidebar ↻ + context-menu Restart) deleted; recycle is the sole path (Remove → Inactive List → Start ▶)"
  - "D-04 agent-aware confirm copy wired from the pure buildConfirmBody into the ConfirmModal body (ConfirmModal stays a dumb controlled component)"
  - "Three restart-asserting smoke specs rewritten in lockstep — no RED smoke after the UI deletion"
affects: [11-02, 11-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Remove-the-UI-keep-the-mechanism (D-01): ptyRestart IPC bridge key + handleRestart helper RETAINED but un-surfaced (flagged), EXPECTED_API_KEYS unchanged at 20"
    - "Conditional-spread context-menu items: the live (non-dormant) branch omits its Start/Restart entry entirely (no null in the ContextMenuItem[] array)"
    - "Smoke lockstep: a restart-driving spec is rewritten/retired in the SAME plan that deletes the UI driving it (RESEARCH Pitfall 1)"

key-files:
  created: []
  modified:
    - src/renderer/Sidebar.tsx
    - src/renderer/SessionManager.tsx
    - src/renderer/sidebar.css
    - tests/smoke/header-controls.smoke.test.ts
    - tests/smoke/startup-command.smoke.test.ts
    - tests/smoke/alt-screen-reset.smoke.test.ts

key-decisions:
  - "Context-menu Restart arm removed by converting the menuIsDormant ternary to a conditional spread (live rows offer NO Start/Restart entry) — the items prop is ContextMenuItem[] and cannot hold null"
  - "agentState passed straight into buildConfirmBody (read defensively off closingSession, like errorMessage) — the builder keys on the canonical 'in-progress'/'waiting' values per the wave-0 correction; no 'working' translation"
  - "alt-screen-reset.smoke (a THIRD restart-driving spec the plan/RESEARCH undercounted) had its two restart-seam it-blocks retired — that seam is now unreachable from any UI; abnormal-exit SEAM B coverage (the same MOUSE_RESET + 1049l write path) stays"

patterns-established:
  - "handleRestart flagged // D-01: retained machinery, no UI entry point + eslint-disable-next-line no-unused-vars (intentional dead code, re-surfaceable without re-plumbing IPC)"

requirements-completed: [SESS-07]

# Metrics
duration: 18min
completed: 2026-06-14
---

# Phase 11 Plan 01: Delete Restart UI + Wire D-04 Confirm Copy Summary

**Every restart affordance (sidebar ↻ + context-menu Restart) deleted, the D-04 agent-aware confirm copy wired from the pure `buildConfirmBody`, the `ptyRestart` machinery kept un-surfaced (EXPECTED_API_KEYS stays 20), and three restart-asserting smoke specs rewritten in lockstep so the suite is GREEN against a fresh packaged build — the SESS-07 / D-01 / D-04 / D-05 lifecycle simplification.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2
- **Files modified:** 6 (0 created)

## Accomplishments
- **D-01 restart-UI deletion (Task 1):** Removed the sidebar `↻` `restart-session` button block, the `onRestart` prop from `SortableRowProps` + `SidebarProps` and all pass-throughs, and the dead `isRunning`/`running` local it left behind. In `SessionManager.tsx` removed the context-menu Restart arm (live rows now offer no restart entry) and the `onRestart={handleRestart}` prop on `<Sidebar>`; `handleRestart` + `ptyRestart` are KEPT but flagged `// D-01: retained machinery, no UI entry point`.
- **D-04 agent-aware confirm copy (Task 1):** Replaced the inline `ConfirmModal` body ternary with a call to the pure, unit-tested `buildConfirmBody({ removeMode, configured, isRunning, agentState })` from `confirm-copy.ts`. `agentState` is read defensively off `closingSession` (like `errorMessage`) and passed straight through — the builder keys on the canonical `'in-progress'`/`'waiting'` values (the wave-0 correction). `ConfirmModal` stays a dumb controlled component; no raw-HTML escape hatch (`dangerouslySetInnerHTML` → 0).
- **Smoke lockstep (Task 2):** Rewrote `header-controls.smoke` (the menu-Restart-driving it-block → a `not.toContain('Restart')` context-menu absence assertion + a `contextMenuLabels` helper), `startup-command.smoke` (SC1 + SC3 → the recycle model: Remove → Inactive List → Start ▶ re-runs the stored command on a fresh process, no `— restarted` separator), and retired the two restart-seam it-blocks in `alt-screen-reset.smoke` (the menu Restart that drove them is gone). `app-restart-restore.smoke` stays byte-unchanged as the positive recycle proof.
- **All verification GREEN:** `tsc --noEmit` 0; `eslint` clean on all touched files; full unit suite 46 files / 401 tests; `security.guard` 4/4 (EXPECTED_API_KEYS = 20); `session-status.recycle` 7/7 (O-1 guard intact); the three rewritten specs + `app-restart-restore` GREEN against a freshly-packaged build.

## Task Commits

1. **Task 1: Delete restart UI entry points + wire D-04 confirm copy** — `1e6e247` (feat)
2. **Task 2: Rewrite restart-asserting smoke specs to the recycle model** — `c77de87` (test)

## Files Modified
- `src/renderer/Sidebar.tsx` — `↻ restart-session` button block removed; `onRestart` removed from `SortableRowProps` + `SidebarProps` + destructures + `renderRow` pass-through; dead `isRunning`/`running` removed; restart-referencing comments refreshed.
- `src/renderer/SessionManager.tsx` — `ConfirmModal body` wired to `buildConfirmBody` (import added); context-menu Restart arm removed (conditional spread; live rows omit the entry); `onRestart={handleRestart}` prop dropped; `handleRestart` flagged `// D-01: retained machinery` + `eslint-disable-next-line no-unused-vars`.
- `src/renderer/sidebar.css` — stale `restart-session` control comment refreshed (no rule existed; comment-only).
- `tests/smoke/header-controls.smoke.test.ts` — `not.toContain('Restart')` menu-absence assertion + `contextMenuLabels` helper; restart-driving it-block + unused imports removed; describe/header comment updated.
- `tests/smoke/startup-command.smoke.test.ts` — SC1 + SC3 rewritten to the recycle model; `menuAction(id,'Restart')` drives + the `— restarted` separator assertion removed; `inactive-list` landing assertions added.
- `tests/smoke/alt-screen-reset.smoke.test.ts` — two restart-seam it-blocks retired (UI driving them deleted); abnormal-exit SEAM B coverage + unused imports cleaned; header/describe updated.

## Decisions Made
- The context-menu `items` prop is typed `ContextMenuItem[]` (no null members). The plan's "make it `null`" suggestion would not type-check, so the `menuIsDormant ? Start : Restart` ternary became a conditional spread (`...(menuIsDormant ? [{Start}] : [])`) — a live row simply omits the entry. (See Deviation 1.)
- `agentState` is passed straight into `buildConfirmBody` (no `'working'` translation), honoring the wave-0 correction baked into the builder.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Context-menu items array is `ContextMenuItem[]` — cannot hold `null`**
- **Found during:** Task 1 (context-menu Restart arm removal)
- **Issue:** The plan/PATTERNS suggested replacing the Restart ternary with `menuIsDormant ? {Start} : null`, but `ContextMenu`'s `items` prop is `ContextMenuItem[]` (no null member) — a `null` entry would be a `tsc` type error.
- **Fix:** Converted the ternary to a conditional spread `...(menuIsDormant ? [{ label: 'Start', ... }] : [])` so the live (non-dormant) branch omits the entry entirely (mirroring the existing `menuCanStartNoCmd` spread pattern in the same array).
- **Files modified:** src/renderer/SessionManager.tsx
- **Verification:** `tsc --noEmit` 0; `grep -c "label: 'Restart'"` → 0; header-controls smoke `not.toContain('Restart')` GREEN.
- **Committed in:** 1e6e247

**2. [Rule 1 - Bug] Deleting the ↻ block + `onRestart` orphaned the `running`/`isRunning` locals (eslint no-unused-vars) and left `handleRestart` flagged-but-unused**
- **Found during:** Task 1 (eslint gate)
- **Issue:** `const running = isRunning(s.status)` and the `isRunning` helper in Sidebar.tsx were referenced ONLY by the deleted ↻ block → eslint `no-unused-vars` errors. `handleRestart` (intentionally retained dead code per D-01) also tripped `no-unused-vars`.
- **Fix:** Removed the now-dead `running` local + `isRunning` helper from Sidebar.tsx; added `// eslint-disable-next-line @typescript-eslint/no-unused-vars -- D-01: retained machinery` above `handleRestart` (kept deliberately, not deleted).
- **Files modified:** src/renderer/Sidebar.tsx, src/renderer/SessionManager.tsx
- **Verification:** `eslint` clean on both files; `tsc --noEmit` 0.
- **Committed in:** 1e6e247

**3. [Rule 3 - Blocking] A THIRD restart-driving smoke (`alt-screen-reset.smoke`) was undercounted by the plan/RESEARCH and would have gone RED**
- **Found during:** Task 2 (grep for `clickMenuItem('Restart')` across tests/smoke)
- **Issue:** RESEARCH Pitfall 1 named three affected specs (header-controls, startup-command, app-restart-restore) but app-restart-restore does NOT drive Restart — the real third driver is `alt-screen-reset.smoke.test.ts`, whose two restart-seam it-blocks call `clickMenuItem('Restart')`. After the menu item is deleted those clicks no-op and the it-blocks time out (15s) → suite RED, violating the must-have "no smoke is left RED."
- **Fix:** Retired the two restart-seam it-blocks (the in-place restart they drove is now unreachable from any UI; the seam machinery is kept per D-01 but cannot be exercised E2E). The MOUSE_RESET + scrollback-preserving `\x1b[?1049l` write path is still covered by the ABNORMAL-EXIT half of SEAM B (same write path, killProcess trigger), which stays GREEN. Cleaned the orphaned imports (`activeSessionId`/`openContextMenu`/`clickMenuItem`) and updated the file header + describe.
- **Files modified:** tests/smoke/alt-screen-reset.smoke.test.ts
- **Verification:** alt-screen-reset 2/2 GREEN against the fresh build (abnormal-exit coverage intact); `tsc`/`eslint` clean; `grep "clickMenuItem('Restart')" tests/smoke` shows only the (unrelated, untouched) suites at 0.
- **Committed in:** c77de87

---

**Total deviations:** 3 auto-fixed (2 Rule 3 - blocking, 1 Rule 1 - bug). No architectural (Rule 4) changes, no scope creep beyond keeping the smoke suite GREEN.

## Issues Encountered
- `app-restart-restore.smoke` flaked RED on its FIRST isolated run (stale userData from prior suite runs), then passed GREEN on two subsequent runs. The spec is byte-unchanged; the flake is a pre-existing stateful-smoke characteristic, not a regression introduced by this plan.

## Threat Surface
No new security-relevant surface. T-11-01 (XSS): the ConfirmModal body is the plain string from `buildConfirmBody`, rendered as a React text node (`dangerouslySetInnerHTML` → 0). T-11-02 (IPC budget): the `ptyRestart` bridge key in `window-config.ts` is UNCHANGED — only UI call-sites were removed; `EXPECTED_API_KEYS` stays 20 (`security.guard.test.ts` 4/4 GREEN). T-11-03 (retained dead machinery): `handleRestart` is intentionally un-surfaced (D-01) with zero UI callers (grep-confirmed). T-11-SC: zero packages added.

## User Setup Required
None.

## Next Phase Readiness
- The live vocabulary is now exactly Start / Remove / Clear; recycling is Remove → Inactive List → Start ▶. Plan 11-02 / 11-03 build on this restart-free baseline.
- The D-04 escalation copy is wired and renders the agent-aware prefix in the ConfirmModal; the Plan 03 packaged capture scores the `agent-busy-confirm` ui-lab chrome and the Plan 03 BLOCKING human gate is the real proof for this lifecycle change (the unit/grep/smoke guards here are necessary but not sufficient — the 06.1 lesson).
- No blockers. `ptyRestart` machinery + the `— restarted —` separator seam remain dormant (D-01) and can be re-surfaced without re-plumbing IPC if a future phase reintroduces an in-place restart.

## Self-Check: PASSED
- FOUND: src/renderer/Sidebar.tsx (modified)
- FOUND: src/renderer/SessionManager.tsx (modified)
- FOUND: src/renderer/sidebar.css (modified)
- FOUND: tests/smoke/header-controls.smoke.test.ts (modified)
- FOUND: tests/smoke/startup-command.smoke.test.ts (modified)
- FOUND: tests/smoke/alt-screen-reset.smoke.test.ts (modified)
- FOUND commit: 1e6e247, c77de87

---
*Phase: 11-terminal-area-polish-live-start-restart*
*Completed: 2026-06-14*
