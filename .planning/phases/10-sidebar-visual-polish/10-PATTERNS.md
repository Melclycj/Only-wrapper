# Phase 10: Sidebar Visual Polish - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 6 (3 modified, 2–3 new; 1 CSS in-place-or-extracted)
**Analogs found:** 6 / 6 (all in-codebase; this is a restyle, every analog is the file being restyled or its sibling idiom)

> Read the canonical refs in `10-CONTEXT.md <canonical_refs>` and the RESEARCH "Architecture Patterns" before planning. This phase is **composition, not architecture** — almost every "analog" is the very file being edited or a sibling pure-module idiom already proven in the codebase. The dominant risk is selector-contract breakage, not missing patterns.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/Sidebar.tsx` (modify) | component | request-response (display) | itself (in-place restructure) | exact (self) |
| `src/renderer/terminal.css` **or** new `src/renderer/sidebar.css` | config (styles) | transform (token→pixel) | existing sidebar block in `terminal.css` L95-300 | exact (self) |
| `src/renderer/ContextMenu.tsx` (modify) | component | event-driven | itself + `ConfirmModal.tsx` listener idiom | exact (self) |
| `src/renderer/SessionManager.tsx` (modify, menu items) | component | event-driven | its own `items=[...]` array (L713-744) | exact (self) |
| `src/renderer/row-secondary.ts` (**new**) | utility | transform (pure) | `start-affordances.ts` / `session-status.ts` | exact (idiom) |
| `src/renderer/__tests__/row-secondary.test.ts` (**new**) | test | — | `start-affordances.test.ts` / `session-status.test.ts` | exact (idiom) |
| context-menu clamp pure fn (**new**, in row-secondary.ts or own module) | utility | transform (pure math) | `scrollback-clamp.ts` (pure clamp + test) | role-match |

## Pattern Assignments

### `src/renderer/Sidebar.tsx` (component, display) — D-01/D-02/D-03/D-04/D-11/D-12/D-13

**Analog:** itself. Restructure the row JSX in place; keep all class names & testids.

**Per-row `--accent` inline channel** (Sidebar.tsx L193-194, L267-280) — D-05/D-06/D-09 ride this. Currently written on `.collapsed-status-dot` (L269) and `.status-badge` (L275). **Lift it to the row container** so the edge bar / wash can read it, and add a `data-agent` attribute for the D-09 `[data-agent="waiting"]` seam:
```tsx
const agentState = (s as { agentState?: AgentState }).agentState;
const stat = presentation(s.status, agentState);   // status-colors.ts — DO NOT add a parallel status path
// move --accent up to the row:
<div className={isActive ? 'sidebar-row active' : 'sidebar-row'}
     style={{ ...style, '--accent': stat.accent } as React.CSSProperties}
     data-session-id={s.logicalId}
     data-agent={agentState}>   {/* NEW seam for D-09 amber-on-non-active */}
