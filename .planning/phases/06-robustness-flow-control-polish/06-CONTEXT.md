# Phase 6: Robustness + Flow-Control Polish - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the app against real-world failure modes and add the session-header quick
controls. Concretely, the five success criteria (ROADMAP.md §Phase 6):

- **SC1 — High-throughput backpressure** never freezes/crashes/drops; the
  HIGH/LOW watermark visibly pauses+resumes. **Already implemented** (Phase 2
  renderer watermark) — this phase *validates + hardens* it, it is not greenfield.
- **SC2 — Spawn/cwd error handling**: a non-existent working directory (or any
  failed spawn) shows status `error` with a clear human-readable message — never
  a silent spawn in `~`.
- **SC3 — Alt-screen reset**: a vim/less session killed without a normal exit
  shows a clean prompt on reopen — not a frozen alt-screen frame.
- **SC4 — "Waiting for input" indicator (TERM-09)**: a best-effort, heuristic
  needs-attention signal when a session's output goes idle after an agent
  confirmation-prompt pattern. **Reframed this phase** into DESIGN.md's
  agent-state status layer (see D-04..D-07) rather than a separate indicator.
- **SC5 — Header quick controls (TERM-12)**: single-click / keyboard-accessible
  Clear + Restart (+ contextual Start) in the session header.

**Requirements covered:** TERM-09, TERM-12.

**Core new behavior:** Phase 6 is the phase that finally builds DESIGN.md's
**agent-state presentation layer** (amber "Waiting for you" + the running
busy/idle split) on top of the existing 5-state *process* status, and turns the
identity-only header (Phase 4 D-05) into a control surface.

**Explicitly NOT in this phase:**
- **Windows ready-detection / shell enumeration** — stays behind the Phase-5/5.1
  seams; real Windows work is **Phase 8** (Windows isn't runnable on the dev
  machine). The agent-state heuristic + header controls are built/verified on
  macOS this phase.
- **Terminal search (Ctrl+F) + scrollback-size config** — **Phase 7** (TERM-10/11).
- **App-level agent conversation/state resume (Layer C)** — out of scope
  project-wide.
- **Reading agent/page *content* to detect generating-vs-idle** — out of scope
  (privacy line). The agent-state heuristic uses **PTY output-activity timing +
  last-line shape only**, never content interpretation.

</domain>

<decisions>
## Implementation Decisions

### Spawn / cwd error handling (SC2)
- **D-01: Detect via pre-validate cwd + try/catch spawn.** Before `pty.spawn()`,
  pre-check the resolved `cwd` exists and is a directory (reuse the CR-01 guard
  already used in `pty-manager.ts` `updateProfile`, ~lines 713-718) so the common
  case gets a *specific* message; ALSO wrap `pty.spawn()` itself in try/catch to
  catch everything else (bad shell path, `EACCES`, etc.). Today `create()` calls
  `pty.spawn()` with neither guard.
- **D-02: Failed spawn → status `error` + a clear message, never silent `~`.**
  The resolved cwd must NOT silently fall back to home when invalid (the current
  fallback chain `opts.cwd || prior.cwd || os.homedir()` must not mask a
  *user-specified* missing cwd — distinguish "no cwd given → home is fine" from
  "cwd given but missing → error").
- **D-03: Surface in BOTH places — red `error` badge + error card.** The sidebar
  row shows status `error` (red badge) with the message as a tooltip, AND the
  terminal pane shows an **error card** (reuse the `IdleCard` placeholder pattern)
  with the full message.
- **D-04 (recovery): Error card offers Edit + Retry.** "Edit" opens the existing
  edit modal (fix cwd/shell); "Retry"/Start re-attempts the spawn. Turns a
  dead-end into a fixable state without recreating the session.
- **D-05 (message): specific for cwd, generic fallback otherwise.** Missing cwd →
  `Working directory not found: <path>`; any other spawn failure →
  `Couldn't start session: <os reason>`. Exact wording = DESIGN.md tone.
- **Transport:** the message SHOULD ride the existing `onPtyStatus` channel via
  the optional `PtyStatusPayload.notice` field added in 05.1 — **zero new bridge
  keys** (mirrors the 05.1 ready-fail notice pattern). Planner's call, but the
  precedent is strong.

### Agent-state status layer (SC4 / TERM-09) — replaces "separate indicator"
- **D-06: NO new/separate needs-attention indicator.** The existing status
  dot/badge gains DESIGN.md's **agent-state presentation layer** (an overlay over
  the 5 *process* statuses, NOT a 6th process status). This was a direct user
  decision: "I don't want a new status indicator… the status should reflect the
  agent's state." DESIGN.md §"Status system" + §"Reconciliation notes" already
  specify exactly this.
