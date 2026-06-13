# Phase 11: Terminal Area Polish + Session Lifecycle Simplification - Research

**Researched:** 2026-06-13
**Domain:** Electron/React/xterm renderer polish + careful deletion (restart-UI removal) on a shipped app
**Confidence:** HIGH (O-1 and O-2 fully resolved in-codebase via direct source reads; no external unknowns)

## Summary

Phase 11 is **polish + careful deletion**, not greenfield. The design system is LOCKED (Phase 9 tokens, Switchboard direction); the UI-SPEC is approved (6/6 dimensions). The genuine technical work is two threads: (UI-03) wrap the active `IdentityHeader` + terminal viewport into one framed card on the cream `--bg` without breaking xterm fidelity, and (SESS-07) delete the restart UI entry points while keeping the `ptyRestart` machinery hidden.

Both open questions resolve cleanly **in favor of the planned approach** after tracing the live code:

- **O-1 (restart-removal coherence) — SAFE.** Removing the sidebar `↻` and the context-menu Restart leaves **no row dead-ended**. The reason is upstream, in `src/main/pty-manager.ts`: a self-exiting session is routed at `onExit` to one of exactly two destinations — an **identity/recipe** session moves to `dormantRecords` as `not_started` (→ Inactive List with `Start ▶`), and an **ephemeral** session is **`delete()`d entirely** (the row vanishes). There is no surviving `exited`/`stopped`/`error` row left in the Working Area for a normally-behaving session. The `!running && !dormant` sidebar branch (the `↻` button) is therefore the recycle affordance for a state that, post-routing, **surviving rows do not occupy**. Removal is coherent; recycle = Remove → (Inactive List) → Start ▶. (One residual edge — `error` cards — is addressed below; it is already handled by the IdleCard Retry path, not by `↻`.)

- **O-2 (fit re-fit) — SAFE with one explicit guardrail.** `@xterm/addon-fit`'s `fit.fit()` is wired to a **`ResizeObserver` bound to `mountRef.current`** (the `.term-mount` inner div, `inset:0`), plus a `window.resize` listener, both debounced and guarded by `fit.proposeDimensions()`. As long as the D-03 card padding/gutter is applied to the **wrapper/ancestor** (`.terminal-area` / a new card element / `.viewport-stack`) so that `.term-mount`'s rendered box changes size, the ResizeObserver fires automatically and re-fits correctly. The one hard rule: **never put `border-radius`/`padding` on `.session-view .xterm*` / `.term-mount` itself** — that path has no re-fit and would clip cells. Frame the container; the existing observer does the rest.

**Primary recommendation:** Treat the card frame as a pure container-layer wrapper around the existing `.terminal-area` children; rely on the existing `ResizeObserver`-on-`.term-mount` for the re-fit (do NOT add a one-shot fit). For restart removal, delete the two UI sites + the `onRestart` prop thread, convert the context-menu ternary to a non-Restart shape, and update the three restart-asserting smoke specs **in the same plan**; keep `handleRestart`/`window.api.ptyRestart`/main untouched so `EXPECTED_API_KEYS` stays 20.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Card framing (radius/padding/shadow/gutter) | Renderer (CSS) | — | Pure presentation; `terminal.css` (or new `terminal-area.css`) wraps existing `.terminal-area` children |
| xterm re-fit after layout change | Renderer (SessionView) | — | `ResizeObserver` on `.term-mount` + `fit.proposeDimensions()` guard; no main involvement |
| Restart-UI removal | Renderer (Sidebar, SessionManager, ContextMenu) | Tests (smoke + ui-lab) | Delete UI sites + prop thread; tests updated in lockstep |
| `ptyRestart` machinery (kept hidden) | Main (`pty-manager.ts`) | Renderer (`handleRestart` dormant helper) | KEPT un-surfaced — D-01; `EXPECTED_API_KEYS` stays 20 |
| Self-exit → bucket routing (the O-1 safety net) | Main (`pty-manager.ts onExit`) | Renderer (`apply-status-event.ts` / `session-status.ts`) | Main routes identity→dormant, ephemeral→delete; renderer mirrors via `resolveRowStatus` |
| Agent-aware close copy | Renderer (`SessionManager` confirm branch) | — | Reads renderer-only `agentState`; `ConfirmModal` stays dumb — D-04 |

