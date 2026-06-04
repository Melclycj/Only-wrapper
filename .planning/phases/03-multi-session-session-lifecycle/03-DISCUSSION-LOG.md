# Phase 3: Multi-Session + Session Lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 3-Multi-Session + Session Lifecycle
**Areas discussed:** Backgrounded-session model, Phase 3 UI surface, Stop/restart behavior, Status + startup command

---

## Backgrounded-Session Model

| Option | Description | Selected |
|--------|-------------|----------|
| Instance per session, WebGL on active only (VS Code-style) | Each session keeps its own xterm instance (buffer in memory, instant switch, no replay); WebGL attached only to the active session to dodge the ~16-context limit | ✓ |
| Buffer in main, single xterm, replay on switch | Main holds per-session ring buffers; one xterm replays on switch | |
| Keep every session live (xterm per session, all WebGL) | (original option, superseded) instant switch but hits WebGL ~16 limit at the 15-session target | |

**User's choice:** Instance per session, WebGL on active only
**Notes:** User asked about refactor cost + realistic session count. Established: decision is renderer-internal (data model/PtyManager/IPC unchanged) → low refactor risk; target revised 50→~15; VS Code (same xterm.js-in-Electron stack) is the reference architecture; Warp noted for later Phase-4 sidebar polish.

---

## Phase 3 UI Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Build the real DESIGN.md sidebar (basic) | Session list rows (icon + name + status badge) + switch + add-with-defaults; Phase 4 adds form/customization/collapse/shortcuts | ✓ |
| Minimal throwaway switcher (tab strip) | Bare tab strip to exercise lifecycle; Phase 4 builds the real sidebar | |
| You decide | — | |

**User's choice:** Build the real DESIGN.md sidebar (basic)
**Notes:** Avoids throwaway UI; uses the design north star. Phase 3/4 boundary: P3 = list+status+switch+add-with-defaults; P4 = create/edit form + name/icon customization + collapse + shortcuts.

---

## Stop / Restart Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep scrollback + separator, re-run startup cmd, graceful stop | Restart keeps history with `— restarted HH:MM —`, new PTY/same logicalId, re-runs startup cmd; stop = SIGTERM→SIGKILL; stopped stays in list | ✓ |
| Clear terminal on restart, re-run startup cmd | Fresh blank terminal on restart | |
| Keep scrollback, do NOT auto-re-run startup cmd | History kept but fresh shell; user re-runs manually | |

**User's choice:** Keep scrollback + separator, re-run startup cmd, graceful stop
**Notes:** SC3 identity preservation: restart = new ptyPid, same logicalId/name/icon. Stopped session stays restartable in the list.

---

## Status + Startup Command

| Option | Description | Selected |
|--------|-------------|----------|
| Visible keystrokes when shell is ready | Startup cmd written into the PTY as if typed (visible, in shell history); exit 0→exited, non-zero→error | ✓ |
| Run silently (no echo) | Execute without showing in terminal | |
| You decide | — | |

**User's choice:** Visible keystrokes when shell is ready
**Notes:** Exit-code split (0→exited / non-zero→error) is required by SC4. Shell-ready detection deferred to research.

---

## Claude's Discretion

- PtyManager → `Map<LogicalId, PtySession>`; per-session onData/exit routing; stop disposes PTY keeps record.
- Renderer per-session "view" abstraction + WebGL attach/detach on switch; per-session flow-control.
- Shell-ready detection for the startup command.
- "Add session" default name/icon; auto-focus active terminal on switch.
- DESIGN.md status→color mapping incl. derived red `error` ramp.
- Bridge additions (stop/restart/list + status events).

## Deferred Ideas

Create/edit form + name/icon customization + collapse + shortcuts (Phase 4); persistence (Phase 5); needs-attention heuristic / scrollback search / scrollback config / clear-terminal control (later — restart control is in this phase).
