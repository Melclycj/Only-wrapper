# Phase 4: Session Identity + Sidebar UI - Research

**Researched:** 2026-06-05
**Domain:** Electron + React 19 renderer UI (sidebar, modal form, context menu, icon picker, collapse) + app-level keyboard interception over a focused xterm.js terminal
**Confidence:** HIGH (codebase verified directly; the one genuinely-external question — keyboard interception mechanism — confirmed against official Electron docs)

## Summary

Phase 4 is almost entirely **renderer-internal React/CSS work layered onto an already-working multi-session app**. Every data structure it needs already exists: `SessionRecord` carries `name`, `icon` (a `SessionIconSpec` discriminated union of `emoji|preset|color`), `cwd`, `shell`, `startupCommand`; `STATUS_STYLE` already maps the 5 statuses to DESIGN.md accents; `ConfirmModal` already establishes the overlay/scrim/Esc/focus pattern the create/edit form will reuse; `Sidebar.renderIcon` already switches over all three icon kinds; and `SessionManager` is already the single owner of `sessions[]` + `activeId`. The phase adds UI surfaces and **one main-side capability**: persisting edited `cwd`/`shell`/`startupCommand` into main's authoritative `SessionRecord` so the next `ptyRestart` respawns with them.

The single genuinely-uncertain mechanic — "switch shortcuts always win over the terminal, even inside vim/tmux, on both macOS Cmd and Windows Ctrl" (D-12/D-13) — has a clear best answer. **Use Electron `webContents.on('before-input-event')` in the main process** to intercept Cmd/Ctrl+1–9 and Cmd/Ctrl+Shift+[ / ] *before* the keydown ever reaches the renderer (and therefore before xterm can forward a Ctrl combo to the PTY as a control code), then forward the resolved switch intent to the renderer over a new typed bridge event. This is the only mechanism that structurally guarantees "app wins" on Windows Ctrl combos; the in-renderer `attachCustomKeyEventHandler` (already used in `SessionView` for copy/paste) is a viable fallback but is racier on Windows and must be wired into every session's xterm.

**Primary recommendation:** Build the form/context-menu/icon-picker/collapse/identity-header as pure React components styled from existing `terminal.css` tokens, keep all branchy logic (icon-spec construction, position→activeId mapping, sidebar-order navigation, form-field reducers) in **React/xterm-free pure modules** mirroring `session-add.ts`/`session-close.ts` so they unit-test in the Node Vitest env; intercept switch keys via main-process `before-input-event` plus one new `onSwitchSession` bridge subscription; and add one new main-side `ptyUpdateProfile`-style bridge method (the 14th key — guard + `EXPECTED_API_KEYS` in lockstep) to persist edited restart-applied fields.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Create/edit form UI + validation | Renderer (React modal) | — | Pure UI over `SessionRecord`; no process interaction until restart |
| Live apply of name/icon (D-02) | Renderer (`SessionManager` state) | Main (mirror into record so restart keeps it) | Cheap display change; main is source of truth so a later restart/persist keeps it |
| Apply-on-restart of cwd/shell/startupCommand (D-02) | **Main** (`pty-manager` record store) | Renderer (form sends the edit) | `restart()` respawns from `record.cwd`/`record.shell`; edits must land in main's record |
| Context menu (right-click row) | Renderer (React) | — | Pure DOM/UI; dispatches existing `onClose`/`onRestart`/new `onEdit` callbacks |
| Icon picker (emoji grid + free-text + color swatches) | Renderer (React) | — | Constructs a `SessionIconSpec`; no main involvement |
| Sidebar collapse / rail | Renderer (CSS + `SessionManager` local state) | — | Pure layout; persistence is Phase 5 |
| Identity header (IDENT-03) | Renderer (mounts above active `SessionView`) | — | Reads the active `SessionRecord`; display-only |
| Keyboard switch interception (D-12/D-13) | **Main** (`before-input-event`) | Renderer (`onSwitchSession` → `setActiveId`) | Only main-side pre-dispatch interception guarantees "app wins" before xterm forwards Ctrl to PTY |
| Switch → activate view | Renderer (`SessionManager.setActiveId`) | — | Reuses the existing TERM-06 non-destructive switch path |

## Standard Stack

No new runtime dependencies are required or recommended. Phase 4 is built entirely from the installed stack.

### Core (already installed — versions verified in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.7 | All Phase 4 UI (form modal, context menu, icon picker, rail, header) | Already the renderer framework `[VERIFIED: package.json]` |
| @xterm/xterm | 5.5.0 | `attachCustomKeyEventHandler` is the in-renderer key seam (fallback path) | Already wired in `SessionView` for copy/paste `[VERIFIED: package.json + src/renderer/SessionView.tsx]` |
| electron | 36.9.5 | `webContents.on('before-input-event')` for app-wins switch keys | Already the framework; `before-input-event` is built-in `[VERIFIED: package.json]` |
| typescript | (5.x project) | Bridge type lockstep + branded `LogicalId` | Existing convention |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.8 | Node-env unit tests for the new pure modules | Always — new logic goes in React-free modules `[VERIFIED: package.json]` |
| @wdio/electron-service | 10.0.0 | E2E driving of form, context menu, shortcuts, collapse | The existing `xterm-driver.ts` helpers extend cleanly `[VERIFIED: package.json + tests/smoke/helpers/xterm-driver.ts]` |

### Alternatives Considered (and rejected per CONTEXT.md locked decisions)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled context menu | `@radix-ui/react-context-menu`, `react-contexify` | **Rejected** — D-08/D-07 spirit is no new UI deps; a context menu is ~40 lines; a library adds a slopcheck surface and bundle weight for trivial gain |
| Free-text emoji field | `emoji-mart`, `@emoji-mart/react` | **Rejected by D-08** — curated grid + free-text field (native macOS Ctrl+Cmd+Space works in the field) covers unlimited choice with zero dep |
| `before-input-event` (main) | Electron `Menu` accelerators | Viable but awkward for dynamic 1–9 + Shift+[/]; see Pattern 1 |
| `before-input-event` (main) | `globalShortcut.register` | **Wrong tool** — system-wide (steals keys even when app unfocused), silent-fail on conflict, macOS non-QWERTY bug `[CITED: electronjs.org/docs/latest/api/global-shortcut]` |

