---
phase: 03-multi-session-session-lifecycle
plan: 02
subsystem: renderer-multi-session
tags: [xterm, webgl, react, contextbridge, multi-session, status-badge, vitest, wdio]

# Dependency graph
requires:
  - phase: 03-multi-session-session-lifecycle
    plan: 01
    provides: "12-key bridge CONTRACT (ptyStop/ptyRestart/onPtyStatus/listSessions + PtyStatusPayload), PtyManager status machine + listSessions(), pty:status/stop/restart/list channels, Wave 0 RED E2E scaffolds + N-pane xterm-driver helpers"
provides:
  - "Wired 4 preload runtime methods (ptyStop/ptyRestart/onPtyStatus/listSessions) — security.guard.test.ts GREEN at the 12-key surface, no raw ipcRenderer"
  - "SessionView: controlled per-session xterm kept alive (buffers while hidden — SC1/SC2), WebGL-on-active-only (attachWebgl/detachWebgl, ≤16-context cap), hidden-pane-safe proposeDimensions-guarded fit, restart-separator seam (hasRunBefore + onPtyStatus)"
  - "SessionManager: sole ptyCreate spawn owner (exactly one PTY per add), listSessions boot hydration, per-session onPtyStatus live badges, viewport stack of all kept-mounted views, switch wiring"
  - "Sidebar: basic DESIGN.md session list (icon switch over emoji|preset|color, name, STATUS_STYLE badge), data-session-id rows, add-session button"
  - "status-colors.ts STATUS_STYLE: 5-state → DESIGN.md oklch accents incl. derived red error ramp"
  - "session-add.ts: pure React/xterm-free addSession spawn path (node-unit-testable)"
affects: [03-03-lifecycle-controls, 04-session-identity-sidebar-ui, 05-persistence]

# Tech tracking
tech-stack:
  added: []  # no new packages — used installed @xterm/* + react; scope/package audit unchanged
  patterns:
    - "Controlled view: SessionView receives a resolved id + binds to an already-spawned PTY; NEVER spawns (spawn ownership decoupled from rendering — T-03-09)"
    - "WebGL-on-active hand-off via attach/detach driven by an `active`-prop effect, separate from the mount effect keyed on id (toggling active never tears down the term)"
    - "visibility:hidden / off-screen hiding (NOT display:none) so fit()/proposeDimensions() stay measurable while hidden"
    - "Pure spawn-path module (session-add.ts) free of React/xterm imports so the no-double-spawn invariant unit-tests in the Node/Vitest env without jsdom"
    - "Renderer-agnostic E2E buffer read: per-id window.__sessionTerms handle read via term.buffer (the active WebGL pane has no .xterm-rows)"

key-files:
  created:
    - src/renderer/status-colors.ts
    - src/renderer/SessionView.tsx
    - src/renderer/SessionManager.tsx
    - src/renderer/Sidebar.tsx
    - src/renderer/session-add.ts
    - src/renderer/__tests__/session-manager.spawn.test.ts
  modified:
    - src/preload/index.ts
    - src/renderer/index.tsx
    - src/renderer/terminal.css
    - tests/smoke/helpers/xterm-driver.ts

key-decisions:
  - "addSession extracted into a pure React/xterm-free module (session-add.ts) so the no-double-spawn invariant is unit-testable in the Node env — no jsdom/testing-library added (scope/package fence). The component-render test the plan described is infeasible without a DOM env; testing the SOLE spawn path directly proves the same invariant at its source."
  - "Exposed per-session window.__sessionTerms[id] for the E2E driver because the active pane's WebGL/canvas renderer leaves .xterm-rows empty — reading term.buffer is renderer-agnostic and mirrors the sanctioned single-pane window.__term fallback."
  - "Disambiguated the shared data-session-id in the xterm-driver: pane reads scope to .session-view[...], sidebar-row clicks to .sidebar-row[...] (both the terminal pane and the sidebar row carry the same id — a bare attribute selector returned the wrong element)."
  - "startup-command E2E left RED — it is 03-03 scope (the directly-created PTY needs a SessionManager-rendered pane; the create-with-startup-command UI path lands in 03-03). The plan's verify list requires only multi-session-keepalive."

