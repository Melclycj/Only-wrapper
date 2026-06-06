# Phase 5: Persistence + Shell Discovery - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 18 (7 new, 11 modified)
**Analogs found:** 18 / 18 (every new/modified file has a strong in-repo analog)

> This phase is unusually well-prepared: the codebase already established every pattern
> the new files need (pure-electron-free main helpers + Vitest, the contextBridge 5-point
> lockstep, the validate-in-main IPC discipline, the renderIcon/status-badge reuse chain,
> and pure reducer modules for renderer state). New files should COPY these verbatim.

---

## File Classification

| New/Modified File | New? | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|------|-----------|----------------|---------------|
| `src/main/session-store.ts` | NEW | service (store) | file-I/O / CRUD | `src/main/pty-manager.ts` (class owns a Map, validate-in-main) | role-match |
| `src/main/store-schema.ts` | NEW | utility (pure) | transform | `src/main/window-config.ts` (electron-free pure module + exported const) | exact |
| `src/main/shell-discovery.ts` | NEW | service (provider) | transform / file-I/O | `src/main/shell-resolver.ts` (pure, electron-free, OS-agnostic seam) | exact |
| `src/main/window-bounds.ts` | NEW (if hand-rolling) | utility (pure) | transform | `src/main/pty-manager.ts` `clampDimension` (pure validation helper) | role-match |
| `src/renderer/IdleCard.tsx` | NEW | component | request-response | `src/renderer/IdentityHeader.tsx` (renderIcon + status-badge reuse) | role-match |
| `src/renderer/WelcomeEmptyState.tsx` | NEW | component | event-driven (CTA) | `src/renderer/ConfirmModal.tsx` / Sidebar add-button | role-match |
| `src/renderer/session-reorder.ts` | NEW | utility (pure reducer) | transform | `src/renderer/session-close.ts` (pure React-free reducer) | exact |
| `src/main/pty-manager.ts` | MOD | service | CRUD | itself (extend with `hydrate`, `setOrder`, change-signal) | self |
| `src/main/index.ts` | MOD | config (lifecycle) | event-driven | itself (whenReady / before-quit hooks already present) | self |
| `src/main/window-config.ts` | MOD | config | — | itself (`EXPECTED_API_KEYS` += 3) | self |
| `src/shared/api-types.ts` | MOD | types | request-response | itself (add 3 `ElectronAPI` methods) | self |
| `src/preload/index.ts` | MOD | bridge | request-response | itself (mirror existing invoke/send methods) | self |
| `src/renderer/SessionManager.tsx` | MOD | component (container) | event-driven | itself (replace boot/poll; add Start + reorder wiring) | self |
| `src/renderer/Sidebar.tsx` | MOD | component | event-driven | itself (Start/Restart label flip; dnd-kit wrap) | self |
| `src/renderer/SessionEditModal.tsx` | MOD | component (form) | request-response | itself (shell input → `<select>` from `discoverShells`) | self |
| `src/renderer/SessionView.tsx` | MOD | component | streaming | itself (host IdleCard when `not_started`) | self |
| `src/shared/__tests__/security.guard.test.ts` | MOD | test | — | itself (15 → 18 key assertion) | self |
| `src/main/__tests__/*.test.ts` (5 NEW) | NEW | test | — | `src/main/__tests__/shell-resolver.test.ts` (pure-helper Vitest) | exact |

---

## Shared Patterns

These cross-cutting patterns apply to MULTIPLE new files. Copy them first.

### A. Electron-free pure main module (so Vitest imports it directly)
**Source:** `src/main/shell-resolver.ts` L1-37 and `src/main/window-config.ts` L1-25
**Apply to:** `store-schema.ts`, `shell-discovery.ts`, `window-bounds.ts`, and the pure helpers inside `session-store.ts`.

The repo convention: any logic that must be unit-tested lives in a module with **NO `import from 'electron'`** so Vitest (Node env) loads it standalone. `shell-resolver.ts` opens with a comment stating exactly this rationale; `window-config.ts` repeats it. The Electron-touching wrapper (`session-store.ts` reading `app.getPath`) stays thin and delegates to the pure helpers.

