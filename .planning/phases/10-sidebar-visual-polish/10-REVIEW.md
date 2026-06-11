---
phase: 10-sidebar-visual-polish
reviewed: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/renderer/ContextMenu.tsx
  - src/renderer/SessionManager.tsx
  - src/renderer/Sidebar.tsx
  - src/renderer/__tests__/row-secondary.test.ts
  - src/renderer/__tests__/tokens-completeness.test.ts
  - src/renderer/__tests__/viewport-clamp.test.ts
  - src/renderer/index.tsx
  - src/renderer/row-secondary.ts
  - src/renderer/sidebar.css
  - src/renderer/terminal.css
  - src/renderer/viewport-clamp.ts
  - tests/ui-lab/DESIGN-RUBRIC.md
  - tests/ui-lab/helpers.ts
  - tests/ui-lab/surfaces.ts
findings:
  critical: 0
  warning: 7
  info: 6
  total: 13
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-11
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 10 restyled the session sidebar (two-line rows, status-colored active card),
extracted the sidebar CSS out of `terminal.css` into `sidebar.css`, and added a
viewport-clamped right-click context menu with a danger-item variant. The extracted
CSS is faithful, the pure helpers (`row-secondary.ts`, `viewport-clamp.ts`) are clean
and well-tested, and the token-completeness guard was correctly extended to cover the
new `sidebar.css`. No security vulnerabilities and no crash/data-loss bugs were found —
hence zero BLOCKERS.

The review did, however, find the **root cause of two of the three human-flagged visual
gaps in code, not just in environment**:

- The "hover controls crush the row name" gap is a **layout defect, not a hover defect**
  (WR-01): the control cluster reserves its full width permanently, so the name is
  squeezed in the resting state too.
- The "amber `waiting` never appears live" gap is partly **environmental (no real agent
  in the harness)**, but a **real code asymmetry** also blocks it from ever resolving for
  a row whose status is anything but the exact string `'running'` (WR-02), and the badge
  is left stale on the running→non-running edge (WR-03).
- The "edge-bar color semantics" gap is traced to a **fragile CSS-source-order dependency**
  between `.active` and `[data-agent='waiting']` (WR-04).

The remaining findings are robustness/quality (event-listener churn, a defensive-`any`
global cast, a stale `useEffect` dep, and several a11y/UX gaps).

## Warnings

### WR-01: Row name is permanently crushed by the always-present control cluster (root cause of "hover controls crush the row name")

