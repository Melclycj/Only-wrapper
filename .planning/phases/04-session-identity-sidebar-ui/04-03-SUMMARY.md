---
phase: 04-session-identity-sidebar-ui
plan: 03
subsystem: ui
tags: [electron, before-input-event, keyboard-switch, ipc, react, nav-05, app-wins, e2e, a1-proof]

# Dependency graph
requires:
  - phase: 04-session-identity-sidebar-ui
    plan: 01
    provides: "matchSwitchKey (pure, key-OR-code defensive) + KeyInput/SwitchIntent types; resolveSwitch reducer; onSwitchSession bridge key (15th) + the 'session:switch' main→renderer channel; keyboard-switch.smoke.test.ts RED stub + pressSwitchChord/readIdentityHeader driver helpers"
  - phase: 04-session-identity-sidebar-ui
    plan: 02
    provides: "SessionManager render tree (.terminal-area / .viewport-stack), IdentityHeader (reads the active record by activeId), Sidebar rows with .active class + data-session-id, onPtyStatus subscription-cleanup idiom"
provides:
  - "Main-side keyboard-switch interception: win.webContents.on('before-input-event') in createWindow → matchSwitchKey → event.preventDefault() + webContents.send('session:switch', intent) — the chord NEVER reaches xterm/PTY (D-13 app-wins)"
  - "SessionManager onSwitchSession subscription: subscribed ONCE (sessionsRef avoids per-render re-bind), applies resolveSwitch → setActiveId; reuses the click/TERM-06 non-destructive switch path"
  - "A1 RESOLVED + proven: matchSwitchKey unchanged; the keyboard-switch.smoke.test.ts E2E (NAV-05) is GREEN with empirical Electron Input strings confirmed"
  - "E2E driver fix: pressSwitchChord drives webContents.sendInputEvent (native path) — CDP browser.keys does NOT reach before-input-event"