```typescript
// src/main/window-config.ts:1
// Pure factory — NO import from 'electron'.
// Keeping this file electron-free lets Vitest (Node env) import it directly
// without an Electron process...
```

`store-schema.ts` is explicitly designed this way in RESEARCH (`coerceOnLoad` is pure → unit-tested); `shell-discovery.ts` exposes `parseEtcShells` / `buildShellList` as pure helpers with an injected `existsFn` for the same reason.

### B. Validate-in-main before any state mutation (Security V5)
**Source:** `src/main/pty-manager.ts` L75-78 (`isStringData`), L439-458 (`updateProfile` per-field type-guard), L410-420 (`close` unknown-id no-op)
**Apply to:** the `persistOrder` and `persistUiState` IPC handlers (new), and any store write fed by renderer payloads.

Every renderer-supplied field is type-guarded before it touches state; an unknown id is a silent no-op. Copy this discipline exactly — a forged `order`/`bounds` payload must never write arbitrary data to disk.

```typescript
// pty-manager.ts:451 — the per-field guard to mirror
if (typeof fields.name === 'string') s.record.name = fields.name;
```
For `persistOrder`, guard each entry: `id` is a known LogicalId AND `order` is a finite number (`Number.isFinite`). For `persistUiState.bounds`, guard each of x/y/width/height is finite.

### C. contextBridge 5-point lockstep (3 new keys)
**Source:** the existing 15-key set across 5 files. The guard test asserts an EXACT set.
**Apply to:** `discoverShells`, `persistOrder`, `persistUiState`.

The five edit points (do in ONE atomic task, mirroring the 04-01 expansion documented in `window-config.ts` L51-60):

| File | What to add | Mirror existing |
|------|-------------|-----------------|
| `src/shared/api-types.ts` L69-136 | 3 methods on `ElectronAPI` | `listSessions` (invoke), `ptyUpdateProfile` (send) |
| `src/main/window-config.ts` L62-78 | 3 strings in `EXPECTED_API_KEYS` | append after `onSwitchSession` |
| `src/preload/index.ts` L35-151 | 3 impls in the `api` object | `listSessions` L105 (invoke), `ptyUpdateProfile` L128 (send) |
| `src/main/pty-manager.ts` `PTY_CHANNELS` L30-48 + `registerIpc` L487 + `unregisterIpc` L557 | channel const + handler + symmetric teardown | `list` (handle), `updateProfile` (on) |
| `src/shared/__tests__/security.guard.test.ts` L48-52 | nothing to change in test code; it reads `EXPECTED_API_KEYS` | — |

> The guard test (L48-52) compares `Object.keys(exposed).sort()` to `EXPECTED_API_KEYS.sort()`. It goes RED the moment `EXPECTED_API_KEYS` grows and GREEN only when preload exposes exactly the new set (intended Wave-0 RED).

### D. Pure React-free renderer reducer + its Vitest
**Source:** `src/renderer/session-close.ts` (imported in SessionManager L34) + `src/renderer/__tests__/session-close.test.ts`
**Apply to:** `session-reorder.ts` (dense `order` reindex, Pitfall 6).

The repo keeps state transitions (close, switch, edit-split) in React/xterm-free modules so they unit-test in the Node env. `SessionManager.tsx` imports them (`closeSession`, `resolveSwitch`, `addSession`, `splitEdit`) and calls them inside `setSessions`. `session-reorder.ts` should export a pure `reorder(sessions, fromId, toId) → SessionRecord[]` (using `arrayMove` then reindexing `order` densely 0..n-1).

### E. renderIcon + status-badge reuse chain (never re-derive)
**Source:** `src/renderer/Sidebar.tsx` L21-44 (`renderIcon`, exported) + L166-173 (`.status-badge` markup); `STATUS_STYLE` from `status-colors.ts`
**Apply to:** `IdleCard.tsx` (identity region) and the dormant-vs-live row reading.

`IdentityHeader.tsx` L24-37 is the canonical "reuse verbatim" example — it imports `renderIcon` from `Sidebar` and the same `.status-badge` + `STATUS_STYLE[status].accent` markup. `IdleCard` does the same for its identity region (icon + name + "Idle" badge). UI-SPEC §1 confirms: "Reuse the `.identity-header` markup conventions".