**Installation:** None. `npm install` adds nothing this phase.

## Package Legitimacy Audit

> Not applicable — Phase 4 installs **zero** external packages. All work uses already-installed, already-audited dependencies (react, @xterm/xterm, electron, vitest, @wdio/electron-service). No registry lookup, slopcheck, or postinstall review is required because no `npm install <pkg>` occurs in any Phase 4 task.

**Packages removed due to slopcheck [SLOP] verdict:** none (no installs)
**Packages flagged as suspicious [SUS]:** none (no installs)

## Architecture Patterns

### System Architecture Diagram

```
                            ┌─────────────────────────────────────────────┐
  Keyboard (Cmd/Ctrl+1-9,   │              MAIN PROCESS                    │
   Cmd/Ctrl+Shift+[ / ])    │                                             │
        │                   │   webContents.on('before-input-event')      │
        │  (1) keydown ─────┼──▶  matchSwitchKey(input) ── pure module ──▶ │
        │   reaches main    │        │  position | next | prev             │
        │   BEFORE renderer │        │                                     │
        │                   │   event.preventDefault()  ◀── stops it       │
        │                   │     reaching xterm/PTY (D-13 app-wins)       │
        │                   │        │                                     │
        │                   │   webContents.send('session:switch', intent) │
        │                   └────────┼────────────────────────────────────┘
        │                            │  (2) typed bridge event
        ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          RENDERER PROCESS                                   │
│                                                                            │
│   window.api.onSwitchSession(cb)  ──▶  SessionManager.applySwitch(intent)   │
│                                            │ pure: intent + sessions +      │
│                                            │ activeId → next activeId        │
│                                            ▼                                │
│   ┌──────────────┐   setActiveId    ┌────────────────────────────────────┐ │
│   │   Sidebar     │◀───────────────▶│   SessionManager (sessions[],       │ │
│   │  - rows       │   onSelect       │   activeId, modal state)            │ │
│   │  - collapse ▶ │                  │                                     │ │
│   │  - rail icons │   right-click    │   ┌────────────────────────────┐   │ │
│   │  - status dot │─────────────────▶│   │ ContextMenu (Edit/Restart/ │   │ │
│   └──────────────┘   onEdit          │   │   Close) at cursor          │   │ │
│         │                            │   └────────────────────────────┘   │ │
│         │                            │   ┌────────────────────────────┐   │ │
│         │                            │   │ SessionEditModal (reuses    │   │ │
│         │                            │   │   ConfirmModal overlay)     │   │ │
│         │                            │   │  name·icon(live) cwd·shell· │   │ │
│         │                            │   │  startup(on restart)        │   │ │
│         │                            │   │   └─ IconPicker (emoji grid │   │ │
│         │                            │   │      + free-text + colors)  │   │ │
│         │                            │   └──────────┬─────────────────┘   │ │
│         │                            │   onSaveLive │ onSaveProfile        │ │
│         ▼                            │              ▼                      │ │
│   ┌──────────────────┐               │   window.api.ptyUpdateProfile(id,   │ │
│   │ IdentityHeader    │◀──active rec──│     {cwd,shell,startupCommand})     │ │
│   │ icon+name+badge   │               │     ──▶ MAIN persists into record   │ │
│   └──────────────────┘               │     so next ptyRestart respawns      │ │
│   ┌──────────────────┐               │     with the new cwd/shell           │ │
│   │ viewport-stack:   │               └──────────────────────────────────┘  │
│   │ SessionView(es)   │  (active toggled by activeId — TERM-06 untouched)    │
│   └──────────────────┘                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additive — every file mirrors existing conventions)
```
src/renderer/
├── SessionManager.tsx        # EXTEND: host modal state, context-menu state, collapse state, identity header, onSwitchSession sub
├── Sidebar.tsx               # EXTEND: collapse rendering, rail mode, onEdit/onContextMenu, color-badge-with-initial
├── ConfirmModal.tsx          # REUSE unchanged (overlay/scrim/Esc/focus precedent for the form modal)
├── SessionEditModal.tsx      # NEW: the create/edit form (D-04), built on the ConfirmModal overlay pattern
├── ContextMenu.tsx           # NEW: lightweight right-click menu (D-03), cursor-positioned, click-outside/Esc dismiss
├── IconPicker.tsx            # NEW: emoji curated grid + free-text field + color swatch row (D-07/08/09)
├── IdentityHeader.tsx        # NEW: slim icon+name+status bar above the active view (D-05/IDENT-03)
├── icon-spec.ts              # NEW pure module: build/normalize SessionIconSpec, color→initial badge data (D-09)
├── session-switch.ts         # NEW pure module: SwitchIntent + (sessions, activeId, intent) → next activeId (D-12)
├── session-edit.ts           # NEW pure module: live-vs-restart field split + apply reducer (D-02)
├── emoji-set.ts              # NEW pure data: the curated emoji array + color swatch list (D-08/09)
├── status-colors.ts          # REUSE: STATUS_STYLE for header badge + collapsed dot
└── terminal.css              # EXTEND: form, context-menu, rail/collapsed, identity-header styles (existing tokens)

src/main/
├── pty-manager.ts            # EXTEND: updateProfile(id, fields) writes cwd/shell/startupCommand into record (D-02)
├── index.ts                  # EXTEND: wire before-input-event → matchSwitchKey → send('session:switch')
└── switch-keys.ts            # NEW pure module: matchSwitchKey(input) → SwitchIntent | null (testable in Node)

src/shared/
├── api-types.ts              # EXTEND: ptyUpdateProfile + onSwitchSession on ElectronAPI
└── types.ts                  # NO reshaping — SessionRecord/SessionIconSpec already complete

