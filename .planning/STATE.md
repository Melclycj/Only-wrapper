---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 08-03-PLAN.md (Task 2 human-verify APPROVED; nyquist_compliant flipped true)
last_updated: "2026-06-10T00:48:43.365Z"
last_activity: 2026-06-10
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 37
  completed_plans: 36
  percent: 90
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03)

**Core value:** Real terminal fidelity — `claude --rc`, `codex`, `vim`, `ssh`, REPLs all behave exactly like a native terminal inside the wrapper.
**Current focus:** Phase 8 — cross-platform-packaging

## Current Position

Phase: 8
Plan: Not started
Status: 08-03 COMPLETE — Task 1 CI matrix (b85b434/015fb0d) + Task 2 canonical claude --rc human-verify APPROVED 2026-06-10 (SC2 LIVE-CONFIRMED on macOS); nyquist_compliant flipped true in 08-VALIDATION.md
Last activity: 2026-06-10

Progress: [████████████████░░░░] 80% (8/10 phases complete, 36/37 plans)

## Performance Metrics

**Velocity:**

- Total plans completed: 34
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
| 06.1 | 4 | - | - |
| 07 | 5 | - | - |
| 8 | 3 | - | - |

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
| Phase 06 P01 | ~12min | 3 tasks | 16 files |
| Phase 06 P02 | ~18min | 2 tasks | 12 files |
| Phase 06 P03 | ~20min | 3 tasks | 5 files |
| Phase 06.1 P01 | ~30min | 3 tasks | 9 files |
| Phase 06.1 P02 | 85 | 2 tasks | 3 files |
| Phase 06.1 P03 | ~12min | 2 tasks | 3 files |
| Phase 06.1 P04 | ~38min | 2 of 3 tasks (human-verify pending) | 9 files |
| Phase 06.1 P04 gap-closure r1 | ~75min | 5 fixes (FIX1/3/4a/4b + stale-exit guard) | 3 new modules + 3 new tests + 8 modified |
| Phase 07 P01 | ~18min | 3 tasks | 12 files |
| Phase 07 P02 | ~14min | 3 tasks | 4 files |
| Phase 07 P03 | ~16min | 3 tasks | 7 files |
| Phase 08 P01 | ~7min | 3 tasks | 12 files |
| Phase 08 P02 | 12min | 2 tasks | 4 files |
| Phase 08 P03 | ~10min + human-verify | 2 tasks | 3 files |

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
- [Phase 06-01]: Interface-first foundation wave — pure shared/agent-state.ts classifier (AgentState overlay, NOT a 6th SessionStatus — D-06; IDLE_MS=800 D-08; conservative anchored PROMPT_RE: trailing ?, [y/n] variants, (y/n)/(yes/no), ❯ — naked $/% and trailing ':' are FREE not WAITING; ReDoS-safe linear+anchored V7/T-06-03), the {kind:'clear'} matchClearKey riding the EXISTING session:switch channel (Cmd+K mac / Ctrl+Shift+K win; plain Ctrl+K → null to keep readline kill-line — D-13), and the 19-key pickDirectory bridge lockstep define the Phase-6 contracts Plans 02/03/04 build against. pickDirectory is the ONLY new bridge key (the Clear chord adds none)
- [Phase 06.1-01]: Wave-0 interface-first foundation SUPERSEDING 06-01's classifier. agent-state.ts rewritten to the spike-validated frame-stability classify(lines: string[]): AgentState (D-09/D-10) — output-silence IDLE_MS/PROMPT_RE/classifyIdle DELETED, standalone ❯ caret DROPPED from the waiting decision (002 kill-finding: it false-fired 10/11 settles as Claude's ambient input caret; survives only as a non-decisive numbered-menu prefix, encoded ❯ so the literal glyph is absent). Exports TICK_MS=100/SETTLE_MS=500 (Nyquist tick ≤250ms, settle 400–600ms). New agent-state-replay.test.ts is the offline @xterm/headless@5.5.0 oracle reproducing the spike ground truth "11 settles → exactly 1 WAITING" (the capture is a FORENSIC log with no raw PTY bytes, so the oracle reconstructs each settle frame from recorded last+sig and runs it through headless + classify(), deterministic via the write callback). SessionRecord gains one-way configured?:boolean (D-02 ephemeral-vs-configured gate); SCHEMA_VERSION 1→2 with coerceOnLoad absent→true migration. Three honest-RED pty-lifecycle scaffolds pin the Plan-03 D-05/D-02 transitions (configured self-exit→Inactive not_started, ephemeral→gone, listConfiguredSessions()). TEMPORARY SessionView.tsx IDLE_MS/classifyIdle bridge (Rule 3) delegates to classify() so tsc stays clean until Plan 02 rewrites SEAM A. window-config.ts (19 keys) + status-colors.ts (D-14) untouched.
- [Phase 06-01]: Folded the 05.1 review fixes — WR-02: readiness matcher (buildPosixProbe re) now fires ONLY when the nonce appears AFTER a newline boundary (a produced line, never the bare echo line: `\n[^\n]*<nonce>`); WR-03: matches() bounds the scan to the last 8 KB tail before testing; IN-02: Phase-8 per-shell comment on void shellPath; IN-03: startup-command smoke restart assertion anchored on the full '— restarted ' separator literal (not a bare indexOf). 3 Wave 0 RED scaffolds (pty-spawn-error describe.todo → Plan 02; alt-screen-reset + header-controls describe.skip → Plan 04) resolve cleanly. TerminalPane.tsx deleted (D-16, no live import; tsc + electron-forge package GREEN). npm test 171 GREEN
- [Phase 05.1-03 HUMAN-VERIFY]: Canonical 🛋️ Parlour Claude RC scenario APPROVED 2026-06-06 — all 4 CONFIRMs passed (clean auto-run no garble/visible-nonce, ArrowUp history recall, restart re-runs after separator, empty command → bare shell). 3 session edit/lifecycle UX items surfaced but are OUT OF SCOPE for TERM-05 (Phase 03/04 concerns) — captured as todos in .planning/todos/pending/ (edit-modal cwd/startup prefill, folder picker, ▶ Start discoverability)
- [Phase ?]: [Phase 06-02]: SC2 spawn-error vertical slice — create() pre-validates the RESOLVED cwd with isValidCwd verbatim (D-01); an explicit-but-missing cwd (opts OR stored record) errors 'Working directory not found: <path>' and NEVER silently spawns in ~ (D-02), node-pty untouched. try/catch covers the rare sync EACCES; the async fork-then-die abnormal exit (Pitfall 1, macOS) gets a generic 'shell exited immediately' notice (D-05). notice sanitized of control chars (WR-04); updateProfile trims startupCommand at persist (WR-05); dead stripProbeEcho/scrub removed (WR-01/IN-01). Renderer: IdleCard error branch (specific msg + Edit/Retry, error-card-edit/retry testids), per-row errorMessage from the notice (renderer-only SessionRow, no bridge change — Open Q2), error sessions render the IdleCard not a SessionView, failed spawn (pid -1) skips the optimistic running flip, handleStartNoCmd threads skipStartupCommand (D-14, no new key), Browse… → pickDirectory, edit-prefill via listSessions re-read after add/save (Open Q3). 181 unit tests GREEN, tsc clean, package builds

