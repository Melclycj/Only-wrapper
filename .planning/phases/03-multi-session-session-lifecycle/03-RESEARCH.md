# Phase 3: Multi-Session + Session Lifecycle - Research

**Researched:** 2026-06-04
**Domain:** Multi-instance xterm.js (WebGL-on-active-only) in the renderer + N-session node-pty lifecycle (spawn/stop/restart, 5-state status, startup-command injection) in the Electron main process, extending the Phase-2 single-PTY foundation.
**Confidence:** HIGH (stack already installed/verified; WebGL detach/attach, node-pty kill/exit, hidden-pane fit mechanics confirmed against installed typings + official sources); MEDIUM (shell-ready detection — no perfectly reliable cross-shell signal exists without shell integration; a recommended heuristic is given with explicit tradeoffs).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Instance-per-session, WebGL-on-active-only (VS Code / xterm.js-in-Electron pattern).** Each session keeps its OWN xterm instance alive (opened into a hidden container) continuously buffering its live PTY output — scrollback lives in the instance, so switching back is instant with full fidelity and NO main-side replay (satisfies SC1 keep-alive + SC2 current-scrollback). The **WebGL renderer addon is attached ONLY to the active session**; on switch, detach/dispose WebGL from the previously-active session and attach it to the newly-active one. Hidden sessions hold their buffer **without a GPU context**, dodging the Chromium ~16 WebGL-context limit. **Target ~15 concurrent sessions** smooth (user-revised from 50). The whole decision is renderer-internal (data model, PtyManager, IPC bridge unchanged across strategies) — low-risk to revisit later.
- **D-02: Build the REAL DESIGN.md sidebar (basic tier), not a throwaway switcher.** A session list where each row shows **icon + name + status badge** (DESIGN.md status color language), **click-to-switch**, and an **"add session" button** that spawns a new session with a default name (e.g. `Session N`) and a default icon. This is DESIGN.md's IDE layout (sidebar + terminal), basic version. Phase 4 then ONLY adds: the create/edit FORM, name/icon customization (SESS-01..04), collapse (NAV-02), keyboard shortcuts (NAV-05). No throwaway UI.
- **D-03: Graceful stop, identity-preserving restart, history kept.** **Stop** = SIGTERM, then SIGKILL after a short grace period if the process has not exited; the session **stays in the list** with status `stopped` (restartable) — never auto-removed. **Restart** spawns a NEW PTY (new `ptyPid`) but keeps the SAME `logicalId`, `name`, `icon`, `cwd`, `shell` (SC3 — identity preserved). On restart, **keep the existing scrollback and insert a visible `— restarted HH:MM —` separator**, then **re-run the startup command** if one is configured.
- **D-04: Wire the 5-state `SessionStatus`** (defined in Phase 1, D-02): `not_started` → `running` (on PTY spawn) → `exited` (clean exit, code 0) | `error` (non-zero exit) | `stopped` (user-initiated stop). The badge updates on **every** transition (SC4), using DESIGN.md's status colors — running=blue, exited≈green/"Finished", stopped/not_started≈slate/"Idle"; derive a **red ramp for `error`** (no mockup state exists). Exit code distinguishes `exited` (0) vs `error` (non-zero).
- **D-05: Startup command runs as VISIBLE keystrokes once the shell is ready.** The optional `startupCommand` (TERM-05) executes by being **written into the PTY as if the user typed it + Enter** — transparent, lands in shell history, native feel — after the shell prompt is ready (shell-ready detection is research's job). Re-runs on restart (D-03).

### Claude's Discretion (guided by SCs + DESIGN.md + research)

- Extend `PtyManager` from a single PTY to a `Map<LogicalId, PtySession>`; route each PTY's `onData`/`exit` to the correct renderer view; stop disposes the PTY but keeps the `SessionRecord`.
- Renderer "session view" abstraction owning each xterm + its WebGL-attach state; the switch logic (detach/attach the WebGL addon); per-session flow-control.
- Shell-ready detection mechanism for D-05 (prompt heuristic vs settle delay).
- "Add session" default name/icon scheme; auto-focus the active session's terminal on switch.
- DESIGN.md status→color mapping incl. the derived red `error` ramp.
- Bridge surface additions (e.g. `ptyKill`/stop, `ptyRestart` or create-with-existing-id, `listSessions`/status events) — extend the typed contextBridge; never expose raw ipcRenderer.

### Deferred Ideas (OUT OF SCOPE — do not plan)

- **→ Phase 4:** create/edit session FORM, name/icon customization (SESS-01..04), sidebar collapse (NAV-02), keyboard switch shortcuts (NAV-05).
- **→ Phase 5:** session metadata persistence + restore (PERS-01/02, NAV-04 order persistence).
- **→ later:** needs-attention / "waiting for you" heuristic (TERM-09), scrollback search (TERM-10), scrollback-size setting (TERM-11), clear-terminal header control (TERM-12 — note the *restart* control IS in this phase via TERM-07).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TERM-05 | A session can optionally run a configured startup command after opening | Shell-ready detection (settle-delay primary recommendation; first-prompt heuristic secondary) → write `cmd\r` into the PTY as visible keystrokes once ready (Pattern 6, D-05). cwd `claude --rc` canonical scenario. |
| TERM-06 | A running session stays alive when the user switches tabs; switching only changes the visible view | Instance-per-session xterm kept alive in a hidden container; PTY in main is never paused/killed on switch; WebGL detach/attach on active only (Pattern 1/2, D-01). PtyManager `Map<LogicalId, PtySession>` keeps all PTYs live. |
| TERM-07 | User can stop and restart a session; restart may create a new process ID but keeps the same logical session ID | `kill()` (SIGTERM→SIGKILL grace timer) drops the PTY but keeps the `SessionRecord`; restart re-spawns under the SAME `logicalId`, new `ptyPid` (Pattern 3/4, D-03). IDENT-02 invariant preserved. |
| TERM-08 | Each session shows a status: not started / running / stopped / exited / error | 5-state machine driven by spawn + node-pty `onExit({exitCode, signal})`; main emits `pty:status` events; sidebar badge maps to DESIGN.md colors + derived red error ramp (Pattern 5, D-04). |
</phase_requirements>

## Summary

Phase 3 turns the single live terminal of Phase 2 into N independent sessions with a real lifecycle. The architecture is **already correctly shaped for this** — the Phase-2 `PtyManager` is keyed by `LogicalId` in a `Map`, the IPC channels already carry `id` in every payload, the preload `onPtyData`/`onPtyExit` already filter by `id`, and `flow-control.ts` is a per-instance factory. So the main-process work is *additive*: extend `create()` to take an existing `logicalId` (for restart) + a `startupCommand`, add `kill(id)` with a SIGTERM→SIGKILL grace timer, track a per-session `SessionStatus`, and emit a new `pty:status` event. No reshaping of the identity model, the security validation, or the byte path is needed.

The genuinely new and risky work is **renderer-internal** (exactly as D-01 anticipated): refactor the single `TerminalPane` into a **per-session "terminal view"** that owns one xterm instance kept alive in a hidden DOM container, plus a **session-manager** component that mounts the basic DESIGN.md sidebar and swaps which view is visible + WebGL-attached. Three landmines dominate here: (1) the Chromium **~16 WebGL-context limit** — solved by attaching `@xterm/addon-webgl` to the active view only and `dispose()`-ing it on the previously-active view; (2) **`fit()` silently no-ops on a `display:none` element** (`getComputedStyle` returns non-numeric dims) — so hidden panes must use `visibility:hidden`/off-screen positioning (not `display:none`) OR defer `fit()` until the pane becomes visible; (3) a **hidden xterm still buffers `term.write()` correctly** (the buffer is data, independent of rendering) so SC1/SC2 keep-alive is satisfied with zero main-side replay — but you must re-`fit()` and resize the PTY on show because the container may have changed size while hidden.

The lifecycle facts are confirmed against the installed `node-pty@1.1.0` typings: `onExit` emits `{ exitCode: number, signal?: number }`, and `kill(signal?)` defaults to SIGHUP and **throws on Windows when a signal arg is passed** (ConPTY has no signal model — SIGTERM/SIGKILL are emulated as unconditional termination). This forces a **platform-aware stop**: on macOS use `kill('SIGTERM')` then `kill('SIGKILL')` after a grace timer; on Windows use bare `kill()` (no signal arg) which unconditionally terminates. Deriving `exited` vs `error` from `exitCode === 0` is reliable on both platforms.

**Primary recommendation:** Keep the locked installed stack as-is (node-pty 1.1.0, @xterm/xterm 5.5.0 + addons — already in package.json, no new deps). Extend `PtyManager` to a per-session record with `status` + a grace-timer stop; add `pty:status`, `pty:kill`/stop, and restart (create-with-existing-id) to the typed bridge. In the renderer, build a `SessionView` (one xterm per session, kept mounted) + a `SessionManager` (sidebar + active-view swap + WebGL hand-off). Use `visibility`/off-screen (NOT `display:none`) for hidden panes and re-`fit()` on show. For the startup command (D-05), use a **settle-delay** (write the command ~250–400 ms after spawn, or after the first `onData` chunk settles) as the primary mechanism, with a documented option to upgrade to a first-prompt heuristic — full OSC-133 shell integration is out of scope for v1.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| N PTY processes (spawn/kill/restart/write/resize) | Main (`PtyManager` Map) | — | node-pty is native, banned in renderer; identity & lifecycle owned in main |
| Stop = SIGTERM→SIGKILL grace timer | Main | — | Signal semantics + timers are Node concerns; platform-aware (macOS vs ConPTY) |
| 5-state status machine + transitions | Main (source of truth) | Renderer (display) | Status derives from spawn + `onExit` which only main sees; renderer renders it |
| Status broadcast to UI | Main (`pty:status` send) → Preload → Renderer | — | New main→renderer event mirroring the existing `pty:data`/`pty:exit` pattern |
| Startup-command injection (visible keystrokes) | Main (`pty.write`) | — | Written into the PTY after shell-ready; main owns the PTY handle (D-05) |
| Restart identity preservation (same logicalId, new ptyPid) | Main | Shared (types only) | IDENT-02 invariant lives in main's Map keying; SessionRecord shape in shared |
| Instance-per-session xterm kept alive (buffering while hidden) | Renderer (`SessionView`) | — | Buffer + scrollback live in the xterm instance; pure Chromium/renderer concern |
| WebGL attach-on-active / detach-on-hidden | Renderer (`SessionManager`) | — | GPU-context budget is a Chromium constraint; managed entirely in renderer |
| Active-view swap / show-hide / focus-on-switch | Renderer | — | DOM visibility + focus is renderer-only |
| fit/resize on show (hidden-pane safe) | Renderer (`addon-fit`) → Preload → Main (`pty.resize`) | — | Fit measures the now-visible container; main applies new dims to that session's PTY |
| Basic sidebar (icon + name + status badge + add + switch) | Renderer (React) | — | DESIGN.md IDE layout, basic tier; pure UI |
| Per-session flow control | Renderer (per-instance watermark) ↔ Main (per-id pause/resume) | — | `flow-control.ts` is already a per-instance factory; one watermark per session |

## Standard Stack

**No new packages.** The entire Phase-3 stack is already installed and version-pinned in `package.json` (verified this session via `require('<pkg>/package.json').version`). This phase is wiring + refactor, not dependency work.

### Core (already installed — confirmed)
| Library | Installed Version | Purpose | Phase-3 Role |
|---------|-------------------|---------|--------------|
| node-pty | **1.1.0** | Pseudo-terminal in main (forkpty macOS / ConPTY Windows) | Extend to N sessions in the Map; `kill()`/restart lifecycle. `onExit: IEvent<{exitCode:number, signal?:number}>` and `kill(signal?)` confirmed in installed typings [VERIFIED: node_modules/node-pty/typings/node-pty.d.ts] |
| @xterm/xterm | **5.5.0** | Terminal renderer + buffer per session | One instance per session, kept alive. `open()` re-callable when the element changes; `dispose()`, `reset()`, `clear()`, `write()` confirmed [VERIFIED: node_modules/@xterm/xterm/typings/xterm.d.ts] |
| @xterm/addon-webgl | **0.18.0** | GPU renderer — ACTIVE session only (D-01) | `dispose()` + `onContextLoss` confirmed in installed typings; detach via `dispose()`, re-attach via a fresh `new WebglAddon()` + `loadAddon()` [VERIFIED: node_modules/@xterm/addon-webgl typings] |
| @xterm/addon-fit | **0.10.0** | Container-fit cols/rows per pane | `fit()` + `proposeDimensions()` confirmed; `proposeDimensions()` returns `undefined` on a non-measurable (hidden `display:none`) container — used as a "can I fit yet?" guard [VERIFIED: node_modules/@xterm/addon-fit typings] |
| @xterm/addon-canvas | **0.7.0** | Canvas fallback when WebGL context fails | Per-session fallback (Pitfall 5 from Phase 2 carries forward) |
| @xterm/addon-web-links | **0.11.0** | Clickable URLs | Per-instance, as in Phase 2 |
| @xterm/addon-unicode11 | **0.8.0** | CJK/emoji cell widths | Per-instance, as in Phase 2 (`allowProposedApi:true` + `activeVersion='11'`) |
| uuid | **14.0.0** | `newLogicalId()` for new sessions | "Add session" mints a new LogicalId; restart REUSES the existing one |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WebGL-on-active-only (D-01, locked) | One WebGL context per session | Hits the Chromium ~16-context cap at ~15 sessions → contexts get dropped, terminals blank. D-01 is the correct, VS-Code-proven choice. Not relitigated. |
| Instance-per-session kept alive (D-01) | Single xterm + main-side ring-buffer replay on switch | Replay loses live-update fidelity for hidden sessions, adds main-side buffering complexity, risks SC2 staleness. ROADMAP's old "ring-buffer replay" phrasing is SUPERSEDED by the locked D-01 instance-per-session model. |
| `visibility:hidden` / off-screen for hidden panes | `display:none` | `display:none` makes `fit()`/`proposeDimensions()` fail (non-numeric computed size). Use visibility/off-screen so geometry stays measurable, OR defer fit to on-show. [VERIFIED: xterm.js issue #664 + addon-fit behavior] |
| Settle-delay startup injection (recommended) | OSC-133 shell-integration prompt detection | Full shell integration requires injecting per-shell rc scripts (bash/zsh/pwsh) — heavy, fragile across the user's own dotfiles, and out of v1 scope. Settle-delay is simple and good enough for `claude --rc`. |
| Platform-aware `kill('SIGTERM')`→`kill('SIGKILL')` | `kill('SIGTERM')` everywhere | `kill('SIGTERM')` THROWS on Windows/ConPTY (no signal support). Must branch: signal on POSIX, bare `kill()` on Windows. [VERIFIED: node-pty typings `@throws Will throw when signal is used on Windows`] |

**Installation:** none — all packages present. Run nothing; verify with `npm ls @xterm/xterm node-pty` if desired.

**Version verification (this session):** `@xterm/xterm 5.5.0`, `@xterm/addon-webgl 0.18.0`, `@xterm/addon-fit 0.10.0`, `@xterm/addon-canvas 0.7.0`, `@xterm/addon-unicode11 0.8.0`, `@xterm/addon-web-links 0.11.0`, `node-pty 1.1.0`, `uuid 14.0.0` — all read from installed `node_modules/*/package.json`. These match the Phase-2 locked pins (CLAUDE.md + 02-RESEARCH).

## Package Legitimacy Audit

> No new packages are introduced in Phase 3. The audit below confirms the already-installed, already-vetted Phase-2 stack is unchanged. slopcheck (PyPI-targeted) is not applicable to these npm packages, which are canonical Microsoft / xterm.js-org packages with multi-year history (full audit in 02-RESEARCH §Package Legitimacy Audit).

| Package | Registry | Source Repo | Disposition |
|---------|----------|-------------|-------------|
| node-pty 1.1.0 | npm (installed) | github.com/microsoft/node-pty | Approved — unchanged from Phase 2 |
| @xterm/xterm 5.5.0 + addons | npm (installed) | github.com/xtermjs/xterm.js | Approved — unchanged from Phase 2 |
| uuid 14.0.0 | npm (installed) | github.com/uuidjs/uuid | Approved — unchanged from Phase 1 |

**Packages removed due to slopcheck [SLOP] verdict:** none (no new packages).
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
 "Add session" click ─┐                ┌─ "Stop" click ──┐   ┌─ "Restart" click
                      ▼                ▼                  ▼   ▼
 ┌──────────────────────────── MAIN PROCESS (PtyManager — Map<LogicalId, PtySession>) ─────────────────────────┐
 │ PtySession = { pty: IPty; status: SessionStatus; startupCommand?: string;                                   │
 │                killTimer?: NodeJS.Timeout }                                                                  │
 │                                                                                                             │
 │  create({cwd, startupCommand, id?})                                                                         │
 │    id = id ?? newLogicalId()         // RESTART reuses id (IDENT-02); ADD mints a fresh one                 │
 │    pty = spawn($SHELL,['-l'],{...})  // same env/TERM as Phase 2                                            │
 │    setStatus(id,'running'); send('pty:status',{id,status:'running',ptyPid:pty.pid})                         │
 │    scheduleStartupCommand(id, startupCommand)   // settle-delay → pty.write(cmd+'\r')  (D-05)               │
 │    pty.onData(d → send('pty:data',{id,d}))      // per-session, already filtered in preload                 │
 │    pty.onExit(({exitCode}) →                                                                                 │
 │        status = (this was a user-stop) ? 'stopped'                                                           │
 │               : exitCode===0 ? 'exited' : 'error'    // D-04                                                │
 │        clear killTimer; send('pty:status',{id,status,exitCode})                                              │
 │        // KEEP the SessionRecord; DROP only the live pty handle)                                            │
 │                                                                                                             │
 │  stop(id)   // D-03: graceful, platform-aware                                                                │
 │    mark id as user-stop; POSIX: pty.kill('SIGTERM'); start grace timer → pty.kill('SIGKILL')                │
 │             WINDOWS: pty.kill()  (NO signal arg — ConPTY throws on signal)                                   │
 │                                                                                                             │
 │  restart(id) = stop(id) then, on its exit, create({...sameRecord, id})  → new ptyPid, same logicalId        │
 └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
      │ contextBridge (sandbox) — extend with: ptyStop, ptyRestart, onPtyStatus, listSessions
      ▼
 ┌──────────────────────────── RENDERER (React) ──────────────────────────────────────────────────────────────┐
 │  <SessionManager>  (owns sessions[], activeId)                                                               │
 │    ├─ <Sidebar>  rows: icon + name + status badge (DESIGN.md colors) · click→setActive · [+ Add session]    │
 │    └─ <ViewportStack>                                                                                        │
 │         for each session →  <SessionView id=… visible={id===activeId}/>   (ALL kept mounted)                 │
 │                                                                                                             │
 │  <SessionView>  owns ONE xterm instance for its session id (created once, never unmounted while session     │
 │     exists). term.write(chunk) on pty:data ALWAYS runs — even while hidden → buffer stays current (SC1/SC2).│
 │     onActive():  loadAddon(new WebglAddon()); fit(); ptyResize(id,cols,rows); term.focus()                  │
 │     onInactive(): webgl.dispose()   // free the GPU context (≤16 cap, D-01)                                 │
 │     container CSS: hidden = visibility:hidden + absolute/off-screen (NOT display:none — fit() needs geom)   │
 │     onPtyStatus(id): restart inserts '— restarted HH:MM —' separator into the SAME instance (D-03)          │
 └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additions/refactor only)

```
src/
├── main/
│   └── pty-manager.ts        # EXTEND: per-session status, stop(id) w/ grace timer, restart(id), startup-cmd, pty:status
├── preload/
│   └── index.ts              # EXTEND api: ptyStop, ptyRestart, onPtyStatus, listSessions
├── renderer/
│   ├── index.tsx             # mount <SessionManager/> instead of <TerminalPane/>
│   ├── SessionManager.tsx    # NEW: owns sessions[]+activeId; sidebar + viewport stack; switch/add wiring
│   ├── SessionView.tsx       # NEW (refactor of TerminalPane): one xterm/session; WebGL attach-on-active; buffers while hidden
│   ├── Sidebar.tsx           # NEW: basic DESIGN.md session list (icon+name+status badge), add button
│   ├── status-colors.ts      # NEW: SessionStatus → DESIGN.md oklch ramp (incl. derived red 'error')
│   └── terminal.css          # EXTEND: IDE layout (sidebar + viewport); hidden-pane visibility rule
└── shared/
    ├── api-types.ts          # EXTEND ElectronAPI + PtyStatusPayload; status method signatures
    └── window-config.ts      # EXTEND EXPECTED_API_KEYS with the new bridge keys (guard test tripwire)
```

### Pattern 1: PtyManager → per-session record with status (extend the existing Map)

**What:** Promote the existing `PtySession { pty }` to `{ pty, status, startupCommand?, killTimer?, userStopped? }`. The Map and all the validated write/resize/pause/resume handlers already work per-id — no change there. Add status tracking + emission.
**When:** Foundation for TERM-06/07/08.
```typescript
// Source: extends installed src/main/pty-manager.ts (Phase 2)
import type { SessionStatus } from '../shared/types';

interface PtySession {
  pty: IPty;
  status: SessionStatus;
  startupCommand?: string;
  killTimer?: NodeJS.Timeout;
  userStopped: boolean;      // true while a user-initiated stop is in flight → exit becomes 'stopped'
}

private setStatus(id: LogicalId, status: SessionStatus, extra?: { ptyPid?: number; exitCode?: number }): void {
  const s = this.sessions.get(id);
  if (s) s.status = status;
  this.win?.webContents.send(PTY_CHANNELS.status, { id, status, ...extra }); // new channel
}
```

### Pattern 2: Restart preserves logicalId, mints a new ptyPid (IDENT-02)

**What:** `create()` gains an optional `id` param. ADD → mint a new `LogicalId`. RESTART → pass the EXISTING `logicalId`, reusing name/icon/cwd/shell from the SessionRecord; only `ptyPid` changes.
**When:** TERM-07 / SC3.
```typescript
// Source: extends installed PtyManager.create() (Phase 2 mints id unconditionally)
create(opts: PtyCreateOptions & { id?: LogicalId; startupCommand?: string }): PtyCreateResult {
  const id = opts.id ?? newLogicalId();   // RESTART reuses; ADD mints (IDENT-02 — id never derived from pid)
  const child = pty.spawn(shell, args, { /* …same as Phase 2… */ });
  this.sessions.set(id, { pty: child, status: 'running', startupCommand: opts.startupCommand, userStopped: false });
  this.setStatus(id, 'running', { ptyPid: child.pid });
  this.scheduleStartupCommand(id, opts.startupCommand);
  // …onData/onExit wiring (Pattern 3)…
  return { id, pid: child.pid };
}
```
> **Invariant guard:** the Phase-1 identity guard test asserts `logicalId` and `ptyPid` are never conflated. Restart is the exact scenario that test protects — add a unit test asserting `restart()` keeps `logicalId` and changes `ptyPid`.

### Pattern 3: Deriving exited vs error vs stopped from node-pty onExit (D-04)

**What:** `onExit` emits `{ exitCode: number, signal?: number }` (confirmed in installed typings). The status is: user-stop in flight → `stopped`; else `exitCode === 0` → `exited`; else → `error`. This is reliable on BOTH macOS and Windows.
```typescript
// Source: node-pty typings — onExit: IEvent<{ exitCode: number, signal?: number }>
child.onExit(({ exitCode }) => {
  const s = this.sessions.get(id);
  if (s?.killTimer) { clearTimeout(s.killTimer); s.killTimer = undefined; }
  const status: SessionStatus = s?.userStopped ? 'stopped'
                              : exitCode === 0  ? 'exited'
                              :                   'error';
  this.setStatus(id, status, { exitCode });
  // D-03: KEEP the SessionRecord (status set above); drop only the live handle.
  this.sessions.delete(id);   // remove the live pty entry; renderer keeps the SessionView for restart
});
```
> **Cross-platform note:** On a SIGKILL'd process node may report a non-zero exitCode/signal, but because `userStopped` is set, it correctly maps to `stopped` (not `error`). On Windows, `kill()` (no signal) causes unconditional termination — `userStopped` still routes it to `stopped`. `signal` is informational only; do NOT branch status on it (it's `undefined` on Windows). [VERIFIED: node-pty typings + nodejs process signal docs]

### Pattern 4: Graceful stop — SIGTERM→SIGKILL grace timer, platform-aware (D-03)

**What:** Ask the process to exit politely, then force-kill if it ignores the request. **Windows ConPTY does not support signals** — `kill('SIGTERM')` THROWS there — so branch on platform.
```typescript
// Source: node-pty typings (`kill(signal?)`, "@throws Will throw when signal is used on Windows")
const STOP_GRACE_MS = 800;   // short grace; tune 500–1500ms

stop(id: LogicalId): void {
  const s = this.sessions.get(id);
  if (!s) return;
  s.userStopped = true;                                   // → exit maps to 'stopped' (Pattern 3)
  if (process.platform === 'win32') {
    s.pty.kill();                                         // ConPTY: unconditional terminate, NO signal arg
    return;
  }
  s.pty.kill('SIGTERM');                                  // POSIX: ask politely
  s.killTimer = setTimeout(() => {
    try { s.pty.kill('SIGKILL'); } catch { /* already exited between SIGTERM and timer */ }
  }, STOP_GRACE_MS);
}
```
> **Grace-period race:** if the process exits cleanly during the grace window, `onExit` fires first and clears `killTimer` (Pattern 3), so SIGKILL never runs. Wrap the SIGKILL in try/catch because the handle may be dead by the timer fire (node-pty throws on kill of a dead child — same pattern already used in `disposeAll()`).

### Pattern 5: Status broadcast — new `pty:status` event (mirror pty:data/pty:exit)

**What:** Add one main→renderer event channel carrying `{ id, status, ptyPid?, exitCode? }`. The renderer's sidebar + SessionView subscribe per-id (same filtering pattern the preload already uses for `pty:data`).
```typescript
// Source: extends PTY_CHANNELS + preload onPtyData/onPtyExit pattern (installed)
export const PTY_CHANNELS = { /* …existing… */ status: 'pty:status' } as const;

// preload (mirrors onPtyData's id-filtered subscribe + unsubscribe):
onPtyStatus: (id, cb) => {
  const h = (_e, p: PtyStatusPayload) => { if (p.id === id) cb(p); };
  ipcRenderer.on('pty:status', h);
  return () => ipcRenderer.removeListener('pty:status', h);
},
```
> **Decision (status as event vs `listSessions` poll):** prefer the **event** (push) for live badge updates (SC4 "updates on every transition"). A `listSessions()` invoke is still useful for the initial render / after add — provide both, but status transitions drive the badge via the event. The existing idempotent `registerIpc` must add `pty:status` to `unregisterIpc`'s `removeAllListeners` symmetry.

### Pattern 6: Startup-command injection as visible keystrokes (D-05, TERM-05)

**What:** After the shell is ready, write `startupCommand + '\r'` into the PTY exactly like typed input — it echoes, lands in history, and runs natively. The hard part is *when* "ready" is.
```typescript
// Source: D-05 + xterm/PTY echo semantics; settle-delay is the recommended v1 mechanism
private scheduleStartupCommand(id: LogicalId, cmd?: string): void {
  if (!cmd) return;
  // RECOMMENDED v1: settle-delay. Write after the shell has emitted its first prompt
  // and output has gone quiet. Reset the timer on each onData chunk; fire when quiet.
  const s = this.sessions.get(id);
  if (!s) return;
  let settle: NodeJS.Timeout;
  const SETTLE_MS = 300;                       // tune 250–400ms
  const armed = { done: false };
  const onChunk = (): void => {
    if (armed.done) return;
    clearTimeout(settle);
    settle = setTimeout(() => {
      if (armed.done) return;
      armed.done = true;
      this.sessions.get(id)?.pty.write(cmd + '\r');   // visible keystrokes + Enter (D-05)
    }, SETTLE_MS);
  };
  s.pty.onData(onChunk);                        // co-exists with the data-forward onData
}
```
> **Shell-ready mechanism — recommendation + rationale (Claude's Discretion):**
> - **Primary (recommended): settle-delay keyed off first output.** Spawn → wait for the first `onData` (the prompt is rendering) → wait until output is quiet for ~300 ms → inject. Cross-shell (zsh/bash/pwsh/cmd) with zero shell-specific config; robust for the canonical `claude --rc` case. Downside: a slow-rendering prompt could fire early on a pathological machine — tune `SETTLE_MS`.
> - **Secondary (optional upgrade): first-prompt heuristic.** Watch the output for a trailing prompt token (`$ `, `% `, `> `, `❯ `, or `PS …>`). More precise but brittle across themed prompts (powerlevel10k, starship) and false-positives on command output. Not recommended as the default.
> - **Rejected for v1: OSC-133 shell integration.** VS Code's reliable method, but requires injecting per-shell rc scripts into the user's shell — heavy, fragile against the user's own dotfiles, and out of scope (DESIGN.md/REQUIREMENTS keep v1 minimal). [CITED: code.visualstudio.com/docs/terminal/shell-integration — OSC 633/133]
> - **Restart re-run (D-03):** call `scheduleStartupCommand` again inside `create()` on restart; the separator line is inserted renderer-side (Pattern 8).

### Pattern 7: Instance-per-session xterm, WebGL on active only (D-01) — the core renderer pattern

**What:** Each `SessionView` creates its xterm once and keeps it mounted for the session's whole life. `term.write()` on incoming `pty:data` runs **regardless of visibility** — the buffer is data, not pixels, so a hidden session stays current with zero main-side replay (SC1/SC2). Only the visible session holds a WebGL context.
```typescript
// Source: installed @xterm/addon-webgl typings (dispose/onContextLoss) + xterm open()/loadAddon()
// On becoming ACTIVE:
function attachWebgl(term: Terminal): WebglAddon | null {
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => { webgl.dispose(); term.loadAddon(new CanvasAddon()); }); // Pitfall 5
    term.loadAddon(webgl);
    return webgl;
  } catch { try { term.loadAddon(new CanvasAddon()); } catch { /* DOM fallback */ } return null; }
}
// On becoming INACTIVE:
function detachWebgl(webgl: WebglAddon | null): void {
  webgl?.dispose();   // frees the GPU context immediately — keeps us under the ~16 cap (D-01)
}
```
> **Memory cost per hidden instance:** an idle xterm instance with a 10 000-line scrollback (current `scrollback: 10000`) is on the order of a few MB of JS heap (buffer cells + parser state), with NO GPU/texture-atlas cost while WebGL is detached. ~15 instances is comfortably within budget — the GPU-context cap, not memory, is the binding constraint, and D-01 specifically dodges it. [ASSUMED — order-of-magnitude estimate from xterm buffer model; see Assumptions A2]
> **DOM mounted-but-hidden vs unmounted:** KEEP the DOM mounted (so the buffer + listeners survive and `term.write` keeps working). Do NOT unmount/`dispose()` on hide — disposing destroys the buffer and breaks SC1/SC2. Only `dispose()` an xterm when the session is permanently removed (not in this phase — no delete-session UI until Phase 4).

### Pattern 8: Hidden-pane fit/resize — the `display:none` landmine

**What:** `FitAddon.fit()` and `proposeDimensions()` measure the container via `getComputedStyle`. On a `display:none` element that returns non-numeric dimensions, so `fit()` silently no-ops or mis-sizes. Two safe options:
```css
/* Source: xterm.js issue #664 — keep hidden panes geometrically measurable */
.session-view { position: absolute; inset: 0; }
.session-view[hidden-pane] { visibility: hidden; z-index: 0; }   /* NOT display:none */
.session-view.active        { visibility: visible; z-index: 1; }
```
```typescript
// On show: re-fit (container may have resized while hidden) THEN resize the PTY.
function onActivate(term: Terminal, fit: FitAddon, id: LogicalId): void {
  const dims = fit.proposeDimensions();          // returns undefined if not measurable yet
  if (dims) { fit.fit(); window.api.ptyResize(id, term.cols, term.rows); }
  term.focus();                                   // focus-on-switch (Claude's Discretion — recommended)
}
```
> Recommendation: **off-screen/visibility hiding** (above) so geometry stays valid and `fit()` works even while hidden; still re-`fit()` + `ptyResize` on activate to catch window resizes that happened while the pane was hidden. Alternatively keep `display:none` and ALWAYS defer `fit()` to on-show — but visibility-hiding is simpler and avoids a blank first frame on switch.

### Anti-Patterns to Avoid

- **`display:none` on hidden terminal panes** → `fit()`/`proposeDimensions()` break (non-numeric geometry). Use `visibility:hidden`/off-screen. (Pattern 8)
- **One WebGL context per session** → blows the Chromium ~16-context cap; terminals go blank. WebGL on active only. (D-01, Pattern 7)
- **`dispose()`-ing a hidden session's xterm to "save memory"** → destroys its buffer/scrollback, breaks SC1/SC2 keep-alive. Keep it mounted; only detach WebGL.
- **`kill('SIGTERM')` on Windows** → THROWS (ConPTY has no signals). Branch on `process.platform`. (Pattern 4)
- **Branching status on `signal`** → `signal` is `undefined` on Windows and on clean exits; derive `exited`/`error` from `exitCode === 0`, and `stopped` from the `userStopped` flag. (Pattern 3)
- **Removing the `SessionRecord` when the PTY exits/stops** → D-03 requires it stays in the list (restartable). Drop only the live `pty` handle. (Pattern 3)
- **Injecting the startup command immediately on spawn** → races the shell's rc-file sourcing; the command can be eaten or interleaved with the prompt. Wait for shell-ready (settle-delay). (Pattern 6)
- **Re-registering `pty:status` listeners on every window create** → duplicate handlers fire N times. Keep the existing idempotent `registerIpc`/`unregisterIpc` symmetry; add `pty:status` to BOTH. (Pattern 5; carries the Phase-2 CR-01 fix forward)
- **Pausing/killing a session's PTY on tab switch** → violates TERM-06 (background process must keep running). Switching is renderer-only visibility; the PTY is untouched.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keeping hidden sessions' scrollback current | Main-side ring buffer + replay-on-switch | One xterm instance per session, kept alive (D-01) | The xterm buffer IS the persistence; replay re-introduces staleness + complexity the locked model avoids |
| GPU-context budgeting | Manual WebGL context counting/recycling | Attach `@xterm/addon-webgl` to active only, `dispose()` on hide | The addon's `dispose()` cleanly frees the context; counting by hand is error-prone |
| Container-fit while hidden | Manual char-measure of an off-screen div | `FitAddon.proposeDimensions()` as a measurable-yet guard + `fit()` on show | Addon already accounts for padding/scrollbar/DPR; `proposeDimensions()` returns `undefined` when unmeasurable |
| Graceful kill timing | `setInterval` polling `pty` liveness | `kill('SIGTERM')` + one `setTimeout` → `kill('SIGKILL')`, cleared by `onExit` | The exit event already tells you when it died; one timer is the whole pattern |
| Status of a dead process | Parsing PTY output for "exited" text | `onExit({exitCode})` + `userStopped` flag | node-pty gives the exit code directly; output-scraping is unreliable |
| Per-session flow control | New backpressure logic | Existing `createWatermark()` factory, one instance per SessionView | `flow-control.ts` is already per-instance; just instantiate it per session |

**Key insight:** Phase 3 introduces almost no new algorithms. The lifecycle is `spawn` + `onExit` + one grace timer; the multi-session renderer is "many of the Phase-2 thing, with WebGL handed to the active one." The real engineering is **correct wiring, visibility/GPU management, and the status state machine** — not novel logic. The two places to be careful are the `display:none`/fit landmine and the Windows signal divergence.

## Runtime State Inventory

> Phase 3 is a greenfield feature phase (no rename/migration/string-replace). Only forward-looking lifecycle state applies. No persisted state exists yet (PERS-* is Phase 5).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — sessions are in-memory only this phase (persistence is Phase 5). The `SessionRecord[]` lives in renderer/main memory and is lost on quit. | None (by design; Phase 5 adds lowdb) |
| Live service config | None — no external services. | None |
| OS-registered state | Each session spawns a real child **process** (`ptyPid`). With N sessions, **all** must be `kill()`-ed on window close / `before-quit`. The existing `disposeAll()` already iterates the Map and kills every PTY — verify it still covers all N (it does — it loops `this.sessions.values()`). Stopped sessions have no live pty (already deleted from the Map) so they're not orphaned. | Verify `disposeAll()` covers N (it does); add a grace-timer cleanup so a pending SIGKILL timer doesn't fire after dispose |
| Secrets/env vars | Each PTY inherits the full parent env (D-01 Phase 2) — unchanged; N sessions all inherit the same env. No new secret keys. | None (documented behavior) |
| Build artifacts | `node-pty`'s `.node` binary — unchanged from Phase 2; no rebuild trigger in Phase 3 (no Electron bump, no new native dep). | None |

**Verified:** No persisted/renamed state — confirmed by REQUIREMENTS.md (PERS-01/02 → Phase 5) and CONTEXT.md Deferred Ideas. The only OS-level concern is orphan child processes, already handled by the Phase-2 `disposeAll()` loop (just add `clearTimeout(killTimer)` for any in-flight grace timers).

## Common Pitfalls

### Pitfall 1: `fit()` silently fails on `display:none` hidden panes → blank/mis-sized terminal on switch
**What goes wrong:** A hidden session is `display:none`; `fit()`/`proposeDimensions()` read non-numeric geometry, so cols/rows are wrong or unchanged; on switch the terminal is blank or the wrong size until a window resize.
**Why:** `getComputedStyle` on a `display:none` element returns `auto`/empty for width/height.
**How to avoid:** Hide with `visibility:hidden` + off-screen positioning (NOT `display:none`), and re-`fit()` + `ptyResize` on activate. Guard with `proposeDimensions()` returning a value before calling `fit()`. (Pattern 8)
**Warning signs:** First frame after switching to a hidden session is blank or clipped; `term.cols`/`rows` stuck at 80×24.

### Pitfall 2: WebGL context exhaustion at ~15 sessions → terminals blank
**What goes wrong:** If each session keeps its own WebGL context, Chromium drops the oldest once you exceed ~16; those terminals stop rendering.
**Why:** Browser per-page WebGL-context cap.
**How to avoid:** WebGL on the active session only; `webgl.dispose()` on deactivate (D-01, Pattern 7). Hidden sessions render nothing (they're not visible) — they just buffer.
**Warning signs:** "WebGL: too many contexts" console warning; older tabs blank after opening many.

### Pitfall 3: Startup command races the shell prompt → command eaten or garbled
**What goes wrong:** Writing `claude --rc\r` immediately after spawn interleaves with the shell still sourcing `.zshrc`/printing its prompt; the command is split, mis-typed, or lost.
**Why:** The shell isn't ready to read a command line until its prompt is drawn.
**How to avoid:** Settle-delay — wait for first output, then ~300 ms of quiet, then inject (Pattern 6). Tune `SETTLE_MS`.
**Warning signs:** The startup command appears half-typed, runs twice, or not at all; works sometimes (timing-dependent).

### Pitfall 4: `kill('SIGTERM')` throws on Windows (ConPTY)
**What goes wrong:** A POSIX-style stop crashes on Windows because ConPTY has no signal model.
**Why:** node-pty's `kill(signal)` `@throws Will throw when signal is used on Windows`.
**How to avoid:** Branch: POSIX `kill('SIGTERM')`→grace→`kill('SIGKILL')`; Windows bare `kill()`. (Pattern 4) Even though Phase 3 is macOS-first, keep the branch so Phase 8 doesn't crash. CLAUDE.md mandates OS-agnostic code except at explicit platform edges — this is one.
**Warning signs:** Uncaught exception on stop when later run on Windows.

### Pitfall 5: Stopped session removed from the list instead of staying restartable
**What goes wrong:** On exit/stop the code deletes the whole `SessionRecord`, so the user can't restart it; the sidebar row vanishes.
**Why:** Conflating "the live PTY is gone" with "the session is gone."
**How to avoid:** On exit, set `status` and drop only the live `pty` handle (delete from the Map of LIVE ptys), but keep the `SessionRecord` + `SessionView` so restart can reuse the `logicalId` (D-03, Pattern 3).
**Warning signs:** Sidebar row disappears when a process exits; restart impossible.

### Pitfall 6: Grace-timer SIGKILL fires after the process already exited (or after dispose)
**What goes wrong:** The process exits cleanly during the grace window, then the timer fires `kill('SIGKILL')` on a dead handle → throw; or the window closes and `disposeAll()` runs but a pending timer later kills nothing.
**Why:** Two async paths (exit event + timer) race.
**How to avoid:** `onExit` clears `killTimer`; wrap the SIGKILL in try/catch; `disposeAll()` also clears any pending `killTimer`. (Pattern 3/4)
**Warning signs:** Intermittent "kill of dead process" errors on stop; errors during quit.

### Pitfall 7: Status badge stale because transitions aren't pushed
**What goes wrong:** The sidebar shows `running` for a session that exited in the background because nothing told the renderer.
**Why:** Relying on a one-time `listSessions()` poll instead of live events.
**How to avoid:** Push every transition via `pty:status` (Pattern 5); the SessionView/sidebar subscribe per-id. SC4 requires "updates on every transition."
**Warning signs:** A backgrounded `npm run dev` that crashed still shows blue "Running" until you click it.

## Code Examples

### Extend the typed bridge (api-types.ts)
```typescript
// Source: extends installed src/shared/api-types.ts ElectronAPI
import type { LogicalId, SessionStatus } from './types';

export type PtyStatusPayload = {
  id: LogicalId;
  status: SessionStatus;
  ptyPid?: number;      // present on running
  exitCode?: number;    // present on exited/error
};

export type ElectronAPI = {
  // …existing 8 methods…
  /** Stop a session (SIGTERM→SIGKILL grace; ConPTY unconditional). Keeps the SessionRecord. */
  ptyStop: (id: LogicalId) => void;
  /** Restart a session: same logicalId, new ptyPid; re-runs startupCommand. */
  ptyRestart: (id: LogicalId) => Promise<PtyCreateResult>;
  /** Subscribe to status transitions for `id`; returns unsubscribe. */
  onPtyStatus: (id: LogicalId, cb: (p: PtyStatusPayload) => void) => () => void;
  /** Snapshot of current sessions (initial render / after add). */
  listSessions: () => Promise<SessionRecord[]>;
};
```
> The Phase-1/2 security guard (`EXPECTED_API_KEYS` in `window-config.ts` + `security.guard.test.ts`) asserts the exact exposed key set — it MUST be updated to include `ptyStop`, `ptyRestart`, `onPtyStatus`, `listSessions`, or the guard fails. That guard is the intended, reviewed tripwire.

### Restart separator inserted into the SAME instance (D-03)
```typescript
// Source: D-03 — keep scrollback, insert a visible separator, then re-run startup cmd
window.api.onPtyStatus(id, (p) => {
  if (p.status === 'running' && /* this was a restart, not first spawn */ hasRunBefore) {
    const hhmm = new Date().toTimeString().slice(0, 5);
    term.write(`\r\n\x1b[2m— restarted ${hhmm} —\x1b[0m\r\n`);  // dim separator, scrollback preserved
  }
});
```

### Status → DESIGN.md color (status-colors.ts)
```typescript
// Source: DESIGN.md §"Status system" oklch ramps + derived red 'error' (D-04)
export const STATUS_STYLE: Record<SessionStatus, { label: string; accent: string }> = {
  running:     { label: 'Running', accent: 'oklch(0.62 0.14 248)' }, // blue (in-progress)
  exited:      { label: 'Finished', accent: 'oklch(0.60 0.13 150)' }, // green (finished)
  stopped:     { label: 'Stopped', accent: 'oklch(0.64 0.02 260)' }, // slate (free/idle)
  not_started: { label: 'Idle',    accent: 'oklch(0.64 0.02 260)' }, // slate
  error:       { label: 'Error',   accent: 'oklch(0.58 0.16 25)'  }, // DERIVED red ramp (no mockup state)
};
```
> The red `error` ramp is derived to be palette-consistent (similar L/C to the other accents, hue ~25 red); DESIGN.md explicitly delegates this. Phase 4's UI-SPEC can refine `tint`/`ring` ramps; this phase needs the dot/badge accent only.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ROADMAP's "ring-buffer replay" multi-session model | Instance-per-session xterm kept alive (D-01) | Phase 3 discuss (CONTEXT.md) | No main-side replay; scrollback lives in the instance; SUPERSEDES the ROADMAP line for Phase 3 |
| One WebGL context per terminal | WebGL on active only, `dispose()` on hide | VS Code terminal architecture | Dodges the ~16-context cap; enables ~15 concurrent sessions (D-01) |
| Output-scrape for "process exited" | `onExit({exitCode, signal})` direct | node-pty 1.x | Reliable status derivation (D-04) |
| Manual prompt-string detection | Settle-delay (v1) / OSC-133 shell integration (VS Code, deferred) | — | Simple cross-shell startup injection without rc-script surgery (D-05) |

**Deprecated/outdated:**
- The ROADMAP Phase-3 one-liner ("ring-buffer replay, CSS show/hide tab panels") predates the D-01 decision. Follow **CONTEXT.md D-01** (instance-per-session, kept alive) — that is the authoritative model. "CSS show/hide" is right in spirit but must be `visibility`/off-screen, not `display:none` (Pitfall 1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Settle-delay (~300 ms after first output goes quiet) reliably injects the startup command after the shell prompt for zsh/bash on macOS in the canonical `claude --rc` case. Based on PTY echo semantics, not a runtime probe across many machines. | Pattern 6 | On a pathologically slow prompt the command could fire mid-prompt. Mitigation: tune `SETTLE_MS`; VALIDATION includes a human check that `claude --rc` actually launches; first-prompt heuristic is the documented upgrade. |
| A2 | An idle hidden xterm instance (10k scrollback, WebGL detached) costs a few MB JS heap and no GPU memory, so ~15 instances fit comfortably. Order-of-magnitude estimate from the xterm buffer-cell model, not a measured profile. | Pattern 7 | If memory is higher than estimated, ~15 sessions could pressure RAM on low-end machines. Mitigation: VALIDATION measures heap at 15 sessions; D-01 already targets 15 (down from 50). The GPU cap (not memory) is the known binding constraint. |
| A3 | `visibility:hidden`/off-screen keeps the container measurable so `fit()` works while hidden (vs `display:none` which breaks it). Based on xterm.js issue #664 + `getComputedStyle` behavior, recommended over the alternative of always deferring fit to on-show. | Pattern 8 / Pitfall 1 | If an off-screen transform also zeroes geometry in some layout, fit could still fail. Mitigation: re-`fit()` on activate regardless; `proposeDimensions()` guard. |
| A4 | On Windows, bare `kill()` (no signal) is the correct stop, and `userStopped` correctly maps the resulting exit to `stopped`. Based on node-pty typings + node signal-emulation docs; Windows is not runtime-tested this phase (macOS-first). | Pattern 3/4 | If ConPTY exit reporting differs, a Windows stop could mis-map to `error`. Mitigation: `userStopped` flag is platform-independent; Phase 8 packaging validates on Windows. |

## Open Questions

1. **Restart sequencing — re-spawn synchronously vs after exit confirmation?**
   - What we know: Restart must produce a NEW pty under the SAME logicalId. The cleanest order is `stop(id)` → wait for `onExit` → `create({...record, id})`, so the old PTY is fully gone before the new one spawns (avoids two live PTYs briefly sharing an id in the Map).
   - What's unclear: whether to expose `ptyRestart` as one bridge call that orchestrates stop-then-create in main (recommended), or have the renderer call stop then create.
   - Recommendation: **orchestrate in main** (`ptyRestart(id)` does stop → await exit → create-with-id), returning the new `{id, pid}`. Keeps the Map invariant (one live pty per id) in one place. Planner decides final shape; both satisfy SC3.

2. **`listSessions` source of truth — main or renderer?**
   - What we know: The `SessionRecord[]` (incl. stopped sessions kept for restart) must persist across a session's PTY death. Main already owns the live-pty Map; the renderer owns the SessionViews.
   - What's unclear: whether the authoritative `SessionRecord[]` (name/icon/order/status, incl. stopped) lives in main or renderer for Phase 3 (Phase 5 will persist it via lowdb in main).
   - Recommendation: keep the authoritative list in **main** (so Phase 5 persistence is a drop-in) and mirror to the renderer via `listSessions()` + `pty:status`. If that's heavier than the basic-sidebar needs, renderer-owned state is acceptable for Phase 3 and migrated in Phase 5 — flag for the planner.

3. **Add-session default naming + focus-on-switch (Claude's Discretion).**
   - Recommendation: default name `Session N` (N = count+1) with a default emoji icon (e.g. `{ type:'emoji', value:'🖥️' }`); auto-`term.focus()` the newly-active session on every switch (matches native tabbed-terminal UX). Low-risk, refine in Phase 4. No blocker.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node-pty (built) | N PTY sessions | ✓ | 1.1.0 (rebuilt against Electron 36 by postinstall) | — |
| @xterm/* stack | Per-session xterm + WebGL | ✓ | 5.5.0 + addons (installed) | canvas/DOM renderer per session |
| Electron | Runtime | ✓ | 36.9.5 | — |
| WebGL2 (Chromium) | active-session renderer | ✓ (modern Chromium) | — | addon-canvas (5.x) per session |
| Vitest / WDIO | unit + E2E harness | ✓ | Vitest 4.1.8 / WDIO 9 (`@wdio/electron-service` 10) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** WebGL2 → per-session canvas/DOM renderer (runtime auto-fallback, Pattern 7). No new installs required for this phase.

## Validation Architecture

> `workflow.nyquist_validation: true` → section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (unit/guard) + WebdriverIO 9 / `@wdio/electron-service` 10 (boot + multi-session E2E) |
| Config file | `vitest.config.ts`, `wdio.conf.ts` (both present from Phase 1/2) |
| Quick run command | `npm run test:unit` (`vitest run`) |
| Full suite command | `npm test` (unit + smoke) |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| SC1 / TERM-06 | 3 sessions open; `npm run dev` (or `while true; do echo .; sleep 0.2; done`) in A keeps printing while B active; switch back → output advanced | E2E (WDIO) | `tests/smoke/multi-session-keepalive.smoke.test.ts` | ❌ Wave 0 |
| SC2 | switch to a hidden session → buffer is current (no blank/frozen frame); assert last-known line present | E2E (WDIO) | same harness | ❌ Wave 0 |
| SC3 / TERM-07 | stop a session, restart it; assert `logicalId` unchanged AND `ptyPid` changed | Unit (Vitest, PtyManager.restart) + E2E | `src/main/__tests__/pty-lifecycle.test.ts` + smoke | ❌ Wave 0 |
| SC4 / TERM-08 | each transition (spawn→running, clean exit→exited, non-zero→error, stop→stopped) emits a `pty:status` with the right status | Unit (Vitest, status derivation) | `src/main/__tests__/pty-status.test.ts` | ❌ Wave 0 |
| SC4 | `exited` vs `error` derivation: `exitCode 0` → exited, non-zero → error, userStopped → stopped | Unit (Vitest, pure status mapper) | same file | ❌ Wave 0 |
| SC5 / TERM-05 | a session with `startupCommand` runs it after spawn (assert command echoed + its output appears) | E2E (WDIO) — inject `echo STARTUP_OK`, assert output | `tests/smoke/startup-command.smoke.test.ts` | ❌ Wave 0 |
| Stop grace timer | SIGTERM then SIGKILL after grace if not exited; timer cleared if exit fires first | Unit (Vitest, fake timers + mock IPty) | `src/main/__tests__/pty-lifecycle.test.ts` | ❌ Wave 0 |
| IDENT-02 regression | restart never assigns ptyPid into logicalId | Unit (existing Phase-1 identity guard + new restart assertion) | `npm run test:unit` | ✅ exists (extend) |
| Bridge guard | `EXPECTED_API_KEYS` includes ptyStop/ptyRestart/onPtyStatus/listSessions; preload exposes exactly that set | Unit (Vitest) | `src/shared/__tests__/security.guard.test.ts` | ✅ exists (update) |

### Sampling Rate
- **Per task commit:** `npm run test:unit` (status mapper, stop grace timer, restart identity, bridge guard) — all pure/fast.
- **Per wave merge:** `npm test` (adds WDIO multi-session keep-alive, switch-current-scrollback, startup-command E2E).
- **Phase gate:** full suite green + manual checklist (below) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/main/__tests__/pty-status.test.ts` — pure status derivation (exitCode/userStopped → SessionStatus) for SC4
- [ ] `src/main/__tests__/pty-lifecycle.test.ts` — stop grace timer (fake timers), restart preserves logicalId / changes ptyPid (SC3), platform-branch (mock `process.platform`)
- [ ] `tests/smoke/multi-session-keepalive.smoke.test.ts` — SC1/SC2 (background printing + switch-back currency); needs a multi-session WDIO driver extension
- [ ] `tests/smoke/startup-command.smoke.test.ts` — SC5 (inject `echo STARTUP_OK`, assert)
- [ ] Extend `tests/smoke/helpers/xterm-driver.ts` to address N panes by session id (the Phase-2 driver assumes a single `window.__term`)
- [ ] Update `src/main/window-config.ts` `EXPECTED_API_KEYS` + `security.guard.test.ts` for the 4 new bridge methods

**Manual / human-verify (cannot fully automate — VALIDATION.md):**
- SC1 *feel*: open `🛋️ Parlour Claude RC` (`claude --rc`) alongside an `npm run dev` session; confirm dev output keeps scrolling while Claude is active and neither dies on switch — human.
- SC2 *fidelity*: switch back to a session that printed a full-screen TUI (htop/vim) while hidden; confirm no torn/blank frame (visual) — human.
- WebGL hand-off: open ~15 sessions, cycle through them; confirm no "too many WebGL contexts" warning and the active terminal always renders — semi-automatable (console-warning assertion) + human visual.
- SC4 badge colors: confirm running=blue, exited=green, stopped/idle=slate, error=red match DESIGN.md (visual) — human.
- D-05 visibility: confirm the startup command is VISIBLE (echoed, in shell history via up-arrow), not silently executed — human.

## Security Domain

`security_enforcement: true`, ASVS Level 1. Phase 3 adds N sessions + new bridge methods; the Phase-2 controls carry forward and extend to the new surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Process split preserved: node-pty stays in main only; renderer reaches it solely via the typed contextBridge. New methods (`ptyStop`/`ptyRestart`/`onPtyStatus`/`listSessions`) added to the narrow typed surface + `EXPECTED_API_KEYS` guard — no raw ipcRenderer. |
| V4 Access Control | yes | `ptyStop`/`ptyRestart` operate on a renderer-supplied `id` — MUST validate the `id` is a known session (the existing `this.sessions.get(id)` guard already rejects unknown/forged ids; apply the same to stop/restart so one session can't kill an arbitrary id). |
| V5 Input Validation | yes | All new IPC args validated in main: `id` is a known LogicalId; `startupCommand` is a string (it is written to the PTY as keystrokes the user configured — it is NOT shell-evaluated by the app, so no injection beyond what the user already controls in their own shell). cols/rows clamp + string-data guard from Phase 2 unchanged. |
| V7 Error/Logging | yes | Continue NOT logging raw PTY bytes (Phase 2). Status logs (`spawn`/`exit code`/`stopped`) are lifecycle-only — safe. Do not log `startupCommand` contents if it could contain secrets (e.g. a token in an env-setting command) — log "startup command injected" without the text. |
| V12 Files/Resources | yes | `.node` native binary loading unchanged (auto-unpack-natives). N PTYs = N child processes — all reaped on close via `disposeAll()` (extend to clear grace timers). |

### Known Threat Patterns for N-session Electron + node-pty
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged/unknown `id` in `ptyStop`/`ptyRestart` to kill or hijack another session | Tampering / DoS | Validate `id` against the live `sessions` Map; ignore unknown ids (reuse the existing `get(id)` guard on every new method) |
| Startup command treated as app-evaluated shell input | Injection | App writes it as raw keystroke bytes into the user's OWN shell — no app-side `eval`/`exec`. It runs with exactly the user's own privileges; no new trust boundary crossed (the user configured it for their own session) |
| Orphaned child processes (N sessions) | DoS / resource leak | `disposeAll()` kills every live pty on close/before-quit; also `clearTimeout` any in-flight SIGKILL grace timer |
| Status/exit-code leakage via logs | Information Disclosure | Log lifecycle status + numeric exit code only; never PTY output or startupCommand text |
| Resize-bomb across N sessions | DoS | Existing 1–1000 cols/rows clamp applies per-id, unchanged |

## Sources

### Primary (HIGH confidence)
- **Installed `node-pty@1.1.0` typings** (`node_modules/node-pty/typings/node-pty.d.ts`) — `onExit: IEvent<{ exitCode: number, signal?: number }>`; `kill(signal?: string)` defaults SIGHUP, `@throws Will throw when signal is used on Windows`; `pause()`/`resume()`; `handleFlowControl` semantics — read directly this session
- **Installed `@xterm/xterm@5.5.0` typings** (`node_modules/@xterm/xterm/typings/xterm.d.ts`) — `open()` (re-callable when element changes), `dispose()`, `reset()`, `clear()`, `write(data, cb)`, `loadAddon()`, `element` — read directly
- **Installed `@xterm/addon-webgl@0.18.0` typings** — `dispose()`, `onContextLoss`, `clearTextureAtlas()` — read directly
- **Installed `@xterm/addon-fit@0.10.0` typings** — `fit()`, `proposeDimensions(): ITerminalDimensions | undefined` — read directly
- **Existing codebase** — `src/main/pty-manager.ts` (Map keyed by LogicalId, idempotent registerIpc/unregisterIpc CR-01, disposeAll), `src/preload/index.ts` (id-filtered onPtyData/onPtyExit + unsubscribe), `src/shared/flow-control.ts` (per-instance watermark factory), `src/renderer/TerminalPane.tsx` (the single-pane to refactor), `src/main/window-config.ts` EXPECTED_API_KEYS guard — read directly
- **02-RESEARCH.md** — node-pty/xterm version pins, flow-control watermark, login-shell env, packaging/ASAR concerns (carried forward)
- **node-pty README + npm** (github.com/microsoft/node-pty) — Windows ConPTY has no signal model; SIGTERM/SIGKILL emulated as unconditional termination

### Secondary (MEDIUM confidence)
- xterm.js issue #664 (xtermjs/xterm.js) — `fit()` fails on `display:none` (non-numeric `getComputedStyle`); multiple-instance fit handling
- Node.js process signal docs — Windows SIGINT/SIGTERM/SIGKILL emulation (unconditional termination; exit reported as signal-terminated)
- VS Code Terminal Shell Integration docs (code.visualstudio.com/docs/terminal/shell-integration) — OSC 633/133 prompt-marking (the reliable-but-heavy method we DEFER for v1)

### Tertiary (LOW confidence)
- General xterm.js multi-instance performance notes (instances compete for main-thread; informs the WebGL-on-active decision but not a hard limit)

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps; versions): HIGH — all read from installed `node_modules`.
- Multi-session renderer (instance-per-session, WebGL hand-off, hidden-pane fit): HIGH — APIs confirmed in installed typings + xterm.js issue #664; D-01 is VS-Code-proven.
- Lifecycle (stop grace timer, restart identity, status derivation): HIGH — node-pty `onExit`/`kill` signatures confirmed in installed typings; platform branch documented.
- Startup-command shell-ready detection (D-05): MEDIUM — no perfectly reliable cross-shell signal without shell integration; settle-delay recommended with explicit tradeoffs (A1).
- Memory cost per hidden instance: MEDIUM — order-of-magnitude estimate (A2), GPU-context cap is the known binding constraint.

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable installed stack; re-check only if node-pty or @xterm pins change, or if the user adopts xterm 6 / shell-integration injection).
