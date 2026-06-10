# Phase 4: Session Identity + Sidebar UI - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 22 (new + modified)
**Analogs found:** 22 / 22 (every new file has a same-repo analog — this is a UI-composition phase over a complete data model)

> **Hard project rules (CLAUDE.md) that gate every assignment below:**
> - Renderer/shared NEVER import `electron` or `node-pty`. New renderer modules import only `window.api` + `../shared/types` (type-only). All `before-input-event` work is MAIN-side.
> - contextBridge-only seam; never expose raw `ipcRenderer`. New bridge keys are typed methods on `ElectronAPI`.
> - **Guard-test lockstep:** every new bridge key updates `EXPECTED_API_KEYS` (`src/main/window-config.ts`) + the real preload + `security.guard.test.ts` in the SAME atomic task. The guard asserts `Object.keys(exposed).sort() === [...EXPECTED_API_KEYS].sort()`.
> - Atomic per-task commits. Pure logic lives in React/xterm-free modules so it unit-tests in the Node Vitest env.
> - Do NOT reshape `SessionRecord` / `SessionIconSpec` — both are already complete (`src/shared/types.ts`). The form only SETS existing fields.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/SessionEditModal.tsx` (NEW) | component (modal) | request-response (form → state) | `src/renderer/ConfirmModal.tsx` | exact (overlay/a11y skeleton) |
| `src/renderer/ContextMenu.tsx` (NEW) | component (menu) | event-driven (DOM dismiss) | `ConfirmModal.tsx` (controlled + Esc/document listener) | role-match |
| `src/renderer/IconPicker.tsx` (NEW) | component | transform (input → SessionIconSpec) | `Sidebar.tsx renderIcon` + `icon-spec.ts` | role-match |
| `src/renderer/IdentityHeader.tsx` (NEW) | component | request-response (read active record) | `Sidebar.tsx` row (renderIcon + status-badge markup) | exact (reuse badge markup) |
| `src/renderer/icon-spec.ts` (NEW) | utility (pure) | transform | `src/renderer/session-add.ts` (pure, React-free) | exact (pure-module convention) |
| `src/renderer/session-switch.ts` (NEW) | utility (pure) | transform (intent → activeId) | `src/renderer/session-close.ts` (pure reducer) | exact |
| `src/renderer/session-edit.ts` (NEW) | utility (pure) | transform (field split + apply) | `src/renderer/session-close.ts` | exact |
| `src/renderer/emoji-set.ts` (NEW) | config (pure data) | — | `src/renderer/status-colors.ts` (`STATUS_STYLE` const map) | role-match |
| `src/main/switch-keys.ts` (NEW) | utility (pure, main) | transform (KeyInput → SwitchIntent) | `pty-manager.ts` pure helpers (`deriveStatus`, `clampDimension`) | role-match |
| `src/renderer/Sidebar.tsx` (MODIFY) | component | event-driven | self (extend `renderIcon` color branch, add collapse/onContextMenu) | self |
| `src/renderer/SessionManager.tsx` (MODIFY) | component (container/store) | event-driven | self (host modal/menu/collapse state like `closingId`; add `onSwitchSession` sub) | self |
| `src/main/pty-manager.ts` (MODIFY) | service (main, record store) | CRUD (record write) | self (`stop`/`close` id-validated mutators; `registerIpc`/`unregisterIpc` symmetry) | self |
| `src/main/index.ts` (MODIFY) | config (main bootstrap) | event-driven | self (`createWindow` — add `win.webContents.on('before-input-event')`) | self |
| `src/shared/api-types.ts` (MODIFY) | model (type contract) | — | self (add `ptyUpdateProfile` + `onSwitchSession` to `ElectronAPI`) | self |
| `src/main/window-config.ts` (MODIFY) | config (guard contract) | — | self (`EXPECTED_API_KEYS` += new keys) | self |
| `src/preload/index.ts` (MODIFY) | bridge | request-response / pub-sub | self (`ptyClose` fire-and-forget + `onPtyStatus` subscribe shapes) | self |
| `src/renderer/terminal.css` (MODIFY) | config (styles) | — | self (`.modal-overlay`/`.sidebar`/`.status-badge` token precedents) | self |
| `src/shared/__tests__/security.guard.test.ts` (MODIFY) | test | — | self (key-set assertion — RED→GREEN to new count) | self |
| `src/main/__tests__/switch-keys.test.ts` (NEW test) | test | — | existing `*.test.ts` for pure helpers | role-match |
| `src/renderer/__tests__/session-switch.test.ts` (NEW test) | test | — | `session-close.ts` test precedent | role-match |
| `src/renderer/__tests__/{icon-spec,session-edit}.test.ts` (NEW test) | test | — | pure-module test precedent | role-match |
| `src/main/__tests__/pty-update-profile.test.ts` (NEW test) | test | — | pty-manager id-validation test precedent | role-match |

---

## Pattern Assignments

### `src/renderer/SessionEditModal.tsx` (component, request-response)

**Analog:** `src/renderer/ConfirmModal.tsx` — COPY its a11y/overlay skeleton (do NOT generalize `ConfirmModal` itself; it is a tight confirm primitive). It is a **controlled** component: the editing-target id + open flag live in `SessionManager` state (exactly like `closingId`).

**Controlled-component + focus + Esc skeleton** (`ConfirmModal.tsx:24-91`):
```tsx
const titleId = useId();
const confirmRef = useRef<HTMLButtonElement>(null);
useEffect(() => {
  if (!open) return;
  confirmRef.current?.focus();                      // focus first field on open
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [open, onCancel]);
if (!open) return null;
return (
  <div className="modal-overlay" data-testid="..." onClick={onCancel}>   {/* scrim-click cancels */}
    <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
         onClick={(e) => e.stopPropagation()}>                          {/* inner clicks don't bubble */}
      <h2 id={titleId} className="modal-title">{title}</h2>
      {/* body: name (live) · IconPicker (live) · cwd/shell/startupCommand (under an "Applies on restart" hint, D-02) */}
      <div className="modal-actions">
        <button className="modal-btn modal-btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="modal-btn modal-btn-confirm" onClick={onSave}>Save</button>
      </div>
    </div>
  </div>
);
```

**Field split (D-02):** `name`/`icon` apply LIVE (`onSaveLive`); `cwd`/`shell`/`startupCommand` are restart-applied (`onSaveProfile` → `window.api.ptyUpdateProfile`). The shell field is **pre-filled** with the resolved default (D-06) — see `src/main/shell-resolver.ts` `resolveShell()` (the prefill value flows from main; renderer never recomputes). Group restart fields under a visible "Applies on restart" hint. Use the pure `session-edit.ts` reducer for the live/restart split so it unit-tests.

**Add `data-testid` attrs** (the codebase E2E contract — see `ConfirmModal`'s `confirm-modal`/`confirm-cancel`/`confirm-close`) for the WDIO `session-edit.smoke.test.ts`.

---

### `src/renderer/ContextMenu.tsx` (component, event-driven)

**Analog:** the controlled-component + document-listener-cleanup idiom in `ConfirmModal.tsx:36-47` (Esc + listener teardown). Opened from a row's `onContextMenu` (call `e.preventDefault()`), positioned at `clientX/clientY`, dismissed via a `document` `mousedown` (click-outside) + `keydown(Escape)`. Items wire to existing `onEdit`/`onRestart`/`onClose` callbacks.

**Dismiss + cleanup pattern** (mirrors the `ConfirmModal` `useEffect` add/remove pair):
```tsx
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
  const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
  document.addEventListener('mousedown', off);
  document.addEventListener('keydown', esc);
  return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
}, [onClose]);
return (
  <div ref={ref} role="menu" className="context-menu" style={{ left: x, top: y }}>
    {items.map((it) => (
      <button key={it.label} role="menuitem" className="context-menu-item"
              onClick={() => { it.onSelect(); onClose(); }}>{it.label}</button>
    ))}
  </div>
);
```
**Critical (Pitfall 5 / D-11):** the menu is the ONLY control surface when collapsed, so attach `onContextMenu` at the `.sidebar-row` level (present in both expanded AND collapsed modes), not on the per-row control buttons.

---

### `src/renderer/IconPicker.tsx` (component, transform)

**Analog:** `Sidebar.tsx renderIcon` (`Sidebar.tsx:39-58`) for the rendering switch; `icon-spec.ts` (NEW) for spec construction. Two sub-controls: (a) curated emoji `<button>` grid from `emoji-set.ts` + a free-text `<input>` (macOS Ctrl+Cmd+Space works in a focused input) → `{ type: 'emoji', value }`; (b) a fixed warm-palette swatch row → `{ type: 'color', value }`. Expose ONLY `emoji` + `color` (D-07 — `preset` stays in the type, unsurfaced).

**The `color` branch must change (D-09):** today it renders a plain swatch (`Sidebar.tsx:49-56`). Change it to a filled **badge containing the session-name initial** so it stays identifiable in the collapsed rail. Update the SAME branch in `Sidebar.renderIcon`, the rail, and the identity header.

Current color branch to replace (`Sidebar.tsx:49-56`):
```tsx
case 'color':
  return <span className="row-icon" style={{ background: icon.value }} aria-hidden="true" />;