---

## Pattern Assignments (new files)

### `src/main/store-schema.ts` (utility, pure transform)
**Analog:** `src/main/window-config.ts`
**Copy:** the electron-free header comment + the "export a typed const + pure fn" shape.
**Pattern (from RESEARCH Pattern 1, verbatim target):**
```typescript
export const SCHEMA_VERSION = 1 as const;
export interface StoreSchema {
  version: number;
  sessions: SessionRecord[];
  ui: { collapsed?: boolean; bounds?: { x: number; y: number; width: number; height: number } };
}
/** D-01: every restored record loads dormant. PURE + unit-tested. */
export function coerceOnLoad(rec: SessionRecord): SessionRecord {
  return { ...rec, status: 'not_started', ptyPid: undefined };
}
```
`SessionRecord` type is already complete (`types.ts` L65-95) — DO NOT reshape it. `status: 'not_started'` is a valid `SessionStatus` member (`types.ts` L31-36).

### `src/main/session-store.ts` (service, file-I/O + CRUD)
**Analog:** `src/main/pty-manager.ts` (a class owning a `Map`/data, with validate-in-main and a debounced/guarded lifecycle).
**Copy:**
- The class-owns-the-store shape (`PtyManager` owns `sessions`; `SessionStore` owns the lowdb `Low<StoreSchema>`).
- The idempotency/guard discipline (`PtyManager.ipcRegistered` L144 → `SessionStore` quitting/dirty flags).
- **lowdb dynamic import** (the load-bearing pattern, RESEARCH Pattern 1 / Pitfall 1): `await import('lowdb')` NOT a static import (would transpile to `require()` → `ERR_REQUIRE_ESM`). Mark `lowdb` external in `vite.main.config.ts` next to `node-pty` — mirror how `pty-manager.ts` treats node-pty as a main-only native external.
- Debounced write + quit flush (RESEARCH Pattern 3): `scheduleSave()` (~300ms trailing) + `flush()`; `before-quit` `preventDefault()`-then-flush.
- Corrupt-file recovery: try/catch around `db.read()` → back up `.corrupt-${Date.now()}` → start fresh (never crash).
**Note:** resolve the store path INSIDE `load()` (called from `whenReady`), NOT at module scope — `app.getPath('userData')` is invalid before ready (Pitfall 3). Contrast: `index.ts` already gates all window work behind `app.whenReady().then(createWindow)` (L69).

### `src/main/shell-discovery.ts` (service/provider, transform)
**Analog:** `src/main/shell-resolver.ts` (EXACT — same seam pattern, same OS-deferral comment).
**Copy:** the "macOS-now, Windows-deferred-to-Phase-8, no hardcoded paths" structure. `shell-resolver.ts` L20-30 already documents the Windows-deferral seam pattern this file extends.
**Reuse:** `resolveShell().shell` (L31-37) is the always-included `$SHELL` fallback (D-05 safety). Import it — do not recompute.
**Pure helpers (electron-free, injected `existsFn` — Shared Pattern A):** `parseEtcShells(contents)`, `buildShellList(etcPaths, resolvedShell, existsFn)`, `selectShellProvider(platform)`. `MacShellProvider.discover()` does the `fs.readFileSync('/etc/shells')` (wrapped in try/catch → fall back to `$SHELL`-only). `WindowsShellProvider` is a stub returning the resolved default (never empty — D-05 holds cross-platform).

### `src/main/window-bounds.ts` (utility, pure — if hand-rolling D-12)
**Analog:** `src/main/pty-manager.ts` `clampDimension` L69-73 (pure validation helper with explicit edge-case contract).
**Copy:** the pure-validate-with-documented-edges shape. `validateBounds(saved, displays)` rejects bounds that don't intersect any display work-area (Pitfall 5), returns defaults/centered otherwise. Electron-free (accept `displays` as an argument) so Vitest mocks `screen.getAllDisplays()` output.

