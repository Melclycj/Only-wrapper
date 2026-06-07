# Requirements: Just-Wrapper

**Defined:** 2026-06-03
**Core Value:** Real terminal fidelity — a session inside the wrapper behaves exactly like a native local terminal (`claude --rc`, `codex`, `vim`, `ssh`, REPLs, `npm run dev` all work flawlessly). Stable session identity and non-destructive switching are the strong second priority.

## v1 Requirements

Requirements for the initial release. Derived from the user's FR-01–FR-21 spec, the MVP feature set, and research-surfaced additions. Each maps to a roadmap phase.

### Session Identity

- [x] **IDENT-01**: Each session has a stable internal session ID that does not change on rename, icon change, process restart, tab switch, startup-command change, or future browser-metadata linking (FR-01)
- [x] **IDENT-02**: The logical session ID (stable, app-level) is stored and tracked separately from the terminal process/PID (temporary, per-spawn) (FR-02)
- [x] **IDENT-03**: Each session has a user-visible identity (name + icon + status) shown in both the sidebar and the session header (FR-03)

### Session Management

- [x] **SESS-01**: User can create a new session specifying custom name, custom icon, initial working directory, shell, and optional startup command (FR-04)
- [x] **SESS-02**: User can set a custom name per session, shown in the sidebar tab, session header, and session settings (FR-05)
- [x] **SESS-03**: User can assign an icon per session from emoji / a built-in icon list / a color badge; the icon stays visible when the sidebar is collapsed (FR-06)
- [x] **SESS-04**: User can rename a session and change its icon after creation without creating a new session ID (FR-07)

### Sidebar & Navigation

- [x] **NAV-01**: App displays sessions in a sidebar list, each item showing icon + session name + running/stopped status (FR-08)
- [x] **NAV-02**: Sidebar supports expanded and collapsed modes; in collapsed mode the icon still identifies the session (FR-09)
- [x] **NAV-03**: Clicking a session tab switches the main view to that session without stopping or restarting its terminal process (FR-10)
- [x] **NAV-04**: App remembers and persists the user's session order in the sidebar (FR-11)
- [x] **NAV-05**: User can switch sessions via keyboard shortcuts (e.g. Ctrl/Cmd+1–9 and next/previous) without using the mouse (research addition)

### Terminal Session

- [x] **TERM-01**: Session provides a real interactive terminal surface supporting keyboard input, stdout/stderr rendering, Ctrl+C, Ctrl+D, arrow keys, copy/paste, terminal resize, ANSI colors/control sequences, long-running processes, and interactive programs (FR-12)
- [x] **TERM-02**: Sessions run through a real PTY/pseudo-terminal layer (input → PTY → output → render), not one-shot run→capture→return command execution (FR-13)
- [x] **TERM-03**: User can open a normal shell session with no automatic startup command, then manually `cd` into any accessible folder and launch tools (e.g. `codex`, `claude --rc`) from the current working directory (FR-14)
- [x] **TERM-04**: Each session starts in its configured initial working directory (FR-15)
- [x] **TERM-05**: A session can optionally run a configured startup command after opening, separate from normal shell mode (FR-16) — **Phase 5.1** (un-deferred; descoped from Phase 3, re-homed to its own phase after Phase 5 persistence — runs the saved command into the PTY once the shell is ready, on start/restart)
- [x] **TERM-06**: A running session remains alive when the user switches to another tab; switching only changes the visible view (FR-17)
- [x] **TERM-07**: User can stop and restart a session; restart may create a new process ID but keeps the same logical session ID (FR-18)
- [x] **TERM-08**: Each session shows a status: not started / running / stopped / exited / error (FR-19)
- [x] **TERM-09**: Sidebar surfaces a best-effort "waiting for input" / needs-attention indicator when a backgrounded session appears blocked awaiting user input (research addition; heuristic, best-effort)
- [ ] **TERM-10**: User can search a session's scrollback (e.g. Ctrl+F) (research addition)
- [ ] **TERM-11**: Scrollback buffer size is configurable via a global setting with a sensible default (research addition)
- [x] **TERM-12**: Session header provides quick clear-terminal and restart-session controls (research addition)

### Local Persistence

- [x] **PERS-01**: App saves session metadata locally — session ID, name, icon, working directory, shell, startup command, display order, last active time (FR-20)
- [x] **PERS-02**: On reopen, app restores saved session profiles (metadata only, not live processes) and lets the user start them again (FR-21)

### Packaging

- [ ] **PKG-01**: App packages as a runnable/installable local desktop app for both Windows and macOS from a single codebase (MVP feature set)

