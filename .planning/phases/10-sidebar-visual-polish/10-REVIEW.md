---
phase: 10-sidebar-visual-polish
reviewed: 2026-06-11T14:30:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/renderer/Sidebar.tsx
  - src/renderer/__tests__/sidebar-agent-attr.test.ts
  - src/renderer/row-secondary.ts
  - src/renderer/sidebar.css
  - tests/ui-lab/surfaces.ts
findings:
  critical: 0
  warning: 5
  info: 1
  total: 6
status: issues_found
---

# Phase 10: Code Review Report (gap-closure delta, plan 10-05)

**Reviewed:** 2026-06-11T14:30:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found
**Scope:** Delta review of commits `08dcda8..bf29389` (plan 10-05 gap closure for prior
findings WR-01..WR-04 + IN-05). Known open items GAP-10-D / GAP-10-E / GAP-10-F are
already routed to plan 10-07 and are NOT re-raised here.

## Summary

The four gap-closure changes were traced end to end. Verdict on the prior findings:

| Prior finding | Fix | Verdict |
|---|---|---|
| WR-03 (stale agentState → false amber) | `rowAgentAttr()` pure running-gate + 8 unit tests | **Sound.** Verified `presentation()` (status-colors.ts:71-77) already gates the dot/label overlay on `status === 'running'`, so the data-agent gate makes ALL amber surfaces (edge bar, wash, dot, label) consistent. Tests pass (8/8, vitest run confirmed). |
| WR-04 (waiting-vs-active edge-bar precedence order-dependent) | Compound selector `.sidebar-row.active[data-agent='waiting']` paired with the bare selector, mirrored in the collapsed rail | **Sound.** Specificity math verified: expanded (0,3,0) beats `.sidebar-row.active` (0,2,0) order-independently; collapsed mirror (0,5,0) beats `.sidebar.collapsed .sidebar-row.active` (0,4,0) order-independently. The bare collapsed waiting selector alone would have TIED (0,4,0) with the collapsed active rule — the added compound selector is what makes it order-independent, exactly as the comment claims. |
| WR-01/GAP-10-A (hover controls crush the name at rest) | Zero-collapse `max-width/padding/border-width → 0` at rest | **Partially defeated** — see WR-01 below: the `border-width: 0` declaration is dead code, clobbered by a later equal-specificity `border:` shorthand. The dominant reservation (24px width + gaps + margin) IS gone, but ~2px per hidden control remains, and dormant rows retain a larger residual (WR-02). |
| IN-05 (sidebar-waiting surface skipped) | Deterministic DOM `data-agent='waiting'` poke on a real running row | **Works but fragile** — two robustness gaps (WR-04, WR-05 below). The React-survival assumption is correct: React never manages `data-agent` when `agentAttr` is undefined on both sides of a re-render, so the poked attribute survives PTY-driven re-renders. The poke also lands on the ACTIVE row, so the capture exercises the WR-04 active+waiting precedence visually — good. |

Also verified: the GAP-10-A claim "the E2E driver addresses every data-testid" holds —
`clickByTestId` (xterm-driver.ts:396-401) uses `browser.execute(el.click())`, a
programmatic JS click that bypasses WebDriver interactability checks, so zero-width
controls remain drivable. No security-relevant surface in this delta. No Critical
findings; five Warnings and one Info follow.

## Narrative Findings (AI reviewer)

### Warnings

#### WR-01: `border-width: 0` at rest is dead code — clobbered by the later `border:` shorthand, leaving ~2px per hidden control

