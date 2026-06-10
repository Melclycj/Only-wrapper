---
phase: 03-multi-session-session-lifecycle
plan: 01
subsystem: pty-lifecycle
tags: [node-pty, electron-ipc, contextbridge, session-lifecycle, status-machine, tdd, vitest, wdio]

# Dependency graph
requires:
  - phase: 02-pty-terminal-foundation
    provides: "PtyManager (single-PTY create/write/resize/pause/resume + idempotent registerIpc), the 8-key contextBridge surface + EXPECTED_API_KEYS guard, SessionRecord/SessionStatus/LogicalId shared types, the WDIO xterm-driver single-pane helpers"
provides:
  - "deriveStatus({exitCode,userStopped}) pure helper — stopped/exited/error, never branches on signal"
  - "PtyManager per-session status machine: status tracking, platform-aware graceful stop, identity-preserving restart, settle-delay startup-command injection, pty:status emission, listSessions(), os.homedir() cwd default in MAIN"
  - "12-key typed contextBridge CONTRACT (ptyStop/ptyRestart/onPtyStatus/listSessions added to api-types.ts + EXPECTED_API_KEYS) + PtyStatusPayload type"
  - "New IPC channels pty:status/pty:stop/pty:restart/pty:list registered idempotently with symmetric teardown"
  - "Wave 0 RED scaffolds: pty-status.test.ts, pty-lifecycle.test.ts, multi-session-keepalive + startup-command E2E, N-pane xterm-driver helpers"
affects: [03-02-renderer-multi-session, 03-03-lifecycle-controls, 05-persistence]

# Tech tracking
tech-stack:
  added: []  # no new packages — RESEARCH §Package Legitimacy Audit confirmed deps unchanged from Phases 1-2
  patterns:
    - "Pure status-derivation helper (deriveStatus) decoupled from node-pty for unit testability"
    - "Per-session record kept on the PtySession (alive flag) so stop/exit retain a restartable row"
    - "Platform-branched kill: POSIX SIGTERM->grace->SIGKILL, win32 bare kill() (ConPTY has no signals)"
    - "Settle-delay startup-command injection keyed off first output quiet"
    - "Restart orchestrated in main (stop -> await exit -> create-with-id) to keep one live pty per id"
    - "Interface-first ordering: bridge contract + EXPECTED_API_KEYS widened before any consumer wires it"

key-files:
  created:
    - src/main/__tests__/pty-status.test.ts
    - src/main/__tests__/pty-lifecycle.test.ts
    - tests/smoke/multi-session-keepalive.smoke.test.ts
    - tests/smoke/startup-command.smoke.test.ts
  modified:
    - src/main/pty-manager.ts
    - src/shared/api-types.ts
    - src/main/window-config.ts
    - src/preload/index.ts
    - tests/smoke/helpers/xterm-driver.ts

key-decisions:
  - "listSessions() source of truth lives in MAIN (RESEARCH Open Q2) — Phase 5 lowdb persistence is a drop-in"
  - "Restart orchestrated as one bridge call in main (RESEARCH Open Q1 recommendation), returning the new {id,pid}"
  - "Dead sessions are KEPT in the sessions Map with an `alive:false` flag (record retained, pty handle logically dropped) rather than moved to a separate record store — single source, simplest invariant"
  - "Preload temporarily annotated Omit<ElectronAPI, 4 new keys> to keep tsc green WITHOUT wiring (or fake-stubbing) the new methods — preload wiring is explicitly 03-02 Task 1 scope"

patterns-established:
  - "Pattern 3 (deriveStatus): never branch status on signal (undefined on Windows/clean exit)"
  - "Pattern 4 (platform-aware stop): SIGTERM->STOP_GRACE_MS->SIGKILL on POSIX; bare kill() on win32"
  - "Pattern 5 (pty:status broadcast): setStatus() updates record + sends pty:status, mirroring onData send-target"
  - "Pattern 6 (startup injection): settle-delay off first output, write cmd+CR once, never log the text"

requirements-completed: [TERM-06, TERM-07, TERM-08]  # TERM-05 descoped at verify (deferred)

# Metrics
duration: 56min
completed: 2026-06-04
---

# Phase 3 Plan 01: Multi-Session Lifecycle Producer Foundation Summary

