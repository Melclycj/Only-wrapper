# Phase 5: Persistence + Shell Discovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 5-Persistence + Shell Discovery
**Areas discussed:** Reviving sessions, Shell discovery, Ordering / reorder, First-run & prefs

---

## Reviving sessions

The user opened by challenging the premise — "why store sessions at all? when using
a terminal we close and reopen one as needed." This prompted a thinking-partner
exchange clarifying that Just-Wrapper is a session *manager*, and Phase 5 persists
session **profiles, not running processes** (the process stays disposable; the
named/iconed/foldered setup is what survives). The user then sharpened it: for
restore to be meaningful for *agents*, the session must remember the command +
folder and be able to relaunch — but the app currently has no connection to the
process, so that is either scope creep or a v2 feature. We disentangled three layers
(A: profile restore = no process coupling, in scope; B: auto-run the saved command =
TERM-05, an existing deferred requirement, still no agent coupling; C: resume the
agent's own conversation = v2, achievable via the user's own `claude --continue`).

### Q1 — Where should auto-running the stored command on start (Layer B / TERM-05) go?

| Option | Description | Selected |
|--------|-------------|----------|
| Next phase, on its own | Phase 5 = persistence + shell discovery only; TERM-05 its own next increment (shell-ready-timing research) | ✓ |
| Pull into Phase 5 now | Un-defer TERM-05; full "resume my agent" experience, bigger/riskier phase | |
| Truly defer to v2 | Persistence only; auto-run out indefinitely | |

**User's choice:** Next phase, on its own.
**Notes:** Layer A (profile restore) in scope regardless; Layer C (agent-state
awareness) out regardless. `claude --continue` as a saved command gives power users
resume without app coupling.

### Q2 — How should the user trigger start of a restored (not_started) session?

| Option | Description | Selected |
|--------|-------------|----------|
| Click row = start (lazy) | Clicking a dormant row selects AND spawns; zero new UI | |
| Explicit Start (▶) | Click = select/view only; ▶ control + menu "Start" spawns | ✓ |
| Both | Click shows a Start prompt in the pane; Start control also present | |

**User's choice:** Explicit Start (▶).
**Notes:** Menu action reads "Start" when not_started, "Restart" once it has run.

### Q3 — What should the terminal area show for a selected-but-not-started session?

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder + Start | Identity + big ▶ Start button | |
| Placeholder + saved info | Identity + saved folder/shell/command (read-only) + ▶ Start | ✓ |
| Blank pane | Empty terminal area until started | |

**User's choice:** Placeholder + saved info (a session card; command is displayed,
not executed).

---

## Shell discovery

### Q1 — What should the shell field become once discovery exists?

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown + custom path | Discovered list + "Custom path…" free-text escape hatch | |
| Dropdown only | Discovered list, no free-text | ✓ |
| Free-text + suggestions | Keep free-text primary, discovered shells as autocomplete | |

**User's choice:** Dropdown only.
**Notes:** Supersedes Phase 4 D-06 (free-text). Safety rule added: the dropdown must
always include the resolved `$SHELL` so it can never be empty/unusable.

### Q2 — How should the macOS shell dropdown be populated (no hardcoded paths)?

| Option | Description | Selected |
|--------|-------------|----------|
| /etc/shells + $SHELL | OS registry of valid login shells + always include $SHELL | ✓ |
| Curated set, probed | Known set (zsh/bash/sh/fish) found via PATH lookup | |
| Everything shell-like on PATH | Broadest scan of PATH | |

**User's choice:** /etc/shells + $SHELL.

### Q3 — How should Phase 5 handle Windows shell discovery (untestable until P8)?

| Option | Description | Selected |
|--------|-------------|----------|
| Abstraction now, Windows at P8 | Build ShellDiscovery seam + tested macOS provider; Windows enumeration verified at Phase 8 | ✓ |
| Full Windows now (untested) | Implement Windows discovery now, unverified until packaging | |
| macOS only; move Win SC4 to P8 | No Windows code/seam; edit the success criterion | |

**User's choice:** Abstraction now, Windows at Phase 8.

---

## Ordering / reorder

### Q1 — What reorder capability should Phase 5 include (NAV-04/SC3 "custom ordering")?

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-to-reorder + persist | Sidebar drag-and-drop, persist order | ✓ |
| Move up/down + persist | Context-menu/arrow move, persist order | |
| Persist insertion order only | No reorder UI; persist creation order | |

**User's choice:** Drag-to-reorder + persist.
**Notes:** Collapsed icon-rail DnD behavior left to planner's discretion.

### Q2 — On reopen, which session is selected/shown first?

| Option | Description | Selected |
|--------|-------------|----------|
| Last-active session | Select the last-used session (uses lastActive) | |
| First session | Select the top of saved order | ✓ |
| Nothing selected | Neutral empty state until a click | |

**User's choice:** First session. `lastActive` still persisted but not the focus driver.

---

## First-run & prefs

### Q1 — When there are no saved sessions (first run, or all closed), what should the app show?

| Option | Description | Selected |
|--------|-------------|----------|
| Welcome / empty state | "Create a session" CTA, nothing auto-spawned | ✓ |
| Seed one default session | Auto-create one dormant default | |
| Seed + auto-start one | Auto-create AND start one (closest to today) | |

**User's choice:** Welcome / empty state. Replaces current auto-add-on-empty boot behavior.

### Q2 — Should a NEW session (via +) start live or be created dormant?

| Option | Description | Selected |
|--------|-------------|----------|
| Start live immediately | Keep Phase 4 quick-add; create = live, restore = dormant | ✓ |
| Create dormant, then ▶ | Everything starts dormant for uniformity | |

**User's choice:** Start live immediately.

### Q3 — Which UI prefs should persist beyond session profiles? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar collapse state | Remember collapsed/expanded (Phase 4 D-11 home) | ✓ |
| Window size & position | Remember window bounds (beyond PERS-01) | ✓ |

**User's choice:** Both.

### Q4 — When should session state be written to disk?

| Option | Description | Selected |
|--------|-------------|----------|
| On change (debounced) + quit | Debounced writes + guaranteed quit flush | ✓ |
| On quit only | One write at quit; loses changes on crash | |
| On every change, immediately | Synchronous per-change; write storms on reorder | |

**User's choice:** On change (debounced ~300ms) + flush on quit.

---

## Claude's Discretion

- Storage engine + location (lowdb under `app.getPath('userData')`; not yet installed — add it).
- Persisted-store schema versioning / migration approach.
- Corrupt/unreadable file handling (back up + start fresh; never crash).
- Collapsing/replacing the `SessionManager.tsx` reconcile poll with the persisted snapshot.
- SC2 mechanic: on load, coerce every restored session to `not_started` and clear `ptyPid`.
- Idle-card / empty-state / Start-control visual treatment (DESIGN.md tokens).
- Collapsed icon-rail drag-to-reorder behavior.
- New persistence/discovery IPC surface (extend typed bridge + guard test in lockstep).

## Deferred Ideas

- **TERM-05** — auto-run the stored startup command on start → its own next increment after Phase 5 (needs roadmap slot + shell-ready research).
- **Layer C** — app-level agent conversation/state resume → v2 (covered via user's `claude --continue`).
- **Windows shell enumeration** → Phase 8 (behind the ShellDiscovery seam built now).
- **`lastActive`-based MRU restore focus** — field persisted; restore focus is "first in order" for now.
