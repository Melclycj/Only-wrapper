# Phase 11: Terminal Area Polish + Session Lifecycle Simplification — Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 9 files (modified) + 2 optional (new: `terminal-area.css`, ui-lab surfaces)
**Analogs found:** 9 / 9 (all are modifications of shipped files with strong in-codebase analogs)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/terminal.css` (or extracted `terminal-area.css`) | style | presentation transform | `src/renderer/sidebar.css` (Phase-10 active-card framing) | **exact** — same token system, same surface-card pattern |
| `src/renderer/SessionManager.tsx` | container | CRUD + event-driven | self — the existing `.terminal-area` JSX + ConfirmModal copy branch | **self-analog** (modify existing pattern) |
| `src/renderer/Sidebar.tsx` | component | event-driven | self + `sidebar.css` `.sidebar-row.active` deletion | **self-analog** (remove `↻` block ~334-349) |
| `src/renderer/ContextMenu.tsx` | component | request-response | `SessionManager.tsx` context menu items block (~728-730) | **exact** (ternary arm removal) |
| `src/renderer/IdentityHeader.tsx` | component | presentation | `terminal.css` `.identity-header` + `.row-control` shape | **role-match** (style upgrade, no structural change) |
| `src/renderer/IdleCard.tsx` | component | presentation | `terminal.css` `.idle-card` / `.idle-card-stage` + sidebar active-card framing | **role-match** (framing consistency with live card) |
| `tests/smoke/header-controls.smoke.test.ts` | test | event-driven | `tests/smoke/app-restart-restore.smoke.test.ts` | **role-match** (same WDIO pattern, remove + assert-absent) |
| `tests/smoke/startup-command.smoke.test.ts` | test | event-driven | `tests/smoke/app-restart-restore.smoke.test.ts` | **role-match** (rewrite SC3 to recycle model) |
| `tests/ui-lab/surfaces.ts` | test | batch | self (existing surface entries) | **self-analog** (add entries following existing Surface shape) |

---

## Pattern Assignments

### `src/renderer/terminal.css` → `terminal-area.css` (D-03 card frame)

**Analog:** `src/renderer/sidebar.css` lines 87-94 (Phase-10 active-card framing)

**Active-card frame pattern — the exact lines to mirror for the unified terminal card** (sidebar.css ~87-94):
```css
/* D-05/D-06 ACTIVE card: a filled --surface card with a --line border, a --shadow-pop
 * lift, and a status-colored left edge bar (reads the row's inline --accent). */
.sidebar-row.active {
  background: var(--surface);
  border-color: var(--line);
  border-left: 3px solid var(--accent);
  box-shadow: var(--shadow-pop);
}
```

**How Phase 11 applies this:** the unified terminal card wraps `.terminal-area` (or a new card div around IdentityHeader + `.viewport-stack`) with the same token composition — `background: var(--surface)`, `border: 1px solid var(--line)`, `border-radius: var(--radius)`, `box-shadow: var(--shadow-pop)` — floated on the cream `--bg` with a `var(--space-4)` gutter. No left edge bar (the terminal card is the focal content surface, not a list row).

**Existing terminal-area block (the framing target) — terminal.css ~34-86:**
```css
.terminal-area {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.viewport-stack {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  background: var(--term-bg);
}

.session-view {
  position: absolute;
  inset: 0;
  background: var(--term-bg);
}

.session-view[hidden-pane] {
  visibility: hidden;   /* NEVER display:none — breaks fit()/proposeDimensions() */
  z-index: 0;
}

.session-view .term-mount {
  position: absolute;
  inset: 0;             /* xterm fills this; ResizeObserver is bound HERE */
}

.session-view .xterm,
.session-view .xterm-viewport,
.session-view .xterm-screen {
  width: 100%;
  height: 100%;         /* NEVER apply radius/padding here — no re-fit path */
}
```

**Card frame pattern to author (D-03 / D-03a):** apply gutter + framing to `.terminal-area` (or a new `.terminal-card` wrapper), never to `.viewport-stack`, `.term-mount`, or any `.xterm*` element:
```css
/* D-03: unified session card — the framing wrapper. Floats on the cream --bg.
 * Gutter (--space-4 default, tunable to --space-5/--space-6 via ui-lab RUBRIC).
 * FIDELITY RULE: radius/padding/border on THIS wrapper ONLY — never on
 * .viewport-stack / .term-mount / .xterm* (those have no re-fit path). */
.terminal-area {
  /* Add: */
  padding: var(--space-4);          /* the breathing-room gutter from the cream --bg */
  background: var(--bg);            /* the cream ground the card floats on */
}

.terminal-card {                    /* OR directly on .terminal-area — planner's call */
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-pop);
  overflow: hidden;                 /* masks the container corners, not terminal cells */
}
```

**Danger hover pattern (D-15 precedent — carried from sidebar.css ~294-301):**
```css
/* The Remove control in the live cluster: neutral at rest, danger on hover/focus.
 * color-mix tint wash idiom (same as .row-control-close + context-menu-item-danger). */