src/main/window-config.ts     # EXTEND: EXPECTED_API_KEYS += new key(s) — guard lockstep
src/preload/index.ts          # EXTEND: wire the new bridge methods
```

### Pattern 1: App-wins switch keys via main-process `before-input-event` (D-12/D-13) — RECOMMENDED

**What:** Intercept the switch chords in the **main process**, before the keydown is dispatched to the renderer page (and therefore before xterm exists in the event path at all). `event.preventDefault()` stops the key from reaching the renderer/PTY. Resolve the intent with a **pure, Node-testable** `matchSwitchKey` module, then `webContents.send` a `SwitchIntent` the renderer applies with another pure module.

**When to use:** Always, for the NAV-05 switch chords. This is the only approach that structurally guarantees "app wins" for Windows Ctrl combos (which xterm would otherwise forward to the PTY as control codes).

**Example:**
```ts
// src/main/switch-keys.ts — PURE, Node-testable (no electron import)
// Source: shape of Electron Input — [CITED: electronjs.org/docs/tutorial/keyboard-shortcuts]
export type SwitchIntent =
  | { kind: 'position'; index: number }   // 0-based; Cmd/Ctrl+1..9
  | { kind: 'next' }                       // Cmd/Ctrl+Shift+]
  | { kind: 'prev' };                      // Cmd/Ctrl+Shift+[

export interface KeyInput {
  type: string; key: string;
  control: boolean; meta: boolean; shift: boolean; alt: boolean;
}

// macOS uses meta (Cmd); Windows uses control (Ctrl). "App-reserved modifier" = the
// platform's primary modifier. We accept EITHER meta or control so one rule covers both.
export function matchSwitchKey(i: KeyInput): SwitchIntent | null {
  if (i.type !== 'keyDown') return null;
  const primary = i.meta || i.control;
  if (!primary || i.alt) return null;
  if (i.shift) {
    if (i.key === ']') return { kind: 'next' };
    if (i.key === '[') return { kind: 'prev' };
    return null;
  }
  // Cmd/Ctrl+1..9 → position (no shift)
  if (/^[1-9]$/.test(i.key)) return { kind: 'position', index: Number(i.key) - 1 };
  return null;
}
```
```ts
// src/main/index.ts — wire it on the window's webContents (inside createWindow)
win.webContents.on('before-input-event', (event, input) => {
  const intent = matchSwitchKey(input as unknown as KeyInput);
  if (intent) {
    event.preventDefault();                       // D-13: never reaches xterm/PTY
    win.webContents.send('session:switch', intent);
  }
});
```
```ts
// src/renderer/session-switch.ts — PURE, Node-testable
import type { LogicalId, SessionRecord } from '../shared/types';
import type { SwitchIntent } from '../main/switch-keys'; // type-only import is renderer-safe

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

**Why main-side, not renderer-side:** On Windows, `Ctrl+[` / `Ctrl+]` are real terminal control codes (ESC / GS); xterm's default keymap forwards them to the PTY. A renderer `keydown` capture-phase listener *can* `preventDefault`, but it competes with xterm's own listeners and must be attached to every session's xterm — and `attachCustomKeyEventHandler` runs *inside* xterm's pipeline, so the ordering is fragile across the 15 concurrent instances. `before-input-event` fires once, window-wide, before any of that. It is also focused-only (correct — unlike `globalShortcut`, it will not hijack the chord when the app is in the background).

### Pattern 2: Reuse the ConfirmModal overlay for the edit form (D-04)
**What:** Build `SessionEditModal` with the **same** `.modal-overlay` / `.modal-dialog` / scrim-click-cancel / Esc-cancel / focus-on-open structure that `ConfirmModal` already implements. Do not generalize `ConfirmModal` itself (it is a tight confirm primitive); copy its proven a11y skeleton.

**When to use:** The create/edit form (SESS-01/02). The form is a controlled component owned by `SessionManager` (the editing target id + open flag live in `SessionManager` state, exactly like `closingId`).

**Example (structure, abbreviated):**
```tsx
// Source: structural precedent — src/renderer/ConfirmModal.tsx (verified)
export function SessionEditModal({ open, session, onSaveLive, onSaveProfile, onCancel }) {
  // useId for aria-labelledby; useEffect: focus first field + Esc=cancel (same as ConfirmModal)
  // Fields: name (live), IconPicker (live), cwd (restart), shell (restart, prefilled), startupCommand (restart)
  // cwd/shell/startup grouped under a visible "Applies on restart" hint (D-02 discretion)
  // onSaveLive(name, icon) → SessionManager mutates state immediately + mirrors to main
  // onSaveProfile({cwd,shell,startupCommand}) → window.api.ptyUpdateProfile(id, fields)
}
```

### Pattern 3: Persist restart-applied fields into main's record (D-02) — the ONE main-side change
**What:** `restart()` in `pty-manager.ts` already respawns from `record.cwd` and resolves the shell via `resolveShell()` (not from the record yet). To make edited `cwd`/`shell`/`startupCommand` take effect on restart, add a `PtyManager.updateProfile(id, fields)` that writes those fields onto the kept `SessionRecord`, expose it as a new fire-and-forget bridge method, and have `restart()`/`create()` honor `record.shell` when set.

**When to use:** Whenever the form saves cwd/shell/startupCommand.

**Bridge lockstep (CLAUDE.md hard rule):** Adding `ptyUpdateProfile` makes it the **14th key**. Update in the same task:
1. `ElectronAPI` in `src/shared/api-types.ts`
2. `EXPECTED_API_KEYS` in `src/main/window-config.ts`
3. `src/preload/index.ts` (the `ipcRenderer.send('pty:update-profile', ...)` wiring)
4. `PTY_CHANNELS.updateProfile` + `registerIpc`/`unregisterIpc` symmetry in `pty-manager.ts`
5. `security.guard.test.ts` goes RED→GREEN against the new 14-key set (it asserts `Object.keys(exposed).sort() === [...EXPECTED_API_KEYS].sort()`)

```ts
// src/main/pty-manager.ts — main owns the record; restart respawns from it
updateProfile(id: LogicalId, fields: { cwd?: string; shell?: string; startupCommand?: string }): void {
  const s = this.sessions.get(id);
  if (!s) return;                        // unknown/forged id → no-op (T-03-01 precedent)
  if (typeof fields.cwd === 'string') s.record.cwd = fields.cwd;
  if (typeof fields.shell === 'string') s.record.shell = fields.shell;
  if (typeof fields.startupCommand === 'string') s.record.startupCommand = fields.startupCommand;
}
```
> Note: making `create()` honor `record.shell` (instead of always `resolveShell()`) is a small change. The existing `create()` already reuses `prior?.record` fields on restart — extend it to prefer `record.shell` when non-empty, falling back to `resolveShell()`. Keep `startupCommand` **stored only** — TERM-05 auto-run stays deferred (form captures, never executes).

