---
phase: 05-persistence-shell-discovery
plan: 02
subsystem: persistence

# Dependency graph
requires:
  - phase: 05-persistence-shell-discovery
    plan: 01
    provides: "store-schema.ts (coerceOnLoad, StoreSchema, SCHEMA_VERSION), window-bounds.ts (validateBounds, DEFAULT_BOUNDS), lowdb@7.0.1 external+packaged, session-store.test.ts RED contract, setOrder/setUiState validate-in-main setters"
  - phase: 03-multi-session
    provides: "PtyManager (sessions Map, create/close/restart/listSessions), main-as-source-of-truth listSessions reconcile path"
  - phase: 04-session-identity-sidebar
    provides: "updateProfile validate-in-main discipline, SessionRecord contract, before-input-event switch interception"
provides:
  - "SessionStore — lowdb Low<StoreSchema> via load-bearing await import('lowdb'); load/coerce, scheduleSave(debounce ~300ms)/flush(quit)/isDirty, corrupt + non-array-sessions backup recovery"
  - "PtyManager.hydrate(records) dormant-record map (Pattern 4 option b — no live pty), listSessions() live+dormant merge sorted by order, create({id}) dormant promotion, nextOrder() max+1 (Pitfall 6)"
  - "PtyManager store change-signal (setStoreSignal/signalStore) — every record/ui mutation debounce-writes (D-13)"
  - "index.ts persistence lifecycle: whenReady store.load → hydrate → setStoreSignal → createWindow(restore validated bounds); before-quit preventDefault+flush re-entrancy guard"
  - "persistence smoke (BUILT-app lowdb dynamic import + store round-trip — Pitfall 1)"