.header-remove {
  color: var(--ink-soft);           /* rest: calm, not shouting red */
}
.header-remove:hover,
.header-remove:focus-visible {
  color: var(--color-danger);
  background: color-mix(in oklch, var(--color-danger) 8%, transparent);
  border-color: var(--color-danger);
}
```

**IdleCard stage re-framing (D-03 sibling):** the `.idle-card-stage` background flips from `--term-bg` → transparent once the card wrapper owns the dark ground (or stays on `--bg` if the card wrapper is the light surface). The `.idle-card` already has the correct token shape (terminal.css ~661-674) — only the stage background changes:
```css
/* Before (current): floats on the dark --term-bg gutter */
.idle-card-stage { background: var(--term-bg); }

/* After D-03: the card wrapper owns the surface; the stage is transparent
 * so the unified card ground shows through. */
.idle-card-stage { background: transparent; }
```

**Existing modal card DNA (the reference shape for --radius / --shadow-dialog)** — terminal.css ~204-214:
```css
.modal-dialog {
  width: min(420px, calc(100vw - 48px));
  box-sizing: border-box;
  padding: 22px 24px 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);      /* 18px — the card family radius */
  box-shadow: var(--shadow-dialog);
  font-family: var(--font-ui);
  color: var(--ink);
}
```

---

### `src/renderer/SessionManager.tsx` — D-01 deletion + D-04 agent-aware copy

**Analog:** self — the existing `ConfirmModal` body block (~698-716) and context-menu ternary (~728-730).

**Deletion site 1 — context-menu Restart ternary (~728-730):**
```tsx
/* CURRENT (to modify): */
menuIsDormant
  ? { label: 'Start', onSelect: () => handleStart(menuState.id) }
  : { label: 'Restart', onSelect: () => handleRestart(menuState.id) },  // ← remove this arm

/* AFTER D-01: live (non-dormant) rows offer no Restart in the menu.
 * Drop the ternary entirely for live rows, OR make it a no-entry (planner's call). */
menuIsDormant
  ? { label: 'Start', onSelect: () => handleStart(menuState.id) }
  : null,  // or simply omit from the items array
```

**Deletion site 2 — `onRestart` prop on `<Sidebar>` (~636):**
```tsx
/* Remove this prop: */
onRestart={handleRestart}
/* handleRestart (~235-246) stays as dead code, flagged: */
// D-01: retained machinery, no UI entry point.
```

**D-04 agent-aware confirm copy — the authored pattern (~698-716, add escalation branch):**
```tsx
/* CURRENT body (to extend, not replace): */
body={
  removeMode === 'delete'
    ? 'This permanently deletes the saved session — its recipe is gone for good.'
    : closingSession?.configured === true
      ? 'This ends its running process and moves the session to the Inactive List. You can start it again later.'
      : closingIsRunning
        ? 'This ends its running process and removes the session.'
        : 'This removes the session from the sidebar.'
}

/* AFTER D-04 (agent-aware escalation prefix): */
const idleBody =
  removeMode === 'delete'
    ? 'This permanently deletes the saved session — its recipe is gone for good.'
    : closingSession?.configured === true
      ? 'This ends its running process and moves the session to the Inactive List. You can start it again later.'
      : closingIsRunning
        ? 'This ends its running process and removes the session.'
        : 'This removes the session from the sidebar.';

const agent = closingSession?.agentState;   // renderer-only overlay; no IPC, no persist
const escalation =
  agent === 'working'
    ? "Claude is still working in this session — closing it now will end the task mid-run. "
    : agent === 'waiting'
      ? "This session is waiting for your input — closing it now will discard what it's asking for. "
      : '';
