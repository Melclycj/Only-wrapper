# Phase 6: Robustness + Flow-Control Polish - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 16 (13 EDIT, 1 NEW, 1 DELETE, plus lockstep bridge quartet)
**Analogs found:** 16 / 16 (this is a brownfield phase — every new capability extends an existing seam)

This phase adds almost no greenfield code. Every file edited has a strong in-tree analog (often the file itself, pre-extension). The planner should copy the existing seam shapes verbatim and extend at the marked points.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/shared/agent-state.ts` (NEW) | utility (pure) | transform | `src/shared/flow-control.ts` | exact (pure shared accountant/classifier sibling) |
| `src/renderer/SessionView.tsx` (EDIT) | component | streaming | itself (onPtyData watermark block, lines 189-236) | exact (self-extension) |
| `src/renderer/status-colors.ts` (EDIT) | utility | transform | itself (STATUS_STYLE map) | exact (self-extension) |
| `src/renderer/SessionManager.tsx` (EDIT) | provider/store | event-driven | itself (onPtyStatus sub + handleRestart/handleStart) | exact (self-extension) |
| `src/renderer/IdentityHeader.tsx` (EDIT) | component | request-response | `src/renderer/Sidebar.tsx` `.row-controls` block (lines 228-289) | exact (same control cluster, different host) |
| `src/renderer/Sidebar.tsx` (EDIT) | component | event-driven | itself (status-badge + ContextMenu items in SessionManager) | exact (self-extension) |
| `src/renderer/IdleCard.tsx` (EDIT) | component | request-response | itself (error branch lines 88-93 + idle-start-button) | exact (self-extension) |
| `src/renderer/SessionEditModal.tsx` (EDIT) | component | request-response | itself (cwd field lines 176-189) + `discoverShells` invoke (line 85) | exact (self-extension) |
| `src/main/pty-manager.ts` (EDIT) | service | CRUD/event-driven | itself (`create()` 229+, `setStatus` 474, `isValidCwd` 778, `updateProfile` CR-01 755) | exact (self-extension) |
| `src/main/readiness-probe.ts` (EDIT) | service | transform | itself (`buildPosixProbe` matcher line 71) | exact (self-extension) |
| `src/main/index.ts` (EDIT) | config/route | event-driven | itself (`before-input-event` lines 91-97 + `ipcMain.handle` line 118) | exact (self-extension) |
| `src/preload/index.ts` (EDIT) | route | request-response | itself (`discoverShells` invoke line 158 / `onSwitchSession` subscribe line 145) | exact (mirror an existing key) |
| `src/shared/api-types.ts` (EDIT) | config | — | itself (`discoverShells` type line 158 / `PtyStatusPayload.notice` line 79) | exact (self-extension) |
| `src/main/window-config.ts` (EDIT) | config | — | itself (`EXPECTED_API_KEYS` line 76) | exact (self-extension) |
| `src/shared/__tests__/security.guard.test.ts` (EDIT) | test | — | (lockstep with window-config) | role-match |
| `src/renderer/TerminalPane.tsx` (DELETE) | dead code | — | n/a | n/a (RESEARCH §State of the Art: not in live tree) |

## Pattern Assignments

### `src/shared/agent-state.ts` (NEW — utility, transform) — SC4/D-07/D-09

**Analog:** `src/shared/flow-control.ts` — the existing pure, electron-free, node-pty-free shared accountant. The new agent-state classifier is its sibling: pure, Vitest-importable in a plain Node env, no React/xterm import.

**Module-header + purity convention to copy** (`flow-control.ts` lines 1-16): the leading comment states "Pure, electron-free, node-pty-free … lives in shared/ … so the renderer can import it AND Vitest can exercise it in a plain Node env." Mirror this header on `agent-state.ts`.

**Exported-constant + factory shape to copy** (`flow-control.ts` lines 18-74): named threshold constants (`WATERMARK_HIGH`/`WATERMARK_LOW`) + a documented contract comment block asserted by a `.test.ts`. The new file exports `IDLE_MS` (default 800, Claude's discretion D-08), `PROMPT_RE`, `lastNonEmptyLine()`, `classifyIdle()` per RESEARCH §Code Examples (lines 383-403). Keep the `AgentState = 'in-progress' | 'waiting' | 'free'` union here (NOT in `shared/types.ts` — it is presentation, never persisted; RESEARCH Runtime State Inventory line 299).

**Anti-pattern (RESEARCH line 274):** do NOT add `'waiting'` to the `SessionStatus` union in `shared/types.ts` (lines 31-36). Agent-state is an overlay, not a 6th process status (D-06).

---

### `src/renderer/SessionView.tsx` (EDIT — component, streaming) — SC4 detector + SC3 reset

**Analog:** itself — the `onPtyData` watermark block (lines 189-204) and the `onPtyStatus` handler (lines 215-236).

**Detector wiring — extend the EXISTING `onPtyData` closure** (lines 189-204). The watermark accountant is created at line 189 and the chunk callback at 191. Add the rolling-tail + idle-timer beside it exactly as RESEARCH §Code Examples lines 407-422:
```typescript
const watermark = createWatermark(FLOW_HIGH, FLOW_LOW);
let paused = false;
const offData = window.api.onPtyData(id, (data) => {
  watermark.add(data.length);
  // … existing pause/term.write/drain/resume …
});
```
Add `tail = (tail + data).slice(-4096)`, `onAgentState(id, 'in-progress')`, and a single-slot `setTimeout(IDLE_MS)` that calls `onAgentState(id, classifyIdle(tail))`.

**Timer-discipline pattern to copy** (lines 240-249, the resize debounce): single-slot timer ref cleared before re-arming, and cleared in the cleanup return (lines 257-279). Mirror this for the idle timer (RESEARCH Pitfall 6, line 337) — clear in the cleanup at lines 257-279.

**`onAgentState` prop:** add a callback prop like the existing `active: boolean` prop (lines 84-89). SessionManager passes it (mirrors how it passes `id`/`active` at lines 381-385).

**SC3 reset — extend the EXISTING `onPtyStatus` running branch** (lines 229-235):
```typescript
if (p.status === 'running') {
  if (hasRunBeforeRef.current) {
    const hhmm = new Date().toTimeString().slice(0, 5);
    term.write(`\r\n\x1b[2m— restarted ${hhmm} —\x1b[0m\r\n`);
  }
  hasRunBeforeRef.current = true;
}
```
Insert `term.write('\x1b[?1049l')` (exit alt-screen, preserve scrollback — RESEARCH Pattern 2 / Pitfall 4 / Open Q1) BEFORE the separator write. For abnormal exit, extend the `onPtyExit` handler (lines 207-209, currently writes `[process exited]`) with a `term.reset()` before the notice.

**Notice-short-circuit ordering (must preserve)** — lines 225-228: `if (p.notice) { …; return; }` runs BEFORE the running branch. RESEARCH Anti-Pattern (line 275): the SC2 error path must keep this ordering so a notice event is never treated as a restart.

**WR-04 sanitize (folded fix)** — lines 225-226 write `p.notice` raw inside ANSI wrappers. Strip control chars from `notice` before `term.write` (the SC2 path adds a cwd-path-bearing notice).

---

### `src/renderer/status-colors.ts` (EDIT — utility, transform) — SC4/D-07

**Analog:** itself — the `STATUS_STYLE` Record (lines 22-31).

**Pattern to copy** (lines 22-31): the `Record<Key, { label; accent }>` shape with inline oklch accents. Add a parallel `AGENT_STYLE` map and a `presentation(status, agentState)` resolver per RESEARCH §Code Examples lines 425-438:
```typescript
export const AGENT_STYLE = {
  'in-progress': { label: 'In progress',     accent: 'oklch(0.62 0.14 248)' }, // blue
  'waiting':     { label: 'Waiting for you', accent: 'oklch(0.66 0.15 60)'  }, // amber (TERM-09)
  'free':        { label: 'Free',            accent: 'oklch(0.64 0.02 260)' }, // slate
} as const;
export function presentation(status: SessionStatus, agent?: AgentState) {
  if (status === 'running' && agent) return AGENT_STYLE[agent];
  return STATUS_STYLE[status];
}
```
oklch values are authoritative from UI-SPEC §Color (lines 93-101) — amber `oklch(0.66 0.15 60)` is reserved exclusively for "Waiting for you".

---

### `src/renderer/SessionManager.tsx` (EDIT — provider/store, event-driven) — SC4 aggregation + SC5 handlers + folded fixes

**Analog:** itself — the `onPtyStatus` subscription effect (lines 269-284), `handleRestart`/`handleStart` (lines 130-162), the ContextMenu block (lines 406-425).

**agentState aggregation — copy the per-session subscription pattern** (lines 269-284): the existing effect maps each session to a `window.api.onPtyStatus` subscription and updates the matching row via functional `setSessions`. Add a parallel renderer-only `agentState` (and `errorMessage`) per-row state, updated by the `onAgentState` callback passed down to SessionView (RESEARCH Open Q2, line 506: store `errorMessage?: string` per row, renderer-only, no type/bridge change).

**handleClear (SC5/D-12) — new handler beside handleRestart** (lines 130-141): reach the active xterm via `window.__sessionTerms[id]` (the handle SessionView registers at SessionView lines 173-178) and call `.clear()`. RESEARCH Pattern 4 line 262.

**handleStartNoCmd (D-14) — copy handleStart** (lines 150-162): same `ptyCreate({ id })` path but signals main to skip the TERM-05 injection for that launch (planner picks the skip mechanism; an opts flag through `PtyCreateOptions` or a dedicated create branch in pty-manager).

**Clear chord wiring — extend the EXISTING onSwitchSession effect** (lines 296-301). RESEARCH Pattern 4 recommendation (b), line 270: reuse the `'session:switch'` channel by adding a `{ kind: 'clear' }` variant to `SwitchIntent`; the handler branches clear-vs-switch — keeping `EXPECTED_API_KEYS` at 19 (only `pickDirectory` new).

**ContextMenu "Start without command" (D-14)** — extend the items array (lines 411-423): add a secondary item beside the dormant Start/Restart flip (lines 416-418).

**Edit-prefill hydration (folded fix, RESEARCH Open Q3 line 510):** after `onAdd`'s spawn (lines 233-247) and after `handleSaveProfile` (lines 215-223), re-read `window.api.listSessions()` and merge authoritative `cwd`/`shell`/`startupCommand` into the matching row. `listSessions` already exists — no new bridge key.

---

### `src/renderer/IdentityHeader.tsx` (EDIT — component, request-response) — SC5/D-11

**Analog:** `src/renderer/Sidebar.tsx` `.row-controls` cluster (lines 228-289) — the exact contextual Start(▶)/Restart(↻) button pattern this header gains.

**Current header (identity-only)** — lines 19-38: `renderIcon` + `.row-name` + `.status-badge` (D-05 placeholder; the leading comment lines 1-8 explicitly says controls are "Phase 6 / TERM-12").

**Control-cluster markup to copy verbatim** (Sidebar lines 228-289):
```tsx
<button type="button" className="row-control row-control-start"
  data-testid="start-session" title="Start session"
  aria-label={`Start ${s.name}`}
  onClick={(e) => { e.stopPropagation(); onStart(s.logicalId); }}>
  <span aria-hidden="true">▶</span>