### Pattern 4: Lightweight React context menu (D-03)
**What:** A single absolutely-positioned `<div>` rendered at the cursor `clientX/clientY`, opened from the row's `onContextMenu` (call `e.preventDefault()`), dismissed by a `document` `mousedown`/`keydown(Escape)` listener and on item click. Items: Edit / Restart / Close, wired to existing `onEdit`/`onRestart`/`onClose` callbacks. It is the **only** control surface in collapsed mode (D-11), so the rail row's `onContextMenu` must work too.

**Why hand-roll (no library):** ~40 lines; positioning + click-outside + Esc + a11y (`role="menu"`/`role="menuitem"`, arrow-key focus) is well-trodden and keeps the no-new-dep posture. Keep the open/position/selected-id state in `SessionManager` (like `closingId`) so the menu is a controlled component.

```tsx
// Source: standard React click-outside + cursor-position pattern
function ContextMenu({ x, y, items, onClose }) {
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
}
```

### Pattern 5: Icon picker — emoji grid + free-text + color swatches (D-07/08/09)
**What:** Two sub-controls. (a) Emoji: a curated `<button>` grid (`emoji-set.ts`) plus a small `<input>` that accepts any pasted/typed emoji (macOS Ctrl+Cmd+Space works in a focused text input) → `{ type: 'emoji', value }`. (b) Color: a fixed row of swatch `<button>`s drawn from the DESIGN.md warm palette → `{ type: 'color', value }`. A `color`-kind icon renders as a **filled badge containing the session-name initial** (D-09) — update `Sidebar.renderIcon`'s `color` branch and add the same render in the rail + header.

**Rendering note (emoji in React UI, not xterm):** Emoji in the DOM render with the OS emoji font; no xterm cell-width concerns apply here (those are a terminal-grid problem). Constrain the icon cell to a fixed box (`.row-icon` is already `20×20` with `font-size:15px`) and use `line-height:1` + centering so variation-selector emoji (e.g. `🛋️` = `🛋`+U+FE0F) don't shift the row. Render the free-text field's value verbatim — store the full grapheme (do not split).

```ts
// src/renderer/icon-spec.ts — PURE
import type { SessionIconSpec } from '../shared/types';
export const COLOR_INITIAL = (spec: SessionIconSpec, name: string): string =>
  spec.type === 'color' ? (name.trim()[0]?.toUpperCase() ?? '•') : '';
export const emojiSpec = (value: string): SessionIconSpec => ({ type: 'emoji', value });
export const colorSpec = (value: string): SessionIconSpec => ({ type: 'color', value });
```

### Pattern 6: Sidebar collapse + rail (D-10/11)
**What:** A pinned chevron toggle stored in `SessionManager` local state (`collapsed: boolean` — persistence is Phase 5, D-11). When collapsed: the `.sidebar` gets a `.collapsed` class that narrows it to an icon-only rail (`flex-basis` ~52px), hides `.row-name`/`.status-badge`/`.row-controls`, and shows a small status-color dot on the icon. Tooltip on hover reveals name + status.

**Tooltip recommendation:** Use a **custom tooltip**, not native `title=`. Native `title` has a ~1s OS delay and inconsistent styling — poor for the "cozy" aesthetic and for fast rail scanning. A CSS-driven tooltip (absolutely-positioned `::after`/sibling `<span>` shown on `:hover`/`:focus-visible`, reading `data-tooltip`) is instant, on-brand, and a11y-friendly. (Native `title` is an acceptable cheap fallback if time-boxed.)

```css
/* terminal.css additions (sketch) */
.sidebar.collapsed { flex-basis: 52px; }
.sidebar.collapsed .row-name,
.sidebar.collapsed .status-badge,
.sidebar.collapsed .row-controls { display: none; }
.sidebar.collapsed .sidebar-row { justify-content: center; position: relative; }
.collapsed-status-dot { position:absolute; right:6px; bottom:6px; width:8px; height:8px;
  border-radius:999px; background: var(--accent); }
.rail-tooltip { /* shown on row hover/focus; warm --surface, --radius, Nunito */ }
```

### Pattern 7: Identity header (D-05 / IDENT-03)
**What:** A slim `<header className="identity-header">` mounted **inside `.viewport-stack` above the active `SessionView`** (or as a sibling flex-row, with the stack below). It reads the active `SessionRecord` (`SessionManager` already has `activeId` + `sessions`) and renders `renderIcon(icon)` + name + status badge from `STATUS_STYLE` — **identity-only, no buttons** (TERM-12 controls are Phase 6). Reuse the exact badge markup from `Sidebar`.

