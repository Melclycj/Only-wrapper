---
phase: 02-pty-core-terminal-fidelity
plan: 02
subsystem: pty
tags: [node-pty, electron, ipc, contextBridge, flow-control, login-shell, security]

# Dependency graph
requires:
  - phase: 02-01
    provides: pinned node-pty 1.1.0 (N-API prebuild) + @xterm 5.x stack; Wave 0 RED stubs (shell-resolver, flow-control); resolveShell signature stub
provides:
  - resolveShell() real implementation (login shell $SHELL -l, /bin/zsh fallback)
  - createWatermark() flow-control accounting (HIGH/LOW backpressure)
  - PtyManager — node-pty keyed by LogicalId; create/write/resize/pause/resume/kill/disposeAll/registerIpc with validated, clamped IPC
  - ElectronAPI extended with 7 PTY methods + payload types
  - EXPECTED_API_KEYS expanded to the PTY surface (reviewed Phase-2 expansion)
  - preload exposes the 7 PTY methods (id-filtered onPtyData/onPtyExit + unsubscribe)
  - index.ts wires PtyManager IPC + orphan-safe lifecycle cleanup
affects: [02-03 renderer TerminalPane, 02-04 E2E smoke, phase-03 multi-session]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PtyManager owns node-pty keyed by LogicalId; ptyPid stored separately (IDENT-02)"
    - "Validate-at-the-boundary: every IPC arg validated/clamped in main before reaching native PTY"
    - "Watermark backpressure accounting kept electron/node-pty-free for unit testing"
    - "PTY bytes forwarded as raw UTF-8 strings (no binary re-encode) to preserve CJK/emoji"
    - "Reviewed EXPECTED_API_KEYS expansion — guard still asserts exact surface"

key-files:
  created:
    - src/main/flow-control.ts
    - src/main/pty-manager.ts
    - src/main/__tests__/pty-validation.test.ts
  modified:
    - src/main/shell-resolver.ts
    - src/shared/api-types.ts
    - src/main/window-config.ts
    - src/main/index.ts
    - src/preload/index.ts
    - src/main/__tests__/flow-control.test.ts
    - src/main/__tests__/shell-resolver.test.ts

key-decisions:
  - "Spawn $SHELL with login flag -l only — interactive comes free from the PTY TTY (no -i, avoids double-sourcing)"
  - "clampDimension bounds cols/rows to 1-1000 (NaN/0/negative → 1) as a resize-bomb DoS guard"
  - "PTY output never logged (secrets/keystrokes); only lifecycle events (spawn pid, exit code)"
  - "Expanded the preload surface alongside EXPECTED_API_KEYS so the security guard stays GREEN and meaningful now (renderer consumes it in 02-03)"

patterns-established:
  - "Pattern: main-side IPC validation (unknown-id ignore, dimension clamp, string type-guard) before any native call"
  - "Pattern: LogicalId map key vs ptyPid number — never cross-assigned (IDENT-02)"
  - "Pattern: pure, framework-free accounting/resolver modules co-located in src/main but Vitest-importable"

requirements-completed: [TERM-01, TERM-02, TERM-03, TERM-04]

# Metrics
duration: ~13min
completed: 2026-06-04
---

# Phase 2 Plan 02: PTY Main-Process Producer Summary

**Login-shell PtyManager that spawns a LogicalId-keyed node-pty with native PATH (`$SHELL -l`, TERM=xterm-256color/COLORTERM=truecolor, inherited env, cwd=home), validated+clamped IPC handlers (unknown-id ignore, 1-1000 dimension clamp, string type-guard), raw-UTF-8 streaming, and orphan-safe lifecycle cleanup — plus the extended typed bridge contract and EXPECTED_API_KEYS guard expansion.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-06-04T16:03:00Z
- **Completed:** 2026-06-04T16:10:00Z
- **Tasks:** 3
- **Files modified:** 11 (3 created, 8 modified)

## Accomplishments
- Turned the two Wave 0 RED unit tests GREEN: `resolveShell()` (login shell, /bin/zsh fallback, args `['-l']`) and `createWatermark()` (add/drain/shouldPause/shouldResume, total clamps at 0).
- Built `PtyManager` owning a `node-pty` child keyed by `LogicalId`, with `ptyPid` stored separately (IDENT-02), `TERM`/`COLORTERM` env override over full `process.env`, cwd=home, and raw-UTF-8 passthrough streaming (no re-encode — SC4).
- Hardened every IPC entrypoint in main: `clampDimension` (1-1000, NaN/0/neg → 1), unknown-id rejection, and a string type-guard on write — covered by `pty-validation.test.ts` (9 cases).
- Extended the typed bridge (`ElectronAPI` + 4 payload types), expanded `EXPECTED_API_KEYS` to the 7 PTY methods, exposed them in the real preload (id-filtered `onPtyData`/`onPtyExit` with unsubscribe), and wired `PtyManager.registerIpc` + `disposeAll()` on window `closed` and app `before-quit`.

## Task Commits

Each task was committed atomically:

1. **Task 1: resolveShell + flow-control watermark** - `1b3092f` (feat)
2. **Task 2: PtyManager with validated, clamped IPC handlers** - `0a02b38` (feat)
3. **Task 3: extend bridge contract + EXPECTED_API_KEYS, wire lifecycle** - `3dc9223` (feat)

_Note: Task 1 and Task 2 are TDD tasks; the RED test commit pre-existed from Wave 0 (02-01, `b36a81f`), so this plan's commits are the GREEN implementations._

