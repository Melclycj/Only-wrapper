---
phase: 02-pty-core-terminal-fidelity
plan: 03
subsystem: renderer
tags: [xterm, terminal, pty-round-trip, fit-addon, webgl, unicode11, resize, packaging, node-pty, e2e-smoke]

# Dependency graph
requires:
  - phase: 02-02
    provides: PtyManager (validated/clamped IPC), ElectronAPI 7 PTY methods + payload types, EXPECTED_API_KEYS expanded, preload PTY bridge, main IPC wiring + orphan-safe lifecycle
provides:
  - src/renderer/TerminalPane.tsx — full-window xterm 5.5 pane that closes the live PTY round-trip (keystroke→PTY→render), auto-starts a single session on mount (D-02), reflows on resize, shows the exit notice, cleans up on unmount
  - src/renderer/index.tsx — mounts TerminalPane full-window
  - src/renderer/terminal.css — full-window dark layout (--term-bg charcoal-indigo)
  - tests/smoke/helpers/xterm-driver.ts — resizeWindow() + interactability-safe sendKeys()
  - forge.config.ts — packaging that ships node-pty's N-API prebuild outside the ASAR (boots the packaged app)
affects: [02-04 flow-control/throughput smoke, phase-04 sidebar (will host TerminalPane), phase-03 multi-session]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Renderer reaches the PTY ONLY via window.api (contextBridge) — no electron/node-pty import (ESLint + security guard enforced)"
    - "xterm instance: scrollback 10000, allowProposedApi:true (required for unicode11), block cursor, JetBrains Mono, DESIGN charcoal-indigo theme"
    - "WebGL renderer with canvas fallback on BOTH load failure and onContextLoss"
    - "fit() BEFORE ptyCreate so the PTY spawns at the correct cols/rows"
    - "Debounced (100ms) ResizeObserver + window resize → fit → window.api.ptyResize (SC3)"
    - "Full useEffect cleanup: unsubscribe data/exit, dispose onData handler + ResizeObserver + term (Pitfall 6)"
    - "Forge+Vite packaging: override the Vite plugin's node_modules-pruning ignore() to keep native externals (node-pty)"

key-files:
  created:
    - src/renderer/TerminalPane.tsx
    - src/renderer/terminal.css
  modified:
    - src/renderer/index.tsx
    - src/shared/vite-globals.d.ts
    - forge.config.ts
    - tests/smoke/helpers/xterm-driver.ts
    - tests/smoke/pty-resize.smoke.test.ts
    - .gitignore
    - eslint.config.ts

key-decisions:
  - "Task 1 (preload bridge) was already fully implemented in 02-02 (the security guard had to pass against the exact surface then) — verified GREEN, no duplicate work; no commit for an unchanged file"
  - "Override packagerConfig.ignore in forge.config.ts: the Vite plugin defaults it to 'exclude everything except /.vite', which prunes ALL node_modules including node-pty (a native external the main bundle require()s) → MODULE_NOT_FOUND at boot. Kept /.vite AND node-pty"
  - "rebuildConfig.onlyModules:[] skips Forge's node-gyp rebuild (needs network for Electron headers, fails ECONNRESET offline); ship the ABI-stable N-API prebuild instead (verified 02-01)"
  - "asar.unpackDir node-pty so its prebuilt pty.node + spawn-helper load from outside the ASAR (Pitfall 4); spawn-helper keeps its exec bit"
  - "E2E resize driven via BrowserWindow.setSize (browser.electron.execute) because the CDP window-rect command is unavailable under @wdio/electron-service"

patterns-established:
  - "Pattern: window.__term handle exposed for the E2E driver's authoritative cols read + buffer fallback"
  - "Pattern: parse tput cols output relative to its command echo to ignore login-banner/prompt digits"
  - "Pattern: native-external packaging under Forge+Vite (keep in ignore(), unpack from ASAR, skip rebuild for N-API prebuilds)"

requirements-completed: [TERM-01, TERM-02, TERM-03, TERM-04]

# Metrics
duration: ~22min
completed: 2026-06-04
---

# Phase 2 Plan 03: Live PTY Round-Trip TerminalPane Summary

Full-window xterm 5.5 TerminalPane that closes the live PTY round-trip end to end — auto-starts a single login shell on mount, streams keystrokes/output both ways, reflows the PTY on resize within the 1s budget, and ships in a packaged app whose node-pty loads from its N-API prebuild outside the ASAR.

## What Was Built

