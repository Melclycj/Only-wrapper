---
phase: "01"
plan: "01"
subsystem: "project-scaffold"
tags: [electron, forge, vite, typescript, eslint, vitest, wdio, wave-0]
dependency_graph:
  requires: []
  provides:
    - package.json with Electron 36.9.5 pin and electron-rebuild -f postinstall
    - forge.config.ts with VitePlugin + AutoUnpackNativesPlugin
    - vite.main.config.ts (CJS, electron+node-pty external)
    - vite.preload.config.ts (CJS, electron external)
    - vite.renderer.config.ts (ESM)
    - tsconfig.json (strict, isolatedModules, bundler resolution)
    - eslint.config.ts (flat config, renderer no-restricted-imports D-06)
    - vitest.config.ts (node env, excludes smoke)
    - wdio.conf.ts (@wdio/electron-service D-09)
    - src/main/index.ts (BrowserWindow with contextIsolation+sandbox)
    - src/preload/index.ts (contextBridge typed api surface)
    - src/renderer/index.tsx (minimal React walking skeleton)
    - src/shared/api-types.ts (ElectronAPI type + Window.api augmentation)
    - src/shared/types.d.ts (Forge Vite global declarations)
    - src/shared/__tests__/identity.guard.test.ts (Wave 0 RED stub)
    - src/shared/__tests__/security.guard.test.ts (Wave 0 RED stub)
    - tests/smoke/boot.smoke.test.ts (Wave 0 RED stub)
  affects: []
tech_stack:
  added:
    - electron@36.9.5
    - "@electron-forge/cli@7.11.2"
    - "@electron-forge/plugin-vite@7.11.2"
    - "@electron-forge/plugin-auto-unpack-natives@7.11.2"
    - "@electron/rebuild@4.0.4"
    - react@19.2.7
    - react-dom@19.2.7
    - typescript@6.0.3
    - vitest@4.1.8
    - eslint@10.4.1
    - typescript-eslint@8.60.1
    - eslint-config-prettier@10.1.8
    - prettier@3.8.3
    - "@wdio/electron-service@10.0.0"
    - uuid@14.0.0
    - electron-squirrel-startup@1.0.1
  patterns:
    - Electron Forge vite-typescript process split (main/preload/renderer/shared)
    - CJS main+preload build (Vite lib mode, formats:cjs) for node-pty compatibility
    - contextBridge-only renderer<->main bridge (SC3)
    - ESLint flat config (v9) with path-scoped no-restricted-imports (D-06)
    - Wave 0 RED test stubs — import contracts that Plans 02/03 implement
key_files:
  created:
    - package.json
    - package-lock.json
    - .gitignore
    - forge.config.ts
    - vite.main.config.ts
    - vite.preload.config.ts
    - vite.renderer.config.ts
    - tsconfig.json
    - eslint.config.ts
    - vitest.config.ts
    - wdio.conf.ts
    - .prettierrc.json
    - src/main/index.ts
    - src/preload/index.ts
    - src/renderer/index.html
    - src/renderer/index.tsx
    - src/shared/api-types.ts
    - src/shared/types.d.ts
    - src/shared/__tests__/identity.guard.test.ts
    - src/shared/__tests__/security.guard.test.ts
    - tests/smoke/boot.smoke.test.ts
  modified: []
decisions:
  - "Electron pinned to 36.9.5 (D-10): conservative stable pin with clear upgrade path; node-pty ABI 135 registered in node-abi 4.31.0"
  - "TypeScript 6.0.3 requires moduleResolution:bundler (not deprecated node10); tsconfig updated"
  - "Test stubs excluded from main tsconfig compilation — Wave 0 RED imports are by design; Vitest handles them in its own context"
  - "@types/electron-squirrel-startup@1.0.2 added as dev dep (needed for tsc to type-check src/main/index.ts)"
  - "src/shared/api-types.ts created in Task 2 alongside walking skeleton (needed for renderer window.api type — Plan 02 will expand this)"
metrics:
  duration_seconds: 449
  completed_date: "2026-06-03"
  tasks_completed: 3
  tasks_total: 3
  files_created: 21
  files_modified: 0
---

# Phase 01 Plan 01: Project Scaffold + Dev Infrastructure Summary

**One-liner:** Electron 36.9.5 project scaffolded in-place with Forge+Vite CJS main/preload split, ESLint renderer security ban (D-06), Vitest + WDIO harnesses, `electron-rebuild -f` postinstall (SC4), and three Wave 0 RED test stubs for Plans 02/03 to make green.

