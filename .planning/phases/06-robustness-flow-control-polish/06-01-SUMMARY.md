---
phase: 06-robustness-flow-control-polish
plan: 01
subsystem: infra
tags: [agent-state, contextbridge, ipc, readiness-probe, electron, vitest, tdd]

# Dependency graph
requires:
  - phase: 04-keyboard-identity-switching
    provides: matchSwitchKey + before-input-event interceptor + onSwitchSession bridge key (the Clear chord reuses both)
  - phase: 05.1-term-05-startup-command-auto-run
    provides: readiness-probe.ts seam + create() probe hook (WR-02/WR-03 fixes land here)
  - phase: 05-persistence
    provides: 18-key contextBridge lockstep + EXPECTED_API_KEYS guard (extended to 19 here)
provides:
  - "Pure agent-state classifier (shared/agent-state.ts): AgentState type, IDLE_MS=800, anchored ReDoS-safe PROMPT_RE, lastNonEmptyLine, classifyIdle"
  - "matchClearKey (main/switch-keys.ts) + {kind:'clear'} SwitchIntent variant riding the existing session:switch channel"
  - "dialog:pick-directory main handler + pickDirectory bridge key (19-key surface)"
  - "WR-02/WR-03 readiness-probe fixes (produced-line matcher + 8 KB bounded scan), IN-02 comment, IN-03 smoke anchor"
  - "3 Wave 0 RED scaffolds (pty-spawn-error / alt-screen-reset / header-controls) defining contracts for Plans 02/04"
  - "TerminalPane.tsx deleted (dead-code removal, D-16)"