## v2 Requirements

Acknowledged but deferred. Not in the current roadmap.

### Appearance

- **APPR-01**: Configurable terminal font family and size
- **APPR-02**: Light/dark theme selection (MVP ships a hardcoded sensible dark default)

### Browser Companion (separate optional feature)

- **BROW-01**: Browser extension can link the current browser tab to a terminal session
- **BROW-02**: App displays the linked tab's title, URL/domain, favicon, and active/closed status
- **BROW-03**: (Exploratory) For ChatGPT, detect whether the page is idle or generating — without reading conversation content

## Out of Scope

Explicitly excluded for the MVP. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| ChatGPT / page content reading or storage | Privacy-sensitive; deliberately never reads conversation content |
| AI automation / driving the agents | App hosts agents, it does not automate them |
| Cloud sync | Local-only by design |
| Multi-device support | Local-only by design |
| SSH connection management | User can run `ssh` inside a session; app does not manage SSH connections |
| Plugin system | Keeps MVP surface small |
| Warp-style command blocks | This is a session manager, not a reinvented terminal |
| Custom uploaded icon files (SVG/PNG) | Emoji + built-in icon list + color badge is sufficient for MVP |
| Live terminal process recovery after full app quit | Restore profiles only; user restarts sessions manually |
| Linux as a target platform | Windows + macOS only for MVP; code should avoid actively precluding Linux but it is untested |

## Definition of Done

The MVP is successful only if the canonical validation scenario passes (spec §8):

1. User can create a session — Name: `Parlour Claude RC`, Icon: `🛋️`, Path: a real project directory, Command: `claude --rc` — and interact with it inside the app exactly like a native terminal.
2. User can create a normal shell session, manually `cd` into any accessible folder, and run `codex` or `claude --rc` from there.
3. Switching between sessions never kills or restarts a running process.
4. Renaming/re-iconing a session and restarting its process both preserve the logical session ID.
5. Session profiles persist and are restored after the app is fully closed and reopened.
6. The app builds and runs as a packaged desktop app on both Windows and macOS.

## Traceability

Populated during roadmap creation. Each v1 requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| IDENT-01 | Phase 1: Project Scaffold + Dev Infrastructure | Complete |
| IDENT-02 | Phase 1: Project Scaffold + Dev Infrastructure | Complete |
| IDENT-03 | Phase 4: Session Identity + Sidebar UI | Complete |
| SESS-01 | Phase 4: Session Identity + Sidebar UI | Complete |
| SESS-02 | Phase 4: Session Identity + Sidebar UI | Complete |
| SESS-03 | Phase 4: Session Identity + Sidebar UI | Complete |
| SESS-04 | Phase 4: Session Identity + Sidebar UI | Complete |
| NAV-01 | Phase 4: Session Identity + Sidebar UI | Complete |
| NAV-02 | Phase 4: Session Identity + Sidebar UI | Complete |
| NAV-03 | Phase 4: Session Identity + Sidebar UI | Complete |
| NAV-04 | Phase 5: Persistence + Shell Discovery | Complete |
| NAV-05 | Phase 4: Session Identity + Sidebar UI | Complete |
| TERM-01 | Phase 2: PTY Core + Terminal Fidelity | Complete |
| TERM-02 | Phase 2: PTY Core + Terminal Fidelity | Complete |
| TERM-03 | Phase 2: PTY Core + Terminal Fidelity | Complete |
| TERM-04 | Phase 2: PTY Core + Terminal Fidelity | Complete |
| TERM-05 | Phase 5.1: TERM-05 startup-command auto-run (INSERTED) | Complete |
| TERM-06 | Phase 3: Multi-Session + Session Lifecycle | Complete |
| TERM-07 | Phase 3: Multi-Session + Session Lifecycle | Complete |
| TERM-08 | Phase 3: Multi-Session + Session Lifecycle | Complete |
| TERM-09 | Phase 6: Robustness + Flow-Control Polish | Complete |
| TERM-10 | Phase 7: Terminal Search + Scrollback Config | Pending |
| TERM-11 | Phase 7: Terminal Search + Scrollback Config | Pending |
| TERM-12 | Phase 6: Robustness + Flow-Control Polish | Complete |
| PERS-01 | Phase 5: Persistence + Shell Discovery | Complete |
| PERS-02 | Phase 5: Persistence + Shell Discovery | Complete |
| PKG-01 | Phase 8: Cross-Platform Packaging | Pending |

**Coverage:**

- v1 requirements: 27 total
- Mapped to phases: 27 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-03 — traceability table populated by roadmapper; all 27 v1 requirements mapped*
