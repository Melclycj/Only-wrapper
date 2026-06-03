---
phase: 01-project-scaffold-dev-infrastructure
plan: "02"
subsystem: identity
tags: [typescript, branded-types, uuid, session-record, logical-id, pty-pid, identity-invariant]

# Dependency graph
requires:
  - phase: 01-01
    provides: Electron Forge scaffold, Wave 0 RED test stubs (identity.guard.test.ts), src/shared/api-types.ts stub

provides:
  - src/shared/types.ts — LogicalId branded type, SessionStatus union (D-02), SessionIconSpec discriminated union (D-03), full SessionRecord interface (D-01)
  - src/shared/id-factory.ts — newLogicalId() factory wrapping uuid v4, main-process-only mint path (D-04)
  - src/shared/api-types.ts — confirmed and verified as complete (pre-implemented in Plan 01, matches SC3 surface)
  - identity.guard.test.ts GREEN — IDENT-01, IDENT-02, D-05 satisfied
  - tsc --noEmit exits 0 (strict, branded type valid)

affects:
  - Phase 02 (PTY spawn uses SessionRecord, newLogicalId())
  - Phase 03 (preload contextBridge uses ElectronAPI from api-types.ts)
  - Phase 04 (sidebar renders SessionRecord.icon, SessionRecord.status)
  - Phase 05 (persistence serializes/deserializes full SessionRecord)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Branded nominal type (LogicalId = string & { readonly __brand: 'LogicalId' }) — compile-time identity/PID separation
    - String-literal union SessionStatus (not TS enum) — zero runtime cost, clean switch narrowing, JSON-safe
    - Discriminated union SessionIconSpec — type: emoji | preset | color discriminant for renderer switch
    - newLogicalId() as the ONLY sanctioned LogicalId mint path — uuid v4 wrapped in id-factory.ts (main-process-only)
    - vite-globals.d.ts naming convention (avoids .d.ts / .ts stem collision with moduleResolution:bundler)

key-files:
  created:
    - src/shared/types.ts
    - src/shared/id-factory.ts
    - src/shared/vite-globals.d.ts
  modified:
    - src/shared/types.d.ts (renamed to vite-globals.d.ts — fixes tsc stem collision)

key-decisions:
  - "vite-globals.d.ts: renamed from types.d.ts to avoid TypeScript 6 name collision with new types.ts under moduleResolution:bundler"
  - "newLogicalId() is main-process-only — uuid cannot be required in sandboxed preloads (RESEARCH Pitfall 3)"
  - "api-types.ts pre-implemented in Plan 01 satisfies all Task 2 acceptance criteria — no code changes needed"

patterns-established:
  - "Branded types enforce identity separation at compile time — no runtime overhead, no runtime check"
  - "string-literal unions over TS enums for discriminated data in this codebase (D-02)"
  - "Ambient .d.ts files must NOT share a stem with .ts modules under moduleResolution:bundler"

requirements-completed: [IDENT-01, IDENT-02]

# Metrics
duration: 3min
completed: "2026-06-03"
---

# Phase 01 Plan 02: Shared Identity Contract Summary

**Branded LogicalId type (D-04), full SessionRecord interface (D-01..D-03), and newLogicalId() uuid v4 factory turn the Wave 0 identity guard test GREEN (IDENT-01, IDENT-02)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-03T13:37:31Z
- **Completed:** 2026-06-03T13:40:26Z
- **Tasks:** 2 (1 new implementation + 1 verification of pre-existing)
- **Files modified:** 4 (2 created, 1 renamed, 1 verified-unchanged)

## Accomplishments

- Implemented the permanent compile-time identity/PID separation invariant: `LogicalId = string & { readonly __brand: 'LogicalId' }` means any code that tries to assign a bare string or stringified PID to a session map key fails at compilation
- Full `SessionRecord` interface defines the stable contract all later phases (PTY, sidebar, persistence) build against — no reshaping needed mid-project
- `newLogicalId()` in `id-factory.ts` is the sole mint path for LogicalId values; uuid v4 uniqueness guarantees distinct IDs across sessions
- `identity.guard.test.ts` turned GREEN: 4/4 tests pass including the `@ts-expect-error` brand check that proves the type system rejects bare-number assignment to LogicalId
- Fixed pre-existing tsc failure: `types.d.ts` was silently excluded under TypeScript 6 `moduleResolution:bundler` due to stem collision with new `types.ts`; renamed to `vite-globals.d.ts`

