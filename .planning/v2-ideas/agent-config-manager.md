# Direction — Agent Configuration Manager (Claude Code first, then Codex, then others)

> **Status: DIRECTION captured for a LATER PHASE** (operator decision 2026-06-21). Not
> scheduled, not committed to a milestone yet — a deliberate product-expansion direction to
> plan when v1.1 polish + the Phase-12 gap-closure are settled. Raised by the operator while
> the design-audit remediation waves were in flight.

## What was requested

Extend Just-Wrapper beyond a terminal **session** manager so it can also **manage the
configuration of the coding agents it runs** — in priority order:

1. **Claude Code first** — manage **skills**, **hooks**, and **other settings** (e.g.
   `settings.json`, `~/.claude/`, project-level `.claude/`, MCP servers, slash commands,
   sub-agents, status line, permissions).
2. **Then Codex** — the equivalent config surface for Codex.
3. **Then all other agents** — a general pattern that further coding agents plug into.

## Why it fits the product

The app's whole reason for existing is running coding-agent workflows — `claude --rc`,
`codex`, REPLs, dev servers — each in its own labeled session (see `CLAUDE.md` Core Value).
Today it manages the *sessions*; it does **not** manage the *agents' configuration*. Those
configs (skills/hooks/settings) are exactly what shape how `claude` / `codex` behave inside
each session. Putting that management one layer up — in the wrapper that already launches
them — is a natural adjacency: configure the agent and run it in the same place.

This is a **value-prop expansion**: "terminal session manager" → "**control surface for your
coding agents**" (run them *and* tune them).

## Phased shape (rough — to be designed when scheduled)

- **Phase A — Claude Code config (MVP of this direction).**
  Read/visualize then edit the Claude Code config surfaces: skills, hooks, `settings.json`,
  permissions, MCP servers, sub-agents, slash commands. Global (`~/.claude/`) **and**
  project (`.claude/`) scope, clearly distinguished. Safe editing (validation + backups +
  diff-before-apply) because hooks/settings are powerful and easy to break.
- **Phase B — Codex config.** Same shape, Codex's config model.
- **Phase C — pluggable for other agents.** Generalize A/B into an agent-config adapter so a
  new agent is "add an adapter," not "rebuild the UI."

## Open questions to resolve before planning (do NOT decide now)

- **Surface:** a dedicated "Agents/Config" mode/panel? per-session config? a global settings
  area? How does it relate to the existing per-session **profile** (name/icon/cwd/shell/
  startupCommand)?
- **Scope & safety:** editing `~/.claude/` and project `.claude/` touches powerful machinery
  (hooks run code; settings change permissions). Needs validation, backups, undo, and a
  clear "you are editing a hook that runs on every tool call" warning. This is closer to a
  config editor than to terminal I/O — different risk profile than v1.
- **Boundary vs Core Value:** this must NOT compromise real terminal fidelity (the v1 Core
  Value). Config management is an *additional* surface, not a change to how sessions run.
- **Source of truth / sync:** the agent reads its config from disk on launch — does the app
  edit files in place, hot-reload, or require a session restart to pick up changes?
- **Discovery:** auto-detect installed agents + their config locations (cross-platform:
  macOS `~/.claude`, Windows `%USERPROFILE%\.claude`, etc.).
- **Read-only first?** A safe v0 could *visualize* skills/hooks/settings (no editing), then
  add guarded editing once the model is proven.

## Relationship to existing artifacts

- Distinct from `command-composer-agent-shell.md` (that's an in-terminal input editor; this is
  agent **configuration** management).
- Will need its own milestone + GSD `/gsd-new-milestone` → roadmap when promoted from
  direction → scheduled work.

## Next action (when the operator decides to schedule it)

Promote this doc into a milestone: run the GSD project/milestone flow to turn this direction
into PROJECT/REQUIREMENTS/ROADMAP for an "Agent Config Manager" milestone, starting with
Phase A (Claude Code, likely read-only-first).
