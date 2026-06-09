# Roadmap: Just-Wrapper

## Overview

Just-Wrapper is built from the inside out: the Core Value (real terminal fidelity) is validated first, then the session model is layered on top, then the identity and persistence surfaces are added, and finally the whole thing is packaged for both platforms. Every phase leaves the app in a runnable state. Packaging is validated early with a smoke-test at the end of Phase 2 so ASAR/ABI issues are caught before the full feature set is invested. The final Phase 8 produces the distributable artifacts for both Windows and macOS.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Project Scaffold + Dev Infrastructure** - Electron+Vite+TypeScript skeleton with security config, contextBridge, shared types, and logicalId/ptyPid data model established (completed 2026-06-03)
- [x] **Phase 2: PTY Core + Terminal Fidelity** - Single real PTY session with full keyboard, ANSI, resize, flow control, Unicode, and fidelity validated via `claude --rc` / `vim` / Python REPL (completed 2026-06-04)
- [x] **Phase 3: Multi-Session + Session Lifecycle** - N concurrent PTY sessions with ring-buffer replay, CSS show/hide tab panels, stop/restart, and the session status state machine (completed 2026-06-04)
- [x] **Phase 4: Session Identity + Sidebar UI** - Full sidebar (icon + name + status badge, expanded/collapsed), session creation form, rename/re-icon, and keyboard session-switching shortcuts (completed 2026-06-05)
- [x] **Phase 5: Persistence + Shell Discovery** - Session profiles saved to disk and restored on reopen (always not_started), platform-aware shell resolver, and sidebar order persistence (completed 2026-06-06)
- [x] **Phase 5.1: TERM-05 startup-command auto-run** (INSERTED) - Auto-run a session's saved startup command into the PTY once the shell is ready, on start and restart (completed 2026-06-06)
- [ ] **Phase 6: Robustness + Flow-Control Polish** - HIGH/LOW watermark backpressure, spawn/cwd error handling, waiting-for-input heuristic, alt-screen reset, and session header quick controls
- [ ] **Phase 7: Terminal Search + Scrollback Config** - Ctrl+F in-session search and configurable scrollback buffer size (global setting with sensible default)
- [ ] **Phase 8: Cross-Platform Packaging** - Full production distributables for Windows and macOS: ASAR unpack, @electron/rebuild in CI, Electron Forge makers, ConPTY version check, and notarization stubs

## Phase Details

### Phase 1: Project Scaffold + Dev Infrastructure

**Goal:** The Electron application boots, the main/renderer/preload process split is correct, contextBridge exposes a typed API, and the shared data model permanently separates logicalId from ptyPid so this constraint can never be violated later.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** IDENT-01, IDENT-02
**Success Criteria** (what must be TRUE):

  1. `npm start` launches an Electron window with a blank renderer — no console errors about nodeIntegration, contextIsolation, or preload
  2. `SessionRecord` type in `shared/types.ts` has `logicalId: string` (UUID) and `ptyPid?: number` as distinct fields; no code in the codebase conflates them
  3. `contextBridge.exposeInMainWorld` is the only bridge between renderer and main; no raw `ipcRenderer` is accessible in renderer code
  4. `@electron/rebuild` runs as a postinstall hook and completes without error on the developer's macOS machine

