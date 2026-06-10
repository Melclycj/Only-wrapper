---
phase: 02-pty-core-terminal-fidelity
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/main/pty-manager.ts
  - src/main/shell-resolver.ts
  - src/main/flow-control.ts
  - src/main/index.ts
  - src/main/window-config.ts
  - src/preload/index.ts
  - src/renderer/TerminalPane.tsx
  - src/renderer/index.tsx
  - src/renderer/terminal.css
  - src/shared/api-types.ts
  - src/shared/vite-globals.d.ts
  - src/main/__tests__/flow-control.test.ts
  - src/main/__tests__/pty-validation.test.ts
  - src/main/__tests__/shell-resolver.test.ts
  - forge.config.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: partially_remediated
remediation:
  fixed: [CR-01, CR-02, WR-01]
  deferred: [WR-02, WR-03, WR-04, WR-05, WR-06, IN-01, IN-02, IN-03, IN-04]
  commits:
    CR-01: 75fdf85
    CR-02: cf10dba
    WR-01: 4f00a0b
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 2 wires a single real PTY-backed terminal (node-pty in main, xterm in renderer) over a typed contextBridge. The core security posture is solid: `contextIsolation`/`sandbox`/`nodeIntegration` are locked, the contextBridge exposes only the 8 named methods (no raw `ipcRenderer`), every IPC arg is validated in `PtyManager` (id existence, dimension clamping, string type-guard), raw PTY bytes are never logged, and `disposeAll()` is wired to both `closed` and `before-quit`. Event subscriptions are id-filtered and return working unsubscribe functions.

However, the review surfaces two BLOCKERs: (1) IPC handlers are registered per-window without ever being torn down, so the macOS `activate` re-create path throws and/or stacks duplicate listeners that fan PTY output into a dead window; (2) the renderer flow-control state machine has a lost-resume / stuck-paused defect because the resume decision is keyed off the wrong post-drain comparison ordering and an unstable `data.length` capture, and the main-side watermark accountant is dead code that gives a false sense of backpressure coverage. Several warnings around resize-before-ready, exit cleanup, and clipboard error handling follow.

## Critical Issues

### CR-01: IPC handlers registered per-window are never removed — macOS re-activate throws and stacks ghost listeners

> **RESOLVED (commit `75fdf85`).** `registerIpc` now guards handler registration behind an `ipcRegistered` flag — handlers are wired once, `this.win` (the send target, read lazily so `pty:data`/`pty:exit` always reach the current window) is updated on every call. Added a symmetric `unregisterIpc()` called on `before-quit`. `src/main/__tests__/ipc-registration.test.ts` proves idempotency (create handler registered exactly once, no stacked `on` listeners, N create/destroy cycles never throw, clean re-register after teardown).

**File:** `src/main/pty-manager.ts:189-214`, `src/main/index.ts:30-32,55-59`

**Issue:** `registerIpc(win)` calls `ipcMain.handle(PTY_CHANNELS.create, …)` and four `ipcMain.on(…)` registrations. These are **process-global**, not per-window. In `index.ts`, the window `'closed'` handler calls `disposeAll()` but never tears down the IPC registrations, and `app.on('activate')` calls `createWindow()` again (the standard macOS pattern — and macOS is the primary target). On reactivation:

1. `ipcMain.handle('pty:create', …)` throws `Attempted to register a second handler for 'pty:create'` because Electron forbids a second `handle` for the same channel without a prior `removeHandler`. This crashes window creation.
2. Even if `handle` did not throw, every `ipcMain.on(…)` adds an **additional** listener each activate, so `pty:write`/`pty:resize`/`pty:pause`/`pty:resume` fire N times per message after N activations.
3. `this.win` is reassigned to the new window, so the old `child.onData(...)` closures (captured per session) still hold `this.win` via `this`, but new sessions point at the new window — mixed-window output routing once multiple windows/sessions exist (Phase 3).

This is a crash on a routine, documented user action on the primary platform.

**Fix:** Register IPC once at app scope (idempotently), and remove handlers on teardown. Guard against double-registration:
```ts
registerIpc(win: BrowserWindow): void {
  this.win = win;
  if (this.ipcRegistered) return;       // idempotent
  this.ipcRegistered = true;
  ipcMain.handle(PTY_CHANNELS.create, (_e, opts) => this.create(opts));
  ipcMain.on(PTY_CHANNELS.write,  (_e, id, data) => this.write(id, data));
  // …
}
// And on quit/teardown:
unregisterIpc(): void {
  ipcMain.removeHandler(PTY_CHANNELS.create);
  ipcMain.removeAllListeners(PTY_CHANNELS.write);
  // … etc
  this.ipcRegistered = false;
}
```
Alternatively call `ipcMain.removeHandler(PTY_CHANNELS.create)` + `removeAllListeners` for the four send channels at the top of `registerIpc`, and update `this.win` on every activate.