**Extended the main-process PtyManager from a single PTY into a per-session 5-state status machine with platform-aware graceful stop, identity-preserving restart, settle-delay startup-command injection, and a `pty:status` broadcast — plus the 12-key typed contextBridge contract and all Wave 0 RED test scaffolds the later renderer/controls waves turn green.**

## Performance

- **Duration:** 56 min
- **Started:** 2026-06-04T10:45:04Z
- **Completed:** 2026-06-04T11:40:52Z
- **Tasks:** 3/3 completed
- **Files modified/created:** 9 (4 created, 5 modified)

## Accomplishments

### Task 1 — Wave 0 RED scaffolds (commit `23525a7`)
- `pty-status.test.ts`: 6 pure-helper tests asserting `deriveStatus` maps stopped/exited/error (incl. non-zero exitCodes 1 and 137) and never reads `signal`.
- `pty-lifecycle.test.ts`: 8 tests with `vi.useFakeTimers()` + a controllable fake IPty — SIGTERM-then-SIGKILL-after-grace on POSIX, timer cleared when `onExit` fires first, bare `kill()` on win32 (via `process.platform` stub), restart keeps logicalId / changes pid, `create()` with no/empty cwd spawns in `os.homedir()`, and stop+exit retains the record in `listSessions()` as `'stopped'`.
- `multi-session-keepalive.smoke.test.ts`: WDIO E2E (SC1/SC2) opening 3 sessions, running a background TICK loop in A, switching away and back, asserting the TICK count advanced (keep-alive) with a current buffer.
- `startup-command.smoke.test.ts`: WDIO E2E (SC5) driving the **named seam** verbatim — `window.api.ptyCreate({ shell, cwd: undefined, startupCommand: 'echo STARTUP_OK' })` directly from the browser context (no form UI — Phase 4 scope), asserting both `STARTUP_OK` output and the echoed `echo STARTUP_OK` command text appear.
- `xterm-driver.ts`: added N-pane helpers `sendKeysTo`, `readBufferOf`, `waitForTextIn`, `clickAddSession`, `clickSidebarRow` keyed off the `data-session-id` / `data-testid="add-session"` DOM 03-02 will produce, keeping the original single-pane helpers intact.

