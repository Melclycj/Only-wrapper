# Phase 5: Persistence + Shell Discovery - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Make session **profiles** survive app restarts and populate the shell selector
from the OS. Concretely:

- **Persist session metadata** (PERS-01) to local disk — `logicalId`, `name`,
  `icon`, `cwd`, `shell`, `startupCommand`, `order`, `lastActive`. The
  `SessionRecord` shape is already complete and JSON-serializable (`types.ts`).
- **Restore profiles on reopen** (PERS-02) — **profiles only, never live
  processes**. Every restored session loads as **`not_started`** (SC2).
- **Persist + edit sidebar order** (NAV-04) — including **drag-to-reorder**.
- **Platform-aware shell discovery** (SC4) — replace the single-shell
  `resolveShell()` with a discovered list feeding the form's shell **dropdown**;
  no hardcoded paths.

**Requirements covered:** PERS-01, PERS-02, NAV-04 (+ SC4 shell discovery).

**Core new behavior:** Today every session spawns a live PTY the instant it is
added, so `not_started` never appears in practice. Persistence makes restored
sessions **dormant profiles**, which introduces a deliberate **Start** action
and an **idle-pane** state that did not exist before.

**Explicitly NOT in this phase:**
- **TERM-05 (auto-run the stored startup command on start)** — stays **deferred**;
  becomes its **own next increment** after Phase 5 (needs shell-ready-detection
  research — the reason it was descoped from Phase 3). Phase 5 "Start" spawns a
  **bare shell** in the saved cwd/shell; the user launches their command (shell
  history makes ↑ convenient).
- **App-level agent conversation/state resume (Layer C)** — v2 / out of scope.
  Achievable today via the user's own `claude --continue` startup command (no app
  coupling); the app stays agent-agnostic.
- **Windows shell enumeration** — the discovery **seam** is built now and the
  **macOS provider** is fully implemented + tested; the **Windows provider's
  actual enumeration lands and is verified at Phase 8** (when Windows is runnable).
- Any process-recovery after quit (already Out of Scope project-wide).

</domain>

<decisions>
## Implementation Decisions

### Reviving Restored Sessions
- **D-01: Restore is profiles-only — zero process coupling.** Persistence writes
  `SessionRecord` data to disk and reads it back. It does not connect to, parse, or
  manage any running process. On load, every session is coerced to `not_started`
  and `ptyPid` cleared (SC2) — persisted status/PID are never trusted.
- **D-02: TERM-05 (auto-run startup command) is NOT in this phase.** It is the
  immediate next increment (its own phase/slot; needs a roadmap entry + shell-ready
  research). Layer C (agent-state resume) stays out entirely.
- **D-03: Explicit Start (▶), not lazy click.** Clicking a dormant row
  **selects/views** it only (shows its idle card). A **▶ Start control on the row**
  **and** a **context-menu "Start"** item spawn a fresh shell in the saved
  `cwd`/`shell`. The context-menu/row action label is **"Start" when
  `not_started`** and **"Restart"** once the session has run (reuse the existing
  spawn/restart paths).
- **D-04: Idle pane = a session card.** For a selected-but-not-started session the
  terminal area shows a placeholder card: **identity (icon + name + status) + saved
  `cwd`, `shell`, and `startupCommand` (read-only, displayed — NOT executed) + a ▶
  Start button.** The real xterm surface appears only once started. (The Start
  button here is a second launch point besides the sidebar ▶.)

### Shell Discovery (SC4)
- **D-05: Shell field becomes a dropdown — dropdown ONLY (no free-text).** Replaces
  Phase 4's free-text editable path (D-06 superseded). **Safety rule:** the dropdown
  MUST always include the resolved default `$SHELL` even if discovery doesn't
  otherwise surface it, so the selector is never empty/unusable.
- **D-06: macOS list = read `/etc/shells` + always include `$SHELL`.** Use the OS's
  own registry of valid login shells. **No hardcoded absolute paths** — survives
  Homebrew/MacPorts/non-standard installs (SC4). Filter to entries that exist on
  disk; de-dupe.
- **D-07: Build the platform-aware discovery seam now; macOS provider only this
  phase.** Introduce a `ShellDiscovery` abstraction (interface) and fully implement
  + unit-test the **macOS provider**. Define the **Windows provider's contract** but
  leave its real enumeration (PowerShell/CMD/Git Bash/WSL) to **Phase 8**, when
  Windows is testable. SC4 is satisfied on macOS this phase; Windows is a clean
  drop-in. Matches the existing "Windows specifics → Phase 8" pattern in
  `shell-resolver.ts`.

### Ordering & Reorder (NAV-04 / SC3)
- **D-08: Drag-to-reorder in the sidebar + persist the order.** Delivers SC3's
  "custom ordering" literally. Persist `SessionRecord.order`; restore in that order.
- **D-09: Restore focus = the FIRST session in saved order** (show its idle card).
  `lastActive` is still persisted but is NOT the restore-focus driver (kept for
  possible future MRU use).

