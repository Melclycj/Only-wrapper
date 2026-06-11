# Phase 10: Sidebar Visual Polish - Research

**Researched:** 2026-06-11
**Domain:** Electron-renderer CSS / React component restyle (presentation-only) over a locked design-token system
**Confidence:** HIGH (all sources are the project's own code + locked planning docs; no external library decisions required)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from 10-CONTEXT.md `<decisions>`)

**Row anatomy — the name-crush fix (Gap 1)**
- **D-01: Two-line row.** Line 1 = session name at full width (ellipsis on overflow); line 2 = small secondary line. DESIGN.md's sanctioned SessionCard anatomy (icon + name + status … + cwd/host secondary). Accepted cost: ~40% taller rows.
- **D-02: Controls are hover/keyboard-focus-revealed only — including the active row.** No width reserved: edit ✎ / close ✕ float over the row's right end on hover or `:focus-visible` (keyboard a11y required). Right-click context menu remains the full control surface. **Exception (6.1 D-06 honored):** the Inactive-entry Start ▶ stays always-visible (D-13); start-no-cmd + Delete follow hover-reveal.
- **D-03: Secondary line content = status + cwd tail.** Live rows: `● Running · Marketing-parlour-room` — cwd shows only its last path segment, truncated when long; sessions without a cwd show status only. Inactive recipe cards show the **startup command** as the secondary detail, falling back to cwd, else status word only.
- **D-04: Large icon tile spanning both lines.** ~32-36px rounded tile, vertically centered — the row's visual anchor. Must keep rendering all three `SessionIconSpec` kinds (emoji | preset | color badge) via the single `renderIcon` source in Sidebar.tsx. Collapsed rail reuses the same tile styling for expanded/collapsed continuity.

**Active session distinction (SC1 "unmistakable")**
- **D-05: Active = filled card + left accent edge bar.** Active row becomes a filled surface card (white bg + border + soft shadow lift, e.g. `--shadow-pop`-tier) with a ~3-4px accent bar on its left edge. Non-active rows sit flat/transparent on the rail bg.
- **D-06: The accent follows the session's status color** — running blue / waiting amber / error red / finished green — via the existing per-row inline `--accent` custom-property mechanism (`status-colors.ts presentation()`). Not fixed brand blue: active+waiting must read amber at a glance.
- **D-07: Collapsed rail uses the same language.** Active icon tile = filled/lifted + a status-color bar on the rail's left edge. Switching collapse modes keeps the active marker visually continuous.

**5-state status presentation (SC2)**
- **D-08: Secondary-line status = colored dot + word, no tint pill.** Calm low-contrast chrome: dot carries the color, word in `--ink-soft`. Status loudness delegated to the active edge bar (D-06) and the waiting treatment (D-09).
- **D-09: Waiting gets a row-level amber treatment — on non-active rows too.** Light amber tint wash across the row + amber left edge bar (same bar slot as D-05, so a non-active waiting row also carries a bar) + secondary line flips to `● Waiting for you`. Static — no pulsing/animation. Collapsed rail mirrors it (amber edge bar on that tile). Rides the existing agent-state overlay (`presentation(status, agent)` — amber only while running, per locked Phase-6 D-06/D-07 contract).
- **D-10: Collapsed-rail status dot: keep bottom-right position (proven NAV-01 mechanism), enlarge to ~10px with a thicker `--surface` ring** so it floats off the icon. No whole-tile status tint (would fight user-chosen color-badge icons).

**Inactive List + rail structure (Gap 5)**
- **D-11: Inactive rows = dashed-border "recipe" cards.** Same dashed language as the existing `+ Add session` button. Two-line layout retained (secondary = startup command per D-03). Cross-section drag-reorder must stay intact (one SortableContext).
- **D-12: Section labels = small caps + count.** `WORKING AREA · 2` / `INACTIVE · 3`, `--ink-faint`, letter-spaced; hairline divider between sections; labels stay hidden in collapsed mode. Empty Inactive section stays unrendered.
- **D-13: Inactive Start ▶ = circular ghost button** (thin outline ▶) at the card's right end, filling to accent-blue solid on hover. Always visible; pairs with the eggshell metaphor.

**Definite fixes folded in (from 09-HUMAN-UAT Gap 4 — no design debate)**
- **D-14: Context menu position fix** — must open at the cursor without overlapping the sidebar header (clamp to viewport; investigate the current mispositioning root cause).
- **D-15: Remove menu item styled in the danger ramp** (`--color-danger`), consistent with the destructive Delete affordance. Full app-wide danger/interaction sweep remains P13.

### Claude's Discretion (verbatim)
- Exact row heights, paddings, gaps — retune onto the `--space-*` scale; odd-ball 5/14/22px values snap to the nearest step.
- Edge-bar exact width (3 vs 4px), tint wash strengths, dot ring thickness, shadow tier — tuned through the ui-lab look→edit→re-look loop against DESIGN-RUBRIC.md.
- Drag-handle treatment under the hover-reveal policy (follow the same reveal pattern; keep dragging-state visuals working).
- Name/cwd truncation mechanics (ellipsis vs middle-truncate for cwd tails).
- Whether to extract sidebar styles from `terminal.css` into a `sidebar.css` (sanctioned by 09-CONTEXT deferred items; planner's call — counts toward the >800-line debt paydown).
- Whether to add new ui-lab surfaces (e.g. a waiting-state or inactive-list capture) to `tests/ui-lab/surfaces.ts` for evidence of D-09/D-11.

### Deferred Ideas (OUT OF SCOPE)
- App-wide hover/focus/active consistency + full danger-ramp sweep → Phase 13 (UI-06); this phase only does the sidebar's own reveal affordances + the Remove danger color.
- Terminal pane framing (Gap 2) → Phase 11. Save-button accent (Gap 3) → Phase 12.
- Empty/loading/error state design (incl. WelcomeEmptyState restyle) → Phase 13 (UI-05).
- Sidebar width resize / user density settings → v2 (APPR-02 territory).
- The 5 keyword-matched todos (folder picker SESS-06, Start discoverability SESS-07, edit prefill SESS-05, code-review debt DEBT-01/02) are NOT folded — each owned by a later phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-02 | The session sidebar (expanded and collapsed) presents a clear visual hierarchy — icon, name, and the 5-state status are legible and intentionally styled, and the active session is unmistakably distinguished. | Entirely satisfiable in `Sidebar.tsx` (row JSX restructure) + `terminal.css` (sidebar block ~L23-402) + `ContextMenu.tsx`/`SessionManager.tsx` (D-14/D-15). All tokens already exist in `tokens.css`. The per-row `--accent` inline channel + `presentation()` resolver already feed the status color D-06/D-09 ride on. No new data, no IPC, no bridge key. |
</phase_requirements>

## Summary

Phase 10 is a **renderer-only CSS + JSX restyle** of one component family — the session sidebar — composed entirely from the Phase-9 token foundation. Every needed token (`--space-*`, `--accent-*`, `--radius-*`, `--shadow-*`, `--ink-*`, `--font-ui`, `--color-danger`) already exists in `src/renderer/tokens.css`; the `--space-*` scale was deliberately defined-not-applied in Phase 9 expressly so this phase becomes its first consumer. The per-row inline `--accent` custom property and the `presentation(status, agent)` resolver (`status-colors.ts`) already supply the status color the active edge bar (D-05/D-06) and waiting wash (D-09) ride on — **zero new plumbing**. There is no library decision to make and no external dependency to add; this is composition work, not architecture.

The work concentrates in three files: `Sidebar.tsx` (two-line row restructure, large icon tile, hover-reveal controls, dashed recipe cards, section labels with counts), `terminal.css` (all the sidebar visual rules, ~L23-402 — optionally extracted to `sidebar.css`), and `ContextMenu.tsx` + `SessionManager.tsx` (D-14 viewport clamp, D-15 danger ramp). The single hard constraint is the **smoke/ui-lab selector contract**: a large set of tests select `.sidebar-row[data-session-id]`, `.row-name`, `.status-badge`, `.collapsed-status-dot`, `[data-testid="..."]`, and the section containers `working-area` / `inactive-list`. Any markup restructure MUST preserve these selectors or update the tests in the same plan (the Rule-1 discipline). Verification is the ui-lab loop — no visual claim without a packaged-capture.

**Primary recommendation:** Do all geometry/color in `terminal.css` (or a new `sidebar.css`) consuming existing `tokens.css` tokens via `var()`; keep `.sidebar-row`, `.row-name`, `.status-badge`, `.collapsed-status-dot`, all `data-testid`s, and the `working-area`/`inactive-list` containers intact; add a `.row-secondary` line and a `.row-meta` text block inside the existing row; reuse the per-row inline `--accent` for the D-05 left edge bar via `border-left-color` / `box-shadow` and the D-09 amber wash via `color-mix(in oklch, var(--accent) N%, transparent)`; fix D-14 by clamping `menuState.x/y` against `window.innerWidth/innerHeight` and the menu's measured size. Drive the whole thing through the ui-lab `look→edit→re-look` loop, finishing every claim with a packaged no-injection capture.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sidebar visual hierarchy (icon/name/status, active distinction) | Renderer (React + CSS) | — | Pure presentation; the data (status, name, icon, cwd) already arrives on the `SessionRecord` rows. |
| Status → color/label resolution | Renderer (`status-colors.ts` pure module) | — | Already exists; `presentation()` is the single resolver. D-06/D-09 reuse it; do NOT add a parallel status path. |
| Per-row accent channel (edge bar / wash color) | Renderer (inline `--accent` style prop) | CSS (`var(--accent)`) | Already wired on every row's `.status-dot`/`.collapsed-status-dot`; D-05/D-09 consume the same channel. |
| Context-menu positioning | Renderer (`ContextMenu.tsx` + `SessionManager` menuState) | — | Viewport clamp is a client-side layout calculation; no main-process involvement. |
| Drag-to-reorder geometry (after taller rows) | Renderer (dnd-kit in `Sidebar.tsx`) | — | Activation distance + overlay are renderer concerns; main only persists the resulting order (unchanged). |
| Session data (status, cwd, startupCommand, name, icon) | Main process (authoritative) | Renderer (read-only display) | UNTOUCHED this phase — the xterm/PTY data path + the 20-key bridge surface (`EXPECTED_API_KEYS`) stay frozen. |

## Standard Stack

No new packages. This phase consumes only what is already installed and already imported.

### Core (already present, consumed not added)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | Row JSX restructure (two-line layout, recipe cards) | Already the renderer framework. [CITED: CLAUDE.md Technology Stack] |
| @dnd-kit/core + @dnd-kit/sortable | 6.3.1 / 10.0.0 (exact-pinned) | Drag-to-reorder; taller rows change row geometry — verify overlay + 5px activation distance still feel right | Already wired; one SortableContext spans both buckets. [VERIFIED: codebase — Sidebar.tsx imports + STATE.md Phase 05 decision] |
| `tokens.css` (`:root` layer) | Phase 9 artifact | Single source of truth for every value this phase applies | Phase 9 deliverable; `--space-*` defined-not-applied for exactly this consumer. [VERIFIED: codebase — src/renderer/tokens.css] |
| `status-colors.ts` (`presentation()`) | project module | status/agent → `{ label, accent }`; feeds the D-06/D-09 accent | Single resolver; overlay-only-while-running contract locked Phase 6. [VERIFIED: codebase — src/renderer/status-colors.ts] |

### Supporting (CSS techniques, all natively supported by Electron's Chromium)
| Technique | Purpose | When to Use |
|-----------|---------|-------------|
| `color-mix(in oklch, var(--accent) N%, transparent)` | D-09 amber tint wash; danger/start hover washes (precedent already in terminal.css L186/195/557) | Wash backgrounds keyed off the per-row `--accent` or a fixed token |
| `border-left` / inset `box-shadow` on the row | D-05/D-07/D-09 left accent edge bar | The active card + any waiting row |
| `text-overflow: ellipsis` + `min-width: 0` on a flex child | D-01/D-03 name + cwd-tail truncation | Line 1 name (already present on `.row-name`); line 2 cwd tail |
| `border: 1px dashed var(--line)` | D-11 recipe-card eggshell language (precedent: `.add-session` L267) | Inactive-list rows |
| `:focus-visible` outline | D-02 keyboard-focus reveal of controls (a11y required) | `.row-controls` reveal + control focus rings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Keep sidebar CSS in `terminal.css` | Extract to a new `src/renderer/sidebar.css` | Discretion (CONTEXT). Extraction counts toward the >800-line debt paydown and isolates this phase's churn. `terminal.css` is currently ~570+ lines; a split keeps both under the 800-line rule. **Recommendation: extract** if the planner is also touching `index.tsx` import order — but the `tokens-completeness.test.ts` scans `terminal.css` by path, so any sidebar CSS that uses `var()` tokens MUST keep that test green; if extracted, the test must be updated to also scan `sidebar.css` (see Pitfall 4). |
| Inline `--accent` channel for edge bar | New per-status CSS classes | The inline channel already carries the resolved color (incl. the amber overlay only while running). New classes would duplicate `presentation()` logic and risk drifting from the locked overlay contract (D-06). Reuse the channel. |
| `color-mix` for the amber wash | Pre-baked `--accent-waiting-tint` token | Either works. A token is cleaner if the wash strength is fixed; `color-mix` keyed off `--accent` lets the same rule serve any status. Given D-09 is amber-specific, a tuned `color-mix(... var(--accent-waiting) ...)` rule is simplest. Discretion. |

**Installation:** None. `npm install` adds nothing this phase.

**Version verification:** N/A — no package added. The existing pinned versions (@dnd-kit 6.3.1/10.0.0, React 19) are confirmed in package.json and were proven in prior phases. [VERIFIED: codebase — STATE.md Phase 05 decision + package.json scripts]

## Package Legitimacy Audit

> **Not applicable.** This phase installs **zero** external packages. It is a renderer-only CSS/JSX restyle consuming already-installed, already-vetted dependencies. No registry lookup, no slopcheck run required. If the planner discovers a genuinely needed new package mid-plan, it must be gated behind a `checkpoint:human-verify` and run through the legitimacy gate first.

## Architecture Patterns

### System Architecture Diagram (data flow into the sidebar — unchanged by this phase)

```
 main process (authoritative)                renderer (this phase restyles HERE)
 ─────────────────────────────               ──────────────────────────────────
 PtyManager.listSessions()                    SessionManager
   (live ∪ dormant, sorted by order)            sessions: SessionRecord[]  (+ renderer-only
        │                                          agentState, errorMessage, configured)
        │  onPtyStatus / syncStore                       │
        ▼  (IPC, UNTOUCHED)                               ▼
   SessionRecord[]  ───────────────────────►  Sidebar(sessions, activeId, …handlers)
   { logicalId, name, icon, status,                  │
     cwd, startupCommand, order, … }                 ├── partition: workingArea (status!==not_started)
                                                      │              inactiveList (status===not_started)
                                                      │
                                                      ├── per row → presentation(status, agentState)
                                                      │              → { label, accent }   [status-colors.ts]
                                                      │              → inline style --accent  ◄── D-05/D-06/D-09 ride this
                                                      │
                                                      └── SortableSidebarRow (RESTYLE TARGET)
                                                           icon tile · name (line1) · secondary (line2)
                                                           · hover-reveal controls · active card + edge bar
                                                           · collapsed: tile + status dot + rail tooltip
        cwd / startupCommand already on the record ──────────────► D-03 secondary line reads these (display only)
```

Nothing crosses the IPC boundary differently. The phase reads fields already present on `SessionRecord` (`cwd`, `startupCommand`, `name`, `icon`, `status`) and the renderer-only `agentState` already attached per row. No new field, no new channel.

### Component Responsibilities
| File | Responsibility this phase | Selector / contract to preserve |
|------|---------------------------|----------------------------------|
| `src/renderer/Sidebar.tsx` | Two-line row JSX, large icon tile, hover-reveal control cluster, dashed recipe cards, section labels + counts, ghost ▶ button | `.sidebar-row[data-session-id]`, `.sidebar-row.active`, `.row-name`, `.status-badge`, `.collapsed-status-dot.status-dot`, `.rail-tooltip`, `[data-testid]` (start-session, restart-session, start-no-cmd-session, edit-session, close-session, delete-session, sidebar-collapse, open-preferences, add-session), container `data-testid="working-area"`/`"inactive-list"`, `.sidebar-section`/`.sidebar-section-label` |
| `src/renderer/terminal.css` (or new `sidebar.css`) | All sidebar geometry + color; consume `tokens.css` via `var()`; apply `--space-*` scale | If extracted, update `tokens-completeness.test.ts` to scan the new file |
| `src/renderer/ContextMenu.tsx` | D-14 viewport clamp on `{x,y}`; D-15 danger-styled menu item | `.context-menu`, `.context-menu-item`, `data-testid="context-menu"`, item labels (`Edit`/`Start`/`Restart`/`Start without command`/`Remove`/`Delete`) used by ui-lab `contextMenuLabels()` |
| `src/renderer/SessionManager.tsx` | Pass a danger flag/variant for the Remove/Delete menu items (D-15); optionally pass measured menu position for clamp | `menuState.x/y` currently raw clientX/clientY; the `items` array shape consumed by ContextMenu |

### Pattern 1: Per-row accent channel reuse (D-05/D-06/D-09)
**What:** The row already receives the resolved status/agent color as an inline `--accent` custom property (written on `.status-badge` and `.collapsed-status-dot`). Lift that inline `--accent` to the **row element** so the edge bar and wash can read it.
**When to use:** Active card left edge bar, waiting-row amber edge bar + wash, collapsed-rail edge bar.
**Example:**
```tsx
// Source: project pattern — Sidebar.tsx already writes style={{ '--accent': stat.accent }}
// on .status-badge (L275) and .collapsed-status-dot (L269). Move/duplicate it to the row:
<div
  className={isActive ? 'sidebar-row active' : 'sidebar-row'}
  style={{ ...style, '--accent': stat.accent } as React.CSSProperties}
  data-session-id={s.logicalId}
  data-agent={agentState}            {/* NEW: lets CSS target [data-agent="waiting"] for D-09 */}
>
```
```css
/* Source: precedent color-mix usage already in terminal.css L186, L195, L557 */
.sidebar-row.active {
  border-left: 3px solid var(--accent);          /* D-05/D-06 status-colored edge bar */
  background: var(--surface);
  border-color: var(--line);
  box-shadow: var(--shadow-pop);                  /* D-05 lift */
}
.sidebar-row[data-agent='waiting'] {              /* D-09 — applies even when NOT active */
  border-left: 3px solid var(--accent-waiting);
  background: color-mix(in oklch, var(--accent-waiting) 8%, transparent);
}
```

### Pattern 2: Two-line row without breaking the flex selector contract (D-01/D-03)
**What:** The current row is a single flex line (`icon · name · status-badge · controls`). Restructure into `icon-tile · [text column: name / secondary] · controls`, keeping `.row-name` and `.status-badge` as the SAME class names so smoke selectors and the ui-lab `rowText()` still resolve.
**When to use:** The core name-crush fix (Gap 1).
**Example:**
```tsx
// Keep .row-name and .status-badge classes; nest them in a text column.
<span className="row-icon …">{/* renderIcon — enlarged tile via CSS */}</span>
<span className="row-text">                       {/* NEW flex column, min-width:0 */}
  <span className="row-name">{s.name}</span>      {/* line 1 — full width, ellipsis */}
  <span className="row-secondary">                {/* NEW line 2 */}
    <span className="status-dot" style={{ '--accent': stat.accent }} />
    {secondaryText(s, stat)}                       {/* D-03: "Running · room-name" | startupCommand | label */}
  </span>
</span>
```
Note: the current `.status-badge` (dot + label, L122) can become the line-2 secondary, OR keep `.status-badge` present-but-restyled and add `.row-secondary` — either is fine **as long as `.status-badge` still exists in the DOM** (DESIGN-RUBRIC + ui-lab `sidebar-populated` `expects` reads "status dot/label"; no smoke test selects `.status-badge` directly, but the rubric scores it visually). Verify against the smoke grep (none found selecting `.status-badge`), so it MAY be replaced by `.row-secondary` — but keep `.row-name` (smoke selects it: `session-edit.smoke.test.ts:39`, `app-restart-restore.smoke.test.ts:133`).

### Pattern 3: D-03 secondary-line text derivation (pure, testable)
**What:** A pure helper deriving the secondary line per D-03 (live → `status · cwdTail`; recipe → `startupCommand` else cwd else status word). Mirrors the project's existing pure-renderer-module idiom (`session-status.ts`, `start-affordances.ts`, `scrollback-clamp.ts`).
**When to use:** Keep the JSX dumb; unit-test the text logic in the Node env (no jsdom).
**Example:**
```ts
// New pure module e.g. src/renderer/row-secondary.ts (electron/react/xterm-free → Vitest-importable)
export function cwdTail(cwd: string): string {
  const seg = cwd.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? '';
  return seg;
}
export function secondaryText(row: { status; cwd; startupCommand }, label: string): string {
  // live: "<label> · <cwdTail>"; recipe(not_started): startupCommand || cwdTail || label
  // (exact rule per D-03; unit-test the branches)
}
```

### Pattern 4: D-14 context-menu viewport clamp
**What (root cause):** `ContextMenu.tsx` positions with raw `style={{ left: x, top: y }}` (L87) where `x/y` are the unmodified `clientX/clientY` from the row's `onContextMenu` (Sidebar.tsx L244, SessionManager passes through to `menuState.x/y`). Near the top/left of the sidebar a click at small y plus an upward-growing or header-overlapping menu lands over the sidebar header. **There is no clamp anywhere.**
**Fix:** After mount, measure the menu (`ref.current.getBoundingClientRect()`), then clamp left/top into the viewport:
```tsx
// In ContextMenu.tsx — measure on mount, then position with clamped coords.
const [pos, setPos] = useState({ left: x, top: y });
useEffect(() => {
  const el = ref.current; if (!el) return;
  const { width, height } = el.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(x, window.innerWidth - width - margin);
  const top  = Math.min(y, window.innerHeight - height - margin);
  setPos({ left: Math.max(margin, left), top: Math.max(margin, top) });
}, [x, y]);
// render style={{ left: pos.left, top: pos.top }}
```
This keeps the existing focus/Esc/roving-arrow logic untouched and adds only a measure-then-clamp step.

### Pattern 5: D-15 danger-ramp menu item
**What:** Mark the destructive item (`Remove` for live, `Delete` for dormant) so CSS can color it `--color-danger`.
**Fix:** Extend `ContextMenuItem` with an optional `danger?: boolean` (or `variant`), set it on the Remove/Delete entries in `SessionManager.tsx` (L740-741), and render a `context-menu-item-danger` class. Add a CSS rule mirroring the existing `.row-control-close:hover` danger treatment (terminal.css L184-188).
```css
.context-menu-item-danger { color: var(--color-danger); }
.context-menu-item-danger:hover {
  background: color-mix(in oklch, var(--color-danger) 8%, transparent);
}
```

### Anti-Patterns to Avoid
- **Restructuring markup that drops `.row-name` / `data-testid` / `working-area`/`inactive-list` selectors** without updating the dependent smoke/ui-lab drivers in the SAME plan — breaks `session-edit.smoke`, `app-restart-restore.smoke`, ui-lab `rowText`/`rowIds`. (Rule-1 discipline.)
- **Adding a parallel status/waiting code path** instead of riding `presentation(status, agent)`. The amber overlay is intentionally **only** applied while `status==='running'` (locked Phase 6 D-06/D-07); a row-level `[data-agent="waiting"]` selector keyed off the already-resolved value is the correct seam.
- **Animating layout-bound properties** (height/width/top/left) on the row for the active/waiting transition — violates the project's compositor-friendly rule (web/performance.md). Use `transform`/`opacity`/`box-shadow`/`background` (and the static, no-animation D-09 requirement).
- **Touching `.session-view` / `.viewport-stack` visibility** while restyling collapse — the Phase-4 anti-pattern guard; collapse touches ONLY `.sidebar` or keep-alive breaks (Core-Value regression).
- **Whole-tile status tint in the collapsed rail** — D-10 forbids it (would fight user-chosen color-badge icons); use the enlarged bottom-right dot + ring + (for active/waiting) the rail's left edge bar.
- **Hardcoding spacing/color literals** — `tokens-completeness.test.ts` bans the migrated brand/danger/font literals from `terminal.css` and asserts every `var(--token)` resolves. New values that belong in the scale must use `--space-*`; new colors should reference existing tokens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status → color/label | A new sidebar-local status map | `presentation()` / `STATUS_STYLE` / `AGENT_STYLE` in `status-colors.ts` | Single source of truth; the overlay-only-while-running contract is locked and unit-tested (`status-colors.test.ts`). |
| Per-row accent color delivery | New CSS classes per status | The existing inline `--accent` custom property (allow-listed in `tokens-completeness.test.ts`) | Already wired on every row; carries the resolved (incl. amber overlay) value. |
| Icon rendering across 3 kinds | Branching in the row JSX | The single exported `renderIcon(icon, name)` in Sidebar.tsx | D-04 enlarges the tile via CSS around the SAME function; forking it would re-introduce the grapheme/color-badge bugs Phase 4 already solved. |
| Which Start affordance renders | Inline ternaries in the row | `startAffordances()` (`start-affordances.ts`) | Encodes the DEFECT-C "exactly one primary Start" invariant; unit-tested. D-13's always-visible ▶ must stay consistent with it. |
| Self-exit → Inactive presentation | New status fudging | `resolveRowStatus()` (`session-status.ts`) | Pure, unit-tested; the bucket a row lands in already derives from it. Restyle does not change which bucket — only how the bucket looks. |
| Drag activation / keyboard reorder | Custom pointer math | dnd-kit `PointerSensor` (5px distance) + `KeyboardSensor` | Already configured; taller rows only need a visual re-check of overlay + activation feel, not a re-implementation. |

**Key insight:** This phase has **no genuinely new logic** — it is composition. Every behavioral seam already exists as a pure, tested module. The risk is not "missing a library" but "breaking a selector contract" or "introducing a parallel status path." Keep logic in the existing pure modules; put everything new in CSS + a thin secondary-text helper.

## Runtime State Inventory

> Rename/refactor inventory — included because the phase MAY extract `terminal.css` → `sidebar.css` (a file move) and restructures markup. No stored-string rename is involved.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no persisted string is renamed. Session metadata (name/icon/cwd/startupCommand/order) is displayed, never re-keyed. Verified: `SessionRecord` fields are read-only here; lowdb store schema untouched. | none |
| Live service config | None — no external service, no telemetry, local-only app. | none |
| OS-registered state | None — no OS registration touches the sidebar. | none |
| Secrets/env vars | None. The only env vars in play are the ui-lab capture flags (`UI_LAB_TAG`, `UI_LAB_LIVE_CSS`, `UI_LAB_OVERRIDE_CSS_FILE`, `JW_USER_DATA_DIR`) — capture-time only, not changed by this phase. | none |
| Build artifacts | If `terminal.css` → `sidebar.css` extraction is chosen: (1) `index.tsx` import must add/redirect the new file; (2) `tokens-completeness.test.ts` reads `terminal.css` by path via `readFileSync(resolve(__dirname,'../terminal.css'))` — it must be updated to ALSO scan `sidebar.css`, or the var()-completeness + literal-absence guarantees no longer cover the moved rules; (3) ui-lab `UI_LAB_LIVE_CSS=1` injects "current repo tokens.css + terminal.css" — if sidebar rules move out of terminal.css, the live-preview injection helper (`tests/ui-lab/helpers.ts`) must also pick up `sidebar.css` or preview will silently miss the new rules. | Update import order, the completeness test path list, and the ui-lab injection helper IN THE SAME PLAN if extracting. |

**Nothing found in categories 1-4:** confirmed — this is a presentation-only restyle with no stored, service, OS, or secret state. The only real artifact concern is the optional CSS file move (category 5), which has three concrete touch-points listed above.

## Common Pitfalls

### Pitfall 1: Selector-contract breakage (HIGH likelihood, the dominant risk)
**What goes wrong:** Restructuring the row markup drops or renames a class/testid that a smoke or ui-lab driver selects → tests go RED or, worse, ui-lab `rowText()` returns empty and "evidence" is misleading.
**Why it happens:** The two-line restructure (D-01) is tempting to do by replacing `.status-badge` and re-nesting `.row-name`.
**How to avoid:** Treat this list as frozen-or-update-in-lockstep: `.sidebar-row[data-session-id]`, `.sidebar-row.active`, `.row-name`, `.collapsed-status-dot.status-dot`, `.rail-tooltip`, `working-area`/`inactive-list` container testids, and every `row-control` `data-testid`. Grep before editing: `grep -rn 'row-name\|sidebar-row\|data-session-id\|working-area\|inactive-list\|collapsed-status-dot' tests/`. If a class must change, update the driver + smoke in the same plan task.
**Warning signs:** `npm run test:smoke` failures in `session-edit`, `app-restart-restore`, `keyboard-switch`; ui-lab `sidebar-populated`/`sidebar-collapsed` PNGs missing names.

### Pitfall 2: Injection-preview ≠ packaged-proof for the TSX restructure (HIGH)
**What goes wrong:** The two-line layout and the icon-tile resize are **structural (TSX/markup) changes**, not pure CSS value edits. `UI_LAB_LIVE_CSS=1` injects CSS over the *bundled* (old) markup — so a preview run will show the OLD single-line structure restyled, not the new two-line row. The agent could "verify" against a misleading preview.
**Why it happens:** The ui-lab README explicitly warns injection can't preview TSX/structure changes; only `ui:shots:fresh` (repackage) can.
**How to avoid:** For any cycle that changed `Sidebar.tsx`/`ContextMenu.tsx`, use `npm run ui:shots:fresh` (or `npm run package && npm run ui:shots`), NOT live-CSS. Live-CSS preview is valid only for `tokens.css`/`terminal.css` value/addition tweaks once the structure is built and packaged. Always finish with a packaged no-injection capture (Hard Rule 2).
**Warning signs:** Preview PNG still shows crushed single-line names after a "two-line" edit → you previewed CSS over old markup.

### Pitfall 3: tokens-completeness test goes RED on a new undefined token (MEDIUM)
**What goes wrong:** Referencing `var(--something)` in CSS that isn't defined in `tokens.css` → `tokens-completeness.test.ts` "every var(--token) is defined" fails; or re-introducing a banned literal (brand blue / danger red / `'Nunito'` / `'JetBrains Mono'`) → literal-absence test fails.
**Why it happens:** Tuning a new wash/edge value by typing a literal instead of adding/using a token.
**How to avoid:** Every new value goes through `tokens.css` (Tokens-First, Hard Rule 4). Use existing `--space-*`, `--accent-*`, `--radius-*`, `--shadow-*`. The `--accent` per-row inline channel is already allow-listed; new tints should `color-mix` off a defined token. Run `npm run test:unit` after every edit cycle.
**Warning signs:** Vitest failure in `tokens-completeness.test.ts`.

### Pitfall 4: CSS extraction breaks the completeness test's path scan (MEDIUM, only if extracting)
**What goes wrong:** Moving sidebar rules to `sidebar.css` removes them from `terminal.css`, so `tokens-completeness.test.ts` (which `readFileSync`s `terminal.css` by path) no longer guards them — undefined-token / banned-literal regressions in the moved rules go undetected; AND ui-lab live-CSS injection (which injects current `tokens.css`+`terminal.css`) won't preview `sidebar.css` edits.
**How to avoid:** If extracting, in the same plan: add `sidebar.css` to the completeness test's scanned files, add it to `index.tsx` import order (after tokens.css, like terminal.css), and add it to the ui-lab injection helper's file list.
**Warning signs:** Suspiciously still-green completeness test after introducing a deliberately-undefined token in `sidebar.css`; live-CSS preview not reflecting sidebar.css edits.

### Pitfall 5: Taller rows degrade drag feel / overlay (MEDIUM)
**What goes wrong:** ~40% taller two-line rows (D-01) change the drag overlay geometry and the closestCenter collision; reorder can feel "off" or the drag handle reveal conflicts with hover-reveal controls.
**Why it happens:** dnd-kit's transform/overlay assumes the row's rendered size; the 5px PointerSensor distance still protects click-to-switch, but the visual lift uses `.sidebar-row.dragging` styling.
**How to avoid:** Re-verify `reorder.smoke` stays green and manually exercise drag in the ui-lab/dev app after the height change. Keep the dragging-state visuals (opacity/outline/shadow at terminal.css L247-254) working. The drag handle (`.row-drag-handle`) and controls both hover-reveal — ensure they don't overlap at the row's right end.
**Warning signs:** `reorder.smoke` RED; drag overlay clipped; controls and handle collide.

### Pitfall 6: Collapsed-rail continuity (MEDIUM)
**What goes wrong:** D-07/D-10 require the active marker and waiting treatment to read in the collapsed rail too (edge bar on the rail's left edge, enlarged status dot). The current collapsed rules hide `.row-name`/`.status-badge`/`.row-controls` and reveal `.collapsed-status-dot` — adding a two-line structure must not leak the secondary line into the rail.
**How to avoid:** Ensure the new `.row-text`/`.row-secondary` are hidden under `.sidebar.collapsed` (extend the existing hide rule at terminal.css L355-359). Apply the active edge bar to the rail row, enlarge the dot per D-10 (currently 8px L374 → ~10px), thicken the `--surface` ring. Capture `sidebar-collapsed` and (recommended) a new collapsed-waiting surface.
**Warning signs:** ui-lab `sidebar-collapsed` shows leftover text or a too-small/indistinct active tile.

## Code Examples

### Enlarged icon tile (D-04) — CSS-only around the unchanged renderIcon
```css
/* Source: extends terminal.css .row-icon (L102-111). D-04 wants ~32-36px rounded tile. */
.sidebar-row .row-icon {
  flex: 0 0 auto;
  width: 34px;            /* was 20px — snap to scale; ~32-36px tile */
  height: 34px;
  font-size: 18px;        /* emoji optical size */
  border-radius: var(--radius-md);   /* 8px tile rounding from tokens.css */
}
.sidebar-row .row-icon-color {   /* color-badge initial stays legible at tile size */
  font-weight: 700;
}
```

### Section label with count (D-12) — JSX + CSS
```tsx
// Sidebar.tsx — label already exists (L524); append the count.
<span className="sidebar-section-label" aria-hidden={collapsed}>
  Working Area <span className="sidebar-section-count">· {workingArea.length}</span>
</span>
```
```css
/* terminal.css .sidebar-section-label already L59-67 (uppercase, letter-spaced, --ink-faint).
   Add a hairline divider between sections (D-12). */
.sidebar-section + .sidebar-section { border-top: 1px solid var(--line-soft); padding-top: var(--space-2); }
```

### Ghost ▶ Start button (D-13) — restyle the existing .row-control-start
```css
/* Source: terminal.css .row-control-start (L193-202) already fills accent-blue on hover.
   D-13 wants a circular thin-outline ghost that fills solid on hover. */
.sidebar-row .row-control-start {
  border-radius: 999px;                 /* circular */
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
}
.sidebar-row .row-control-start:hover {
  background: var(--color-accent);      /* fill solid */
  color: var(--surface);
}
```
Note: D-13 says the Inactive Start ▶ is **always visible** (not hover-revealed). The control is already always-rendered in the DOM (`startCtl.sidebarStart`); ensure the recipe-card row does NOT apply the `opacity:0` hover-reveal to the Start specifically — i.e. the `.row-controls` reveal (L142-155) must keep the ▶ visible on inactive-list rows (exclude `.row-control-start` from the opacity:0, or move it out of the reveal cluster).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded CSS literals in terminal.css | Token references via `tokens.css` `var()` | Phase 9 (this milestone) | This phase MUST consume tokens, not literals; guarded by `tokens-completeness.test.ts`. |
| Single-line crushed row | Two-line SessionCard anatomy | Phase 10 (this phase) | The name-crush fix; ~40% taller rows. |
| Reserved-width always-on controls | Hover/`:focus-visible`-revealed controls | Phase 10 (D-02) | Frees row width for the name. |
| `--space-*` defined-not-applied | `--space-*` applied to the sidebar | Phase 10 (first consumer) | Spacing rhythm comes from the scale, not one-offs. |

**Deprecated/outdated:** None relevant. No external library version concern (no packages added).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No smoke test selects `.status-badge` directly, so it MAY be replaced by `.row-secondary` (grep found none). | Pattern 2 | LOW — if a hidden selector exists, that smoke goes RED; mitigated by re-grepping at plan time and keeping `.status-badge` if uncertain. |
| A2 | D-09 amber-on-non-active-rows works through `[data-agent="waiting"]`, and `agentState` is reliably attached to inactive (non-selected) rows' records, not just the active one. | Pattern 1 / D-09 | MEDIUM — agentState is renderer-only and set "only while running" by the SessionView idle detector; a non-active running session's agentState attachment should be confirmed against SessionManager. If a backgrounded session doesn't carry agentState, the non-active waiting wash won't fire. Verify at plan time. |
| A3 | Extracting `terminal.css`→`sidebar.css` is purely additive if the 3 touch-points (import order, completeness test path, ui-lab injection helper) are updated together. | Runtime State Inventory / Pitfall 4 | LOW — the touch-points are enumerated; risk is forgetting one. |
| A4 | The D-14 context-menu mispositioning root cause is the absence of any viewport clamp (raw clientX/clientY → `style.left/top`). | Pattern 4 | LOW — verified by reading ContextMenu.tsx (L87) and the SessionManager pass-through (no clamp anywhere). |

**Note:** A2 is the one assumption a planner should resolve before writing the D-09 task — confirm whether `agentState` is present on non-active running rows in `SessionManager.tsx`.

## Open Questions

1. **Does a non-active running session carry `agentState` so the D-09 amber wash fires on it?**
   - What we know: `agentState` is renderer-only, set by the SessionView idle detector "only while running," cleared on transition away (STATE.md Phase 06-03). It's read defensively in Sidebar (`(s as {agentState?}).agentState`).
   - What's unclear: whether the idle detector runs for backgrounded (non-active) sessions or only the active one — D-09 explicitly wants amber on non-active rows.
   - Recommendation: grep `SessionManager.tsx` for where `agentState` is attached to rows and whether the detector is per-session or active-only. If active-only, D-09's "non-active waiting" needs the planner to confirm the agent-state source covers background sessions (it rides `presentation(status,agent)` which is amber only while running — so a background running+waiting session must still be emitting agentState). This is the single substantive unknown.

2. **Extract `terminal.css` → `sidebar.css` or keep in place?** (Discretion)
   - What we know: extraction is sanctioned, counts toward >800-line debt paydown, and has 3 enumerated touch-points.
   - Recommendation: planner's call. If `terminal.css` is comfortably under 800 lines after this phase's additions, keeping it in place is lower-risk (no test/injection path edits). If the additions push it near 800, extract and update all 3 touch-points in the same plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node/npm | build, tests | ✓ (project already builds) | — | — |
| Electron Forge (`npm run package`/`make`) | ui-lab packaged proof | ✓ | per package.json | — |
| WebdriverIO + @wdio/electron-service | smoke + ui-lab capture | ✓ | per project | — |
| Vitest | unit tests (tokens-completeness, status-colors, new row-secondary) | ✓ | per project | — |

No external service, no network dependency. The phase runs entirely against the existing local toolchain. macOS is the dev/capture platform (Windows captures are CI/deferred per WIN-02).

## Validation Architecture

> nyquist_validation is enabled (config: `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Unit framework | Vitest (`npm run test:unit` → `vitest run`) |
| Smoke framework | WebdriverIO + @wdio/electron-service (`npm run test:smoke` → `wdio run wdio.conf.ts`) |
| Visual harness | ui-lab (`npm run ui:shots` / `ui:shots:fresh`, `wdio.uilab.conf.ts`) — capture + DESIGN-RUBRIC scoring |
| Type check | `npx tsc --noEmit` |
| Quick run command | `npm run test:unit && npx tsc --noEmit` |
| Full suite command | `npm run test` (unit + smoke) + a packaged ui-lab capture |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-02 | Token references resolve; no banned literals reappear | unit | `npx vitest run src/renderer/__tests__/tokens-completeness.test.ts` | ✅ |
| UI-02 | status→color/label resolver unchanged (overlay contract) | unit | `npx vitest run` (status-colors.test.ts) | ✅ |
| UI-02 | D-03 secondary-line text derivation (cwd tail, recipe command) | unit | `npx vitest run` on new `row-secondary` test | ❌ Wave 0 (new pure module + test) |
| UI-02 | D-14 context-menu clamp (left/top never exceed viewport) | unit/component | clamp helper test (pure math) | ❌ Wave 0 (extract clamp as pure fn for unit-testability) |
| UI-02 | Sidebar interactions unregressed (click-switch, reorder, keyboard) | smoke | `npm run test:smoke` (keyboard-switch, reorder, session-edit, app-restart-restore) | ✅ (must stay GREEN) |
| UI-02 | Visual hierarchy / active distinction / collapsed legibility | visual | `npm run ui:shots:fresh` → score `sidebar-populated`, `sidebar-collapsed`, `context-menu` vs DESIGN-RUBRIC | ✅ (surfaces exist; consider adding a waiting + inactive-list surface) |

### Sampling Rate
- **Per task commit:** `npm run test:unit && npx tsc --noEmit` (fast; includes tokens-completeness).
- **Per wave merge:** `npm run test:smoke` (selector-contract guard) + a ui-lab live-CSS preview cycle for CSS-only tweaks.
- **Phase gate:** Full `npm run test` GREEN + a **packaged no-injection** ui-lab capture (`ui:shots:fresh`) scored against DESIGN-RUBRIC, before `/gsd-verify-work` and the end-of-phase human-verify.

### Wave 0 Gaps
- [ ] `src/renderer/row-secondary.ts` + `src/renderer/__tests__/row-secondary.test.ts` — D-03 secondary-line/cwd-tail derivation (pure, Node-env, no jsdom).
- [ ] Context-menu clamp as a pure function (e.g. `clampToViewport(x,y,w,h,vw,vh,margin)`) + unit test, so D-14 is unit-verifiable not just visually.
- [ ] (If extracting CSS) update `tokens-completeness.test.ts` scanned-files list + ui-lab injection helper to include `sidebar.css`.
- [ ] (Recommended) add ui-lab surfaces for a **waiting** row (D-09 evidence) and an **inactive-list recipe card** (D-11 evidence) to `tests/ui-lab/surfaces.ts` + matching DESIGN-RUBRIC sections.

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local desktop app, no auth surface. |
| V3 Session Management | no | "Session" here is a terminal session, not a web session. |
| V4 Access Control | no | No access-control surface touched. |
| V5 Input Validation | no (not in scope) | The phase displays already-validated, already-stored fields (name/cwd/startupCommand). No new input is accepted, no IPC/bridge key added (`EXPECTED_API_KEYS` stays 20). cwd/startupCommand path validation remains main-side (unchanged). |
| V6 Cryptography | no | None. |
| V7 Output handling | **yes (low)** | The secondary line renders user-controlled strings (session name, cwd tail, startupCommand) as **text nodes** via React (auto-escaped). Do NOT introduce `dangerouslySetInnerHTML` or any HTML interpolation. The `title=`/tooltip already render text; keep them text. (web/security.md XSS rule.) |

### Known Threat Patterns for an Electron renderer restyle
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via rendering a malicious session name / cwd / startupCommand into the secondary line | Tampering/Elevation | React text-node rendering (auto-escaped); never `innerHTML`/`dangerouslySetInnerHTML`. The strings are local user data, low risk, but the rule is absolute. |
| Renderer reaching node-pty / privileged APIs | Elevation | Out of scope — no IPC/bridge change; `contextIsolation` + the 20-key bridge surface stay frozen. The phase touches no main-process code. |
| Control-char / ANSI injection in displayed metadata | Tampering | Already handled upstream (notice sanitization, STATE.md Phase 06-02 WR-04). The sidebar displays names/cwd/cmd as plain text — CSS/flex truncation, no terminal interpretation. |

**Net:** This is a presentation-only renderer change with no new trust boundary. The only standing security rule is **text-node rendering only** for the user-controlled secondary-line strings — which the existing code already follows (`{s.name}`, `title={stat.label}`). No `security-reviewer` escalation warranted unless the planner introduces HTML interpolation (it should not).

## Sources

### Primary (HIGH confidence — project's own code & locked docs)
- `src/renderer/Sidebar.tsx` — row JSX, renderIcon, partition, controls, collapsed rules, per-row `--accent` writes (L269/L275).
- `src/renderer/terminal.css` (L23-402) — every current sidebar rule; color-mix precedents (L186/195/557); collapsed/rail-tooltip/dot rules (L334-402).
- `src/renderer/status-colors.ts` — `STATUS_STYLE`/`AGENT_STYLE`/`presentation()`; overlay-only-while-running contract.
- `src/renderer/ContextMenu.tsx` (L87) — raw `style={{left:x,top:y}}` (D-14 root cause confirmed); focus/Esc/roving-arrow logic.
- `src/renderer/SessionManager.tsx` (L713-744) — ContextMenu render, `menuState.x/y`, Remove/Delete items (D-15 target).
- `src/renderer/start-affordances.ts`, `src/renderer/session-status.ts` — pure modules that govern which controls/bucket a row gets (don't-hand-roll).
- `src/renderer/tokens.css` — the token set this phase consumes (`--space-*`, `--accent-*`, `--radius-*`, `--shadow-*`, `--ink-*`, `--color-danger`).
- `src/renderer/__tests__/tokens-completeness.test.ts` — the var()-completeness + literal-absence guard (path-scoped to terminal.css + status-colors.ts).
- `tests/ui-lab/README.md`, `tests/ui-lab/DESIGN-RUBRIC.md`, `tests/ui-lab/surfaces.ts` — the mandatory verification harness, rubric, and surface registry.
- `tests/smoke/*.smoke.test.ts` — selector contract (`.row-name`, `.sidebar-row[data-session-id]`, `working-area`/`inactive-list`).
- `.planning/DESIGN.md` §Status system / §v1 component inventory (SessionCard anatomy + status ramps).
- `.planning/phases/09-design-token-foundation/09-HUMAN-UAT.md` §Gaps — Gaps 1/4/5 (the operator's "still ugly" specifics this phase closes).
- `.planning/phases/10-sidebar-visual-polish/10-CONTEXT.md` — the locked D-01..D-15 decisions.

### Secondary (MEDIUM)
- `.planning/STATE.md` — Phase 04/05/06 decisions (dnd-kit pinning, agentState renderer-only, collapse anti-pattern guard, 20-key bridge).

### Tertiary (LOW)
- None — no WebSearch needed; the phase is fully internal.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no packages added; all reuse is confirmed in code.
- Architecture: HIGH — every seam (presentation(), --accent channel, startAffordances, resolveRowStatus, dnd-kit) is read directly from source.
- Pitfalls: HIGH — selector contract grepped, ui-lab injection caveat read from README, completeness test read from source, D-14 root cause confirmed at the line.
- One MEDIUM-confidence open question (A2 / Open Q1): whether non-active running rows carry `agentState` for the D-09 non-active waiting wash — flagged for the planner to resolve before the D-09 task.

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stable — internal codebase, no fast-moving external dependency).
