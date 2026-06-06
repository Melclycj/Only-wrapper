---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Phase 6 context gathered
last_updated: "2026-06-06T16:18:16.712Z"
last_activity: 2026-06-06
progress:
  total_phases: 9
  completed_phases: 6
  total_plans: 21
  completed_plans: 21
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03)

**Core value:** Real terminal fidelity — `claude --rc`, `codex`, `vim`, `ssh`, REPLs all behave exactly like a native terminal inside the wrapper.
**Current focus:** Phase 6 — robustness-+-flow-control-polish (Phase 05.1 complete)

## Current Position

Phase: 6
Plan: Not started
Status: Phase 05.1 (TERM-05) complete and verified — ready to start Phase 6
Last activity: 2026-06-06

Progress: [████████████████████] 100% (Phase 5.1 plans: 3/3)

## Performance Metrics

**Velocity:**

- Total plans completed: 22
- Average duration: — min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 02 | 4 | - | - |
| 03 | 3 | - | - |
| 04 | 4 | - | - |
| 05 | 4 | - | - |
| 05.1 | 3 | - | - |

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
| Phase 04 P04 | ~5min | 2 tasks | 4 files |
| Phase 05 P01 | 6min | 2 tasks | 17 files |
| Phase 05 P02 | ~9min | 3 tasks | 6 files |
| Phase 05 P03 | 16min | 3 tasks | 11 files |
| Phase 5 P4 | 11min | 3 tasks | 6 files |
| Phase 05.1 P01 | ~6min | 2 tasks | 4 files |
| Phase 05.1 P02 | 8 | 1 tasks | 1 files |
| Phase 05.1 P03 | ~20min | 3 tasks | 6 files |

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
- [Phase 04-04]: Sidebar collapse is a pinned chevron (data-testid=sidebar-collapse, aria-pressed) folding .sidebar to a ~52px icon-only rail via a .collapsed class; collapsed mode hides .row-name/.status-badge/.row-controls and reveals a per-row .collapsed-status-dot (shares the status-dot class so STATUS_STYLE.accent stays legible — NAV-01) + a custom .rail-tooltip (name + status, preferred over native title= per D-11). onContextMenu stays at the .sidebar-row level so the right-click menu is the collapsed control surface (Pitfall 5); .session-view/.viewport-stack visibility is untouched (keep-alive intact). collapsed state is component-local in SessionManager (persistence is Phase 5 — D-11). All three Phase-4 E2E smoke tests GREEN → 04-VALIDATION.md nyquist_compliant: true; NAV-01/NAV-02/SESS-03 satisfied
- [Phase 04-02]: Rule-1 fix — SessionEditModal reads its text fields from refs at save time; React 19's controlled-input value-tracker suppresses onChange when a fill sets `input.value` directly then dispatches 'input' (the E2E contract), so reading the live DOM at save makes the form robust to both real typing and automated fills. session-edit.smoke.test.ts is GREEN (live rename, same logicalId); keyboard-switch/sidebar-collapse stubs stay RED for Plans 03/04
- [Phase 05-01]: Four pure electron-free modules (store-schema coerceOnLoad, shell-discovery seam, window-bounds validateBounds, session-reorder dense reindex) + 18-key contextBridge lockstep define the Phase-5 contracts; interface-first wave, no user-visible behavior yet
- [Phase 05-01]: lowdb@7.0.1 exact-pinned (CLAUDE.md convention), marked external in vite.main.config.ts + kept with steno in forge.config.ts ignore allow-list (Pitfall 1 ESM-in-CJS + Pitfall 2 packaging); dynamic import() must be smoke-tested in the BUILT app at 05-02
- [Phase 05-01]: PtyManager.setOrder/setUiState accept unknown payloads and type-guard every field main-side before mutating (T-05-01); WindowsShellProvider stub returns resolved $SHELL so the dropdown is never empty cross-platform (D-05)
- [Phase 05-02]: lowdb CORE stays a true external `await import('lowdb')` (verified surviving in the built main.js) while `lowdb/node` is Rollup-chunked self-contained (node:fs/path only, no require('lowdb')) — the correct Pitfall 1 outcome, smoke-proven against the BUILT app (just-wrapper-store.json created + parseable)
- [Phase 05-02]: Restored sessions hydrate into a SEPARATE PtyManager.dormantRecords map (Pattern 4 option b — no live pty, preserves the every-PtySession-has-a-pty invariant); listSessions() merges live+dormant sorted by order; create({id}) promotes a dormant id (same logicalId, stored cwd/shell); new-session order = max(existing)+1 not sessions.size (Pitfall 6); dormant rows are reorderable/closable pre-Start (NAV-04)
- [Phase 05-02]: Store change-signal injected into PtyManager (setStoreSignal) so domain mutations stay store-agnostic; index.ts owns the snapshot push (syncStore = setSessions(listSessions)+setUi(getUiState)). whenReady: load→hydrate→setStoreSignal→createWindow(restore validateBounds before show, Pitfall 5); before-quit preventDefault→flush→app.quit re-entrancy guard gated on isDirty()+quitting flag (D-13, Pattern 3)
- [Phase 05-02]: Store path resolved via dynamic `await import('electron')` inside load() (not static import, not require — passes no-require-imports lint + keeps module Vitest-importable, Pitfall 3); corrupt OR non-array-sessions store → .corrupt-<ts> backup + fresh start, never throws (D-13/T-05-04); smoke reads main-process state via process.getBuiltinModule (packaged main is ESM, require undefined)
- [Phase ?]: Drag-to-reorder uses @dnd-kit/sortable (exact-pinned 6.3.1/10.0.0) with a PointerSensor activation distance so click-to-switch survives; reorder persists silently via the validated persistOrder IPC (D-13)
- [Phase 05.1-01]: ReadinessProbe seam (src/main/readiness-probe.ts) mirrors shell-discovery.ts — electron/node-pty-free, Vitest-importable; pure buildPosixProbe(nonce) builds a `: <nonce>\r` POSIX-`:`-no-op marker (D-01, changes no shell state) + a send-vs-match matcher (true only on a produced line after a newline, false on the bare echo — Pitfall 1). MacReadinessProbe covers zsh+bash with one `__JW_READY_<hex>__` crypto-nonce sentinel; WindowsReadinessProbe.forShell() THROWS (Phase-8 stub, no safe no-op readiness probe — unlike WindowsShellProvider); selectReadinessProbe(platform) picker
- [Phase 05.1-01]: Wave 0 probe-hook state-machine tests are RED-by-BEHAVIOR (the file imports cleanly; `READINESS_TIMEOUT_MS` is `undefined` until Plan 02/03) so pure-helper + SC5-hydrate stay GREEN — only the 2 tests that require the create() probe gate (withhold-probe-bytes D-02, inject-on-match-with-CR SC1) fail RED; D-04 notice reuses onPtyStatus (no new bridge key — security.guard.test.ts unchanged)
- [Phase ?]: 05.1-02: TERM-05 auto-run happy path — create() runs invisible readiness probe then injects cmd + CR on match; READINESS_TIMEOUT_MS deferred to Plan 03 (timeout test stays RED by design)
- [Phase 05.1-03]: Completed the probe state machine — READINESS_TIMEOUT_MS=4000ms timeout-flush-and-notice branch: on ready-timeout the buffer flushes to a usable bare prompt and the command is NEVER injected (safe-by-default, D-04/SC4). The D-04 ready-fail notice REUSES the existing onPtyStatus channel via optional PtyStatusPayload.notice — ZERO new bridge keys (EXPECTED_API_KEYS stays 18, security.guard GREEN unchanged; Open Q1 lighter path). Notice is a fixed literal (no startupCommand/nonce/buffer leak — V7). buildPosixProbe regex unchanged vs real cold zsh (Open Q3); defensive stripProbeEcho scrub guards D-02 nonce-absence. Real cold-spawn E2E GREEN (auto-run+history+nonce-absent+restart-rerun+bare-shell). VALIDATION nyquist_compliant:true
- [Phase 05.1-03 HUMAN-VERIFY]: Canonical 🛋️ Parlour Claude RC scenario APPROVED 2026-06-06 — all 4 CONFIRMs passed (clean auto-run no garble/visible-nonce, ArrowUp history recall, restart re-runs after separator, empty command → bare shell). 3 session edit/lifecycle UX items surfaced but are OUT OF SCOPE for TERM-05 (Phase 03/04 concerns) — captured as todos in .planning/todos/pending/ (edit-modal cwd/startup prefill, folder picker, ▶ Start discoverability)

### Pending Todos

None yet.

### Blockers/Concerns

- node-pty version for Electron 42.x needs verification before Phase 2 starts (see research/SUMMARY.md); consider starting on Electron 36.x if compatibility is unclear
- macOS notarization (Phase 8) requires Apple Developer Program membership (~$99/year); plan ahead

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260605-ki7 | Phase-4 sidebar UI polish: collapsed add-button shows only "+"; row controls become edit/delete (+conditional restart) icon buttons | 2026-06-05 | 0ea3d68 | [260605-ki7-phase-4-sidebar-ui-polish-collapsed-add-](./quick/260605-ki7-phase-4-sidebar-ui-polish-collapsed-add-/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-06T16:18:16.702Z
Stopped at: Phase 6 context gathered
Resume file: .planning/phases/06-robustness-flow-control-polish/06-CONTEXT.md
