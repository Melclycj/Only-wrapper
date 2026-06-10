# Phase 2: PTY Core + Terminal Fidelity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 2-PTY Core + Terminal Fidelity
**Areas discussed:** Shell & env fidelity, Startup trigger, Copy/paste & selection, Scrollback & exit state

---

## Shell & Environment Fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Login + interactive $SHELL, full env | Spawn $SHELL (→ /bin/zsh) as login+interactive so .zprofile AND .zshrc run; PATH matches Terminal.app; inherit full parent env | ✓ |
| Interactive, non-login | Loads .zshrc only; faster but misses PATH set in .zprofile (Homebrew/nvm) → tools may not be found | |
| Curated / minimal env | Sanitized env + known-good PATH; predictable but diverges from the user's real terminal | |

**User's choice:** Login + interactive $SHELL, full env
**Notes:** Drives the canonical `claude --rc` / `codex` scenario — tools must resolve on PATH exactly like the native terminal. TERM forced to xterm-256color.

---

## Startup Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-start a live shell on launch | App boots straight into a running shell (cwd = home); no gating click | ✓ |
| Show a 'Start terminal' button first | Shell spawns on click; closer to the future create-session flow but adds a step | |
| You decide | Pick whatever best proves the terminal works | |

**User's choice:** Auto-start a live shell on launch
**Notes:** One session this phase; goal is to prove native fidelity immediately. cwd defaults to home (no creation UI yet). Stop/restart = Phase 3.

---

## Copy / Paste & Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Cmd+C / Cmd+V + right-click paste | Standard macOS terminal feel; bracketed paste; Ctrl+C stays SIGINT; no copy-on-select | ✓ |
| Add iTerm-style copy-on-select | Auto-copy selection on mouse-up; power-user favorite but can surprise / clobber clipboard | |
| You decide | Most native, least-surprising default | |

**User's choice:** Cmd+C / Cmd+V + right-click paste
**Notes:** Bracketed-paste safety (multi-line doesn't auto-execute) already locked by SC2.

---

## Scrollback & Exit State

| Option | Description | Selected |
|--------|-------------|----------|
| 10,000 lines | Matches iTerm/VS Code defaults; ample history, modest memory | ✓ |
| 1,000 lines | Light memory but verbose output scrolls away fast | |
| 50,000 lines | Deep history, higher memory per session | |

**User's choice:** 10,000 lines
**Notes:** On shell exit, show a passive "process exited" notice (no auto-restart — restart UI is Phase 3). 50 MB-`cat` responsiveness handled by flow-control, not buffer size.

---

## Claude's Discretion

- Renderer = single full-window xterm pane, default monospace font (font config is v2), block cursor; no sidebar/header chrome (Phase 4).
- xterm 5.5 + addons fit/webgl(+canvas fallback)/web-links/unicode11; truecolor on.
- IPC: extend the typed `window.api` contextBridge surface with PTY channels (no raw ipcRenderer); channel naming + byte encoding → research/planner.
- Resize debounce → fit → `pty.resize` within the 1 s SC3 budget.
- Exact node-pty↔Electron 36.9.5 ABI pin, `.node` ASAR-unpack, and flow-control/backpressure for SC5 → research/planner.

## Deferred Ideas

None new. Routed to owning phases: stop/restart + status + startup command (Phase 3); multi-session/sidebar/identity (Phases 3/4); scrollback config/search/clear/needs-attention (later); font/theme (v2); Windows shells + packaging (Phase 8).