## Standard Stack

No new packages this phase. This is a renderer-only CSS/JSX/copy change consuming already-installed, already-pinned dependencies.

### Core (already installed — verified in package.json)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xterm/xterm` | 5.5.0 | Terminal renderer | Locked stack; xterm content path is frozen this phase |
| `@xterm/addon-fit` | 0.10.0 | Compute cols/rows against the mount box | The O-2 re-fit mechanism; already wired |
| `@xterm/addon-webgl` | 0.18.0 | GPU renderer (active pane only) | Untouched — fidelity guard |
| `react` | 19.2.7 | Renderer UI | Locked stack |
| `electron` | 36.9.5 | Desktop shell | Locked stack; `node-pty` ABI-stable under this version |

**Installation:** none — `EXPECTED_API_KEYS` stays 20, no `npm install`, no native rebuild.

**Version note:** `@xterm/addon-webgl` is 0.18.0 here (CLAUDE.md's stack table cites 0.19.x as a target; the installed/pinned value is 0.18.0 — irrelevant to this phase since WebGL is untouched, noted only for accuracy).

## Package Legitimacy Audit

Not applicable — **zero external packages added this phase.** No registry interaction, no slopcheck run needed. If the planner discovers a genuinely-needed new package mid-plan it must gate behind `checkpoint:human-verify` and run the legitimacy gate first (per UI-SPEC §Registry Safety).

## Architecture Patterns

### Terminal-area DOM (current, verified)

```
.terminal-area            (flex column, height:100%)         ← D-03 card gutter applies here or on a new wrapper
├── IdentityHeader (.identity-header)   ← becomes the card CAP
└── .viewport-stack       (position:relative, flex:1, bg:--term-bg)   ← the card BODY ground
    ├── SessionView (.session-view, position:absolute inset:0)  × N   ← keep-alive panes
    │   └── .term-mount   (position:absolute inset:0)  ← xterm opens HERE; ResizeObserver bound HERE
    │       └── .xterm / .xterm-viewport / .xterm-screen  (width/height:100%)  ← NEVER radius/pad these
    └── IdleCard | WelcomeEmptyState   (rendered in the SAME slot when active is dormant/empty)
```

### Pattern 1: Container-layer card frame (D-03 / D-03a)
**What:** Apply `--radius`, `--surface`/`--line` border, `--shadow-pop`, and the `--space-4`→`--space-6` gutter to the **wrapper** (`.terminal-area` or a new card div around header+stack), never to xterm elements.
**When to use:** All of UI-03's framing.
**Why it is safe:** `.term-mount` keeps `inset:0`; the rounded corner masks the container surface, so no terminal cell is cropped. The size change of `.term-mount`'s box (from the new padding/gutter) is what the ResizeObserver observes.

### Pattern 2: Rely on the existing ResizeObserver for re-fit (O-2)
**What:** Do NOT add a manual `fit.fit()` call for the card change. The mount effect already binds:
```ts
// SessionView.tsx ~573-587 (verified)
const onResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (fit.proposeDimensions()) {        // guard: no-op on zero/hidden geometry
      fit.fit();
      window.api.ptyResize(id, term.cols, term.rows);
    }
  }, /* debounce */);
};
const resizeObserver = new ResizeObserver(onResize);
resizeObserver.observe(container);        // container = mountRef.current = .term-mount
window.addEventListener('resize', onResize);
```
**When to use:** Any CSS-only inner-box change. The observer fires on the layout reflow caused by the new padding/gutter.
**Caveat:** The observer watches `.term-mount`. If the card padding is applied such that `.term-mount`'s own rendered dimensions change (the normal case — padding on an ancestor shrinks the absolute-positioned child's box), the observer fires. If a structural TSX change re-parents `.term-mount`, re-confirm the observer still observes the live element (it re-binds per `id` mount — safe).

