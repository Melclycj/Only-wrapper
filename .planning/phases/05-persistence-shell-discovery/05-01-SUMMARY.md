---
phase: 05-persistence-shell-discovery
plan: 01
subsystem: persistence
tags: [lowdb, shell-discovery, contextbridge, ipc, vitest, electron, window-bounds, reorder]

# Dependency graph
requires:
  - phase: 04-session-identity-sidebar
    provides: "15-key contextBridge lockstep (api-types + EXPECTED_API_KEYS + preload + PTY_CHANNELS triple + security.guard), SessionRecord contract, PtyManager validate-in-main discipline"
  - phase: 02-pty-core
    provides: "shell-resolver.ts (resolveShell — reused as the always-included $SHELL fallback), electron-free pure-module + Vitest convention"
provides:
  - "store-schema.ts — SCHEMA_VERSION + StoreSchema type + coerceOnLoad (D-01/SC2 dormant coercion)"
  - "shell-discovery.ts — ShellDiscovery seam: parseEtcShells/buildShellList + MacShellProvider + WindowsShellProvider stub + selectShellProvider (D-05/06/07)"
  - "window-bounds.ts — validateBounds off-screen rejection + DEFAULT_BOUNDS (D-12/Pitfall 5)"
  - "session-reorder.ts — pure reorder reducer with dense 0..n-1 reindex (NAV-04/Pitfall 6)"
  - "18-key contextBridge surface (discoverShells/persistOrder/persistUiState) + their channels"
  - "lowdb@7.0.1 installed, marked external, kept in the packaging allow-list"
  - "PtyManager.setOrder/setUiState validate-in-main setters (T-05-01) + discoverShells delegate"
  - "session-store.test.ts RED stub establishing the Plan 05-02 SessionStore contract"
affects: [05-02 (SessionStore lowdb wiring + hydrate), 05-03 (IdleCard/WelcomeEmptyState/shell dropdown), 05-04 (dnd-kit reorder slice), 08 (Windows shell enumeration + packaging)]

# Tech tracking
tech-stack:
  added: [lowdb@7.0.1, steno@4.0.2 (transitive)]
  patterns:
    - "Pure electron-free modules with injected dependencies (existsFn, displays) for Node-env Vitest"
    - "lowdb-as-external (mirror node-pty) so dynamic import() resolves the ESM package at runtime"
    - "Atomic 5-point contextBridge lockstep asserted by security.guard exact-set test"
    - "Validate-in-main setters (type-guard every renderer field before any state write — T-05-01)"

key-files:
  created:
    - src/main/store-schema.ts
    - src/main/shell-discovery.ts
    - src/main/window-bounds.ts
    - src/renderer/session-reorder.ts
    - src/main/__tests__/store-schema.test.ts
    - src/main/__tests__/shell-discovery.test.ts
    - src/main/__tests__/window-bounds.test.ts
    - src/main/__tests__/session-store.test.ts
    - src/renderer/__tests__/session-reorder.test.ts
  modified:
    - package.json
    - package-lock.json
    - vite.main.config.ts
    - forge.config.ts
    - src/shared/api-types.ts
    - src/main/window-config.ts
    - src/preload/index.ts
    - src/main/pty-manager.ts

key-decisions:
  - "lowdb pinned EXACTLY to 7.0.1 (not ^7.0.1) to match the CLAUDE.md exact-pin stack convention"
  - "lowdb marked external (mirror node-pty) + kept in forge ignore allow-list, not bundled (Pitfall 1/2)"
  - "WindowsShellProvider stub returns the resolved $SHELL so the dropdown is never empty cross-platform (D-05)"
  - "setOrder/setUiState accept unknown payloads and type-guard every field main-side before mutating (T-05-01)"

patterns-established:
  - "Electron-free pure modules unit-tested in Node env via injected fs/display seams"
  - "Interface-first wave: contracts (types, channels, pure helpers) land before Wave-2/3/4 behavior"

requirements-completed: [PERS-01, PERS-02, NAV-04]

# Metrics
duration: 6min
completed: 2026-06-06
---

# Phase 5 Plan 01: Persistence + Shell Discovery Foundation Summary

**Four pure electron-free modules (coerceOnLoad, shell-discovery seam, validateBounds, reorder), an 18-key contextBridge surface, and lowdb@7.0.1 installed/externalized — the interface-first wave that locks every Phase-5 contract with no user-visible behavior yet.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-06T05:50:18Z
- **Completed:** 2026-06-06T05:56:34Z
- **Tasks:** 2
- **Files modified:** 17 (9 created, 8 modified)

## Accomplishments
- Four pure, electron-free modules (`store-schema`, `shell-discovery`, `window-bounds`, `session-reorder`) implemented + GREEN under 26 colocated Vitest assertions.
- The atomic 3-key contextBridge lockstep (`discoverShells`/`persistOrder`/`persistUiState`) landed across all five edit points; `security.guard.test.ts` GREEN at the exact 18-key surface with no raw `ipcRenderer`.
- `lowdb@7.0.1` installed (exact-pinned), marked `external` in `vite.main.config.ts`, and kept (with `steno`) in the `forge.config.ts` packaging allow-list — resolving Pitfall 1 (ESM-in-CJS) and Pitfall 2 (packaging prune) up front.
- Validate-in-main `setOrder`/`setUiState` setters (T-05-01) wired so the persistence channel surface is complete and security-validated ahead of the Plan 05-02 store wiring.
- `session-store.test.ts` RED stub established as the Plan 05-02 SessionStore contract (5 `it.todo` markers; collects cleanly in the full suite).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave-0 RED test stubs + four pure electron-free modules** - `90c8d8b` (feat)
2. **Task 2: Install lowdb + mark external + atomic 3-key contextBridge lockstep** - `a44121d` (feat)

