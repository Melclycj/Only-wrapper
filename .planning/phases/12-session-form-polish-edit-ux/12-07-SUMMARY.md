---
phase: 12-session-form-polish-edit-ux
plan: 07
subsystem: validation
tags: [re-gate, human-verify, nyquist, qualified-fail, superseded]
outcome: qualified-fail
superseded_by: 12-10

# Dependency graph
requires:
  - phase: 12-04
    provides: GAP-12-A (blue Save + even spacing) + GAP-12-E validation-tone fixes that this re-gate validated
  - phase: 12-05
    provides: the main-process app Menu (GAP-12-D) this re-gate validated
  - phase: 12-06
    provides: the restart-to-apply prompt (GAP-12-B) + CR-01 surfacing (GAP-12-C) this re-gate validated
provides:
  - "Round-1 re-gate verdict: QUALIFIED FAIL — automated chain GREEN, but the BLOCKING operator human-verify reopened GAP-12-B / GAP-12-C / GAP-12-E (and surfaced a then-new GAP-12-F, later withdrawn)"
  - "The reopened-gap routing that spawned gap-closure round 2 (12-08 / 12-09 / 12-10)"
  - "A test-only stale-smoke fix (3bb9f28) the re-gate's automated chain caught: session-edit Save migrated to clickByTestId('edit-save') + GAP-12-B prompt dismissal"
affects: [12-08, 12-09, 12-10]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/phases/12-session-form-polish-edit-ux/12-VALIDATION.md
    - .planning/phases/12-session-form-polish-edit-ux/12-VERIFICATION.md
    - tests/smoke/session-edit.smoke.test.ts

key-decisions:
  - "nyquist_compliant was NOT flipped — the operator's human-verify returned a QUALIFIED FAIL, so the gate correctly stayed false. A re-gate verdict (even a failing one) is this plan's deliverable; it was produced and recorded."
  - "The QUALIFIED FAIL reopened GAP-12-B (valid cwd → readiness probe timeout), GAP-12-C (bad-cwd rejection not visible), GAP-12-E (non-existent path saved with no feedback). GAP-12-F (chords) was later WITHDRAWN — the operator confirmed Cmd+1/2/K/F work (89ab574)."
  - "Closed out as SUPERSEDED BY 12-10: round-2 re-gate 12-10 re-runs the same GAP-12-A..E human-verify ON THE OPERATOR'S MACHINE after the real fixes (12-08 probe budget + 12-09 renderer surfaces) land. 12-07 does not depend on those fixes and is not re-run."

patterns-established: []

requirements-completed: []

# Metrics
duration: re-gate cycle (multi-session)
completed: 2026-06-16
---

# Phase 12 Plan 07: Round-1 Re-Gate — QUALIFIED FAIL (Superseded by 12-10)

**The round-1 re-gate (after gap-closure plans 12-04/05/06) ran its full automated chain GREEN and caught a real stale-smoke defect, but the BLOCKING operator human-verify returned a QUALIFIED FAIL — reopening GAP-12-B / GAP-12-C / GAP-12-E. `nyquist_compliant` correctly stayed `false`. This plan's job (produce a re-gate verdict) is complete; the verdict spawned gap-closure round 2 (12-08/09/10), and the live re-gate is now owned by 12-10.**

## What this plan delivered

A re-gate **verdict**, not a passing gate. The plan had three tasks: (1) run the automated re-gate chain against the packaged app, (2) present the packaged app to the operator for human-verify, (3) flip `nyquist_compliant` **only** on an explicit unqualified "approved". Tasks 1–2 ran; Task 3's gate condition was not met (the operator reported failures), so the gate stayed closed — which is the correct, honest outcome.

## Re-Gate Result

### Task 1 — Automated chain: GREEN (recorded in 12-VALIDATION.md §"Re-Gate Evidence")
- `npx tsc --noEmit` → 0 errors
- `npm run lint` → scoped clean (`src` + `tests`); 12 pre-existing errors in `.planning/spikes/*.cjs` deferred
- `npm run test:unit` → 51 files / 448 tests GREEN
- `npm run test:smoke` → 15/15 GREEN
- `npm run ui:shots:fresh` → 14/14 captured; `edit-modal` + `edit-modal-validation` rubric PASS (tag `p12-regate`)
- **Caught a real defect:** `startup-command.smoke` failed 3/3 ISOLATED — diagnosed to a *stale test* (GAP-12-A dropped the `.context-menu-item` class the helper queried), not a product regression. Fixed test-only in `3bb9f28` (Save via `clickByTestId('edit-save')` + dismiss the GAP-12-B prompt).

### Task 2/3 — Operator human-verify: QUALIFIED FAIL (2026-06-16)
The operator ran the packaged-app human-verify:
- **Approved:** GAP-12-A (blue Save + spacing), GAP-12-D (app Menu), SESS-06 (Browse…), SC1 (cohesive form).
- **Failed:** GAP-12-B (restart-to-apply → "shell wasn't ready in time", command not applied), GAP-12-C (bad-cwd rejection not visible), GAP-12-E (non-existent path → no feedback, Save closes anyway).
- **Then-new GAP-12-F:** Cmd+1/2/K/F chords reported broken after the 12-05 Menu — **later WITHDRAWN** (operator confirmed chords work, `89ab574`).

`nyquist_compliant` stayed `false`. Per-item words + reopened-gap table recorded in `12-VERIFICATION.md` §"Re-Gate 1 Result".

## Follow-up routing (what this verdict spawned)
- **Diagnosis** (`ffea629`): GAP-12-B root cause = the TERM-05 readiness probe's fixed 4000ms budget is too tight under heavy login-shell rc-init latency (NOT restart-specific); GAP-12-C verdict caveated.
- **Gap-closure round 2** (`1973411`, `04f0ef8`): 12-08 (dual-deadline readiness budget), 12-09 (renderer GAP-12-C/E surfaces), 12-10 (round-2 re-gate, BLOCKING operator human-verify on their own machine).

## Superseded By
**12-10.** The round-2 re-gate re-runs the same GAP-12-A..E human-verify after the real fixes land, and is the plan that flips `nyquist_compliant` on the operator's approval. 12-07 depends only on round-1 (12-04/05/06) and is not re-executed.

## Self-Check: PASSED (closeout)
- Re-gate verdict produced and recorded: 12-VALIDATION.md §"Re-Gate Evidence" + §"Re-Gate 1 Result" verdict line, 12-VERIFICATION.md §"Re-Gate 1 Result".
- Verdict commits present: `2d6661d` (Task-1 evidence), `3bb9f28` (stale-smoke fix), `df98ed9` (QUALIFIED FAIL), `89ab574` (operator clarifications / GAP-12-F withdrawn), `ffea629` (diagnosis).
- `nyquist_compliant` correctly `false` (not over-claimed); supersession by 12-10 recorded in frontmatter (`superseded_by: 12-10`) and body.

---
*Phase: 12-session-form-polish-edit-ux*
*Outcome: QUALIFIED FAIL — superseded by 12-10*
*Closed out: 2026-06-16*