### Anti-Patterns to Avoid
- **Radius/padding on `.session-view .xterm`/`.term-mount`:** no re-fit path; clips the last row / corner glyphs. Frame the ancestor.
- **A one-shot `fit.fit()` on mount only to "fix" the card:** redundant and masks the real observer; the activate effect (`~625-640`) + ResizeObserver already cover show/resize. Adding an unguarded fit risks a `proposeDimensions()===null` mis-size on a not-yet-laid-out pane.
- **`display:none` to hide a pane:** breaks `fit()`/`proposeDimensions()` (they no-op on non-rendered elements). The codebase uses `visibility:hidden` / off-screen — keep it.
- **Re-deriving the design tokens:** locked (Phase 9). Use `var()` only; `tokens-completeness.test.ts` bans literals.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Re-fit after card framing | A manual resize/`requestAnimationFrame` re-fit loop | The existing `ResizeObserver` on `.term-mount` + `proposeDimensions()` guard | Already wired, debounced, and fidelity-proven; adding a second path risks races/double-fit |
| "Is this row recyclable?" logic | A new status reducer | `resolveRowStatus` / `hasRendererIdentity` (`session-status.ts`) + the main `onExit` routing | Already the single source of truth; main guarantees no dead-end row survives |
| Two-bucket partition in the terminal pane | A second Inactive list inside `.terminal-area` | The existing sidebar partition + the `SessionView ↔ IdleCard` swap | Re-doing it duplicates Phase 10 (explicitly forbidden — CONTEXT Discretion) |
| Agent-busy confirm wiring | New IPC / a persisted agentState field | `activeRecord.agentState` (renderer-only overlay) read by `SessionManager` | D-06: agent state never persisted, never IPC |

**Key insight:** Every "unknown" in this phase already has a proven mechanism in the codebase. The risk is **adding** a redundant path (a manual fit, a new reducer) that fights the existing one, not the absence of a mechanism.

## Runtime State Inventory

> This is a renderer-only restyle + UI deletion. No data migration, no stored-key rename. Inventory is mostly empty by design; categories stated explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — no persisted field references "restart"; `ptyRestart` is an IPC method name, not stored data. `SessionRecord` on disk is unchanged. | None |
| Live service config | **None** — no external services; local-only app (CLAUDE.md). | None |
| OS-registered state | **None** — no Task Scheduler / launchd / pm2 registration tied to restart UI. | None |
| Secrets/env vars | **None.** | None |
| Build artifacts | **None new.** The card restyle does not change packaging. (`ui:shots:fresh` repackages for proof, but that is a verification step, not a stale artifact.) | None |

**The canonical question (rename/delete check):** After deleting the `↻` UI, what runtime systems still reference restart? Answer: only the **kept-hidden** `window.api.ptyRestart` bridge key + main's `restart()` orchestration + the `— restarted —` separator machinery — and these are KEPT by design (D-01). Nothing is left in an inconsistent state because nothing is renamed or migrated; two UI call-sites are removed and the test assertions that drove them are updated in lockstep.

## Common Pitfalls