- **D-07: Full running sub-states from one shared output-activity detector.**
  A `running` session is presented as one of three agent-states, all derived from
  the SAME detector:
  - **blue "In progress"** — output actively flowing.
  - **amber "Waiting for you"** (`oklch(0.66 0.15 60)`) — idle **AND** last
    non-empty line matches a confirmation-prompt pattern (this is TERM-09 / SC4).
  - **slate "Free"** — idle, no prompt-pattern match.
  (`exited`→green "Done", `not_started`/`stopped`→slate, `error`→red are unchanged.)
- **D-08: Trigger = idle AND pattern (most conservative).** Fire "Waiting" only
  when output has been quiet for the idle threshold AND the trailing line matches
  the prompt set — fewest false positives for a best-effort signal.
- **D-09: Curated agent prompt set.** Trailing `?`, `[y/N]` / `[Y/n]`
  (case-insensitive), `(y/n)` / `(yes/no)`, and arrow-menu markers (`❯`). Tuned
  for `claude --rc` / `codex` confirmations; kept tight. Exact regex set may be
  research-tuned against real cold zsh/bash captures (stay conservative).
- **D-10: State-driven clearing only (no acknowledge-on-view).** Amber clears
  automatically when the session leaves the waiting condition — new output → "In
  progress", or quiet-without-prompt → "Free". It's the session's *real* state,
  not a notification, so merely viewing it does NOT fake-clear it. This is how the
  user's original "background only / don't nag the active session" instinct is
  honored: the state is computed for ALL running sessions and shown on every
  sidebar row + the header, but it never nags because it's honest state, and the
  session you're in you can simply see.

### Header quick controls + lifecycle (SC5 / TERM-12)
- **D-11: Contextual controls in the header.** Header (`IdentityHeader.tsx`,
  identity-only today per Phase 4 D-05) gains a control cluster: **Clear** always;
  **Restart** when running; **Start ▶ when not running** (this fixes the folded
  *Start-control-discoverability* todo). Destructive **Close** stays in the
  right-click context menu. **No new non-destructive Stop** — Phase-3 D-03a
  (destructive Close + retained-but-unbuttoned `PtyManager.stop`) stays intact.
- **D-12: "Clear" = client-side xterm scrollback clear, no shell injection.**
  Clear the session's kept-alive xterm buffer/scrollback (iTerm/VSCode Cmd+K
  semantics — current prompt preserved); do NOT inject `clear`/Ctrl+L into the
  PTY. No separate main-side replay buffer exists (the kept-alive xterm instance
  IS the buffer — Phase 3 keep-alive), so there is nothing else to clear (planner
  to confirm).
- **D-13: Keyboard — focusable buttons + a Clear chord.** Controls are
  Tab-focusable buttons (Enter/Space activates → satisfies SC5
  "keyboard-accessible"), PLUS a Clear chord: **Cmd+K (macOS) / Ctrl+Shift+K
  (Windows)**. Ctrl+K is deliberately avoided on Windows (it is readline
  kill-line). Reuse the Phase-4 D-13 "app-wins" before-input-event interception.
  Restart stays button-only (no global chord). *(User said "you decide" on the
  exact scheme — this is Claude's chosen scheme; planner may adjust within D-13.)*
- **D-14: "Start without running the command" (un-defers 05.1 D-07) = secondary
  menu item.** Primary Start ▶ runs the saved startup command (unchanged); a
  **"Start without command"** item in the row context menu / overflow spawns a
  bare shell in the saved cwd/shell, skipping TERM-05 auto-run for that launch.

### Alt-screen reset (SC3)
- **D-15: Reset the terminal on restart AND on abnormal exit.** Restart resets
  before the new PTY's first output (the literal "reopen shows a clean prompt"
  path); abnormal exit (exited/error not user-initiated) also resets so the frozen
  alt-screen frame is cleared proactively. Mechanism (`term.reset()` vs an
  explicit exit-alt-screen + clear sequence `\x1b[?1049l`/RIS) = research/Claude's
  call.

### Backpressure validation (SC1)
- **D-16: Validate, don't rebuild.** The renderer HIGH/LOW watermark
  (`flow-control.ts` + `SessionView.tsx`, FLOW_HIGH=100000/FLOW_LOW=10000) already
  exists (Phase 2-04). This phase proves SC1 under `cat /dev/urandom | head -c
  100M` (no freeze / crash / drop, visible pause+resume) and resolves the
  **flow-control duplication** between `SessionView.tsx` and `TerminalPane.tsx`
  (which is the live path? is `TerminalPane` still used?) — research to confirm.

