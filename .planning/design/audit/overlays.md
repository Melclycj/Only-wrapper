# Overlay UI (Search + ContextMenu) — Design Audit

> Cluster: TRANSIENT OVERLAY UI. Files audited in full: `src/renderer/SearchBar.tsx`,
> `src/renderer/ContextMenu.tsx`; supporting `src/renderer/viewport-clamp.ts`,
> `src/renderer/search-recompute.ts`; CSS in `src/renderer/terminal.css` (search),
> `src/renderer/form.css` (context-menu); wiring in `SessionView.tsx` (search focus) +
> `SessionManager.tsx` (menu items). Truth = `src/renderer/tokens.css`.
> Read-only audit — no `src/` files modified.

These are two small, mostly-disciplined surfaces. The keyboard + focus-restore a11y
story (the usual graveyard) is **genuinely solid here** — so this audit is mostly P1
token/states polish, not P0 firefighting. One real P0 (no disabled affordance + menu
roving-focus has a gap), the rest is quality.

## Pillar scores

| Pillar | Score /5 | Verdict |
|---|---|---|
| 1. Hierarchy | 4 | Clear. Search count muted vs input; danger item color-separated. Loses 1: no separator isolating the destructive menu item from safe items. |
| 2. Spacing & Rhythm | 3 | ContextMenu is token-clean (`--space-*`/`--radius-xl`). SearchBar hardcodes every px (`top/right/gap/padding/radius`) — the exact `--space-*` DEFINED-NOT-APPLIED drift the brief flagged. |
| 3. Color & Semantics | 5 | Token-perfect. `--color-accent` for active/focus, `--color-danger` + 8% color-mix for destructive, `--ink-faint` (not red) for no-match. Decoration colors deliberately RGBA for a real xterm-parse reason (documented). |
| 4. Typography | 4 | Deliberate: mono input (terminal literal), Nunito 12/700 count. Loses 1: count is not `tabular-nums`, so "1 of 9"→"10 of 12" reflows the cluster width. |
| 5. States & Interaction | 3 | Hover/focus/active all designed. But prev/next have NO disabled state at 0 matches (still clickable, no visual cue), and the active "Aa" lacks `aria-pressed`-driven contrast beyond an 8% tint. |
| 6. Consistency & Accessibility | 4 | Strong: autofocus, focus-restore-to-terminal on close, Esc + outside-click, roving arrows, aria-live count. Loses 1: menu roving-focus has a containment hole + missing `aria-orientation`/`separator`; danger item not arrow-skippable-distinct. |

## Findings

### [P0] Prev/Next/Aa controls have no disabled affordance when there are 0 matches
- Pillar 5 (States) · `src/renderer/SearchBar.tsx:201-209`, `:279-311`; CSS `src/renderer/terminal.css:105-131`
- What: `handleNext`/`handlePrev` early-return only on empty *query* (`query.length === 0`), not on `matchState.count === 0`. With a non-empty query that matches nothing ("No matches"), both `‹`/`›` buttons render fully enabled, hover-lift, and are clickable — they just silently no-op (the addon find on a 0-match term does nothing). No `disabled` attr, no `:disabled` CSS rule exists anywhere in the cluster.
- Why it matters: a control that looks active but does nothing is a broken affordance — the user clicks "next" on "No matches" and gets no feedback. Discoverability + a11y miss (screen-reader users get an enabled button with no state).
- Fix: when `matchState.count === 0` (or `query` empty), set `disabled` on `search-prev`/`search-next` and add a `.search-control:disabled { opacity:.4; cursor:default; pointer-events:none; }` rule. Keep the existing guard as belt-and-braces.