### CR-02: Flow-control resume is keyed off a post-mutation race — lost-resume / stuck-paused deadlock

> **RESOLVED (commit `cf10dba`).** Replaced the ad-hoc counter with explicit edge-tracking: a `paused` boolean toggled ONLY on the transition — `ptyPause(id)` once when crossing above HIGH (and not already paused), `ptyResume(id)` once when draining below LOW (and currently paused). No resume spam, no lost resume, no stuck-paused deadlock. The accounting uses the shared `createWatermark` accountant (`src/shared/flow-control.ts`, electron/node-pty-free) — the same layer the unit tests now exercise (see WR-01). Edge behaviour is asserted by the new hysteresis case in `src/shared/__tests__/flow-control.test.ts`.

**File:** `src/renderer/TerminalPane.tsx:159-167`

**Issue:** The renderer is the only place flow control actually runs (see WR-01 — the main-side watermark is dead code), and its state machine is unsound:

```ts
let watermark = 0;
offData = window.api.onPtyData(id, (data) => {
  watermark += data.length;
  term.write(data, () => {
    watermark = Math.max(watermark - data.length, 0);
    if (watermark < FLOW_LOW) window.api.ptyResume(id);   // (A)
  });
  if (watermark > FLOW_HIGH) window.api.ptyPause(id);       // (B)
});
```

Two defects:

1. **No pause/resume edge tracking.** `ptyResume(id)` is sent on *every* write-callback once `watermark < FLOW_LOW` — which is true for the vast majority of normal small writes when never paused. So `resume` is spammed continuously even when not paused (harmless to node-pty but masks the real bug), while the *pause* side fires only at (B). The intended hysteresis (pause at HIGH, resume at LOW, and only toggle on the transition) is not implemented. Because resume is unconditional-on-low and pause is checked synchronously at (B) *before* the async write callbacks for the just-queued chunk run, a high-throughput burst can interleave so that: chunk arrives → watermark jumps over FLOW_HIGH → `pause()` sent (B); but the in-flight write callbacks from earlier chunks already drove `watermark < FLOW_LOW` and sent `resume()` *after* this `pause()` is delivered out of order across the async boundary, leaving the PTY paused with no further data to trigger another callback → **stuck-paused / lost-resume deadlock** on a large `cat`.

2. **Unstable `data.length` capture.** The increment `watermark += data.length` and the decrement `watermark -= data.length` use `data.length` (UTF-16 code units). They net out only because the same closure variable is captured — but the FLOW_HIGH/FLOW_LOW thresholds are defined as **byte** budgets in both the research note and `flow-control.ts` (which counts bytes). Counting UTF-16 units against byte thresholds is an inconsistent unit, and more importantly the design intends main-side byte accounting (the dead `Watermark`) to be the source of truth.

**Fix:** Track an explicit `paused` boolean and only toggle on the edge, and make the resume decision after the drain consistently:
```ts
let buffered = 0;
let paused = false;
offData = window.api.onPtyData(id, (data) => {
  buffered += data.length;
  if (!paused && buffered > FLOW_HIGH) {
    paused = true;
    window.api.ptyPause(id);
  }
  term.write(data, () => {
    buffered = Math.max(buffered - data.length, 0);
    if (paused && buffered < FLOW_LOW) {
      paused = false;
      window.api.ptyResume(id);
    }
  });
});
```
This guarantees resume is only sent when actually paused and the queue has drained, eliminating the deadlock and the resume spam. Consider wiring the existing main-side `createWatermark` accountant (currently unused) so the byte accounting is authoritative.

## Warnings

### WR-01: Main-side watermark accountant is dead code — false backpressure coverage

> **RESOLVED (commit `4f00a0b`).** Reconciled to the renderer-driven model (02-RESEARCH §Flow Control recommendation (a)). The accountant moved to `src/shared/flow-control.ts` (electron/node-pty-free, ESLint-enforced) where `TerminalPane` actually imports and exercises every method (CR-02). Dropped the unused `PtySession.watermark` field and the per-session `createWatermark` instantiation from `pty-manager.ts`; deleted the old `src/main/flow-control.ts` + its test and relocated the unit test to `src/shared/__tests__/flow-control.test.ts` so it tests the layer that runs — now including the CR-02 pause-once/resume-once edge case. No test asserts dead code.