### Task 2 — Typed bridge contract widened to 12 keys (commit `a6679ca`)
- `api-types.ts`: `PtyCreateOptions` gains `id?`/`startupCommand?`; added `PtyStatusPayload`; `ElectronAPI` gains `ptyStop`/`ptyRestart`/`onPtyStatus`/`listSessions` (JSDoc'd, type-only imports, electron-free — `grep "from 'electron'"` = 0).
- `window-config.ts`: `EXPECTED_API_KEYS` extended to the 12-key Phase-3 surface with reviewed-tripwire JSDoc.

### Task 3 — PtyManager lifecycle machine (commit `383268b`)
- Exported `deriveStatus`; promoted `PtySession` to carry `{ pty, alive, status, startupCommand?, killTimer?, userStopped, record }`.
- `create()`: `id = opts.id ?? newLogicalId()` (IDENT-02 restart reuse); resolves `cwd` to `os.homedir()` in MAIN when undefined/empty; emits `pty:status running`; builds/keeps a `SessionRecord`; `onExit` clears the grace timer, derives status, and KEEPS the record (drops only the live handle).
- `stop()` (platform-branched), `restart()` (stop→await exit→create-with-id, same logicalId / new ptyPid), `scheduleStartupCommand()` (settle-delay, logs "injected" not the text), `listSessions()`.
- New channels `pty:status/stop/restart/list` registered inside the `ipcRegistered` guard with symmetric teardown; `disposeAll()` clears in-flight kill timers; `write/resize/pause/resume` now ignore dead sessions.

## Final bridge contract (the 12 keys) — for the next wave to consume

`EXPECTED_API_KEYS` (window-config.ts) and `ElectronAPI` (api-types.ts) now define exactly:

```
getVersion, ptyCreate, ptyWrite, ptyResize, ptyPause, ptyResume, onPtyData, onPtyExit,
ptyStop, ptyRestart, onPtyStatus, listSessions
```

New method signatures:
- `ptyStop: (id: LogicalId) => void` — fire-and-forget (`pty:stop`)
- `ptyRestart: (id: LogicalId) => Promise<PtyCreateResult>` — request-response (`pty:restart`)
- `onPtyStatus: (id: LogicalId, cb: (p: PtyStatusPayload) => void) => () => void` — id-filtered, returns unsubscribe (`pty:status`)
- `listSessions: () => Promise<SessionRecord[]>` — request-response (`pty:list`)
- `PtyStatusPayload = { id; status; ptyPid?; exitCode? }`
- `PtyCreateOptions` extended with `id?`, `startupCommand?` (renderer passes `cwd: undefined` for the home default).

The main-process producers for all four channels are wired and idempotent. **03-02 Task 1 must wire the 4 preload runtime implementations** (mirroring `onPtyData`/`ptyPause`/`ptyCreate`) — at which point `security.guard.test.ts` goes GREEN (it asserts the exposed surface equals the 12-key set).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preload type annotation relaxed to keep tsc green without wiring the preload**
- **Found during:** Task 2 (verify step `npx tsc --noEmit`).
- **Issue:** Extending `ElectronAPI` with 4 new required methods made `src/preload/index.ts` (`const api: ElectronAPI`) fail `tsc` — the object now lacks `ptyStop`/`ptyRestart`/`onPtyStatus`/`listSessions`. The plan forbids wiring the preload in 03-01 (it is explicitly 03-02 Task 1), so I could not add real implementations, and fake stubs would have prematurely turned the security guard GREEN and exposed unimplemented methods.
- **Fix:** Annotated the preload object as `Omit<ElectronAPI, 'ptyStop' | 'ptyRestart' | 'onPtyStatus' | 'listSessions'>` with a comment pointing to 03-02 Task 1 for restoration. tsc stays clean; the preload exposes only the Phase-2 subset; `security.guard.test.ts` is correctly RED until 03-02.
- **Files modified:** src/preload/index.ts
- **Commit:** `a6679ca`

**2. [Rule 2 - Critical functionality] Liveness guard on write/resize/pause/resume**
- **Found during:** Task 3.
- **Issue:** Because stopped/exited sessions are now RETAINED in the `sessions` Map (record kept for restart), the existing `write/resize/pause/resume` would have operated on a dead PTY handle.
- **Fix:** Added an `alive` flag check to those four methods so dead sessions are ignored (consistent with the existing unknown-id guard).
- **Files modified:** src/main/pty-manager.ts
- **Commit:** `383268b`

## Intentional RED state (expected, not a failure)

- `src/shared/__tests__/security.guard.test.ts` — the EXPECTED_API_KEYS exact-surface assertion is RED (12 expected vs 8 exposed). This is by design: 03-01 widens the contract + guard; 03-02 Task 1 wires the preload runtime and turns it GREEN. Confirmed by 03-02-PLAN.md Task 1 ("guard goes GREEN").
- The two new E2E smoke scaffolds (`multi-session-keepalive`, `startup-command`) reference DOM (`data-session-id`) that 03-02 produces — RED until the renderer wave lands. The two new unit files (`pty-status`, `pty-lifecycle`) are GREEN.

## Known Stubs

None. The E2E scaffolds are intentional Wave 0 RED tests (not product stubs); the producer-side implementation is complete and unit-proven.

## Verification

- `npm run test:unit` → 42 passed / 1 failed. The single failure is the intended-RED `security.guard.test.ts` surface assertion (above). Target files GREEN: `pty-status.test.ts`, `pty-lifecycle.test.ts`, `ipc-registration.test.ts`, `pty-validation.test.ts`.
- `npx tsc --noEmit` → 0 errors.
- `npm run lint` → 0 errors.
- Acceptance greps: signal-branch guard = 0; `homedir` present; `process.platform` branch present; 4 new keys in EXPECTED_API_KEYS; api-types electron-free.

## Self-Check: PASSED

- FOUND: src/main/__tests__/pty-status.test.ts
- FOUND: src/main/__tests__/pty-lifecycle.test.ts
- FOUND: tests/smoke/multi-session-keepalive.smoke.test.ts
- FOUND: tests/smoke/startup-command.smoke.test.ts
- Commits FOUND: `23525a7`, `a6679ca`, `383268b`