- **TerminalPane.tsx** — React component that, on mount: builds a `Terminal` (scrollback 10000, `allowProposedApi:true`, block cursor, JetBrains Mono, DESIGN charcoal-indigo theme); loads fit + web-links + unicode11 (`activeVersion='11'`); prefers a WebGL renderer with a canvas fallback on load failure AND `onContextLoss`; `fit()` before `ptyCreate`; auto-starts one session (D-02, cwd=home in main); wires `onPtyData → term.write`, `term.onData → ptyWrite`, a 100ms-debounced ResizeObserver/window-resize → `fit → ptyResize`, and `onPtyExit → [process exited]` passive notice; fully cleans up on unmount.
- **index.tsx / terminal.css** — mount TerminalPane full-window; html/body/#root 100% height, dark charcoal-indigo background, no sidebar/tabs (Phase 4).
- **Packaging (forge.config.ts)** — make `npm run package` produce a bootable app: keep node-pty through the Vite plugin's node_modules pruning, unpack its `.node`/`spawn-helper` outside the ASAR, and skip the network-bound node-gyp rebuild in favour of the ABI-stable prebuild.
- **E2E driver (xterm-driver.ts)** — interactability-safe `sendKeys` (focuses xterm's hidden textarea in-page) and a `resizeWindow` that drives the real `BrowserWindow.setSize` via the Electron service.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Extend preload bridge with PTY methods | (already complete in 02-02 — verified, no change) | src/preload/index.ts |
| 2 | Full-window TerminalPane + live round-trip | `8e7f4c3` | TerminalPane.tsx, terminal.css, index.tsx, vite-globals.d.ts |
| 3 | Round-trip + resize E2E smoke GREEN | `a741c6e` | forge.config.ts, xterm-driver.ts, pty-resize.smoke.test.ts, .gitignore, eslint.config.ts |

## Verification Results

- `npx tsc --noEmit` — clean (0 errors)
- `npm run lint` — clean (0 errors; renderer free of electron/node-pty)
- `npx vitest run` — 24/24 passing (security.guard + identity + pty-validation + flow-control + shell-resolver still GREEN)
- `security.guard.test.ts` — GREEN against EXPECTED_API_KEYS (the 8-key surface; no raw ipcRenderer)
- `npm run package` — succeeds; `app.asar.unpacked/node_modules/node-pty/prebuilds/darwin-arm64/{pty.node,spawn-helper}` present (spawn-helper `-rwxr-xr-x`); the bundled main require()s node-pty as an external
- **E2E smoke — `npx wdio run wdio.conf.ts --spec pty-roundtrip --spec pty-resize` → 2 specs, 4 tests, ALL PASS:**
  - pty-roundtrip: `echo hello` renders hello (SC1); `echo $TERM` → `xterm-256color` (SC4); Ctrl+C (0x03) interrupts `sleep 100` and the prompt returns (SC1)
  - pty-resize: resizing 1200→600 changes `term.cols` (148→73) within the 1s budget and `tput cols` reflects the new width (SC3)
- pty-throughput smoke intentionally NOT run as a gate — deferred to 02-04 (flow control)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Packaged app could not load node-pty (MODULE_NOT_FOUND)**
- **Found during:** Task 3 (npm run package + first smoke run)
- **Issue:** The first `npm run package` produced an asar containing ONLY the Vite build output and `package.json` — no `node_modules` at all, and no `app.asar.unpacked`. The `@electron-forge/plugin-vite` sets `packagerConfig.ignore` to "exclude everything except `/.vite`", which prunes node-pty. Since the main bundle `require("node-pty")`s it as an external (it cannot be bundled — native), the packaged app would throw `MODULE_NOT_FOUND` at startup, and the E2E smoke could not boot a working terminal.
- **Fix:** Override `packagerConfig.ignore` to keep `/.vite` AND `node_modules/node-pty`; add `asar.unpackDir` for node-pty so its `.node`/`spawn-helper` land outside the ASAR (Pitfall 4).
- **Files modified:** forge.config.ts
- **Commit:** `a741c6e`

**2. [Rule 3 - Blocking] Packaging hard-failed on a network-bound node-gyp rebuild (ECONNRESET)**
- **Found during:** Task 3 (second package attempt, after node-pty was kept)
- **Issue:** With node-pty now copied, Forge's default packaging rebuild invoked `@electron/rebuild` → node-gyp, which tried to download Electron 36 headers and failed with `ECONNRESET` (no network / sandbox), aborting `npm run package`.
- **Fix:** `rebuildConfig.onlyModules: []` makes the packaging rebuild a no-op; node-pty 1.1.0's N-API prebuild is ABI-stable under Electron 36 (verified 02-01; see `scripts/fix-node-pty.cjs`), so no from-source rebuild is needed.
- **Files modified:** forge.config.ts
- **Commit:** `a741c6e`

**3. [Rule 1 - Bug] xterm hidden textarea rejected as non-interactable by WDIO**
- **Found during:** Task 3 (first smoke run — `echo hello` failed)
- **Issue:** `sendKeys` did `textarea.click()`; xterm's helper textarea is `z-index:-5`, 8px — WDIO's interactability gate rejects `.click()` on it. (Tests that ran after focus was already established passed, masking the issue.)
- **Fix:** Focus the textarea in-page via `browser.execute(...focus())` (helper only; assertions untouched).
- **Files modified:** tests/smoke/helpers/xterm-driver.ts
- **Commit:** `a741c6e`

**4. [Rule 1 - Bug] Resize test used unsupported CDP window-rect commands**
- **Found during:** Task 3 (first smoke run — resize errored `Browser.getWindowForTarget wasn't found`)
- **Issue:** `browser.getWindowSize()/setWindowSize()` map to a CDP command unavailable under `@wdio/electron-service`. Separately, the naive "last number in buffer" parse picked up login-banner/clock digits, and the command raced ahead of SIGWINCH.
- **Fix:** Added `resizeWindow()` driving `BrowserWindow.setSize` via `browser.electron.execute`; parse `tput cols` output relative to its command echo; wait for the renderer's authoritative `term.cols` to change within the SC3 1s budget before asserting. Driver/flow only — the SC3 contract (cols changes after resize, within 1s) is unchanged.
- **Files modified:** tests/smoke/helpers/xterm-driver.ts, tests/smoke/pty-resize.smoke.test.ts
- **Commit:** `a741c6e`

**5. [Rule 3 - Blocking] CSS side-effect imports failed tsc (TS2882)**
- **Found during:** Task 2 (tsc)
- **Issue:** `import '@xterm/xterm/css/xterm.css'` and `import './terminal.css'` had no ambient module declaration, so tsc errored TS2882; also `ptyId` was typed `string` but the API expects branded `LogicalId`.
- **Fix:** Added `declare module '*.css'` to `src/shared/vite-globals.d.ts`; typed `ptyId` as `LogicalId`.
- **Files modified:** src/shared/vite-globals.d.ts, src/renderer/TerminalPane.tsx
- **Commit:** `8e7f4c3`

**6. [Rule 3 - Blocking] Stray root `main.js` build artifact broke `npm run lint`**
- **Found during:** Task 3 (lint after package)
- **Issue:** `npm run package` left a minified `main.js` at the repo root (Vite lib build emits it outside Forge's outDir); it is not under the ignored `.vite/`/`out/`, so ESLint linted it → 46 errors.
- **Fix:** Removed it; added `/main.js` to `.gitignore` and `main.js` to the ESLint `ignores` (flat config does not read `.gitignore`).
- **Files modified:** .gitignore, eslint.config.ts
- **Commit:** `a741c6e`

## Threat Model Compliance

- **T-02-08 (preload bridge surface):** exactly one `contextBridge.exposeInMainWorld('api', ...)`, no raw ipcRenderer, onPtyData/onPtyExit forward only the typed payload field — security.guard.test.ts GREEN.
- **T-02-09 (PTY output in renderer logs):** TerminalPane writes PTY data straight to `term.write` — no `console.log` of stream content.
- **T-02-10 (.node from ASAR/writable path):** node-pty's `.node` is unpacked to the read-only `app.asar.unpacked`; the packaging smoke boots the packaged app and round-trips, proving the native load path (Pitfall 4 / Security V12).

## Notes for Next Plan (02-04)

- The round-trip currently uses a plain `term.write` on `onPtyData`; 02-04 layers flow control (pause/resume via the existing `window.api.ptyPause/ptyResume` + main-side watermark) and turns the throughput smoke (SC5) GREEN.
- `window.__term` is exposed for the E2E driver; keep it (the throughput smoke and any cols/buffer reads rely on it).
- Packaging is now correct for native externals — 02-04 should not need to touch forge.config.ts unless it adds another native module.

## Self-Check: PASSED

All created/modified files exist on disk; both task commits (8e7f4c3, a741c6e) are present in git history.