**File:** `src/main/pty-manager.ts:115-116`, `src/main/flow-control.ts` (whole module)

**Issue:** `createWatermark(100000, 10000)` is constructed and stored in `PtySession.watermark`, but `add()`, `drain()`, `shouldPause()`, and `shouldResume()` are **never called** anywhere in main. The entire `flow-control.ts` module and its unit tests assert a state machine that the production code does not use; the real flow control lives in the renderer (CR-02). This is dead code masquerading as the SC5 backpressure implementation and will mislead the next reviewer/maintainer into believing main enforces backpressure.

**Fix:** Either (a) make main authoritative: count bytes in `child.onData`, call `watermark.add(data.length)`; on a renderer ack IPC call `watermark.drain(...)` and `pause()/resume()` the PTY when `shouldPause()/shouldResume()` flip — and remove the renderer-side accounting; or (b) delete `flow-control.ts`, its tests, and the `watermark` field from `PtySession`, and document that flow control is renderer-side. Do not keep both half-wired.

### WR-02: First ResizeObserver callback can resize the PTY to a stale fit before the PTY exists, and to a pre-spawn size after

**File:** `src/renderer/TerminalPane.tsx:177-188`

**Issue:** `resizeObserver.observe(container)` fires the callback synchronously on first observation. `onResize` debounces then calls `fit.fit()` and `ptyResize` if `ptyId` is set. Before the PTY resolves, `ptyId` is null so resize is skipped — but `fit.fit()` still runs and may change `term.cols/rows` away from the values that were passed to `ptyCreate` at line 145, with no follow-up resize sent once `ptyId` arrives. Result: the PTY can be spawned at one size and the terminal rendered at another with no reconciliation until the next genuine resize event. Programs querying COLUMNS/LINES at startup (vim, less) can mis-size.

**Fix:** After `ptyCreate` resolves and `ptyId` is set, send one reconciliation resize: `window.api.ptyResize(id, term.cols, term.rows);` inside the `.then` block (after `fit.fit()` if needed).

### WR-03: Exit handler writes to xterm but never disposes/marks the dead session — input still forwarded to a dead PTY

**File:** `src/renderer/TerminalPane.tsx:139-141,170-172`

**Issue:** After the shell exits, `onPtyExit` prints `[process exited]` but `ptyId` remains set. The `term.onData` handler (line 139-141) keeps calling `window.api.ptyWrite(ptyId, d)` for any subsequent keystroke. In main, `child.onExit` deletes the session, so `write()` finds no session and returns — functionally a silent no-op, but the terminal still accepts and echoes nothing, giving the user a "frozen but alive" terminal with no signal that input is going nowhere.

**Fix:** On exit, null out `ptyId` (or set a `exited` flag) so `onData` stops forwarding, and optionally make the cursor/readonly state reflect the dead session.

### WR-04: Unhandled promise rejections on clipboard read/write

**File:** `src/renderer/TerminalPane.tsx:112-117,124`

**Issue:** `navigator.clipboard.writeText(...)`, `navigator.clipboard.readText().then(...)` are fired with `void` and no `.catch`. Clipboard access can reject (permission denied, focus loss, non-secure context). An unhandled rejection surfaces as a console error and the paste/copy silently fails with no user feedback.

**Fix:** Add `.catch` handlers:
```ts
void navigator.clipboard.readText().then((t) => term.paste(t)).catch(() => {/* notify or no-op */});
```

### WR-05: `create()` does not validate `opts` shape — a malformed invoke payload reaches `pty.spawn`

**File:** `src/main/pty-manager.ts:94-108`

**Issue:** Unlike `write`/`resize`, the `pty:create` handler passes `opts` straight to `create()`, which reads `opts.cols`, `opts.rows`, `opts.cwd` with no validation that `opts` is an object. `clampDimension` defends cols/rows (NaN/undefined → 1), but `opts.cwd` is passed unchecked to `pty.spawn` as `cwd`. A renderer-compromise (or future bug) could pass a non-string or attacker-controlled `cwd`; `node-pty` will attempt to chdir there. While the renderer is trusted today, the threat model explicitly treats every IPC arg as hostile.

**Fix:** Validate `opts.cwd` is a string and (ideally) an existing absolute directory before passing it; fall back to `os.homedir()` otherwise:
```ts
const cwd = typeof opts?.cwd === 'string' && path.isAbsolute(opts.cwd) ? opts.cwd : os.homedir();
```
Also guard `opts` being null before destructuring.

