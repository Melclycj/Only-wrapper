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

---

# Rounds 2-4 delta review (plans 10-07 / 10-08 / 10-09 / 10-11 / 10-12)

**Reviewed:** 2026-06-12 (gate plan 10-13, Task 1 — discharges the round-3 DEFERRED
delta-review obligation, extended to also cover the round-4 `10-12` deltas)
**Depth:** standard
**Scope:** the gap-closure source changes across commits `08dcda8^..4e03d84` for the
reviewed surfaces — `src/renderer/Sidebar.tsx`, `src/renderer/sidebar.css`,
`src/renderer/SessionView.tsx`, `src/renderer/agent-tick.ts`,
`src/renderer/SessionManager.tsx`, `tests/ui-lab/surfaces.ts`,
`src/renderer/__tests__/{agent-tick,sidebar-agent-attr,start-affordances}.test.ts`.
`src/renderer/start-affordances.ts` and `src/shared/agent-state.ts` are **unchanged** in
this range (verified: `git log 08dcda8^..4e03d84 -- src/renderer/start-affordances.ts`
returns no commits — the R3 2026-06-09 dedup reducer is consumed, not changed).
**Status:** clean — **0 Critical / 0 High / 0 Medium / 2 Low / 3 Info**.

## Verdict per change

| Plan | Change | Verdict | Evidence |
|---|---|---|---|
| 10-07 | `agentGateOpen(runningProp, sawRunningEvent)` gate-seeding fix (GAP-10-D) | **Sound** | The fix is the smallest diagnosed-link change: a pure `runningProp \|\| sawRunningEvent` helper + a `running` prop read via `runningRef` so the keep-alive mount effect (keyed on `id`) never re-binds. D-12 (close on dormant/exited) preserved — leaving 'running' flips `sawRunningEvent` false AND SessionManager flips the prop. No race re-introduced; the keep-alive xterm mount untouched. RED→GREEN proven in 10-07 by reverting the helper. |
| 10-07 | dev trace seam `window.__AGENT_TRACE` in `agentTick` | **Sound (dev-gated, INERT in prod)** | `SessionView.tsx:425-439` — the only `console.log` in the shipped agent path is wrapped by `if (trace)` where `trace = window.__AGENT_TRACE === true`. No UNCONDITIONAL `console.*` in `agent-tick.ts` / `SessionView.tsx` / `Sidebar.tsx` / `start-affordances.ts` / `agent-state.ts` (grep confirmed). Never IPC/persisted. Satisfies CLAUDE.md no-console rule. |
| 10-08 | gutter compaction + WR-01 `box-sizing:border-box` + WR-02 dormant-gap | **Sound** | tokens-only (no migrated literals — `tokens-completeness.test.ts` 14/14 guards it); WR-01 fix is order-independent (survives a future block reorder); WR-02 splits the combined reveal selector so dormant rest uses `gap:0`. No dead rules introduced. |
| 10-09 | `assertNameNotCrushed` / `assertLongNameDegradesGracefully` harness + WR-03 import + WR-04 cleanup + WR-05 `waitUntil` | **Sound** | The harness assertions **throw a descriptive `Error`, NOT `SkipSurface`** (surfaces.ts:167-196), so a name-crush regression FAILS loudly; WR-04 `cleanup` records the poked id in a module-scoped var and `removeAttribute`s it so the fabricated amber never leaks to later captures; WR-05 `waitUntil` gates the no-op risk on observable `data-agent='waiting'`. WR-03 import corrected to `'../../shared/types'`. |
| 10-11 | active-row control zero-collapse (GAP-10-G) | **Sound** | CSS-only deletion of `.sidebar-row.active` from the two control-reveal selector groups so the active row inherits the at-rest zero-collapse; keyboard reveal (`:focus-within`/`:focus-visible`) intact; the 10-09 assertion threshold and the fixture were NOT relaxed — the medium name fits because the CSS reclaimed 52px. |
| `10-12` | GAP-10-H exactly-one-Start render-path gate + DOM assertion | **Sound** | The `Sidebar.tsx` row-local `activeIsCard` is byte-semantically identical to `SessionManager.activeIsCard` (`status === 'not_started' \|\| status === 'error'`, the Sidebar copy additionally `isActive`-scoped as documented) — confirmed at SessionManager.tsx:615-616 vs Sidebar.tsx:224-225. The change is a **comment-lock, no logic change** (the predicate was already correct per spike 004). The unit truth-table (states 2/2b + a non-active control case) and the live-DOM `assertSingleStartAffordance` (throws `Error`, counts `start-session`+`start-no-cmd-session`+`idle-start-session`, gated on the observable `idle-card` mount) pin it. No duplicate Start re-introduced on any other state. |
| `10-12` | GAP-10-I D-09 amendment to wash-only | **Sound (sanctioned spec change, not a check relaxation)** | The expanded waiting `border-left` edge-bar rule + the now-obsolete WR-04 compound precedence selector (`.sidebar-row.active[data-agent='waiting']`) were REMOVED together — **no dead rule left** (with no waiting bar there is no precedence to arbitrate; only a comment references the removed selector, grep confirmed no live `active[data-agent` rule remains, no `border-left` waiting rule remains). The amber WASH (`--accent-waiting` color-mix) and the active row's own status-colored edge bar (D-05/D-06, expanded + collapsed) are PRESERVED. Collapsed waiting falls back to the amber `.collapsed-status-dot`. `assertNameNotCrushed`/`assertLongNameDegradesGracefully` byte-for-byte unchanged. |

