# Just-Wrapper — Local Terminal Session Manager

## What This Is

A local Windows desktop app that wraps multiple **real, PTY-backed terminal sessions** behind a clean side-tab interface. Each session has a stable identity (custom name + icon + status) and can be switched to instantly without killing its running process. It is built for coding-agent workflows — running tools like `claude --rc`, `codex`, REPLs, and dev servers across different projects, each in its own clearly-labeled session.

It is **not** a new shell and **not** a full terminal replacement. It is a session *manager* that sits on top of the user's existing shells (PowerShell, CMD, Git Bash, WSL).

## Core Value

**Real terminal fidelity.** A session inside the wrapper must behave *exactly* like a native local terminal — `claude --rc`, `codex`, `vim`, `ssh`, `python`, and `npm run dev` all work flawlessly. If this fails, nothing else matters. Stable session identity and instant non-destructive switching are the strong second priority.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. All are hypotheses until shipped. -->

- [ ] Create terminal sessions with custom name, icon, working directory, shell, and optional startup command
- [ ] Stable internal session ID that survives rename/icon-change/restart/tab-switch — distinct from the underlying PTY process ID
- [ ] Real interactive terminal surface via a true PTY (not one-shot command execution) — full keyboard input, Ctrl+C/Ctrl+D, arrow keys, copy/paste, resize, ANSI colors, long-running and interactive programs
- [ ] Collapsible sidebar listing sessions (icon + name + running/stopped status), with icon still identifying the session when collapsed
- [ ] Switch active session without stopping or restarting its process; keep background sessions alive
- [ ] Normal shell mode (no auto-command) plus optional startup-command mode; start in a configured working directory; manual `cd` and launch tools from any accessible folder
- [ ] Stop and restart a session (new process ID, same logical session ID); show status (not started / running / stopped / exited / error)
- [ ] Persist session metadata locally (ID, name, icon, cwd, shell, startup command, order, last active) and restore profiles on app reopen
- [ ] Persist user's session order in the sidebar
- [ ] Package as a local Windows desktop app

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
- **Development vs. target environment:** This planning session runs on macOS, but the **primary dev machine and the only MVP target is Windows**. PTY behavior relies on Windows ConPTY; native modules (e.g. `node-pty`) must be built for Windows. The actual app build/test happens on Windows.
- **Shells to support:** PowerShell, CMD, Git Bash, WSL — the user picks per session.
- **Identity model is foundational:** three distinct concepts must never be conflated — logical session ID (stable, app-level), terminal process ID (temporary PTY/process), and user-visible identity (name + icon + status).
- **Canonical validation scenario** (Section 8 of the spec): create a session `Name: Parlour Claude RC`, `Icon: 🛋️`, `Path: D:/Project/Ongoing/Marketing-parlour-room`, `Command: claude --rc`, then interact with it inside the app exactly like a native terminal. Also: open a normal shell session, `cd` freely, and launch `codex` / `claude --rc` from any accessible folder.

## Constraints

- **Platform**: Windows only for MVP — PTY layer must use ConPTY; native PTY modules built for Windows. No macOS/Linux target yet.
- **Tech stack**: Desktop framework (Electron vs. Tauri) deferred to the research phase, which will recommend with rationale. Terminal rendering expected via a mature emulator (e.g. xterm.js). PTY via a real pseudo-terminal layer (e.g. node-pty/ConPTY), not command-capture.
- **Persistence**: Local-only. No cloud, no remote services, no telemetry. Session metadata stored on disk.
- **Packaging**: Simple local desktop packaging — installable/runnable Windows app, no app-store or distribution pipeline required for MVP.
- **Architecture**: Logical session ID must be decoupled from PTY process ID; restarting a process must preserve the logical ID.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Target Windows only for MVP | User's primary dev machine is Windows; spec is Windows-flavored (D:/, PowerShell, WSL). Avoids cross-platform PTY abstraction cost now. | — Pending |
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
*Last updated: 2026-06-03 after initialization*
