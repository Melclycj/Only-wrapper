# Phase 7: Terminal Search + Scrollback Config — Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/main/switch-keys.ts` | utility (pure matcher) | event-driven | `matchClearKey` in same file (lines 94–102) | exact |
| `src/main/index.ts` | config/wiring | event-driven | existing `matchClearKey` dispatch block (lines 105–112) | exact |
| `src/main/store-schema.ts` | model/schema | CRUD | existing `StoreSchema.ui` + `coerceOnLoad` (lines 30–60) | exact |
| `src/main/pty-manager.ts` | service | CRUD | existing `setUiState` validator (lines 1075–1093) | exact |
| `src/shared/api-types.ts` | model/types | request-response | existing `persistUiState` signature (lines 179–183) | exact |
| `src/renderer/SessionManager.tsx` | component (container) | event-driven | existing `onSwitchSession` clear branch (lines 475–487) | exact |
| `src/renderer/SessionView.tsx` | component (container) | streaming | existing addon mount block (lines 178–186) + cleanup (lines 464–487) | exact |
| `src/renderer/SearchBar.tsx` | component (presentational) | request-response | `ConfirmModal.tsx` (overlay + Esc + stopPropagation) | role-match |
| `src/renderer/PreferencesModal.tsx` | component (presentational) | request-response | `ConfirmModal.tsx` (modal-overlay / modal-dialog idiom) | exact |
| `src/renderer/Sidebar.tsx` | component (presentational) | event-driven | existing add-session + collapse-toggle buttons (lines 458–523) | exact |

---

## Pattern Assignments

### `src/main/switch-keys.ts` (pure utility, event-driven)

**Analog:** `matchClearKey` in the same file (`src/main/switch-keys.ts` lines 75–102)

**SwitchIntent union extension** (lines 14–22 — add `'search'` variant here):
```typescript
export type SwitchIntent =
  | { kind: 'position'; index: number }
  | { kind: 'next' }
  | { kind: 'prev' }
  | { kind: 'clear' }
  // ADD: | { kind: 'search' }   ← new variant, zero new bridge key (D-02)
```

**Clear-chord matcher as verbatim template** (lines 94–102):
```typescript
export function matchClearKey(i: KeyInput): SwitchIntent | null {
  if (i.type !== 'keyDown') return null;
  if (!isKeyK(i)) return null;
  if (i.meta) return { kind: 'clear' };            // macOS: Cmd+K
  if (i.control && i.shift) return { kind: 'clear' }; // Windows: Ctrl+Shift+K
  return null;
}
// CRITICAL DIFFERENCE for matchSearchKey (Pitfall 2 / D-03):
// - macOS: i.meta && isKeyF(i)  → { kind: 'search' }   (NOT i.control — would steal readline)
// - Windows: i.control && !i.meta && isKeyF(i) → { kind: 'search' }
// - macOS i.control alone → null (must let readline forward-char through)
// Pass process.platform into the matcher as an arg for testability (Pitfall 2 solution).
```

**isKeyK defensive helper as template for isKeyF** (lines 76–78):
```typescript
function isKeyK(i: KeyInput): boolean {
  return i.key === 'k' || i.code === 'KeyK';
}
// → copy as isKeyF: return i.key === 'f' || i.code === 'KeyF';
```

---

### `src/main/index.ts` (wiring, event-driven)

**Analog:** `matchClearKey` dispatch block (lines 105–112)

**Before-input-event dispatch pattern to copy** (lines 97–112):
```typescript
win.webContents.on('before-input-event', (event, input) => {
  const key = input as unknown as KeyInput;
  const intent = matchSwitchKey(key);
  if (intent) {
    event.preventDefault();
    win.webContents.send('session:switch', intent);
    return;
  }
  // Clear chord (Cmd+K / Ctrl+Shift+K — D-13). Rides the SAME 'session:switch' channel.
  const clear = matchClearKey(key);
  if (clear) {
    event.preventDefault();
    win.webContents.send('session:switch', clear);
  }
  // ADD sibling block — same shape:
  // const search = matchSearchKey(key, process.platform);
  // if (search) { event.preventDefault(); win.webContents.send('session:switch', search); }
});
```

---

### `src/main/store-schema.ts` (model, CRUD)

**Analog:** existing `StoreSchema.ui` interface + `coerceOnLoad` in the same file (lines 30–60)

