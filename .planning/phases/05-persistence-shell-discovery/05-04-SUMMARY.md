---
phase: 05-persistence-shell-discovery
plan: 04
subsystem: renderer-ui

# Dependency graph
requires:
  - phase: 05-persistence-shell-discovery
    plan: 01
    provides: "pure reorder(sessions, fromId, toId) dense-reindex reducer (session-reorder.ts); window.api.persistOrder({id,order}[]) bridge (main validates + persists, T-05-01)"
  - phase: 05-persistence-shell-discovery
    plan: 02
    provides: "PtyManager.setOrder validate-then-persist + store.scheduleSave debounced write"
  - phase: 05-persistence-shell-discovery
    plan: 03
    provides: "Sidebar rows (data-session-id) + Start/Restart flip; SessionManager boot snapshot sorted by order"
provides:
  - "Sortable sidebar (NAV-04/SC3/D-08) — sidebar rows wrapped in dnd-kit DndContext + SortableContext; each row a SortableSidebarRow via useSortable; whole-row drag surface with a PointerSensor activation distance (plain click still switches, control clicks still fire) + KeyboardSensor a11y reorder"
  - "Drag-to-reorder persistence — onDragEnd → SessionManager.handleReorder → pure reorder() dense reindex (optimistic local) → window.api.persistOrder([{id,order}]) (silent, D-13)"
  - "Drag affordance + drag-active styling (UI-SPEC §5) — hover ⠿ handle (--ink-faint, grab→grabbing); lifted row opacity 0.9 + blue focus-ring outline + soft shadow"
  - "reorder.smoke.test.ts — drag-to-reorder persistence smoke (persistOrder bridge → store round-trip, Pitfall 6 dense order)"
  - "Phase 5 Nyquist sign-off — 05-VALIDATION.md nyquist_compliant: true + wave_0_complete: true, full suite green"
affects: [08 (Windows shell enumeration behind the same discoverShells seam — unaffected by reorder)]

# Tech tracking
tech-stack:
  added:
    - "@dnd-kit/core@6.3.1 (exact-pinned, no caret) — renderer drag-and-drop primitives (DndContext, sensors)"
    - "@dnd-kit/sortable@10.0.0 (exact-pinned) — sortable list strategy + useSortable hook"
  patterns:
    - "Per-row useSortable lives in a split-out SortableSidebarRow component (a hook must run at a component's top level, not inside a .map() callback)"
    - "Whole-row drag surface via PointerSensor activationConstraint.distance=5 — preserves the existing click-to-switch + nested-control stopPropagation contract (a drag only begins past the activation distance)"
    - "Reorder follows the SAME pure-reducer-then-persistOrder shape as the other mutations (reorder() → persistOrder), keeping the move+dense-reindex invariant unit-testable React/dnd-kit-free"

key-files:
  created:
    - tests/smoke/reorder.smoke.test.ts
  modified:
    - package.json
    - package-lock.json
    - src/renderer/Sidebar.tsx
    - src/renderer/SessionManager.tsx
    - src/renderer/terminal.css
    - .planning/phases/05-persistence-shell-discovery/05-VALIDATION.md

key-decisions:
  - "dnd-kit attributes/listeners spread FIRST on the row, then explicit role/tabIndex/handlers override — avoids the TS2783 duplicate-prop overwrite (dnd-kit's attributes already sets role=button + tabIndex)"
  - "onKeyDown composes dnd-kit's keyboard-sensor listener with the legacy Enter-to-switch: dnd-kit handles Space/arrows for keyboard reorder; Enter falls through to switch only if dnd-kit did not consume it (Space is now reserved for a11y reorder, not switch)"
  - "Reorder smoke drives the persistOrder BRIDGE (the exact IPC the drag invokes), not a raw pointer drag — CDP cannot drive dnd-kit pointer DnD deterministically; the pure drag gesture is a MANUAL phase-gate (per 05-VALIDATION Manual-Only Verifications)"

patterns-established:
  - "SortableSidebarRow split-out: when a list row needs a per-item hook (useSortable), extract the row into its own component rather than calling the hook in the parent's .map()"

requirements-completed: [NAV-04]

# Metrics
duration: 11min
completed: 2026-06-06
---

# Phase 5 Plan 04: Drag-to-Reorder Vertical Slice + Nyquist Sign-Off Summary

**The drag-to-reorder vertical slice that lets the user drag a sidebar row to a new position and have that order survive an app restart (the literal NAV-04/SC3 launchpad capability) — built on the gate-approved `@dnd-kit/sortable`, the pure `reorder()` dense-reindex reducer (05-01), and the validated `persistOrder` IPC (05-01/02) — plus the Phase 5 green Nyquist sign-off.**