### `src/renderer/IdleCard.tsx` (component, request-response)
**Analog:** `src/renderer/IdentityHeader.tsx` (identity region) + `SessionEditModal.tsx` (read-only field block).
**Copy:**
- Identity region: `renderIcon(session.icon, session.name)` + `.row-name` + `.status-badge` with `STATUS_STYLE[status].accent` — verbatim from `IdentityHeader.tsx` L24-37 (Shared Pattern E).
- Config block: three label+value pairs mirroring `SessionEditModal.tsx` L148-176 (`.edit-field` / `.edit-label`) but READ-ONLY mono values (UI-SPEC §1: JetBrains Mono 13px values in a `--bg-sunk` inset).
- The `▶ Start session` button fires `onStart(id)` (wired in SessionManager to the existing `ptyCreate`/`ptyRestart` path — NO new IPC). startupCommand is DISPLAYED, never executed (D-04 / TERM-05 boundary).
**Rendered where:** `SessionManager.tsx` `.terminal-area` (L318) when `activeRecord?.status === 'not_started'`, in place of (or layered over) the xterm `.viewport-stack`.

### `src/renderer/WelcomeEmptyState.tsx` (component, CTA)
**Analog:** `src/renderer/ConfirmModal.tsx` (centered surface + a single primary button) / Sidebar add-button (L238-246).
**Copy:** the primary-button + `data-testid` convention (`data-testid="welcome-create-session"`). CTA runs the EXISTING quick-add path (`onAdd` in SessionManager L175-190 → `addSession` → `ptyCreate`) — D-11 new=live. Shown when `sessions.length === 0` (replaces the boot auto-add at SessionManager L192-206).

### `src/renderer/session-reorder.ts` (pure reducer)
**Analog:** `src/renderer/session-close.ts` (EXACT — pure React-free reducer imported into SessionManager).
**Copy:** the pure `(sessions, ...args) → newSessions` signature + its colocated Vitest. Export `reorder(sessions, fromIndex|id, toIndex|id)` → `arrayMove` then reindex `order` densely 0..n-1 (Pitfall 6: avoid `order` gaps/collisions). New-session order = `max(existing.order)+1` (the current `create()` `this.sessions.size` fallback at pty-manager L202 can collide — note for the hydrate path).

---

## Pattern Assignments (modified files)

### `src/main/pty-manager.ts` — add `hydrate()` + `setOrder()` + change-signal
**Self-analog:** existing `create()` L154-257 and `listSessions()` L370-372.
- `hydrate(records)`: populate dormant records WITHOUT spawning. **RESEARCH Pitfall 4 / Pattern 4 (option b, recommended):** keep a separate `dormantRecords: Map<LogicalId, SessionRecord>` rather than making `PtySession.pty` optional — preserves the "every `PtySession` has a live pty" invariant (the L128-135 `PtySession` interface assumes `pty: IPty`). `listSessions()` merges live + dormant; `create({id})` for a dormant id promotes it.
- Every record mutation (create/close/updateProfile/setOrder/hydrate) calls a change-signal the `SessionStore` subscribes to → `scheduleSave()`.
- `setOrder(orders)`: validate-in-main per Shared Pattern B before writing `record.order`.

### `src/main/index.ts` — wire store load + quit flush + bounds
**Self-analog:** existing `whenReady` (L69) and `before-quit` (L85-88) hooks.
- `whenReady`: `store.load()` → `ptyManager.hydrate(store.sessions)` → `createWindow()` (restore validated bounds BEFORE `win.show`).
- `before-quit` (extend L85-88, which already does PTY teardown): add the `preventDefault()`-then-flush re-entrancy guard (RESEARCH Pattern 3) so the trailing debounced write lands.

### `src/renderer/SessionManager.tsx` — replace boot/poll; add Start + reorder
**Self-analog:** itself.
- **Replace** boot auto-add (L192-206) with: empty → render `WelcomeEmptyState`; non-empty → sort by `order`, focus first (D-09).
- **Remove** the `RECONCILE_MS` poll (L42-44, L254-275) — collapse to the one-shot snapshot load (the L242-253 comment already says "Phase 5 replaces this poll with the persisted snapshot").
- Collapse state `useState` (L65) → mirror to main via `persistUiState` (D-12); the comment at L62-64 explicitly flags this as Phase-5's job.
- Start wiring: dormant row ▶ / IdleCard ▶ → reuse `handleRestart` shape (L116-127) but label "Start" when `not_started`.
- Reorder: feed dnd-kit `onReorder` → `session-reorder.ts` (optimistic local) + `persistOrder` IPC.