### Pitfall 1: Leaving a restart-asserting smoke test RED after deleting the UI
**What goes wrong:** Three smoke specs actively drive Restart via the **context menu** (`clickMenuItem('Restart')` / `menuAction(id, 'Restart')`) and assert the `— restarted —` separator. Deleting the menu Restart item without updating them breaks the suite.
**Why it happens:** The context-menu Restart is the LAST reachable UI entry to restart (the header `↻` was already removed in 06.1-04 FIX 3). These tests reach restart through it.
**Affected files (must change in the same plan):**
- `tests/smoke/header-controls.smoke.test.ts` — `clickMenuItem('Restart')` at ~144, ~159; asserts `— restarted` at ~169-170. Also already asserts `header-restart` testid is **absent** (~109) — keep that; ADD an assertion that the context-menu Restart item is gone.
- `tests/smoke/startup-command.smoke.test.ts` — `menuAction(id, 'Restart')` at ~90, ~116; SC3 separator assertion at ~114-129. SC3 is the **D-05-voided** "Restart re-runs the command" criterion — this spec must be **rewritten or removed** to the recycle-without-restart model (Remove → Start re-runs the startup command via `handleStart`'s create-with-id, which `startup-command.smoke` already exercises at ~147 "the SAME hook the Restart path uses, but reached via handleStart").
- `tests/smoke/app-restart-restore.smoke.test.ts` — asserts a dormant first Start has **NO** `— restarted —` separator (~241-244). This stays GREEN and is the *positive* proof of the recycle model — keep it; it does not drive Restart UI.
**How to avoid:** Treat the smoke updates as part of the deletion task, not a follow-up. The separator MACHINERY stays (`hasRunBefore` seam in SessionView writes it on an in-place respawn) — only the UI that *triggers* it is gone, so the separator can simply no longer fire from user action. Decide explicitly: keep the separator code dormant (D-01 "kept hidden") or assert it is now unreachable.

### Pitfall 2: The `error` card edge case in O-1
**What goes wrong:** An `error` session (a failed spawn, pid -1, OR an abnormal exit) renders the IdleCard **error branch** (Edit + Retry), not a sidebar `↻`. After `↻` removal someone might think an errored row has no recycle path.
**Why it happens:** `activeIsCard = status === 'not_started' || status === 'error'` — so an active error row shows the IdleCard with `Retry` (→ `handleStart`). A **non-active** error row stays in the Working Area (`status !== 'not_started'`) and, today, shows `↻` via `!running && !dormant`.
**Resolution (verified):** A non-active error row's `↻` is the only Working-Area recycle button it has. BUT: main's `onExit` routes an **identity** error self-exit to dormant (`not_started`) → it leaves the Working Area entirely; an **ephemeral** error self-exit is `delete()`d. A pid-(-1) spawn-failure error stays as an `error` row but is recycled via the IdleCard Retry when active. So the surviving non-active error rows are identity rows that main already moved to dormant. **Confirm in the plan:** enumerate the `error` row's affordance after `↻` removal and assert Retry (active) + dormant-Start (after main routing) cover it. This is the one state the planner must walk explicitly.

### Pitfall 3: Injection preview shows OLD markup for the structural card change
**What goes wrong:** `UI_LAB_LIVE_CSS=1` previews CSS over the *current* DOM; the card wrapper is a **structural TSX change**, so the preview is INVALID for the framing claim.
**How to avoid:** Use `npm run ui:shots:fresh` (packaged, no-injection) for any structural card claim (UI-SPEC §Verification). CSS-only tweaks to an already-restructured card may preview live.

### Pitfall 4: Re-fit not firing because the observed element didn't change size
**What goes wrong:** If the card padding is applied to an element OUTSIDE `.term-mount`'s sizing chain (e.g., a margin on `.terminal-area` that the OS window absorbs without changing `.term-mount`'s box), the ResizeObserver might not fire.
**How to avoid:** Apply the gutter/padding so `.viewport-stack` (the `.term-mount` ancestor with `inset:0` children) actually shrinks — confirmed by the `proposeDimensions()`-guarded `fit.fit()` producing a smaller cols/rows. Verify via the `app-restart-restore` / scroll / alt-screen smoke specs staying GREEN AND a fresh packaged capture showing no clipped last row.

### Enumerated state × affordance table (O-1 — the deliverable)

