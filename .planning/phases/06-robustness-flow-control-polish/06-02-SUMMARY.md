---
phase: 06-robustness-flow-control-polish
plan: 02
subsystem: pty + renderer
tags: [spawn-error, cwd-validation, error-card, folder-picker, edit-prefill, tdd, vitest]

# Dependency graph
requires:
  - phase: 06-robustness-flow-control-polish
    plan: 01
    provides: "pty-spawn-error.test.ts RED scaffold, pickDirectory bridge key (19 keys), PtyStatusPayload.notice transport, WR-02/WR-03 readiness-probe fixes"
provides:
  - "create() cwd pre-validation (D-01): explicit-missing cwd → status 'error' + 'Working directory not found: <path>', NEVER a silent ~ spawn (D-02); node-pty not spawned"
  - "try/catch spawn (sync EACCES → 'Couldn't start session: <reason>') + async fork-then-die abnormal-exit generic notice (D-05)"
  - "skipStartupCommand opt on PtyCreateOptions (main + shared) → bare shell skipping TERM-05 auto-run for one launch (D-14)"
  - "sanitizeNotice control-char stripper (WR-04); updateProfile trims startupCommand at persist (WR-05)"
  - "IdleCard error branch: specific message + Edit/Retry action row (D-03/D-04)"
  - "SessionManager per-row errorMessage capture + handleStartNoCmd + edit-prefill rehydration; Sidebar error-row title tooltip"
  - "SessionEditModal Browse… folder picker wired to pickDirectory()"