affects: [06-02-spawn-errors, 06-03-agent-state-detector, 06-04-renderer-controls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure presentation-overlay module (agent-state) mirroring flow-control.ts purity convention — never a 6th SessionStatus (D-06)"
    - "Clear chord rides the EXISTING session:switch channel (no new bridge key) — only pickDirectory widens the surface"
    - "Wave 0 RED scaffolds as describe.todo (Vitest) / describe.skip (WDIO) that import their target so the module graph resolves without failing the suite"

key-files:
  created:
    - src/shared/agent-state.ts
    - src/shared/__tests__/agent-state.test.ts
    - src/main/__tests__/pty-spawn-error.test.ts
    - tests/smoke/alt-screen-reset.smoke.test.ts
    - tests/smoke/header-controls.smoke.test.ts
  modified:
    - src/main/switch-keys.ts
    - src/main/__tests__/switch-keys.test.ts
    - src/main/index.ts
    - src/main/readiness-probe.ts
    - src/main/__tests__/readiness-probe.test.ts
    - src/shared/api-types.ts
    - src/preload/index.ts
    - src/main/window-config.ts
    - tests/smoke/pty-throughput.smoke.test.ts
    - tests/smoke/startup-command.smoke.test.ts
  deleted:
    - src/renderer/TerminalPane.tsx

key-decisions:
  - "agent-state IDLE_MS=800 (D-08); PROMPT_RE is conservative + anchored (\\s*$): trailing ?, [y/n] variants, (y/n)/(yes/no), ❯ — naked $/% and trailing ':' are OUT of set (free, not waiting); ReDoS-safe per V7/T-06-03"
  - "The Clear chord ({kind:'clear'}) reuses the existing session:switch channel + onSwitchSession key — Cmd+K (mac) / Ctrl+Shift+K (win) only; plain Ctrl+K → null to preserve readline kill-line (D-13). pickDirectory is the ONLY new bridge key this phase (→19)"
  - "WR-02 fix: readiness matcher fires only when the nonce appears AFTER a newline boundary (a produced line), never the bare echo line. WR-03: matches() bounds the scan to the last 8 KB tail"

patterns-established:
  - "Presentation overlay vs process status: agent-state classification is layered in the renderer over the 5 SessionStatus values, never persisted"
  - "Interface-first foundation wave: pure module + bridge key + RED scaffolds freeze contracts the slice plans (02/03/04) build against"

requirements-completed: [TERM-09, TERM-12]

# Metrics
duration: ~12min
completed: 2026-06-07
---

# Phase 6 Plan 01: Foundation Summary

**Froze the Phase-6 contracts: a pure ReDoS-safe agent-state classifier, the Clear-chord matcher riding the existing session:switch channel, the 19-key pickDirectory bridge lockstep, the WR-02/WR-03 readiness-probe fixes, three Wave 0 RED scaffolds, and deletion of dead TerminalPane.tsx.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-07T11:43:00Z
- **Completed:** 2026-06-07T11:51:00Z
- **Tasks:** 3
- **Files modified:** 16 (5 created, 10 modified, 1 deleted)

## Accomplishments
- Pure `shared/agent-state.ts` classifier (TERM-09): `classifyIdle` returns `'waiting'` only when the last non-empty produced line matches the conservative anchored `PROMPT_RE`; naked shell prompts and mid-sentence `?` correctly classify as `'free'`. Purity-clean (no electron/react/xterm/node-pty import), ReDoS-safe (V7/T-06-03).
- `matchClearKey` + `{kind:'clear'}` SwitchIntent variant wired into `before-input-event` on the existing `session:switch` channel (no new bridge key); the `dialog:pick-directory` main handler returns only a string path (V12/T-06-01).
- Atomic 4-file bridge lockstep adds the single new `pickDirectory` key (EXPECTED_API_KEYS → 19); `security.guard.test.ts` GREEN automatically.
- Folded 05.1 review fixes: WR-02 (matcher no longer trips on the shell echo line), WR-03 (8 KB bounded scan), IN-02 (Phase-8 per-shell comment), IN-03 (smoke anchored on the full `— restarted ` separator).
- Three Wave 0 RED scaffolds resolve cleanly (todo/skip, no import errors); `TerminalPane.tsx` deleted with a clean `tsc` + `electron-forge package` build.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure agent-state classifier + Wave 0 RED scaffolds + SC1 throughput** - `72b379c` (feat)
2. **Task 2: Clear-chord matcher + pickDirectory handler + Clear-chord interception + probe fixes** - `72b45ca` (feat)
3. **Task 3: Atomic bridge lockstep (pickDirectory, 19 keys) + delete dead TerminalPane.tsx** - `c8be416` (feat)

_Tasks 1 and 2 were `tdd="true"`: the test was written/extended and run RED→GREEN within the single task commit (MVP RED-first, no separate RED-commit gate since TDD_MODE=false)._

## Files Created/Modified
- `src/shared/agent-state.ts` - Pure agent-state classifier (presentation overlay, D-06)
- `src/shared/__tests__/agent-state.test.ts` - Classifier coverage + false-positive guards
- `src/main/__tests__/pty-spawn-error.test.ts` - Wave 0 RED scaffold (SC2, Plan 06-02)
- `tests/smoke/alt-screen-reset.smoke.test.ts` - Wave 0 RED scaffold (SC3, Plan 06-04)
- `tests/smoke/header-controls.smoke.test.ts` - Wave 0 RED scaffold (SC5, Plan 06-04)
- `src/main/switch-keys.ts` - {kind:'clear'} variant + matchClearKey
- `src/main/__tests__/switch-keys.test.ts` - matchClearKey cases
- `src/main/index.ts` - dialog:pick-directory handler + Clear-chord interception
- `src/main/readiness-probe.ts` - WR-02 produced-line matcher + WR-03 8 KB bound + IN-02 comment
- `src/main/__tests__/readiness-probe.test.ts` - WR-02/WR-03 cases + updated Group-2 fixture
- `src/shared/api-types.ts` / `src/preload/index.ts` / `src/main/window-config.ts` - pickDirectory lockstep (→19)
- `tests/smoke/pty-throughput.smoke.test.ts` - SC1 extended to ~100MB + post-burst responsiveness
- `tests/smoke/startup-command.smoke.test.ts` - IN-03 full-separator anchor
- `src/renderer/TerminalPane.tsx` - DELETED (dead-code, D-16)

## Decisions Made
- `IDLE_MS = 800` (D-08, Claude's discretion). `PROMPT_RE` anchored with `\s*$`; trailing `:` is OUT of set — `classifyIdle("Proceed (yes/no): ")` returns `'free'` (documented in the test), while `"Proceed (yes/no)"` at line end returns `'waiting'`.
- The Clear chord reuses the existing `session:switch` channel + `onSwitchSession` subscription, so `pickDirectory` is the only new bridge key this phase (19 keys total).
- WR-02 matcher semantics changed (nonce must follow a newline boundary) required updating one Plan-05.1 Group-2 fixture to fire a realistic produced-line round-trip (`: <nonce>\r\n<nonce>\nprompt`) — see Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the Plan-05.1 Group-2 probe fixture to match the WR-02 semantics**
- **Found during:** Task 2 (readiness-probe WR-02 fix)
- **Issue:** The WR-02 fix made `matches()` fire only when the nonce appears AFTER a newline boundary (a produced line, not the echo line). The existing GREEN test `'on marker match, injects ...'` fed `${nonce}\nuser@host% ` where the nonce is on the FIRST line (no preceding `\n`), so it began returning false and the injection no longer fired.
- **Fix:** Updated that single fixture to fire a realistic round-trip `: ${nonce}\r\n${nonce}\nuser@host% ` (marker echo line + the nonce re-emitted on a fresh produced line), which is exactly what WR-02 is designed to detect. No production-code change beyond the intended WR-02 fix.
- **Files modified:** src/main/__tests__/readiness-probe.test.ts
- **Verification:** `vitest run src/main/__tests__/readiness-probe.test.ts` GREEN (all Group-1 + Group-2 cases)
- **Committed in:** 72b45ca (Task 2 commit)

**2. [Rule 1 - Bug] agent-state test fixture corrected to express the intended last-line shape**
- **Found during:** Task 1 (agent-state classifier)
- **Issue:** The behavior block's illustrative `lastNonEmptyLine("...\x1b[32mok\x1b[0m\n\n") === "ok"` had `...` and `ok` on the SAME line, so the function (correctly) returned `"...ok"`.
- **Fix:** Wrote the fixture as `"earlier output\n\x1b[32mok\x1b[0m\n\n"` so `ok` is genuinely the last produced line — the documented intent.
- **Files modified:** src/shared/__tests__/agent-state.test.ts
- **Verification:** `vitest run src/shared/__tests__/agent-state.test.ts` GREEN
- **Committed in:** 72b379c (Task 1 commit)

**3. [Rule 3 - Blocking] Used `tsc --noEmit` + `electron-forge package` for the "npm run build" verify**
- **Found during:** Task 3 (TerminalPane deletion build verification)
- **Issue:** The plan's verify command was `npm run build`, but the project has no `build` script (only `package`/`make` via electron-forge).
- **Fix:** Verified the deletion did not break the bundle via `tsc --noEmit` (exit 0, no broken imports) AND `npm run package` (vite main/preload/renderer bundles + arm64 packaging all succeeded).
- **Files modified:** none (verification only)
- **Verification:** both commands exit 0
- **Committed in:** c8be416 (Task 3 commit — no code change from this)

---

**Total deviations:** 3 auto-fixed (2 test-fixture bugs from illustrative-fixture transcription, 1 blocking verify-command mismatch)
**Impact on plan:** All necessary for correctness/verification. No scope creep — production code matches the plan's intent exactly; only test fixtures and the build-verify command were adjusted.

## Issues Encountered
None beyond the deviations above.

## Known Stubs
The three Wave 0 RED scaffolds are intentional stubs that resolve cleanly without asserting yet:
- `src/main/__tests__/pty-spawn-error.test.ts` (`describe.todo`) — filled GREEN by **Plan 06-02** (SC2 cwd pre-validation / D-02 no-silent-home).
- `tests/smoke/alt-screen-reset.smoke.test.ts` (`describe.skip`) — filled GREEN by **Plan 06-04** (SC3 alt-screen reset on restart).
- `tests/smoke/header-controls.smoke.test.ts` (`describe.skip`) — filled GREEN by **Plan 06-04** (SC5 header Clear/Restart + Clear chord).

Each scaffold names its target behavior + filling plan in a header comment, per the Wave 0 contract. These are deliberate (Wave 0 RED-first), not unresolved gaps.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Contracts frozen for the three vertical slices: `agent-state.ts` (Plan 06-03 detector), `pickDirectory` bridge key (Plan 06-04 cwd folder-picker UI), `{kind:'clear'}` intent (Plan 06-04 Clear control + chord).
- `npm test` (Vitest, 171 tests) GREEN; the WDIO smoke scaffolds stay as skip stubs until 02/04.
- No blockers.

## Self-Check: PASSED

All created files verified present on disk (agent-state.ts + test, 3 RED scaffolds, SUMMARY.md), TerminalPane.tsx confirmed deleted, and all three task commits (`72b379c`, `72b45ca`, `c8be416`) verified in git history.

---
*Phase: 06-robustness-flow-control-polish*
*Completed: 2026-06-07*