affects: [05-03 (Start ▶ dormant promotion UI + IdleCard/WelcomeEmptyState consume listSessions dormant rows), 05-04 (dnd-kit reorder → setOrder persists), 08 (Windows packaging keeps lowdb external + asar)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "lowdb-ESM-in-CJS via dynamic await import('lowdb') kept external (Pitfall 1) — lowdb/node adapter bundles self-contained (node:fs/path only), lowdb core resolves at runtime; proven in the BUILT app, NOT just Vitest"
    - "Separate dormant-record map (Pattern 4 option b) preserves the every-PtySession-has-a-live-pty invariant (Pitfall 4)"
    - "Debounce(~300ms) scheduleSave + before-quit preventDefault→flush→app.quit re-entrancy guard for durable trailing write (D-13, RESEARCH Pattern 3)"
    - "Store change-signal injected into PtyManager so domain mutations stay store-agnostic; index.ts owns the snapshot push (listSessions + getUiState)"

key-files:
  created:
    - src/main/session-store.ts
    - src/main/__tests__/pty-hydrate.test.ts
    - tests/smoke/persistence.smoke.test.ts
  modified:
    - src/main/pty-manager.ts
    - src/main/index.ts
    - src/main/__tests__/session-store.test.ts

key-decisions:
  - "lowdb/node adapter is bundled (self-contained node:fs/path chunk) while lowdb CORE stays a true external await import('lowdb') — verified in the built main.js; satisfies Pitfall 1 with no require('lowdb')"
  - "Dormant records reorder + close without ever starting (setOrder/close handle the dormant map too) so a restored session is fully manageable pre-Start (NAV-04)"
  - "Store path resolved via dynamic await import('electron') inside load() (not a static import + not require) — keeps the module Vitest-importable AND passes the no-require-imports lint rule (Pitfall 3)"
  - "before-quit flush gated on store.isDirty() + a module `quitting` flag — a clean (non-dirty) quit falls straight through to teardown, never stalls"

patterns-established:
  - "Inject a store change-signal callback into the domain owner (PtyManager) rather than coupling it to lowdb; the lifecycle layer (index.ts) owns the snapshot push"
  - "Smoke reads main-process state via process.getBuiltinModule (the packaged main bundle is ESM — `require` is undefined)"

requirements-completed: [PERS-01, PERS-02, NAV-04]

# Metrics
duration: 9min
completed: 2026-06-06
---

# Phase 5 Plan 02: Persistence Vertical Slice Summary

**The durable dormant-restore data layer: a lowdb-backed SessionStore (dynamic ESM import proven in the BUILT app — Pitfall 1), PtyManager hydrate/promote of restored records as a separate dormant map, and an index.ts lifecycle that loads→hydrates on boot and preventDefault-flushes on quit so a debounced write is never lost.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-06T06:01:31Z
- **Completed:** 2026-06-06T06:10:12Z
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- **SessionStore** owns a lowdb `Low<StoreSchema>` via the load-bearing `await import('lowdb')` (Pitfall 1): `load()` coerces every record dormant (D-01/SC2), backs up a corrupt OR non-array-sessions store to `.corrupt-<ts>` and starts fresh without ever throwing (D-13/T-05-04), and exposes `scheduleSave()` (debounce ~300ms) / `flush()` (quit) / `isDirty()` (D-13). 9 GREEN unit assertions replaced the RED stub from Plan 05-01.
- **PtyManager.hydrate** populates a SEPARATE `dormantRecords` map (Pattern 4 option b) so a restored record has NO live pty (Pitfall 4); `listSessions()` merges live + dormant sorted by `order`; `create({id})` promotes a dormant id (spawns under the SAME logicalId reusing the stored cwd/shell, drops it from dormant — the Start ▶ path); new-session order is `max(existing live+dormant)+1` (Pitfall 6, no longer `this.sessions.size`).
- **Store change-signal** wired through every record/ui mutation (create/onExit/close/updateProfile/setOrder/setUiState) so the lowdb store debounce-writes (D-13); `setOrder`/`close` also operate on dormant rows (a restored session is reorderable/discardable pre-Start — NAV-04).
- **index.ts lifecycle**: `whenReady` does `store.load() → ptyManager.hydrate(data.sessions) → setStoreSignal(syncStore) → createWindow()`; `createWindow` restores `validateBounds(saved, displays)` BEFORE the window shows (Pitfall 5) and persists bounds on move/resize through the debounce; `before-quit` runs the `preventDefault()`-then-`flush()`-then-`app.quit()` re-entrancy guard gated on `isDirty()` + a `quitting` flag (RESEARCH Pattern 3).
- **Persistence smoke** boots the BUILT app and asserts `just-wrapper-store.json` is created + parseable under `app.getPath('userData')` (proving the dynamic import resolved at runtime — Pitfall 1) and that a created session profile round-trips to disk (SC1/SC2). GREEN against `out/Just-Wrapper-darwin-arm64`.

## Task Commits

Each task committed atomically:

1. **Task 1: SessionStore (lowdb dynamic import, coerce-on-load, debounce/flush, corrupt recovery)** — `33e4483` (feat) — TDD: the RED `session-store.test.ts` stub from 05-01 went GREEN; test + implementation colocated in one feat commit (mirrors the 05-01 precedent).
2. **Task 2: PtyManager.hydrate + store-backed setters + index.ts lifecycle wiring** — `34b9f54` (feat)
3. **Task 3: Persistence smoke (restore round-trip + lowdb-ESM-in-built-app — Pitfall 1)** — `5d250a4` (test)

## Files Created/Modified
- `src/main/session-store.ts` (created) — SessionStore class: dynamic `import('lowdb')`+`import('lowdb/node')`, coerceOnLoad on read, corrupt/non-array backup recovery, debounce/flush/isDirty, `pathOverride` test seam, `data`/`setSessions`/`setUi`/`getUiState` accessors.
- `src/main/pty-manager.ts` (modified) — `dormantRecords` map, `hydrate()`, `setStoreSignal()`/`signalStore()`, `nextOrder()` (Pitfall 6), `getUiState()`; `listSessions()` merge+sort; `create()` dormant promotion + stored-cwd honoring; store signals on create/onExit/close/updateProfile/setOrder/setUiState; setOrder/close handle dormant rows.
- `src/main/index.ts` (modified) — module-scope `SessionStore` + `quitting` flag + `syncStore()`; whenReady load→hydrate→setStoreSignal→createWindow; validated-bounds restore + move/resize persistence; before-quit flush re-entrancy guard.
- `src/main/__tests__/session-store.test.ts` (modified) — RED stub → 9 real assertions (round-trip 8 fields, dormant coercion, empty/UI round-trip, corrupt + non-array recovery, debounce fake-timers, flush, no-op-when-clean).
- `src/main/__tests__/pty-hydrate.test.ts` (created) — 7 assertions (no-spawn hydrate, live+dormant merge/sort, promotion under same id with stored cwd/shell, max+1 order, store signals on create/setOrder/close, dormant reorder, dormant close).
- `tests/smoke/persistence.smoke.test.ts` (created) — 2 BUILT-app assertions (lowdb dynamic import resolves + store file parseable; created session profile persisted).

## Decisions Made
- **lowdb core stays external, `lowdb/node` is bundled.** Inspecting the built `main.js` confirmed `await import(\`lowdb\`)` survived as a real dynamic import while `await import('lowdb/node')` was Rollup-chunked into a self-contained module that requires only `node:fs`/`node:path`/`node:fs/promises` (no `require('lowdb')`). This is the correct Pitfall 1 outcome — the ESM lowdb core resolves at runtime, the adapter is inert-bundled.
- **Dormant records are first-class in setOrder/close.** A restored-not-yet-started session can be reordered (NAV-04) and discarded before it is ever started, so both setters operate on the dormant map as well as the live map — without spawning a pty.
- **Store-path resolution uses `await import('electron')`, not `require`.** The project's `@typescript-eslint/no-require-imports` rule forbids `require()`; a static `import { app }` would also break Vitest's Node-env import of the module. Dynamic `await import('electron')` (only on the no-override production path) satisfies both Pitfall 3 and the lint rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced `require('electron')` with `await import('electron')` in the store-path resolver**
- **Found during:** Task 1 (lint after first implementation)
- **Issue:** The initial `load()` resolved the store path via `require('electron')` inside a lazy IIFE. ESLint's `@typescript-eslint/no-require-imports` (a project hard rule) errored on it, blocking the task's clean-lint gate.
- **Fix:** Switched to `const { app } = await import('electron')` on the no-`pathOverride` production branch — keeps the path resolution lazy (Pitfall 3: never at module scope), keeps the module importable under Vitest (where a `pathOverride` is always supplied so the electron import never runs), and passes lint.
- **Files modified:** src/main/session-store.ts
- **Committed in:** 33e4483 (Task 1 commit)

**2. [Rule 1 - Bug] Smoke used `require('node:fs')` inside `browser.electron.execute` — `require is not defined` in the ESM main bundle**
- **Found during:** Task 3 (first smoke run failed RED with `ReferenceError: require is not defined`)
- **Issue:** The packaged main bundle is ESM, so `require` is undefined in the function serialized into `browser.electron.execute`. Both smoke assertions threw before reaching any expectation.
- **Fix:** Read Node built-ins via `process.getBuiltinModule('node:fs')` / `process.getBuiltinModule('node:path')` (available in Electron's Node ≥20) instead of `require`. Both assertions then passed against the built app.
- **Files modified:** tests/smoke/persistence.smoke.test.ts
- **Committed in:** 5d250a4 (Task 3 commit)

**3. [Rule 1 - Bug] Debounce unit test asserted on-disk file presence under fake timers — flaky against steno's async write**
- **Found during:** Task 1 (debounce test failed: `isDirty()` flipped false but the file was not yet on disk)
- **Issue:** `vi.advanceTimersByTimeAsync` fired the debounce timer and ran `flush()` (so `isDirty()` went false), but steno's underlying async `fs.writeFile`/`rename` had not settled on disk within the fake-timer tick, so `fs.existsSync(storeFile)` was still false — a timing race, not a logic bug.
- **Fix:** Re-pointed the debounce assertion at a `flush` spy (count = 1 after the burst window, 0 at the halfway mark) — which deterministically proves the ~300ms trailing-coalesce contract independent of steno's fs timing. On-disk correctness is covered by the (real-timer) round-trip/flush tests.
- **Files modified:** src/main/__tests__/session-store.test.ts
- **Committed in:** 33e4483 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking lint, 2 bugs). No architectural changes, no scope creep — all three were correctness/robustness fixes inside the planned files.
**Impact on plan:** None to scope. The smoke + unit suites are GREEN exactly as the plan's acceptance criteria specify.

## Issues Encountered
None outstanding. Full unit suite: **124 passed (22 files)**, up from 108 passed + 5 todo (the 5 SessionStore todos became real + a new hydrate test landed). `tsc --noEmit` and `eslint` clean on all touched files. Persistence smoke: 2 passing against the built app.

## Known Stubs
None — all persisted data is wired end-to-end (renderer add → ptyCreate → main create → store signal → debounced write → disk; boot load → hydrate → listSessions). No hardcoded empty values flow to UI.

The Start (▶) UI affordance to promote a dormant restored session and the empty/idle cards are **intentionally** Plan 05-03's scope (per this plan's objective) — the data round-trip and the `create({id})` promotion primitive they consume are real and tested here.