- [Phase 06-03]: SC4/TERM-09 agent-state presentation OVERLAY — AGENT_STYLE ramp + presentation(status, agent?) resolver applies the overlay ONLY when status==='running' (D-06/D-07); amber oklch(0.66 0.15 60) reserved for 'waiting' in EXACTLY one place. Renderer-side idle-timer detector in SessionView off the EXISTING onPtyData stream (zero IPC): bounded ~4 KB rolling tail (slice(-4096), T-06-09 ReDoS bound), single-slot timer cleared-before-re-arm AND in effect cleanup (Pitfall 6/T-06-10), gated on running (agentRunning flipped by the status handler), change-only emission via onAgentStateRef (so the id-keyed mount effect never re-binds/tears down the xterm). SessionManager: renderer-only per-row agentState beside errorMessage (never persisted, never IPC — D-06), set only while running, cleared on transition away (D-10). Sidebar row badge/dot + collapsed-rail dot + tooltip and IdentityHeader badge all route through presentation() — no direct STATUS_STYLE[] badge lookups. 190 unit tests GREEN, tsc clean, package builds, eslint clean
- [Phase ?]: 06.1-02: MOUSE_RESET fires on onPtyExit (the reliable death signal) + unconditionally on the running transition (idempotent), NOT gated on hasRunBeforeRef — the initial/first-restart running broadcast races ahead of the status subscription, so gating would skip the user's first restart and leave the scroll-wheel hot (D-13).
- [Phase ?]: 06.1-02: abnormal-exit is scrollback-preserving (MOUSE_RESET + ALT_SCREEN_EXIT, no term.reset()/RIS) per RESEARCH Open Q1 — flagged for human-verify (blank-vs-preserve crash frame).
- [Phase 06.1-04]: Renderer two-bucket UI (TERM-12/TERM-09 surface). Sidebar partitions the order-sorted rows into a labeled Working Area (status !== 'not_started'; the error card stays here per D-05) + Inactive List (not_started) — one SortableContext spans all ids so cross-section drag-reorder is intact; each Inactive entry carries Start ▶ + Start-without-command (start-no-cmd-session) + permanent Delete (delete-session). IdentityHeader is LIVE-ONLY = Clear + Restart + Remove (header-remove); the contextual header Start (header-start) branch is DELETED (D-06 supersedes Phase-6 D-11). Remove vs Delete split behind the one ConfirmModal (removeMode): Remove of a CONFIGURED live session = window.api.ptyStop + an optimistic renderer flip to not_started (→ Inactive List in-session; main keeps the configured record so it restores dormant next boot) — NOT a new main primitive (Plan 03's stop() keeps a user-stopped session 'stopped' in the live map by design, so the dormant flip lives in the renderer); Remove of an ephemeral + any Delete = window.api.ptyClose (permanent). configured is mirrored onto the renderer row at the edit save sites. Keyboard-focus fix in SessionView.attachCustomKeyEventHandler: when the keydown target is NOT xterm's .xterm-helper-textarea, return false so the browser handles Tab/Space/Enter natively (focus traversal + button activation) and no key is fed to the PTY. No new bridge key (window-config.ts untouched, 19 keys; status-colors.ts untouched — D-14). NEW app-restart-restore.smoke proves D-08 (configured persists on disk + a dormant first Start has no '— restarted —'); the literal OS relaunch is not driveable under @wdio/electron-service (ephemeral per-launch userData + reloadSession drops the CDP bridge) so the smoke drives the Remove→dormant restore-equivalent path. Rule-1 test-correctness fix: persistence.smoke + reorder.smoke now configure sessions before asserting on-disk persistence (a Plan-03 D-02 regression those smokes — run unit-only by Plan 03 — had left RED). 206 unit GREEN, tsc + eslint clean, 14/14 smoke GREEN. Task 3 (end-of-phase human-verify) is BLOCKING and NOT yet run — nyquist_compliant stays false in both VALIDATION files until explicit user approval. one-way auto-promotes a session to configured (configured=true set unconditionally after any metadata field write — touching the profile = the user keeps it; never reset to false; create() stays ephemeral). New PtyManager.listConfiguredSessions() filters listSessions() to configured===true; index.ts syncStore() persists from it (session-store.ts setSessions stays a dumb setter, untouched) so an unedited +New session never touches disk (D-02, T-06.1-11). onExit selfExit routing (selfExit = !userStopped && (status==='exited'||status==='error')): a configured self-exit MOVES the record sessions→dormantRecords coerced to not_started with pid dropped + order preserved (Inactive List, RESEARCH A2); an ephemeral self-exit is delete()d (gone, no persistence); a user-stopped Stop/Restart precursor ('stopped') STAYS in the live map so restart() respawns under the same logicalId. Spawn-failure (pid -1) returns before onExit is wired → stays an error broadcast (pty-spawn-error green). Routing runs AFTER the error-notice broadcast so the fork-then-die error card still gets its status+notice. No new bridge key (configured rides the existing updateProfile channel — security.guard 19-key invariant green). 206 unit tests GREEN, tsc + eslint clean. The three Wave-0 RED lifecycle scaffolds are now GREEN.
- [Phase 07-01]: Interface-first Wave 0 foundation for both Phase-7 features. Pure `matchSearchKey(i, platform)` find-chord matcher is a NEW sibling of matchClearKey (NOT a change to matchSwitchKey): macOS Cmd+F→{kind:'search'}, macOS Ctrl+F→null (readline forward-char survives — D-03), Windows Ctrl+F→{kind:'search'}; rides the EXISTING 'session:switch' channel (zero new bridge key) via a before-input-event sibling block. Pure `clampScrollback(n)` (1000-50000, default 5000 D-04, non-finite→default, rounded) + additive `ui.scrollback?:number` (no SCHEMA_VERSION bump — ui slot already tolerates {}). setUiState clamps a finite scrollback IN MAIN before write (T-07-01). The ONLY new bridge key is `getUiState` (19→20, read-only main→renderer invoke returning validated prefs for the boot-read seed) via the atomic 4-site lockstep (api-types + window-config + preload + registerIpc/unregisterIpc); persistUiState payload WIDENED with scrollback (same key). @xterm/addon-search pinned EXACT 0.15.0 (0.16.0 dropped the verifiable peer @xterm/xterm@^5.0.0 field; 0.15.0 is the last with it) — pure-JS browser bundle, zero .node, no @electron/rebuild. 283 unit GREEN (35 files), tsc + eslint clean. security.guard GREEN at 20 keys (dynamic assertion, no test change). Renderer wiring (SearchBar/PreferencesModal/scrollback seed) deferred to Plans 02/03.
- [Phase 07-02]: TERM-10 search slice (renderer-only). New SearchBar overlay (sibling of .term-mount, never inside .xterm) + SearchAddon mounted once per SessionView term (disposed before term.dispose() — Pitfall 4). SessionManager searchOpenId + 'search' branch on the EXISTING 'session:switch' channel (toggles the active session's bar, never switches active). SessionView render restructured: outer .session-view wrapper → inner .term-mount (xterm opens here) + SearchBar sibling, so the input's stopPropagation keeps chars/Esc off the PTY (SC3). searchReady flag hands the live addon (null on first paint). Decorations always passed so onDidChangeResults fires; resultIndex===-1 over-threshold sentinel handled. Zero new bridge key — EXPECTED_API_KEYS stays 20. 283 unit GREEN, tsc + eslint clean. Live N-of-M / find-chord / SC3 sign-off is Plan 04 (manual, macOS-first).
- [Phase 07-03]: TERM-11 scrollback slice (renderer-only). Sidebar ⚙ gear in a NEW .sidebar-pinned inline-flex row beside the collapse chevron (reachable expanded + collapsed — inherits the chevron's dual-mode; .sidebar-collapse/.sidebar-prefs merged into shared 28×28 radius-8 + blue focus-ring rules) opens PreferencesModal (clones the ConfirmModal skeleton, NOT a generalization; extensible .prefs-body settings stack — D-08). Scrollback field: number input min 1000 max 50000 step 1000, default 5000, live-apply-on-commit (onChange clamps + applies, onBlur re-snaps) + single neutral "Done" dismiss (no destructive styling). NEW pure renderer src/renderer/scrollback-clamp.ts — a hand-kept verbatim MIRROR of the main clampScrollback (NOT an import — importing src/main would pull electron into the renderer bundle); defense in depth (renderer clamp = input UX, main setUiState clamp = persistence security boundary). SessionManager owns scrollback state (default 5000, boot-read via getUiState seeds it — RESEARCH Open Q1 resolved) + handleSetScrollback (clamp → state → persistUiState, validated/re-clamped in main — T-07-01) + preferencesOpen; fans the value out as a prop to every SessionView. SessionView seeds new Terminal({ scrollback }) (replaces hardcoded 10000) + a guarded live-apply useEffect([scrollback]) (term.options.scrollback, no re-fit, SearchAddon/WebGL untouched; lowering trims off-screen rows — D-06 accepted). ZERO new bridge keys — scrollback rides persistUiState, boot-read uses the existing getUiState; EXPECTED_API_KEYS stays 20 (security.guard GREEN). 290 unit GREEN (36 files, +7 renderer clamp), tsc + eslint clean. Live fan-out (D-05) + decrease-trim (D-06) + restore-on-restart (SC2) sign-off is Plan 04 (manual, macOS-first).
- [Phase 06.1-04 gap-closure r1]: First human-verify FAILED → 4 fixes + 1 follow-on, each locked. (1) Amber settle-independence: extracted SEAM A per-tick decision into pure src/renderer/agent-tick.ts (decideAgentTick); now runs classify() EVERY tick and emits 'waiting' after WAITING_TICKS(3)≈300ms even while the full-frame hash churns (the real claude footer repaints forever → it never settled → amber never fired). classify() untouched (oracle green); ❯ caret NOT reintroduced. (2) Header Restart ↻ REMOVED (user decision) — live header = Clear + Remove; onRestart prop + SessionManager pass-through gone; restart-in-place + the '— restarted —' divider STAY (still reachable via row/context-menu Restart — assessed not-dead). (3) FIX4b persist policy = IDENTITY/RECIPE (supersedes edit-only D-02): persist if 'configured OR hasIdentity' where identity = startupCommand | custom name (not auto 'Session N') | custom icon | non-default cwd | non-default shell; pure src/main/session-identity.ts gates listConfiguredSessions() + onExit self-exit routing; DEFAULT_SESSION_ICON is the single-source default; 06.1-CONTEXT.md D-02 refined. A bare blank +New stays ephemeral. (4) FIX4a self-exit→Inactive flip: pure src/renderer/session-status.ts (resolveRowStatus/hasRendererIdentity) presents an IDENTITY row's 'exited'/'error' as 'not_started' so it enters the Inactive List mid-session (was only on next boot). (5) Follow-on Rule-1 race guard: child.onExit no-ops when s.pty!==child — the dormant Start (create({id})) re-spawns under the same id while the old child drains SIGTERM, and the stale exit was relabeling the live session (exposed by FIX4a; app-restart-restore smoke was timing out). 234 unit GREEN (30 files), tsc + eslint(src/tests) clean, 14/14 smoke GREEN (packaged). nyquist_compliant NOT flipped — awaiting 2nd human-verify. Pre-existing .planning/spikes/*.cjs lint errors (8) are out of scope → deferred-items.md.

- [Phase 08-01]: macOS-buildable packaging slice complete. (1) Pure electron-free `src/main/os-gate.ts` (mirrors shell-resolver.ts): `MIN_WINDOWS_BUILD=17763`, `parseWindowsBuild` (regex group-3 BUILD, like node-pty's own parser), `isUnsupportedWindows` (win32 + parseable build < floor; **fail-OPEN** on unparseable so a parse quirk never bricks a supported host; non-win32 never gated). Wired at the TOP of `app.whenReady` in index.ts BEFORE store.load() — native `dialog.showErrorBox`→`app.quit()`→`return`, so the gate precedes every node-pty spawn path (D-05/SC4). 9 fixture-string unit tests GREEN. (2) Placeholder `assets/icon.{icns,ico,png}` (icns via iconutil/sips; **real multi-size .ico** 16–256, `file`→"MS Windows icon resource", not a renamed PNG) + `assets/README.md` (swap-by-file later). `forge.config.ts` EXTENDED additively: name/appBundleId/`icon:'assets/icon'` (no ext) + **env-gated** `osxSign: process.env.APPLE_IDENTITY ? {} : undefined` / `osxNotarize: process.env.APPLE_ID ? {...} : undefined` (unsigned default, D-04, **zero secret committed**) + `MakerSquirrel({setupIcon:'assets/icon.ico'})`; `windowsSign` left UNSET. The proven `asar.unpackDir` / `ignore` keep-clause / `rebuildConfig.onlyModules:[]` (D-06) are **byte-for-byte unchanged**. package.json author+appId. `docs/PACKAGING.md` (make overview, `xattr -dr com.apple.quarantine`, env-gated signing flip). (3) `wdio.conf.ts` `appBinaryPath` now a `process.platform==='win32'` ternary on `os.arch()` (darwin .app / win32 .exe for Plan-03 CI); `pty-roundtrip.smoke.test.ts` stale RED banner removed, `echo hello` is the cross-platform SC3 invariant, `$TERM`/Ctrl+C guarded to non-win32 (it.skip). **Real proof on dev box**: `npm run make`→`out/Just-Wrapper-darwin-arm64/Just-Wrapper.app` (icon applied, bundle id com.justwrapper.app, spawn-helper unpacked+executable); `npm run test:smoke`→15/15 spec files, pty-roundtrip 3/3 GREEN (PTY echoes from inside app.asar.unpacked). 301 unit GREEN, EXPECTED_API_KEYS stays exactly **20** (window-config.ts untouched, security.guard GREEN), tsc clean. **Zero new bridge keys, zero new package installs.**
- [Phase ?]: 08-02: CMD/PowerShell readiness degrades-loudly; Windows shell default from ComSpec unconditional (D-05); zero new bridge keys (EXPECTED_API_KEYS=20)
- [Phase 08-03]: 2-OS GitHub Actions matrix (windows-latest + macos-latest) is the canonical producer + verifier — `.github/workflows/build.yml`: npm ci → npm run make (HARD gate) → npm run test:smoke (strong-preferred) → upload-artifact out/make; ZERO secrets, unsigned (D-04, maker-squirrel unsigned + osxSign/osxNotarize env-gated off), NO mandatory native rebuild (D-06 — postinstall fix-node-pty does the opportunistic non-fatal rebuild). docs/PACKAGING.md gained a Continuous Integration section. Task 2 canonical `claude --rc` packaged human-verify APPROVED 2026-06-10: the user ran `npm run make`, opened the packaged macOS `.app`, created the canonical session (Parlour Claude RC / 🛋️ / real project dir / `claude --rc`) and confirmed LIVE interactive launch — **SC2 LIVE-CONFIRMED on macOS ONLY**. Honest SC map: SC1(mac)/SC3(mac) automated GREEN; SC1(win)/SC3(win) CI-produced (runnable-on-real-Windows best-effort/human-verify); SC4 LOGIC-PROVEN ONLY (os-gate.test.ts GREEN, no pre-1809 host available); D-02/D-03 Windows byte-semantics best-effort. nyquist_compliant flipped true in 08-VALIDATION.md ONLY on this explicit approval. PKG-01 satisfied (Definition-of-Done item 6). Phase NOT yet marked verified — orchestrator's verifier + phase.complete owns that.

### Pending Todos

None yet.

### Blockers/Concerns

- **[06.1-04 Task 3 — ACTIVE, 2nd pass] SECOND end-of-phase human-verify is the only remaining step.** The FIRST human-verify FAILED; gap-closure round 1 fixed all 4 diagnosed defects + a stale-exit race guard, each locked with a regression test. All automated suites are GREEN (234 unit + 14/14 smoke incl. alt-screen-reset + app-restart-restore). The user must RE-run the hands-on checks against the running app and type "approved" (plus confirm the abnormal-exit frame choice — scrollback-preserving default vs blank crash frame, RESEARCH Open Q1). On approval the executor flips nyquist_compliant: true in BOTH 06-VALIDATION.md and 06.1-VALIDATION.md. **The flags are NOT flipped yet.** To run the app: `npm start` (or `npm run package` then launch out/Just-Wrapper-darwin-arm64/Just-Wrapper.app). Refreshed re-verify checklist is in the executor's return report.
  - FIX 1: amber "waiting" now fires LIVE on the real `claude` permission screen (settle-independent — the churning footer no longer keeps it blue).
  - FIX 3: the header ↻ Restart button is GONE — the live header is Clear + Remove only; Restart lives on the row/context-menu and via Remove → Start-from-Inactive.
  - FIX 4a/4b: a running session carrying a recipe (e.g. a startupCommand) now persists across restart and a self-exiting configured/recipe session drops into the Inactive List immediately.
- [resolved-by-Plan-03, fixed in 04] persistence.smoke + reorder.smoke had stale ephemeral-persists expectations after Plan 03's D-02 configured-only persistence — corrected in 06.1-04 (Rule-1 test correctness).
- node-pty version for Electron 42.x needs verification before Phase 2 starts (see research/SUMMARY.md); consider starting on Electron 36.x if compatibility is unclear
- macOS notarization (Phase 8) requires Apple Developer Program membership (~$99/year); plan ahead
- **[08-01 — for human confirmation, NOT auto-changed] Windows ConPTY floor 17763 vs 18309.** `os-gate.ts` `MIN_WINDOWS_BUILD` is locked at **17763** (Windows 10 1809, CLAUDE.md/D-05). node-pty's OWN `_useConpty` gate is `>= 18309` — so builds 17763–18308 LAUNCH under our gate but run winpty internally (which CLAUDE.md "What NOT to Use" excludes). The discrepancy is preserved as a code comment in os-gate.ts and was NOT silently changed (08-RESEARCH Open Q1 / A6). If a "ConPTY guaranteed" floor is wanted, the constant becomes 18309 — but only by an explicit human decision.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260605-ki7 | Phase-4 sidebar UI polish: collapsed add-button shows only "+"; row controls become edit/delete (+conditional restart) icon buttons | 2026-06-05 | 0ea3d68 | [260605-ki7-phase-4-sidebar-ui-polish-collapsed-add-](./quick/260605-ki7-phase-4-sidebar-ui-polish-collapsed-add-/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-10T00:00:00.000Z
Stopped at: Completed 08-03-PLAN.md (Task 2 human-verify APPROVED; nyquist_compliant flipped true)
Resume file: None — Phase 8 plans all complete; next is the orchestrator's phase-verifier + phase.complete step