const body = escalation + idleBody;  // prefix so the consequence is never lost

// Pass computed body into <ConfirmModal body={body} ... />
```

**ConfirmModal stays a dumb controlled component** — receives `body` as a prop, no branch logic inside it. Pattern confirmed from terminal.css `.modal-body` (lines 223-228):
```css
.modal-body {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-soft);
}
```

---

### `src/renderer/Sidebar.tsx` — D-01 restart-button removal

**Deletion site — the `↻` block (~334-349):**
```tsx
/* DELETE this entire block: */
{!running && !dormant && (
  <button
    type="button"
    className="row-control"
    data-testid="restart-session"
    data-action="restart"
    title="Restart session"
    aria-label={`Restart ${s.name}`}
    onClick={(e) => {
      e.stopPropagation();
      onRestart(s.logicalId);
    }}
  >
    <span aria-hidden="true">↻</span>
  </button>
)}
```

Also remove the `onRestart` prop from `SortableRowProps` / `SidebarProps` interfaces and the comment block at ~132-135 / ~315-317 referencing the Restart affordance.

**Existing button shape to keep for surviving controls** (sidebar.css + terminal.css `.row-control`):
```css
/* The 24×24 radius-7 footprint — kept for Start ▶ and Remove ✕ controls: */
.row-control {
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.row-control:hover { background: var(--bg-sunk); color: var(--ink); }
.row-control:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
```

---

### `src/renderer/IdentityHeader.tsx` — D-03 cap of the unified card; Remove restyle to danger ramp

**Existing header control shapes** (terminal.css ~450-514 — carry verbatim, add danger ramp to Remove):
```css
/* Clear: text-labelled pill (always keep this shape) */
.identity-header .header-control-clear {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-soft);
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}
.identity-header .header-control-clear:hover { background: var(--bg-sunk); color: var(--ink); }

/* Row-control glyph shape (for Remove ✕ — same shape as the sidebar ▶/✕) */
.identity-header .row-control {
  width: 24px; height: 24px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 7px; border: 1px solid transparent;
  background: transparent; color: var(--ink-soft);
  font-size: 14px; line-height: 1; cursor: pointer;
}
```

**Add Remove danger ramp (D-15 pattern from sidebar.css):**
```css
/* NEW — mirrors sidebar .row-control-close / context-menu-item-danger */
.identity-header .row-control-close:hover,
.identity-header .row-control-close:focus-visible {
  color: var(--color-danger);
  background: color-mix(in oklch, var(--color-danger) 8%, transparent);
  border-color: var(--color-danger);
}
```

**Always-visible cluster** (terminal.css ~439-445 — carry verbatim):
```css
.identity-header .header-controls {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;     /* var(--space-1) */
  margin-left: auto;
}
```

---

### `src/renderer/SessionView.tsx` — ResizeObserver re-fit seam (READ-ONLY reference; do not modify)

**The fidelity-safe re-fit mechanism** (SessionView.tsx ~573-587 — confirmed O-2 resolution):
```ts
// The existing wiring — do NOT add a second fit path on top of this.
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
const onResize = (): void => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (fit.proposeDimensions()) {   // guard: no-op on zero/hidden geometry
      fit.fit();
      window.api.ptyResize(id, term.cols, term.rows);
    }
  }, RESIZE_DEBOUNCE_MS);
};
const resizeObserver = new ResizeObserver(onResize);
resizeObserver.observe(container);   // container = mountRef.current = .term-mount
window.addEventListener('resize', onResize);
```

**Rule:** the card padding/gutter must be applied to a wrapper ABOVE `.term-mount` so the ResizeObserver fires automatically on layout reflow. Never put border-radius/padding on `.term-mount` or `.xterm*` elements — that path has no re-fit and clips glyphs.

---

### `tests/smoke/header-controls.smoke.test.ts` — update restart assertion

**Analog pattern** — the existing `header-restart` absent assertion already in the file (~109):
```ts
/* KEEP this existing pattern (already correct): */
expect(await hasTestId('header-restart')).toBe(false);

/* ADD alongside it — the context-menu Restart item must also be absent: */
await openContextMenu(id);
const labels = await contextMenuLabels();
expect(labels).not.toContain('Restart');
await pressEscape();

/* REMOVE the Restart-driving block (~144-170) — replace the clickMenuItem('Restart')
 * section with the absence assertion above. */