### `src/renderer/Sidebar.tsx` — Start/Restart label flip + dnd-kit
**Self-analog:** the existing `.row-controls` Restart button (L177-192).
- Generalize the `!running` Restart control: `not_started` → ▶ `data-action="start"` `data-testid="start-session"` `aria-label="Start {name}"`; has-run → ↻ Restart (unchanged). UI-SPEC §2.
- Dormant rows: slate "Idle" badge (via `STATUS_STYLE.not_started`) + 0.85 icon/name opacity (UI-SPEC Color). No disabled styling.
- Wrap rows in `@dnd-kit/sortable` `SortableContext`; `useSortable` per row. Keep the existing `onClick` switch + control `stopPropagation` (L185, L205, L221) working via a pointer-sensor activation distance (UI-SPEC §5).

### `src/renderer/SessionEditModal.tsx` — shell input → `<select>`
**Self-analog:** the existing shell `.edit-input` (L163-176).
- Replace the free-text `<input ref={shellRef}>` with a native `<select className="edit-select">` populated from `window.api.discoverShells()`. Options: `label`=basename, `value`=full path; resolved `$SHELL` default-selected (D-05). While in flight: single disabled "Finding shells…" option (UI-SPEC §3).
- Keep the `handleSave` ref-read pattern (L86-108) — a `<select>` exposes `.value` the same way `shellRef.current?.value` does.

### `src/renderer/SessionView.tsx` — host IdleCard when dormant
**Self-analog:** itself.
- The mount effect (L106-267) assumes a live PTY. A `not_started` session has none. Gate xterm creation (or render `IdleCard` in place) until the session is started — coordinate with the SessionManager dormant-map / activeRecord status. Minimal change: SessionManager renders `IdleCard` in `.terminal-area` when active is dormant, and only mounts `SessionView` for started sessions (or `SessionView` early-returns the card on `not_started`).

---

## New Tests (Wave 0)

**Analog for ALL:** `src/main/__tests__/shell-resolver.test.ts` (pure helper) + `src/shared/__tests__/security.guard.test.ts` (mocked-electron preload guard).

| New test file | Covers | Pure-helper analog technique |
|---------------|--------|------------------------------|
| `src/main/__tests__/store-schema.test.ts` | D-01/SC2 `coerceOnLoad` | mutate-and-assert (shell-resolver.test) |
| `src/main/__tests__/session-store.test.ts` | PERS-01/02 round-trip, corrupt recovery, debounce/flush | inject bad file; Vitest fake timers |
| `src/main/__tests__/shell-discovery.test.ts` | SC4/D-05/06/07 | inject `existsFn`, fixture `/etc/shells` text |
| `src/main/__tests__/window-bounds.test.ts` | D-12 off-screen (Pitfall 5) | pass mock displays array |
| `src/renderer/__tests__/session-reorder.test.ts` | NAV-04/SC3 dense reindex (Pitfall 6) | pure reducer in/out (session-close.test) |

The `security.guard.test.ts` needs NO code change — it reads `EXPECTED_API_KEYS`; it goes RED at 15→18 and GREEN when preload matches.

---

## No Analog Found

None. Every new and modified file maps to a strong in-repo analog. The single genuinely
novel runtime surface — lowdb's ESM-in-CJS dynamic import — has no code analog but is
fully prescribed in RESEARCH Pattern 1 / Pitfall 1 and must be smoke-tested in the BUILT
app (Vitest's ESM loader hides the `require`-rewrite regression).

---

## Metadata

**Analog search scope:** `src/main/`, `src/renderer/`, `src/shared/`, `src/preload/`, `src/**/__tests__/`
**Files scanned:** pty-manager.ts, index.ts, shell-resolver.ts, window-config.ts, api-types.ts, preload/index.ts, SessionManager.tsx, Sidebar.tsx, SessionEditModal.tsx, SessionView.tsx, IdentityHeader.tsx, types.ts, security.guard.test.ts, shell-resolver.test.ts
**Pattern extraction date:** 2026-06-06
