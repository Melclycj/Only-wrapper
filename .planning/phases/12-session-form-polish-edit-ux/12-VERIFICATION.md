---
phase: 12
slug: session-form-polish-edit-ux
status: gaps_found
nyquist_compliant: false
verified_by: operator human-gate
verified: 2026-06-15
gaps_total: 5
requirements: [UI-04, SESS-05, SESS-06]
---

# Phase 12 — Verification (human-gate result)

The BLOCKING end-of-phase human-verify (12-03 Task 3) was run by the operator on the
packaged app (2026-06-15). Verdict: **QUALIFIED FAIL** — `nyquist_compliant` stays **false**,
Phase 12 does NOT ship. Five gaps + one process meta-finding. Route: gap-closure
(`/gsd-plan-phase 12 --gaps` → `/gsd-execute-phase 12 --gaps-only` → re-gate).

## What PASSED (operator: "approve the rest")

- **SESS-05 prefill (O-1 first-open default cwd)** — first Edit-open shows the resolved home path. ✓
- **SESS-05 round-trip** — edit cwd + startup → Save → reopen shows the saved values. ✓

## Gaps

| ID | Severity | Requirement | Operator report | Root cause (code-confirmed) | Fix direction |
|----|----------|-------------|-----------------|------------------------------|---------------|
| GAP-12-A | high | UI-04 (SC1) | "no blue save change, not evenly spaced" | The Save button (`SessionEditModal.tsx:339`) carries BOTH `modal-btn-save` (blue ramp) AND `context-menu-item` (added only as a WDIO text-click hook); `.context-menu-item` is defined later in `form.css` (~:142 > :107) so it overrides the blue background. Spacing in `.modal-actions`/`.edit-field`/groups reads uneven on the real window. | Drive the Save click by `data-testid` (drop `context-menu-item` from the button); restore the accent-blue `modal-btn-save`; tune group/field/actions rhythm to the UI-SPEC. |
| GAP-12-B | high | SESS-05 / UX | "after edit, there should be a pop-up to restart the session with the new applied command" | cwd/shell/startup are "Applies on restart," but Phase 11 (D-01) REMOVED the restart UI — no path applies them. `ptyRestart` IPC + `handleRestart` were retained un-surfaced. | **Operator decision 2026-06-15: add a "Restart to apply?" prompt.** After Save, if a LIVE session's launch fields (cwd/shell/startup) changed, show a prompt → "Restart now / Later", reusing the retained `ptyRestart`. (Partially reverses P11 restart-removal — intentional, operator-requested. Touches DEBT-02-governed lifecycle → plan with care + threat/R&C lens.) |
| GAP-12-C | high | SESS-06 / CR-01 (T-12-01) | "there is no inline working directory not found" | The inline cwd error renders only while the modal is open AND `errorMessage` is set, but CR-01 only fires at Start — AFTER the modal closes (`SessionEditModal.tsx:158-163`). So the rejection surfaces on the row/IdleCard, never inline in the form. | Surface the CR-01 rejection on the GAP-B restart-to-apply (bad cwd → restart fails → "Working directory not found" shown where the user acted) AND/OR a live "path does not exist" hint while typing cwd. Keep main as validator of record. |
| GAP-12-D | high | UI-04 / interaction | "select all in the name text box closes the edit window" | **No application `Menu` is configured anywhere in `src/main`** → `Cmd+A` has no Select-All role and bubbles out (Cmd+C/V/X/Z likely broken in the form inputs too); additionally the `.modal-overlay` `onClick={onCancel}` can fire on a drag-select overshoot. | Add a proper application Menu with the standard Edit roles (undo/redo/cut/copy/paste/selectAll); guard the overlay close to only fire when mousedown STARTED on the overlay (not on a selection drag ending there). |
| GAP-12-E | medium | UI-04 (validation tone) | "not sure what 5 asks for" | Check-5 instruction was unclear; the neutral validation hints exist in code (`validateSessionForm` → name/cwd notices) but were not clearly verifiable live. | Clarify the check; verify the neutral hints (empty name, non-absolute cwd) render visibly + calm (not red), red only on a genuine main rejection. |

## Process meta-finding (orchestrator owns)

- **The `ui:shots` visual gate false-passed GAP-12-A.** The `edit-modal` capture framed the form with the **Save button below the fold**, so the rubric scored "PASS" without ever seeing the button — that is how a non-blue Save slipped the automated gate. **Fix the ui-lab `edit-modal` surface to capture the full form including the `.modal-actions` row** (scroll-into-view or size the capture) so the visual gate cannot pass without seeing the primary action. Add this to the gap-closure scope.

## Re-gate criterion

After the gap-closure plans land: full suite GREEN + a fresh `ui:shots:fresh` capture that **includes the Save button**, then a re-run of the BLOCKING operator human-verify covering GAP-12-A..E. `nyquist_compliant` flips true only on the operator's explicit unqualified approval.
