# Phase 4: Session Identity + Sidebar UI - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the app's **visual identity layer** on top of the working multi-session
core. Phase 3 already shipped the **basic** sidebar (icon + name + live status
badge, click-to-switch, "+ Add", per-row Restart + destructive Close-with-confirm)
and the instant-add spawn path. Phase 4 adds the remaining identity/UI surfaces:

- **Create/edit form** for name, icon, cwd, shell, optional startup command (SESS-01)
- **Rename / re-icon after creation** without changing the logicalId (SESS-02/03/04)
- **Icon picker** (emoji + color) (SESS-03)
- **IDENT-03 session header** — identity shown above the terminal, not only in the sidebar
- **Collapsible sidebar** (NAV-02) — expanded ↔ icon-only rail
- **Keyboard session-switching** (NAV-05) — positions + next/previous, no mouse needed

**Requirements covered:** IDENT-03, SESS-01, SESS-02, SESS-03, SESS-04, NAV-01,
NAV-02, NAV-03 (NAV-03 click-switch already shipped in Phase 3 — confirm intact),
NAV-05.

**Explicitly NOT in this phase:**
- **NAV-04** session-order persistence → **Phase 5**.
- **Platform-aware shell discovery** (populating the shell selector from the OS) →
  **Phase 5**. Phase 4 ships a functional shell field using the existing single-shell
  resolver + an editable path (see D-06).
- **TERM-05** startup-command auto-run stays **deferred** — the form captures and
  stores `startupCommand`, but v1 does not execute it.
- **TERM-12** session-header quick controls (clear/restart buttons) → **Phase 6**.
  The Phase 4 header is identity-only.
- New capabilities from the mockup (browser companion, alternate layouts, appearance
  panel) → out of v1 scope per DESIGN.md.

</domain>

<decisions>
## Implementation Decisions

### Create / Edit Flow
- **D-01: Quick-add stays; the form is an EDIT form.** "+ Add session" keeps Phase 3's
  behavior — instant-spawn a live session with a default name (`Session N`) and the
  default emoji icon. The user then customizes via the edit form. There is no separate
  "create-first-then-spawn" path. (Chosen over form-first and instant-spawn+auto-open-form.)
- **D-02: Live vs restart-applied fields.** In the edit form: **name and icon update
  live immediately** on a running session (cheap, no PTY impact). **cwd, shell, and
  startupCommand are saved to the session profile and take effect on the next restart**
  — the form must visibly label these fields "applies on restart." This is how SC2's
  "all fields functional" is satisfied for an already-running PTY without surprise
  process kills. (Chosen over re-spawn-immediately and restart-with-confirm.)
- **D-03: Edit is opened via a right-click context menu** on a sidebar row
  (Edit / Restart / Close). This is a **new context-menu component**. It is also the
  control surface when the sidebar is **collapsed** (where row buttons aren't shown) —
  so the menu does double duty (see D-09). Planner's discretion whether the existing
  per-row Restart/Close buttons stay as buttons in expanded mode or fold into the menu;
  keeping them is acceptable.
- **D-04: The create/edit form is a MODAL dialog**, reusing the existing `ConfirmModal`
  overlay pattern + DESIGN.md tokens. (Chosen over side drawer and inline row-expand.)

### Session Identity Header (IDENT-03)
- **D-05: Slim identity bar above the active terminal** showing the active session's
  **icon + name + status badge**, styled from DESIGN.md tokens (mirrors the sidebar row).
  **Identity-only — no controls** (clear/restart are TERM-12 / Phase 6). This satisfies
  IDENT-03's "shown in both the sidebar and the session header." (Chosen over a
  click-to-edit header and over skipping the header entirely.)

### Shell Field (Phase 4 ↔ Phase 5 boundary)
- **D-06: Default + editable path.** The form's shell field is **pre-filled with the
  resolved default shell** (the existing Phase-2 `shell-resolver`) and is an **editable
  free-text path**. It is functional now (SC2). **Phase 5 upgrades it to a discovered
  dropdown** (platform-aware shell list). No Phase-5 discovery work is pulled forward.