## Findings

### Low

#### LO-R24-01: `start-affordances.ts` not present in the round-2-4 diff range despite being a "changed source surface" in the plan's review list
**File:** `src/renderer/start-affordances.ts` (no change in `08dcda8^..4e03d84`)
**Issue:** The plan lists `start-affordances.ts` among the surfaces to review, but it was last changed by the R3 2026-06-09 dedup reducer (`1911d40 fix(06.1)`), OUTSIDE the rounds 2-4 range. 10-12 consumes it unchanged.
**Disposition:** Not a defect — informational. The reducer was reviewed at its own R3 landing; 10-12's truth-table (`start-affordances.test.ts`) re-exercises it as the GAP-10-H pin. No action.

#### LO-R24-02: spike-004 throwaway driver not yet listed in deferred-items.md lint baseline
**File:** `.planning/spikes/004-dormant-start-dup/trace-affordances.cjs`
**Issue:** `deferred-items.md` enumerates the 12 tolerated pre-existing spike `.cjs` lint errors across spikes 001/002/003. Spike 004 (added by 10-12) is not listed.
**Disposition:** Verified harmless — spike-004's `.cjs` uses ESM imports (no `require()`); `npx eslint .planning/spikes/004-dormant-start-dup/trace-affordances.cjs` exits **0**. It adds NO tolerated errors, so the baseline of 12 is unchanged and the lint gate's tolerance accounting is still accurate. No remediation required; a future doc-tidy could note it for completeness. Not blocking.

### Info

- **IN-R24-01:** the 10-07 `running` prop is correctly threaded — `SessionManager` passes `running={s.status === 'running'}`; the gate combines it with the live event so a stale prop lagging a frame still closes on the live `'running'`-leave. Defensive and correct.
- **IN-R24-02:** the 10-12 `assertSingleStartAffordance` counts the IdleCard `idle-start-session` globally (not row-scoped) — safe because only the active session's card is mounted, as the code comment states.
- **IN-R24-03:** the 10-08 WR-01 `box-sizing:border-box` makes the revealed `max-width:24px` the true border-to-border width; the stale "24px = the .row-control width below" comment was corrected. Good hygiene.

## Critical/High fixes applied pre-gate

**None required.** Zero Critical and zero High findings across all rounds-2-4 deltas. `npx tsc --noEmit` exits **0** (no fix was needed; baseline green confirmed at review time). The two Low findings are dispositioned above (both non-blocking, no code change). The deferred round-3 review obligation is hereby discharged with a clean verdict — nothing reaches the human gate that a Critical/High should have caught first.

---

_Reviewed: 2026-06-12 (gate plan 10-13, Task 1)_
_Reviewer: Claude (gsd-code-reviewer, delta pass over 08dcda8^..4e03d84)_
_Depth: standard_

---

# Round-5 delta review (plan 10-14 — GAP-10-J + GAP-10-K)

**Reviewed:** 2026-06-13 (gate plan 10-15, Task 1)
**Depth:** standard
**Scope:** the round-5 source deltas across commits `e395509^..0cd0662`:
`src/renderer/agent-tick.ts` (new `sampleAgentFrame`), `src/renderer/SessionView.tsx`
(viewportLines delegation + xterm fontFamily CJK fallback), `src/main/pty-locale.ts`
(new `resolvePtyLocale`), `src/main/pty-manager.ts` (spawn-env wiring),
`src/renderer/tokens.css` (`--font-mono` CJK fallback), and the two new regression tests
`src/renderer/__tests__/agent-frame-sample.test.ts` + `src/main/__tests__/pty-locale.test.ts`.
**Status:** clean — **0 Critical / 0 High / 0 Medium / 0 Low / 1 Info**.

## Verdict per change