After `↻` removal, for a session that has run at least once:

| status | active? | Where it lives | Affordance shown | Recycle path |
|--------|---------|----------------|------------------|--------------|
| `running` | any | Working Area | Clear + Remove (header/row) | Remove → dormant → Start ▶ |
| `not_started` (dormant) | non-active | Inactive List | sidebar `Start ▶` (+ `⏵` if cmd) | Start ▶ (fresh) |
| `not_started` (dormant) | active | Inactive List / IdleCard | IdleCard `▶ Start session` | Start ▶ (fresh) |
| `exited`/`error` **identity** | any | **routed to dormant by main `onExit`** → `not_started` | as dormant above | Start ▶ |
| `exited`/`error` **ephemeral** | any | **`delete()`d by main `onExit`** → row gone | none (row removed) | n/a (was throwaway) |
| `error` (spawn-fail pid -1) | active | Working Area / IdleCard error branch | IdleCard `Edit` + `Retry` | Retry (→ handleStart) |
| `error` (spawn-fail pid -1) | non-active | Working Area | **`↻` today** → after removal, none | **PLANNER: confirm this is recycled via becoming active (Retry) or via Remove; this is the single state the `↻` uniquely served** |
| `stopped` | — | only a **restart precursor** (internal); `removeLive` broadcasts `not_started` not `stopped` | not a user-visible resting state | n/a (transient) |

**Conclusion:** The `↻` button's only unique role for a *surviving* row is the **non-active spawn-fail `error`** row. Every other state is recycled by Start ▶ (after main routing) or Retry (when active). The planner must (a) confirm a non-active spawn-fail error row can be made active (selected) to reach Retry, or (b) accept that selecting it shows the IdleCard error branch — either way the path exists; `↻` is not the sole recycle for any normally-routed row.

## Code Examples

### The two restart-UI deletion sites (verified line ranges)

**Sidebar `↻` button (`Sidebar.tsx` ~334-349) — DELETE the whole block:**
```tsx
{!running && !dormant && (        // ← this branch is the ↻ recycle button
  <button data-testid="restart-session" data-action="restart"
    onClick={(e) => { e.stopPropagation(); onRestart(s.logicalId); }}>
    <span aria-hidden="true">↻</span>
  </button>
)}
```
Also remove the `onRestart` prop from `SortableRowProps`/`SidebarProps` and the comment block at ~132-135 / ~315-317 referencing the Restart affordance.

**Context-menu Restart (`SessionManager.tsx` ~728-730) — the ternary, NOT a standalone item:**
```tsx
menuIsDormant
  ? { label: 'Start', onSelect: () => handleStart(menuState.id) }
  : { label: 'Restart', onSelect: () => handleRestart(menuState.id) },   // ← remove the Restart arm
```
A live (non-dormant) row currently offers context-menu Restart. After D-01 the menu for a live row should offer **no Restart** — the recycle is Remove (already a separate menu item below). Decide: drop the menu entry entirely for live rows, or replace with nothing. `handleStart` stays (dormant arm); `handleRestart` becomes unreachable from UI (kept as a dormant helper per D-01).

**Prop thread (`SessionManager.tsx` ~636):** remove `onRestart={handleRestart}` from `<Sidebar>`. `handleRestart` (~235-246) may stay as dead/dormant code (D-01 explicitly permits) — but flag it `// D-01: retained machinery, no UI entry point`.

