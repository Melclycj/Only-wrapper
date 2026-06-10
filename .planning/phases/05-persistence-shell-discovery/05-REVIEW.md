---
phase: 05-persistence-shell-discovery
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - src/main/index.ts
  - src/main/pty-manager.ts
  - src/main/session-store.ts
  - src/main/shell-discovery.ts
  - src/main/store-schema.ts
  - src/main/window-bounds.ts
  - src/main/window-config.ts
  - src/preload/index.ts
  - src/renderer/IdleCard.tsx
  - src/renderer/SessionEditModal.tsx
  - src/renderer/SessionManager.tsx
  - src/renderer/Sidebar.tsx
  - src/renderer/WelcomeEmptyState.tsx
  - src/renderer/session-reorder.ts
  - src/renderer/terminal.css
  - src/shared/api-types.ts
  - src/main/__tests__/pty-hydrate.test.ts
  - src/main/__tests__/session-store.test.ts
  - src/main/__tests__/shell-discovery.test.ts
  - src/main/__tests__/store-schema.test.ts
  - src/main/__tests__/window-bounds.test.ts
  - src/renderer/__tests__/session-reorder.test.ts
  - tests/smoke/persistence.smoke.test.ts
  - tests/smoke/reorder.smoke.test.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 5 wires lowdb persistence, shell discovery, window-bounds validation, and the
validate-before-persist order/UI-state IPC surface. The pure helpers (`coerceOnLoad`,
`validateBounds`, `parseEtcShells`/`buildShellList`, `reorder`) are clean, well-tested,
and correctly guarded. The corrupt-file recovery path and the debounce/quit-flush
durability path are sound.

However, the phase's own stated security invariant — "the renderer can no longer submit
an arbitrary executable path" (T-05-03) — is **only enforced in the renderer UI, not at
the IPC boundary**. The `pty:update-profile` channel accepts any string as a shell path
and later spawns it. This is the single most important finding (CR-01). A second
correctness defect (CR-02) silently drops every profile edit made against a restored
*dormant* session, so edits to those sessions are lost on the next boot — the exact
durability promise the phase exists to deliver.

## Critical Issues

### CR-01: Arbitrary shell-path injection survives at the `pty:update-profile` IPC boundary

**File:** `src/main/pty-manager.ts:554-574` (and spawn at `:202-228`)
**Issue:**
The phase claims the free-text shell field was removed so "the renderer can no longer
submit an arbitrary executable path (security V5/T-05-03)" (`SessionEditModal.tsx:61-63`,
`window-config.ts:62-74`). That restriction lives **only in the renderer `<select>`**.
The main-side `updateProfile()` handler type-guards `shell` solely with
`typeof fields.shell === 'string'` and stores it verbatim:

```ts
if (typeof fields.shell === 'string') s.record.shell = fields.shell;
```

On the next restart/Start, `create()` spawns that stored string directly as the
executable with no further validation:

```ts
const { shell, args } =
  prior?.shell && prior.shell.length
    ? { shell: prior.shell, args: [] as string[] }   // ← arbitrary path, spawned as-is
    : resolveShell();
...
const child = pty.spawn(shell, args, { ... });
```

The contextBridge surface (`preload/index.ts:129-140`) exposes `ptyUpdateProfile`
unconditionally, so a compromised or malicious renderer (or any code with `window.api`)
can call `window.api.ptyUpdateProfile(id, { shell: '/Users/x/evil', cwd: '...' })` and
main will spawn that binary on the next restart. The whole point of validate-in-main
(Shared Pattern B / T-05-01) is that the renderer is untrusted; the shell field is the
one field that is NOT validated against an allowlist here. `cwd` has the same gap (any
path is accepted and used as the spawn cwd), but shell is the executable, so it is the
RCE-class surface.

**Fix:** Validate the persisted shell against the discovered allowlist in main before
accepting it — mirror the existing `setOrder`/`setUiState` validate-in-main pattern:

```ts
if (typeof fields.shell === 'string') {
  const allowed = this.discoverShells().some((d) => d.path === fields.shell);
  if (allowed) s.record.shell = fields.shell;
  // else: silently ignore the forged shell (keep the prior value)
}
```

(Apply the same allowlist/normalization discipline to `cwd` — e.g. require an absolute,
existing directory — so a forged payload cannot redirect the spawn cwd either.)

### CR-02: Profile edits to a restored DORMANT session are silently dropped (data loss)

**File:** `src/main/pty-manager.ts:564-565`
**Issue:**
`updateProfile()` looks the target up in the **live** map only and no-ops when it is
absent:

```ts
const s = this.sessions.get(id);
if (!s) return; // unknown/forged id → no-op (T-04-01)
```

But a boot-restored session lives in `dormantRecords`, NOT `sessions`, until the user
clicks Start. The renderer lets the user open the Edit modal on any row, including a
dormant one (`SessionManager.tsx:191-223`, `handleEdit` / `handleSaveLive` /
`handleSaveProfile` are wired for every session). When the user edits a dormant
session's name/icon/cwd/shell/startupCommand and saves:

- `handleSaveLive` updates the **renderer-local** React row (so the UI looks correct),
  and calls `ptyUpdateProfile(...)`.
- Main's `updateProfile` finds nothing in `this.sessions`, returns early, and never
  touches the `dormantRecords` entry — and never calls `signalStore()`.

Result: the edit is never persisted. Because the old reconcile poll was removed
(`SessionManager.tsx:303-305`), there is no later sync either. On the next boot,
`listSessions()` returns the un-edited dormant record and the edit is gone. For
name/icon this also produces a transient inconsistency (renderer shows the new name,
store/main still hold the old one) that is lost on restart. This defeats the core
persistence promise of the phase for exactly the sessions persistence is about
(restored ones).

**Fix:** Make `updateProfile` (and the icon assignment) also apply to a dormant record,
mirroring how `setOrder` handles both maps:

```ts
const live = this.sessions.get(id);
const target = live?.record ?? this.dormantRecords.get(id);
if (!target) return; // truly unknown id
if (typeof fields.name === 'string') target.name = fields.name;
if (typeof fields.cwd === 'string') target.cwd = fields.cwd;       // see CR-01 re: validation
if (typeof fields.shell === 'string') target.shell = fields.shell; // see CR-01 re: validation
if (typeof fields.startupCommand === 'string') target.startupCommand = fields.startupCommand;
if (fields.icon) target.icon = fields.icon;
this.signalStore();
```

## Warnings

### WR-01: `moved`/`resize` window listeners are never removed (stale-window writes after reactivate)

**File:** `src/main/index.ts:70-79`, `:102-105`
**Issue:**
`createWindow()` attaches `persistBounds` to `win.on('moved')` / `win.on('resize')`
every time it runs (and it runs again on macOS `app.on('activate')` after the window is
closed and reopened). The `closed` handler calls `detachWindow()` + `disposeAll()` but
never removes these bounds listeners, and `persistBounds` is a fresh closure per
`createWindow`. The old `BrowserWindow` is destroyed so its listeners stop firing in
practice, so this is not a live crash — but it is an accumulating-closure pattern with
no symmetric teardown, and `persistBounds` itself only guards `win.isDestroyed()`, not
the case where `ptyManager.getUiState()` is read during teardown. Pair the listener
attach with explicit removal for symmetry and to avoid surprises if the close ordering
changes.

**Fix:** Remove the listeners in the `closed` handler:

```ts
win.on('closed', () => {
  win.removeListener('moved', persistBounds);
  win.removeListener('resize', persistBounds);
  ptyManager.detachWindow();
  ptyManager.disposeAll();
});
```

### WR-02: `before-quit` flush rejection becomes an unhandled promise rejection

**File:** `src/main/index.ts:153`
**Issue:**
```ts
void store.flush().finally(() => app.quit());
```
If `db.write()` rejects (disk full, permission revoked mid-session), `.finally()`
returns a promise that re-rejects with the original error; `void` discards it, producing
an unhandled rejection during shutdown. More importantly, a failed flush means the
trailing write is lost with no diagnostic — the opposite of the D-13 durability intent.

**Fix:** Catch and log (lifecycle-only, never the data) before quitting:

```ts
void store
  .flush()
  .catch((err) => console.error('[store] final flush failed', err))
  .finally(() => app.quit());
```

### WR-03: `before-quit` only flushes when `isDirty()` — a flush already in flight can still be lost

**File:** `src/main/index.ts:149-158`, `src/main/session-store.ts:188-216`
**Issue:**
`scheduleSave()` sets `dirty = true` and arms a timer; `flush()` sets `dirty = false`
**before** `await db.write()`. If the debounce timer fires (calling `void this.flush()`)
and that async write is still in flight when `before-quit` runs, `isDirty()` is already
`false`, so the quit path skips its own flush and tears down immediately
(`disposeAll()` + `unregisterIpc()`), and the app exits without awaiting the in-flight
`db.write()`. The window is small but real (a mutation ~300ms before quit). The
durability guarantee is "the trailing write is never lost," but an in-flight write is
not awaited.

**Fix:** Track the in-flight write promise and await it in `before-quit` regardless of
`dirty`, e.g. keep `private writing: Promise<void> | null` set in `flush()` and have
`before-quit` `await store.flush(); await store.settled();` (or always await
`store.flush()` which is a cheap no-op when clean but should also chain any in-flight
write).

### WR-04: `PtyCreateOptions` type contract diverges between main and the shared API surface