_Note: this is a `tdd="true"` Task 1 — tests and implementations are colocated and the suite is GREEN; landed in a single feat commit._

## Files Created/Modified
- `src/main/store-schema.ts` - SCHEMA_VERSION + StoreSchema + coerceOnLoad (forces restored records dormant — D-01/SC2)
- `src/main/shell-discovery.ts` - parseEtcShells/buildShellList pure helpers + Mac/Windows providers + selectShellProvider (D-05/06/07)
- `src/main/window-bounds.ts` - validateBounds (off-screen rejection) + DEFAULT_BOUNDS (D-12/Pitfall 5)
- `src/renderer/session-reorder.ts` - pure reorder reducer with dense 0..n-1 reindex (NAV-04/Pitfall 6)
- `src/main/__tests__/*.test.ts` (4) + `src/renderer/__tests__/session-reorder.test.ts` - 26 GREEN unit assertions
- `src/main/__tests__/session-store.test.ts` - RED stub (5 todos) — Plan 05-02 contract
- `package.json` / `package-lock.json` - lowdb@7.0.1 (exact pin) + steno@4.0.2 transitive
- `vite.main.config.ts` - lowdb added to `rollupOptions.external`
- `forge.config.ts` - lowdb + steno kept in the `packagerConfig.ignore` allow-list
- `src/shared/api-types.ts` - 3 new ElectronAPI methods (+ DiscoveredShell type-only import)
- `src/main/window-config.ts` - EXPECTED_API_KEYS grown to 18 + reviewed-expansion comment
- `src/preload/index.ts` - 3 new bridge impls (+ DiscoveredShell type-only import)
- `src/main/pty-manager.ts` - PTY_CHANNELS +3 channels, registerIpc/unregisterIpc symmetric wiring, discoverShells/setOrder/setUiState methods, uiState field

## Decisions Made
- **Exact-pin lowdb to `7.0.1`** (not the `^7.0.1` npm wrote by default) to match the CLAUDE.md exact-pin convention used by the rest of the terminal stack — prevents silent drift. Treated as a CLAUDE.md-driven correctness fix (see Deviations Rule 2).
- **lowdb external + packaging keep-list** over bundling (RESEARCH Open Q1 recommendation): lowest-cognitive-load mirror of node-pty; the keep-clause is added now so dev (`npm start`) and packaged builds agree before Phase 8.
- **`setOrder`/`setUiState` accept `unknown`** and type-guard every field main-side: a forged renderer payload is a silent no-op, never writing arbitrary data (T-05-01 / ASVS V5).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Exact-pinned lowdb to 7.0.1**
- **Found during:** Task 2 (lowdb install)
- **Issue:** `npm install lowdb@7.0.1` wrote `"lowdb": "^7.0.1"` to package.json. CLAUDE.md mandates exact version pins for the stack ("Pinned the 7 terminal-stack packages at exact versions (no caret) to prevent drift"), and the plan acceptance criteria require `"lowdb": "7.0.1"`. A caret range permits drift onto a future 7.x that could change the ESM exports the dynamic-import path depends on.
- **Fix:** Edited package.json to `"lowdb": "7.0.1"` and re-ran `npm install` to update the lockfile to the exact resolution.
- **Files modified:** package.json, package-lock.json
- **Verification:** `grep '"lowdb"' package.json` → `"lowdb": "7.0.1"`; lockfile `node_modules/lowdb` version `7.0.1`, `steno` `4.0.2`.
- **Committed in:** a44121d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical / CLAUDE.md convention).
**Impact on plan:** The fix enforces a CLAUDE.md hard constraint and an explicit plan acceptance criterion. No scope creep.

## Issues Encountered
None — both tasks executed as planned. The full unit suite (`npx vitest run`) is 108 passed | 5 todo | 1 skipped; typecheck (`tsc --noEmit`) and lint clean.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Ready for Plan 05-02:** `coerceOnLoad`, `StoreSchema`, the `setOrder`/`setUiState` validate-in-main setters, and the `session-store.test.ts` contract are in place for the SessionStore lowdb wiring + `PtyManager.hydrate`. lowdb is external + packaged-allow-listed.
- **Ready for Plan 05-03:** `discoverShells` channel + `DiscoveredShell` type feed the edit-form shell dropdown; `WelcomeEmptyState`/`IdleCard` contracts are namespaced.
- **Ready for Plan 05-04:** `session-reorder.ts` (`reorder`) backs the dnd-kit slice; `persistOrder` channel is live. `@dnd-kit/*` + `electron-window-state` remain UN-installed (gated behind checkpoints in 05-04) per the `[ASSUMED]` provenance rule.
- **Load-bearing caveat (carried to 05-02):** the lowdb dynamic `import()` must be smoke-tested in the BUILT app (`npm start`/`npm run make`), not just Vitest — Vitest's ESM loader hides a `require`-rewrite regression (RESEARCH Pattern 1 / Pitfall 1).

---
*Phase: 05-persistence-shell-discovery*
*Completed: 2026-06-06*

## Self-Check: PASSED

- All 9 created files verified present on disk.
- Both task commits (`90c8d8b`, `a44121d`) verified in git history.