### Anti-Patterns to Avoid
- **Renderer-only keyboard interception for the switch chords.** On Windows, Ctrl+[/] reach the PTY as control codes unless intercepted before xterm. Use `before-input-event` (Pattern 1). `[CITED: electronjs.org/docs/tutorial/keyboard-shortcuts]`
- **`globalShortcut.register` for switching.** It is system-wide, silently fails on conflict, and has a macOS non-QWERTY layout bug. Wrong scope for an app-focused, terminal-friendly switch. `[CITED: electronjs.org/docs/latest/api/global-shortcut]`
- **`preventDefault()` in `before-input-event` for chords you also put in a Menu.** Doing so also suppresses menu accelerators (Electron #19279). Keep switch keys OUT of the Menu and handle them solely in `before-input-event`. `[CITED: github.com/electron/electron/issues/19279]`
- **Adding a context-menu / emoji-picker npm dependency.** Violates the no-new-dep posture; both are trivially hand-rolled (D-07/08).
- **Reshaping `SessionRecord` or `SessionIconSpec`.** Both are complete (Phase 1, D-01). The form only *sets existing fields*.
- **Exposing raw `ipcRenderer` or skipping the guard lockstep** for the new `ptyUpdateProfile`. CLAUDE.md hard rule; `security.guard.test.ts` will catch it.
- **Hiding panes with `display:none`** (existing Pattern 8 invariant) — collapse must not touch `.session-view` visibility; only the sidebar collapses.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| App-wins key interception over a terminal | A custom global key hook or per-xterm capture race | Electron `before-input-event` (main) | Fires once, window-wide, before dispatch; the documented mechanism |
| Modal overlay/scrim/Esc/focus | A new modal from scratch | The existing `ConfirmModal` a11y skeleton (copy its structure) | Already proven, DESIGN.md-styled, focus + Esc + scrim done |
| Status color/label for header + dot | New color logic | `STATUS_STYLE` / `statusLabel` / `statusAccent` (status-colors.ts) | Single source of the 5-state ramp incl. derived red |
| Three-kind icon render | New switch | `Sidebar.renderIcon` (extend only the `color` branch per D-09) | Already handles emoji/preset/color |
| E2E driving terminals + rows + add | New WDIO plumbing | `tests/smoke/helpers/xterm-driver.ts` (`clickSidebarRow`, `clickAddSession`, `readBufferOf`) | Established `data-session-id`/`data-testid` contract |
| Position→activeId / next/prev math | Inline in JSX | A pure `session-switch.ts` module | Node-unit-testable like `session-close.ts` |

**Key insight:** Phase 4 is a UI-composition phase over a complete data model. The only place where "build vs. use" has a non-obvious answer is keyboard interception — and there the platform (Electron) already provides the right primitive (`before-input-event`). Everything else is React + the existing tokens.

## Common Pitfalls

### Pitfall 1: Windows Ctrl+[ / Ctrl+] silently reaching the PTY
**What goes wrong:** Switch shortcuts work on macOS (Cmd is app-reserved) but on Windows the Ctrl chords land in vim/tmux as control codes; the active session reacts instead of switching.
**Why it happens:** Renderer-side handlers compete with xterm's keymap; xterm forwards Ctrl combos to the PTY.
**How to avoid:** Intercept in `before-input-event` (main) and `preventDefault()` (Pattern 1) — the keydown never reaches the renderer at all.
**Warning signs:** A switch chord that "works on Mac, broken on Windows" review note; tmux/vim reacting to `Ctrl+[` (which is ESC).

### Pitfall 2: Breaking the security guard by adding a bridge method out of lockstep
**What goes wrong:** `ptyUpdateProfile` added to `api-types.ts` + preload but not to `EXPECTED_API_KEYS` (or vice-versa) → `security.guard.test.ts` fails (`Object.keys(exposed) !== EXPECTED_API_KEYS`).
**Why it happens:** The 5-point lockstep (Pattern 3) is split across tasks.
**How to avoid:** Do all 5 edits in one atomic task; run `vitest run` to see RED→GREEN.
**Warning signs:** Guard test failing on key-set mismatch; "registers exactly one bridge" still green but the key-equality assertion red.

### Pitfall 3: Edited cwd/shell "doesn't apply" because main never saw it
**What goes wrong:** The form edits cwd/shell in renderer state only; on restart, `pty-manager.create()` respawns from the unchanged main-side `record` / `resolveShell()`, so the edit is silently lost (the worst kind — looks saved, isn't).
**Why it happens:** Main is the source of truth for the record `restart()` respawns from; the renderer edit must reach main.
**How to avoid:** Pattern 3 — `ptyUpdateProfile` writes into the main record; make `create()` honor `record.shell` when non-empty.
**Warning signs:** Edit shell → restart → still the old shell; SC2 "all fields functional" fails for shell/cwd.

### Pitfall 4: Live name/icon change lost on a subsequent restart or reconcile
**What goes wrong:** Name/icon applied live in renderer state but not mirrored to main; the 100ms `listSessions()` reconcile (or a restart that rebuilds the record) reverts them.
**Why it happens:** `SessionManager`'s reconcile only ADDs missing ids (it won't clobber existing rows today), but `restart()` rebuilds the record from main's `prior` fields — if name/icon weren't mirrored, restart reverts them.
**How to avoid:** Mirror live name/icon to main via the same `ptyUpdateProfile` (extend it to accept `name`/`icon`), OR confirm the reconcile/restart paths preserve renderer name/icon. Recommend mirroring name/icon too so main stays authoritative (and Phase 5 persistence is trivial).
**Warning signs:** Rename → restart → name reverts to `Session N`; SC3 "rename persists, identity unchanged" partially fails.

### Pitfall 5: Context menu / tooltip not reachable in collapsed mode
**What goes wrong:** Collapsing hides `.row-controls`, but the context menu wasn't wired to the rail row → no way to Edit/Restart/Close a collapsed session (D-11 requires it).
**Why it happens:** `onContextMenu` only added to expanded rows.
**How to avoid:** Attach `onContextMenu` at the `.sidebar-row` level (present in both modes); the menu is the collapsed control surface.
**Warning signs:** Right-click on a rail icon does nothing; collapsed sessions are uneditable.

### Pitfall 6: Emoji variation selectors mis-sizing rows
**What goes wrong:** `🛋️` (U+1F6CB U+FE0F) or skin-tone sequences render taller/wider than expected, jittering row height.
**Why it happens:** Inconsistent emoji-font metrics in a flex row.
**How to avoid:** Fixed `.row-icon` box (already 20×20), `line-height:1`, `overflow:hidden`, center-align; never split the grapheme when storing the free-text value.
**Warning signs:** Rows of unequal height; the canonical `🛋️` icon clipping.

## Code Examples

### Switch-key matching (the load-bearing platform bit) — see Pattern 1
(Full `matchSwitchKey` + `before-input-event` wiring + `resolveSwitch` shown above. The `Input` object's fields — `type:'keyDown'`, `key`, `control`, `meta`, `shift`, `alt` — are the documented `before-input-event` payload. `[CITED: electronjs.org/docs/tutorial/keyboard-shortcuts]`)

### Bridge subscription mirror for the switch event (preload)
```ts
// src/preload/index.ts — mirrors the existing onPtyStatus subscribe/unsubscribe shape
onSwitchSession: (cb: (intent: SwitchIntent) => void): (() => void) => {
  const listener = (_e: IpcRendererEvent, intent: SwitchIntent): void => cb(intent);
  ipcRenderer.on('session:switch', listener);
  return () => ipcRenderer.removeListener('session:switch', listener);
},
```
> `onSwitchSession` adds a **second** new key (15th if counted with `ptyUpdateProfile`). It is a subscribe-style method like `onPtyStatus`, so the guard lockstep applies to it too. Plan both new keys together or in adjacent tasks; each must update `EXPECTED_API_KEYS` + guard in lockstep.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `globalShortcut` for app shortcuts | `before-input-event` for app-focused, terminal-safe chords | Long-standing Electron guidance | Avoids global hijack + macOS layout bug |
| Native `title=` tooltips | Custom CSS tooltips for instant, styled hints | UX convention | Better for fast rail scanning + "cozy" brand |
| Emoji-picker npm libs | Curated grid + native OS emoji input | D-08 decision | Zero dep, unlimited choice |

**Deprecated/outdated:** None relevant — the installed stack (Electron 36, React 19, xterm 5.5) is current for this project's pins.

## Runtime State Inventory

> Phase 4 is **not** a rename/refactor/migration phase — it is additive UI. This section is included only to record that **no** runtime-state migration is required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `SessionRecord` lives in-memory in `pty-manager.ts`; no on-disk store until Phase 5 | None |
| Live service config | None — local-only app, no external services | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None — no package/binary rename | None |

**Nothing found in any category** — verified by codebase read: persistence is Phase 5; main's session store is an in-memory `Map`. The only main-side change is an additive `updateProfile` method.

## Project Constraints (from CLAUDE.md)

| Directive | How Phase 4 complies |
|-----------|----------------------|
| Renderer NEVER imports `electron` or `node-pty` | All new renderer modules import only `window.api` + `../shared/types` (type-only). `before-input-event` is main-side. |
| contextBridge-only seam; never expose raw `ipcRenderer` | New `ptyUpdateProfile` + `onSwitchSession` are typed bridge methods on `ElectronAPI`. |
| Guard-test lockstep for any bridge change | `EXPECTED_API_KEYS` + `security.guard.test.ts` updated in the same task as each new key (Pattern 3, Pitfall 2). |
| Atomic per-task commits | Each task ships one coherent slice (e.g. "form modal", "context menu", "switch keys + bridge"). |
| node-pty in main only; native `.node` not in renderer | Unchanged — Phase 4 adds no PTY surface beyond `updateProfile` (a pure record write). |
| OS-agnostic except at platform edges | `matchSwitchKey` accepts `meta || control` so one rule covers macOS Cmd + Windows Ctrl; no platform branch in renderer. |

## Common Pitfalls (consolidated above — see § Common Pitfalls)

## Validation Architecture

> `nyquist_validation: true` in config.json — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (unit, `environment: 'node'`) + WebdriverIO 10 / @wdio/electron-service 10 (E2E smoke) |
| Config file | `vitest.config.ts` (node env; includes `src/**/__tests__/**/*.test.ts` + `*.guard.test.ts`); `wdio.conf.ts` |
| Quick run command | `npm run test:unit` (`vitest run`) |
| Full suite command | `npm test` (`vitest run` then `wdio run wdio.conf.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-05 (SC4) | Cmd/Ctrl+1..9 + Shift+[/] resolve to the right intent | unit | `vitest run src/main/__tests__/switch-keys.test.ts` | ❌ Wave 0 |
| NAV-05 (SC4) | intent + sessions + activeId → correct next activeId (wraparound, out-of-range) | unit | `vitest run src/renderer/__tests__/session-switch.test.ts` | ❌ Wave 0 |
| NAV-05 (SC4) | switch chord changes active pane without mouse, in-app | E2E | `wdio run wdio.conf.ts` (new `keyboard-switch.smoke.test.ts`) | ❌ Wave 0 |
| SESS-03 (SC2) | IconPicker builds correct `SessionIconSpec`; color→initial badge | unit | `vitest run src/renderer/__tests__/icon-spec.test.ts` | ❌ Wave 0 |
| SESS-01/02 (SC2) | form splits live (name/icon) vs restart (cwd/shell/startup) fields | unit | `vitest run src/renderer/__tests__/session-edit.test.ts` | ❌ Wave 0 |
| SESS-04 (SC3) | edit name/icon → same logicalId (no new session); restart preserves it | E2E + unit | `wdio run ...` (`session-edit.smoke.test.ts`) + restart identity reuse | ❌ Wave 0 |
| SESS-01 (SC2) | edited cwd/shell persisted to main; restart respawns with them | unit (main) | `vitest run src/main/__tests__/pty-update-profile.test.ts` | ❌ Wave 0 |
| NAV-01/02 (SC1) | sidebar shows icon+name+badge; collapsed hides names, icon+dot remain | E2E | `wdio run ...` (`sidebar-collapse.smoke.test.ts`) | ❌ Wave 0 |
| NAV-03 (SC5) | click-switch still non-destructive (regression — Phase 3 covers) | E2E | existing `multi-session-keepalive.smoke.test.ts` | ✅ exists |
| IDENT-03 (SC1) | identity header shows active icon+name+status | E2E | `wdio run ...` (assert `.identity-header` content) | ❌ Wave 0 |
| (all) | bridge surface = new key set exactly; no `ipcRenderer` leak | unit | `vitest run src/shared/__tests__/security.guard.test.ts` | ✅ exists (update RED→GREEN) |

### Sampling Rate
- **Per task commit:** `npm run test:unit` (fast; includes the guard test)
- **Per wave merge:** `npm test` (unit + WDIO smoke)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/main/__tests__/switch-keys.test.ts` — covers NAV-05 chord matching (both modifiers, shift variants, alt/no-match)
- [ ] `src/renderer/__tests__/session-switch.test.ts` — covers NAV-05 next/prev wraparound + out-of-range position
- [ ] `src/renderer/__tests__/icon-spec.test.ts` — covers SESS-03 spec construction + color-initial
- [ ] `src/renderer/__tests__/session-edit.test.ts` — covers SESS-01/02 live-vs-restart field split
- [ ] `src/main/__tests__/pty-update-profile.test.ts` — covers SESS-01 restart respawns with edited cwd/shell; unknown-id no-op
- [ ] `tests/smoke/keyboard-switch.smoke.test.ts` — NAV-05 E2E (drive `browser.keys` for the chord; assert active `data-session-id`/identity header changed)
- [ ] `tests/smoke/session-edit.smoke.test.ts` — SESS-01/02/04 E2E (open context menu → Edit → change name/icon → assert live + same id)
- [ ] `tests/smoke/sidebar-collapse.smoke.test.ts` — NAV-01/02 E2E (toggle collapse; assert names hidden, icons+dots present)
- [ ] Update `security.guard.test.ts` expectation to the new key count (lockstep with `EXPECTED_API_KEYS`)
- [ ] Extend `tests/smoke/helpers/xterm-driver.ts` with `openContextMenu(id)`, `clickMenuItem(label)`, `toggleCollapse()`, `pressSwitchChord(...)`, `readIdentityHeader()`

*Framework install: none — Vitest + WDIO already configured.*

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`. Phase 4 adds a small renderer↔main surface; the dominant risk is the new bridge method.

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | contextBridge-only seam preserved; node-pty stays main-only; new methods are narrow typed functions |
| V2 Authentication | no | Local single-user desktop app; no auth |
| V3 Session Management | no | No web sessions |
| V4 Access Control | no | No multi-user/authz |
| V5 Input Validation | **yes** | `updateProfile` validates id against the live `sessions` Map (unknown/forged id → no-op, mirroring `T-03-01`); `cwd`/`shell`/`startupCommand` type-guarded (`typeof === 'string'`) before writing to the record |
| V6 Cryptography | no | No crypto in this phase |
| V7 Error/Logging | yes | Never log PTY data or full form values containing paths/commands as secrets (existing "never log raw PTY data" rule) |
| V12 Files/Resources | yes (light) | `cwd` is a user-supplied path stored only; **not** validated for existence here (Phase 6 TERM-09/spawn-error handles bad cwd at spawn) — do not silently fall back |

### Known Threat Patterns for {Electron renderer + new bridge method}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged/unknown `id` to `ptyUpdateProfile` | Tampering | Validate id against the `sessions` Map; no-op on miss (existing `T-03-01` precedent) |
| Non-string `cwd`/`shell`/`startupCommand` payload | Tampering | `typeof === 'string'` type guard before assigning to record (existing `isStringData` precedent) |
| Unreviewed bridge key leaking (e.g. raw `ipcRenderer`) | Elevation of Privilege | `security.guard.test.ts` asserts exact `EXPECTED_API_KEYS`; lockstep update |
| `before-input-event` swallowing legitimate keys | Denial of Service (usability) | `matchSwitchKey` returns `null` for anything but the exact chords; only `preventDefault()` on a match |
| Startup command stored then unexpectedly executed | (Misuse) | TERM-05 auto-run stays deferred — `updateProfile` **stores** `startupCommand`; no code path writes it to a PTY this phase |

**Security block-on:** `high`. No high-severity items identified — the new surface is one validated, type-guarded, id-checked fire-and-forget record write plus a read-only inbound switch event.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `before-input-event` `Input.key` is the literal char (`'1'`, `'['`, `']'`) on both macOS and Windows for these chords | Pattern 1 | If `key` differs (e.g. `'BracketLeft'`), `matchSwitchKey` needs the `code`/`key` actually emitted — verify empirically in the WDIO E2E and adjust the matcher. LOW risk: the matcher is a pure module, trivially corrected; the E2E is the proof. |
| A2 | Making `create()` honor `record.shell` when non-empty won't disturb the existing default-shell path | Pattern 3 | If a stored empty/garbage shell reaches `pty.spawn`, spawn could fail — guard with `record.shell && record.shell.length` → else `resolveShell()`. LOW risk: explicit fallback. |
| A3 | The custom CSS tooltip is preferred over native `title=` for the rail | Pattern 6 | Pure UX preference; native `title` is a stated acceptable fallback. No functional risk. |
| A4 | Mirroring live name/icon to main (Pitfall 4) is the right call vs. renderer-only | Pitfall 4 | If the team prefers renderer-only for now, restart/Phase-5 must be checked to preserve name/icon. MEDIUM: affects SC3 durability — recommend mirroring. |

**Note:** A1 is the only assumption that touches a load-bearing mechanism. It is cheaply de-risked by the NAV-05 E2E (drive the real chord, assert the active session changed) — the planner should make that E2E a Wave-0 gate for the switch-keys task.

## Open Questions

1. **Exact `before-input-event` `Input.key` values for the chords (A1).**
   - What we know: the event fires before renderer dispatch; payload has `key`, `control`, `meta`, `shift`, `alt`, `type`.
   - What's unclear: whether `[`/`]` arrive as `'['`/`']'` or as `'BracketLeft'`/`'BracketRight'`, and whether Shift alters `key` to a shifted glyph.
   - Recommendation: write `matchSwitchKey` to accept both `key` and `code` defensively (match `']'` OR `code==='BracketRight'`), and let the WDIO E2E confirm. Keep the matcher pure so a fix is a one-line change.

2. **Where exactly the identity header mounts (layout).**
   - What we know: it sits above the active `SessionView`, identity-only.
   - What's unclear: whether `.viewport-stack` becomes a column flex (header row + stack) or the header overlays the top of the stack.
   - Recommendation: a flex column — `.terminal-area { display:flex; flex-direction:column }` with `.identity-header` (fixed height) + `.viewport-stack` (flex:1). This keeps `SessionView`'s `inset:0` panes correct inside the stack and avoids overlaying terminal content. Planner's discretion.

3. **Whether expanded-mode Restart/Close stay as row buttons or fold into the context menu (D-03 discretion).**
   - Recommendation: keep the existing row buttons in expanded mode (already built, E2E-addressed via `data-testid`) AND add the context menu; the menu is the *only* surface in collapsed mode. Lowest-churn, satisfies D-11.

## Environment Availability

> Phase 4 is renderer/main code + CSS only. No new external tools, services, or runtimes are introduced.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | `before-input-event`, BrowserWindow | ✓ | 36.9.5 | — |
| React | all UI | ✓ | 19.2.7 | — |
| @xterm/xterm | key seam (fallback path) | ✓ | 5.5.0 | — |
| Vitest | unit tests | ✓ | 4.1.8 | — |
| @wdio/electron-service | E2E | ✓ | 10.0.0 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IDENT-03 | Identity (name+icon+status) in sidebar AND header | Pattern 7 (identity header reading active record + `STATUS_STYLE`); sidebar already shows it |
| SESS-01 | Create with name/icon/cwd/shell/startupCommand (all functional) | Pattern 2 (form), Pattern 3 (cwd/shell persisted to main → restart), Pattern 5 (icon); startupCommand stored only (TERM-05 deferred) |
| SESS-02 | Custom name per session | Pattern 2 form name field (live, D-02); mirror to main (Pitfall 4) |
| SESS-03 | Icon from emoji / color badge; visible when collapsed | Pattern 5 (picker), Pattern 6 (rail shows icon + color-initial badge per D-09) |
| SESS-04 | Rename/re-icon after creation without new id | Live apply mutates existing record; `logicalId` untouched (IDENT-02 invariant); Pitfall 4 keeps it durable |
| NAV-01 | Sidebar list: icon + name + status | Already shipped (Phase 3); collapsed legibility via Pattern 6 |
| NAV-02 | Expanded/collapsed; icon identifies when collapsed | Pattern 6 (collapse + rail + color-initial badge) |
| NAV-03 | Click-switch, non-destructive | Already shipped; regression-covered by existing keep-alive E2E |
| NAV-05 | Keyboard switch (positions + next/prev), no mouse | Pattern 1 (`before-input-event` + pure matcher + `resolveSwitch`) |

## Sources

### Primary (HIGH confidence)
- **Codebase (direct read, verified):** `src/renderer/{SessionManager,Sidebar,ConfirmModal,SessionView,session-add,session-close,status-colors,terminal.css}.tsx/.ts`, `src/main/{pty-manager,index,shell-resolver,window-config}.ts`, `src/preload/index.ts`, `src/shared/{types,api-types}.ts`, `src/shared/__tests__/security.guard.test.ts`, `tests/smoke/helpers/xterm-driver.ts`, `vitest.config.ts`, `package.json`, `.planning/config.json` — the authoritative integration map for this phase.
- [Electron — Keyboard Shortcuts](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts) — `before-input-event` fires before renderer dispatch; local (focused-only) vs global; `Input` payload — the mechanism for D-12/D-13.
- [Electron — globalShortcut](https://www.electronjs.org/docs/latest/api/global-shortcut) — system-wide scope, silent-fail on conflict, macOS non-QWERTY bug — why NOT to use it for switching.
- [@xterm/xterm typings — `attachCustomKeyEventHandler`](node_modules/@xterm/xterm/typings/xterm.d.ts) — the in-renderer key seam (fallback path), already used for copy/paste.

### Secondary (MEDIUM confidence)
- [Electron issue #19279 — preventDefault on before-input-event also prevents menu accelerators](https://github.com/electron/electron/issues/19279) — keep switch chords out of the Menu; handle solely in `before-input-event`.

### Tertiary (LOW confidence)
- None — no claim in this research rests on an unverified web-only source. The one empirical unknown (A1, exact `key` strings) is flagged and gated behind the NAV-05 E2E.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly in `package.json`; no new deps.
- Architecture / integration seams: HIGH — every file read; the bridge/guard/test contract is explicit.
- Keyboard interception (D-12/D-13): HIGH on mechanism (`before-input-event`, official docs), MEDIUM on exact `key` strings (A1, gated by E2E).
- Pitfalls: HIGH — each is grounded in a specific existing code path (reconcile, restart record rebuild, guard test).

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable stack; pinned Electron 36 / xterm 5.5 / React 19 unlikely to shift within the phase)

## RESEARCH COMPLETE

**Phase:** 4 - Session Identity + Sidebar UI
**Confidence:** HIGH

### Key Findings
- Phase 4 needs **zero new dependencies** — every data structure (`SessionRecord`, `SessionIconSpec`, `STATUS_STYLE`) and every reusable component (`ConfirmModal`, `Sidebar.renderIcon`, the WDIO `xterm-driver` helpers) already exists. It is a UI-composition phase plus one small main-side record write.
- The one genuinely-uncertain mechanic (D-12/D-13 "app always wins" switching) has a clear answer: **main-process `webContents.on('before-input-event')`** intercepts the chord before it reaches the renderer/xterm/PTY — the only approach that holds on Windows Ctrl combos. `globalShortcut` is the wrong tool; renderer-only capture is racy.
- The form's restart-applied fields (cwd/shell/startupCommand) require **one new bridge method** (`ptyUpdateProfile`) that writes into main's authoritative `SessionRecord`, plus a `onSwitchSession` subscribe method — both must update `EXPECTED_API_KEYS` + `security.guard.test.ts` in lockstep (CLAUDE.md hard rule).
- Keep all branchy logic in **React/xterm-free pure modules** (`switch-keys.ts`, `session-switch.ts`, `icon-spec.ts`, `session-edit.ts`) mirroring `session-add.ts`/`session-close.ts` so it unit-tests in the Node Vitest env; E2E via WDIO for the form, context menu, chords, and collapse.
- No runtime-state migration (additive phase); session store is in-memory until Phase 5.

### File Created
`.planning/phases/04-session-identity-sidebar-ui/04-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | No new deps; versions verified in package.json |
| Architecture | HIGH | Every integration file read directly |
| Pitfalls | HIGH | Each grounded in a specific existing code path |
| Keyboard mechanism | HIGH (mechanism) / MEDIUM (exact key strings, A1) | Official Electron docs; A1 gated by NAV-05 E2E |

### Open Questions
- Exact `before-input-event` `Input.key` strings for `[`/`]`/digits (A1) — write the matcher defensively (`key` OR `code`), confirm in the NAV-05 E2E.
- Identity-header mount (flex-column recommended) and whether expanded Restart/Close stay as buttons (recommend: keep + add context menu).

### Ready for Planning
Research complete. The planner can create PLAN.md files: pure modules + Wave-0 tests first, then form/context-menu/icon-picker/collapse/header UI, then the main-side `before-input-event` + bridge lockstep slice.
