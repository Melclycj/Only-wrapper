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

---

## Re-Gate 1 Result (12-07 Task 2) — 2026-06-16: **QUALIFIED FAIL**

Automated chain GREEN (tsc 0 / scoped lint clean / unit 448 / smoke 15-15 / ui:shots `p12-regate` rubric PASS; one stale smoke fixed test-only at `3bb9f28`). Operator ran the BLOCKING human-verify on the packaged app. Verdict: **QUALIFIED FAIL** — `nyquist_compliant` stays **false**; Phase 12 does NOT ship.

### Operator results (verbatim, per item)

| Item | Result | Operator words |
|------|--------|----------------|
| 1 GAP-12-A (blue Save + spacing) | ✅ approve | "approve" |
| 2 GAP-12-D (Cmd+A / clipboard / overlay) | ✅ approve | "approve" |
| 3 GAP-12-E (validation hints) | ⚠️ partial | "name can see hint, false path still can not see … when i input a false path, which action will it hint me wrong path? if … click on save, then save directly close window" |
| 4 SESS-06 (Browse…) | ✅ approve | "approve" |
| 5 GAP-12-B (restart-to-apply) | ❌ FAIL | "failed, it outputs shell wasnt ready in time. there was a restart function that was working, why not directly use it?" |
| 6 GAP-12-C (visible bad-cwd rejection) | ❌ FAIL | "cant see, i think when there is a false path, the working directory [isn't] saved at all" |
| 7 existing chords (Cmd+1/2/K/F) | ❌ FAIL | "no" |
| 8 SC1 cohesive surface | ✅ yes | "yes" |

### Remaining / reopened gaps (root cause code-confirmed where noted)

| ID | Status | Severity | Root cause / hypothesis | Fix direction |
|----|--------|----------|--------------------------|---------------|
| GAP-12-B | REOPENED | high | `handleRestart`→`ptyRestart`→main `restart()`→`create()` runs the TERM-05 readiness probe; it did NOT match within `READINESS_TIMEOUT_MS`=4000ms on the in-place restart respawn → `READINESS_FAIL_NOTICE` ("shell wasn't ready in time") + the command is NOT injected (D-04 safe fallback). Why the probe times out on a restart respawn (vs a working dormant Start, same `create()` path) is UNKNOWN → needs reproduction/trace. | **DEBUG-FIRST.** Reproduce + trace the probe buffer on a restart respawn (race with the dying shell? stale bytes? timeout too tight?). Decide fix (longer/again-on-restart probe, or a restart-specific injection) — do NOT guess. |
| GAP-12-C | REOPENED | high | On a restart-to-apply FAILURE the session was LIVE (SessionView, no IdleCard). `handleRestart` only flips to running on `pid>0`; on `pid<=0` it does nothing (no else), relying on the `onPtyStatus` 'error'+notice to surface via the IdleCard — but a live→failed-restart session may not transition to the IdleCard, so "Working directory not found" is invisible. Operator also suspects the bad cwd "isn't saved at all". | Make the failed restart-to-apply visibly land the error where the user acted (flip to a not_started/error state that shows the IdleCard + notice). Confirm `updateProfile` persists the cwd (validation is at `create()`, not persist). Ties to GAP-12-B debug. |
| GAP-12-E | REOPENED | medium | `validateSessionForm` hints on FORMAT only: a non-empty, NON-ABSOLUTE cwd (`foo/bar`) hints live; an absolute-but-NON-EXISTENT path (`/x/nope`) is format-valid → NO hint by design (existence is main's CR-01 at launch). Hints never block Save (convenience-only; main = validator of record), so Save closes regardless. Operator expected a "wrong path" (non-existent) to be flagged → expectation/spec mismatch. | Clarify the model + make launch-time existence rejection visible (ties to GAP-12-C). Decide whether to add a live existence check (needs IPC / a bridge key — weigh vs the 20-key budget) or rely on a clearly-surfaced launch rejection. |
| GAP-12-F | **NEW** | high | After the 12-05 application `Menu` (`Menu.setApplicationMenu`, appMenu+editMenu+windowMenu), the operator reports the existing chords (Cmd+1/2 switch, Cmd+K clear, Cmd+F find) no longer work. By design these are `before-input-event` intents (index.ts:125-146), NOT menu accelerators (app-menu.ts:14), so the Menu should not shadow them — the regression is UNEXPECTED. | **DEBUG-FIRST.** Reproduce live; determine which chord(s) broke and whether the new Menu changed `before-input-event` delivery / focus. Likely a 12-05 regression. |

**Route:** `/gsd-debug` to root-cause GAP-12-B / GAP-12-C / GAP-12-F (reproducible product/lifecycle defects — the readiness-probe + restart-error-surfacing are DEBT-02-governed; GAP-12-F is a Menu regression) → then `/gsd-plan-phase 12 --gaps` to plan fixes for B/C/E/F with confirmed causes → re-execute → re-gate. `nyquist_compliant` stays false.