**StoreSchema ui section to extend** (lines 30–37):
```typescript
export interface StoreSchema {
  version: number;
  sessions: SessionRecord[];
  ui: {
    collapsed?: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
    // ADD: scrollback?: number   ← additive, migration-safe (absent → default 5000 at read site)
  };
}
```

**coerceOnLoad as template for a `clampScrollback` pure helper**:
```typescript
// coerceOnLoad pattern (lines 53–60): pure, no-I/O, electron-free, Vitest-testable.
export function coerceOnLoad(rec: SessionRecord): SessionRecord {
  return {
    ...rec,
    status: 'not_started',
    ptyPid: undefined,
    configured: rec.configured ?? true,  // ← read-time default, no SCHEMA_VERSION bump
  };
}
// → clampScrollback follows the same pattern: pure, non-throwing, default-on-invalid:
// export function clampScrollback(n: unknown): number {
//   if (typeof n !== 'number' || !Number.isFinite(n)) return 5000;
//   return Math.max(1000, Math.min(50000, Math.round(n)));
// }
// SCHEMA_VERSION: a read-time default for absent `scrollback` does NOT require a bump
// (mirrors how `ui` already tolerates {}). Only bump 2→3 if a coerceOnLoad-style
// normalization pass is explicitly added.
```

---

### `src/main/pty-manager.ts` (service, CRUD)

**Analog:** existing `setUiState` validator (lines 1067–1093) and `getUiState` (lines 1095–1102)

**Validate-in-main pattern to extend** (lines 1075–1093):
```typescript
setUiState(ui: unknown): void {
  if (!ui || typeof ui !== 'object') return;   // forged payload → no-op (T-05-01)
  const { collapsed, bounds } = ui as { collapsed?: unknown; bounds?: unknown };
  if (typeof collapsed === 'boolean') {
    this.uiState.collapsed = collapsed;
  }
  if (bounds && typeof bounds === 'object') {
    const { x, y, width, height } = bounds as Record<string, unknown>;
    if (
      typeof x === 'number' && Number.isFinite(x) &&
      typeof y === 'number' && Number.isFinite(y) &&
      typeof width === 'number' && Number.isFinite(width) &&
      typeof height === 'number' && Number.isFinite(height)
    ) {
      this.uiState.bounds = { x, y, width, height };
    }
  }
  this.signalStore();
}
// ADD scrollback field extraction inside setUiState — same finite-number guard:
// const { scrollback } = ui as { scrollback?: unknown };
// if (typeof scrollback === 'number' && Number.isFinite(scrollback)) {
//   this.uiState.scrollback = clampScrollback(scrollback);
// }
```

**getUiState return type to widen** (lines 1100–1102):
```typescript
getUiState(): { collapsed?: boolean; bounds?: {...}; /* ADD scrollback?: number */ } {
  return { ...this.uiState };
}
```

---

### `src/shared/api-types.ts` (types, request-response)

**Analog:** existing `persistUiState` declaration (lines 179–183)

**Payload type to widen** (lines 179–183 — NO new key, just wider payload):
```typescript
persistUiState: (ui: {
  collapsed?: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
  // ADD: scrollback?: number
}) => void;
// EXPECTED_API_KEYS stays 19 — the security.guard test asserts key NAMES, not
// payload shapes. Confirmed safe (Research Persistence Shape §4 + A3).
```

**Boot-read channel (Open Question 1 from RESEARCH.md — planner must resolve):**
The renderer needs the persisted scrollback on first mount to seed `new Terminal({ scrollback })`.
Current `listSessions()` returns `SessionRecord[]` only. Options:
- Widen the `listSessions` return to `{ sessions: SessionRecord[]; ui: UiState }` — no new key but changes the response shape.
- Add one new validated bridge key `getUiState: () => Promise<{ scrollback?: number }>` — the single allowable 19→20 expansion, requires the full atomic lockstep (api-types + window-config array + preload + security.guard), mirroring the `pickDirectory` 06-01 pattern.
- Interim fallback: default to 5000 on boot, apply persisted value on first `persistUiState` round-trip.
The planner must pick one path. The `pickDirectory` expansion in Phase 06-01 is the exact template for the 19→20 lockstep if needed.

---

### `src/renderer/SessionManager.tsx` (container component, event-driven)

**Analog:** `onSwitchSession` effect + clear branch (lines 475–487) and `handleClear` (lines 224–229)