**File:** `src/renderer/sidebar.css:201-208` (rest block) vs `src/renderer/sidebar.css:234-249` (compact-button block)
**Issue:** Both rules share the selector `.sidebar-row .row-control` (specificity 0,2,0).
The GAP-10-A rest block (line 206) sets `border-width: 0`, but the pre-existing
compact-button block at line 243 — LATER in source order — sets the shorthand
`border: 1px solid transparent`, which expands to `border-width: 1px` and wins the
cascade. The intended zero-border at rest never applies. There is no universal
`box-sizing: border-box` reset in this codebase (only per-element opt-ins; `.row-control`
is content-box), so `max-width: 0` clamps only the content box and each unrevealed
control still renders 2px wide (1px left + 1px right border; `overflow: hidden` clips
content, not borders). A non-dormant row at rest carries 2 hidden controls (✎ + ✕) ≈ 4px
residual; a row with Restart carries 3 ≈ 6px. The stated invariant in the comment block
("an unrevealed control consumes no layout width") is false. Same root cause makes the
revealed box 26px, not the "24px = the .row-control width below" the line-210 comment
claims (24px max-width + 2px border, content-box).
**Fix:** Move the zero-collapse declarations into a rule placed AFTER the compact-button
block (or merge the two blocks so the rest state is declared last):
```css
/* AFTER the compact-button block: */
.sidebar-row .row-control {
  opacity: 0;
  max-width: 0;
  overflow: hidden;
  padding: 0;
  border-width: 0; /* now actually wins over the `border:` shorthand above */
  transition: opacity var(--duration-fast) var(--ease-standard);
}
```
Alternatively add `box-sizing: border-box` to `.row-control` and keep a single
declaration order that ends in the rest state.

#### WR-02: Dormant rows still reserve ~12-18px of dead trailing space — flex `gap` applies between zero-width hidden controls

**File:** `src/renderer/sidebar.css:181-188` (reveal/dormant `.row-controls` rule), `src/renderer/Sidebar.tsx:349-412` (dormant row renders ⏵/✎/🗑 as hover-revealed)
**Issue:** `.sidebar-row[data-dormant] .row-controls` restores `gap: var(--space-1)`
(4px) so the always-visible ghost ▶ keeps its spacing. But flex `gap` is inserted
between ALL flex items regardless of their width — and a dormant row at rest holds the
visible ▶ plus up to 3 zero-collapsed controls (⏵ start-no-cmd when a startupCommand is
saved, ✎ edit, 🗑 delete; only `.row-control-start` is exempted from the collapse). That
is 3 inter-item gaps (12px) plus the WR-01 border residual (6px) ≈ 18px of invisible
reserved width trailing the ▶ on every Inactive-List card — a partial recurrence of the
exact name-crush GAP-10-A set out to close, on the bucket whose rows carry the longest
secondary text (startup commands). The comment at lines 173-176 accounts for the
standing `margin-left` but not for the inter-item gaps.
**Fix:** Scope the dormant exemption so only the ▶ contributes layout: keep
`gap: 0` on the dormant container and give the exempted button its own spacing, e.g.
```css
.sidebar-row[data-dormant] .row-controls { gap: 0; margin-left: var(--space-1); }
.sidebar-row[data-dormant]:hover .row-controls,
.sidebar-row[data-dormant]:focus-within .row-controls { gap: var(--space-1); }
```
(`margin-left` on `.row-control-start` works equally well.)

#### WR-03: Broken type-import path in the new test — `'../shared/types'` resolves to nonexistent `src/renderer/shared/types`

**File:** `src/renderer/__tests__/sidebar-agent-attr.test.ts:16`
**Issue:** The test imports `SessionStatus` from `'../shared/types'`, which from
`src/renderer/__tests__/` resolves to `src/renderer/shared/types` — a directory that
does not exist (verified). Every sibling test uses `'../../shared/types'`
(icon-spec.test.ts:9, apply-status-event.test.ts:15, session-switch.test.ts:9, etc.).
The defect is silent today for two stacked reasons: (1) it is a type-only import, erased
by vitest's esbuild transform, so the suite runs and passes (confirmed: 8/8); (2)
`tsconfig.json` excludes `src/**/__tests__/**`, so `tsc` never sees it. But the
`const nonRunning: SessionStatus[]` annotation is the test's completeness mechanism —
the thing that would flag a future 6th status missing from the non-running sweep — and
with the module unresolvable, no type-aware tool (IDE TS server shows TS2307; any future
test-inclusive typecheck) can enforce it. The typed guard the test header advertises is
not actually typechecking anywhere.
**Fix:**
```typescript
import type { SessionStatus } from '../../shared/types';
```