affects: [06-03-agent-state-detector, 06-04-renderer-controls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validate-in-main pre-spawn: an explicit-but-missing cwd errors before node-pty is touched (D-01) — distinguishes 'no cwd (home OK)' from 'cwd given but gone (error)' (D-02)"
    - "Renderer-only row field (SessionRow = SessionRecord & { errorMessage? }) captured from the onPtyStatus notice — never persisted, never crosses the bridge (Open Q2)"
    - "Edit-prefill via authoritative listSessions() re-read after add/save — main is source of truth for the validated/trimmed cwd/shell/startupCommand (no new bridge key, Open Q3)"

key-files:
  created: []
  modified:
    - src/main/pty-manager.ts
    - src/main/__tests__/pty-spawn-error.test.ts
    - src/main/__tests__/readiness-probe.test.ts
    - src/main/__tests__/pty-lifecycle.test.ts
    - src/main/__tests__/pty-update-profile.test.ts
    - src/main/__tests__/pty-hydrate.test.ts
    - src/renderer/IdleCard.tsx
    - src/renderer/SessionManager.tsx
    - src/renderer/SessionEditModal.tsx
    - src/renderer/Sidebar.tsx
    - src/renderer/terminal.css
    - src/shared/api-types.ts

decisions:
  - "D-01/D-02: pre-validate the RESOLVED cwd with the existing isValidCwd guard verbatim (no new validator); an explicit-but-missing cwd is an error, NEVER a silent ~ spawn"
  - "Failed spawn (pid -1) no longer triggers the renderer's optimistic 'running' flip — main has already broadcast 'error' + the notice, so the error card/badge stand"
  - "An 'error' session renders the IdleCard (no SessionView) exactly like a dormant session — a failed spawn has no live PTY to bind"
  - "WR-05 trim semantics: full leading+trailing trim at persist; an all-whitespace command stores as '' → the bare-shell path"

requirements-completed: [TERM-12]

# Metrics
duration: ~18min
completed: 2026-06-07
---

# Phase 6 Plan 02: Spawn Error Recovery Summary

**Turned the SC2 silent-failure mode into a surfaced, fixable state end-to-end: a missing explicit cwd now errors honestly (status 'error' + 'Working directory not found: <path>', never a silent shell in ~), surfaces in BOTH the sidebar tooltip AND an error card with Edit/Retry, and is fixable via a native Browse… picker — plus the D-14 "Start without command" escape hatch and edit-prefill from main's truth.**

## Performance
- **Duration:** ~18 min
- **Tasks:** 2 (Task 1 tdd="true" — filled the RED scaffold GREEN; MVP RED-first, no separate RED commit since TDD_MODE=false)
- **Files modified:** 12 (0 created, 12 modified)

## Accomplishments

**Task 1 — main spawn-error path (`477db49`):**
- `create()` now computes `requestedCwd` distinguishing an EXPLICIT cwd (opts OR a stored record) from no-cwd. An explicit-but-invalid cwd → `setStatus('error')` + a `'Working directory not found: <path>'` notice on the existing channel, and `return { id, pid: -1 }` — **node-pty is never spawned with a bad cwd** (D-01/D-02, asserted in the unit test). Only a truly-unspecified cwd falls back to `os.homedir()`.
- `pty.spawn()` is wrapped in try/catch for the rare synchronous EACCES → generic `'Couldn't start session: <reason>'` (D-05). The common bad-cwd/bad-shell case (Pitfall 1: forks-then-dies on macOS, no sync throw) is covered by the async abnormal-exit path, which now emits a generic `'…the shell exited immediately'` notice so the error card has a message.
- `skipStartupCommand?: boolean` added to the main `PtyCreateOptions`; the injection guard skips the probe + injection entirely when set, without clearing the stored command (D-14).
- `updateProfile` trims `startupCommand` at persist (WR-05); `sanitizeNotice` strips C0/C1/DEL control chars from the interpolated notice (WR-04).
- WR-01/IN-01: removed the unreachable post-settle scrub branch + the `stripProbeEcho` helper (and its tests) — invisibility is guaranteed by dispose-and-discard-on-match.
- Filled `pty-spawn-error.test.ts` GREEN (13 cases) and added permissive `node:fs` mocks to the lifecycle/update-profile/hydrate/readiness-probe harnesses so their fixture cwds pass the new pre-validation (see Deviations).

**Task 2 — renderer error surfacing + recovery (`8f20fa3`):**
- `IdleCard` error branch renders the specific message in the JetBrains-Mono `.idle-card-value` role + the helper line + a two-button Edit/Retry action row (`error-card-edit`/`error-card-retry`) (D-03/D-04).
- `SessionManager` captures `p.notice` into a renderer-only `errorMessage` on the matching row when status is 'error' (cleared on transition away); an 'error' session renders the IdleCard (never a SessionView). `handleStartNoCmd` threads `skipStartupCommand` through `ptyCreate`; a "Start without command" context-menu item appears for a startable row with a saved command (D-14).
- Edit-prefill: `rehydrateProfiles()` re-reads `listSessions()` after add + save-profile and merges main's authoritative `cwd`/`shell`/`startupCommand` (Open Q3 — no new bridge key).
- `Sidebar` surfaces the error message as the error row's `title=` tooltip (D-03 both places).
- `SessionEditModal` gains a "Browse…" button (`browse-cwd`) wired to `pickDirectory()` → `setCwd(path)`; Cancel (null) leaves the field unchanged; CR-01 still gates on save.

## Task Commits
1. **Task 1: main spawn-error path** — `477db49` (feat)
2. **Task 2: renderer error surfacing + recovery** — `8f20fa3` (feat)

## Decisions Made
- An explicit-but-missing cwd is an error (D-01/D-02) — reusing `isValidCwd` verbatim, no new validator.
- A failed spawn (pid -1) does NOT optimistically flip the row to 'running' — main's synchronous 'error' broadcast (which arrives before the `ptyCreate` await resolves) would otherwise be clobbered.
- An 'error' session is rendered via the IdleCard (no SessionView mount — a failed spawn has no PTY to bind), mirroring the dormant-session rendering rule (Pitfall 4).
- WR-05 trim is a full leading+trailing trim; an all-whitespace command persists as `''` (the bare-shell path).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `node:fs` mocks to four existing main-side test harnesses so their fixture cwds pass the new D-01 pre-validation**
- **Found during:** Task 1 (full unit-suite run after the cwd pre-validate landed)
- **Issue:** `create()` now pre-validates the resolved cwd against the REAL `fs.statSync` via `isValidCwd`. The existing `pty-lifecycle`, `pty-update-profile`, `pty-hydrate`, and `readiness-probe` harnesses spawn into mocked directories (`/Users/fake-home`, `/tmp/project`, `/Users/dev/proj`, `/stored/cwd`) that do not exist on the test host — so every explicit-cwd / restart / dormant-promotion case began erroring instead of spawning.
- **Fix:** Added a minimal `vi.mock('node:fs')` to each harness whose `statSync` treats exactly that harness's fixture directories as real directories and throws ENOENT otherwise (so the CR-01 "non-existent cwd is ignored" update-profile case keeps its meaning). Inlined the literal paths inside the factory (vi.mock is hoisted — referencing the module-scope `FAKE_HOME` const is a TDZ error).
- **Files modified:** src/main/__tests__/pty-lifecycle.test.ts, pty-update-profile.test.ts, pty-hydrate.test.ts, readiness-probe.test.ts
- **Verification:** full `npx vitest run` GREEN (181 tests)
- **Committed in:** 477db49 (Task 1)

**2. [Rule 2 - Missing critical functionality] Renderer `PtyCreateOptions` extended with `skipStartupCommand?` + the failed-spawn optimistic-status guard**
- **Found during:** Task 2
- **Issue:** (a) The shared `PtyCreateOptions` (api-types.ts) had no `skipStartupCommand` field, so `handleStartNoCmd` could not thread the D-14 flag through the bridge. (b) `handleStart` optimistically set `status: 'running'` regardless of the returned pid — on a failed spawn (pid -1) this clobbered the 'error' status/card that main had already broadcast.
- **Fix:** Added `skipStartupCommand?: boolean` to the shared type (flows through the existing ptyCreate shape — no new bridge key, EXPECTED_API_KEYS stays 19); guarded the optimistic 'running' flip behind `pid > 0` in both `handleStart` and `handleStartNoCmd`.
- **Files modified:** src/shared/api-types.ts, src/renderer/SessionManager.tsx
- **Verification:** tsc clean; full suite GREEN; the error card renders on the failed-spawn path
- **Committed in:** 8f20fa3 (Task 2)

**3. [Rule 3 - Blocking] Used `npm run package` (electron-forge) for the "npm run build" verify**
- **Found during:** Task 2 verification
- **Issue:** The plan's verify command was `npm run build`, but the project has no `build` script.
- **Fix:** Verified the renderer/main bundle via `npx tsc --noEmit` (exit 0) AND `npm run package` (vite bundles + arm64 packaging all succeeded), per the executor's verified BUILD/TEST note and the 06-01 precedent.
- **Files modified:** none (verification only)
- **Verification:** both commands exit 0
- **Committed in:** 8f20fa3 (Task 2 — no code change from this)

---

**Total deviations:** 3 auto-fixed (1 cross-cutting test-harness consequence of the new pre-validation, 1 required renderer plumbing for the D-14 flag + error-card correctness, 1 build-verify command mismatch). No scope creep — production behavior matches the plan's intent.

## Issues Encountered
None beyond the deviations above.

## Known Stubs
None. The two Wave 0 smoke scaffolds (`alt-screen-reset`, `header-controls`) remain `describe.skip` and are owned by Plan 06-04, not this plan.

## Threat Flags
None — no new trust-boundary surface beyond the plan's `<threat_model>`. The cwd-bearing notice (T-06-06) is sanitized of control chars in main (WR-04, `sanitizeNotice`); the folder-picker'd path (T-06-08) still flows through CR-01 `isValidCwd` on save and the create() pre-validate before any spawn; no new bridge key (`pickDirectory` was added in Plan 01).

## Self-Check: PASSED

All modified files verified present on disk; both task commits (`477db49`, `8f20fa3`) verified in git history; full Vitest unit suite GREEN (181/181); `npx tsc --noEmit` clean; `npm run package` succeeds; eslint clean on all touched files.

---
*Phase: 06-robustness-flow-control-polish*
*Completed: 2026-06-07*