// → becomes a badge with COLOR_INITIAL(icon, name) centered inside the colored box.
```

---

### `src/renderer/IdentityHeader.tsx` (component, request-response) — IDENT-03 / D-05

**Analog:** the row markup in `Sidebar.tsx:96-105` — REUSE verbatim: `renderIcon(icon)` + `.row-name` + the status badge. Identity-only, NO controls (TERM-12 is Phase 6). Reads the active `SessionRecord` from `SessionManager` (`activeId` + `sessions`). Mount inside a flex-column terminal area above `.viewport-stack` (RESEARCH Open Q2 recommends `.terminal-area { display:flex; flex-direction:column }` so `SessionView`'s `inset:0` panes stay correct).

**Badge markup to reuse** (`Sidebar.tsx:98-105`):
```tsx
<span className="status-badge" style={{ '--accent': style.accent } as React.CSSProperties} title={style.label}>
  <span className="status-dot" />
  {style.label}
</span>
```
where `const style = STATUS_STYLE[record.status]` (from `status-colors.ts`).

---

### `src/renderer/icon-spec.ts` (utility, pure transform)

**Analog:** `src/renderer/session-add.ts` — React/xterm-free module convention (its header explains WHY: "imports NOTHING from React or xterm so [the invariant] is unit-testable in the Node/Vitest env"). Import only `../shared/types` (type-only). Provide `emojiSpec(value)`, `colorSpec(value)`, and `COLOR_INITIAL(spec, name)` (first letter, uppercased, fallback `•`). Do NOT split graphemes — store the full free-text emoji value verbatim (Pitfall 6).

---

### `src/renderer/session-switch.ts` (utility, pure transform) — NAV-05 / D-12

**Analog:** `src/renderer/session-close.ts` — the pure reducer shape (`(sessions, activeId, …) → next`). Same header rationale (unit-testable in Node). Type-only import of `SwitchIntent` from `../main/switch-keys` is renderer-SAFE (no runtime electron import).

```ts
export function resolveSwitch(
  sessions: SessionRecord[], activeId: LogicalId | null, intent: SwitchIntent,
): LogicalId | null {
  if (sessions.length === 0) return activeId;
  if (intent.kind === 'position') return sessions[intent.index]?.logicalId ?? activeId;
  const cur = sessions.findIndex((s) => s.logicalId === activeId);
  const base = cur < 0 ? 0 : cur;
  const n = sessions.length;
  const next = intent.kind === 'next' ? (base + 1) % n : (base - 1 + n) % n;
  return sessions[next].logicalId;
}
```
Mirror `session-close.ts`'s defensive handling of unknown/out-of-range (return `activeId` unchanged).

---

### `src/renderer/session-edit.ts` (utility, pure transform) — D-02

**Analog:** `src/renderer/session-close.ts` (pure reducer). Splits a form payload into the live half (`name`, `icon`) and the restart half (`cwd`, `shell`, `startupCommand`), and returns an updated `SessionRecord` for live-apply. No side effects; the caller (`SessionManager`) performs the `setSessions` + `window.api.ptyUpdateProfile`.

---

### `src/renderer/emoji-set.ts` (config, pure data)

**Analog:** `src/renderer/status-colors.ts` — a pure exported const map/array (no logic). Exports the curated emoji array (D-08) + the warm color swatch list (D-09), both drawn from DESIGN.md. No imports beyond types if any.

---

### `src/main/switch-keys.ts` (utility, pure, main) — NAV-05 / D-12 / D-13

**Analog:** the pure helpers in `pty-manager.ts` (`deriveStatus` at `:107-113`, `clampDimension` at `:61-65`, `isStringData` at `:68-70`) — small, no-electron-import, directly unit-tested functions. `switch-keys.ts` must NOT import electron (keep it Node-testable; `index.ts` casts the Electron `Input` to `KeyInput`).

```ts
export type SwitchIntent =
  | { kind: 'position'; index: number }   // 0-based; Cmd/Ctrl+1..9
  | { kind: 'next' } | { kind: 'prev' };