## Threat Flags
None — no new network endpoints, auth paths, or trust boundaries beyond the two already in the plan's `<threat_model>` (disk→main store file via coerceOnLoad+corrupt-recovery; renderer→main bounds via validateBounds). Both mitigations are implemented and tested (T-05-02 coercion, T-05-04 corrupt recovery, T-05-05 fixed path, T-05-06 validateBounds-before-apply).

## User Setup Required
None — no external service configuration.

## Next Phase Readiness
- **Ready for Plan 05-03:** `listSessions()` returns dormant `not_started` rows for IdleCard/WelcomeEmptyState; `create({id})` is the Start ▶ promotion primitive; `getUiState().collapsed` + persisted bounds are available for the UI to consume.
- **Ready for Plan 05-04:** `setOrder` persists (live + dormant) through the debounce; the dnd-kit slice's drag-end maps to a single `persistOrder` payload.
- **Phase-gate MANUAL check (carried):** a full quit + relaunch confirming the canonical 🛋️ Parlour Claude RC session reappears as `not_started` — WDIO cannot drive a full app quit/relaunch reliably; this is the human reopen check (noted `// MANUAL:` in the smoke).

---
*Phase: 05-persistence-shell-discovery*
*Completed: 2026-06-06*

## Self-Check: PASSED

- All 4 created/modified key files verified present on disk.
- All 3 task commits (`33e4483`, `34b9f54`, `5d250a4`) verified in git history.
- Full unit suite GREEN (124 passed); persistence smoke GREEN (2 passing) against the built app.