---

## What Was Built

A reproducible, type-safe Electron build foundation for Just-Wrapper:

1. **package.json** — All Phase 1 deps installed at pinned versions; Electron pinned to exactly 36.9.5 (D-10); `postinstall: electron-rebuild -f` exits 0 with no native modules (SC4); no `"type":"module"` (preserves CJS for node-pty in Phase 2); scripts: start, lint, format, test:unit, test:smoke, test.

2. **Build config** — `forge.config.ts` wires VitePlugin (src/main/index.ts + src/preload/index.ts entries, main_window renderer) and AutoUnpackNativesPlugin (placeholder for Phase 2). `vite.main.config.ts` and `vite.preload.config.ts` set `formats: ['cjs']` and externalize `electron` (+ `node-pty` in main as Phase 2 prep). Renderer config uses default Vite/React ESM output.

3. **TypeScript config** — `strict: true`, `noImplicitAny: true`, `isolatedModules: true` (Vite requirement), `moduleResolution: bundler` (TypeScript 6.0.3 compatibility). Wave 0 test stubs excluded from main tsconfig; Vitest handles them.

4. **ESLint flat config (D-06)** — `tseslint.configs.recommended` as base; `no-restricted-imports` banning `electron`/`ipcRenderer` scoped to `src/renderer/**`; second defense-in-depth override for `src/shared/**`; `eslintConfigPrettier` as trailing entry.

5. **Vitest config** — `environment: 'node'`, includes `src/**/__tests__/**/*.test.ts` and `src/**/*.guard.test.ts`, excludes `tests/smoke/**`.

6. **WDIO config (D-09)** — `@wdio/electron-service` boot smoke harness; `runner: 'local'`, `specs: tests/smoke/**/*.smoke.test.ts`, `framework: 'mocha'`, `mochaOpts.timeout: 30000`.

7. **Walking skeleton** — `src/main/index.ts` with BrowserWindow (contextIsolation:true, nodeIntegration:false, sandbox:true), minimal `ipcMain.handle('api:get-version')`; `src/preload/index.ts` with contextBridge typed surface; `src/renderer/index.tsx` React app that calls `window.api.getVersion()`.

8. **Wave 0 failing test stubs** — Three stubs that intentionally fail RED (contracts not yet implemented):
   - `identity.guard.test.ts`: IDENT-01/IDENT-02 — imports from `../types` and `../id-factory` (Plan 02); @ts-expect-error brand check
   - `security.guard.test.ts`: SC3/D-07 — imports from `../../main/window-config` (Plan 03); no `electron` import (RESEARCH Pitfall 4)
   - `boot.smoke.test.ts`: SC1 — WDIO mocha asserting window title truthy and zero SEVERE console errors

---

## Verification Results