### Claude's Discretion
- The idle threshold for D-08 (a sensible low-single-digit-seconds bound).
- Where the agent-state detector lives — **main** (compute on the PTY data
  stream, broadcast via a `PtyStatusPayload` field — reuse `onPtyStatus`, no NEW
  bridge key) vs **renderer** (compute from the per-session `onPtyData` stream it
  already receives for every keep-alive pane — zero IPC). Constraint: never raw
  `ipcRenderer`; if a field is added, extend `PtyStatusPayload` like the 05.1
  notice (no new key).
- Exact alt-screen reset mechanism (D-15) and the exact prompt regex (D-09).
- Edit-modal prefill fix approach (see Folded Todos) — user said "you decide";
  keep main authoritative, prefer no new bridge key.
- The error-card / agent-state visual treatment from DESIGN.md tokens.

### Folded Todos
All four phase-matched todos were folded into Phase 6 scope:

- **Improve Start control discoverability for live sessions**
  (`.planning/todos/pending/2026-06-06-improve-start-control-discoverability-for-live-sessions.md`)
  — no visible Start/Stop on a live session (user must type `exit`). **Folded into
  D-11** (contextual header Start ▶ / Restart).
- **Address deferred code-review findings from phase 05.1**
  (`.planning/todos/pending/2026-06-06-address-deferred-code-review-findings-phase-05-1.md`)
  — 5 WARN + 3 INFO on the TERM-05 readiness probe. **Decision: fix ALL 8**
  (WR-01 dead invisibility-scrub path, WR-02 matcher false-positive /
  inject-before-ready, WR-03 unbounded probe buffer, WR-04 notice ctrl-char
  sanitize, WR-05 store-vs-inject trim consistency, IN-01/02/03). Full detail in
  `.planning/phases/05.1-term-05-startup-command-auto-run/05.1-REVIEW.md`.
- **Edit modal does not prefill saved cwd and startup command**
  (`.planning/todos/pending/2026-06-06-edit-modal-does-not-prefill-saved-cwd-and-startup-command.md`)
  — renderer `SessionRecord` not refreshed from main's truth. **Decision: Claude's
  discretion**, keeping main the source of truth — preferred approach is to
  hydrate the renderer record from main's `listSessions` snapshot after spawn and
  after `onSaveProfile` (no new bridge key) rather than a new `getSessionProfile`
  IPC.
- **Add folder picker for working directory selection**
  (`.planning/todos/pending/2026-06-06-add-folder-picker-for-working-directory-selection.md`)
  — **Decision: add it.** Main `dialog.showOpenDialog({ properties:
  ['openDirectory'] })`; expose a minimal `pickDirectory(): Promise<string|null>`
  (the only intentional NEW bridge key this phase — bump `EXPECTED_API_KEYS` +
  `security.guard.test.ts` in lockstep); "Browse…" button by the cwd field fills
  an absolute path. CR-01 still validates the value.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project intent & requirements
- `.planning/ROADMAP.md` §"Phase 6: Robustness + Flow-Control Polish" — goal +
  SC1–SC5 (the scope authority).
- `.planning/REQUIREMENTS.md` §"Terminal Session" — **TERM-09** (best-effort
  waiting-for-input) + **TERM-12** (header clear/restart controls), and the
  TERM-09/TERM-12 → Phase 6 traceability rows.