**Clear-chord branch — verbatim template for `'search'` branch** (lines 476–487):
```typescript
useEffect(() => {
  const off = window.api.onSwitchSession((intent) => {
    if (intent.kind === 'clear') {
      setActiveId((cur) => {
        if (cur !== null) handleClear(cur);
        return cur; // Clear never switches the active session.
      });
      return;
    }
    // ADD before the resolveSwitch fallthrough:
    // if (intent.kind === 'search') {
    //   setActiveId((cur) => {
    //     if (cur !== null) setSearchOpen(cur, (prev) => !prev);
    //     return cur;  // Search never switches the active session.
    //   });
    //   return;
    // }
    setActiveId((cur) => resolveSwitch(sessionsRef.current, cur, intent));
  });
  return off;
}, [handleClear]);
```

**handleClear as template for handleToggleSearch** (lines 224–229):
```typescript
const handleClear = useCallback((id: LogicalId) => {
  const w = window as unknown as {
    __sessionTerms?: Record<string, { clear: () => void }>;
  };
  w.__sessionTerms?.[id]?.clear();
}, []);
// → handleToggleSearch similarly reads a per-id ref or uses per-row state.
// Per-row searchOpen state follows the same pattern as closingId/editingId:
//   const [searchOpenId, setSearchOpenId] = useState<LogicalId | null>(null);
// where non-null means that session's search bar is open.
```

**Scrollback fan-out — new handler following the `handleReorder` pattern** (lines 290–298):
```typescript
// handleReorder as a fan-out template (lines 290–298):
const handleReorder = useCallback((fromId: LogicalId, toId: LogicalId) => {
  setSessions((prev) => {
    const next = reorder(prev, fromId, toId);
    window.api.persistOrder(next.map((s) => ({ id: s.logicalId, order: s.order })));
    return next;
  });
}, []);
// → handleSetScrollback: no setSessions needed (scrollback is not per-session state)
// const [scrollback, setScrollback] = useState<number>(5000); // boot default
// const handleSetScrollback = useCallback((n: number) => {
//   const clamped = clampScrollback(n);        // pure renderer-side clamp for the input
//   setScrollback(clamped);                     // drives all SessionView props
//   window.api.persistUiState({ scrollback: clamped });  // validated in main (T-05-01)
// }, []);
// Fan-out is automatic: SessionView receives `scrollback` as prop; a useEffect inside
// it calls `term.options.scrollback = scrollback` on prop change (D-05).
```

---

### `src/renderer/SessionView.tsx` (container component, streaming)

**Analog:** existing addon loading block + cleanup in the same file (lines 178–186 and 464–487)

**Addon mount pattern to copy for SearchAddon** (lines 178–186):
```typescript
// Existing addon loading (verbatim):
const fit = new FitAddon();
fitRef.current = fit;
term.loadAddon(fit);
term.loadAddon(new WebLinksAddon());
const uni = new Unicode11Addon();
term.loadAddon(uni);
term.unicode.activeVersion = '11';
// ADD after uni:
// import { SearchAddon } from '@xterm/addon-search';
// const search = new SearchAddon();
// searchRef.current = search;
// term.loadAddon(search);
// (SearchAddon is pure JS — no WebGL/GPU concern; load once, keep for term's lifetime)
```

**Cleanup block to extend** (lines 464–487):
```typescript
// Existing cleanup (abridged):
return () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  clearInterval(agentTick);
  offData(); offExit(); offStatus();
  onDataDisp.dispose();
  resizeObserver.disconnect();
  window.removeEventListener('resize', onResize);
  container.removeEventListener('contextmenu', onContextMenu);
  detachWebgl(webglRef.current);
  webglRef.current = null;
  // ... __sessionTerms cleanup ...
  term.dispose();
  termRef.current = null;
  fitRef.current = null;
};
// ADD before term.dispose():
// searchRef.current?.dispose();
// searchRef.current = null;
// offDidChangeResults?.();   // unsubscribe the onDidChangeResults listener
```

**Terminal constructor — scrollback prop seed** (line 167):
```typescript
// Existing (line 167):
const term = new Terminal({
  scrollback: 10000,    // ← replace with the `scrollback` prop value (default 5000)
  allowProposedApi: true,
  // ...
});
```

**Live-apply effect pattern** (new `useEffect` keyed on `scrollback` prop):
```typescript
// Follows the activate effect pattern (lines 493–511):
useEffect(() => {
  const term = termRef.current;
  if (term) term.options.scrollback = scrollback;  // D-05: runtime-settable scalar
}, [scrollback]);
// On decrease, xterm trims rows beyond the new cap (D-06 — expected, not a bug).
```