### Agent-aware confirm copy (D-04 — the authored copy)
```tsx
// SessionManager.tsx ConfirmModal body (~705-713), add an escalation PREFIX:
const idleBody = removeMode === 'delete'
  ? 'This permanently deletes the saved session — its recipe is gone for good.'
  : closingSession?.configured === true
    ? 'This ends its running process and moves the session to the Inactive List. You can start it again later.'
    : closingIsRunning
      ? 'This ends its running process and removes the session.'
      : 'This removes the session from the sidebar.';
const agent = closingSession?.agentState;        // renderer-only overlay; no IPC, no persist
const escalation =
  agent === 'working' ? "Claude is still working in this session — closing it now will end the task mid-run. "
  : agent === 'waiting' ? "This session is waiting for your input — closing it now will discard what it's asking for. "
  : '';
const body = escalation + idleBody;              // prefix, so the consequence is never lost
```
`ConfirmModal` stays dumb (controlled `body` prop). `closingSession.agentState` is already on the row (threaded to IdentityHeader today). "Claude" may be generalized to "The agent" (UI-SPEC Discretion).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Header `↻` Restart | Removed; live header = Clear + Remove | 06.1-04 FIX 3 | Header already restart-free; this phase removes the REMAINING two (sidebar + context menu) |
| Stop button (keep-as-stopped) | Abolished (D-01 earlier); `stopped` is now only an internal restart precursor | 06.1-04 round 3 | No user-visible `Stop`; simplifies the affordance matrix |
| Restart verb in UI | Recycle = Remove → Start (fresh) | Phase 11 (D-01/D-02/D-05) | SC4 voided; SESS-07 rewritten |

**Deprecated/outdated for this phase:**
- SC4 ("Restart preserves scrollback") — **void** per D-05. Do not write tasks asserting scrollback-preserving restart as a user feature.
- The `— restarted —` separator as a *user-reachable* feature — the machinery stays but no UI triggers it after this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A non-active spawn-fail `error` row (pid -1, never routed to dormant) is the only state the sidebar `↻` uniquely served; it is recoverable by selecting the row (IdleCard Retry) | Pitfalls / O-1 table | LOW — planner must walk this one state explicitly; worst case is a compensating "select to retry" affordance, not a blocker |
| A2 | Applying the card gutter to `.viewport-stack`/`.terminal-area` shrinks `.term-mount`'s box enough to fire the ResizeObserver | O-2 / Pattern 2 | LOW — verifiable instantly via a fresh capture; if not, a single `requestAnimationFrame(fit.fit)` after the structural mount closes it |
| A3 | The context-menu Restart arm is the only remaining non-test UI trigger of `handleRestart` after the sidebar `↻` is gone | Code Examples | LOW — grep-confirmed: `onRestart` flows Sidebar←SessionManager only; no other caller |

**Note:** A1–A3 are LOW-risk because each is verifiable in-session by the planner/executor (grep + a fresh capture). None require user confirmation before planning — they are planner walk-throughs, not locked decisions.

## Open Questions

1. **Non-active spawn-fail `error` row recycle (A1).**
   - What we know: identity self-exits route to dormant; ephemeral self-exits are deleted; active error rows show IdleCard Retry.
   - What's unclear: whether a *non-active* spawn-fail error row (rare) needs any affordance beyond "select it → Retry."
   - Recommendation: in the removal task, add a unit/assert that a non-active error row, when selected, reaches the IdleCard Retry. Do NOT add a compensating Working-Area button unless the walk-through finds a true dead-end.

2. **Keep vs. assert-unreachable for the `— restarted —` separator.**
   - What we know: D-01 keeps the machinery hidden.
   - What's unclear: whether the plan should leave the separator code dormant or add a guard asserting it never fires.
   - Recommendation: leave dormant (matches D-01 "keep the mechanism"); update `header-controls.smoke` to assert the context-menu Restart item is **absent** rather than driving it.

## Environment Availability

> Renderer-only CSS/JSX/copy change — no new external dependencies. Verification tooling is already present.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `vitest` (`test:unit`) | unit truth-tables, guard tests | ✓ | installed | — |
| `wdio` (`test:smoke`) | smoke specs (fidelity guards) | ✓ | installed | — |
| ui-lab harness (`ui:shots`, `ui:shots:fresh`) | packaged no-injection capture | ✓ | `tests/ui-lab/` | — |
| `electron-forge` (`make`/`package`) | `ui:shots:fresh` repackage | ✓ | installed | — |