## Performance
- **Duration:** ~11 min
- **Tasks:** 3 (the opening human-verify legitimacy gate was resolved "approved" before this continuation agent ran)
- **Files:** 6 (1 created, 5 modified)

## Accomplishments
- **dnd-kit installed (gate approved).** `@dnd-kit/core@6.3.1` + `@dnd-kit/sortable@10.0.0` installed **exact-pinned (no caret)** per the CLAUDE.md no-caret stack convention — verified in `package.json` as `"6.3.1"` / `"10.0.0"` and confirmed at runtime (`require('@dnd-kit/core/package.json').version` === 6.3.1, sortable === 10.0.0). The blocking human-verify legitimacy gate (Task 1) was resolved by the user ("approved" — author `clauderic`, repo `clauderic/dnd-kit`, no postinstall) before this agent ran; no re-pause.
- **Sortable sidebar (NAV-04/SC3/D-08).** `Sidebar.tsx` wraps the row list in `<DndContext>` (PointerSensor with `activationConstraint.distance: 5` + KeyboardSensor with `sortableKeyboardCoordinates`) + `<SortableContext items={ids} strategy={verticalListSortingStrategy}>`. Each row is a split-out `SortableSidebarRow` using `useSortable({ id: logicalId })`, applying `setNodeRef` + the inline `transform`/`transition` (via `CSS.Transform.toString`). The WHOLE row is the drag surface (dnd-kit `listeners`/`attributes` spread on the container), but the 5px activation distance keeps a plain click switching sessions and the nested control buttons' `stopPropagation` firing (UI-SPEC §5). A hover `⠿` drag handle (`--ink-faint`, `cursor: grab`→`grabbing`) telegraphs draggability.
- **Reorder → persistOrder wiring (silent, D-13).** `onDragEnd` (real move only, `active.id !== over.id`) calls a new `onReorder` prop → `SessionManager.handleReorder`, which applies the **pure `reorder()` reducer** (move + dense reindex 0..n-1, Pitfall 6) for the optimistic local update inside the `setSessions` updater, then calls `window.api.persistOrder(next.map(s => ({ id: s.logicalId, order: s.order })))`. Main validates each `{id, order}` before any write (T-05-01) and the write is debounced — **no save button, spinner, or toast** (D-13 silent persistence). The collapsed rail still renders the saved order (D-08; the drag handle is hidden when collapsed).
- **Drag-active styling (UI-SPEC §5).** `terminal.css` adds the `⠿` `.row-drag-handle` (hover-revealed like `.row-controls`) and a `.sidebar-row.dragging` lift: `opacity: 0.9`, the consistent blue focus-ring outline (`oklch(0.62 0.14 248)`), and the soft shadow `0 6px 18px oklch(0.32 0.012 70 / 0.14)` matching the rail-tooltip.
- **Reorder persistence smoke + Phase 5 sign-off.** `tests/smoke/reorder.smoke.test.ts` drives the SAME `persistOrder` bridge the drag invokes (move the last row to the front), then asserts the persisted store file reflects the new dense order — the moved row at `order: 0`, no duplicate orders (Pitfall 6) — proving the renderer→main-validate→store-write path end-to-end in the BUILT app; a second test asserts the drag-handle affordance is present on every row. The pure pointer-drag gesture is a documented MANUAL phase-gate (CDP cannot drive dnd-kit DnD deterministically). `05-VALIDATION.md` is finalized: `nyquist_compliant: true` + `wave_0_complete: true`, every Per-Task map row marked ✅ green, every Wave 0 + sign-off box checked, Approval dated 2026-06-06.

## Task Commits
1. **Task 1: install @dnd-kit/core@6.3.1 + @dnd-kit/sortable@10.0.0 (gate approved)** — `c6dcf22` (chore)
2. **Task 2: sortable sidebar — dnd-kit reorder wired to persistOrder** — `48452b1` (feat)
3. **Task 3: reorder persistence smoke + Phase 5 Nyquist sign-off** — `c9ff016` (test)

## Files Created/Modified
- `tests/smoke/reorder.smoke.test.ts` (created) — drives persistOrder via the bridge, asserts the persisted dense order round-trips to the store file; drag-handle affordance assertion; MANUAL pointer-drag note.
- `package.json` / `package-lock.json` (modified) — `@dnd-kit/core` `6.3.1` + `@dnd-kit/sortable` `10.0.0` exact pins (pulled transitive `@dnd-kit/accessibility` + `@dnd-kit/utilities`).
- `src/renderer/Sidebar.tsx` (modified) — DndContext + SortableContext wrap; `SortableSidebarRow` (useSortable) split-out; `onReorder` prop; sensors (pointer activation distance + keyboard); ⠿ handle; dragging-state classes/data attrs.
- `src/renderer/SessionManager.tsx` (modified) — `handleReorder` (pure `reorder()` + `persistOrder`, silent); `onReorder={handleReorder}` passed to Sidebar; `reorder` import.
- `src/renderer/terminal.css` (modified) — `.row-drag-handle` (hover-revealed, grab cursor) + `.sidebar-row.dragging` lift styling (UI-SPEC §5); handle hidden in the collapsed rail.
- `.planning/phases/05-persistence-shell-discovery/05-VALIDATION.md` (modified) — frontmatter flipped (nyquist_compliant + wave_0_complete true, status complete); all map rows green; Wave 0 + sign-off boxes checked; Approval dated.