export interface KeyInput { type: string; key: string; control: boolean; meta: boolean; shift: boolean; alt: boolean; }

export function matchSwitchKey(i: KeyInput): SwitchIntent | null {
  if (i.type !== 'keyDown') return null;
  const primary = i.meta || i.control;          // macOS Cmd OR Windows Ctrl — one rule, both platforms
  if (!primary || i.alt) return null;
  if (i.shift) {
    if (i.key === ']') return { kind: 'next' };
    if (i.key === '[') return { kind: 'prev' };
    return null;
  }
  if (/^[1-9]$/.test(i.key)) return { kind: 'position', index: Number(i.key) - 1 };
  return null;
}
```
**A1 (open question):** verify `[`/`]`/digit `key` strings empirically in the NAV-05 E2E; write defensively (match `key` OR `code` e.g. `BracketRight`) — it is a one-line change in this pure module.

---

### `src/main/index.ts` (config, event-driven) — wire `before-input-event` (D-13)

**Analog:** self — `createWindow()` (`index.ts:17-45`) already constructs `win` and calls `ptyManager.registerIpc(win)`. Add the interceptor on `win.webContents` inside `createWindow`, alongside the existing `win.on('closed', …)` wiring:
```ts
win.webContents.on('before-input-event', (event, input) => {
  const intent = matchSwitchKey(input as unknown as KeyInput);
  if (intent) {
    event.preventDefault();                       // D-13: never reaches xterm/PTY
    win.webContents.send('session:switch', intent);
  }
});
```
**Anti-pattern to avoid:** do NOT also register these chords as Menu accelerators — `preventDefault()` in `before-input-event` suppresses menu accelerators (Electron #19279). Keep switch keys solely here. Do NOT use `globalShortcut` (system-wide, silent-fail). Renderer-side `attachCustomKeyEventHandler` (precedent at `SessionView.tsx:146-157`, used for Cmd+C/Cmd+V) is the fallback only — racy on Windows Ctrl combos.

---

### `src/main/pty-manager.ts` (service, CRUD) — the ONE main-side capability (Pattern 3, D-02)

**Analog:** self — `stop()` (`:291-308`) and `close()` (`:391-401`) are the precedent for an **id-validated mutator** (unknown/forged id → no-op, T-03-01). Add `updateProfile(id, fields)` mirroring that guard, plus a `PTY_CHANNELS.updateProfile` entry and symmetric `registerIpc`/`unregisterIpc` wiring (the close channel is the template — see below).

```ts
// id-validated, type-guarded record write (mirrors close()'s `if (!session) return;` and isStringData)
updateProfile(id: LogicalId, fields: { name?: string; icon?: SessionIconSpec; cwd?: string; shell?: string; startupCommand?: string }): void {
  const s = this.sessions.get(id);
  if (!s) return;                                  // unknown/forged id → no-op (T-03-01)
  if (typeof fields.cwd === 'string') s.record.cwd = fields.cwd;
  if (typeof fields.shell === 'string') s.record.shell = fields.shell;
  if (typeof fields.startupCommand === 'string') s.record.startupCommand = fields.startupCommand;
  if (typeof fields.name === 'string') s.record.name = fields.name;   // mirror live name (Pitfall 4)
  if (fields.icon) s.record.icon = fields.icon;                       // mirror live icon (Pitfall 4)
}
```

**Make `create()` honor the edited shell (Pitfall 3, A2):** today `create()` always calls `resolveShell()` (`:149`) and respawns `restart()` from `record.cwd` but the default shell. Extend `create()` to prefer `record.shell` when non-empty, falling back to `resolveShell()`:
```ts
// at :149 — currently: const { shell, args } = resolveShell();
// guard: const { shell, args } = (prior?.record.shell?.length) ? { shell: prior.record.shell, args: [] } : resolveShell();
```
and have `restart()` (`:316-345`) pass `record.shell` through (it already passes `record.cwd`, `name`, `order`). **Keep `startupCommand` STORED ONLY** — TERM-05 auto-run stays deferred; no code path writes it to a PTY this phase.

**Channel wiring** — copy the `close` channel triple exactly:
- `PTY_CHANNELS.updateProfile: 'pty:update-profile'` (add to the const at `:25-40`, next to `close`)
- in `registerIpc` (`:430-476`): `ipcMain.on(PTY_CHANNELS.updateProfile, (_e, id, fields) => this.updateProfile(id, fields));` (fire-and-forget `.on`, mirrors `close` at `:473-475`)
- in `unregisterIpc` (`:483-496`): `ipcMain.removeAllListeners(PTY_CHANNELS.updateProfile);` (mirrors `close` at `:493`)

---

### `src/shared/api-types.ts` (model) — add two keys (Pattern 3 + Code Examples)

**Analog:** self — `ptyClose` (`:88-95`, fire-and-forget) and `onPtyStatus` (`:98-99`, subscribe-returns-unsubscribe) are the exact shapes for the two new keys.
```ts
/** Persist edited profile fields into main's record; restart respawns with them (fire-and-forget). */
ptyUpdateProfile: (id: LogicalId, fields: { name?: string; icon?: SessionIconSpec; cwd?: string; shell?: string; startupCommand?: string }) => void;
/** Subscribe to app-level switch intents (main → renderer); returns unsubscribe. */
onSwitchSession: (cb: (intent: SwitchIntent) => void) => () => void;
```
(Import `SwitchIntent`/`SessionIconSpec` as type-only — keeps `api-types.ts` electron-free.)

---

### `src/preload/index.ts` (bridge)

**Analog:** self — `ptyClose` (`:88-90`, `ipcRenderer.send`) and `onPtyStatus` (`:104-116`, `ipcRenderer.on` + `removeListener` unsubscribe) are verbatim templates:
```ts
ptyUpdateProfile: (id, fields): void => { ipcRenderer.send('pty:update-profile', id, fields); },
onSwitchSession: (cb): (() => void) => {
  const listener = (_e: IpcRendererEvent, intent: SwitchIntent): void => cb(intent);
  ipcRenderer.on('session:switch', listener);
  return () => ipcRenderer.removeListener('session:switch', listener);
},
```

---

### `src/main/window-config.ts` + `src/shared/__tests__/security.guard.test.ts` (guard lockstep)

**Analog:** self — `EXPECTED_API_KEYS` (`window-config.ts:51-65`, currently 13 keys ending `'listSessions'`). Append `'ptyUpdateProfile'` and `'onSwitchSession'` → 15-key set, with a doc-comment block in the same style as the 02-02/03-01/03-03 expansion notes. The guard test (`security.guard.test.ts:48-52`) needs NO code change — it asserts `Object.keys(exposed).sort() === [...EXPECTED_API_KEYS].sort()`, so it goes RED→GREEN automatically once preload + `EXPECTED_API_KEYS` match. Do all of: api-types + window-config + preload + pty-manager channel/registerIpc/unregisterIpc in ONE atomic task (Pitfall 2).

---

### `src/renderer/SessionManager.tsx` (container/store)

**Analog:** self — host the new UI state exactly like `closingId` (`:45`): add `editingId`/`menuState`/`collapsed` `useState`, controlled-component handlers (`:59-81` pattern), and an `onSwitchSession` subscription `useEffect` mirroring the `onPtyStatus` sub (`:138-153`). Apply the intent with the pure `resolveSwitch` + `setActiveId`. Live edit: `setSessions` map update (like `handleRestart` at `:89-100`) PLUS `window.api.ptyUpdateProfile` to mirror name/icon to main (Pitfall 4 — restart rebuilds the record from main's fields, so unmirrored live edits revert).

---

### `src/renderer/Sidebar.tsx` (component)

**Analog:** self — add a `collapsed` prop + `.collapsed` class on `.sidebar`, an `onContextMenu` at the `.sidebar-row` level (`:81`), an `onEdit` callback prop, and the color-badge-with-initial change in `renderIcon` (`:49-56`). Keep the existing per-row Restart/Close buttons in expanded mode (RESEARCH Open Q3 — lowest churn; E2E already addresses them via `data-testid`). Collapsed mode hides `.row-name`/`.status-badge`/`.row-controls` and shows an icon + status dot; the context menu is the collapsed control surface.

---

### `src/renderer/terminal.css` (styles)

**Analog:** self — existing token precedents to extend: `.modal-overlay`/`.modal-dialog`/`.modal-btn*` (for the form), `.sidebar`/`.sidebar-row`/`.row-icon` (20×20; keep `line-height:1` + center to avoid emoji variation-selector jitter — Pitfall 6), `.status-badge`/`.status-dot`/`--accent`. Add `.context-menu`/`.context-menu-item`, `.sidebar.collapsed` rules, `.collapsed-status-dot`, `.rail-tooltip` (custom CSS tooltip preferred over native `title=` — D-11/RESEARCH Pattern 6), `.identity-header`. All from DESIGN.md tokens (warm `--surface`, `--radius` 18px, Nunito).

---

## Shared Patterns

### Pure-module convention (React/xterm-free, Node-testable)
**Source:** `src/renderer/session-add.ts` (header), `src/renderer/session-close.ts`, `src/main/pty-manager.ts` pure helpers (`deriveStatus`/`clampDimension`/`isStringData`).
**Apply to:** `icon-spec.ts`, `session-switch.ts`, `session-edit.ts`, `emoji-set.ts`, `src/main/switch-keys.ts`. Import only `../shared/types` (type-only); never React/xterm/electron. Each gets a `__tests__/*.test.ts` (Wave 0).

### Controlled-component modal/menu a11y skeleton
**Source:** `src/renderer/ConfirmModal.tsx:24-91` (useId/aria-labelledby, focus-on-open, Esc=cancel, scrim-click cancel, inner `stopPropagation`).
**Apply to:** `SessionEditModal.tsx`, `ContextMenu.tsx`. State (open flag + target id) lives in `SessionManager` (like `closingId`).

### Status color/label language
**Source:** `src/renderer/status-colors.ts` `STATUS_STYLE` (the 5-state oklch ramp incl. derived red) + the badge markup at `Sidebar.tsx:98-105`.
**Apply to:** `IdentityHeader.tsx` badge, the collapsed status dot, the form (if it shows status). Never re-derive colors.

### Three-kind icon render
**Source:** `src/renderer/Sidebar.tsx:39-58` `renderIcon` (switches emoji|preset|color).
**Apply to:** `IconPicker` preview, `IdentityHeader`, the rail. Extend ONLY the `color` branch (badge-with-initial, D-09); leave emoji/preset.

### Bridge-key lockstep (CLAUDE.md hard rule)
**Source:** the `ptyClose` 13th-key precedent across `api-types.ts:88-95` + `window-config.ts:51-65` + `preload/index.ts:88-90` + `pty-manager.ts` close-channel triple + `security.guard.test.ts:48-52`.
**Apply to:** `ptyUpdateProfile` + `onSwitchSession` (the 14th + 15th keys) — all five edit-points in ONE atomic task, `vitest run` shows RED→GREEN.

### id-validated, type-guarded main-side mutation (Security V5)
**Source:** `pty-manager.ts` `close()`/`stop()` (`if (!session) return;` unknown-id no-op, T-03-01) + `isStringData` type guard.
**Apply to:** `updateProfile` — validate `id` against the live `sessions` Map; `typeof === 'string'` each field before writing. Store `startupCommand` only (no PTY write — TERM-05 deferred).

---

## No Analog Found

None. Every Phase 4 file maps to an existing same-repo analog. (`before-input-event` is the only genuinely-external mechanism, but its host file `src/main/index.ts createWindow()` and its pure-helper companion shape both exist in-repo.)

---

## Metadata

**Analog search scope:** `src/renderer/`, `src/main/`, `src/shared/`, `src/preload/`, `src/shared/__tests__/`.
**Files scanned (read in full or targeted):** `ConfirmModal.tsx`, `Sidebar.tsx`, `status-colors.ts`, `session-add.ts`, `session-close.ts`, `SessionManager.tsx`, `SessionView.tsx` (key-handler region), `api-types.ts`, `types.ts`, `preload/index.ts`, `window-config.ts`, `security.guard.test.ts`, `pty-manager.ts`, `main/index.ts`, `shell-resolver.ts` (exports).
**Pattern extraction date:** 2026-06-05

## PATTERN MAPPING COMPLETE

**Phase:** 4 - Session Identity + Sidebar UI
**Files classified:** 22
**Analogs found:** 22 / 22

### Coverage
- Files with exact analog: 11
- Files with role-match analog: 11 (incl. self-modifications)
- Files with no analog: 0

### Key Patterns Identified
- All new branchy logic goes in React/xterm-free pure modules (`icon-spec`, `session-switch`, `session-edit`, `emoji-set`, `switch-keys`) mirroring `session-add.ts`/`session-close.ts` for Node-Vitest testability.
- Both new UI surfaces (form modal, context menu) copy the `ConfirmModal` controlled-component a11y skeleton (focus-on-open, Esc/scrim cancel, inner stopPropagation); their state lives in `SessionManager` like `closingId`.
- The two new bridge keys (`ptyUpdateProfile`, `onSwitchSession`) follow the proven `ptyClose`/`onPtyStatus` shapes and MUST update `api-types.ts` + `window-config.ts EXPECTED_API_KEYS` + preload + pty-manager channel triple + the guard test in one atomic, lockstep task (RED→GREEN).
- Switch-key interception is MAIN-side (`win.webContents.on('before-input-event')` in `createWindow`) — the only mechanism that holds for Windows Ctrl combos; `globalShortcut` and renderer-only capture are rejected.
- The one main-side state change is an id-validated, type-guarded `updateProfile` record write (mirrors `close()`/`isStringData`); `create()` extended to honor `record.shell`; `startupCommand` stored only (TERM-05 deferred).

### File Created
`.planning/phases/04-session-identity-sidebar-ui/04-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. The planner can write PLAN.md files with precise `read_first` (the analog files + line ranges above) and `action` fields, sequencing Wave-0 pure-module tests + the guard lockstep first, then the UI surfaces, then the main-side `before-input-event` slice.
