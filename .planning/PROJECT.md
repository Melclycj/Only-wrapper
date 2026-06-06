# Just-Wrapper — Local Terminal Session Manager

## What This Is

A cross-platform local desktop app (Windows + macOS) that wraps multiple **real, PTY-backed terminal sessions** behind a clean side-tab interface. Each session has a stable identity (custom name + icon + status) and can be switched to instantly without killing its running process. It is built for coding-agent workflows — running tools like `claude --rc`, `codex`, REPLs, and dev servers across different projects, each in its own clearly-labeled session.

It is **not** a new shell and **not** a full terminal replacement. It is a session *manager* that sits on top of the user's existing shells (PowerShell, CMD, Git Bash, WSL on Windows; zsh, bash on macOS).

## Core Value

**Real terminal fidelity.** A session inside the wrapper must behave *exactly* like a native local terminal — `claude --rc`, `codex`, `vim`, `ssh`, `python`, and `npm run dev` all work flawlessly. If this fails, nothing else matters. Stable session identity and instant non-destructive switching are the strong second priority.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- [x] Switch active session without stopping or restarting its process; keep background sessions alive with current scrollback — *Phase 3 (TERM-06; user-verified keep-alive + scrollback)*
- [x] Restart a session (new process ID, same logical session ID) and show the 5-state status (not started / running / stopped / exited / error) with DESIGN.md badge colors — *Phase 3 (TERM-07/08)*
  - Note: "stop" shipped as a **destructive Close + confirm modal** (D-03a revision at the Phase-3 verify checkpoint), not a keep-as-`stopped` row. The auto-run **startup command (TERM-05) was deferred** — the `startupCommand` profile field persists for the Phase 4 create/edit form.
- [x] Create / edit terminal sessions with a custom name, icon (emoji + color badge), working directory, shell, and startup command via a real form — *Phase 4 (SESS-01..04; name/icon apply live, cwd/shell/startup apply on restart; startup-command auto-run TERM-05 still deferred — field is stored only)*
- [x] Stable internal session ID that survives rename / icon-change / restart / tab-switch — distinct from the PTY process ID — *Phase 1 (IDENT-01/02) + Phase 4 (IDENT-03; rename/re-icon preserve logicalId, human-verified)*
- [x] Collapsible sidebar listing sessions (icon + name + status), icon still identifies each session when collapsed, plus mouse-free keyboard session switching — *Phase 4 (NAV-01/02/03/05; Cmd/Ctrl+1–9 + Shift+[ / ] "app-wins" over the focused terminal)*
- [x] Persist session metadata locally and restore profiles on app reopen — sessions reappear dormant (`not_started`, never `running`) in saved order with name/icon/cwd/shell/startup command intact, written through lowdb (debounced + quit-flushed, coerce-on-load, corrupt-file recovery) — *Phase 5 (PERS-01/02; SessionStore + PtyManager.hydrate dormant-restore + lifecycle wiring; close→reopen round-trip proven in the built app)*
- [x] Persist the user's custom sidebar session order across restarts via drag-to-reorder (dnd-kit, validate-in-main `persistOrder`) — *Phase 5 (NAV-04)*
- [x] Platform-aware shell selection — the session form shell field is a discovered `<select>` populated from the OS (macOS reads `/etc/shells` with `$SHELL` defaulted; no hardcoded paths), behind a provider seam — *Phase 5 (PERS-02 macOS; Windows provider is an intentional stub for Phase 8)*

### Active

<!-- Current scope. Building toward these. All are hypotheses until shipped. -->

- [ ] Real interactive terminal surface via a true PTY (not one-shot command execution) — full keyboard input, Ctrl+C/Ctrl+D, arrow keys, copy/paste, resize, ANSI colors, long-running and interactive programs
- [ ] Normal shell mode plus a configured working directory; manual `cd` and launch tools from any accessible folder. *(Optional startup-command auto-run un-deferred to Phase 5.1 — TERM-05.)*
- [ ] Platform-aware shell selection for **Windows** (PowerShell/CMD/Git Bash/WSL) — provider seam shipped in Phase 5; Windows discovery deferred to Phase 8
- [ ] Package as a local desktop app for both Windows and macOS from one codebase

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Browser extension / companion (link tab to session, show tab title/URL/favicon) — explicitly deferred to a later optional feature, kept fully separate from the MVP
- ChatGPT content reading / idle-vs-generating detection — privacy-sensitive and out of MVP scope
- AI automation — not the product; the app hosts agents, it doesn't drive them
- Cloud sync / multi-device support — local-only by design
- SSH connection management — users can run `ssh` *inside* a session, but the app doesn't manage SSH
- Plugin system — keeps MVP surface small
- Warp-style command blocks — this is a session manager, not a reinvented terminal
- Custom uploaded icon files (SVG/PNG) — emoji + built-in icon list + color badge is enough for MVP
- Live terminal process recovery after full app quit — restore *profiles* only; user restarts sessions manually

