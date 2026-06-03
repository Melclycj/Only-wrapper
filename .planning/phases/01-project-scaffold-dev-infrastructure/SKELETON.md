# Walking Skeleton — Just-Wrapper

**Phase:** 1
**Generated:** 2026-06-03

## Capability Proven End-to-End

The Electron app boots to a blank window and successfully round-trips a value through the secure process split: the renderer calls `window.api.getVersion()` (exposed only via `contextBridge`), the main process answers via `ipcMain.handle('api:get-version')`, and the version renders — with zero console errors about nodeIntegration, contextIsolation, or preload.

This proves the load-bearing security boundary (renderer ↔ main, ASVS V4) and the typed bridge work end-to-end before a single line of PTY code exists. There is intentionally **no terminal, no UI screens, and no database** in the skeleton — those are later vertical slices.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Desktop framework | Electron 36.9.5 (pinned) | Only framework with production-proven PTY-via-node-pty architecture (CLAUDE.md, locked). 36.9.5 is the conservative pin (D-10): 8-month track record, predates the Playwright/Electron 36 CI launch issue, and `@electron/rebuild` can build node-pty against its ABI (135) in Phase 2. Pin can change in one line; the architecture cannot. |
| Scaffold / build | Electron Forge 7.11.2 + `@electron-forge/plugin-vite` (Vite) + `@electron-forge/template-vite-typescript` | Officially endorsed by electron.org; Vite gives fast renderer HMR; Forge injects `MAIN_WINDOW_VITE_DEV_SERVER_URL` globals. `AutoUnpackNativesPlugin` is wired now as a placeholder for node-pty's `.node` in Phase 2/8. |
| Language | TypeScript 6 (strict, isolatedModules, noImplicitAny) | Eliminates a class of cross-process IPC bugs; required for the branded-type identity invariant. |
| Module format | CJS for main + preload; ESM for renderer. NO `"type": "module"` in package.json | node-pty (Phase 2) is native CJS and must be `require()`-able; lowdb v7 (Phase 5) is ESM-only and will be loaded via dynamic `import()` in the CJS main process. Setting `type: module` would break node-pty. (RESEARCH Q8) |
| UI framework | React 19.2.7 | Largest Electron ecosystem; component model maps to the future sidebar + tab surface. Renderer is **blank** in Phase 1 (single version readout only). |
| Identity model | Branded `LogicalId = string & { __brand }`, minted only by `newLogicalId()` (uuid v4); `ptyPid?: number` is a separate plain field on `SessionRecord` | The "can never be violated" invariant (D-04, IDENT-01/02): a bare string or stringified PID is a compile-time error wherever a `LogicalId` is required. `newLogicalId()` is main-process-only (sandboxed preload cannot `require('uuid')`). |
| Renderer↔main bridge | `contextBridge.exposeInMainWorld('api', { getVersion })` ONLY | The single sanctioned seam (SC3). `webPreferences` = `{ contextIsolation:true, nodeIntegration:false, sandbox:true }` (D-07). ESLint `no-restricted-imports` bans `electron`/`ipcRenderer` under `src/renderer/**` (D-06). |
| Persistence | None this phase | Local-only lowdb arrives in Phase 5. No DB read/write in the skeleton (this is a scaffold phase per CONTEXT.md / ROADMAP SC1 "blank renderer"). |
| Test strategy | Vitest (unit/guard, node env) + WebdriverIO `@wdio/electron-service` v10 (boot smoke) | WDIO over Playwright because Playwright `_electron` has a documented Electron 36 launch failure in CI and remains "experimental" (D-09). Guard tests use pure functions (`buildWebPreferences`) so they need no Electron process (Pitfall 4). |
| Native module rebuild | `@electron/rebuild` as `electron-rebuild -f` postinstall (no `-w` flag) | Exits 0 cleanly with no native modules present in Phase 1 (SC4); becomes load-bearing once node-pty arrives in Phase 2. |
| Directory layout | `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/` + `tests/smoke/` | Subdirectory split (over the Forge flat default) so Phase 2+ can grow each process cleanly. `src/shared/` holds the cross-process type contract importable by both main and renderer without pulling Electron into the renderer bundle. |

## Stack Touched in Phase 1

- [x] Project scaffold (Electron Forge + Vite + TypeScript strict, ESLint flat config, Prettier, Vitest, WDIO) — Plan 01
- [x] Process split — main / preload / renderer all present and wired — Plan 03
- [x] Shared type contract — `SessionRecord`, branded `LogicalId`, `newLogicalId()`, `ElectronAPI` — Plan 02
- [x] One real renderer↔main interaction — `window.api.getVersion()` round-trip via contextBridge — Plan 03
- [x] Local full-stack run command — `npm start` boots the app; `npm run test:smoke` proves it boots clean (SC1)
- [ ] Database — intentionally NONE in Phase 1 (deferred to Phase 5)
- [ ] UI screens — intentionally NONE; renderer is blank (deferred to Phase 4)

## Out of Scope (Deferred to Later Slices)

These are explicitly NOT in the skeleton — this list prevents later phases from re-litigating Phase 1's minimalism:

- PTY spawning, node-pty install, xterm rendering, terminal fidelity, IPC data streaming → **Phase 2**
- Multi-session, ring-buffer replay, stop/restart, status state machine → **Phase 3**
- Sidebar UI, session creation form, rename/re-icon, keyboard switching → **Phase 4**
- lowdb persistence, shell discovery, sidebar order persistence → **Phase 5**
- Backpressure watermarks, spawn/cwd error handling, alt-screen reset, header controls → **Phase 6**
- Ctrl+F search, configurable scrollback → **Phase 7**
- ASAR-unpack for node-pty helpers, Forge makers, `@electron/rebuild`-in-CI, ConPTY version check, notarization → **Phase 8**
- Git hooks (Husky/lint-staged) and cross-platform CI → deferred, revisit at Phase 8 (D-08)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions (the Electron pin, the CJS-main/ESM-renderer split, the branded `LogicalId`, and the contextBridge-only boundary are contracts, not suggestions):

- **Phase 2:** A user interacts with a single real PTY-backed terminal (`claude --rc`, `vim`, `python` REPL) exactly like a native terminal — node-pty in main, xterm in renderer, PTY data streamed over new contextBridge channels.
- **Phase 3:** A user runs 3+ concurrent sessions; switching never kills a background process; stop/restart preserves `logicalId`.
- **Phase 4:** A user sees and edits session identity (name + icon + status) in a collapsible sidebar and switches sessions by keyboard.
- **Phase 5:** A user's session profiles + ordering survive app restart (lowdb), restored always as `not_started`; shells are discovered per platform.
- **Phase 6:** The app survives high-throughput output and spawn errors gracefully.
- **Phase 7:** A user searches scrollback (Ctrl+F) and configures buffer size.
- **Phase 8:** The app packages as runnable distributables for Windows and macOS.