requirements-completed: [TERM-05, TERM-06, TERM-07, TERM-08]

# Metrics
duration: 13min
completed: 2026-06-04
---

# Phase 3 Plan 02: Multi-Session Renderer Vertical Slice Summary

**Wired the 4 lifecycle preload methods (security guard GREEN), refactored the single full-window TerminalPane into a controlled per-session SessionView (one xterm kept alive per session, WebGL handed to the active view only, hidden panes buffer correctly), and built the SessionManager + basic DESIGN.md Sidebar + status-colors so the app boots into a multi-session IDE layout where 3+ sessions run concurrently, switch with no process death and current scrollback, add new sessions, and show live status badges — proven by the multi-session-keepalive E2E.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-06-04T11:45:50Z
- **Completed:** 2026-06-04T11:59:15Z
- **Tasks:** 3/3 completed
- **Files modified/created:** 10 (6 created, 4 modified)

## Accomplishments

### Task 1 — Wire the 4 preload bridge methods, security guard GREEN (commit `ea7f972`)
- `src/preload/index.ts`: restored the full `ElectronAPI` annotation and added the 4 runtime methods mirroring the existing PTY patterns — `ptyStop` (fire-and-forget `pty:stop` send, mirrors `ptyPause`), `ptyRestart`/`listSessions` (`pty:restart`/`pty:list` invoke, mirror `ptyCreate`), and `onPtyStatus` (a verbatim structural copy of `onPtyData`'s id-filtered subscribe-returns-unsubscribe, payload shape swapped to `PtyStatusPayload`).
- `security.guard.test.ts` now GREEN (was the intended-RED 12-vs-8 surface failure from 03-01); the exposed surface equals the 12-key `EXPECTED_API_KEYS` and never leaks raw `ipcRenderer` (T-03-06 mitigated). `removeListener` count = 3 (onPtyData/onPtyExit/onPtyStatus).

### Task 2 — status-colors + SessionView (commit `17664cc`)
- `status-colors.ts`: `STATUS_STYLE` maps all 5 `SessionStatus` to DESIGN.md §"Status system" oklch accents — running blue `oklch(0.62 0.14 248)`, exited green `oklch(0.60 0.13 150)`, stopped/not_started slate `oklch(0.64 0.02 260)`, and the DERIVED red error ramp `oklch(0.58 0.16 25)` (D-04).
- `SessionView.tsx`: extracted TerminalPane's body into a CONTROLLED per-session component (`{ id, active }`). It binds onPtyData/onPtyExit/onPtyStatus + ptyWrite/ptyResize to the prop `id` and NEVER spawns (`grep ptyCreate` = 0 — T-03-09). The WebGL block moved into `attachWebgl`/`detachWebgl` driven by an `active`-prop effect (active pane only; `webgl.dispose()` on deactivate — ≤16-context cap, T-03-07). `fit()` is guarded by `proposeDimensions()` and re-fit + `ptyResize` + focus on activate (Pattern 8). `term.write` runs unconditionally so hidden sessions keep buffering (SC1/SC2). Status subscription writes the dim `— restarted HH:MM —` separator into the SAME instance on a non-first `running` status (D-03 restart seam for 03-03), tracked by a `hasRunBefore` ref.
- `terminal.css`: IDE layout (`.ide-layout`/`.sidebar`/`.viewport-stack` from DESIGN.md tokens — Nunito, --surface/--line, rounded rows) + the hidden-pane rule using `visibility:hidden` (NOT display:none).

### Task 3 — SessionManager + Sidebar + mount (commit `cc9643a`)
- `SessionManager.tsx`: owns `sessions[]` + `activeId`; the SOLE `ptyCreate` spawn owner (one spawn per add). Boots via `listSessions()` (main is source of truth), auto-adds one default session if empty so the app boots live. Per-session `onPtyStatus` subscriptions push every transition into state (live badges — TERM-08/SC4). Renders `<Sidebar>` + a `.viewport-stack` keeping ALL `<SessionView>`s mounted; `onSelect` sets activeId (renderer-only switch — the PTY is untouched, TERM-06).
- `session-add.ts`: the pure `addSession(existingCount, spawn)` helper (no React/xterm imports) — `cwd: undefined` (main resolves home), default name `Session N`, default icon `🖥️`, status `running`.
- `session-manager.spawn.test.ts`: drives `addSession` 3× with a `ptyCreate` spy → exactly 3 spawns, 3 distinct ids, `Session N` names, running status, cwd undefined. Directly proves the no-double-spawn invariant (T-03-09 / the Warning fix).
- `Sidebar.tsx`: basic DESIGN.md rows — `renderIcon` switches over all 3 `SessionIconSpec` kinds (emoji|preset|color), name, `.status-badge` colored from `STATUS_STYLE`; rows carry `data-session-id`, the add button carries `data-testid="add-session"`.
- `index.tsx`: mounts `<SessionManager/>` (TerminalPane.tsx kept as the extraction source, no longer mounted).

## Seams 03-03 will consume

- **stop/restart control hooks:** the preload `ptyStop(id)` / `ptyRestart(id)` are wired and typed; 03-03 adds the sidebar controls that call them. SessionView already reacts to the resulting `pty:status` transitions (badge + separator).
- **restart-separator hook:** SessionView's `onPtyStatus` handler writes `— restarted HH:MM —` into the same instance on a non-first `running` status (`hasRunBefore` ref) — 03-03's restart just needs to trigger a fresh `running`.
- **startup-command prop path:** `PtyCreateOptions.startupCommand?` is on the contract; SessionManager's `addSession` calls `ptyCreate` with `cwd: undefined` and is the single place 03-03 threads a `startupCommand` through. The directly-created startup-command E2E session also needs a SessionManager-rendered pane (03-03).
- **listSessions hydration:** SessionManager boots from `listSessions()`; 03-03/05 can extend the snapshot shape without changing the boot path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Spawn invariant test targets a pure helper, not a rendered component**
- **Found during:** Task 3.
- **Issue:** The plan described a React-testing unit test that renders `<SessionManager/>` and invokes onAdd 3×. The Vitest env is `node` (vitest.config.ts) with no jsdom/testing-library installed, and the phase scope/package audit forbids adding test packages. Importing SessionManager.tsx into a node test transitively loads `@xterm/addon-fit`, which references the browser-only `self` global at module load → `ReferenceError: self is not defined`.
- **Fix:** Extracted the SOLE spawn path into `session-add.ts` (a React/xterm-free module). The spawn test imports `addSession` from there and drives it 3× with a `ptyCreate` spy — proving exactly-one-spawn-per-add at the invariant's source, in the node env, with zero new deps. SessionManager imports the same helper, so production and test share one code path.
- **Files modified:** src/renderer/session-add.ts (new), src/renderer/SessionManager.tsx, src/renderer/__tests__/session-manager.spawn.test.ts
- **Commit:** `cc9643a`

**2. [Rule 1 - Bug] xterm-driver could not address the right element for a shared data-session-id**
- **Found during:** Task 3 (running multi-session-keepalive).
- **Issue:** Both the terminal pane (`.session-view`) and the sidebar row (`.sidebar-row`) carry the same `data-session-id`. The Wave-1 N-pane driver used a bare `[data-session-id="<id>"]` selector for BOTH `readBufferOf`/`sendKeysTo` (need the pane with `.xterm-rows`/textarea inside) and `clickSidebarRow` (needs the row) — `querySelector` returned whichever was first in DOM order (the sidebar row), so the pane reads found no terminal and returned "".
- **Fix:** Scoped the driver — pane helpers query `.session-view[data-session-id="<id>"]`, the row helper queries `.sidebar-row[data-session-id="<id>"]`. Realizing the DOM contract the Wave-1 driver was written against.
- **Files modified:** tests/smoke/helpers/xterm-driver.ts
- **Commit:** `cc9643a`

**3. [Rule 1 - Bug] Active (WebGL) pane has no .xterm-rows → driver buffer read returned empty**
- **Found during:** Task 3 (multi-session-keepalive — non-empty id resolved but TICK not found).
- **Issue:** WebGL-on-active (the required T-03-07 behavior) renders the active pane to a canvas, leaving `.xterm-rows` empty. The driver's DOM-row read therefore returned "" for exactly the session the test switches to.
- **Fix:** SessionView exposes each session's xterm at `window.__sessionTerms[id]` (cleaned up on unmount); `readBufferOf` falls back to reading `term.buffer` (renderer-agnostic) when `.xterm-rows` is empty — mirroring the sanctioned single-pane `window.__term.buffer` fallback. multi-session-keepalive then GREEN.
- **Files modified:** src/renderer/SessionView.tsx, tests/smoke/helpers/xterm-driver.ts
- **Commit:** `cc9643a`

## Intentional RED state (expected, not a failure — deferred to 03-03)

- `tests/smoke/startup-command.smoke.test.ts` remains RED. The test creates a PTY DIRECTLY via `window.api.ptyCreate({ startupCommand })` (bypassing SessionManager), so no SessionView renders that session and `readBufferOf(id)` finds no pane. Main DOES inject the command (`[pty] startup command injected` logged) — the gap is purely renderer-side rendering of a directly-created session, which is 03-03 scope (the phase context states "startup E2E land in 03-03"). This plan's verify list requires only `multi-session-keepalive`, which is GREEN.

## Known Stubs

None. The sidebar renders real session state; SessionViews stream real PTY output; status badges are driven by live `pty:status` events. The startup-command RED is a scaffold awaiting 03-03 (documented above), not a product stub.

## Verification

- `npm run test:unit` → 46 passed / 0 failed (was 42/1 in 03-01 — the intended-RED security.guard is now GREEN, plus 3 new spawn tests). `session-manager.spawn` GREEN, `security.guard` GREEN.
- `npx tsc --noEmit` → 0 errors. `npm run lint` → 0 errors.
- `npm run test:smoke` → 5 spec files passed (boot, multi-session-keepalive, pty-resize, pty-roundtrip, pty-throughput), 1 failed (startup-command — deferred to 03-03, above).
- **`multi-session-keepalive` E2E GREEN** — 3 sessions open, the background TICK loop in A keeps advancing while B is active, switch-back shows the current buffer (SC1 keep-alive + SC2 current scrollback, no blank/frozen frame).
- Acceptance greps: `ptyCreate` in SessionView = 0 / in SessionManager ≥ 1; `oklch(0.58 0.16 25)` present; `data-session-id` + `data-testid="add-session"` present; icon switch covers emoji|preset|color; no `display:none` on session-view; `visibility:hidden` present; `removeListener` = 3.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries beyond the reviewed 12-key bridge (T-03-06 mitigated by the GREEN security guard) and the spawn-ownership invariant (T-03-09 mitigated by session-manager.spawn.test.ts). WebGL-context exhaustion (T-03-07) mitigated by active-only WebGL with dispose-on-deactivate.

## Self-Check: PASSED

- FOUND: src/renderer/status-colors.ts
- FOUND: src/renderer/SessionView.tsx
- FOUND: src/renderer/SessionManager.tsx
- FOUND: src/renderer/Sidebar.tsx
- FOUND: src/renderer/session-add.ts
- FOUND: src/renderer/__tests__/session-manager.spawn.test.ts
- Commits FOUND: `ea7f972`, `17664cc`, `cc9643a`