## Context

- **Use case:** Managing many concurrent coding-agent and dev sessions (e.g. `claude --rc`, `codex`, `npm run dev`) across multiple projects, each needing a distinct, recognizable identity so the user never loses track of which session is which.
- **Development & target environment:** Cross-platform (Windows + macOS). Development and testing happen natively on macOS (the machine in hand), and the same codebase runs on the user's Windows machine. This is deliberate: the Core Value is terminal fidelity, and it must be testable where it's built. `node-pty` abstracts the OS PTY (ConPTY on Windows, forkpty on macOS) behind one API, so the terminal core is single-codepath; platform differences live at the edges (shell list, paths, packaging, native rebuilds).
- **Shells to support:** PowerShell, CMD, Git Bash, WSL on Windows; zsh, bash on macOS — the user picks per session, defaults are platform-aware.
- **Identity model is foundational:** three distinct concepts must never be conflated — logical session ID (stable, app-level), terminal process ID (temporary PTY/process), and user-visible identity (name + icon + status).
- **Canonical validation scenario** (Section 8 of the spec): create a session `Name: Parlour Claude RC`, `Icon: 🛋️`, `Path: D:/Project/Ongoing/Marketing-parlour-room`, `Command: claude --rc`, then interact with it inside the app exactly like a native terminal. Also: open a normal shell session, `cd` freely, and launch `codex` / `claude --rc` from any accessible folder.

## Constraints

- **Platform**: Cross-platform — Windows + macOS from a single codebase. PTY layer must work via ConPTY on Windows and forkpty on macOS (e.g. `node-pty`, which abstracts both). Linux is not a target but should not be actively precluded. Code must stay OS-agnostic except at explicit platform-aware edges (shell defaults, path handling, packaging).
- **Tech stack**: Desktop framework (Electron vs. Tauri) deferred to the research phase, which will recommend with rationale — cross-platform packaging quality is now a selection criterion. Terminal rendering expected via a mature emulator (e.g. xterm.js). PTY via a real cross-platform pseudo-terminal layer (e.g. node-pty), not command-capture.
- **Persistence**: Local-only. No cloud, no remote services, no telemetry. Session metadata stored on disk.
- **Packaging**: Simple local desktop packaging — installable/runnable Windows app, no app-store or distribution pipeline required for MVP.
- **Architecture**: Logical session ID must be decoupled from PTY process ID; restarting a process must preserve the logical ID.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cross-platform (Windows + macOS) | Dev/test happens on macOS but the user's primary machine is Windows; fidelity (Core Value) must be testable where it's built. `node-pty` already abstracts ConPTY vs forkpty, so the cost is modest and confined to the edges. | — Pending |
| Core Value = real terminal fidelity | Hosting `claude --rc`, `codex`, vim, ssh, REPLs correctly is the whole point; a fake/captured terminal would be useless. | — Pending |
| Real PTY layer (not run→capture→return) | Interactive programs require a live pseudo-terminal; one-shot execution can't support them. | — Pending |
| Decouple logical session ID from process ID | Identity must survive restarts, renames, and tab switches; process IDs are inherently temporary. | — Pending |
| Desktop framework chosen via research | User has no strong preference (Electron vs Tauri); let research recommend based on PTY integration + packaging weight. | — Pending |
| Browser companion deferred / kept separate | Explicitly out of MVP to protect scope and privacy; lives as a future optional feature. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-06 — Phase 5 complete (persistence + shell discovery: lowdb SessionStore with debounced/quit-flushed writes + coerce-on-load + corrupt recovery, dormant-restore via PtyManager.hydrate, window-bounds restore, shell-discovery `<select>` from `/etc/shells`, IdleCard + WelcomeEmptyState, drag-to-reorder via dnd-kit with validate-in-main persistOrder; verified 4/4 success criteria. 2 post-review criticals fixed inline — dormant-edit persistence (CR-02) + shell/cwd allowlist validation on the persist boundary (CR-01). 3 manual-UAT items pending in 05-HUMAN-UAT.md. Next: Phase 5.1 — TERM-05 startup-command auto-run.)*