</button>
```
Reuse the exact `data-action`/`aria-label`/`title`/glyph conventions. Per UI-SPEC §Interaction 3 (lines 170-181): Clear always (text-labelled `data-testid="clear-terminal"`, `aria-label="Clear terminal"`); Restart `data-testid="header-restart"` when `running`; Start `data-testid="header-start"` with the blue `.row-control-start` accent when not running. Wrap in a `.header-controls` cluster (`margin-left: auto`). The badge consumes `presentation(status, agentState)` instead of `STATUS_STYLE[status]` (line 23).

---

### `src/renderer/Sidebar.tsx` (EDIT — component, event-driven) — SC4 dot + D-14 menu item

**Analog:** itself — `.status-badge`/`.status-dot` markup (lines 220-227) + `.collapsed-status-dot` (line 215).

**Pattern to extend:** replace the `stat.accent`/`stat.label` source (lines 222-226 use `STATUS_STYLE[status]`) with the new `presentation(status, agentState)` resolver so the row dot, collapsed-rail dot, and badge carry the agent-state accent for `running` sessions (UI-SPEC §Interaction 1, line 148). The `renderIcon` helper (lines 37-60) is unchanged and is reused by IdentityHeader + IdleCard.

---

### `src/renderer/IdleCard.tsx` (EDIT — component, request-response) — SC2/D-03/D-04

**Analog:** itself — the existing `error` branch (lines 88-93) and the `idle-start-button` (lines 96-103).

**Pattern to extend:** the card already renders an `error` inline line (lines 88-93) and a single Start button (lines 96-103). D-04 needs a two-button action row: **Edit** (neutral) + **Retry** (primary blue, reusing the `idle-start-button` blue treatment). Copy the button shape at lines 96-103; add `data-testid="error-card-edit"` / `error-card-retry` per UI-SPEC §Interaction 2 (lines 164-167). Show the specific message (passed in as a prop / from the row's `errorMessage`) in the `.idle-card-value` JetBrains-Mono role (lines 54-58 show the mono value pattern). Add an `onEdit`/`onRetry` prop pair beside the existing `onStart` (lines 20-25).

---

### `src/renderer/SessionEditModal.tsx` (EDIT — component, request-response) — folder picker (folded todo)

**Analog:** itself — the cwd field block (lines 176-189) + the `discoverShells()` invoke (line 85).

**Pattern to extend:** the cwd `<input>` (lines 180-188) gets an inline-end "Browse…" button. The invoke pattern to copy is the `discoverShells` call (line 85): `void window.api.pickDirectory().then((p) => { if (p) setCwd(p); })`. `data-testid="browse-cwd"`, neutral secondary button matching `.edit-input` height (UI-SPEC §Interaction 4, line 186). CR-01 still gates the value main-side.

---

### `src/main/pty-manager.ts` (EDIT — service, CRUD/event-driven) — SC2 + SC3-signal + WR-* fixes

**Analog:** itself — `create()` (229+), `setStatus` (474-485), `isValidCwd` (778-785), `updateProfile` CR-01 guard (755-757).

**SC2 cwd resolution reshape (D-01/D-02/D-05) — the load-bearing change.** Current cwd chain (lines 254-259) conflates "no cwd → home OK" with "cwd set but missing → error". Replace per RESEARCH §Code Examples lines 343-379:
```typescript
const requestedCwd = opts.cwd?.length ? opts.cwd
                   : prior?.cwd?.length ? prior.cwd
                   : undefined;