### [P0] ContextMenu roving focus can land outside the menu / no focus containment
- Pillar 6 (A11y) · `src/renderer/ContextMenu.tsx:93-108`
- What: Arrow handling only fires on `ArrowDown`/`ArrowUp`. There is no `Tab` containment — pressing Tab inside the open menu moves focus to whatever is behind it (the menu is `role="menu"` but not a focus trap). Also `Home`/`End` are unhandled (minor), and if `document.activeElement` is not a menu button (`indexOf` → -1), `base = 0` is a reasonable fallback but the menu never re-asserts focus if the user clicks the menu chrome (the `<div>` gap) — focus escapes to `<body>` and arrows go dead.
- Why it matters: `role="menu"` sets the WAI-ARIA expectation of a contained, fully keyboard-driven widget. Tab escaping a menu (while it stays visually open) is a classic menu a11y failure. P0 per the brief's "menu not keyboard-navigable" bar — it IS navigable by arrows, but containment is incomplete.
- Fix: in `onKeyDown`, also intercept `Tab` (preventDefault + roving like arrows, or close-on-Tab), and handle `Home`/`End`. Optionally make the menu `<div>` `tabIndex={-1}` and refocus it on stray clicks so arrows never go dead.

### [P1] SearchBar overlay occludes the first lines of live terminal output
- Pillar 1 (Hierarchy) · `src/renderer/terminal.css:47-62` + `src/renderer/terminal-area.css:75-110`
- What: `.search-bar` is `position:absolute; top:8px; right:8px; z-index:5`, pinned to the top-right of the terminal well (well has `padding: var(--space-3)` charcoal inner gutter). It floats OVER the xterm content, so the top-right rows of output — exactly where `claude --rc` / `codex` banners and the freshest streamed lines land — sit behind the bar while searching. There is no scroll-offset, no top-anchored push, and no relocate-on-collision.
- Why it matters: Core Value is terminal fidelity; obscuring the newest output during a find is a real, if transient, content occlusion. VS Code mitigates this by letting the bar be dragged / the editor isn't the live tail; here the live tail is the whole point.
- Fix: acceptable as-is for v1.1 (small bar, top-right is usually whitespace on first open), but level-up: shift the bar's anchor down by the well's top padding so it clears the very first line, or add a subtle backdrop so occluded glyphs aren't half-readable. P1, not blocking.

### [P1] SearchBar hardcodes spacing/radius literals instead of the defined tokens
- Pillar 2 (Spacing) · `src/renderer/terminal.css:49-59,67-68,88-90,105-112`
- What: `.search-bar` uses `top:8px; right:8px; gap:4px; padding:6px 8px; border-radius:10px`; `.search-input` `padding:6px 8px; border-radius:8px`; `.search-count` `padding:0 2px`; `.search-control` `border-radius:7px`. Every one of these has an exact token: 8→`--space-2`, 4→`--space-1`, 6→`--space-1_5`, 2→`--space-0_5`; 10→`--radius-lg`, 8→`--radius-md`, 7→`--radius-sm`. The sibling `.context-menu` (form.css:127-154) already consumes `var(--space-*)`/`var(--radius-xl)`/`var(--radius-md)` — so two sibling overlays apply tokens inconsistently.
- Why it matters: tokens.css §13 explicitly calls `--space-*` "DEFINED-NOT-APPLIED, Phases 10–13 consume it." This is a Phase-10–13 surface that didn't migrate, leaving literal drift between adjacent overlays and undermining the single-source-of-truth.
- Fix: replace the literals with the matching `--space-*` / `--radius-*` tokens (1:1, value-preserving). Pure token swap, zero visual change.

### [P1] Match-count is not tabular — the cluster width jitters as you page matches
- Pillar 4 (Typography) · `src/renderer/SearchBar.tsx:271-278` + `src/renderer/terminal.css:88-96`
- What: `.search-count` is Nunito (proportional) 12/700 with `min-width:1ch` and `white-space:nowrap`. As the index rolls 9→10 or count 9→12, the glyph widths differ, so the count box and everything right of it (the `‹ › Aa ✕` cluster) shift horizontally on every next/prev.
- Why it matters: a counter that visibly reflows while you hold "next" reads as jitter — the brief specifically called out "tabular alignment" for the "3/12" micro-type.
- Fix: add `font-variant-numeric: tabular-nums;` to `.search-count` (and consider `font-feature-settings:"tnum"`). Optionally widen `min-width` to a few ch so the box never resizes.