| Check | Result |
|-------|--------|
| `npm install` postinstall `electron-rebuild -f` | PASS — "No native modules found", exit 0 (SC4) |
| `npx tsc --noEmit` | PASS — strict tsconfig valid |
| `npm run test:unit` | EXPECTED FAIL — Wave 0 RED (imports unresolved: ../types, ../id-factory, ../../main/window-config) |
| package.json electron pin | PASS — 36.9.5 exactly (D-10) |
| package.json no type:module | PASS |
| package.json postinstall | PASS — `electron-rebuild -f` (no -w node-pty) |
| No banned packages (node-pty, @xterm, lowdb, husky, lint-staged) | PASS |
| vite.main.config.ts formats:['cjs'] + externals | PASS |
| eslint.config.ts no-restricted-imports scoped to src/renderer/** | PASS |
| vitest.config.ts excludes smoke tests | PASS |
| forge.config.ts VitePlugin + AutoUnpackNativesPlugin | PASS |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript 6.0.3 moduleResolution deprecation**
- **Found during:** Task 2 (tsc verification)
- **Issue:** TypeScript 6.0.3 deprecated `moduleResolution: "node"` and `baseUrl` options, causing tsc to exit non-zero with deprecation errors.
- **Fix:** Removed `baseUrl` and changed `moduleResolution: "node"` to `moduleResolution: "bundler"` which is the TS6-recommended option for Vite-based projects.
- **Files modified:** `tsconfig.json`
- **Commit:** 1cb40d8 (part of Task 2 commit)

**2. [Rule 3 - Blocking] Wave 0 test stubs excluded from main tsconfig**
- **Found during:** Task 3 (tsc verification after adding test stubs)
- **Issue:** `tsconfig.json` included `src` directory which contains `__tests__/` with Wave 0 stubs that import from Plan 02/03 modules not yet created. This caused tsc to fail.
- **Fix:** Added `exclude: ["src/**/__tests__/**", "tests/**"]` to tsconfig. Vitest handles type-checking of guard tests in its own context; the stubs are intentionally RED.
- **Files modified:** `tsconfig.json`
- **Commit:** e87f245

**3. [Rule 2 - Missing Critical] @types/electron-squirrel-startup added**
- **Found during:** Task 2 (tsc verification)
- **Issue:** `electron-squirrel-startup` lacked type declarations, causing implicit `any` error under `noImplicitAny: true`.
- **Fix:** Added `@types/electron-squirrel-startup@1.0.2` as a devDependency.
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** 1cb40d8 (part of Task 2 commit)

**4. [Rule 2 - Missing Critical] src/shared/api-types.ts created in Task 2**
- **Found during:** Task 2 (walking skeleton requires Window.api augmentation for renderer to type-check)
- **Issue:** Plan 01 says Window.api augmentation is added in Plan 02, but the renderer already uses `window.api.getVersion()` and tsc requires the type to be available.
- **Fix:** Created `src/shared/api-types.ts` with `ElectronAPI` type and `Window.api` augmentation (pure types, no electron imports). Plan 02 will expand this with full types.ts and id-factory.ts contracts.
- **Files modified:** `src/shared/api-types.ts` (new), `src/renderer/index.tsx` (import added)
- **Commit:** 1cb40d8 (part of Task 2 commit)

---

## Known Stubs

The following are intentional Wave 0 RED stubs — they reference Plan 02/03 contracts that do not yet exist:

| Stub | File | Plans to resolve |
|------|------|-----------------|
| `import type { SessionRecord, LogicalId } from '../types'` | `src/shared/__tests__/identity.guard.test.ts:9` | Plan 02 (creates src/shared/types.ts) |
| `import { newLogicalId } from '../id-factory'` | `src/shared/__tests__/identity.guard.test.ts:10` | Plan 02 (creates src/shared/id-factory.ts) |
| `import { buildWebPreferences, EXPECTED_API_KEYS } from '../../main/window-config'` | `src/shared/__tests__/security.guard.test.ts:11` | Plan 03 (creates src/main/window-config.ts) |
| `browser.getTitle()` / `browser.getLogs()` | `tests/smoke/boot.smoke.test.ts` | Plan 03 (wires full walking skeleton for WDIO boot) |

These stubs are intentional per the Wave 0 design — Plans 02/03 implement the contracts that turn them GREEN.

---

## Self-Check: PASSED

### Files created:
- /Users/jerry/Project/Just-wrapper/package.json: FOUND
- /Users/jerry/Project/Just-wrapper/forge.config.ts: FOUND
- /Users/jerry/Project/Just-wrapper/vite.main.config.ts: FOUND
- /Users/jerry/Project/Just-wrapper/vite.preload.config.ts: FOUND
- /Users/jerry/Project/Just-wrapper/vite.renderer.config.ts: FOUND
- /Users/jerry/Project/Just-wrapper/tsconfig.json: FOUND
- /Users/jerry/Project/Just-wrapper/eslint.config.ts: FOUND
- /Users/jerry/Project/Just-wrapper/vitest.config.ts: FOUND
- /Users/jerry/Project/Just-wrapper/wdio.conf.ts: FOUND
- /Users/jerry/Project/Just-wrapper/.prettierrc.json: FOUND
- /Users/jerry/Project/Just-wrapper/src/shared/types.d.ts: FOUND
- /Users/jerry/Project/Just-wrapper/src/shared/__tests__/identity.guard.test.ts: FOUND
- /Users/jerry/Project/Just-wrapper/src/shared/__tests__/security.guard.test.ts: FOUND
- /Users/jerry/Project/Just-wrapper/tests/smoke/boot.smoke.test.ts: FOUND

### Commits:
- 115ec4f: chore(01-01): scaffold project, pin deps, wire postinstall hook
- 1cb40d8: feat(01-01): add build/lint/test config files and walking skeleton
- a021128: test(01-01): add Wave 0 failing test stubs (identity, security, boot smoke)
- e87f245: fix(01-01): exclude Wave 0 test stubs from main tsconfig