## Files Created/Modified
- `src/main/flow-control.ts` (created) - `createWatermark(high, low)` byte accounting; electron/node-pty-free.
- `src/main/pty-manager.ts` (created) - `class PtyManager` + `clampDimension`/`isStringData` pure validators; node-pty in main only.
- `src/main/__tests__/pty-validation.test.ts` (created) - clamp + type-guard unit coverage.
- `src/main/shell-resolver.ts` (modified) - real `resolveShell()` (was a throwing stub).
- `src/shared/api-types.ts` (modified) - `ElectronAPI` + PtyCreate/Data/Exit payload types (LogicalId type-only import).
- `src/main/window-config.ts` (modified) - `EXPECTED_API_KEYS` expanded to 8 keys (reviewed Phase-2 expansion).
- `src/main/index.ts` (modified) - PtyManager instantiation, `registerIpc(win)`, `disposeAll()` on `closed` + `before-quit`.
- `src/preload/index.ts` (modified) - exposes the 7 PTY methods; id-filtered subscriptions with unsubscribe.
- `src/main/__tests__/flow-control.test.ts` / `shell-resolver.test.ts` (modified) - de-bannered; fixed inconsistent intermediate assertion (see Deviations).

## Decisions Made
- **Login flag only (`-l`, no `-i`):** the PTY's real TTY already makes the shell interactive, so `.zshrc` sources automatically; adding `-i` risks double-sourcing and job-control noise (RESEARCH Pattern 3).
- **Per-session watermark created in PtyManager** at the canonical HIGH=100000/LOW=10000 defaults; the renderer drives the ack in 02-03.
- **Preload surface expanded now (not deferred to 02-03):** the `security.guard.test.ts` imports the REAL preload and asserts it equals `EXPECTED_API_KEYS`. Expanding the keys without exposing them would have broken the guard immediately, so the preload methods were added here to keep the guard GREEN and meaningful. (Blocking-issue fix — see Deviations Rule 3.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed internally-inconsistent assertion in flow-control.test.ts**
- **Found during:** Task 1 (watermark implementation)
- **Issue:** The Wave 0 RED test's RESUME case did `add(HIGH+1)` then `drain(HIGH)`, leaving total=1, then asserted `shouldResume()` === false. With the plan-specified contract (`shouldResume() === total < low`), total=1 is below LOW=10000, so the assertion was impossible to satisfy — the test comment ("total now LOW+1") did not match its own arithmetic.
- **Fix:** Changed the intermediate drain to `drain(HIGH - LOW)`, which leaves total = LOW+1 (still at/above LOW → not yet resumable), matching the test's stated intent and the plan's documented contract.
- **Files modified:** src/main/__tests__/flow-control.test.ts
- **Verification:** `npx vitest run` — flow-control.test.ts GREEN (4 cases).
- **Committed in:** 1b3092f (Task 1 commit)

**2. [Rule 3 - Blocking] Exposed the 7 PTY methods in the real preload**
- **Found during:** Task 3 (EXPECTED_API_KEYS expansion)
- **Issue:** The plan listed only api-types.ts, window-config.ts, index.ts for Task 3, but `security.guard.test.ts` asserts the live preload surface equals `EXPECTED_API_KEYS`. Expanding the keys alone would have broken the guard test until 02-03.
- **Fix:** Added the 7 PTY methods to `src/preload/index.ts` (id-filtered `onPtyData`/`onPtyExit` returning unsubscribe fns; raw `ipcRenderer` never exposed), matching the new contract.
- **Files modified:** src/preload/index.ts
- **Verification:** `npx vitest run src/shared/__tests__/security.guard.test.ts` — GREEN; `npx tsc --noEmit` clean.
- **Committed in:** 3dc9223 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both necessary for a GREEN, type-checked, security-guarded build. No scope creep — the preload addition is exactly the surface the contract already declares.

## Issues Encountered
- The plan's verify grep `/base64|Buffer\.from\(data/` initially tripped on the word "base64" inside an explanatory NEGATION comment in pty-manager.ts. Reworded the comment to "no binary re-encoding" — no behavior change; the no-re-encode guarantee is intact.

## Known Stubs
- `src/main/shell-resolver.ts` — the Windows shell mapping (powershell.exe / wsl.exe) is intentionally deferred to Phase 8 per CLAUDE.md/D-01. The current `$SHELL`/`/bin/zsh` fallback is platform-neutral and correct for the macOS-first target; this is a documented, planned deferral, not a blocking stub.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Main process can now spawn, stream, resize, pause/resume, and cleanly kill a real login PTY with native PATH. The typed bridge + preload expose the full PTY surface.
- 02-03 (renderer): mount an `@xterm/xterm` TerminalPane, call `window.api.ptyCreate` on mount (auto-start single session, D-02), wire `term.onData → ptyWrite` and `onPtyData → term.write(chunk, ack)` watermark backpressure, and `fitAddon` → `ptyResize`.
- No blockers. node-pty loads via its N-API prebuild under both Vitest and Electron 36 (confirmed by the green pty-validation suite importing node-pty).

## Self-Check: PASSED

All 8 created/modified source files exist on disk; all 3 task commits (1b3092f, 0a02b38, 3dc9223) present in git history. Full unit suite: 24 passed (5 files). `npx tsc --noEmit` exits 0; `npm run lint` exits 0.

---
*Phase: 02-pty-core-terminal-fidelity*
*Completed: 2026-06-04*
