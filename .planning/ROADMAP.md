# Roadmap: Just-Wrapper

## Overview

Just-Wrapper is built from the inside out: the Core Value (real terminal fidelity) is validated first, then the session model is layered on top, then the identity and persistence surfaces are added, and finally the whole thing is packaged for both platforms. Every phase leaves the app in a runnable state. Packaging is validated early with a smoke-test at the end of Phase 2 so ASAR/ABI issues are caught before the full feature set is invested. The final Phase 8 produces the distributable artifacts for both Windows and macOS.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Project Scaffold + Dev Infrastructure** - Electron+Vite+TypeScript skeleton with security config, contextBridge, shared types, and logicalId/ptyPid data model established
- [ ] **Phase 2: PTY Core + Terminal Fidelity** - Single real PTY session with full keyboard, ANSI, resize, flow control, Unicode, and fidelity validated via `claude --rc` / `vim` / Python REPL
- [ ] **Phase 3: Multi-Session + Session Lifecycle** - N concurrent PTY sessions with ring-buffer replay, CSS show/hide tab panels, stop/restart, and the session status state machine
- [ ] **Phase 4: Session Identity + Sidebar UI** - Full sidebar (icon + name + status badge, expanded/collapsed), session creation form, rename/re-icon, and keyboard session-switching shortcuts
- [ ] **Phase 5: Persistence + Shell Discovery** - Session profiles saved to disk and restored on reopen (always not_started), platform-aware shell resolver, and sidebar order persistence
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

**Plans:** 2/3 plans executed
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold + tooling + Wave 0 test stubs (Electron 36.9.5 pin, ESLint D-06, Vitest/WDIO harnesses, postinstall electron-rebuild SC4)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Shared identity contract (branded LogicalId, SessionRecord D-01..D-04, api-types; identity guard GREEN — IDENT-01/02)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — Secure process-split walking-skeleton slice (webPreferences D-07, contextBridge-only SC3, blank renderer round-trip; boot smoke GREEN SC1)

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

**Plans:** TBD
**UI hint:** yes

### Phase 3: Multi-Session + Session Lifecycle

**Goal:** Multiple concurrent terminal sessions can run independently; switching between them never kills a background process; and a user can stop and restart any session while its logical identity remains unchanged.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** TERM-05, TERM-06, TERM-07, TERM-08
**Success Criteria** (what must be TRUE):

  1. User can have 3+ sessions open simultaneously; switching between them does not terminate any background process (`npm run dev` in session A keeps printing output while session B is active)
  2. Switching back to a previously hidden session replays buffered output so the scrollback is current — no frozen or blank screen
  3. User can stop a running session and restart it; the restart creates a new PTY process but the session's logicalId, name, and icon are unchanged
  4. Each session shows one of five statuses — not started / running / stopped / exited / error — and the badge updates correctly on every state transition
  5. A session configured with an optional startup command executes that command automatically after the PTY spawns

**Plans:** TBD
**UI hint:** yes

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

**Plans:** TBD
**UI hint:** yes

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

**Plans:** TBD
**UI hint:** yes

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

**Plans:** TBD
**UI hint:** yes

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
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffold + Dev Infrastructure | 2/3 | In Progress|  |
| 2. PTY Core + Terminal Fidelity | 0/TBD | Not started | - |
| 3. Multi-Session + Session Lifecycle | 0/TBD | Not started | - |
| 4. Session Identity + Sidebar UI | 0/TBD | Not started | - |
| 5. Persistence + Shell Discovery | 0/TBD | Not started | - |
| 6. Robustness + Flow-Control Polish | 0/TBD | Not started | - |
| 7. Terminal Search + Scrollback Config | 0/TBD | Not started | - |
| 8. Cross-Platform Packaging | 0/TBD | Not started | - |
