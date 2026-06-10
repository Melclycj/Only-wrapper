---
phase: 07-terminal-search-scrollback-config
plan: 01
subsystem: contracts-foundation
tags: [search, scrollback, contextbridge, ipc, pure-logic, interface-first]
requires:
  - "src/main/switch-keys.ts SwitchIntent union + before-input-event dispatch (04-01/06-01)"
  - "src/main/store-schema.ts StoreSchema.ui + coerceOnLoad (05-01)"
  - "src/main/pty-manager.ts setUiState/getUiState validate-in-main (05-01)"
  - "src/main/window-config.ts EXPECTED_API_KEYS 19-key lockstep (06-01 pickDirectory)"
provides:
  - "{ kind: 'search' } SwitchIntent variant + matchSearchKey(i, platform) pure matcher"
  - "clampScrollback(n) pure helper + ui.scrollback?: number schema field"
  - "setUiState scrollback validate/clamp path (T-07-01)"
  - "getUiState bridge read key (20th) — boot-read of validated UI prefs"
  - "@xterm/addon-search@0.15.0 (pure JS, no native rebuild)"
affects:
  - "Plan 02 (search slice): SearchBar/SearchAddon wire matchSearchKey + getUiState contracts"
  - "Plan 03 (scrollback slice): PreferencesModal wires clampScrollback + persistUiState(scrollback) + getUiState seed"
tech-stack:
  added:
    - "@xterm/addon-search@0.15.0 (exact pin; peer @xterm/xterm@^5.0.0; pure-JS browser bundle)"
  patterns:
    - "Global-chord channel reuse (find chord rides 'session:switch', zero new key)"
    - "Validate-in-main clamp before disk write (clampScrollback in setUiState)"
    - "Atomic 4-site contextBridge lockstep (api-types + window-config + preload + registerIpc)"
key-files:
  created:
    - "src/main/__tests__/scrollback-clamp.test.ts"
  modified:
    - "package.json / package-lock.json (addon-search dep)"
    - "src/main/switch-keys.ts"
    - "src/main/index.ts"
    - "src/main/store-schema.ts"
    - "src/main/pty-manager.ts"
    - "src/main/window-config.ts"
    - "src/preload/index.ts"
    - "src/shared/api-types.ts"
    - "src/main/__tests__/switch-keys.test.ts"
    - "src/main/__tests__/pty-validation.test.ts"
    - "src/main/__tests__/session-store.test.ts"
decisions:
  - "Pinned @xterm/addon-search@0.15.0 (not 0.16.0): 0.15.0 is the last version with a verifiable peer @xterm/xterm@^5.0.0; 0.16.0 dropped the peerDependencies field. Plan's own selection rule mandates the version whose peer is ^5.0.0."
  - "matchSearchKey is a NEW sibling matcher (NOT a change to matchSwitchKey), mirroring matchClearKey; takes platform explicitly for testability."
  - "Find chord + scrollback persist add ZERO bridge keys; getUiState is the ONLY new key (19->20). EXPECTED_API_KEYS = 20, security guard GREEN."
  - "No SCHEMA_VERSION bump for ui.scrollback (additive, ui slot already tolerates {}; read-time default via clampScrollback)."
metrics:
  duration: ~18min
  tasks: 3
  files: 12
  completed: 2026-06-09
---

# Phase 7 Plan 01: Search + Scrollback Contract Foundation Summary

Interface-first Wave 0 that freezes both Phase-7 feature contracts before the renderer slices wire them: the pure `matchSearchKey(i, platform)` find-chord matcher (macOS Ctrl+F deliberately returns null so readline forward-char survives), the pure `clampScrollback` helper (1000–50000, default 5000), the main-side `setUiState` scrollback validate/clamp path, and exactly one new validated bridge read key `getUiState` (19→20) via the atomic 4-site lockstep — plus the installed pure-JS `@xterm/addon-search@0.15.0`.

## What Was Built

**Task 1 — dependency + Wave 0 RED tests (`d2e1e7b`)**
- Installed `@xterm/addon-search@0.15.0` (exact pin). Verified zero `.node` binaries (pure JS, no `@electron/rebuild`); `SearchAddon` loads cleanly under a `self` browser-global shim. Confirmed `scripts/fix-node-pty.cjs` postinstall does not touch the addon.
- Landed four RED unit-test additions referencing the not-yet-implemented symbols: `matchSearchKey` block in `switch-keys.test.ts`, new `scrollback-clamp.test.ts`, `setUiState` scrollback cases in `pty-validation.test.ts`, and `ui.scrollback` round-trip + absent-tolerance in `session-store.test.ts`.