**File:** `src/shared/api-types.ts:35-40` vs `src/main/pty-manager.ts:90-104`
**Issue:**
The shared `PtyCreateOptions` (the type the preload `ptyCreate` accepts) declares only
`{ cols, rows, cwd?, id? }`. The main-side `PtyManager.PtyCreateOptions` additionally
declares `name?` and `order?`, and `create()` reads `opts.name`/`opts.order`
(`:242`, `:251`). Today no renderer caller passes `name`/`order` through the bridge, so
this is latent, but the two "same-named" option types are out of sync — a future caller
that sets `opts.name` via `window.api.ptyCreate` would be a compile error against the
shared type while main silently honors it. Contract drift across the IPC boundary is the
exact bug class TypeScript-on-both-sides is meant to prevent (CLAUDE.md rationale).

**Fix:** Make the shared `PtyCreateOptions` the single source of truth (add optional
`name?`/`order?` there and import it into `pty-manager.ts`), or explicitly document that
main accepts a superset and never trusts `name`/`order` from the renderer.

### WR-05: `setUiState` partial-bounds payload silently discards collapse, and a bad bounds object leaves stale bounds

**File:** `src/main/pty-manager.ts:624-642`, `src/main/index.ts:73-76`
**Issue:**
`persistBounds` sends `{ collapsed, bounds }` and `handleToggleCollapse` sends
`{ collapsed }` (no bounds). `setUiState` only assigns `collapsed` when it is a boolean
and only assigns `bounds` when every field is finite — good. But when a `bounds` object
is present yet malformed (e.g. one `NaN` field from a degenerate display event), the
whole `bounds` branch is skipped and the previously stored bounds are retained while
`signalStore()` still fires, persisting a UI slot that does not reflect the attempted
write. That is the intended fail-safe, but there is no signal that the write was
partially rejected, and a malformed bounds will repeatedly re-trigger a debounced write
of unchanged data. Low impact, but the "validated → held" contract should at least avoid
a no-op `signalStore()` when nothing actually changed.

**Fix:** Only call `signalStore()` when a field actually changed, and consider logging a
one-time warning when a bounds payload is rejected so a degenerate display event is
diagnosable.

### WR-06: Freshly-added session record carries empty `cwd`/`shell` in renderer state (stale until next boot)

**File:** `src/renderer/session-add.ts:48-49`, `src/renderer/SessionManager.tsx:233-247`
**Issue:**
`addSession` mints the renderer-local record with `cwd: ''` and `shell: ''` (main holds
the real resolved values). The store is written from `ptyManager.listSessions()` (main's
record), so the persisted file is correct — but the renderer's in-memory row keeps the
empty strings for the session's whole life. If that session ever renders an `IdleCard`
(it can't while live, but the Edit modal seeds its fields from the renderer record), the
Edit form will pre-fill **empty** cwd/shell instead of the real ones, and saving then
writes those empties back over the real values via `updateProfile` (CR-01/CR-02 path).
The renderer should not hold placeholder identity fields that the Edit form will later
persist.

**Fix:** After `ptyCreate` resolves, fetch the authoritative record (e.g. re-read via
`listSessions()` or have `ptyCreate` return the resolved cwd/shell) so the renderer row
mirrors main, rather than carrying `''` placeholders.

## Info

### IN-01: `console.log` of spawn lifecycle includes shell path and PID

**File:** `src/main/pty-manager.ts:268`, `:284`
**Issue:** `console.log(\`[pty] spawned ${shell} pid=${ptyPid} ...\`)` logs the shell
path and PID. This is lifecycle-only (not PTY data, so it respects the V7 "never log
output" rule), but in a packaged app these logs may persist. Acceptable, noted for
awareness — ensure production logging is gated/leveled.

### IN-02: `nextOrder()` and `reorder()` both densely reindex but `nextOrder` does not de-gap existing orders

**File:** `src/main/pty-manager.ts:356-365`
**Issue:** `nextOrder()` returns `max(order)+1`. After many add/close cycles the stored
orders can become sparse (e.g. 0, 5, 6) even though `reorder()` re-denses on drag. Not a
correctness bug (sort still works), but the two ordering authorities use different
density assumptions. Consider normalizing order on hydrate for consistency.

### IN-03: `validateBounds` accepts an on-screen top-left with arbitrarily large width/height

**File:** `src/main/window-bounds.ts:50-59`
**Issue:** The check only validates that the top-left corner falls inside some work-area
and that width/height are positive. A saved `{x:0,y:0,width:99999,height:99999}` passes
and would open a window far larger than any display. Not a crash (the OS clamps), and
out of the documented contract, but a `Math.min` against the display work-area would be
more robust.

### IN-04: Smoke tests assert weakly (`toBeGreaterThanOrEqual(0)`) and cannot fail meaningfully

**File:** `tests/smoke/persistence.smoke.test.ts:200`
**Issue:** `expect(dormantStarts).toBeGreaterThanOrEqual(0)` is always true and proves
nothing about the dormant Start affordance. The exclusivity assertion (`strayStarts`)
above it is meaningful; the second assertion is dead. Tighten or remove it so the test
documents an actual invariant.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