- `.planning/PROJECT.md` — Core Value (real terminal fidelity); the privacy
  Out-of-Scope line ("ChatGPT/page content reading … idle-vs-generating
  detection") which bounds the SC4 heuristic to PTY-timing/last-line shape only.

### UI / design (authority for SC4 status layer + SC5 header)
- `.planning/DESIGN.md` — **§"Status system (agent-state)"** (the 4 agent-states
  waiting/in-progress/finished/free + their oklch ramps and attention rank — the
  spec D-06/D-07 implement), **§"Reconciliation notes"** ("Waiting for you" = the
  TERM-09 heuristic, an overlay over the 5 process statuses, NOT a 6th status),
  and the v1 component-inventory rows for the **status dot/badge** and
  **"Needs-attention treatment" (`ApproveDeny`, "Needs your attention",
  `prompt`)**. **MUST read.**
- `.planning/design/switchboard-mockup.html` — source mockup; reference for the
  amber "waiting"/prompt treatment + header control affordances. Ignore its
  v2/out-of-scope screens.

### Prior-phase foundation being extended
- `.planning/phases/03-multi-session-session-lifecycle/03-CONTEXT.md` — the
  **5-state process status model** (TERM-08), the **restart** path + `— restarted
  HH:MM —` separator, **D-03a destructive Close + confirm** (the lifecycle model
  D-11 preserves), and the keep-alive xterm-per-session rendering (the buffer D-12
  clears).
- `.planning/phases/05-persistence-shell-discovery/05-CONTEXT.md` — **D-03/D-04**
  (the **Start ▶** action + **IdleCard** idle-pane pattern that SC2's error card
  reuses), dormant-restore model, the `ShellDiscovery`/`shell-resolver` seam.
- `.planning/phases/05.1-term-05-startup-command-auto-run/05.1-CONTEXT.md` —
  **D-07** ("Start without running the command" escape hatch explicitly deferred
  TO this phase → D-14); the **`onPtyStatus` `PtyStatusPayload.notice`** reuse
  pattern (zero new bridge keys) that SC2's message transport should follow.
- `.planning/phases/05.1-term-05-startup-command-auto-run/05.1-REVIEW.md` — the 8
  deferred review findings (WR-01..05, IN-01..03) folded into this phase.
- `.planning/phases/04-session-identity-sidebar-ui/04-CONTEXT.md` — **D-05**
  (header is identity-only — what D-11 changes), **D-13** ("app-wins" key
  interception D-13 here reuses for the Clear chord), the context-menu + edit-modal
  components D-14/edit-prefill touch.

### Code to extend (full relative paths)
- `src/main/pty-manager.ts` — `create()` (~line 229): add the D-01 cwd pre-check +
  try/catch around `pty.spawn()` (~261), the D-02 no-silent-home rule, and the
  D-15 abnormal-exit reset trigger; `deriveStatus`/`setStatus` (~162/474) for the
  `error` transition + message; `updateProfile` CR-01 guard (~713) is the
  validator to reuse. Also the home of the 05.1 readiness-probe findings (WR-*).
- `src/main/readiness-probe.ts` — WR-02 (matcher), WR-03 (bounded buffer),
  IN-02 (`void shellPath`) live here.
- `src/renderer/status-colors.ts` — **the core SC4 file**: extend `STATUS_STYLE`
  / add the agent-state presentation (amber "waiting" + running busy/idle split,
  D-06/D-07) from DESIGN.md ramps.
- `src/renderer/Sidebar.tsx` — per-row status dot/badge renders the agent-state;
  context menu hosts "Start without command" (D-14) + Close.
- `src/renderer/IdentityHeader.tsx` — gains the D-11 control cluster (Clear /
  Restart / contextual Start) + D-13 keyboard wiring.
- `src/renderer/SessionView.tsx` / `src/renderer/TerminalPane.tsx` — flow-control
  watermark (SC1 validation + dedup, D-16); the D-12 xterm clear + D-15 reset on
  restart/abnormal-exit act on the kept-alive xterm here.
- `src/renderer/IdleCard.tsx` — the placeholder pattern SC2's error card reuses
  (D-03/D-04) and where "Start without command" affordance may also surface.
- `src/renderer/SessionManager.tsx` — owns sessions/activeId/status subscriptions;
  hosts the agent-state aggregation, header-control wiring, and the edit-record
  hydration fix (folded todo).
- `src/renderer/SessionEditModal.tsx` / `src/renderer/session-add.ts` — the
  edit-prefill round-trip fix + the "Browse…" folder-picker button.
- `src/shared/flow-control.ts` — the watermark accountant (SC1).
- `src/shared/api-types.ts` + `src/preload/index.ts` + `src/main/window-config.ts`
  + `src/shared/__tests__/security.guard.test.ts` — the typed bridge + the
  `EXPECTED_API_KEYS` allowlist + the guard test. Update in **lockstep** for the
  one new `pickDirectory` key (folder picker); the SC2 message + agent-state
  SHOULD avoid new keys by extending `PtyStatusPayload` (reuse `onPtyStatus`).
- `src/shared/types.ts` — `SessionStatus` / `SessionRecord` / `PtyStatusPayload`
  (where an optional agent-state/notice field would live, if main-side).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`IdleCard.tsx`** — the dormant idle-pane placeholder; SC2's error card (D-03)
  is the same pattern with an error message + Edit/Retry.
- **CR-01 cwd guard** (`pty-manager.ts` `updateProfile` ~713-718) — absolute +
  existing-directory validation already written; reuse it as the SC2 pre-spawn
  check (D-01).
- **`PtyStatusPayload.notice`** (added 05.1) + the `onPtyStatus` channel — the
  zero-new-bridge-key transport for the SC2 error message and (optionally) the
  agent-state.
- **Renderer HIGH/LOW watermark** (`flow-control.ts` + `SessionView.tsx`) — SC1 is
  already built; validate + dedup against `TerminalPane.tsx`.
- **DESIGN.md agent-state ramps** — the amber "waiting" + free/in-progress colors
  are already specified; SC4 implements an existing design, not a new one.
- **Phase-4 "app-wins" key interception** (before-input-event, D-13) — reuse for
  the Clear chord.
- **Context menu + edit modal** (Phase 4) — host "Start without command" (D-14)
  and the edit-prefill fix.

### Established Patterns
- contextBridge-only renderer↔main seam; node-pty + all PTY I/O in **main only**;
  per-task atomic commits; `security.guard.test.ts` asserts the EXACT bridge key
  surface — any new key (only `pickDirectory` is planned) updates
  `EXPECTED_API_KEYS` (in `api-types.ts`, `window-config.ts`, `preload/index.ts`)
  + the guard test in lockstep.
- Main is the authoritative record/spawn owner; the renderer reconciles against
  `listSessions()` (the edit-prefill fix must respect this).
- Identity invariants (IDENT-01/02): error/restart/reset must never change
  `logicalId` or conflate it with `ptyPid`.
- Process status (5-state) is the source of truth; the agent-state is a
  PRESENTATION overlay (DESIGN.md reconciliation) — do not add a 6th process
  status.
- Platform-specific behavior behind a seam: macOS implemented + verified now,
  Windows contract deferred to Phase 8.

### Integration Points
- **Spawn (SC2):** `create()` → validate cwd → try/catch `pty.spawn()` → on
  failure set `error` + message (via `onPtyStatus`/notice) → renderer shows badge
  + error card with Edit/Retry.
- **Output stream (SC4):** an output-activity detector (main or renderer) →
  classify running into in-progress/waiting/free → drive the status dot/badge +
  header agent-state.
- **Header (SC5):** Clear → `term.clear()` on the active session's xterm; Restart
  → existing restart path; Start ▶ / "Start without command" → existing spawn
  paths (the latter skips TERM-05 injection).
- **Restart / abnormal exit (SC3):** reset the kept-alive xterm before/around the
  respawn so no stale alt-screen frame survives.
- **Folder picker:** edit modal "Browse…" → `pickDirectory` IPC →
  `dialog.showOpenDialog` → absolute path into the cwd field (CR-01 still gates).

</code_context>

<specifics>
## Specific Ideas

- **User's framing for SC4 is the north star:** "I don't want a new status
  indicator for this needs-attention event. The status should highly reflect the
  agent's state." → the agent-state layer (D-06/D-07) IS the answer, and it was
  already the documented DESIGN.md intent — Phase 6 is where it finally ships.
- **Three running sub-states fall out of ONE detector** the waiting heuristic
  already needs (idle timing + last-line shape): flowing→In progress,
  idle+prompt→Waiting, idle+no-prompt→Free. Cheap, and makes the status honest.
- **Best-effort means conservative:** false "Waiting" alarms are worse than the
  occasional miss; idle-AND-pattern + a tight curated regex (D-08/D-09) reflect
  that. A quiet-but-busy process (e.g. a dev server) reading as "Free" is an
  accepted limitation.
- **Canonical scenario still drives it:** ▶ Start `🛋️ Parlour Claude RC`; when the
  agent finishes and prints a `[y/N]` confirmation, its sidebar dot goes amber
  "Waiting for you" while you're in another session — and the header gives you
  one-click Clear / Restart once you're back.

</specifics>

<deferred>
## Deferred Ideas

Routed to owning phases (not lost):
- **Windows ready-detection + shell enumeration** → **Phase 8** (behind the
  existing seams; Windows not runnable on the dev machine).
- **Non-destructive Stop** (Start↔Stop keep-as-`stopped` cycle) — considered under
  D-11 and **declined** to keep Phase-3 D-03a (destructive Close) intact; could be
  revisited as a later lifecycle refinement if users want it.
- **Terminal search (Ctrl+F) + scrollback-size config** → **Phase 7**
  (TERM-10/11).

### Reviewed Todos (not folded)
None — all four phase-matched todos were folded into scope (see Folded Todos).

</deferred>

---

*Phase: 6-Robustness + Flow-Control Polish*
*Context gathered: 2026-06-07*
</content>