**Task 2 — pure source (matcher + clamp + validate) (`70091a9`)**
- `switch-keys.ts`: `{ kind: 'search' }` SwitchIntent variant + `isKeyF` + pure `matchSearchKey(i, platform)`. macOS Cmd+F→search, macOS Ctrl+F→null (D-03), Windows Ctrl+F→search.
- `index.ts`: `before-input-event` sibling block wires `matchSearchKey(key, process.platform)` over the existing `'session:switch'` channel (chord never reaches xterm/PTY).
- `store-schema.ts`: `ui.scrollback?: number` (additive, no SCHEMA_VERSION bump) + pure `clampScrollback` (+ `SCROLLBACK_MIN/MAX/DEFAULT`).
- `pty-manager.ts`: `setUiState` clamps a finite scrollback in MAIN before write (T-07-01); `uiState` field + `getUiState()` return type widened.
- The previously-RED Task 1 pure tests turned GREEN.

**Task 3 — atomic bridge lockstep (`70d17ab`)**
- `api-types.ts`: widened `persistUiState` payload with `scrollback?` (same key) + added `getUiState()` (20th key, read-only).
- `window-config.ts`: appended `'getUiState'` → `EXPECTED_API_KEYS` is exactly 20 + header note.
- `preload/index.ts`: widened `persistUiState` payload + `getUiState: () => ipcRenderer.invoke('pty:get-ui-state')`; no raw `ipcRenderer` leak.
- `pty-manager.ts`: `PTY_CHANNELS.getUi` + `registerIpc` `handle('pty:get-ui-state')` + symmetric `unregisterIpc` teardown.
- `security.guard.test.ts` went GREEN at 20 keys with no test-code change (its assertion is the dynamic `Object.keys(exposed).sort() === EXPECTED_API_KEYS`).

## Verification

- `npm run test:unit`: **283 passed (35 files)** — switch-keys (incl. macOS-Ctrl+F→null), scrollback-clamp, pty-validation (scrollback clamp/no-op), session-store round-trip, security.guard (20-key surface, no ipcRenderer leak).
- `npx tsc --noEmit`: clean (0 errors) across all touched main/shared/preload files.
- `npx eslint` on all touched files: clean (0 errors).
- `node -e "require('@xterm/addon-search')"`: loads pure-JS (`SearchAddon` is a function) with no native-rebuild error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Pinned addon-search at 0.15.0, not 0.16.0**
- **Found during:** Task 1.
- **Issue:** The plan's verify command hardcodes `npm view @xterm/addon-search@0.16.0 peerDependencies | grep -q '\^5.0.0'`, but `0.16.0` (the current `latest`) declares **no** `peerDependencies` field at all, so that grep fails and the `^5.0.0` peer cannot be confirmed. `0.15.0` is the last stable release that explicitly declares `@xterm/xterm@^5.0.0`.
- **Fix:** Selected `0.15.0` per the plan's own stated fallback rule ("pick the one whose peer is `@xterm/xterm@^5.0.0`"). Exact-pinned (`"0.15.0"`, no caret) to match the project's `@xterm/*` convention. `0.17.0-beta.*` (the 5.6-only line) was never considered.
- **Files modified:** package.json, package-lock.json.
- **Commit:** `d2e1e7b`.

**2. [Rule 3 — Blocking issue] npm auto-inserted a caret; corrected to exact pin**
- **Found during:** Task 1.
- **Issue:** `npm install @xterm/addon-search@0.15.0` wrote `"^0.15.0"` (caret), violating the exact-pin acceptance criterion and the CLAUDE.md `@xterm/*` exact-pin convention.
- **Fix:** Hand-edited `package.json` to `"0.15.0"` and re-ran `npm install` to sync the lockfile.
- **Commit:** `d2e1e7b`.

### Note (not a deviation)

The `node -e "require('@xterm/addon-search')"` bare-load throws `ReferenceError: self is not defined` — this is the expected behavior of a **pure browser UMD bundle** (it references the `self` global), NOT a native-rebuild failure. Loading it under a one-line `self` shim resolves cleanly, confirming the addon is pure-JS and needs no `@electron/rebuild`. In the real renderer (Chromium) `self` exists, so the addon loads natively.

## Known Stubs

None. This plan lays pure-logic contracts and the bridge surface only; no UI component, no hardcoded empty data flows to render. The renderer wiring (SearchBar, PreferencesModal, terminal scrollback seed) is deferred to Plans 02/03 by design (interface-first).

## Threat Flags

None. The only new surface (`getUiState`) is a read-only main→renderer invoke returning already-validated prefs (no fs handle, no write widening); the find chord and scrollback persist add zero keys. All accounted for in the plan's `<threat_model>` (T-07-01/02/03/SC).

## Self-Check: PASSED
- Files: FOUND src/main/switch-keys.ts, src/main/store-schema.ts, src/main/window-config.ts, src/main/__tests__/scrollback-clamp.test.ts
- Commits: FOUND d2e1e7b, 70091a9, 70d17ab