affects: [04-04-sidebar-collapse, 05-persistence, 06-session-controls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App-wins keyboard interception: switch chords resolved MAIN-side via before-input-event + preventDefault before the renderer/xterm/PTY ever sees them (the only mechanism that holds for Windows Ctrl combos; NOT a Menu accelerator — Electron #19279 — and NOT globalShortcut)"
    - "Subscribe-once + ref-read: the onSwitchSession effect binds with empty deps and reads the live sessions list through sessionsRef inside the functional setActiveId update, so the callback is stable yet never stale (mirrors the onPtyStatus cleanup discipline; no listener leak, no chord/teardown race)"
    - "Native-path E2E key injection: WDIO CDP browser.keys injects at the DOM level and never traverses before-input-event; webContents.sendInputEvent is the reliable driver for main-side keyboard interception tests"

key-files:
  created: []
  modified:
    - src/main/index.ts
    - src/renderer/SessionManager.tsx
    - tests/smoke/helpers/xterm-driver.ts

key-decisions:
  - "Switch chords intercepted in MAIN via win.webContents.on('before-input-event') inside createWindow → matchSwitchKey → preventDefault() + send('session:switch'); preventDefault stops the chord reaching xterm/PTY even inside vim/tmux/fzf (D-13). Non-matches return null and fall through untouched (T-04-07)"
  - "NOT a Menu accelerator (preventDefault in before-input-event suppresses menu accelerators — Electron #19279) and NOT globalShortcut (system-wide, silent-fail, macOS-layout bug) — RESEARCH anti-patterns, grep-verified absent"
  - "SessionManager subscribes to onSwitchSession ONCE (empty deps) and reads the current sessions via sessionsRef inside setActiveId's functional update — stable callback, no per-render re-bind, no stale closure, returns the unsubscribe fn (no listener leak)"
  - "A1 RESOLVED with NO matcher change: confirmed real Electron Input — Cmd/Ctrl+2 → key '2'/code 'Digit2'; Cmd/Ctrl+Shift+] → key '}'/code 'BracketRight' (Shift mutates the LOGICAL key ] → }, so matchSwitchKey's code-fallback BracketRight is what matches — vindicating Plan 01's key-OR-code defensive matcher)"
  - "E2E driver: pressSwitchChord rewritten to use browser.electron.execute → webContents.sendInputEvent (native path) because WDIO CDP browser.keys injects at the page/DOM level and NEVER reaches before-input-event (verified: the interceptor captured zero events for browser.keys([Meta,'2']))"

requirements-completed: [NAV-05]

# Metrics
duration: ~6min
completed: 2026-06-05
---

# Phase 4 Plan 03: Keyboard Session-Switch Slice Summary

**The keyboard session-switching vertical slice end-to-end: the NAV-05 chords (Cmd/Ctrl+1-9 positions, Cmd/Ctrl+Shift+]/[ next/prev) are intercepted in the MAIN process via `before-input-event`, resolved by the Plan-01 pure `matchSwitchKey`, `preventDefault()`-ed so they NEVER reach the focused terminal (D-13 app-wins — works inside vim/tmux), forwarded over the `onSwitchSession` bridge, and applied in SessionManager with `resolveSwitch → setActiveId` reusing the non-destructive click switch path. The A1 assumption is RESOLVED and proven GREEN: the matcher needed no change; only the E2E driver had to switch from CDP `browser.keys` to native `webContents.sendInputEvent`.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 2
- **Files modified:** 3 (0 created, 3 modified)

## Accomplishments
- **Main-side interception (D-13, T-04-07):** `win.webContents.on('before-input-event', ...)` added in `createWindow` alongside `win.on('closed', ...)`. On a `matchSwitchKey` hit it calls `event.preventDefault()` (the chord is consumed before xterm/PTY — app wins even with vim/tmux focused) and `win.webContents.send('session:switch', intent)`. Non-matches return `null` and pass through untouched, so legitimate keys are never swallowed.
- **No anti-patterns:** no Menu accelerator (would be suppressed by the same `preventDefault` — Electron #19279) and no `globalShortcut` (grep-verified absent in `src/main/index.ts`).
- **Renderer apply (NAV-05):** SessionManager subscribes ONCE to `window.api.onSwitchSession`, reads the live sessions list through a `sessionsRef` inside the functional `setActiveId` update, and applies the pure `resolveSwitch`. The switch reuses the existing click/TERM-06 path — the SessionView activate effect hands WebGL+focus to the new pane, the previously active session keeps running (NAV-03 non-destructive), and IdentityHeader updates because it reads the active record by `activeId`. D-14 honored: SWITCH intents only — no new/close bindings added.
- **A1 RESOLVED (the plan's de-risk goal):** `matchSwitchKey` unchanged. Empirical Electron `Input` strings confirmed via a live capture hook on the interceptor: `Cmd/Ctrl+2 → {key:'2', code:'Digit2', meta:true}`; `Cmd/Ctrl+Shift+] → {key:'}', code:'BracketRight', meta:true, shift:true}`. Holding Shift mutates the LOGICAL key (`]` → `}`, `[` → `{`), so the matcher's `code`-fallback (`BracketRight`/`BracketLeft`) is exactly what matches — vindicating Plan 01's `key`-OR-`code` defensive design.
- **NAV-05 E2E GREEN:** `keyboard-switch.smoke.test.ts` passes against the freshly-packaged app — `Cmd/Ctrl+2` switches the active `data-session-id` to the 2nd row and changes the identity-header text.

## Task Commits

1. **Task 1: Main before-input-event interception (D-13, app-wins)** — `506b72b` (feat)
2. **Task 2: SessionManager onSwitchSession subscription + apply resolveSwitch + A1 E2E driver fix** — `aee19d6` (feat)

## Files Created/Modified
- `src/main/index.ts` (modified) — imported `matchSwitchKey` + `KeyInput` from `./switch-keys`; added the `before-input-event` interceptor in `createWindow` (matchSwitchKey → preventDefault + send('session:switch'))
- `src/renderer/SessionManager.tsx` (modified) — imported `resolveSwitch`; added a `sessionsRef` (live mirror) and a subscribe-once `onSwitchSession` effect applying `resolveSwitch → setActiveId`
- `tests/smoke/helpers/xterm-driver.ts` (modified) — rewrote `pressSwitchChord` to drive the native `webContents.sendInputEvent` path (the A1 fix); documented the empirical Electron Input strings inline

## Decisions Made
See key-decisions frontmatter. Most load-bearing: (1) interception is MAIN-side (`before-input-event` + `preventDefault`), never a Menu accelerator or `globalShortcut`; (2) the renderer subscription binds ONCE and reads `sessionsRef` to stay stable-yet-fresh; (3) A1 resolved with no matcher change — the Shift-mutated bracket `key` is handled by the existing `code`-fallback; (4) the E2E driver must use native `sendInputEvent`, because CDP `browser.keys` does not reach `before-input-event`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] keyboard-switch E2E driver could not reach the main-process interceptor**
- **Found during:** Task 2 (running `keyboard-switch.smoke.test.ts`)
- **Issue:** The Wave-0 `pressSwitchChord` helper drove the chord via WDIO's CDP-backed `browser.keys([Meta,'2'])`. A capture hook installed on the live `before-input-event` recorded ZERO events for that path — CDP injects synthetic key events at the page/DOM level, which do NOT traverse Electron's native `before-input-event` pipeline. So the chord never reached the (correct) main-side interceptor and the E2E failed RED. This is the empirical answer the plan's A1 assumption asked the E2E to surface.
- **Fix:** Rewrote `pressSwitchChord` to drive `browser.electron.execute` → `win.webContents.sendInputEvent({type:'keyDown', keyCode, modifiers})` (the native path), which DOES reach `before-input-event`. The matcher and production interceptor were already correct and needed no change; the diagnostic also confirmed the real Electron Input strings (Digit2 / BracketRight with Shift-mutated logical key) handled by the existing `key`-OR-`code` matcher.
- **Files modified:** `tests/smoke/helpers/xterm-driver.ts`
- **Commit:** `aee19d6`

No other deviations — Task 1 executed exactly as written.

## Threat Flags
None — no new network endpoints, auth paths, file-access patterns, or schema changes. The two enumerated boundaries (OS keyboard → main `before-input-event`; main → renderer `session:switch`) are both covered by the plan's threat register: only exact chords are acted on (`matchSwitchKey` returns null otherwise, `preventDefault` only on a match — T-04-07); the intent originates ONLY from main's pure matcher (T-04-08); `onSwitchSession` is the reviewed 15th bridge key with no raw `ipcRenderer` (T-04-09). Phase 4 installs zero packages.

## Known Stubs
The `sidebar-collapse.smoke.test.ts` stub remains INTENTIONALLY RED — it drives the not-yet-built collapse toggle/icon-only rail (Plan 04-04). It is not a regression from this plan. `nyquist_compliant` stays `false` until Plan 04-04 closes the last Wave-0 gap. This plan's own E2E target — `keyboard-switch.smoke.test.ts` — is GREEN.

## User Setup Required
None — no external service configuration. Phase 4 installs zero packages.

## Next Phase Readiness
- Plan 04-04 (collapse) is the only remaining Phase-4 plan: it adds the chevron toggle + icon-only rail + status dot + tooltip, completes SESS-03 (icon visible when collapsed), and flips `nyquist_compliant: true`. The SessionManager render tree, the keyboard-switch slice, and the live edit/identity slice are all stable; the row-level `onContextMenu` is already collapse-safe.

## Self-Check: PASSED

`src/main/index.ts`, `src/renderer/SessionManager.tsx`, `tests/smoke/helpers/xterm-driver.ts` all present with the changes on disk; both task commits (`506b72b`, `aee19d6`) are in git history. `npx tsc --noEmit` clean, `eslint` clean on changed files, unit suite 16 files / 82 tests GREEN, `keyboard-switch.smoke.test.ts` GREEN (NAV-05 / A1 proof), `session-edit.smoke.test.ts` GREEN (no regression).

---
*Phase: 04-session-identity-sidebar-ui*
*Completed: 2026-06-05*