**Missing dependencies:** none.

## Validation Architecture

> nyquist_validation is enabled (not `false` in config). This section feeds VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Unit framework | Vitest (`npm run test:unit`) |
| Smoke framework | WebdriverIO + `@wdio/electron-service` (`npm run test:smoke`) |
| Visual harness | ui-lab (`npm run ui:shots` injection preview / `npm run ui:shots:fresh` packaged proof) |
| Type/lint | `npx tsc --noEmit`, `eslint .` |
| Full gate | `npm run test` (unit + smoke) + fresh packaged capture + BLOCKING human-verify |

### Observable behaviors → evidence (the nyquist sampling map)
| Behavior to validate | Test type | Command / evidence | Sampling rate |
|----------------------|-----------|--------------------|---------------|
| Terminal still native after framing (scroll, alt-screen, resize, app-restart-restore) | smoke | `app-restart-restore.smoke`, scroll + alt-screen smoke specs GREEN | per wave merge + phase gate |
| No clipped last row / corner glyph clip after card frame | visual | `ui:shots:fresh` `terminal-running` capture scored vs DESIGN-RUBRIC | phase gate (packaged proof) |
| Re-fit fires on card inner-box change | smoke + manual | `proposeDimensions()`-guarded fit produces correct cols/rows; smoke stays GREEN | per task commit |
| Remove → Start recycle works for every state | unit truth-table + smoke | `session-status.test.ts` (`resolveRowStatus`/`hasRendererIdentity`), `app-restart-restore.smoke` (dormant Start, NO separator), `startup-command.smoke` rewritten to recycle model | per wave merge |
| No restart affordance reachable (sidebar `↻` + menu Restart gone) | grep assert + smoke | grep `data-testid="restart-session"` → absent; `header-controls.smoke` asserts menu Restart absent | per task commit |
| `EXPECTED_API_KEYS` stays 20 | unit | `security.guard.test.ts` (dynamic `Object.keys` assertion) GREEN unchanged | per task commit |
| Agent-aware copy fires on working/waiting | unit + visual | unit assert on the body-string branch by `agentState`; ui-lab `agent-busy-confirm` capture | per wave merge |
| Tokens-first (no literals) | unit | `tokens-completeness.test.ts`, `status-colors.test.ts` GREEN | per task commit |

### Sampling Rate
- **Per task commit:** `npm run test:unit` + `npx tsc --noEmit` + `eslint .` (fast loop).
- **Per wave merge:** full `npm run test` (unit + smoke).
- **Phase gate:** full `npm run test` GREEN + `npm run ui:shots:fresh` packaged capture scored vs DESIGN-RUBRIC + **BLOCKING human-verify** (operator confirms framed card + Clear/Remove cluster + no-restart-anywhere + agent-busy copy LIVE). `nyquist_compliant` stays false until that sign-off.

### Wave 0 Gaps
- [ ] Rewrite/remove `tests/smoke/startup-command.smoke.test.ts` SC3 (D-05-voided restart-re-runs assertion) → recycle-without-restart model (Remove → Start re-runs the stored command via `handleStart`).
- [ ] Update `tests/smoke/header-controls.smoke.test.ts` — replace `clickMenuItem('Restart')` drives with an assertion the menu Restart item is absent; keep the `header-restart` absent assertion.
- [ ] Add unit assert: `SessionManager` confirm body escalates by `agentState ∈ {working, waiting}` (pure string-branch test — extract the body builder if needed for testability).
- [ ] Add unit assert: a non-active `error` row's recycle path (select → IdleCard Retry) — closes O-1 A1.
- [ ] (Recommended) Add ui-lab surfaces `terminal-card` (framed live card) + `agent-busy-confirm` (escalated modal) to `tests/ui-lab/surfaces.ts`.
- [ ] grep guard (or smoke assert): `restart-session` testid absent in the packaged build.

