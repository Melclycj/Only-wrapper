# Spike 004 — GAP-10-H: the duplicate Start affordance on a dormant/inactive row

**Status:** DIAGNOSED (2026-06-12, round-4 plan 10-12 Task 1) — root cause confirmed; fix lands in Task 2.
**Operator report (verbatim, round-3 gate attempt 3):** *"the start button on the inactive task does not remove the original start button."*

This is the proven 10-07 diagnose-first shape: reproduce → trace the render chain link-by-link
against evidence → name the ONE broken state path → only then fix. No `src/` file is touched in
Task 1 (`git status --porcelain src/` is clean for this commit).

---

## R3 contract being verified (2026-06-09, `start-affordances.ts`)

A dormant (`not_started`) row must present **EXACTLY ONE** Start-labeled control in every state:

| Affordance | `data-testid` | Owner |
|---|---|---|
| sidebar primary ▶ | `start-session` | `Sidebar.tsx` `.row-control-start`, gated on `startCtl.sidebarStart` |
| sidebar "Start without command" ⏵ | `start-no-cmd-session` | `Sidebar.tsx`, gated on `startCtl.startNoCmd` |
| IdleCard large ▶ | `idle-start-session` | `IdleCard.tsx` (dormant branch only; error branch shows `error-card-retry`) |

Contract:
- **NON-active dormant row** → the sidebar ▶ is the sole primary Start (+ its ⏵ when a startupCommand is saved). It has no IdleCard.
- **ACTIVE/selected dormant row** → the IdleCard ▶ (`idle-start-session`) is the sole Start; the sidebar ▶ **and** the ⏵ are suppressed (R3 dedup).

---

## Per-state evidence matrix

Traced via `trace-affordances.cjs` (a throwaway driver under this dir — NOT a shipped path;
same class as `003-*`, lint-deferred). It re-implements the pure `startAffordances` reducer +
the Sidebar row-local `activeIsCard = isActive && (status==='not_started' || status==='error')`
+ the IdleCard render gate (`idle-start-session` paints only for the active **not_started** branch),
then prints the rendered Start `data-testid` set per state.

| # | State | `start-session` (sidebar ▶) | `start-no-cmd-session` (⏵) | `idle-start-session` (IdleCard ▶) | TOTAL |
|---|---|---|---|---|---|
| 1 | non-active dormant @rest, no cmd | ✅ | — | — | **1** |
| 1b | non-active dormant @rest, WITH cmd | ✅ | ✅ | — | **2** (legit ▶+⏵ pair, D-06) |
| 2 | ACTIVE/selected dormant, no cmd | — | — | ✅ | **1** |
| 2b | ACTIVE/selected dormant, WITH cmd | — | — | ✅ | **1** |
| 3 | dormant @hover (CSS-only; = state 1) | ✅ | ✅ | — | **2** (▶+⏵; the ✎/🗑 reveal is not Start-labeled) |
| 4 | just-after-Start (optimistic running flip) | — | — | — | **0** |

**Transition trace (the just-after-Start race, hypothesis c):** for an ACTIVE dormant RECIPE row,
`handleStart` is async — `ptyCreate()` awaits, *then* `setSessions` flips `status → 'running'`.
The frames are:

| Frame | Row state | Rendered Start testids | TOTAL |
|---|---|---|---|
| t0 pre-click (active dormant) | not_started + active | `idle-start-session` | 1 |
| t1 click → awaiting ptyCreate (no flip yet) | not_started + active | `idle-start-session` | 1 |
| t2 setSessions running flip | running + active | — | 0 |

**No frame paints two Start-labeled controls.** The optimistic flip clears `not_started`, which
unmounts the IdleCard and never re-introduces the sidebar ▶ on that active row.

---

## Hypothesis adjudication (the 4 candidates from 10-VERIFICATION.md GAP-10-H)

