# Phase 3: Multi-Session + Session Lifecycle - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the single live terminal (Phase 2) to **multiple concurrent sessions** with a real lifecycle: many PTYs running independently in main, **instant non-destructive switching** with current scrollback, **stop/restart that preserves logical identity**, the **5-state status model**, and the **optional startup command**. Phase 3 also builds the **basic real sidebar** (DESIGN.md) needed to drive all this.

**Requirements covered:** TERM-05 (startup command), TERM-06 (session stays alive on tab switch), TERM-07 (stop/restart preserving logicalId), TERM-08 (5-state status).

**Explicitly NOT in this phase (→ Phase 4):** the create/edit session FORM, name/icon customization (SESS-01..04), sidebar collapse (NAV-02), keyboard switch shortcuts (NAV-05). **→ Phase 5:** persistence (PERS-01/02). **→ later:** needs-attention heuristic (TERM-09), scrollback search (TERM-10), scrollback-size config (TERM-11), clear-terminal control (TERM-12 — note the *restart* control IS in this phase).

</domain>

<decisions>
## Implementation Decisions

### Backgrounded-Session Rendering & Buffering
- **D-01: Instance-per-session, WebGL-on-active-only (the VS Code / xterm.js-in-Electron pattern).** Each session keeps its OWN xterm instance alive (opened into a hidden container) continuously buffering its live PTY output — the scrollback lives in the instance, so switching back is **instant with full fidelity and NO main-side replay** (satisfies SC1 keep-alive + SC2 current-scrollback). The **WebGL renderer addon is attached ONLY to the active session**; on switch, detach/dispose WebGL from the previously-active session and attach it to the newly-active one. Hidden sessions hold their buffer **without a GPU context**, dodging the Chromium ~16 WebGL-context limit. **Target ~15 concurrent sessions** smooth (user-revised from 50). Rationale: proven pattern; the whole decision is renderer-internal (data model, PtyManager, IPC bridge are unchanged across strategies) so it is low-risk to revisit later.

### Phase 3 UI Surface — the real (basic) sidebar
- **D-02: Build the REAL DESIGN.md sidebar (basic tier), not a throwaway switcher.** A session list where each row shows **icon + name + status badge** (DESIGN.md status color language), **click-to-switch**, and an **"add session" button** that spawns a new session with a default name (e.g. `Session N`) and a default icon. This is DESIGN.md's IDE layout (sidebar + terminal), basic version. Phase 4 then ONLY adds: the create/edit FORM, name/icon customization (SESS-01..04), collapse (NAV-02), and keyboard shortcuts (NAV-05). No throwaway UI.

### Stop / Restart Lifecycle
- **D-03: Graceful stop, identity-preserving restart, history kept.** **Stop** = SIGTERM, then SIGKILL after a short grace period if the process has not exited; the session **stays in the list** with status `stopped` (restartable) — never auto-removed. **Restart** spawns a NEW PTY (new `ptyPid`) but keeps the SAME `logicalId`, `name`, `icon`, `cwd`, `shell` (SC3 — identity preserved). On restart, **keep the existing scrollback and insert a visible `— restarted HH:MM —` separator**, then **re-run the startup command** if one is configured.

### Status Model & Transitions
- **D-04: Wire the 5-state `SessionStatus`** (defined in Phase 1, D-02): `not_started` → `running` (on PTY spawn) → `exited` (clean exit, code 0) | `error` (non-zero exit) | `stopped` (user-initiated stop). The badge updates on **every** transition (SC4), using DESIGN.md's status colors — running=blue, exited≈green/"Finished", stopped/not_started≈slate/"Idle"; derive a **red ramp for `error`** (no mockup state exists). Exit code distinguishes `exited` (0) vs `error` (non-zero).

