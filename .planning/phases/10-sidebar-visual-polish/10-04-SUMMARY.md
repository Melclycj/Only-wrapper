---
phase: 10-sidebar-visual-polish
plan: 04
subsystem: testing
tags: [ui-lab, packaged-capture, design-rubric, human-uat, nyquist-gate, sidebar-polish]

# Dependency graph
requires:
  - phase: 10-01
    provides: "clampToViewport util + before-phase10 baseline intent (substituted by phase9-baseline)"
  - phase: 10-02
    provides: "two-line rows, active card, recipe cards, section labels, amber waiting hook, inactive-recipes surface"
  - phase: 10-03
    provides: "context-menu viewport clamp (D-14) + danger Remove/Delete (D-15)"
provides:
  - "Phase-gate evidence record: full automated suite GREEN against the packaged app"
  - "Packaged no-injection ui-lab capture (p10-after, gitSha bf00a94) scored against DESIGN-RUBRIC.md with pixel-cited verdicts"
  - "Recorded human-verify verdict against the running app (SC1-SC4) — NOT APPROVED, 2 fails + 1 design item"
  - "Three gap items routed to a Phase-10 gap-closure plan (live-app failures the static capture could not prove)"
affects: [gap-closure-plan, phase-10-close, nyquist-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Visual-phase gate = automated GREEN + packaged-capture rubric PASS + BLOCKING human-verify; automated green is NOT proof (06.1/08 precedent)"
    - "Baseline substitution: when per-worktree gitignored before-captures do not survive wave merges, pair against the nearest committed baseline (phase9-baseline) and disclose the substitution"

key-files:
  created:
    - ".planning/phases/10-sidebar-visual-polish/10-04-SUMMARY.md"
  modified: []

key-decisions:
  - "Recorded the human verdict VERBATIM and routed gaps to a gap-closure plan rather than accepting on automated green (per plan Task 2 instruction)"
  - "nyquist_compliant LEFT FALSE in 10-VALIDATION.md — the operator did not type 'approved'; the plan forbids flipping the gate without explicit approval"
  - "BEFORE pair = artifacts/ui-lab/phase9-baseline/ (substitution): before-phase10/ never existed on the main checkout; per-worktree gitignored captures did not survive wave merges; phase9-baseline (gitSha aafe84a) contains Gaps 1/4/5 by definition"

patterns-established:
  - "Gap items captured as a structured table (id | gap | step | human-verdict | severity | route) consumable by the verifier and the gap-closure planner"

requirements-completed: []  # UI-02 NOT completed — human gate failed; requirement stays open pending gap closure

# Gap-closure routing (machine-readable for the gap-closure planner)
gate_outcome: NOT_APPROVED
gaps:
  - id: GAP-10-A
    kind: fail
    step: 4
    sc: SC2
    phase9_gap: "Gap 1 (name-crush)"
    spec_refs: [D-13, D-01, D-03]
    summary: "Hover-reveal row controls (edit / remove / restart) occupy most of the row width, crushing/occluding the full name in the hover state"
    human_quote: "the edit, remove and restart icon occupy most of the space"
    severity: S2
    route: gap-closure
  - id: GAP-10-B
    kind: fail
    step: 5
    sc: D-09
    phase9_gap: "n/a (new D-09 treatment)"
    spec_refs: [D-09]
    summary: "No amber 'Waiting for you' treatment appeared for a waiting session in the running app; the live agentState -> row attribute path does not produce the amber (the exact path the harness SkipSurface'd)"
    human_quote: "5 no"
    severity: S2
    route: gap-closure
    investigate: [detection, propagation, css-hook]
  - id: GAP-10-C
    kind: design-feedback
    step: 3
    sc: SC1
    phase9_gap: "n/a"
    spec_refs: [D-05, D-06, D-04]
    summary: "Operator expected per-session custom color on the row; per locked spec the edge bar is STATUS-colored (running=blue) and the custom color lives on the icon tile — spec-conformant, but with D-09 amber absent (GAP-10-B) blue is the ONLY accent that ever appears. Design decision for the gap-closure planner."
    human_quote: "the side bar color only shows blue for selected one, the customised color is displayed on the icon"
    severity: S3
    route: gap-closure-design-decision

# Metrics
duration: ~12min (continuation — verdict recording only; Task 1 suite/capture ran in the prior session)
completed: 2026-06-11
---

# Phase 10 Plan 04: End-of-Phase Verification Gate — Human Verdict Recorded (NOT APPROVED)

**Automated suite GREEN and packaged-capture rubric PASS, but the BLOCKING human-verify of the running app FAILED on 2 live-app items the static capture could not prove (hover-state name-crush + missing amber waiting state) plus 1 design-feedback item — Phase 10 stays open, Nyquist gate LEFT FALSE, three gaps routed to a gap-closure plan.**

## Performance

- **Duration:** ~12 min (continuation agent — verdict recording only)
- **Completed:** 2026-06-11
- **Tasks:** 1 automated (prior session) + 1 human-verify checkpoint (this session, returned NOT APPROVED)
- **Files modified:** 0 source (verification-only plan; `files_modified: []`)

## Accomplishments

- Full automated suite confirmed GREEN against the **packaged** app (not dev) — unit + tsc + lint + smoke.
- Packaged **no-injection** ui-lab capture (`p10-after`, gitSha `bf00a94`) produced and scored line-by-line against `DESIGN-RUBRIC.md` with pixel-cited verdicts.
- BLOCKING human-verify run against the **running app** per the 9-step script — verdict captured verbatim and mapped.
- Honest gate outcome: automated green is **not** proof for a visual phase (the 06.1/08 precedent). The human gate caught two live-app failures the static capture path could not exercise.

## Task 1 — Full Suite + Packaged Capture (prior session, verification-only, no commit)

Run against the packaged app `out/Just-Wrapper-darwin-arm64/Just-Wrapper.app`, HEAD `bf00a94`.

| Gate | Result |
|------|--------|
| `npm run test:unit` | **357/357 PASS** across 41 files (incl. tokens-completeness scanning sidebar.css), exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | 8 errors, **all PRE-EXISTING** in `.planning/spikes/*.cjs` (logged in `deferred-items.md`); all Phase-10 source files lint clean |
| `npm run test:smoke` | **15/15 spec files PASS** against the packaged binary (incl. session-edit, app-restart-restore, keyboard-switch, reorder, sidebar-collapse, header-controls) |
| `UI_LAB_TAG=p10-after npm run ui:shots:fresh` | 11 surfaces captured, packaged no-injection, `manifest.json` present, gitSha `bf00a94` |

This task produced **no commit** — it is verification-only (`files_modified: []`) and the capture artifacts under `artifacts/ui-lab/` are gitignored.

### Before/After Capture Pairs

> **Baseline substitution note (disclosed):** BEFORE = `artifacts/ui-lab/phase9-baseline/`. `artifacts/ui-lab/before-phase10/` **never existed on the main checkout** — per-worktree gitignored captures did not survive the wave merges. `phase9-baseline` (gitSha `aafe84a`) contains Gaps 1/4/5 by definition, so it is the correct, honest BEFORE for this phase's gap-closure claims.

| Surface | BEFORE | AFTER |
|---------|--------|-------|
| sidebar-populated | `phase9-baseline/sidebar-populated.png` | `p10-after/sidebar-populated.png` |
| context-menu | `phase9-baseline/context-menu.png` | `p10-after/context-menu.png` |
| sidebar-collapsed | `phase9-baseline/sidebar-collapsed.png` | `p10-after/sidebar-collapsed.png` |
| inactive-recipes | _(no before-pair — surface added in Plan 02)_ | `p10-after/inactive-recipes.png` |

### Rubric Gap Table (packaged capture, pixel-cited)

| Surface / Spec | Rubric line | Verdict | Evidence (pixel) | Severity | Fix route |
|----------------|-------------|---------|------------------|----------|-----------|
| sidebar-populated / D-05·D-06 | SC1 active distinction | **PASS** | filled card + border + shadow lift + colored left edge bar vs flat rows | — | — |
| sidebar-populated / D-01·D-03 | SC2 / Gap 1 two-line hierarchy | **PASS** | full-width name line 1, status dot + word line 2 (before: names crushed to ~1 char) | — | — |
| sidebar-populated / D-12 | Section labels + counts | **PASS** | "WORKING AREA · 3" / "INACTIVE · 1" | — | — |
| sidebar-populated / D-04 | Large icon tile | **PASS** | ~34px rounded tile per row | — | — |
| inactive-recipes / D-11 | Gap 5 dashed recipe cards | **PASS** | dashed eggshell cards | — | — |
| inactive-recipes / D-03 | Startup-command secondary on recipe | **PASS** | secondary command line present | — | — |
| inactive-recipes / D-13 | Always-visible ghost ▶ | **PASS** (S3 note) | hover controls occluded it in the static capture | S3 (static-capture artifact) | — |
| context-menu / D-14 | Gap 4 viewport clamp | **PASS** | menu fully on-screen, header un-overlapped | — | — |
| context-menu / D-15 | Gap 4 danger Remove | **PASS** | red via `--color-danger` | — | — |
| sidebar-collapsed / D-07·D-10 | SC3 collapsed continuity | **PASS** (S3 note) | active edge bar subtle | S3 | — |
| sidebar-waiting / D-09 | amber "Waiting for you" | **SkipSurface** in harness — **deferred to human gate** | not drivable in the capture harness | — | → human gate (where it FAILED, GAP-10-B) |

**Packaged-capture rubric outcome:** all drivable rubric lines PASS; the one path the harness could not drive (`sidebar-waiting` / D-09) was explicitly deferred to the human gate — which is exactly where it failed.

## Task 2 — BLOCKING Human-Verify of the Running App (SC1-SC4) — NOT APPROVED

The operator ran the 9-step how-to-verify script in the running app.

### Verbatim operator response

> "the side bar color only shows blue for selected one, the customised color is displayed on the icon.  4 no, the edit, remove and restart icon occupy most of the space 5 no 6, yes 7, 8 yes 9 yes."

### Mapped against the script

| Step | Item | Human verdict |
|------|------|---------------|
| 3 | SC1 active distinction | **OBSERVATION / DESIGN FEEDBACK** — "the side bar color only shows blue for selected one, the customised color is displayed on the icon". Per locked UI-SPEC D-05/D-06 the edge bar is STATUS-colored (running=blue) and the per-session custom color lives on the icon tile (D-04), so the implementation is spec-conformant; but the operator expected per-session color presence on the row, and with the absent amber (step-5 failure) blue is the ONLY accent that ever appears. Routed as a design-decision item (GAP-10-C). |
| 4 | SC2 / Gap 1 full name + secondary | **FAIL** — "the edit, remove and restart icon occupy most of the space". Hover-reveal controls (✎ edit / remove / restart) cover most of the row width, crushing/occluding the name. Gap-1-class defect in the hover state (GAP-10-A). |
| 5 | D-09 amber "Waiting for you" | **FAIL** — "no". No amber treatment appeared for a waiting session in the running app. This is the exact path the harness could not drive (SkipSurface): the unit data-agent contract passes but the live agentState → row attribute path does not produce the amber. Functional gap, needs investigation: detection vs propagation vs CSS hook (GAP-10-B). |
| 6 | Gap 5 / D-11·D-13 recipe cards | **PASS** ("yes") |
| 7 | Gap 4 / D-14·D-15 context menu | **PASS** ("yes") |
| 8 | SC3 collapsed continuity | **PASS** ("yes") |
| 9 | SC4 / Core Value terminal fidelity | **PASS** ("yes") |

### Verdict

**NOT APPROVED** — 2 FAIL items (GAP-10-A hover-state name-crush, GAP-10-B missing amber waiting state) + 1 design-feedback item (GAP-10-C per-session row color). Per the plan: _"If the operator reports gaps, capture them verbatim for a gap-closure plan rather than accepting on automated green."_ The operator did NOT type "approved".

## Gap Items Routed to Gap-Closure

| ID | Kind | Step / SC | Spec refs | Summary | Severity | Route |
|----|------|-----------|-----------|---------|----------|-------|
| GAP-10-A | FAIL | 4 / SC2 (Gap 1) | D-13, D-01, D-03 | Hover-reveal row controls crush/occlude the full name in the hover state | S2 | gap-closure |
| GAP-10-B | FAIL | 5 / D-09 | D-09 | Live agentState → row amber-waiting path does not produce the amber (harness SkipSurface'd it); investigate detection vs propagation vs CSS hook | S2 | gap-closure |
| GAP-10-C | design feedback | 3 / SC1 | D-05, D-06, D-04 | Operator expected per-session custom color on the row; spec-conformant today (status-colored edge bar + custom color on icon tile), but with amber absent blue is the only accent | S3 | gap-closure (design decision) |

## Decisions Made

- **Recorded the human verdict verbatim and routed gaps to a gap-closure plan** rather than accepting on automated green — per Task 2's explicit instruction and the 06.1/08 visual-phase precedent.
- **Left `nyquist_compliant: false`** in `10-VALIDATION.md` — the operator did not type "approved"; the plan forbids flipping the gate without explicit approval. Verified unchanged.
- **Did NOT touch STATE.md / ROADMAP.md** — per continuation instructions (phase stays open; tracking advance is not warranted on a failed gate).
- **Baseline substitution disclosed** rather than silently paired against a non-existent `before-phase10/`.

## Deviations from Plan

The plan's success criteria expected the human gate to score PASS and the phase to close. Instead the gate returned NOT APPROVED. This is **not** a deviation in execution — the plan explicitly provisioned for this outcome ("If the operator reports gaps, capture them verbatim for a gap-closure plan"). The honest result: automated gates GREEN, packaged-capture rubric PASS, **human gate FAILED on live-app items the static capture could not prove**.

## Issues Encountered

- The two failures (GAP-10-A, GAP-10-B) both live in **runtime/hover states the packaged static capture harness could not exercise** — the capture proved the resting/populated/collapsed/context-menu surfaces but could not drive the hover-controls layout regression or the live agentState amber path. This is the precise reason the blocking human gate exists for visual phases.

## Next Phase Readiness

- **Phase 10 is NOT closed.** Requirement UI-02 stays open.
- **Next step:** a Phase-10 gap-closure plan addressing GAP-10-A (hover-control layout vs name), GAP-10-B (live waiting-amber propagation), and a design decision on GAP-10-C (per-session row color).
- **Nyquist gate remains FALSE** and flips true only on an explicit human "approved" after the gaps are closed and re-verified in the running app.

---
*Phase: 10-sidebar-visual-polish*
*Completed: 2026-06-11 (gate verdict: NOT APPROVED)*