### First-Run, Empty State & New-Session Behavior
- **D-10: No-sessions state = welcome / empty state with a "Create a session"
  CTA.** Applies to first-ever launch (no file) AND after the user closes every
  session. **Nothing is auto-spawned.** This **replaces** the current
  auto-add-one-default-session-on-empty boot behavior in `SessionManager.tsx`.
- **D-11: New = live, restored = dormant.** A session the user creates via "+" /
  the CTA **starts live immediately** (Phase 4 quick-add D-01 unchanged — you asked
  for a terminal, you get one). Only sessions **restored from disk** start dormant
  (`not_started`).

### Persisted UI Preferences (beyond session profiles)
- **D-12: Persist sidebar collapse state** (Phase 4 D-11's deferred home) **and
  window size & position.** Note: window bounds are beyond PERS-01's listed fields —
  a small, cheap addition for desktop-app polish.

### Save Timing / Durability
- **D-13: Write on change, debounced (~300 ms), + a guaranteed final flush on app
  quit.** Debounce coalesces bursts (notably drag-reorder, which fires many `order`
  updates); the quit flush guarantees durability. Survives crash/force-quit. Avoid
  the "save on quit only" failure mode (loses a whole session's changes on a crash)
  and the "synchronous per-change" write storm (lowdb rewrites the whole file each
  time).

### Claude's Discretion (guided by SCs + constraints + research)
- **Storage engine + location:** lowdb (recommended in CLAUDE.md / research;
  not yet installed — add it) writing JSON under Electron's `app.getPath('userData')`.
  Exact filename/schema layout is planner/researcher's call. Local-only, no cloud
  (locked constraint).
- **Schema versioning / migration:** include a version field; how to migrate is
  discretion.
- **Corrupt / unreadable file handling:** back up the bad file and start fresh
  (never crash on a malformed store); surface nothing scarier than the empty state.
- **Where persistence lives:** main is the authoritative record store (Phase 3
  decision: "listSessions source of truth lives in MAIN — Phase 5 lowdb is a
  drop-in"). The `SessionManager.tsx` reconcile poll was written to be **replaced by
  the persisted snapshot** — collapse/simplify it as appropriate.
- **Idle-card / empty-state / Start-control visual treatment** — from DESIGN.md
  tokens (warm "parlour" aesthetic). Whether the ▶ row control reuses the existing
  per-row control row or the context menu only.
- **Collapsed icon-rail drag-to-reorder behavior** (D-08) — expanded-mode dragging
  with the rail reflecting saved order is acceptable; full collapsed DnD optional.
- **Bridge surface:** any new IPC for persistence/discovery extends the typed
  contextBridge in lockstep with `EXPECTED_API_KEYS` + `security.guard.test.ts`
  (established pattern); never expose raw `ipcRenderer`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project intent & requirements
- `.planning/ROADMAP.md` §"Phase 5: Persistence + Shell Discovery" — goal + the 4
  success criteria (SC1 restore-all, SC2 always-`not_started`, SC3 ordering, SC4
  shell discovery).
- `.planning/REQUIREMENTS.md` §"Local Persistence" (PERS-01, PERS-02), §"Sidebar &
  Navigation" (NAV-04). Note TERM-05 is **Deferred** (and per this discussion stays
  deferred → its own next increment).
- `.planning/PROJECT.md` — Core Value (terminal fidelity), the "restore profiles
  only, not live processes" Out-of-Scope line, and the canonical validation scenario.

### UI / design
- `.planning/DESIGN.md` — token system + status language; source for the new
  **idle-card / session-card placeholder**, the **Start (▶) control**, the **shell
  dropdown**, and the **welcome/empty state** treatment.

### Foundation being extended (Phases 1–4)
- `.planning/phases/04-session-identity-sidebar-ui/04-CONTEXT.md` — D-06 (shell
  field was default + editable free-text — **superseded here by D-05 dropdown-only**),
  D-11 (collapse-state persistence **deferred to here** — D-12), the create/edit form
  + context menu + collapsed rail this phase touches.
- `.planning/phases/03-multi-session-session-lifecycle/03-CONTEXT.md` — main is the
  source of truth ("Phase 5 lowdb is a drop-in"), the 5-state status model, restart
  semantics, D-03a destructive Close.
- `.planning/phases/01-project-scaffold-dev-infrastructure/01-CONTEXT.md` —
  `SessionRecord` full field set, branded `LogicalId`, the identity invariants
  (IDENT-01/02) restore must not break.

### Code to extend (full relative paths)
- `src/main/shell-resolver.ts` — currently returns a single `$SHELL || /bin/zsh`;
  upgrade to a `ShellDiscovery` seam + macOS provider (`/etc/shells` + `$SHELL`),
  Windows provider contract stubbed for Phase 8 (D-05/06/07).
- `src/main/pty-manager.ts` — main's authoritative `Map<LogicalId, PtySession>` +
  `listSessions()`. The persistence layer hydrates this on boot (as `not_started`,
  no live PTY) and is fed by it on change. `create()` already honors a stored
  `cwd`/`shell` on (re)spawn.
- `src/main/index.ts` — app lifecycle (`whenReady`, `before-quit`); wire store load
  on startup, the quit-flush save (D-13), and window-bounds persistence (D-12).
- `src/renderer/SessionManager.tsx` — boot effect (replace auto-add-on-empty with the
  welcome/empty state, D-10), the reconcile poll (replace with persisted snapshot),
  Start control wiring (D-03), idle-card host (D-04), drag-to-reorder (D-08).
- `src/renderer/Sidebar.tsx` — drag-to-reorder UI (D-08), the ▶ Start control + menu
  "Start"/"Restart" labeling (D-03), collapse state now persisted (D-12).
- `src/renderer/SessionEditModal.tsx` / `IconPicker.tsx` region — shell field becomes
  the discovered **dropdown** (D-05).
- `src/renderer/SessionView.tsx` / `IdentityHeader.tsx` — the idle-card placeholder
  for `not_started` sessions (D-04).
- `src/shared/types.ts` — `SessionRecord` already complete (no reshaping). If a
  persisted-store schema/version wrapper is added, define it here.
- `src/shared/api-types.ts` + `src/preload/index.ts` — extend the typed bridge for any
  persistence/discovery IPC (e.g. discover-shells, start-session, reorder/persist);
  update `EXPECTED_API_KEYS` + `security.guard.test.ts` in lockstep.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SessionRecord` (`types.ts`)** — already carries every PERS-01 field and is
  documented as "serializes to JSON as-is for lowdb persistence (Phase 5)." No type
  reshaping needed.
- **`PtyManager.listSessions()` / record store** — main is already the single source
  of truth; persistence is a drop-in producer/consumer around it (Phase 3 decision).
- **`SessionManager.tsx` reconcile poll** — explicitly written anticipating Phase 5:
  comments say "a future Phase-5 persisted-snapshot restore populates listSessions()…
  Phase 5 replaces this poll with the persisted snapshot."
- **`resolveShell()`** — the macOS `$SHELL || /bin/zsh` default; becomes the
  always-included fallback entry in the discovery list (D-05 safety rule).
- **Context menu + per-row controls (Phase 4)** — host for the new Start/Restart
  action (D-03).
- **`ConfirmModal` / form modal patterns** — reuse for any new dialogs.
- **`uuid` is installed; `lowdb` is NOT** — add lowdb (7.0.1, ESM-only).

### Established Patterns
- contextBridge-only renderer↔main seam; node-pty/persistence I/O in **main only**;
  per-task atomic commits; `security.guard.test.ts` asserts the exact bridge key
  surface — any new bridge method updates `EXPECTED_API_KEYS` + the guard in lockstep.
- Main owns the authoritative record store; renderer reconciles against it.
- Identity invariants (IDENT-01/02): restore must preserve each `logicalId`; never
  conflate it with `ptyPid` (which is cleared on restore).

### Integration Points
- **Boot:** main loads the persisted store → hydrates records as `not_started` (no
  PTY) → renderer renders dormant rows + idle card for the first session (D-09).
- **On change:** add (live)/edit/close/reorder/start/stop → debounced write (D-13).
- **Quit:** `before-quit` flush write + window-bounds save (D-12/D-13).
- **Discovery:** form opens → renderer asks main for the discovered shell list →
  populates the dropdown (D-05/06).

</code_context>

<specifics>
## Specific Ideas

- **"Create = live, restore = dormant"** is the one-line mental model for the whole
  start-behavior split (D-11 / D-03).
- The sidebar becomes a **persistent launchpad** for the user's project sessions
  (the value-prop that motivates persistence) — named/iconed/foldered sessions
  reappear in saved order; click ▶ to spin one up in its directory.
- The **idle card displays the saved command but never runs it** — a deliberate
  reminder of "what this session is for" without crossing into TERM-05.
- Power-user "resume my agent" is achieved by saving `claude --continue` as the
  startup command — app stays agent-agnostic.
- Canonical scenario still drives it: reopen → `🛋️ Parlour Claude RC` is there,
  dormant, pointing at its project dir; ▶ gives a fresh shell there.

</specifics>

<deferred>
## Deferred Ideas

Routed to owning phases / later (not lost):
- **TERM-05 — auto-run the stored startup command on start** → its **own next
  increment** right after Phase 5. Needs a roadmap slot (currently just "Deferred")
  and shell-ready-detection research (the Phase-3 descope reason). This is what makes
  "Start a restored agent session" fully meaningful; Phase 5 delivers everything
  around it except the auto-run itself.
- **Layer C — app-level agent conversation/state resume** → v2 / out of scope.
  Covered for power users via their own `claude --continue` command (no app coupling).
- **Windows shell discovery enumeration** (PowerShell/CMD/Git Bash/WSL) → **Phase 8**,
  built behind the `ShellDiscovery` seam created this phase (D-07).
- **`lastActive`-based MRU restore focus** — `lastActive` is persisted but restore
  focus is "first in order" (D-09); MRU ordering could use it later.

None of the discussion strayed outside the phase domain.

</deferred>

---

*Phase: 5-Persistence + Shell Discovery*
*Context gathered: 2026-06-06*