### Icon Picker (SESS-03)
- **D-07: Expose emoji + color only.** The picker offers the **emoji** kind and the
  **color** kind. The `preset` kind stays in the `SessionIconSpec` type but is **not
  surfaced in the v1 picker** (emoji already covers expressive icons; presets are
  redundant for MVP). (Chosen over all-three and emoji-only.)
- **D-08: Emoji = curated grid + free-text fallback.** A cozy hand-picked set
  (dev/tool/project-flavored: 🛋️ 🖥️ 🚀 🐍 📦 ⚙️ 🔧 …) for one-click selection, **plus**
  a small text field to type or paste **any** emoji (the macOS Ctrl+Cmd+Space picker
  works in that field). Unlimited choice, no emoji-library dependency. (Chosen over
  curated-grid-only and a bundled searchable library.)
- **D-09: Color = fixed warm palette; color icon renders as a badge with the session's
  initial.** Color selection is a **fixed row of preset swatches drawn from the DESIGN.md
  palette** (no arbitrary hex — stays on-brand). A `color`-kind icon renders as a filled
  **badge containing the first letter of the session name** (not today's plain swatch) so
  it stays identifiable in the collapsed icon-only rail. Update `Sidebar.tsx renderIcon`'s
  `color` branch accordingly.

### Sidebar Collapse (NAV-02)
- **D-10: Pinned toggle button** (a chevron control) folds the sidebar to an **icon-only
  rail** and expands it back; the state stays where the user puts it. (Chosen over
  hover-to-expand and over adding a collapse keyboard shortcut.)
- **D-11: Collapsed rail = icon + status dot + hover tooltip.** Each collapsed item shows
  the icon with a small **status-color dot**; **hovering reveals a tooltip** with the
  session name (and status label). Per-row controls in collapsed mode are reached via the
  **right-click context menu** (D-03). Status must remain legible while collapsed (NAV-01).

### Keyboard Switching (NAV-05)
- **D-12: Shortcut scheme.** Positions = **Cmd+1–9 (macOS) / Ctrl+1–9 (Windows)**.
  Next/previous = **Cmd/Ctrl+Shift+]** (next) and **Cmd/Ctrl+Shift+[** (previous) — the
  VS Code / browser tab-nav convention, deliberately low-conflict with terminal apps.
  (Chosen over Ctrl+Tab cycling and Cmd/Ctrl+Alt+Arrows.)
- **D-13: App always wins.** Switch shortcuts are **reserved app-wide and never reach the
  PTY** — they work even while vim/tmux/fzf is focused (matches iTerm2 / VS Code / Windows
  Terminal). macOS Cmd is naturally app-reserved; on Windows the Ctrl combos must be
  **explicitly intercepted before xterm forwards them** to the PTY. (Chosen over
  terminal-first/fallback.)
- **D-14: Switching only.** Keyboard coverage is limited to session switching (NAV-05).
  Create/close stay on the "+ Add" button and the context menu — **no** Cmd/Ctrl+T or
  Cmd/Ctrl+W bindings in this phase.

### Claude's Discretion (guided by SCs + DESIGN.md + research)
- HOW the app-level shortcuts intercept keys before xterm (Electron Menu accelerators vs
  a renderer capture-phase handler vs xterm `attachCustomKeyEventHandler`) — D-13 fixes
  the policy, not the mechanism. Whichever cleanly guarantees "app always wins" on both
  platforms.
- The exact curated emoji set (D-08) and the exact warm color swatches (D-09), drawn from
  DESIGN.md.
- Context-menu component implementation; whether expanded-mode Restart/Close stay as row
  buttons or move into the menu (D-03).
- Form validation/empty-state behavior (e.g. empty name → keep `Session N`), and how the
  "applies on restart" hint is presented (D-02).
- Whether collapse state is component-local for now (persistence is Phase 5 — see deferred).
- Default cols/rows and re-fit behavior carry over unchanged from Phase 3.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI / design (visual authority for this phase — the big payoff phase)
- `.planning/DESIGN.md` — the v1 design system + the §"v1 component inventory" rows owned
  by Phase 4: `IdeLayout` (sidebar+terminal), `SessionCard`/`IdeSidebarRow`, collapsed
  `RailIcon`/`IconTile` (NAV-02), the **session create/edit form**, status dot/badge
  language, and the §"Reconciliation notes" (icon renders all three kinds; map the 5
  process statuses onto the mockup's color/label language; derive a red `error` ramp).
  **MUST read.**
- `.planning/design/switchboard-mockup.html` — the source mockup (reference asset; bundled
  Nunito/JetBrains Mono woff2 live here). Use for the form + sidebar visual treatment;
  ignore its v2/out-of-scope screens per DESIGN.md.

### Project intent & requirements
- `.planning/ROADMAP.md` §"Phase 4" — goal + the 5 success criteria.
- `.planning/REQUIREMENTS.md` §"Session Identity" (IDENT-03), §"Session Management"
  (SESS-01..04), §"Sidebar & Navigation" (NAV-01/02/03/05). Note NAV-04 + shell discovery
  are §Phase 5; TERM-05 is Deferred; TERM-12 is §Phase 6.

### Foundation being extended (Phases 1–3)
- `.planning/phases/03-multi-session-session-lifecycle/03-CONTEXT.md` — D-01 instance-per-
  session/WebGL-on-active rendering, D-02 the basic sidebar that Phase 4 extends, D-03a the
  destructive Close + confirm-modal pattern (reuse for the form modal), D-04 the 5-state
  status model + DESIGN.md color mapping.
- `.planning/phases/01-project-scaffold-dev-infrastructure/01-CONTEXT.md` — `SessionRecord`
  full field set (incl. `startupCommand`, `order`, `lastActive`), `SessionIconSpec`
  (emoji|preset|color), branded `LogicalId`. The identity contract Phase 4 must not break.
- `.planning/phases/02-pty-core-terminal-fidelity/02-CONTEXT.md` — PtyManager/IPC/flow-
  control/shell-resolver foundation; the xterm theme + fonts.

### Code to extend (full relative paths)
- `src/renderer/Sidebar.tsx` — the basic session list; extend with collapse, the context
  menu entry, and the `color`-kind badge-with-initial (D-09).
- `src/renderer/SessionManager.tsx` — owns `sessions`/`activeId`, the sole `ptyCreate`
  spawn path, status subscriptions, and the IdeLayout. Host the form modal, the keyboard
  shortcut handling (D-12/13), and the active-session identity header (D-05) here or in a
  child it renders.
- `src/renderer/ConfirmModal.tsx` — the modal pattern to reuse for the create/edit form (D-04).
- `src/renderer/SessionView.tsx` — per-session xterm view (WebGL-on-active); the identity
  header sits above the active view.
- `src/renderer/session-add.ts` — the pure spawn path + `DEFAULT_ICON`/`Session N` scheme
  (D-01 quick-add stays).
- `src/renderer/status-colors.ts` — `STATUS_STYLE` accent/label map for badges + the
  collapsed status dot.
- `src/renderer/terminal.css` — DESIGN.md tokens; add the form, context menu, collapsed
  rail, and identity-header styles here.
- `src/shared/types.ts` — `SessionRecord` / `SessionIconSpec` / `LogicalId` (already
  complete; no reshaping — edit form just sets existing fields).
- `src/shared/api-types.ts` — `ElectronAPI` bridge. Editing name/icon/cwd/shell/startup is
  renderer-side state today; if any edit needs to reach main (e.g. updating the main record
  store so restart uses the new cwd/shell), extend the typed contextBridge — **never expose
  raw ipcRenderer** (CLAUDE.md D-06). Restart already reuses `id` via `ptyRestart`/
  `PtyCreateOptions.id`.
- `src/main/shell-resolver.ts` — the single-shell resolver used to pre-fill the shell field
  (D-06); Phase 5 extends it to a discovery list.
- `src/main/pty-manager.ts` — main's authoritative record store; if cwd/shell edits must
  drive the next restart spawn, the edited values need to reach the record main respawns from.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ConfirmModal.tsx`** — established overlay/modal component + DESIGN.md styling; the
  create/edit form modal (D-04) should mirror its structure (open/title/body/confirm/cancel).
- **`Sidebar.tsx renderIcon`** — already switches over emoji|preset|color; D-09 only changes
  the `color` branch (plain swatch → badge-with-initial) and the picker writes the chosen spec.
- **`STATUS_STYLE` (status-colors.ts)** — accent + label per status; reuse for the badge,
  the collapsed status dot, and the identity-header badge.
- **`session-add.ts`** — `DEFAULT_ICON` (🖥️) + `Session N` naming; quick-add (D-01) keeps it.
- **`SessionManager` keyboard host** — already the single owner of session list + activeId;
  natural home for the position→`activeId` switch logic (D-12) and the form/header state.

### Established Patterns
- contextBridge-only renderer↔main seam; node-pty in main only; per-task atomic commits with
  guard-test enforcement (`security.guard.test.ts` asserts the exact bridge key surface — any
  new bridge method updates `EXPECTED_API_KEYS` + the guard in lockstep, as done for the 13th
  key `ptyClose`).
- Main is the source of truth for the session record store; the renderer reconciles against
  `listSessions()`. cwd/shell edits that affect restart must land where main respawns from.
- Identity invariant (IDENT-02 / IDENT-01): rename, re-icon, and restart must **never** change
  `logicalId`. The edit form mutates `name`/`icon`/`cwd`/`shell`/`startupCommand` only.

### Integration Points
- Renderer: form modal (create/edit) ↔ `SessionManager` state; right-click context menu ↔ rows;
  collapse toggle ↔ IdeLayout width + rail rendering; keyboard handler ↔ `activeId`; identity
  header ↔ active session record.
- Main (only if needed): edited cwd/shell/startup persisted into main's record so a subsequent
  `ptyRestart` respawns with them (D-02 "applies on restart").

</code_context>

<specifics>
## Specific Ideas

- **Cozy "parlour" aesthetic is the north star** (DESIGN.md) — warm cream surfaces, 18px
  rounding, Nunito UI / JetBrains Mono terminal. The form, context menu, collapsed rail, and
  identity header should all read warm and rounded, not cold-dev-tool.
- **Canonical scenario drives the form**: a user must be able to produce
  `Name: Parlour Claude RC`, `Icon: 🛋️`, a real project `Path`, and `Command: claude --rc`
  through the edit form (auto-run of the command is still deferred, but the field is captured).
- **VS Code is the interaction reference** for the IDE layout, collapse toggle, and
  Cmd/Ctrl+Shift+[ ] tab navigation. iTerm2 / Windows Terminal are the reference for
  "switch shortcuts always win over the terminal" (D-13).
- 🖥️ default icon and `Session N` default name carry over from Phase 3 (D-01).

</specifics>

<deferred>
## Deferred Ideas

Routed to owning phases / later (not lost):
- **Preset / built-in glyph icon kind UI** (SESS-03 "built-in icon list") — the `preset`
  kind stays in `SessionIconSpec`; **not surfaced in the v1 picker** (emoji + color chosen,
  D-07). Revisit if a curated glyph set is wanted later.
- **Keyboard shortcuts for new/close** (Cmd/Ctrl+T, Cmd/Ctrl+W) — out of NAV-05 scope (D-14).
- **Sidebar collapse-state persistence** across app restarts — UI preference; belongs with
  **Phase 5** persistence (collapse can be component-local for now).
- **Platform-aware shell discovery** populating the form's shell dropdown → **Phase 5**
  (Phase 4 uses default + editable path, D-06).
- **Session-order persistence (NAV-04)** → **Phase 5**.
- **TERM-05 startup-command auto-run** — still deferred; the form only captures/stores the field.
- **Session-header quick controls (clear / restart)** — **TERM-12 / Phase 6**; Phase 4 header
  is identity-only (D-05).

</deferred>

---

*Phase: 4-Session Identity + Sidebar UI*
*Context gathered: 2026-06-05*
</content>
</invoke>