```

**WDIO helper shape** (from surfaces.ts ~243-249 — the contextMenuLabels utility):
```ts
async function contextMenuLabels(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>('.context-menu-item'),
    ).map((el) => (el.textContent ?? '').trim()),
  );
}
```

---

### `tests/smoke/startup-command.smoke.test.ts` — rewrite SC3 to recycle model

**SC3 was:** drive `menuAction(id, 'Restart')` → assert `— restarted —` separator.

**SC3 after D-05 (recycle model):** drive Remove → Inactive List → Start ▶ → assert the SAME startup-command re-runs via `handleStart` (fresh process, no separator).

**Pattern to copy from surfaces.ts `inactive-recipes` surface (~533-576):**
```ts
// Remove a configured live session → keeps recipe → Inactive List
await openContextMenu(idR);
await waitForTestId('context-menu');
await clickMenuItem('Remove');
await waitForTestId('confirm-modal');
await clickByTestId('confirm-close');   // confirm-close = the confirm (not cancel) button
await waitForTestIdGone('confirm-modal');
// Assert row moved to Inactive List
await browser.waitUntil(
  async () => browser.execute((sid: string) => {
    const container = document.querySelector('[data-testid="inactive-list"]');
    return !!container?.querySelector(`.sidebar-row[data-session-id="${sid}"]`);
  }, idR),
  { timeout: 8000, interval: 150, timeoutMsg: 'recipe row did not move into Inactive List' }
);
// Then click the dormant Start ▶ and assert the startup command re-runs
```

---

### `tests/ui-lab/surfaces.ts` — add two new surfaces (Discretion, recommended)

**Existing Surface shape** (surfaces.ts ~36-47 — copy exactly):
```ts
export interface Surface {
  id: string;
  title: string;
  designRefs: string[];
  expects: string;
  prepare: (ctx: SurfaceContext) => Promise<void>;
  available?: (ctx: SurfaceContext) => Promise<{ ok: boolean; reason?: string }>;
  cleanup?: (ctx: SurfaceContext) => Promise<void>;
}
```

**New surface 1 — `terminal-card`** (framed live card after D-03):
```ts
{
  id: 'terminal-card',
  title: 'Unified framed session card (UI-03, Phase 11)',
  designRefs: [
    'DESIGN.md §Aesthetic direction (18px card, breathing room)',
    '11-UI-SPEC.md §Interaction Contract (live unified card)',
  ],
  expects:
    'Active terminal reads as ONE framed, rounded card on cream --bg: ' +
    'header cap (--surface) + charcoal terminal body; gutter visible; ' +
    'no glyph clipped by corner; Clear + Remove cluster always visible; no Restart.',
  prepare: async (ctx) => {
    // Ensure a running session is active (reuse ctx.ids[0] from terminal-running)
    await clickSidebarRow(ctx.ids[0]);
    await browser.pause(400);
  },
},
```

**New surface 2 — `agent-busy-confirm`** (D-04 escalated modal):
```ts
{
  id: 'agent-busy-confirm',
  title: 'Agent-busy Remove confirm modal (D-04, escalated copy)',
  designRefs: [
    '11-UI-SPEC.md §Copywriting Contract (confirm-modal copy)',
    'DESIGN.md §Design tokens (--radius, --shadow-dialog)',
  ],
  expects:
    'The Remove confirm modal for an agent=working session shows the ' +
    'escalated copy prefix ("Claude is still working...") before the ' +
    'normal consequence sentence. Modal chrome is the same 18px card family.',
  prepare: async (ctx) => {
    const id = ctx.ids[0];
    // Poke data-agent='working' via the same deterministic styling-seam pattern
    // used by sidebar-waiting (surfaces.ts ~479-484)
    await browser.execute((sid: string) => {
      document.querySelector<HTMLElement>(
        `.sidebar-row[data-session-id="${sid}"]`
      )?.setAttribute('data-agent', 'working');
      // Also set it on the session record so SessionManager reads it for the copy branch.
      // NOTE: if agentState is renderer-state only, a direct DOM poke is insufficient;
      // the planner must decide whether to expose a test seam on SessionManager's state
      // or drive it via a real agent emission.
    }, id);
    await clickByTestId('header-remove');
    await waitForTestId('confirm-modal');
    await browser.pause(300);
  },
  cleanup: async (ctx) => {
    await clickByTestId('confirm-cancel');
    await waitForTestIdGone('confirm-modal');
    await browser.execute((sid: string) => {
      document.querySelector<HTMLElement>(
        `.sidebar-row[data-session-id="${sid}"]`
      )?.removeAttribute('data-agent');
    }, ctx.ids[0]);
  },
},
```

> **Planner note on `agent-busy-confirm` seam:** `agentState` is renderer-only state in the `sessions` array, not a DOM attribute. The `sidebar-waiting` seam only proves CSS styling. For D-04 evidence the planner must either (a) extract the body-builder into a pure function and unit-test it directly (the simpler path — a unit test for the `body = escalation + idleBody` branch is sufficient per the nyquist map), or (b) drive via a real `claude --rc` agent run. The ui-lab surface above is a VISUAL confirmation that the modal chrome renders correctly; the copy branch test is a unit test.

---

## Shared Patterns

### Tokens-first (cross-cutting — ALL CSS changes)

**Source:** `src/renderer/tokens.css` (guarded by `tokens-completeness.test.ts`)

**Apply to:** every new CSS rule in terminal.css / terminal-area.css

Rule: use `var(--token-name)` for every authored value that maps to the token scale. No literal `#hex`, `px` values that are not `--space-*` steps, or bare `oklch()` calls. Tokens-completeness guard bans literals in authored CSS.

