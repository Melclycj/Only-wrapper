# Phase 6: Robustness + Flow-Control Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 6-Robustness + Flow-Control Polish
**Areas discussed:** Spawn/cwd errors (SC2), Waiting-for-input → agent-state status (SC4/TERM-09), Header controls (SC5/TERM-12), Alt-screen reset (SC3)

---

## Pre-discussion — Todo folding

| Todo | Area / score | Folded? |
|------|--------------|---------|
| Improve Start control discoverability for live sessions | ui / 0.9 | ✓ |
| Address deferred code-review findings from phase 05.1 | general / 0.6 | ✓ |
| Edit modal does not prefill saved cwd and startup command | ui / 0.9 | ✓ |
| Add folder picker for working directory selection | ui / 0.9 | ✓ |

**User's choice:** Fold all four.
**Notes:** Start-discoverability folds into the header-controls work (TERM-12); 05.1 findings fit the "robustness" theme; edit-prefill + folder picker fold as session-UX polish.

---

## Spawn / cwd errors (SC2)

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Detection | Validate + catch | Pre-check cwd (reuse CR-01 guard) + try/catch pty.spawn() for everything else | ✓ |
| | Catch only | Wrap spawn in try/catch; surface OS error text | |
| | Validate cwd only | Pre-check cwd; don't catch other spawn failures | |
| Where shown | Badge + error card | Red error badge + tooltip AND an IdleCard-style error card in the pane | ✓ |
| | Badge + tooltip only | Sidebar badge + tooltip; pane stays idle | |
| | Error card only | Card in pane; badge is generic red error | |
| Recovery | Edit + Retry | Error card offers Edit (existing modal) + Retry/Start | ✓ |
| | Retry only | Retry button; edit via context menu | |
| | Show only | Display message; fix via normal Edit flow | |
| Message | Specific cwd, generic else | Missing cwd → "Working directory not found: <path>"; else "Couldn't start session: <reason>" | ✓ |
| | Always generic | One catch-all message | |
| | You decide | Claude picks wording from DESIGN.md tone | |

**User's choice:** Validate + catch · Badge + error card · Edit + Retry · Specific cwd, generic else.
**Notes:** Message can reuse the 05.1 `onPtyStatus`/`notice` channel — no new bridge key.

---

## Waiting-for-input → agent-state status (SC4 / TERM-09)

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Trigger | Idle AND pattern | Quiet for threshold AND last line matches a prompt pattern (most conservative) | ✓ |
| | Idle only | Fire whenever a background session goes quiet | |
| | Pattern only | Fire on prompt pattern, no idle wait | |
| Patterns | Curated agent set | `?`, `[y/N]`/`[Y/n]`, `(y/n)`/`(yes/no)`, `❯` menus | ✓ |
| | Minimal (? and [y/N]) | Just `?` and `[y/N]` variants | |
| | You decide / research-tuned | Claude picks the regex from research | |
| Scope | Background only | Only non-active sessions | ✓ (later refined) |
| | All sessions | Also hint on the active session | |
| Display + clear | (original) Distinct dot / Reuse status color / You decide | — | ✗ → freeform redirect |

**User's choice (display question — freeform "Other"):** *"What is the current status color. I don't want to create a new status indicator for this needs-attention event. The status should highly reflect the agent's state, the current status set is still not clear. Which phase should I revise it."*

**Resolution:** Surfaced the current 5-state process colors (running/exited/stopped/not_started/error) and DESIGN.md's existing agent-state presentation layer (waiting/in-progress/finished/free). Confirmed: no separate indicator — the existing status dot/badge gains the agent-state overlay; "waiting" = amber; the revision belongs in **this** phase (TERM-09 is where the agent-state layer lands). Two follow-ups asked:

| Follow-up | Option | Selected |
|-----------|--------|----------|
| Status scope | Full running sub-states (blue In progress / amber Waiting / slate Free from one detector) | ✓ |
| | Waiting overlay only (SC4-minimal) | |
| | You decide | |
| Clear when | State-driven only (clears when condition ends; viewing doesn't fake-clear) | ✓ |
| | Also clear on view (acknowledge) | |
| | You decide | |

**Notes:** "Background only" refined — the agent-state is the session's real state, computed for all running sessions and shown everywhere; the no-nag intent is honored by state-driven clearing, not by hiding it. Detector location (main vs renderer) + idle threshold left to research.

---

## Header controls + lifecycle (SC5 / TERM-12)

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Controls | Contextual Start/Restart + Clear | Clear always; Restart when running, Start ▶ when not; Close stays destructive in menu; no new Stop | ✓ |
| | Add non-destructive Stop too | + a Stop that keeps the row as `stopped` (partly reverses D-03a) | |
| | You decide | | |
| Clear | Clear xterm scrollback, leave shell | Client-side clear, no PTY injection | ✓ |
| | Send clear to the shell | Inject Ctrl+L/`clear` | |
| | You decide | | |
| Keyboard | Focusable buttons + Clear chord | Tab-focusable + Cmd+K (mac)/Ctrl+Shift+K (win) | |
| | Focusable buttons only | No global chords | |
| | You decide | Claude picks scheme consistent with Phase-4 + D-13 | ✓ |
| Start w/o cmd | Secondary menu item | Context-menu "Start without command" alongside Start ▶ | ✓ |
| | Modifier-click | Alt/Option-click Start | |
| | Idle-card toggle | Checkbox on the idle/error card | |

**User's choice:** Contextual controls · client-side Clear · keyboard = you decide · secondary menu item.
**Notes:** Claude's chosen keyboard scheme = focusable buttons + Clear chord Cmd+K / Ctrl+Shift+K (Ctrl+K avoided on Windows = readline kill-line), reusing the D-13 app-wins interception; Restart button-only.

---

## Alt-screen reset (SC3) + remaining folded todos

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Alt-screen reset | On restart | Reset before restarted PTY's first output | |
| | On restart + abnormal exit | Also reset when a process dies abnormally | ✓ |
| | You decide | | |
| 05.1 review list | Behavioral WARNINGs | WR-01/02/03 only | |
| | All 8 findings | 5 WARN + 3 INFO | ✓ |
| | You decide | | |
| Edit prefill | Hydrate record from main | Refresh renderer record from main snapshot (no new key) | |
| | getSessionProfile IPC on open | One new bridge key | |
| | You decide | Claude keeps main authoritative without widening bridge | ✓ |
| Folder picker | Yes — add pickDirectory | dialog.showOpenDialog + one new bridge key + guard lockstep | ✓ |
| | Skip for now | | |
| | You decide | | |

**User's choice:** Reset on restart + abnormal exit · all 8 review findings · edit-prefill = you decide · add folder picker.
**Notes:** Reset mechanism (term.reset vs explicit sequence) left to research. Edit-prefill preferred approach = hydrate from main snapshot (no new key). Folder picker is the only intentional new bridge key.

---

## Claude's Discretion

- Idle threshold for the "Waiting" heuristic (low-single-digit seconds).
- Agent-state detector location: main (`onPtyStatus` payload field) vs renderer (per-session data stream) — no new bridge key either way.
- Exact alt-screen reset mechanism + exact prompt regex set.
- Header keyboard scheme (resolved to Cmd+K / Ctrl+Shift+K Clear chord).
- Edit-modal prefill fix approach (preferred: hydrate from main snapshot).
- SC1 backpressure validation + resolving the SessionView vs TerminalPane flow-control duplication.

## Deferred Ideas

- Windows ready-detection + shell enumeration → Phase 8.
- Non-destructive Stop (Start↔Stop keep-as-`stopped`) → declined to preserve D-03a; possible later refinement.
- Terminal search (Ctrl+F) + scrollback-size config → Phase 7.
</content>
