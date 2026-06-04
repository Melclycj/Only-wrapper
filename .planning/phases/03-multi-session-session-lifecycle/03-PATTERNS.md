# Phase 3: Multi-Session + Session Lifecycle - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 12 (7 modify, 5 new)
**Analogs found:** 12 / 12 (every new file has a strong in-repo analog — Phase 3 is additive)

> This phase EXTENDS the Phase 1–2 single-PTY codebase. Almost every new file is "more of an existing thing." Planner: copy the existing patterns verbatim and extend; do NOT invent new shapes. The identity model, security validation, IPC registration idempotency, and flow-control accountant are already correct and must be preserved.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/pty-manager.ts` (MODIFY) | service / manager | event-driven + request-response | itself (Phase 2) | exact (extend in place) |
| `src/shared/api-types.ts` (MODIFY) | types/contract | — | itself | exact (extend in place) |
| `src/preload/index.ts` (MODIFY) | bridge | event-driven + request-response | itself (`onPtyData`/`onPtyExit`) | exact (extend in place) |
| `src/main/window-config.ts` (MODIFY) | config | — | itself (`EXPECTED_API_KEYS`) | exact (extend the array) |
| `src/shared/__tests__/security.guard.test.ts` (MODIFY-via-config) | test | — | itself | exact (driven by `EXPECTED_API_KEYS`) |
| `src/renderer/index.tsx` (MODIFY) | entry | — | itself | exact (swap mounted component) |
| `src/renderer/terminal.css` (MODIFY) | config/style | — | itself | exact (add IDE layout + hidden-pane rules) |
| `src/renderer/SessionView.tsx` (NEW) | component | streaming (PTY round-trip) | `src/renderer/TerminalPane.tsx` | exact (refactor: extract per-session) |
| `src/renderer/SessionManager.tsx` (NEW) | component / container | event-driven (status) + request-response | `TerminalPane.tsx` (effect/cleanup style) | role-match |
| `src/renderer/Sidebar.tsx` (NEW) | component | request-response (click→switch/add) | DESIGN.md §status system + `terminal.css` tokens | partial (no existing UI list) |
| `src/renderer/status-colors.ts` (NEW) | utility | transform (status→style) | `TERMINAL_THEME` const in `TerminalPane.tsx` | partial (token-map pattern only) |
| Unit test: restart keeps logicalId / changes ptyPid (NEW) | test | — | `identity.guard.test.ts` + `ipc-registration.test.ts` | exact (mock-electron + mock-node-pty harness) |

---

## Pattern Assignments

### `src/main/pty-manager.ts` (service, event-driven) — MODIFY

**Analog:** itself. The `Map<LogicalId, PtySession>`, per-id validation, and idempotent IPC registration are ALREADY in place. Extend; do not reshape.

**Current `PtySession` interface (line 72-74)** — extend to carry lifecycle state per RESEARCH Pattern 1:
```typescript
interface PtySession { pty: IPty; }
// EXTEND →  { pty; status: SessionStatus; startupCommand?: string;
//             killTimer?: NodeJS.Timeout; userStopped: boolean; }
```

**Channel registry (lines 25-33)** — add the new status channel:
```typescript
export const PTY_CHANNELS = {
  create: 'pty:create', write: 'pty:write', resize: 'pty:resize',
  pause: 'pty:pause', resume: 'pty:resume', data: 'pty:data', exit: 'pty:exit',
} as const;
// ADD:  status: 'pty:status'   (+ stop/restart/list channels)
```

**`create()` mints id unconditionally (lines 93-94)** — this is the exact line RESEARCH Pattern 2 changes to accept an optional `id` for restart (IDENT-02):
```typescript
const id = newLogicalId();           // → const id = opts.id ?? newLogicalId();
```
Spawn block (lines 97-107) and the `ptyPid = child.pid` / `this.sessions.set` (lines 112-118) are reused unchanged.

**`onData`/`onExit` wiring (lines 125-133)** — the send-to-window pattern to mirror for `pty:status`. Current `onExit` (line 129-133) DELETES the session; Pattern 3/Pitfall 5 changes this to set status first, emit, then drop only the live handle:
```typescript
child.onExit(({ exitCode }) => {           // existing shape
  this.sessions.delete(id);
  this.win?.webContents.send(PTY_CHANNELS.exit, { id, exitCode });
});
```

**`kill()` (lines 168-173)** — analog for the new platform-aware `stop()` (Pattern 4: POSIX SIGTERM→grace→SIGKILL; Windows bare `kill()`).

**`disposeAll()` (lines 176-185)** — already loops `this.sessions.values()` and try/catches dead-child kill; RESEARCH says only add `clearTimeout(killTimer)` for in-flight grace timers.

**IPC registration idempotency (lines 201-243)** — CRITICAL: the new `pty:stop`/`pty:restart`/`pty:list` handlers go inside the `if (this.ipcRegistered) return;` guard (line 203), and `unregisterIpc` (lines 235-243) MUST add symmetric `removeHandler`/`removeAllListeners` for each new channel. This is the Phase-2 CR-01 fix — breaking symmetry fails `ipc-registration.test.ts`.

**Send-target pattern:** `this.win?.webContents.send(CHANNEL, payload)` (line 126) — copy verbatim for `setStatus()`'s emit.

---

### `src/renderer/SessionView.tsx` (component, streaming) — NEW (refactor of TerminalPane)

**Analog:** `src/renderer/TerminalPane.tsx` (the WHOLE file is the template). Extract its body into a per-session component keyed by an `id` prop. Keep every mechanism; change only ownership + WebGL lifecycle + visibility.

**xterm construction (TerminalPane lines 60-68)** — copy verbatim (scrollback 10000, allowProposedApi, JetBrains Mono, `TERMINAL_THEME` lines 32-36).

**Addon load order (lines 70-95)** — copy verbatim EXCEPT WebGL: in Phase 3 the WebGL block (lines 82-95) moves out of construction into an `attachWebgl()/detachWebgl()` pair called on active/inactive (D-01, RESEARCH Pattern 7). The `onContextLoss → canvas` fallback (lines 84-87) is preserved inside `attachWebgl`.

**open + fit ordering (lines 99-100)** — preserved, but per Pattern 8 guard with `fit.proposeDimensions()` before `fit()` and re-fit + `ptyResize` on activate (the existing `onResize` body, lines 196-201, is the template).

**Copy/paste + keymap (lines 110-127)** — copy verbatim per session.

**PTY round-trip + watermark (lines 135-192)** — copy verbatim; this is the core streaming pattern. `createWatermark(FLOW_HIGH, FLOW_LOW)` + the explicit `paused` edge (lines 169-184) MUST be per-instance (one watermark per SessionView). `term.write(data)` runs even while hidden — that is what keeps SC1/SC2 buffers current.

**ptyCreate call (lines 145-147)** — SessionView spawns with `{ cols, rows, cwd?, startupCommand?, id? }`; restart passes the existing id.

**Exit notice (lines 187-189)** — `term.write('\r\n\x1b[2m[process exited]\x1b[0m\r\n')` is the analog for the D-03 `— restarted HH:MM —` dim separator (RESEARCH "Restart separator" example).

**Cleanup (lines 208-219)** — copy the unsubscribe/dispose pattern; add `webgl?.dispose()`. Do NOT dispose the term on hide — only on permanent removal (Pattern 7 / Anti-Patterns).

---

### `src/renderer/SessionManager.tsx` (container, event-driven) — NEW

**Analog:** the `useEffect` + subscribe/unsubscribe + cleanup discipline of `TerminalPane.tsx` (lines 53-220). Owns `sessions[]` + `activeId`; renders `<Sidebar>` + a viewport stack of all `<SessionView>`s (all kept mounted).

**Status subscription:** mirror the `onPtyData`/`onPtyExit` subscribe-returns-unsubscribe pattern (preload lines 41-61) — call `window.api.onPtyStatus(id, cb)` per session and clean up in the effect return.

**Initial list:** `window.api.listSessions()` for first render / after add (RESEARCH Open Q2 — main is the recommended source of truth).

**Add/switch:** add-session mints a new session (`Session N` + default emoji `🖥️` per RESEARCH Open Q3); switching sets `activeId`, hands WebGL to the new view, and `term.focus()`es it.

---

### `src/renderer/Sidebar.tsx` (component, request-response) — NEW

**Analog:** no existing UI list — style authority is **DESIGN.md** §"v1 component inventory" (`SessionCard`/`IdeSidebarRow`: icon + name + status dot/badge) and §"Status system". Consume the design tokens from `terminal.css`.

**Row content (D-02):** render `SessionIconSpec` (all three `kind`s per DESIGN.md reconciliation: emoji | preset | color — `src/shared/types.ts` lines 46-49), the name, and a status badge. Click→switch; `[+ Add session]` button.

**Status colors:** import from `status-colors.ts` (below).

---

### `src/renderer/status-colors.ts` (utility, transform) — NEW

**Analog:** the `TERMINAL_THEME` const-map in `TerminalPane.tsx` (lines 32-36) — a token-map pattern (oklch from DESIGN.md → a const object). Build `Record<SessionStatus, {label, accent}>` per RESEARCH "Status → DESIGN.md color" example, mapping the 5-state union (`src/shared/types.ts` lines 31-36) to DESIGN.md §"Status system" accents + the DERIVED red `error` ramp (`oklch(0.58 0.16 25)`, hue ~25 — D-04, no mockup state).

---

### `src/shared/api-types.ts` (contract) — MODIFY

**Analog:** itself. Add a `PtyStatusPayload` type beside `PtyDataPayload`/`PtyExitPayload` (lines 27-36), and add `ptyStop`/`ptyRestart`/`onPtyStatus`/`listSessions` to the `ElectronAPI` type (lines 38-57) following the existing JSDoc'd method style. `PtyCreateOptions` (lines 14-18) gains optional `id?` + `startupCommand?`.

```typescript
export type PtyStatusPayload = { id: LogicalId; status: SessionStatus; ptyPid?: number; exitCode?: number; };
// ElectronAPI += ptyStop, ptyRestart, onPtyStatus (id-filtered, returns unsubscribe), listSessions
```

---

### `src/preload/index.ts` (bridge) — MODIFY

**Analog:** itself — the id-filtered subscribe pattern of `onPtyData` (lines 41-50) is the EXACT template for `onPtyStatus`:
```typescript
onPtyData: (id, cb) => {
  const listener = (_e, payload) => { if (payload.id === id) cb(payload.data); };
  ipcRenderer.on('pty:data', listener);
  return () => ipcRenderer.removeListener('pty:data', listener);
},
```
`ptyStop` mirrors the fire-and-forget `ipcRenderer.send` of `ptyPause` (lines 31-33); `ptyRestart`/`listSessions` mirror the `ipcRenderer.invoke` of `ptyCreate` (lines 20-21). The `api: ElectronAPI` object literal (line 15) stays a single typed object — never expose raw `ipcRenderer`.

---

## Shared Patterns

### Security guard (the tripwire — ALWAYS update with any bridge change)
**Source:** `src/main/window-config.ts` `EXPECTED_API_KEYS` (lines 37-46) + `src/shared/__tests__/security.guard.test.ts` (lines 48-52).
**Apply to:** every new preload method.
The test asserts `Object.keys(exposed).sort() === [...EXPECTED_API_KEYS].sort()`. Adding `ptyStop`/`ptyRestart`/`onPtyStatus`/`listSessions` to the preload REQUIRES adding the same keys to `EXPECTED_API_KEYS`, or the guard fails. This is the intended, reviewed enforcement — keep the two in lockstep.

### Idempotent IPC registration (CR-01)
**Source:** `pty-manager.ts` `registerIpc` (lines 201-228) + `unregisterIpc` (lines 235-243), proven by `ipc-registration.test.ts`.
**Apply to:** every new main-process channel. Register inside the `ipcRegistered` guard; add a symmetric teardown line in `unregisterIpc`. The test counts that `pty:create` is registered exactly once across re-activations and that teardown is symmetric.

### main→renderer event broadcast
**Source:** `pty-manager.ts` `this.win?.webContents.send(PTY_CHANNELS.data, { id, ... })` (line 126).
**Apply to:** `pty:status` emission (`setStatus`).

### Identity invariant (IDENT-02)
**Source:** `src/shared/types.ts` (lines 65-95, `logicalId` branded vs `ptyPid: number?`) + `id-factory.ts` `newLogicalId()` (only sanctioned minter) + `identity.guard.test.ts`.
**Apply to:** restart — reuse the existing `logicalId`, mint a NEW `ptyPid`. Add a unit test asserting this.

### Per-instance flow control
**Source:** `src/shared/flow-control.ts` `createWatermark(high, low)` (lines 53-74) — already a pure per-instance factory.
**Apply to:** one watermark per SessionView (TerminalPane lines 169-184 is the wiring template).

### New unit test (restart identity) — harness pattern
**Source:** `ipc-registration.test.ts` lines 24-53 (mock `electron`, mock `node-pty` as `{ spawn: vi.fn() }`, `fakeWindow()` with `webContents.send`) combined with `identity.guard.test.ts` assertions style.
**Apply to:** a test asserting `restart(id)` keeps `logicalId` and changes `ptyPid` (RESEARCH Pattern 2 invariant guard).

---

## No Analog Found

| File | Role | Data Flow | Reason | Planner uses |
|------|------|-----------|--------|--------------|
| `src/renderer/Sidebar.tsx` | component | request-response | No existing UI list/row component (TerminalPane is the only renderer component, and it's a single full-window pane) | DESIGN.md §status system + §v1 component inventory; tokens from `terminal.css` |
| `src/renderer/status-colors.ts` | utility | transform | No status→style map exists yet | RESEARCH "Status → DESIGN.md color" example + DESIGN.md status ramps; `TERMINAL_THEME` const-map is the only structural precedent |

> Note: even these two have partial precedent (DESIGN.md tokens + the `TERMINAL_THEME` const-map pattern). There is no file in this phase with NO guidance.

## Metadata

**Analog search scope:** `src/main`, `src/preload`, `src/renderer`, `src/shared` (incl. `__tests__`), `tests/smoke`
**Files scanned:** 20 source/test files (full src tree)
**Pattern extraction date:** 2026-06-04