```css
/* Pattern: var() only */
border-radius: var(--radius);          /* 18px — the card family */
box-shadow: var(--shadow-pop);         /* the surface-card lift */
background: var(--surface);           /* white card face */
border: 1px solid var(--line);        /* the hairline border */
padding: var(--space-4);              /* 16px gutter */
gap: var(--space-1);                  /* 4px control cluster gap */
color: var(--color-danger);           /* danger ramp */
```

### Danger ramp (cross-cutting — Remove affordances)

**Source:** `src/renderer/terminal.css` lines 313-325 (`.context-menu-item-danger`) + sidebar.css implied by D-15

**Apply to:** the `header-remove` control in `IdentityHeader`, the context-menu Remove item (already has `.context-menu-item-danger`)

```css
.context-menu-item-danger { color: var(--color-danger); }
.context-menu-item-danger:hover,
.context-menu-item-danger:focus-visible {
  background: color-mix(in oklch, var(--color-danger) 8%, transparent);
  color: var(--color-danger);
}
```

### Focus ring (cross-cutting — all interactive controls)

**Source:** `src/renderer/terminal.css` (throughout — `.edit-input:focus-visible`, `.row-control:focus-visible`, etc.)

**Apply to:** every `<button>` and `<input>` in this phase's surfaces

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;  /* or 2px for buttons */
}
```

### visibility:hidden (never display:none for terminal panes)

**Source:** `src/renderer/terminal.css` lines 62-65 + the `[hidden-pane]` rule

**Apply to:** any new wrapper or layout change around `.session-view` / `.term-mount`

```css
/* NEVER: display:none — breaks fit()/proposeDimensions() */
/* ALWAYS: */
.session-view[hidden-pane] { visibility: hidden; z-index: 0; }
.session-view.active       { visibility: visible; z-index: 1; }
```

### React text-node safety (no dangerouslySetInnerHTML)

**Source:** all existing JSX in IdentityHeader, IdleCard, ConfirmModal

**Apply to:** the D-04 escalation strings in `SessionManager.tsx`

All user strings (`name`, `agentState`-driven copy) must be interpolated as React text nodes (template literals or ternaries into JSX text content), never via `dangerouslySetInnerHTML`. The existing ConfirmModal body prop pattern uses a string prop passed as `{body}` text content — follow that exactly.

---

## No Analog Found

No files in this phase are greenfield without a codebase analog. Every modification has a strong in-codebase precedent.

---

## Metadata

**Analog search scope:** `src/renderer/` (all CSS + TSX), `tests/smoke/`, `tests/ui-lab/`, `.planning/phases/10-sidebar-visual-polish/`

**Files scanned:** `terminal.css` (873 lines), `sidebar.css` (~600 lines), `SessionManager.tsx` (~760 lines, lines 169-260 and 630-760), `Sidebar.tsx` (lines 314-355), `SessionView.tsx` (lines 565-645), `tests/ui-lab/surfaces.ts` (597 lines)

**Pattern extraction date:** 2026-06-13