```

**Two-line restructure (D-01/D-03)** — keep `.row-name` (smoke selects it: `session-edit.smoke:39`, `app-restart-restore.smoke:133`) and keep `.status-badge` in the DOM. Current single flex line is L263-390. Nest name + a NEW `.row-secondary` line in a `.row-text` flex column (`min-width:0`). Secondary text comes from the new pure helper (see row-secondary.ts).

**`renderIcon` single source (D-04)** — Sidebar.tsx L39-62. **Do not fork it.** Enlarge the tile via CSS only (`.row-icon` width/height/border-radius). It already handles emoji | preset | color-badge.

**Start affordance gating (D-13)** — Sidebar.tsx L213-218, L285-300. `startAffordances()` decides `sidebarStart` / `startNoCmd`. D-13's always-visible ▶ must keep `startCtl.sidebarStart` rendering on inactive recipe rows AND be excluded from the `.row-controls` `opacity:0` hover-reveal (CSS change, not logic).

**Section labels + count (D-12)** — labels exist at L524-526 / L537-539; append `· {workingArea.length}`. Empty inactive section already unrendered (L532). Keep `data-testid="working-area"` / `"inactive-list"`.

**SELECTOR-CONTRACT FREEZE (frozen-or-update-in-lockstep):** `.sidebar-row[data-session-id]`, `.sidebar-row.active`, `.row-name`, `.collapsed-status-dot.status-dot` (L267-271), `.rail-tooltip` (L388-390), `working-area`/`inactive-list` testids, and every `row-control` testid (`start-session`, `restart-session`, `start-no-cmd-session`, `edit-session`, `close-session`, `delete-session`, `sidebar-collapse`, `open-preferences`, `add-session`). Grep `tests/` before editing.

---

### `terminal.css` (or new `sidebar.css`) (config, transform) — all geometry/color

**Analog:** the existing sidebar block, `terminal.css` L49-385.

**color-mix wash precedent** (L184-188, L195, and the `.add-session` dashed at L268-280):
```css
.sidebar-row .row-control-close:hover {
  border-color: var(--color-danger);
  background: color-mix(in oklch, var(--color-danger) 8%, transparent);
  color: var(--color-danger);
}
```
This is the exact idiom for the **D-15 danger menu item** and the **D-09 amber wash** (swap `--color-danger` → `--accent-waiting`).

**Active card + edge bar (D-05/D-06)** — replace the current flat `.sidebar-row.active` (L97-100, only `background:var(--bg-sunk)`):
```css
.sidebar-row.active {
  border-left: 3px solid var(--accent);   /* status-colored, reads --accent from row */
  background: var(--surface);
  box-shadow: var(--shadow-pop);           /* lift — same token used by .dragging L235 */
}
.sidebar-row[data-agent='waiting'] {       /* D-09 — fires even when NOT active */
  border-left: 3px solid var(--accent-waiting);
  background: color-mix(in oklch, var(--accent-waiting) 8%, transparent);
}
```

**Enlarged icon tile (D-04)** — `.row-icon` is L102-111 (currently 20px/15px/radius 6). Bump to ~34px, `border-radius: var(--radius-md)`.

**Hover/focus reveal (D-02)** — pattern already at L142-155 (`.row-controls { opacity:0 }` → `:hover/.active { opacity:1 }`). Add `:focus-within`/`:focus-visible` for keyboard a11y. The drag-handle reveal (L228-244) and start-button focus ring (`.row-control-start:focus-visible` L198-201) are the templates.

**Recipe dashed cards (D-11)** — reuse the `.add-session` dashed-border language (L268-274: `border: 1px dashed var(--line)`); apply to `.sidebar-row[data-dormant]` (dormant attr written at Sidebar.tsx L237).

**Ghost ▶ (D-13)** — `.row-control-start` is L193-201 (fills accent-blue on hover); make circular (`border-radius:999px`, `border:1px solid var(--color-accent)`, fill on hover).

**Collapsed continuity (D-07/D-10)** — collapsed hide rules L355-369; `.collapsed-status-dot` L334-339 (8px → ~10px + thicker `--surface` ring). Hide the NEW `.row-text`/`.row-secondary` under `.sidebar.collapsed` (extend L355-359). Apply the active edge bar to the collapsed row too.

**Tokens-first (HARD):** every value goes through `tokens.css` `var()`. `tokens-completeness.test.ts` asserts every `var(--token)` resolves AND bans migrated literals (brand blue / danger red / `'Nunito'` / `'JetBrains Mono'`). Use `--space-*` (first consumer this phase), `--accent-*`, `--radius-*`, `--shadow-*`, `--ink-*`. **If extracting to `sidebar.css`:** update (1) `index.tsx` import order, (2) `tokens-completeness.test.ts` scanned-file path list, (3) ui-lab injection helper `tests/ui-lab/helpers.ts` — all IN THE SAME PLAN.

---

### `src/renderer/ContextMenu.tsx` (component, event-driven) — D-14 + D-15

**Analog:** itself. Root cause confirmed: L87 renders `style={{ left: x, top: y }}` with raw `clientX/clientY` (from Sidebar.tsx L244 → SessionManager `menuState.x/y`); **no clamp anywhere.**

**D-14 fix** — measure-then-clamp after mount, leaving the existing focus/Esc/roving-arrow logic (L42-79) untouched:
```tsx
const [pos, setPos] = useState({ left: x, top: y });
useEffect(() => {
  const el = ref.current; if (!el) return;
  const { width, height } = el.getBoundingClientRect();
  const m = 8;
  setPos({
    left: Math.max(m, Math.min(x, window.innerWidth - width - m)),
    top:  Math.max(m, Math.min(y, window.innerHeight - height - m)),
  });
}, [x, y]);
// render style={{ left: pos.left, top: pos.top }}
```
Extract the math as a pure `clampToViewport(x,y,w,h,vw,vh,m)` for unit-testability (mirror `scrollback-clamp.ts`).

**D-15** — extend `ContextMenuItem` (L17-20) with optional `danger?: boolean`; render `context-menu-item-danger` class on the button (L91-103). Pair with the CSS danger rule above. Keep item labels (`Edit`/`Start`/`Restart`/`Start without command`/`Remove`/`Delete`) — ui-lab `contextMenuLabels()` reads them.

---

### `src/renderer/SessionManager.tsx` (component, event-driven) — D-15 wiring

**Analog:** its own `items=[...]` array, L713-744. Set `danger: true` on the `Remove` (live) and `Delete` (dormant) entries:
```tsx
menuIsDormant
  ? { label: 'Delete', danger: true, onSelect: () => handleDeleteRequest(menuState.id) }
  : { label: 'Remove', danger: true, onSelect: () => handleCloseRequest(menuState.id) },