**attachCustomKeyEventHandler + focus guard (lines 201–221) — SearchBar isolation note:**
The existing handler already gates on `xterm-helper-textarea` focus (lines 214–217). When the
search bar `<input>` is focused, xterm's textarea is NOT focused — so xterm's handler falls
through correctly. The SearchBar `<input>` must additionally `stopPropagation()` on its
`onKeyDown` (Esc, Enter, Shift+Enter) to prevent bubbling to `before-input-event` (Pitfall 3).

---

### `src/renderer/SearchBar.tsx` (new presentational component, request-response)

**Analog:** `ConfirmModal.tsx` (Esc handler + overlay positioning + stopPropagation)

**Esc-to-close pattern from ConfirmModal** (lines 36–47):
```typescript
useEffect(() => {
  if (!open) return;
  confirmRef.current?.focus();
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();   // → for SearchBar: onClose()
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [open, onCancel]);
```

**Overlay structure from ConfirmModal** (lines 51–91):
The `<div className="modal-overlay">` + `<div className="modal-dialog">` skeleton. SearchBar
uses a sibling-to-terminal `position: absolute` overlay instead of a full-screen scrim, but
the `stopPropagation` + Esc discipline is identical:
```typescript
// SearchBar is a sibling <div> (NOT inside .xterm), absolute-positioned top-right over
// the terminal container. It must NOT be inside the xterm element or events leak to the PTY.
// Its <input> onKeyDown:
//   - Enter → search.findNext(...)
//   - Shift+Enter → search.findPrevious(...)
//   - Escape → onClose() (stops propagation so the PTY never sees it)
//   - All → e.stopPropagation() to prevent bubbling to before-input-event.
```

**Props shape**:
```typescript
export interface SearchBarProps {
  open: boolean;
  searchAddon: SearchAddon | null;  // the ref value from SessionView
  onClose: () => void;
}
// Internal state: query (string), caseSensitive (boolean), matchState ({index, count})
```

---

### `src/renderer/PreferencesModal.tsx` (new presentational component, request-response)

**Analog:** `ConfirmModal.tsx` — verbatim structural template

**Exact modal skeleton to clone** (ConfirmModal.tsx lines 24–91):
```typescript
// Structure to clone:
export function PreferencesModal({ open, onClose, scrollback, onScrollbackChange }: PreferencesModalProps) {
  const titleId = useId();
  // Focus + Esc handler — same useEffect as ConfirmModal lines 36–47.

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}  // clicks inside must NOT close
      >
        <h2 id={titleId} className="modal-title">Preferences</h2>
        {/* scrollback number input — range 1000–50000, default 5000 */}
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
```

**CSS classes to reuse from ConfirmModal** (no new CSS needed for the shell):
`modal-overlay`, `modal-dialog`, `modal-title`, `modal-body`, `modal-actions`, `modal-btn`,
`modal-btn-cancel`.

---

### `src/renderer/Sidebar.tsx` (presentational component, event-driven)

**Analog:** add-session button + collapse-toggle button (lines 458–523)

**Add-session button as template for the gear button** (lines 515–523):
```typescript
<button
  type="button"
  className="add-session"
  data-testid="add-session"
  aria-label="Add session"
  onClick={onAdd}
>
  <span>{collapsed ? '+' : '+ Add session'}</span>
</button>
// → gear button (placed adjacent or in the footer alongside add-session):
// <button
//   type="button"
//   className="sidebar-prefs"
//   data-testid="open-preferences"
//   aria-label="Preferences"
//   title="Preferences"
//   onClick={onOpenPreferences}
// >
//   <span aria-hidden="true">⚙</span>
// </button>
```

**Collapse-toggle button as pattern for how sidebar controls work in both modes** (lines 458–470):
```typescript
<button
  type="button"
  className="sidebar-collapse"
  data-testid="sidebar-collapse"
  aria-pressed={collapsed}
  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  onClick={onToggleCollapse}
>
  <span className="sidebar-collapse-chevron" aria-hidden="true">
    {collapsed ? '»' : '«'}
  </span>
</button>
// The gear icon works in BOTH collapsed and expanded modes — the ⚙ glyph is
// self-explanatory without a text label, so no collapsed/expanded text swap needed.
```