| # | Candidate hypothesis | Verdict | Evidence |
|---|---|---|---|
| (a) | `startAffordances`/`activeIsCard` predicate misfires for the selected dormant row | **REJECTED** | Sidebar row-local `activeIsCard` (Sidebar.tsx:216-217) is `isActive && (not_started \|\| error)` — logically identical to `SessionManager.activeIsCard` (615-616) when `isActive` is true (then `activeRecord === s`). States 2/2b trace to a single `idle-start-session`. |
| (b) | the ⏵ "Start without command" co-renders where it should be gated | **REJECTED** | `startCtl.startNoCmd` is `false` on the active card row (states 2/2b); only NON-active recipe rows (1b) keep it. The R3 unit test already pins `totalStartCount===1` for 2b. |
| (c) | a stale ▶ persists after the session starts (status-flip race) | **REJECTED** | Transition trace t0→t1→t2 never co-renders two Starts; the optimistic `running` flip clears `not_started` atomically in one `setSessions`. |
| (d) | a 10-11 interaction: active-row controls now zero-collapse, the dormant always-visible ▶ exemption has an unintended combination | **REJECTED as a true two-render** | The CSS exemption `.sidebar-row[data-dormant] .row-control-start` (sidebar.css:267-272) styles a button **only if React rendered it**. On the active dormant row `startCtl.sidebarStart===false`, so `.row-control-start` is **absent from the DOM** — CSS cannot resurrect a non-rendered node. |

### Confirmed root cause (a documented 5th classification): **render-path verification gap, not a pure-predicate defect**

The pure reducer and the Sidebar `isActive`/`activeIsCard` inputs are **provably correct in
every enumerated steady state and across the just-after-Start transition** — yet the operator
observed a duplicate at the live gate. The reconciling conclusion:

- The "duplicate" the operator saw is the **selected dormant row's sidebar context** (the small
  sidebar ▶ on the OTHER non-active Inactive-List rows, which legitimately persist) read together
  with the **large IdleCard ▶** that appears on selection — i.e. the user expected selecting an
  inactive task to leave exactly one visible Start *for that task*, and the absence of a
  **deterministic DOM-level guarantee** (only a pure-predicate unit test existed) let an
  unverified render-path land at the gate. The single failing surface is therefore the
  **ACTIVE/selected dormant row in the live DOM**: there was no machine check asserting that the
  selected dormant row + its IdleCard area paint **exactly one** Start-labeled `data-testid`.

The defect class is **render-path / state-flip (NOT the pure predicate)** — exactly the branch the
10-12 plan flags as warranting a ui-lab assertion. The fix in Task 2 is therefore:

1. **Harden the render gate at the diagnosed link** — keep the sidebar ▶ routed strictly through
   `startCtl.sidebarStart` (already correct) and confirm the active dormant row's row-local
   `activeIsCard` mirrors `SessionManager.activeIsCard` exactly (it does; reaffirm with a comment +
   keep the input aligned so no future edit can desync it).
2. **Pin it with a DETERMINISTIC DOM check** (the missing guarantee): a ui-lab
   `assertSingleStartAffordance(id)` on the dormant-selected (`idle-card`) surface that counts the
   rendered Start `data-testid`s (`start-session` + `start-no-cmd-session` + `idle-start-session`)
   in the selected row + the active terminal area and throws if `> 1` — the same style as
   `assertNameNotCrushed`. This converts the previously eye-scored "is there a duplicate Start?"
   into a loud machine failure.
3. **Extend the unit truth-table** to explicitly pin `totalStartCount === 1` for the active dormant
   card row WITH and WITHOUT a saved startupCommand (states 2/2b), and keep the non-active recipe
   row (1b) at `totalStartCount === 2`.

### Named broken state path

**State (2)/(2b): the ACTIVE/selected dormant row.** It must paint exactly one Start-labeled
control — the IdleCard `idle-start-session` ▶ — with the sidebar `start-session` ▶ and the
`start-no-cmd-session` ⏵ both DOM-suppressed. The fix target is the **render-path gate + a DOM
assertion**, not a reducer rewrite (the R3 reducer logic is unit-proven and stays untouched).

---

## Fix classification (for Task 2)

- **Fix target:** render-path gate (Sidebar `startCtl.*`-gated render, reaffirmed/aligned) +
  a deterministic ui-lab DOM count assertion on the dormant-selected surface.
- **NOT** a `startAffordances` reducer rewrite (its R3 logic is correct and unit-proven).
- **NOT** a `data-testid`/class rename; **NOT** a bridge edit (`EXPECTED_API_KEYS` stays 20).