if (requestedCwd !== undefined && !this.isValidCwd(requestedCwd)) {
  this.setStatus(id, 'error', {});
  this.send(PTY_CHANNELS.status, { id, status: 'error',
    notice: `Working directory not found: ${requestedCwd}` });
  return { id, pid: -1 };
}
const cwd = requestedCwd ?? os.homedir();
```
**CRITICAL empirical finding (RESEARCH Summary line 66 / Pitfall 1 line 307):** `pty.spawn()` on macOS does NOT throw synchronously for a bad cwd/shell — it forks-then-dies and emits `onExit({exitCode:1})`. So the pre-validation is the ONLY reliable path to the specific message; the try/catch (wrap line 261) is for the rare EACCES; the async abnormal `onExit` (already → `error` via `deriveStatus` lines 167-173) is the generic fallback.

**isValidCwd is the reuse target** (lines 778-785): absolute + `fs.statSync().isDirectory()` in try/catch — already written for CR-01. Reuse verbatim for the pre-spawn check (RESEARCH Don't Hand-Roll line 286).

**setStatus is the broadcast pattern** (lines 474-485): updates in-memory + record status then `this.send(PTY_CHANNELS.status, {…})`. The notice rides this same channel (`PtyStatusPayload.notice`, api-types line 79) — zero new bridge keys.

**WR-05 trim (folded)** — `updateProfile` line 766-768 stores `startupCommand` un-trimmed; canonicalize trim at persist time.

---

### `src/main/readiness-probe.ts` (EDIT — service, transform) — WR-02/WR-03 fixes

**Analog:** itself — `buildPosixProbe` matcher (line 71).

**WR-02 matcher (folded fix):** current `re` (line 71) is `${safe}[^\n]*\n[\s\S]*` — matches the shell's echo line. RESEARCH §State of the Art line 477: require the nonce after a newline boundary (`\n` + nonce on a produced line). **WR-03** bounded buffer: cap the matched buffer to the last N KB (8 KB) before `matches()`. **IN-02** (`void shellPath` line 88/102): leave as-is, add a Phase-8 comment.

---

### `src/main/index.ts` (EDIT — config/route, event-driven) — pickDirectory handler + Clear chord

**Analog:** itself — the `before-input-event` block (lines 91-97) + `ipcMain.handle('api:get-version')` (line 118).

**pickDirectory handler — copy the ipcMain.handle pattern** (line 118), per RESEARCH §Code Examples lines 458-463:
```typescript
ipcMain.handle('dialog:pick-directory', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
});
```
Add `dialog` to the electron import (line 1).

**Clear chord — extend the EXISTING before-input-event** (lines 91-97). It already runs `matchSwitchKey` and pushes `'session:switch'`. Add a `matchClearKey` branch (mirror `switch-keys.ts` `matchSwitchKey` lines 55-67) returning `{ kind: 'clear' }`, sent on the same `'session:switch'` channel (RESEARCH Pattern 4 (b)). Cmd+K (mac) / Ctrl+Shift+K (win) per D-13.

---

### Bridge lockstep (one new key: `pickDirectory`)

**Analog:** the entire `discoverShells` addition (the 16th key) — its shape across all four files is the exact template:
- `src/shared/api-types.ts` line 158: `discoverShells: () => Promise<DiscoveredShell[]>;` → add `pickDirectory: () => Promise<string | null>;`
- `src/preload/index.ts` line 158-159: `discoverShells: () => ipcRenderer.invoke('shell:discover')` → add `pickDirectory: () => ipcRenderer.invoke('dialog:pick-directory')`
- `src/main/window-config.ts` line 76-95 `EXPECTED_API_KEYS`: append `'pickDirectory'` (→ 19 keys); copy the per-phase doc-comment convention (lines 62-74)
- `src/shared/__tests__/security.guard.test.ts`: goes GREEN automatically (it asserts exposed keys === `EXPECTED_API_KEYS`)

Update all four in **ONE atomic task** (the established lockstep — window-config.ts lines 51-74 documents every prior expansion this way).

## Shared Patterns

### Pure shared module (electron/node-free, Vitest-importable)
**Source:** `src/shared/flow-control.ts` lines 1-16 (header) + `src/main/switch-keys.ts` lines 1-11 + `src/main/readiness-probe.ts` `buildPosixProbe`.
**Apply to:** the new `src/shared/agent-state.ts`, and any pure matcher (`matchClearKey`).
Convention: leading comment declaring purity, named exported constants, a documented contract asserted by a sibling `.test.ts`. No React/electron/xterm/node-pty import.

### contextBridge lockstep + security guard
**Source:** `src/main/window-config.ts` lines 51-95 (`EXPECTED_API_KEYS` + per-phase doc) + `src/preload/index.ts` + `src/shared/api-types.ts`.
**Apply to:** the one new `pickDirectory` key. The SC2 notice and agent-state add NO new keys (notice rides `PtyStatusPayload`; agent-state is renderer-only). Renderer NEVER touches raw `ipcRenderer` (preload header lines 16-25).

### id-filtered subscribe-returns-unsubscribe
**Source:** `src/preload/index.ts` `onPtyData` (62-71) / `onPtyStatus` (110-122) / `onSwitchSession` (145-151).
**Apply to:** any new main→renderer event (the Clear chord reuses `onSwitchSession` per Pattern 4(b), so no new subscribe needed).

### Status broadcast + notice transport (zero new keys)
**Source:** `src/main/pty-manager.ts` `setStatus` (474-485) + `PtyStatusPayload.notice` (api-types lines 66-80) + the renderer short-circuit in `SessionView` (225-228).
**Apply to:** SC2 error message. Set error status FIRST, then notice; SessionManager captures `notice` into per-row `errorMessage` for the sidebar tooltip + IdleCard.

### Contextual Start(▶)/Restart(↻) control cluster
**Source:** `src/renderer/Sidebar.tsx` `.row-controls` (228-289) — glyphs ▶/↻/✎/✕, `data-testid`/`data-action`/`aria-label`/`title`, `e.stopPropagation()` before the handler.
**Apply to:** `IdentityHeader` header cluster (SC5) — reuse the exact button markup + the SessionManager `handleStart`/`handleRestart` handlers (lines 130-162).

### CR-01 validate-in-main
**Source:** `src/main/pty-manager.ts` `isValidCwd` (778-785) + `updateProfile` guards (755-768).
**Apply to:** SC2 pre-spawn cwd check (reuse `isValidCwd`) and the folder-picker'd value (still gated by CR-01 on save).

### Single-slot timer discipline (no leak across unmount)
**Source:** `src/renderer/SessionView.tsx` resize debounce (240-249) cleared in cleanup (257-279); `pty-manager.ts` `killTimer`.
**Apply to:** the SC4 idle timer — clear before re-arm on each chunk, clear in effect cleanup, gate on `status === 'running'` (RESEARCH Pitfall 6).

## No Analog Found

None. Every capability extends an existing in-tree seam (this is a brownfield hardening + presentation phase — RESEARCH Summary lines 62-71).

## Metadata

**Analog search scope:** `src/main`, `src/renderer`, `src/shared`, `src/preload`.
**Files scanned:** 16 (read in full or targeted sections): pty-manager.ts, readiness-probe.ts, index.ts, window-config.ts, switch-keys.ts, SessionView.tsx, SessionManager.tsx, IdentityHeader.tsx, Sidebar.tsx, IdleCard.tsx, status-colors.ts, SessionEditModal.tsx, flow-control.ts, api-types.ts, types.ts, preload/index.ts.
**Pattern extraction date:** 2026-06-07