**File:** `src/renderer/sidebar.css:161-184`, `src/renderer/Sidebar.tsx:302-408`
**Issue:** `.row-controls` is `flex: 0 0 auto` and **every control button stays in the DOM
at all times** — they are only visually hidden with `opacity: 0` (sidebar.css:174-177),
NOT `display: none`. The comment at sidebar.css:159-160 makes this explicit ("always
present in the DOM so the E2E driver can address data-testid"). Because `opacity` does
not remove layout box, the cluster reserves its **full rendered width permanently**
(drag-handle + icon + up to 4 control buttons at 24px each + gaps). `.row-text` is
`flex: 1 1 auto; min-width: 0`, so it is the element that shrinks to absorb the deficit.
The result: the row name's available width is reduced by the reserved control width **in
the resting state, not on hover** — the human reviewer perceives it "on hover" only
because that is when the (already-reserved) controls become visible and the crush becomes
*legible*, but the ellipsis truncation is present at rest. On a 220px rail (sidebar.css:9)
minus 10px padding, 34px icon, dots, and a 4-button cluster, the name column can collapse
to a few characters for sessions that also show Start/Restart/Edit/Remove.
**Fix:** Reserve only minimal resting width and let the cluster expand on hover, OR keep
the controls present for the driver but collapse their box when not revealed. Two viable
routes:
```css
/* Option A: zero-width when hidden, expand on reveal (keeps DOM for the driver) */
.sidebar-row .row-control {
  opacity: 0;
  max-width: 0;
  overflow: hidden;
  padding: 0;
  border-width: 0;
  transition: opacity var(--duration-fast) var(--ease-standard),
              max-width var(--duration-fast) var(--ease-standard);
}
.sidebar-row:hover .row-control,
.sidebar-row.active .row-control,
.sidebar-row:focus-within .row-control { /* …existing reveal selectors… */
  opacity: 1;
  max-width: 24px;
  padding: 0;
  border-width: 1px;
}
```
Note: an always-visible dormant `▶` (sidebar.css:188-190) and the active row's
always-visible cluster must still reserve their width — but a plain running/finished row
should give that width back to the name. Validate with the `sidebar-populated` ui-lab
capture (a long session name on a non-active, non-dormant row) before claiming the gap
is closed.

### WR-02: Amber `waiting` treatment can never resolve for a row whose status string is not exactly `'running'` (root cause half of the "amber never appears" gap)

**File:** `src/renderer/SessionManager.tsx:564-572`, `src/renderer/Sidebar.tsx:194-195,240,242`
**Issue:** The DESIGN intent (Sidebar.tsx:236-239 comment, sidebar.css:93-99) is that a
**backgrounded** waiting row carries the amber wash "with zero extra wiring." But the
agent-state can only ever be *stored* on a row when `row.status === 'running'`
(SessionManager.tsx:567). Meanwhile `presentation(s.status, agentState)` (Sidebar.tsx:195)
only applies the overlay when status is `'running'` (status-colors.ts:70), and the
`data-agent` attribute is only emitted when `agentState` is truthy (Sidebar.tsx:242). The
ui-lab harness skips this surface because no real agent process is present
(surfaces.ts:330-342), so live verification is deferred entirely to the manual gate — and
that manual gate already reported the amber never appears. The code path is internally
consistent but **has no automated proof that the running-gated store + the running-gated
overlay + the `data-agent` seam actually co-fire** for a live agent; the only test is the
static `data-agent` CSS-rule contract (DESIGN-RUBRIC.md:132-135), which cannot catch a
detector that never emits `'waiting'`. This is the seam most likely to silently regress.
**Fix:** Add a unit/component-level test that drives `handleAgentState(id, 'waiting')` on a
`running` row and asserts the row renders `data-agent="waiting"` and the amber accent
resolves (the existing pure helpers make this testable without jsdom if the seam is
factored into a pure `rowAgentAttrs(status, agentState)` function). Separately, confirm in
the manual gate whether `decideAgentTick` ever emits `'waiting'` for the real `claude --rc`
permission screen — if the detector is the failure point (not the styling), this is a
detector bug, not a CSS bug, and WR-04/sidebar.css should not be touched chasing it.

### WR-03: Agent-state badge is left stale on the running→non-running transition in the live status path

**File:** `src/renderer/SessionManager.tsx:477-501,564-572`
**Issue:** `handleAgentState` refuses to *update* `agentState` once a row leaves `'running'`
(line 567), but the per-row `onPtyStatus` subscription (`applyStatusEvent`, lines 488-492)
flips a row from `running` to `stopped`/`exited`/`error` **without clearing the previously
stored `agentState`**. The two destructive paths that *do* clear it are `confirmClose`
(line 206) and… only that one — `handleRestart` (line 235-246) sets status back to
`'running'` but does not reset `agentState`. So a session that was `waiting` (amber) and
then self-exits keeps `agentState='waiting'` on the row object. `presentation()` masks this
for the *label/accent* (the overlay is gated to `running`, so the badge text reverts
correctly), BUT the raw `data-agent="waiting"` attribute is still rendered (Sidebar.tsx:242
is gated only on `agentState` being truthy, NOT on status), so `sidebar.css:96-99` paints
the **amber left edge bar + amber wash on a finished/exited row**. That is a wrong-color
semantic leak: a done session reads as "needs me."
**Fix:** Either gate the `data-agent` attribute on the running status in the JSX, or clear
`agentState` in the reducer whenever the row leaves `running`:
```tsx
// Sidebar.tsx — only surface the agent attr while actually running:
{...(s.status === 'running' && agentState ? { 'data-agent': agentState } : {})}
```
Prefer clearing in `applyStatusEvent` so the row object stays truthful (single source),
mirroring the `errorMessage`/`ptyPid` cleanup already done elsewhere.

### WR-04: Active vs. waiting edge-bar color depends on fragile CSS source order (root cause of "edge-bar color semantics")

**File:** `src/renderer/sidebar.css:86-99,427-433`
**Issue:** `.sidebar-row.active` (specificity 0,2,0) sets `border-left: var(--accent)`, and
`.sidebar-row[data-agent='waiting']` (also 0,2,0) sets `border-left: var(--accent-waiting)`.
**Equal specificity means the winner is purely source order** — `[data-agent='waiting']`
happens to be declared after `.active`, so a row that is BOTH active and waiting currently
renders amber (the intended priority). This is correct *today* but is a latent defect: any
future reorder of these blocks, or an extraction/merge like this very phase performed,
silently inverts the priority with no test catching it. Worse, the active row's edge bar
reads `var(--accent)` (the inline, agent-aware accent from `presentation()`) while the
waiting rule reads `var(--accent-waiting)` directly — so for an **active** waiting row the
two rules set the *same* amber via different channels, but for a **non-active** waiting row
only the `[data-agent]` rule fires. The semantics ("active = status color, waiting = amber,
waiting-wins-when-both") are encoded only in declaration order, which is exactly the kind
of thing the human reviewer flagged as confusing.
**Fix:** Make the precedence explicit rather than order-dependent — e.g. raise the waiting
rule's specificity so it deterministically wins regardless of order, and unify on a single
accent channel:
```css
/* waiting always wins on the edge bar, order-independent */
.sidebar-row.active[data-agent='waiting'],
.sidebar-row[data-agent='waiting'] {
  border-left: 3px solid var(--accent-waiting);
}
```
Add a comment documenting the intended precedence so the next extraction does not invert it.

### WR-05: ContextMenu measure-then-clamp can leave the menu off-screen on the first paint (and re-clamps only on x/y change)

**File:** `src/renderer/ContextMenu.tsx:48-67`
**Issue:** `pos` is initialized to the **raw, unclamped** `{ left: x, top: y }` (lines 48-51)
and rendered immediately; the clamp runs in a post-mount `useEffect` (lines 52-67). For one
frame the menu is painted at the raw cursor anchor — if the right-click is near the
bottom/right edge, the menu flashes overhanging the viewport before the effect corrects it.
More importantly, the effect deps are `[x, y]` only (line 67): if the menu's **content height
changes while open** (e.g. the Start/Restart or "Start without command" item set changes for
the same target — SessionManager.tsx:723-749 makes the item list status-dependent), the
clamp is not recomputed, so a taller menu can overflow. The clamp also never re-runs on
window resize.
**Fix:** Render the menu hidden (`visibility: hidden`) until the first clamp completes to kill
the flash, and recompute on content/size change:
```tsx
const [measured, setMeasured] = useState(false);
useLayoutEffect(() => {
  const el = ref.current; if (!el) return;
  const rect = el.getBoundingClientRect();
  setPos(clampToViewport(x, y, rect.width, rect.height, window.innerWidth, window.innerHeight, 8));
  setMeasured(true);
}, [x, y, items.length]);          // re-clamp when the item count changes
// style={{ left: pos.left, top: pos.top, visibility: measured ? 'visible' : 'hidden' }}
```
`useLayoutEffect` also avoids the visible pre-clamp paint without needing the visibility hack.

### WR-06: `onPtyStatus` subscription re-binds on every `sessions` change, churning N listeners per state update

**File:** `src/renderer/SessionManager.tsx:477-501`
**Issue:** The status-subscription effect depends on `[sessions]` (line 501). `sessions` is
replaced on **every** status event, every agent-state lift, every reorder, every edit — so
this effect tears down and re-creates one `window.api.onPtyStatus` subscription **per session
on every one of those updates**. With the agent-state detector emitting frequently
(SessionView ticks), this is a continuous churn of IPC listener registration/unregistration
proportional to session count. The code comments elsewhere (lines 140-145, 504-518) show the
author deliberately used a `sessionsRef` + once-bound effect for the switch subscription to
avoid exactly this — but the status subscription was not given the same treatment.
**Fix:** Subscribe once per session id (key the effect on a stable id list, e.g.
`sessions.map(s => s.logicalId).join(',')`), and read/update through the functional
`setSessions` updater rather than re-binding on every content change. (Performance is
out-of-scope for v1 severity, but this is a correctness-adjacent listener-lifecycle smell:
a status event arriving during the teardown/rebind window can be dropped.)

### WR-07: Context menu and confirm modal are not focus-trapped / not labelled as dialogs

**File:** `src/renderer/ContextMenu.tsx:71-90,110-118`
**Issue:** The context menu has `role="menu"` and roving arrow focus (good), but Tab/Shift-Tab
are not trapped — Tab moves focus out of the menu into the document behind it while the menu
stays open, and focus is not restored to the triggering row on close. The `role="menu"`
container also has no `aria-label`/`aria-labelledby`. For a control surface that is the
**only** affordance when the sidebar is collapsed (ContextMenu.tsx:5-6), keyboard users can
lose focus into hidden content.
**Fix:** Trap Tab within the menu (cycle across `.context-menu-item`), and on `onClose` restore
focus to the element that opened it (capture `document.activeElement` before opening, or have
SessionManager pass the trigger ref). Add `aria-label="Session actions"` to the `role="menu"`
div.

## Info

### IN-01: Stale-but-harmless top-of-file comments misdescribe the components

**File:** `src/renderer/Sidebar.tsx:1-8`, `src/renderer/SessionManager.tsx:10-13`
**Issue:** `Sidebar.tsx`'s header still claims "BASIC version — NO create/edit form, NO
rename, NO icon customization, NO collapse, NO keyboard shortcuts (all Phase 4)," but the
file now implements collapse, edit wiring, drag-reorder, and keyboard a11y. Misleading
docs slow future maintainers.
**Fix:** Update the header comment to reflect the current (post-Phase-10) capabilities.

### IN-02: `handleClear` casts `window` to a bespoke `any`-shaped global registry

**File:** `src/renderer/SessionManager.tsx:255-260`
**Issue:** `window as unknown as { __sessionTerms?: Record<string, { clear: () => void }> }`
reaches into an untyped global side-channel. This is an unsafe-cast pattern the project's
TS rules discourage (`avoid any`, prefer typed bridges). It works, but the `__sessionTerms`
contract is invisible to the type system, so a renamed/removed registration silently no-ops.
**Fix:** Declare `__sessionTerms` once in a shared ambient `.d.ts` (e.g. augment `Window`) so
both the writer (SessionView) and reader (SessionManager) share a checked type.

### IN-03: `onSwitchSession` effect depends on `[handleClear]` but reads `sessionsRef`/`setSearchOpenId`

**File:** `src/renderer/SessionManager.tsx:519-545`
**Issue:** The effect's dep array is `[handleClear]` (line 545). `handleClear` is stable
(empty deps), so the effect binds once — which is the intent — but listing `handleClear`
as the sole dep is incidental: the effect also closes over `setActiveId`/`setSearchOpenId`
(stable setters) and `sessionsRef` (a ref). It happens to be correct, but the dep is
misleading; a future edit that makes `handleClear` non-stable would re-bind the switch
subscription, reintroducing the race the comment (lines 140-143) warns against.
**Fix:** Use `[]` and rely on the refs/stable setters already in place, with a comment that
the once-bind is intentional (mirroring the pattern the author documented for the status sub).

### IN-04: `context-menu-item-danger` hover/focus rule lives in `terminal.css`, not `sidebar.css`

**File:** `src/renderer/terminal.css:274-325`
**Issue:** Phase 10 extracted sidebar rules into `sidebar.css`, but the entire context-menu
block (including the new D-15 `.context-menu-item-danger`) remains in `terminal.css`. The
context menu is a sidebar-row affordance (opened from `.sidebar-row`), so its styles arguably
belong with the sidebar extraction for cohesion. Not a bug — but it splits the menu's visual
contract across two files, which the extraction was meant to reduce.
**Fix:** Consider moving the `.context-menu*` block to `sidebar.css` (or a dedicated
`context-menu.css`) so the menu's tokens-completeness coverage and visual rules sit together.
Low priority.

### IN-05: ui-lab waiting surface is permanently skipped — the highest-attention signal has zero capture coverage

**File:** `tests/ui-lab/surfaces.ts:320-342`, `tests/ui-lab/DESIGN-RUBRIC.md:131-145`
**Issue:** The `sidebar-waiting` surface unconditionally `throw new SkipSurface(...)`, so the
amber waiting treatment — the design's single most important "needs me" cue — is never
screenshotted by the harness and relies entirely on the manual gate (which flagged it as
broken). The rubric acknowledges this (DESIGN-RUBRIC.md:132-135), but a permanently-skipped
surface means a regression in the amber styling would never be caught by `npm run ui:shots`.
**Fix:** Add a deterministic injection seam for the harness to set `data-agent="waiting"` on a
row directly (e.g. a test-only `applyCssOverride`-style DOM poke that toggles the attribute),
capturing the *styling* even though the real detector can't be driven. This separates "does
the CSS render amber" (capturable) from "does the detector emit waiting" (manual). Pairs with
the WR-02 fix.

### IN-06: Comment claims `.row-icon-color` keeps a "20x20 row-icon footprint" but the icon tile is 34px

**File:** `src/renderer/sidebar.css:103-112,477`
**Issue:** `.sidebar-row .row-icon` is now `34px × 34px` (line 104-105, D-04 large tile), but
the `.row-icon-color` comment at line 477 still says "Keep the 20x20 row-icon footprint."
Stale dimension in a comment; the actual rule inherits the 34px box. Harmless but confusing
when sizing the color-badge initial.
**Fix:** Update the comment to "34×34" to match the current `.row-icon` size.

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