**Plans:** 3/3 plans complete
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold + tooling + Wave 0 test stubs (Electron 36.9.5 pin, ESLint D-06, Vitest/WDIO harnesses, postinstall electron-rebuild SC4)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Shared identity contract (branded LogicalId, SessionRecord D-01..D-04, api-types; identity guard GREEN — IDENT-01/02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Secure process-split walking-skeleton slice (webPreferences D-07, contextBridge-only SC3, blank renderer round-trip; boot smoke GREEN SC1)

### Phase 2: PTY Core + Terminal Fidelity

**Goal:** A user can open the app and interact with a single real terminal session exactly as they would in a native terminal — interactive programs, control characters, colors, resize, and the canonical `claude --rc` scenario all work. This is the Core Value proof.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** TERM-01, TERM-02, TERM-03, TERM-04
**Success Criteria** (what must be TRUE):

  1. User can run `claude --rc`, `vim`, `python` (REPL), and `ssh` inside the session and they all behave identically to a native terminal (interactive prompts, full keyboard input, colors)
  2. Ctrl+C kills a running process; Ctrl+D closes a REPL; arrow keys navigate shell history; copy/paste works including multi-line bracketed paste (does not auto-execute lines)
  3. Resizing the Electron window causes `tput cols` inside the session to update to the new width within one second; vim and ncurses apps reflow correctly
  4. `echo $TERM` inside the session returns `xterm-256color`; truecolor output renders correctly; CJK characters and emoji occupy the correct cell widths (htop borders intact)
  5. `cat` of a large file (50 MB+) does not freeze the UI or drop output; keyboard input remains responsive during high-throughput output

**Plans:** 4/4 plans complete
**UI hint:** yes

**Wave 1**

- [x] 02-01-PLAN.md — Install/pin node-pty + @xterm 5.x stack; create all Wave 0 RED test stubs + WDIO xterm driver

**Wave 2** *(blocked on Wave 1)*

- [x] 02-02-PLAN.md — Main-side: resolveShell + flow-control + PtyManager (validated/clamped IPC, lifecycle) + typed bridge contract / EXPECTED_API_KEYS

**Wave 3** *(blocked on Wave 2)*

- [x] 02-03-PLAN.md — Live round-trip slice: preload bridge + full-window xterm TerminalPane + resize (round-trip + resize smoke GREEN)

**Wave 4** *(blocked on Wave 3)*

- [x] 02-04-PLAN.md — Fidelity layers: flow-control watermark (throughput smoke GREEN) + copy/paste + bracketed paste + human-verify fidelity checkpoint

### Phase 3: Multi-Session + Session Lifecycle

**Goal:** Multiple concurrent terminal sessions can run independently; switching between them never kills a background process; and a user can stop and restart any session while its logical identity remains unchanged.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** TERM-06, TERM-07, TERM-08
**Success Criteria** (what must be TRUE):

  1. User can have 3+ sessions open simultaneously; switching between them does not terminate any background process (`npm run dev` in session A keeps printing output while session B is active)
  2. Switching back to a previously hidden session replays buffered output so the scrollback is current — no frozen or blank screen
  3. User can stop a running session and restart it; the restart creates a new PTY process but the session's logicalId, name, and icon are unchanged
  4. Each session shows one of five statuses — not started / running / stopped / exited / error — and the badge updates correctly on every state transition
  5. ~~A session configured with an optional startup command executes automatically~~ — **DEFERRED** (TERM-05 descoped from Phase 3; the startupCommand field persists for the Phase 4 form, auto-run revisited later).

**Plans:** 3/3 plans complete
**UI hint:** yes

**Wave 1**

- [x] 03-01-PLAN.md — Producer foundation: PtyManager per-session status machine + platform-aware graceful stop + identity-preserving restart + pty:status/listSessions; 12-key bridge contract; all Wave 0 RED scaffolds (TERM-06/07/08)

**Wave 2** *(blocked on Wave 1)*

- [x] 03-02-PLAN.md — Multi-session renderer slice: 4 preload methods (guard GREEN) + SessionView (instance-per-session, WebGL-on-active, keep-alive) + SessionManager + basic DESIGN.md Sidebar + status-colors; keep-alive E2E GREEN (TERM-06, TERM-08 display)

**Wave 3** *(blocked on Wave 2 — has checkpoint)*

- [x] 03-03-PLAN.md — Lifecycle slice: stop/restart controls + '— restarted HH:MM —' separator + blocking human-verify fidelity checkpoint (TERM-07)

### Phase 4: Session Identity + Sidebar UI

**Goal:** The app's visual identity layer is complete — each session has a distinct name, icon, and status visible in a collapsible sidebar, sessions can be created and edited through a real form, and the user never needs the mouse to switch between sessions.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** IDENT-03, SESS-01, SESS-02, SESS-03, SESS-04, NAV-01, NAV-02, NAV-03, NAV-05
**Success Criteria** (what must be TRUE):

  1. Sidebar lists all sessions showing icon + name + running/stopped status badge; collapsing the sidebar hides names but the icon alone still identifies each session
  2. User can create a new session by specifying a custom name, emoji/icon, initial working directory, shell, and optional startup command — all fields are functional
  3. User can rename a session or change its icon after creation; doing so does not create a new session or change the session's logicalId
  4. User can switch to any session using keyboard shortcuts (Ctrl/Cmd+1–9 for positions, and next/previous shortcuts) without touching the mouse
  5. Switching to a session updates the main terminal panel immediately; the previously active session remains running and visible again on re-activation

**Plans:** 4/4 plans complete
**UI hint:** yes

**Wave 1**

- [x] 04-01-PLAN.md — Foundation: Wave 0 RED stubs + 5 pure modules + atomic 15-key bridge lockstep (ptyUpdateProfile/onSwitchSession) + PtyManager.updateProfile

**Wave 2** *(blocked on Wave 1)*

- [x] 04-02-PLAN.md — Create/edit + identity slice: ContextMenu + IconPicker + SessionEditModal + IdentityHeader + color-badge-with-initial (SESS-01..04, IDENT-03, NAV-01/03)

**Wave 3** *(blocked on Wave 2)*

- [x] 04-03-PLAN.md — Keyboard-switch slice: main before-input-event + onSwitchSession sub + NAV-05 E2E (NAV-05, app-wins D-13)

**Wave 4** *(blocked on Wave 3)*

- [x] 04-04-PLAN.md — Collapsible-sidebar slice: chevron toggle + icon-only rail + status dot + tooltip + Nyquist sign-off (NAV-01/02, SESS-03)

### Phase 5: Persistence + Shell Discovery

**Goal:** Session profiles survive app restarts — the user's sessions, names, icons, working directories, and sidebar ordering are all restored on reopen — and the shell list is populated correctly for the user's platform without hardcoded paths.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** NAV-04, PERS-01, PERS-02
**Success Criteria** (what must be TRUE):

  1. After fully closing and reopening the app, all session profiles are restored with their correct names, icons, shells, working directories, and startup commands — no session is missing
  2. Restored sessions always open in `not_started` status regardless of what status they had when the app was closed; no session shows `running` on launch
  3. The sidebar preserves the user's custom session ordering across restarts
  4. The shell selector in the session creation form is populated with available shells for the current platform (PowerShell/CMD/Git Bash/WSL on Windows; zsh/bash on macOS) with no hardcoded paths that break on non-standard installs

**Plans:** 4/4 plans complete
**UI hint:** yes

**Wave 1**

- [x] 05-01-PLAN.md — Foundation: Wave 0 RED stubs + 4 pure modules (store-schema/shell-discovery/window-bounds/session-reorder) + atomic 18-key bridge lockstep + lowdb install/external (PERS-01/02, NAV-04)

**Wave 2** *(blocked on Wave 1)*

- [x] 05-02-PLAN.md — Persistence slice: SessionStore (lowdb dynamic import, debounce/flush, corrupt recovery) + PtyManager.hydrate dormant-restore + lifecycle wiring + window-bounds restore + persistence smoke (PERS-01/02, NAV-04)

**Wave 3** *(blocked on Wave 2)*

- [x] 05-03-PLAN.md — Shell-discovery + dormant-UI slice: shell dropdown + IdleCard + WelcomeEmptyState + boot rewrite (no poll/auto-spawn) + Start/Restart flip + collapse persist (PERS-02, NAV-04, SC4)

**Wave 4** *(blocked on Wave 3 — has checkpoint)*

- [x] 05-04-PLAN.md — Drag-to-reorder slice: dnd-kit (gated [ASSUMED] verify) + sortable sidebar + persistOrder wiring + reorder smoke + Nyquist sign-off (NAV-04)

### Phase 05.1: TERM-05 startup-command auto-run (INSERTED)

**Goal:** A session's optional saved startup command runs automatically when the session starts — the command is written into the PTY as if the user typed it followed by Enter, once the shell is ready — so starting (or restarting) an agent session such as `claude --rc` relaunches the tool in its working directory without the user retyping it. This un-defers TERM-05, descoped from Phase 3 because the naive settle-delay injection was unreliable on cold first spawn.
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** TERM-05
**Success Criteria** (what must be TRUE):

  1. A session with a saved startup command, when started, automatically executes that command after the shell is ready — the command appears in the terminal as if typed (it lands in shell history) and runs
  2. A session with no startup command starts as a normal shell with no injected input (TERM-03 normal-shell mode stays intact)
  3. Restarting a session re-runs its startup command after the shell is ready
  4. The command is injected only once the shell is genuinely ready to accept input — no lost or garbled keystrokes on cold first spawn (the failure mode that caused the original Phase-3 deferral)
  5. For restored (dormant) sessions, the startup command is NOT auto-run on app launch — it runs only when the user explicitly starts the session (consistent with Phase 5's dormant-restore model)

**Plans:** 3/3 plans complete
**UI hint:** no

**Wave 1**

- [x] 05.1-01-PLAN.md — Foundation: ReadinessProbe seam (mirrors shell-discovery.ts) + Wave 0 RED scaffolds (readiness-probe.test.ts, startup-command.smoke.test.ts) + SC5 hydrate extension (TERM-05)

**Wave 2** *(blocked on Wave 1)*

- [x] 05.1-02-PLAN.md — Core slice: wireNormalOnData() refactor + the invisible probe-then-inject happy path in create() (SC1/SC2/D-02/D-05; SC5 structural)

**Wave 3** *(blocked on Wave 2 — has checkpoint)*

- [x] 05.1-03-PLAN.md — Timeout/notice fallback (D-04/SC4) + onPtyStatus notice reuse (zero new keys) + restart re-run (SC3) + cold-spawn E2E + Nyquist sign-off + canonical human-verify

### Phase 6: Robustness + Flow-Control Polish

**Goal:** The app handles real-world failure modes gracefully — high-throughput output never freezes the UI, spawn errors and invalid paths show actionable messages, alt-screen apps don't leave stale content, and session header controls give instant access to clear and restart.
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** TERM-09, TERM-12
**Success Criteria** (what must be TRUE):

  1. Running `cat /dev/urandom | head -c 100M` (or equivalent high-throughput command) does not freeze keyboard input, crash the app, or drop output; the HIGH/LOW watermark backpressure visibly pauses and resumes the PTY stream
  2. If a session's configured working directory does not exist at spawn time, the session status shows `error` and the sidebar badge displays a clear human-readable message — it does not silently spawn in `~`
  3. After a session running `vim` or `less` is killed without a normal exit, reopening that session shows a clean terminal prompt — not a frozen alt-screen frame
  4. The sidebar shows a best-effort "waiting for input" indicator when a background session's output has gone idle after a pattern consistent with an agent confirmation prompt (e.g., trailing `?` or `[y/N]`)
  5. The session header provides single-click (or keyboard-accessible) "Clear terminal" and "Restart session" controls that work correctly

**Plans:** 3/4 plans executed
**UI hint:** yes

**Wave 1**

- [x] 06-01-foundation-PLAN.md — Foundation: Wave 0 RED scaffolds + pure agent-state classifier + 19-key bridge lockstep (pickDirectory) + Clear-chord matcher/handler + 05.1 probe fixes (WR-01..03/IN-01..03) + TerminalPane delete + SC1 100M smoke (TERM-09/TERM-12)

**Wave 2** *(blocked on Wave 1)*

- [x] 06-02-spawn-error-recovery-PLAN.md — SC2 slice: main cwd pre-validate + try/catch spawn (no silent home) + error card with Edit/Retry + Start-without-command + folder picker + edit-prefill + WR-04/WR-05 (TERM-12)

**Wave 3** *(blocked on Wave 2)*

- [x] 06-03-agent-state-layer-PLAN.md — SC4 slice: AGENT_STYLE ramp + presentation() resolver + renderer-side idle-timer detector + sidebar/rail/header overlay (TERM-09)

**Wave 4** *(blocked on Wave 3 — has checkpoint)*

- [ ] 06-04-header-controls-reset-PLAN.md — SC5+SC3 slice: header Clear/Restart/Start cluster + Cmd+K chord + alt-screen reset (restart \x1b[?1049l, abnormal-exit reset) + SC1/SC3/SC5 E2E + human-verify + Nyquist sign-off (TERM-12/TERM-09)

### Phase 06.1: Terminal lifecycle state machine and agent-state detection redesign (INSERTED)

**Goal:** The terminal lifecycle is a clean two-bucket model (a Working Area of live sessions + an Inactive List of dormant configured sessions, no "Stop" verb), agent-state detection reads "Waiting for you" from frame-stability (not output-silence) so `claude --rc` is correctly amber on a confirmation prompt and never stuck blue, and the Core-Value scroll/`[%30/]` fidelity regression after alt-screen apps is fixed.
**Requirements:** TERM-09, TERM-12
**Depends on:** Phase 6
**Plans:** 4/4 plans complete

**Wave 0**

- [x] 06.1-01-PLAN.md — Foundation: frame-stability classify() rewrite + offline 002-replay oracle + @xterm/headless devDep + configured?/SCHEMA_VERSION contract + RED lifecycle scaffolds (TERM-09) — `71d7cf5`

**Wave 1** *(blocked on Wave 0)*

- [x] 06.1-02-PLAN.md — SessionView SEAM A (frame-stability tick over term.buffer.active) + SEAM B (MOUSE_RESET / no-reset restart) + extended alt-screen smoke (TERM-09/TERM-12, D-13/D-07)
- [x] 06.1-03-PLAN.md — Main-side two-bucket lifecycle: updateProfile configured auto-promotion + configured-self-exit→Inactive / ephemeral→gone + configured-only persistence (TERM-12, D-02/D-05) — `4936b88`, `c568ff1`

**Wave 2** *(blocked on Wave 1 — has checkpoint)*

- [~] 06.1-04-PLAN.md — Renderer two-bucket UI: Working Area / Inactive List sections + live header (Clear+Remove; header Restart REMOVED in gap-closure FIX 3) + keyboard-focus fix + Remove/Delete + D-08 restore-no-separator smoke (TERM-12/TERM-09, D-01/D-06/D-08) — impl + smokes GREEN (`2d3b8b3`, `1261d52`). FIRST human-verify FAILED → gap-closure round 1 fixed 4 defects + a stale-exit race guard, each locked (`080807a` amber settle-independence, `90e87e5` remove header Restart, `3e64e84` persist-by-identity, `4455169` self-exit→Inactive flip, `0cdb149` stale-exit guard); 234 unit + 14/14 smoke GREEN. PAUSED at the SECOND blocking end-of-phase human-verify (Task 3) — nyquist_compliant still not flipped

### Phase 7: Terminal Search + Scrollback Config

**Goal:** Users can search session scrollback with Ctrl+F and configure the scrollback buffer size to suit their workflow — neither feature requires architecture changes, both are additive to the working terminal.
**Mode:** mvp
**Depends on:** Phase 6
**Requirements:** TERM-10, TERM-11
**Success Criteria** (what must be TRUE):

  1. Pressing Ctrl+F inside an active session opens an in-terminal search bar; the user can type a query and navigate through matching occurrences in the scrollback buffer
  2. A global settings panel exposes a scrollback buffer size setting; changing it takes effect for new sessions and has a sensible default (e.g., 3000 lines)
  3. Search can be dismissed with Escape and does not interfere with terminal keyboard input when inactive

**Plans:** TBD
**UI hint:** yes

### Phase 8: Cross-Platform Packaging

**Goal:** The app produces installable, runnable distributables for both Windows and macOS from a single codebase — ASAR unpack is correct for node-pty's native helpers, the ABI rebuild runs in the packaging pipeline, and a ConPTY version check protects Windows users on pre-1809 builds.
**Mode:** mvp
**Depends on:** Phase 7
**Requirements:** PKG-01
**Success Criteria** (what must be TRUE):

  1. `npm run make` (or equivalent) produces a runnable `.app` on macOS and a runnable `.exe` / installer on Windows without manual post-processing
  2. The packaged app on both platforms passes the canonical validation scenario: create a session `Name: Parlour Claude RC`, `Icon: 🛋️`, `Path: <real project dir>`, `Command: claude --rc` — the agent launches interactively
  3. PTY spawn works correctly inside the ASAR-packaged app on both platforms — `spawn-helper` (macOS) and `conpty.node` (Windows) are found outside the ASAR archive
  4. On a Windows machine below build 1809, the app displays a clear "Windows 10 build 1809 or later required" error at startup instead of crashing silently

**Plans:** TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 5.1 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffold + Dev Infrastructure | 3/3 | Complete    | 2026-06-03 |
| 2. PTY Core + Terminal Fidelity | 4/4 | Complete    | 2026-06-04 |
| 3. Multi-Session + Session Lifecycle | 3/3 | Complete    | 2026-06-04 |
| 4. Session Identity + Sidebar UI | 4/4 | Complete    | 2026-06-05 |
| 5. Persistence + Shell Discovery | 4/4 | Complete    | 2026-06-06 |
| 5.1. TERM-05 startup-command auto-run (INSERTED) | 3/3 | Complete    | 2026-06-06 |
| 6. Robustness + Flow-Control Polish | 3/4 | In Progress|  |
| 7. Terminal Search + Scrollback Config | 0/TBD | Not started | - |
| 8. Cross-Platform Packaging | 0/TBD | Not started | - |