## Decisions Made
- **dnd-kit attributes spread before explicit props.** `useSortable().attributes` already sets `role="button"` + `tabIndex` (+ `aria-roledescription`). Spreading `{...attributes} {...listeners}` FIRST, then re-affirming `role`/`tabIndex` and the explicit handlers, avoids the TS2783 "specified more than once" overwrite while keeping the keyboard-drag a11y wiring.
- **onKeyDown composes dnd-kit + legacy switch.** The row's `onKeyDown` calls `listeners?.onKeyDown?.(e)` first (dnd-kit's keyboard sensor — Space starts/ends a keyboard drag, arrows move it), then falls through to Enter-to-switch only if dnd-kit did not `preventDefault`. Space is now reserved for a11y reorder (no longer a switch key) — a deliberate, minor interaction change to honor "keyboard reorder is supported by dnd-kit" (UI-SPEC §5).
- **Smoke drives the bridge, not a raw drag.** Per the plan's explicit allowance and 05-VALIDATION's Manual-Only Verifications, the smoke exercises `window.api.persistOrder` (the exact IPC the drag fires) and asserts the on-disk dense order; the pure pointer gesture is the human phase-gate. This keeps the smoke deterministic while still proving the load-bearing persist path in the built app.

## Deviations from Plan
None — the plan executed as written. The opening Task 1 legitimacy gate was already resolved "approved" (this is a continuation agent), so the dnd-kit install proceeded directly; no architectural changes, no auto-fixes, no scope creep. (The two interaction decisions above — attribute-spread order and the onKeyDown composition — are implementation details of the planned "pointer-sensor activation distance" + "dnd-kit keyboard reorder", not deviations.)

## Issues Encountered
None outstanding. Full unit suite: **124 passed (22 files)**. Full smoke suite: **10 spec files passed** (boot, keyboard-switch, multi-session-keepalive, persistence, pty-resize, pty-roundtrip, pty-throughput, reorder, session-edit, sidebar-collapse) against the repackaged build. `tsc --noEmit` + `eslint` clean on all touched source.

## Known Stubs
None. The reorder path is wired to the real pure `reorder()` reducer and the real `persistOrder` IPC; the smoke asserts a real on-disk store write. The WindowsShellProvider stub (Phase 8) is unrelated to this plan.

## Threat Flags
None — no new network endpoints, auth paths, or trust boundaries beyond the plan's `<threat_model>`. The two boundaries this plan touches are mitigated as planned: T-05-01 (persistOrder payload validated main-side before write — the smoke asserts only known ids + finite orders land on disk) and T-05-SC (the `[ASSUMED]` dnd-kit install was gated behind the blocking human-verify checkpoint, resolved "approved", and pinned exact). T-05-08 (dense-reindex collision) is accepted + unit-proven (no duplicate orders — the smoke re-asserts this on disk).

## User Setup Required
None.

## Next Phase Readiness
- **Phase 5 complete.** All four waves landed; 05-VALIDATION.md is signed off (nyquist_compliant: true, wave_0_complete: true) with the full suite green.
- **Manual phase-gate checks (carried, per 05-VALIDATION Manual-Only Verifications):** (1) full quit → relaunch restore of the canonical 🛋️ Parlour Claude RC (reappears dormant + ▶); (2) a real pointer drag of the 3rd row above the 1st, quit, reopen → order persists; (3) the shell dropdown lists the host's discovered login shells with $SHELL present. WDIO cannot drive a full quit/relaunch nor deterministic pointer DnD — these are the human reopen/drag verifications (the persist paths are unit + bridge-round-trip proven).

---
*Phase: 05-persistence-shell-discovery*
*Completed: 2026-06-06*

## Self-Check: PASSED

- Created file `tests/smoke/reorder.smoke.test.ts` verified present on disk.
- All 3 task commits (`c6dcf22`, `48452b1`, `c9ff016`) verified in git history.
- Full unit suite GREEN (124 passed, 22 files); full smoke suite GREEN (10 spec files) against the repackaged build; tsc + eslint clean.
- dnd-kit exact pins verified in package.json (`@dnd-kit/core` `6.3.1`, `@dnd-kit/sortable` `10.0.0` — no caret).