### Startup Command
- **D-05: Startup command runs as VISIBLE keystrokes once the shell is ready.** The optional `startupCommand` (TERM-05) executes by being **written into the PTY as if the user typed it + Enter** — transparent, lands in shell history, native feel — after the shell prompt is ready (shell-ready detection is research's job). Re-runs on restart (D-03).

### Claude's Discretion (guided by SCs + DESIGN.md + research)
- Extend `PtyManager` from a single PTY to a `Map<LogicalId, PtySession>`; route each PTY's `onData`/`exit` to the correct renderer view; stop disposes the PTY but keeps the `SessionRecord`.
- Renderer "session view" abstraction owning each xterm + its WebGL-attach state; the switch logic (detach/attach the WebGL addon); per-session flow-control.
- Shell-ready detection mechanism for D-05 (prompt heuristic vs settle delay).
- "Add session" default name/icon scheme; auto-focus the active session's terminal on switch.
- DESIGN.md status→color mapping incl. the derived red `error` ramp.
- Bridge surface additions (e.g. `ptyKill`/stop, `ptyRestart` or create-with-existing-id, `listSessions`/status events) — extend the typed contextBridge; never expose raw ipcRenderer.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI / design (the authority for the basic sidebar)
- `.planning/DESIGN.md` — §"v1 component inventory" (IDE sidebar + SessionCard/row, status badge) and §"Status system" (the agent-state color/label language to map onto the 5 statuses; derive a red `error` ramp). **MUST read for the sidebar.**
- `.planning/design/switchboard-mockup.html` — the source mockup (reference asset).

### Project intent & requirements
- `.planning/REQUIREMENTS.md` §"Terminal Session" — TERM-05..TERM-08 (this phase); §"Sidebar & Navigation" NAV-* (deferred to Phase 4 — informs the sidebar's eventual shape).
- `.planning/ROADMAP.md` §"Phase 3" — goal + 5 success criteria.

### Foundation being extended (from Phases 1–2)
- `.planning/phases/01-project-scaffold-dev-infrastructure/01-CONTEXT.md` §decisions — D-01 `SessionRecord` (full field set incl. `startupCommand`, `order`, `status`), D-02 `SessionStatus` 5-state union, D-04 branded `LogicalId`.
- `.planning/phases/02-pty-core-terminal-fidelity/02-CONTEXT.md` + `02-RESEARCH.md` — the PtyManager/IPC/flow-control/shell foundation.
- `src/main/pty-manager.ts` (keyed by LogicalId already — extend to a session Map), `src/renderer/TerminalPane.tsx` (single-session xterm — refactor into per-session views), `src/shared/types.ts` (`SessionRecord`/`SessionStatus`), `src/shared/api-types.ts` (the bridge to extend with stop/restart/list), `src/shared/flow-control.ts` (now per-session).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/pty-manager.ts` — `PtyManager` is ALREADY keyed by `LogicalId`; Phase 2 only ever created one. Extend to manage a `Map<LogicalId, PtySession>`, with per-session lifecycle (spawn/stop/restart) and status emission.
- `src/renderer/TerminalPane.tsx` — the single full-window xterm pane. Refactor into a per-session "terminal view" (owns one xterm instance + WebGL-attach state) plus a manager that mounts the sidebar and swaps the active view.
- `src/shared/api-types.ts` / `src/shared/types.ts` — extend `ElectronAPI` with stop/restart/list + status-change events; `SessionRecord`/`SessionStatus` already model identity + status.
- `.planning/DESIGN.md` tokens + status system — the sidebar row, status dot/badge, and the IDE layout.
- `src/shared/flow-control.ts` — the watermark accountant, now instantiated per session.

### Established Patterns
- contextBridge-only renderer↔main seam; node-pty in main only; atomic per-task commits + guard-test enforcement; the edge-tracked flow-control + idempotent IPC registration from Phase 2's review fixes (keep idempotency as sessions come and go).

### Integration Points
- Main: `PtyManager` session Map; stop keeps the record + disposes the PTY; restart reuses the `logicalId` with a fresh PTY; status transitions emitted over IPC.
- Renderer: a session-view manager (instance-per-session, WebGL-on-active) + the basic DESIGN.md sidebar (list + status badges + switch + add).
- Identity invariant (IDENT-02): restart changes `ptyPid`, never `logicalId`.

</code_context>

<specifics>
## Specific Ideas

- **VS Code's integrated terminal is the reference architecture** (the exact xterm.js-in-Electron stack): one xterm instance per terminal kept alive, WebGL attached only to the active one. This directly informs D-01.
- The user is targeting **~15 sessions** (not 50) and confirmed the model is renderer-internal / low-refactor.
- Warp's multi-tab feel may be referenced later for Phase 4 sidebar polish (user may provide specifics).
- Canonical scenario extends to multiple concurrent sessions — e.g. the `🛋️ Parlour Claude RC` session running alongside a `npm run dev` session that keeps printing while hidden.

</specifics>

<deferred>
## Deferred Ideas

Routed to owning phases (not lost):
- Create/edit session FORM, name/icon customization (SESS-01..04), sidebar collapse (NAV-02), keyboard switch shortcuts (NAV-05) → **Phase 4**.
- Session metadata persistence + restore (PERS-01/02, NAV-04 order persistence) → **Phase 5**.
- Needs-attention / "waiting for you" heuristic (TERM-09), scrollback search (TERM-10), scrollback-size setting (TERM-11), clear-terminal header control (TERM-12) → **later** (the *restart* control is in this phase via TERM-07).

</deferred>

---

*Phase: 3-Multi-Session + Session Lifecycle*
*Context gathered: 2026-06-04*