#### WR-04: ui-lab `sidebar-waiting` has no cleanup — the fabricated amber attribute leaks into every subsequent capture

**File:** `tests/ui-lab/surfaces.ts:320-348`
**Issue:** The surface pokes `data-agent='waiting'` onto a real row's DOM node and never
removes it. React will not strip it (it never managed the attribute — `agentAttr` is
undefined on both sides of every re-render), so the amber edge bar + wash persist on
that row through the remaining registry: the `inactive-recipes` capture and the
`sidebar-collapsed` capture (where the collapsed waiting rule at sidebar.css:472-475
paints an amber edge tile) both ship a waiting-amber row that no real state produced.
Surfaces are allowed to build on prior state, but this is fabricated STYLING-only state
contaminating shots whose `expects` say nothing about amber — a design reviewer of the
collapsed-rail capture sees an unexplained reserved-amber signal, and the amber-reserved
contract (TERM-09) makes that actively misleading. The `Surface.cleanup` hook exists for
exactly this.
**Fix:**
```typescript
cleanup: async (ctx) => {
  await browser.execute((sid: string) => {
    document
      .querySelector<HTMLElement>(`.sidebar-row[data-session-id="${sid}"]`)
      ?.removeAttribute('data-agent');
  }, ctx.ids[ctx.ids.length - 1]);
},
```
(Or record the poked id in a local, since `ctx.ids` may grow.)

#### WR-05: The seam can silently no-op — `row?.setAttribute` with no verification the attribute (or the amber paint) landed

**File:** `tests/ui-lab/surfaces.ts:339-346`
**Issue:** If the `querySelector` misses (row remounted, id stale, selector drift), the
optional-chained `setAttribute` no-ops, `prepare()` resolves successfully, and the
harness records a "captured ok" screenshot of a plain non-amber row under the
`sidebar-waiting` title — a false success for the one surface whose entire purpose is
proving the amber CSS renders. The same blindness applies to CSS drift: if the
`[data-agent='waiting']` rule were renamed, this surface would keep passing. Every other
surface in this file gates on observable state (`waitForTestId`, `waitUntil` on row
text/containers); this one gates on nothing.
**Fix:** Assert the styling observably landed before capture, e.g.:
```typescript
await browser.waitUntil(
  async () =>
    browser.execute((sid: string) => {
      const row = document.querySelector<HTMLElement>(
        `.sidebar-row[data-session-id="${sid}"]`,
      );
      return row?.getAttribute('data-agent') === 'waiting';
    }, id),
  { timeout: 2000, interval: 100, timeoutMsg: 'data-agent="waiting" did not land' },
);
```
(Asserting the computed `border-left-color` against the amber token would additionally
catch CSS drift; this overlaps the GAP-10-F assertion work and could be folded there.)

### Info

#### IN-01: New `browser.pause(300)` sleep added to the waiting surface

**File:** `tests/ui-lab/surfaces.ts:347`
**Issue:** Testing policy forbids sleep-based waits ("wait on observable state"). The
new surface adds a fresh `pause(300)` "let the paint settle" sleep. This follows the
file's pre-existing capture idiom (every surface pauses before its shot, and a style
recalc has no DOM state to await), so it is noted rather than escalated — but the
WR-05 `waitUntil` would subsume most of what this pause is hedging against.
**Fix:** Adopt the WR-05 `waitUntil`; keep at most a short post-assert settle if WebGL
paint timing demands it.

---

_Reviewed: 2026-06-11T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