**SidebarProps extension**:
```typescript
// ADD to SidebarProps interface:
onOpenPreferences: () => void;
```

---

## Shared Patterns

### Global-Chord Channel (find chord, clear chord, switch chord — all the same pipe)
**Source:** `src/main/switch-keys.ts` + `src/main/index.ts` lines 97–112 + `src/renderer/SessionManager.tsx` lines 475–487
**Apply to:** `switch-keys.ts` (add variant) + `index.ts` (add dispatch block) + `SessionManager.tsx` (add branch)

The full chain is:
1. Pure matcher (switch-keys.ts) — returns `SwitchIntent | null`, electron-free, Vitest-testable.
2. `before-input-event` dispatch (index.ts) — `event.preventDefault()` then `win.webContents.send('session:switch', intent)`.
3. Single `onSwitchSession` subscription (SessionManager.tsx) — `if (intent.kind === 'clear') { ... return; }` branch-and-return pattern.

The `{ kind: 'search' }` variant follows all three steps identically.

### Validate-in-Main (scrollback persistence)
**Source:** `src/main/pty-manager.ts` `setUiState` lines 1075–1093
**Apply to:** `pty-manager.ts` (extend `setUiState`) + `store-schema.ts` (new `clampScrollback` helper)

The invariant: renderer sends `persistUiState({ scrollback: n })` → main validates finite number → clamps to 1000–50000 → stores → `signalStore()` → debounced lowdb write. A forged/out-of-range payload clamps or no-ops, never writes arbitrary data (T-05-01).

### Modal Idiom (ConfirmModal shell)
**Source:** `src/renderer/ConfirmModal.tsx` lines 1–91
**Apply to:** `PreferencesModal.tsx` (clone the whole skeleton)

The three invariants to preserve: (1) `if (!open) return null` guard, (2) `onClick={onClose}` on the overlay + `onClick={(e) => e.stopPropagation()}` on the dialog, (3) Esc-to-close `window.addEventListener('keydown', ...)` in a `useEffect([open, onClose])`.

### Addon Lifecycle (load-once, dispose-once)
**Source:** `src/renderer/SessionView.tsx` lines 178–186 (load in mount effect) + lines 464–487 (cleanup)
**Apply to:** `SessionView.tsx` (SearchAddon mount + dispose)

The key constraint: the `SessionView` term is keep-alive (created once, NEVER recreated on tab switch). Load `SearchAddon` exactly once in the mount effect (alongside Fit/WebLinks/Unicode11); dispose it in the existing cleanup return before `term.dispose()`. Do NOT load per-search or per-tab-activate.

### Renderer-Never-Touches-Disk
**Source:** `src/shared/api-types.ts` + `src/main/pty-manager.ts`
**Apply to:** `PreferencesModal.tsx` / `SessionManager.tsx` — all persistence routes through `window.api.persistUiState`

The scrollback value never goes directly to disk from the renderer. The chain: `window.api.persistUiState({ scrollback })` → preload IPC send → `ptyManager.setUiState(ui)` → `signalStore()` → `SessionStore` debounced lowdb write.

---

## No Analog Found

None — every file has a direct analog in the codebase.

---

## Test File Analogs

| Test to Create/Extend | Closest Existing Test | What to Mirror |
|---|---|---|
| Extend `src/main/__tests__/switch-keys.test.ts` | Same file (already exists, tests `matchSwitchKey` + `matchClearKey`) | Add `matchSearchKey` cases: mac Cmd+F → `{kind:'search'}`; mac Ctrl+F → `null`; win Ctrl+F → `{kind:'search'}` |
| New `src/main/__tests__/scrollback-clamp.test.ts` | `src/main/__tests__/store-schema.test.ts` (pure schema helpers) | `clampScrollback(n)`: 5000 default, clamp 1000–50000, non-finite → 5000 |
| Extend `src/main/__tests__/pty-validation.test.ts` or `session-store.test.ts` | Existing validation tests | `setUiState` with `scrollback`: valid clamped, forged/out-of-range no-ops/clamps |
| `src/shared/__tests__/security.guard.test.ts` | Same file (must STAY GREEN — asserts `EXPECTED_API_KEYS = 19`) | No change needed if riding `persistUiState` payload widening |

---

## Metadata

**Analog search scope:** `src/main/`, `src/renderer/`, `src/shared/`
**Files scanned:** 10 source files read in full
**Pattern extraction date:** 2026-06-09