| Plan | Change | Verdict | Evidence |
|---|---|---|---|
| 10-14 | GAP-10-J `sampleAgentFrame(buffer, rows)` reads `baseY` not `viewportY` | **Sound** | The sampler reads `buffer.getLine(buffer.baseY + i)` for `i in 0..rows` — the live-tail anchor (`baseY === viewportY` only at the bottom; `viewportY < baseY` when scrolled up), so the classified frame is scroll-position-independent. Pure / DOM-free via a minimal structural `AgentFrameBuffer` interface (no xterm import, no cast). Preserves the original `ln ? translateToString(true) : ''` semantics (missing line → ''). Still reads the live region only, so the 001 stale-scrollback-menu mitigation is preserved (a menu left in scrollback is no longer in the sampled set). |
| 10-14 | SessionView `viewportLines()` delegates to `sampleAgentFrame(term.buffer.active, term.rows)` | **Sound** | Both call sites (the `decideAgentTick` tick AND the dev-only `__AGENT_TRACE` block) now read the same baseY source through the one helper. The keep-alive mount (effect keyed on `id` only) and the xterm/PTY data path (`term.write`, `onPtyData`, `ptyWrite`) are untouched — the change is a read-source swap. xterm's real `IBuffer` satisfies `AgentFrameBuffer` structurally (no `any`, no cast hack). |
| 10-14 | GAP-10-K `resolvePtyLocale(env, platform?)` (locale) | **Sound** | Honors an inherited UTF-8 `LC_ALL` (POSIX precedence) OR `LANG` → returns `{}` (the broad-blast-radius mitigation: a user's `zh_CN.UTF-8`/`ja_JP.UTF-8` is never clobbered); defaults `en_US.UTF-8` only when no UTF-8 locale is inherited (Finder-launch or bare C/POSIX); returns `{}` on win32 (ConPTY code-page model, no POSIX LANG injected). Pure — no node-pty/electron import (grep-confirmed). Case-insensitive `.utf-8`/`utf8` detection covers the common spellings. |
| 10-14 | spawn-env wiring in `pty-manager.ts` | **Sound** | `...resolvePtyLocale(process.env)` is spread **AFTER** `...process.env`, so the override order is correct: an inherited UTF-8 LANG survives (resolver returns `{}`), and a bare `C`/`POSIX` is upgraded (resolver's `en_US.UTF-8` overrides the earlier `LANG: 'C'`). No other spawn-arg change; no bridge edit (`src/main/window-config.ts` has no diff — EXPECTED_API_KEYS stays 20). No unconditional `console.*` added. |
| 10-14 | GAP-10-K font stack (`--font-mono` + xterm `fontFamily`) | **Sound** | `'JetBrains Mono', 'PingFang SC', 'Microsoft YaHei', monospace` in BOTH `tokens.css` (the CSS consumers inherit it via `var(--font-mono)`) and the xterm `fontFamily` literal (xterm can't read CSS custom properties, so the stacks are kept identical). JetBrains Mono stays the PRIMARY Latin identity; the CJK families are OS-provided (no font FILE bundled — no supply-chain surface; `@fontsource` imports unchanged); generic `monospace` stays last. `@xterm/addon-unicode11` already fixes CJK to 2-cell width. `tokens-completeness.test.ts` does not scan tokens.css for the literal so the edit is not tripped (14/14 green). |
| 10-14 | the two new regression tests | **Sound (genuine, not tautologies)** | `agent-frame-sample.test.ts`: the scroll-invariance assertions (`scrolledUp.toEqual(atBottom)` + `classify(...) === 'free'` for both scroll positions) would FAIL on the old `viewportY` code (scrolled-up would sample the scrollback menu) — and a separate case proves a LIVE-tail menu still classifies `'waiting'` (guards against a blindly-return-free regression). `pty-locale.test.ts`: 8 truth-table rows (default / honor LANG / honor LC_ALL / case-variant utf8 / C→upgrade / linux / win32-noop×2). No `sleep`/`waitForTimeout`; pure unit tests. |

## Findings

### Info

#### IN-R5-01: `resolvePtyLocale` sets `LC_ALL` (the override-all category) when defaulting
**File:** `src/main/pty-locale.ts:60-62`
**Issue:** When no UTF-8 locale is inherited, the resolver returns BOTH `LANG` and `LC_ALL = en_US.UTF-8`. `LC_ALL` overrides every `LC_*` category, so in the (rare) case a user launched with ONLY a non-UTF-8 `LC_CTYPE` set and no `LANG`/`LC_ALL`, that `LC_CTYPE` would be superseded by `en_US.UTF-8`.
**Disposition:** Accepted, non-blocking. The default branch only fires when there is no UTF-8 `LANG`/`LC_ALL` (the empty Finder-launch env, or a bare `C`/`POSIX`) — there is effectively nothing to clobber in that state, and setting `LC_ALL` is the most robust guarantee of UTF-8 for the Finder-launch case the gap targets. Both the inherited and the default value would be UTF-8 (or upgrading from C), so the core value (CJK rendering) is preserved either way. A user who deliberately needs a different ctype can still set it via a per-session startup command. No action.

## Critical/High fixes applied pre-gate

**None required.** Zero Critical and zero High findings on the round-5 deltas. `npx tsc --noEmit` exits **0** (no fix needed; baseline green). The single Info is dispositioned above (no code change). Consistent with the rounds 2-4 verdict — nothing reaches the human gate that a Critical/High should have caught first.

---

_Reviewed: 2026-06-13 (gate plan 10-15, Task 1)_
_Reviewer: Claude (gsd-code-reviewer, delta pass over e395509^..0cd0662)_
_Depth: standard_