### [P1] No separator before the destructive Remove/Delete menu item
- Pillar 1 (Hierarchy) · `src/renderer/SessionManager.tsx:721-754` + `src/renderer/ContextMenu.tsx:119-135` + `src/renderer/form.css:127-174`
- What: the items array appends the danger item (Remove/Delete) into the same flat `flex column` with the uniform `gap: var(--space-0_5)`. The only separation from "Edit / Start / Start without command" is the red text color. No `role="separator"` / `<hr>` / margin gap before the destructive item.
- Why it matters: destructive actions should be visually quarantined (separator + spacing) so a fast right-click→arrow→Enter can't fat-finger Remove. Red text alone is weak isolation, and is invisible to anyone with red-deficient vision who relies on layout.
- Fix: insert a 1px `--line` divider (with `--space-0_5` margin) before the first `danger` item, or bump its `margin-top`. Add `role="separator"` for AT. Low effort, real safety win.

### [P2] Active "Aa" toggle leans on an 8% tint that is easy to miss
- Pillar 5 (States) · `src/renderer/terminal.css:136-141` + `src/renderer/SearchBar.tsx:299-311`
- What: `.search-case-active` = `--color-accent` border + `color-mix(...8%, transparent)` fill + accent text. `aria-pressed` is correctly set, but the 8% wash on a white bar is subtle; on a glance the on/off state is hard to read.
- Why it matters: case-sensitivity silently changes results; the toggle's engaged state should be unambiguous.
- Fix: raise the active fill to ~12–16%, or invert (accent fill + surface glyph) like a real pressed pill. Keep `aria-pressed`.

### [P2] Menu opens with no entrance motion; `--duration-fast` token unused here
- Pillar 5 (States) · `src/renderer/ContextMenu.tsx:110-118` + `src/renderer/form.css:127-140`
- What: the menu measures-then-clamps (good — no flash at wrong spot), but appears instantly with no fade/scale. The codebase ships `--duration-fast 120ms` + `--ease-standard`.
- Why it matters: a 120ms opacity/scale-from-cursor on a context menu is a cheap perceived-quality win and reads as intentional.
- Fix: add a `@media (prefers-reduced-motion: no-preference)` 120ms `opacity`+`transform: scale(.98→1)` entrance, transform-origin at the cursor. Compositor-friendly only.

## Token drift vs truth

| Literal | file:line | Correct token |
|---|---|---|
| `top: 8px` / `right: 8px` | terminal.css:49-50 | `--space-2` |
| `gap: 4px` | terminal.css:55 | `--space-1` |
| `padding: 6px 8px` (.search-bar) | terminal.css:56 | `--space-1_5 --space-2` |
| `border-radius: 10px` (.search-bar) | terminal.css:59 | `--radius-lg` |
| `padding: 6px 8px` (.search-input) | terminal.css:68 | `--space-1_5 --space-2` |
| `border-radius: 8px` (.search-input) | terminal.css:76 | `--radius-md` |
| `padding: 0 2px` (.search-count) | terminal.css:90 | `0 --space-0_5` |
| `border-radius: 7px` (.search-control) | terminal.css:112 | `--radius-sm` |
| `outline-offset: 1px` (search focus rings) | terminal.css:82,130 | (no token; matches `--space-0_5`/2 family — leave or tokenize) |

> Note: all colors, shadows (`--shadow-pop`/`--shadow-menu`), fonts, and the context-menu
> spacing/radius are token-clean and CORRECT. Drift is isolated to SearchBar's geometry literals.

## Upgrade opportunities

1. **Disabled-aware nav cluster (ships the P0 fix as polish):** when 0 matches, dim+disable `‹ ›`; when 1 match, dim them too (nothing to page to). Gives the bar a real "dead-end" state instead of silent no-ops.
2. **Tabular, fixed-width count box:** `tabular-nums` + a min-width sized to the widest expected count, so the `‹ › Aa ✕` cluster is rock-steady while paging — a hallmark of a polished find bar.
3. **Destructive-item quarantine in the menu:** `--line` separator + extra `margin-top` before Remove/Delete, plus a slightly stronger danger hover (current 8% → ~12%). Turns "red text only" into proper destructive isolation.
4. **120ms cursor-origin entrance on the context menu** (reduced-motion gated) — the codebase already defines the motion tokens; this is the single biggest perceived-quality lift on these two surfaces.
5. **Token-migrate SearchBar** to `--space-*`/`--radius-*` (1:1) so the two overlays are governed by one source of truth and Phase-10–13's DEFINED-NOT-APPLIED debt is closed for this surface.