## Task Commits

1. **Task 1: Implement shared types + id factory (D-01..D-04)** - `a1e17dc` (feat)
   - src/shared/types.ts, src/shared/id-factory.ts, src/shared/vite-globals.d.ts (renamed from types.d.ts)
2. **Task 2: Declare pure-type window.api surface (api-types.ts)** - no commit needed (pre-implemented in Plan 01, verified correct)

## Files Created/Modified

- `src/shared/types.ts` — LogicalId branded type, SessionStatus string-literal union (5 members), SessionIconSpec discriminated union, full SessionRecord interface (10 fields)
- `src/shared/id-factory.ts` — newLogicalId() wrapping uuid v4; main-process-only comment; ONLY sanctioned LogicalId mint path
- `src/shared/vite-globals.d.ts` — renamed from types.d.ts; Forge/Vite injected global declarations (MAIN_WINDOW_VITE_DEV_SERVER_URL, MAIN_WINDOW_VITE_NAME)
- `src/shared/api-types.ts` — verified complete (pre-implemented Plan 01): ElectronAPI type with getVersion, Window.api augmentation, no electron imports

## Decisions Made

- **vite-globals.d.ts naming:** TypeScript 6 with `moduleResolution: "bundler"` silently excludes ambient `.d.ts` files that share a stem with a `.ts` module. Renamed `types.d.ts` → `vite-globals.d.ts` to resolve the name collision and make the file's purpose explicit. This is the correct convention for all future ambient declaration files in this codebase.
- **No changes to api-types.ts:** The file was correctly pre-implemented in Plan 01 (documented as deviation #4 in Plan 01 SUMMARY). All Task 2 acceptance criteria are satisfied without modification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing tsc failure: types.d.ts stem collision with types.ts**
- **Found during:** Task 1 (tsc --noEmit verification)
- **Issue:** `npx tsc --noEmit` failed with "Cannot find name 'MAIN_WINDOW_VITE_DEV_SERVER_URL'" and `MAIN_WINDOW_VITE_NAME`. Root cause: TypeScript 6 `moduleResolution: "bundler"` silently excludes `src/shared/types.d.ts` because the new `src/shared/types.ts` takes precedence, so the Forge-injected globals were no longer declared.
- **Fix:** Renamed `src/shared/types.d.ts` → `src/shared/vite-globals.d.ts` to eliminate the stem collision. Both files are now independently included in compilation.
- **Files modified:** `src/shared/types.d.ts` (deleted) → `src/shared/vite-globals.d.ts` (created, same content)
- **Verification:** `npx tsc --noEmit` exits 0 after rename; `MAIN_WINDOW_VITE_DEV_SERVER_URL` and `MAIN_WINDOW_VITE_NAME` compile in `src/main/index.ts`.
- **Committed in:** a1e17dc (Task 1 commit)

**2. [Plan note] Task 2 api-types.ts pre-implemented in Plan 01**
- This is not a deviation from the current plan but a note: `src/shared/api-types.ts` was created as deviation #4 in Plan 01 (the renderer required `Window.api` for tsc to pass). All Task 2 acceptance criteria are satisfied. No code changes were made.

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** The tsc stem-collision fix was required for `npx tsc --noEmit` to exit 0 (a plan acceptance criterion). No scope creep; the rename is a naming-only change with no semantic impact.

## Issues Encountered

- TypeScript 6.0.3 `moduleResolution: "bundler"` does not automatically include ambient `.d.ts` files when a `.ts` module exists with the same stem — this is a TypeScript 6 behavior change from earlier versions. Resolved by using distinct filenames for ambient declarations.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `SessionRecord`, `LogicalId`, `SessionStatus`, `SessionIconSpec` are the stable contract for Phase 2 PTY spawn and lifecycle management
- `newLogicalId()` is ready for Phase 2's session creation path
- `api-types.ts` `ElectronAPI` type is ready for Plan 03's contextBridge round-trip verification
- `identity.guard.test.ts` GREEN locks the IDENT-01/IDENT-02 invariant — any future code that conflates logicalId with ptyPid will fail tsc
- Security guard test (`security.guard.test.ts`) remains RED — awaits Plan 03 (`src/main/window-config.ts`)
- Boot smoke test remains RED — awaits Plan 03 full walking skeleton wiring

---
*Phase: 01-project-scaffold-dev-infrastructure*
*Completed: 2026-06-03*