### WR-06: No `pty:kill` IPC — renderer cannot terminate a session; relies solely on window/quit hooks

**File:** `src/main/pty-manager.ts:166-171,189-214`, `src/shared/api-types.ts:38-57`

**Issue:** `kill(id)` exists on `PtyManager` but is not exposed via IPC and not in the contextBridge surface. For Phase 2's single auto-session this is acceptable, but the exit path (WR-03) and any future "close session" UI have no way to deterministically reap a PTY before window close. Worth flagging as a known gap so it is not silently assumed present.

**Fix:** None required for Phase 2 scope; document explicitly that kill is deferred to Phase 3, or add `ptyKill` to the surface and IPC if the exit/restart UX needs it sooner.

## Info

### IN-01: Watermark counts UTF-16 code units but thresholds are byte-denominated

**File:** `src/renderer/TerminalPane.tsx:159-166`, `src/main/flow-control.ts:16-17`

**Issue:** `data.length` is UTF-16 units; FLOW_HIGH/FLOW_LOW (and the main-side `WATERMARK_HIGH/LOW`) are documented as byte budgets. For ASCII they coincide; for heavy CJK/emoji output the effective threshold drifts. Low impact given the large absolute values, but the unit mismatch should be noted/normalized.

**Fix:** Decide on one unit (bytes via `Buffer.byteLength` in main, or accept UTF-16 units in renderer) and align the constant docs accordingly.

### IN-02: `console.log` on every spawn/exit includes the LogicalId

**File:** `src/main/pty-manager.ts:119,128`

**Issue:** Lifecycle logging (not raw PTY data, which is correctly never logged) prints shell path, PID, and LogicalId to stdout. Benign locally, but in a packaged app these go to the system log. Confirm this is acceptable; consider gating behind a debug flag for release builds.

**Fix:** Optional — wrap lifecycle logs in a `if (isDev)` guard or a leveled logger.

### IN-03: `(window as unknown as { __term?: Terminal }).__term` test hook ships in production

**File:** `src/renderer/TerminalPane.tsx:130,200`

**Issue:** The E2E driver hook attaches the live `Terminal` to `window.__term` unconditionally, exposing the full terminal API on the global in production builds. It is cleaned up on unmount, but it is present whenever a pane is mounted. Low risk in a local-only app with no remote content, but it is a non-production artifact in shipped code.

**Fix:** Gate behind a dev/test flag: `if (import.meta.env.DEV) (window as …).__term = term;`.

### IN-04: WebGL fallback constructs `WebglAddon` then relies on try/catch that won't catch async context loss path correctly

**File:** `src/renderer/TerminalPane.tsx:81-94`

**Issue:** `new WebglAddon()` and `term.loadAddon(webgl)` are guarded by try/catch for synchronous failure, and `onContextLoss` swaps to canvas later. That is reasonable, but `webgl.onContextLoss` is registered *before* `term.loadAddon(webgl)`; if `loadAddon` throws, `webgl` was already created and not disposed (minor leak of an unattached addon). Also if canvas `loadAddon` inside the catch throws, the comment claims DOM fallback but no explicit fallback call confirms xterm reverts. Mostly cosmetic.

**Fix:** Move `onContextLoss` registration after a successful `loadAddon`, and `webgl.dispose()` in the catch before trying canvas.

---

## Remediation (2026-06-04)

Both BLOCKERs and the coupled warning are fixed; the remaining warnings and all Info items are deferred.

| Finding | Status | Commit |
|---------|--------|--------|
| CR-01 (IPC re-activate crash) | RESOLVED | `75fdf85` |
| CR-02 (lost-resume deadlock) | RESOLVED | `cf10dba` |
| WR-01 (dead main watermark) | RESOLVED | `4f00a0b` |
| WR-02..WR-06 | DEFERRED (open) | — |
| IN-01..IN-04 | DEFERRED (open) | — |

**Verification:** `npx tsc --noEmit` → 0, `npm run lint` → 0, `npx vitest run` → 29/29 GREEN (flow-control unit test now exercises the real renderer-driven accountant, with an added pause-once/resume-once edge case + a new CR-01 IPC-idempotency suite). E2E smoke (`npm run test:smoke`) could not be executed in the CI/sandbox environment — chromedriver/Electron WebDriver session creation times out (`DevToolsActivePort file doesn't exist`, no display, no `--no-sandbox`); this is environmental and fails identically at session bootstrap for every spec before any test body runs. The packaged binary itself boots cleanly, and the CR-02 deadlock fix is covered at the unit level by the edge-tracking test.

---

_Reviewed: 2026-06-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