## Security Domain

> `security_enforcement` not disabled in config — but this phase is renderer-only presentation/copy with **zero new attack surface**. ASVS categories scoped to what actually applies.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Encoding/Injection (XSS) | yes | All user strings (`name`, cwd, `startupCommand`, the confirm `{name}`) render as React text nodes (auto-escaped). No `dangerouslySetInnerHTML`. (UI-SPEC Copy discipline) |
| V5 Input Validation | n/a (no new input) | No new form/IPC input this phase |
| V6 Cryptography | n/a | — |
| IPC bridge surface | yes (invariant) | `EXPECTED_API_KEYS` stays **20**; `security.guard.test.ts` dynamic assertion must stay GREEN. No bridge key added/removed. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Renderer running node-pty / privileged IPC | Elevation | Unchanged — PTY stays in main; renderer reaches it only via `window.api` (frozen this phase) |
| Unescaped session name/agent copy in confirm modal | Tampering | React text-node auto-escape; no HTML interpolation |
| New IPC key sneaking in via "kept" restart machinery | Elevation | D-01 keeps the EXISTING `ptyRestart` key — 0 added; guard asserts exactly 20 |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)
- `src/main/pty-manager.ts` (`onExit` routing ~575-622, `deriveStatus` ~180-193, `removing`/`removedLive` ~206-213) — the O-1 safety net: identity→dormant, ephemeral→delete
- `src/renderer/session-status.ts` + `apply-status-event.ts` — `resolveRowStatus`/`hasRendererIdentity`, the renderer mirror of the routing
- `src/renderer/SessionView.tsx` (~232-285 mount/fit, ~573-600 ResizeObserver, ~625-640 activate re-fit) — the O-2 re-fit mechanism
- `src/renderer/Sidebar.tsx` (~314-349 `↻` block + ~466-472 partition) — restart-UI removal site + two-bucket partition
- `src/renderer/SessionManager.tsx` (~169-227 close/confirm, ~235-246 `handleRestart`, ~598-616 menu derivations, ~636/660/698-756 props + ConfirmModal + ContextMenu) — removal sites + D-04 copy host
- `src/renderer/terminal.css` (~34-86 terminal-area/viewport-stack/session-view/term-mount) — the framing target surfaces
- `tests/smoke/{header-controls,startup-command,app-restart-restore}.smoke.test.ts` — the restart-asserting tests to update in lockstep
- `package.json` — verified installed versions (`@xterm/xterm` 5.5.0, `@xterm/addon-fit` 0.10.0, react 19.2.7, electron 36.9.5) + test scripts

### Secondary (HIGH — phase artifacts)
- `11-CONTEXT.md` (D-01..D-05, O-1/O-2, canonical_refs), `11-UI-SPEC.md` (selector contract, fidelity guardrail), `.planning/REQUIREMENTS.md` (UI-03/SESS-07 amended), `.planning/STATE.md` (06.1-04 / 10-12 lineage)

## Metadata

**Confidence breakdown:**
- O-1 (restart-removal coherence): **HIGH** — resolved by reading main's `onExit` routing; no surviving normally-routed row is dead-ended. One edge (non-active spawn-fail error) flagged for an explicit planner walk-through (A1).
- O-2 (fit re-fit): **HIGH** — ResizeObserver-on-`.term-mount` + `proposeDimensions()` guard is the wired mechanism; container-layer framing is fidelity-safe. A3/A2 verifiable instantly via fresh capture.
- Standard stack: **HIGH** — no new packages; versions read from package.json.
- Restart test surface: **HIGH** — grep-enumerated; three smoke specs + header-controls absence assertions identified.

**Research date:** 2026-06-13
**Valid until:** stable until the renderer terminal-area code changes (no external/time-sensitive sources).
