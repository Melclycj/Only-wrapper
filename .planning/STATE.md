---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 04-03-PLAN.md
last_updated: "2026-06-05T14:10:00Z"
last_activity: 2026-06-05 -- Phase 04 Plan 03 (keyboard session-switch slice) complete
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 14
  completed_plans: 13
  percent: 93
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03)

**Core value:** Real terminal fidelity — `claude --rc`, `codex`, `vim`, `ssh`, REPLs all behave exactly like a native terminal inside the wrapper.
**Current focus:** Phase 04 — Session Identity + Sidebar UI

## Current Position

Phase: 04 (Session Identity + Sidebar UI) — EXECUTING
Plan: 4 of 4
Status: Executing Phase 04
Last activity: 2026-06-05 -- Phase 04 Plan 03 (keyboard session-switch slice) complete

Progress: [███████████████░░░░░] 75% (Phase 4 plans: 3/4)

## Performance Metrics

**Velocity:**

- Total plans completed: 11
- Average duration: — min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 02 | 4 | - | - |
| 03 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P02 | 175 | 2 tasks | 4 files |
| Phase 01 P03 | ~25min | 3 tasks | 9 files |
| Phase 02 P01 | 9min | 2 tasks | 11 files |
| Phase 02 P02 | ~13min | 3 tasks | 11 files |
| Phase 02 P03 | ~22min | 3 tasks | 9 files |
| Phase 02 P04 | ~12min | 3 tasks | 1 file |
| Phase 03 P01 | 56min | 3 tasks | 9 files |
| Phase 03 P02 | 13min | 3 tasks | 10 files |
| Phase 04 P01 | ~7min | 3 tasks | 19 files |
| Phase 04 P02 | ~10min | 3 tasks | 5 files |
| Phase 04 P03 | ~6min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Stack confirmed (roadmap): Electron + @xterm/xterm + node-pty + lowdb + Electron Forge
- Packaging smoke-test embedded in Phase 2 success criteria (not a separate phase); full packaging is Phase 8
- TERM-09 (waiting-for-input) assigned to Phase 6 as best-effort heuristic per research
- [Phase ?]: node-pty 1.1.0 is N-API; ABI-stable prebuild loads under Electron 36.9.5 without from-source recompile
- [Phase ?]: Pinned the 7 terminal-stack packages at exact versions (no caret) to prevent drift onto xterm-6 addons that removed addon-canvas
- [Phase 02-02]: Spawn $SHELL with login flag -l only (no -i) — PTY TTY makes the shell interactive automatically; avoids double-sourcing
- [Phase 02-02]: All renderer-supplied IPC args validated in main before reaching node-pty (clampDimension 1-1000, unknown-id ignore, string type-guard)
- [Phase 02-02]: Reviewed EXPECTED_API_KEYS expansion to 8 keys (getVersion + 7 PTY methods); security guard still asserts the exact surface
- [Phase 02-03]: Renderer reaches the PTY ONLY via window.api; TerminalPane = xterm 5.5 (scrollback 10000, allowProposedApi, unicode11 v11, WebGL+canvas fallback, fit before ptyCreate, 100ms-debounced resize→ptyResize)
- [Phase 02-03]: Forge+Vite packaging keeps node-pty through the plugin's node_modules pruning, unpacks its .node outside the ASAR, and skips the node-gyp rebuild (ship the N-API prebuild) — required for the packaged app to boot
- [Phase 02-03]: E2E resize driven via BrowserWindow.setSize (browser.electron.execute); CDP window-rect command is unavailable under @wdio/electron-service
- [Phase 02-04]: Flow control via the renderer xterm watermark (term.write drain callback + ptyPause/ptyResume, FLOW_HIGH=100000/FLOW_LOW=10000), NOT node-pty XON/XOFF handleFlowControl — keeps a 50MB cat responsive and lossless (SC5)
- [Phase 02-04]: macOS copy/paste — Cmd+C copies selection, Cmd+V/right-click paste always via term.paste() (bracketed paste, no multi-line auto-execute); Ctrl+C left as SIGINT; no copy-on-select (SC2, D-03)
- [Phase ?]: 03-01: listSessions source of truth lives in MAIN (Phase 5 lowdb is a drop-in)
- [Phase ?]: 03-01: restart orchestrated in main (stop then await exit then create-with-id); same logicalId, new ptyPid
- [Phase ?]: 03-01: dead sessions kept in the Map with alive:false (record retained, pty handle dropped)
- [Phase 03-02]: SessionManager is the SOLE ptyCreate spawn owner; SessionView is a controlled view bound to a prop id and never spawns (one PTY per add — T-03-09, proven by session-manager.spawn.test.ts)
- [Phase 03-02]: WebGL attached to the ACTIVE session only, disposed on deactivate (≤16-context cap); hidden panes keep their xterm + buffer with NO GPU context
- [Phase 03-02]: Hide panes via visibility:hidden / off-screen (NOT display:none — fit()/proposeDimensions() no-op on display:none); re-fit + ptyResize on activate
- [Phase 03-02]: addSession spawn path lives in a pure React/xterm-free module (session-add.ts) so the no-double-spawn invariant unit-tests in the Node env without jsdom
- [Phase 03-02]: E2E reads the active pane via window.__sessionTerms[id].buffer (WebGL/canvas active pane has no .xterm-rows); driver scopes pane reads to .session-view[...] / row clicks to .sidebar-row[...]
- [Phase 03-03 D-03a]: stop → DESTRUCTIVE Close (kill PTY + remove SessionRecord) behind a DESIGN.md confirm modal; the keep-as-stopped Stop BUTTON is removed but PtyManager.stop + window.api.ptyStop are RETAINED ("keep the function, disable the button") and stay unit-tested
- [Phase 03-03 D-03a]: ptyClose is the 13th bridge key (pty:close channel, mirrors ptyStop fire-and-forget); EXPECTED_API_KEYS + security.guard updated in lockstep to 13. Close removes the row so the reconcile poll (which only ADDS missing ids) never re-adds it
- [Phase 03-03 gap-closure]: PtyManager.send() guards webContents.send with w.isDestroyed()/webContents.isDestroyed(); win.on('closed') calls detachWindow() before disposeAll() so node-pty's final shutdown flush never crashes a destroyed window (TERM-06/08)
- [Phase 04-01]: matchSwitchKey (main-side, electron-free) uses ONE rule for both platforms — primary = meta||control (macOS Cmd OR Windows Ctrl); Cmd/Ctrl+1-9 → position, Cmd/Ctrl+Shift+]/[ → next/prev; Alt/no-primary/non-keyDown → null. A1-defensive: accepts logical `key` OR physical `code` (Digit1/BracketRight) so the NAV-05 E2E confirms real Electron strings in one line
- [Phase 04-01]: ptyUpdateProfile (14th) + onSwitchSession (15th) are the new bridge keys; EXPECTED_API_KEYS → 15; security.guard.test.ts went RED→GREEN with NO code change (dynamic Object.keys(exposed)===EXPECTED_API_KEYS assertion)
- [Phase 04-01]: PtyManager.updateProfile id-validates (unknown → no-op) + type-guards each string field; create() prefers a non-empty stored record.shell over resolveShell() (A2, Pitfall 3) so an edited shell takes effect on restart; startupCommand is carried on the record but NEVER written to a PTY — TERM-05 auto-run stays deferred (T-04-04, grep-verified)
- [Phase 04-01]: Interface-first wave — 5 React/xterm/electron-free pure modules (switch-keys/session-switch/icon-spec/session-edit/emoji-set) + the 2 bridge keys define the contracts Plans 04-02..04 build against; 3 E2E smoke stubs stay RED until those plans land (nyquist_compliant flips true in 04-04)
- [Phase 04-02]: renderIcon is now a single exported source in Sidebar.tsx (IconPicker + IdentityHeader import it); the color branch renders a badge with COLOR_INITIAL (D-09). The edit modal is a controlled EDIT form (D-04, D-01 quick-add unchanged); name/icon apply live via setSessions (NO new logicalId — SESS-04) AND mirror to main via ptyUpdateProfile so a restart/reconcile rebuild does not revert (Pitfall 4); cwd/shell/startup persist under an "Applies on restart" hint
- [Phase 04-03]: Keyboard switch chords are intercepted MAIN-side in createWindow via win.webContents.on('before-input-event') → matchSwitchKey → preventDefault() + send('session:switch') so the chord NEVER reaches xterm/PTY (D-13 app-wins, works in vim/tmux); NOT a Menu accelerator (Electron #19279) and NOT globalShortcut. SessionManager subscribes ONCE to onSwitchSession and applies resolveSwitch→setActiveId reading the live list via a sessionsRef (no per-render re-bind; mirrors onPtyStatus cleanup); switch reuses the click/TERM-06 non-destructive path
- [Phase 04-03 A1 RESOLVED]: matchSwitchKey needed NO change. Empirical Electron Input strings confirmed via the live interceptor: Cmd/Ctrl+2 → key '2'/code 'Digit2'; Cmd/Ctrl+Shift+] → key '}'/code 'BracketRight' (Shift mutates the LOGICAL key ] → }, so the code-fallback is what matches — vindicating the Plan-01 key-OR-code defensive matcher). E2E finding: WDIO CDP browser.keys does NOT reach before-input-event (zero events captured); pressSwitchChord now drives the native path via webContents.sendInputEvent — keyboard-switch.smoke.test.ts GREEN
- [Phase 04-02]: Rule-1 fix — SessionEditModal reads its text fields from refs at save time; React 19's controlled-input value-tracker suppresses onChange when a fill sets `input.value` directly then dispatches 'input' (the E2E contract), so reading the live DOM at save makes the form robust to both real typing and automated fills. session-edit.smoke.test.ts is GREEN (live rename, same logicalId); keyboard-switch/sidebar-collapse stubs stay RED for Plans 03/04

### Pending Todos

None yet.

### Blockers/Concerns

- node-pty version for Electron 42.x needs verification before Phase 2 starts (see research/SUMMARY.md); consider starting on Electron 36.x if compatibility is unclear
- macOS notarization (Phase 8) requires Apple Developer Program membership (~$99/year); plan ahead

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-05T14:10:00Z
Stopped at: Completed 04-03-PLAN.md
Resume file: None