```
`menuState.x/y` stay raw clientX/clientY (the clamp now lives in ContextMenu).

---

### `src/renderer/row-secondary.ts` (**NEW** utility, pure transform) — D-03

**Analog:** `start-affordances.ts` / `session-status.ts` — pure renderer modules importing NOTHING from React/xterm, so they're Vitest-importable in the Node env (the project forbids adding jsdom/test packages). Same header-comment + exported-pure-fn shape.
```ts
import type { SessionStatus } from '../shared/types';
export function cwdTail(cwd: string): string {
  return cwd.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? '';
}
// live → `${label} · ${cwdTail}`; recipe(not_started) → startupCommand || cwdTail || label
export function secondaryText(
  row: { status: SessionStatus; cwd?: string; startupCommand?: string },
  label: string,
): string { /* branch per D-03 */ }
```
Keep the `clampToViewport` pure fn here too (or its own module) so D-14 is unit-verifiable.

### `src/renderer/__tests__/row-secondary.test.ts` (**NEW** test)

**Analog:** `src/renderer/__tests__/start-affordances.test.ts` (pure-predicate table tests, no testing-library; documents the invariant in a header comment). Cover every D-03 branch + the clamp math (corners/overflow).

## Shared Patterns

### Status → color/label (single source — DO NOT re-implement)
**Source:** `src/renderer/status-colors.ts` — `presentation(status, agent)` L66-72; amber overlay applies ONLY while `status==='running'` (locked Phase-6 contract). D-06/D-09 ride the already-resolved `stat.accent`. Guarded by `status-colors.test.ts`.

### Per-row accent delivery
**Source:** inline `style={{ '--accent': stat.accent }}` (Sidebar.tsx L269/L275). `--accent` is allow-listed in `tokens-completeness.test.ts`. Apply to: D-05 active edge bar, D-09 waiting wash/bar, collapsed-rail bar. No new per-status CSS classes.

### color-mix tint wash
**Source:** `terminal.css` L186/L195. Apply to: D-09 amber wash, D-15 danger-item hover, ghost ▶ hover.

### Pure-module + Vitest idiom
**Source:** `start-affordances.ts`, `session-status.ts`, `scrollback-clamp.ts` (+ their `__tests__`). Apply to: `row-secondary.ts` and the clamp fn — keep JSX dumb, unit-test the logic.

### ui-lab verification loop (mandatory, no claim without capture)
**Source:** `tests/ui-lab/README.md` + `DESIGN-RUBRIC.md` + `surfaces.ts`. `UI_LAB_TAG=before-phase10 npm run ui:shots` before first edit. **Structural (TSX) changes need `ui:shots:fresh` (packaged) — live-CSS injection previews CSS over OLD markup** and will mislead. Finish every claim with a packaged no-injection capture. Per-commit: `npm run test:unit && npx tsc --noEmit`. Per-wave: `npm run test:smoke`.

## No Analog Found

None. Every file maps to itself or a proven sibling idiom — this is an in-codebase restyle with zero new architecture and zero new packages.

## Open Item for Planner (from RESEARCH A2 / Open Q1)

Before writing the D-09 task, confirm a **non-active running** session carries `agentState` (renderer-only, set by the SessionView idle detector). If the detector is active-row-only, the D-09 "amber on non-active waiting rows" wash won't fire. Grep `SessionManager.tsx` for where `agentState` is attached to rows.

## Metadata

**Analog search scope:** `src/renderer/` (Sidebar.tsx, ContextMenu.tsx, SessionManager.tsx, status-colors.ts, start-affordances.ts, session-status.ts, terminal.css, `__tests__/`).
**Files scanned:** 8 source + test-dir listing.
**Pattern extraction date:** 2026-06-11
