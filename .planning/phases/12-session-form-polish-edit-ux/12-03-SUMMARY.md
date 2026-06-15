---
phase: 12-session-form-polish-edit-ux
plan: 03
subsystem: testing
tags: [wdio, smoke, ui-lab, visual-gate, sess-05, ui-04, electron, react]

# Dependency graph
requires:
  - phase: 12-02
    provides: "SessionEditModal D-02 two-group restructure + 'Save changes' accent-blue button + inline D-04 validation + rehydrateProfiles via mergeAuthoritativeProfiles (SESS-05 prefill)"
  - phase: 12-01
    provides: "validateSessionForm (D-04 hints) + mergeAuthoritativeProfiles (SESS-05 merge) pure reducers; the edit-modal-validation ui-lab surface"
  - phase: 06-session-lifecycle
    provides: "pickDirectory bridge key (SESS-06 Browse…) + onPtyStatus → row.errorMessage CR-01 path (both reused, no new IPC)"
provides:
  - "session-edit smoke SESS-05 round-trip: edit → Save changes → reopen asserts cwd+startup re-seed from main's persisted truth (the automated half of SC2)"
  - "setEditFieldByTestId / readEditFieldByTestId xterm-driver helpers (React input-event set + DOM .value read) for the edit form fields"
  - "'Save changes' relabel lockstep in the session-edit smoke (clickMenuItem exact-text match)"
  - "packaged no-injection ui:shots:fresh capture (tag p12-form-gate, gitSha d57576d) of edit-modal + edit-modal-validation, scored PASS on every DESIGN-RUBRIC line"
  - "12-VALIDATION Per-Task Verification Map populated (unit/smoke ✅; UI-04 visual ✅ capture; Task-3 BLOCKING human-verify pending)"
affects: [12-03-Task3 (BLOCKING human-verify owns the nyquist flip), 13 (UI-05/UI-06 build on the verified form)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SESS-05 live round-trip smoke: drive the form via the input-event path, Save (closes the modal), reopen the SAME row, browser.waitUntil the async rehydrateProfiles re-seed, then assert the DOM .value — no fixed timeouts"
    - "ui-lab field driver must defeat React 19's controlled-input value tracker (native HTMLInputElement.prototype value setter) so validation surfaces that read React STATE capture honestly"
    - "packaged-no-injection is the visual proof: structural TSX (Plan 02) ⇒ ui:shots:fresh, never UI_LAB_LIVE_CSS (injection previews stale markup)"

key-files:
  created: []
  modified:
    - tests/smoke/session-edit.smoke.test.ts
    - tests/smoke/helpers/xterm-driver.ts
    - tests/ui-lab/surfaces.ts
    - .planning/phases/12-session-form-polish-edit-ux/12-VALIDATION.md

key-decisions:
  - "The SESS-05 round-trip uses process.cwd() as the KNOWN existing absolute dir so CR-01 accepts it and the round-trip exercises main's persistence path untouched"
  - "grep -c \"clickMenuItem('Save')\" is 0 because 'Save changes' uses a different trailing quote — the relabel lockstep is real, not a substring coincidence"
  - "The pty-resize.smoke failure is pre-existing (identical at pre-plan HEAD, zero src/ change here) and OUT OF SCOPE — logged to deferred-items.md, not auto-fixed (verify-and-polish plan must not touch terminal fidelity)"

patterns-established:
  - "ui-lab validation-surface honesty: a programmatic fill that suppresses React onChange is a false-negative trap for any surface scored on state-derived UI; drive via the native value setter"

requirements-completed: [UI-04, SESS-05, SESS-06]

# Metrics
duration: 30 min
completed: 2026-06-15
---

# Phase 12 Plan 03: Session Form Polish + Edit UX — Phase Gate (automated half) Summary

**The Phase-12 gate's automated evidence: a new session-edit smoke proving the SESS-05 edit→Save changes→reopen cwd+startup round-trip on the running app, the 'Save changes' relabel lockstep, and a packaged no-injection ui:shots:fresh capture (tag p12-form-gate) of edit-modal + edit-modal-validation scored PASS on every DESIGN-RUBRIC line — all green; the BLOCKING end-of-phase human-verify (Task 3) is pending and orchestrator-owned, so nyquist_compliant stays false.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-15T01:36:00Z
- **Completed:** 2026-06-15T01:56:45Z
- **Tasks:** 2 of 3 (Task 3 = BLOCKING human-verify, orchestrator-owned, NOT run)
- **Files modified:** 4 (0 created, 4 modified)

## Accomplishments
- **SESS-05 round-trip smoke (Task 1)** — Added a new case to `session-edit.smoke.test.ts`: add a session → open Edit → set `edit-cwd` to a known absolute dir (`process.cwd()`) + `edit-startup` to a known string → click **'Save changes'** → wait for the modal to close → reopen Edit on the SAME row → `browser.waitUntil` the async `rehydrateProfiles` re-seed → assert both DOM `.value`s equal what was saved + identity (logicalId) stable. This proves main's persisted truth round-trips back into the form (the automated half of SC2). Two new driver helpers (`setEditFieldByTestId` / `readEditFieldByTestId`) + an `openEdit` waitUntil helper. Every `clickMenuItem('Save')` is now `'Save changes'` (Rule-1 lockstep with Plan 02's relabel; clickMenuItem matches visible text exactly).
- **Packaged visual capture scored PASS (Task 2)** — `UI_LAB_TAG=p12-form-gate npm run ui:shots:fresh` (packaged no-injection) captured BOTH `edit-modal` and `edit-modal-validation`; scored against `DESIGN-RUBRIC.md §edit-modal` (two-group structure, designed picker, blue 'Save changes', even rhythm) and `§edit-modal-validation` (neutral `--ink-faint` hints, danger red absent) — **every line PASS** (tag `p12-form-gate`, gitSha `d57576d`).
- **Full automated suite GREEN** — `npm run test:unit` 418/418 (48 files); `npx tsc --noEmit` exit 0; `security.guard` + `tokens-completeness` GREEN (**EXPECTED_API_KEYS === 20**, this plan adds no bridge key); session-edit (incl. the new round-trip) + startup-command GREEN isolated (3/3 isolated pass — the documented parallel-load timing flake); 13 other smoke specs GREEN.
- **VALIDATION map populated** — `12-VALIDATION.md` Per-Task Verification Map filled across Plans 01/02/03 (no placeholder row remains); the three Manual-Only rows kept as the Task-3 BLOCKING human-verify script; `nyquist_compliant` left **false** (only the operator's explicit unqualified approval flips it).

## Task Commits

Each task was committed atomically:

1. **Task 1: session-edit smoke SESS-05 cwd+startup round-trip + 'Save changes' lockstep** — `d57576d` (test)
2. **Task 2 deviation fix (Rule-1): ui-lab setInputByTestId fires React onChange via native value setter** — `58f5bb2` (fix)

**Plan metadata:** `<this commit>` (docs: complete plan automated half)

_Task 2's VALIDATION-map population + SUMMARY are in the metadata commit; the capture is an artifact (gitignored), evidenced by tag + gitSha._

## Files Created/Modified
- `tests/smoke/session-edit.smoke.test.ts` — New SESS-05 round-trip case (edit→Save changes→reopen→assert cwd+startup re-seed + logicalId stable); `openEdit` waitUntil helper; all Save clicks now `'Save changes'`.
- `tests/smoke/helpers/xterm-driver.ts` — `setEditFieldByTestId` (React input-event set) + `readEditFieldByTestId` (DOM `.value` read) helpers.
- `tests/ui-lab/surfaces.ts` — Rule-1 fix: `setInputByTestId` now drives the field through the native `HTMLInputElement.prototype` value setter so React's onChange fires and state-derived validation hints render in the `edit-modal-validation` capture.
- `.planning/phases/12-session-form-polish-edit-ux/12-VALIDATION.md` — Per-Task Verification Map populated; pre-existing-pty-resize out-of-scope note added; `nyquist_compliant` untouched (false).

## Decisions Made
- The round-trip's known absolute dir is `process.cwd()` (always exists on the smoke host) so CR-01 accepts it and the round-trip flows through main's real persistence/validation path untouched.
- `grep -c "clickMenuItem('Save')"` reads 0 (correct): `'Save changes'` ends with a different trailing quote, so no bare `'Save'` call remains — the relabel lockstep is genuine.
- `pty-resize.smoke` is pre-existing (fails identically at pre-plan HEAD `1335853`; this plan changed zero `src/`/PTY/resize code) → out of scope, logged to `deferred-items.md`, NOT auto-fixed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ui-lab validation surface captured a form with NO hints (false-negative vs the rubric)**
- **Found during:** Task 2 (scoring the `edit-modal-validation` capture)
- **Issue:** The `edit-modal-validation` surface drove fields with a tracker-suppressed programmatic fill (`input.value = v; dispatchEvent('input')`). React 19's controlled-input value tracker suppresses the synthetic `onChange` for that pattern, so `setName`/`setCwd` never ran, the form state stayed at the seeded (valid) values, and the D-04 validation notices — which are derived from React STATE — never rendered. The first `p12-form-gate` capture therefore showed a validation surface with NO hints, FAILING the `§edit-modal-validation` rubric lines ("empty-name hint renders", "cwd format hint renders"). A live-DOM probe confirmed `.edit-field-notice` count was 0 with the old fill.
- **Fix:** Changed `setInputByTestId` in `tests/ui-lab/surfaces.ts` to drive the field through the native `HTMLInputElement.prototype` value setter (the standard React testing idiom), which defeats the tracker so `onChange` fires and validation state updates. A live-DOM probe then confirmed both notices render with text + `--ink-faint` color (`oklch(0.66 0.01 75)`); the re-captured `edit-modal-validation.png` shows "Keeps the current name" under Name and "Enter an absolute path, or use Browse…" under cwd, both calm, no danger red. **No `src/` change; EXPECTED_API_KEYS untouched (20).**
- **Files modified:** tests/ui-lab/surfaces.ts
- **Verification:** Live-DOM notice probe 0→2; re-captured PNG read + scored PASS on all four `§edit-modal-validation` lines; unit 418/418 + tsc 0 after the fix.
- **Committed in:** `58f5bb2` (fix)

---

**Total deviations:** 1 auto-fixed (1 bug — Rule 1).
**Impact on plan:** The fix is confined to the test/capture harness (no `src/`, no bridge); it makes the validation-surface capture honest so the gate scores real evidence. No scope creep. Without it, Task 2 would have presented a known-failing visual capture (the T-10-10-01 discipline violation the plan explicitly forbids).

## Issues Encountered
- **`pty-resize.smoke` fails on this macOS dev box (pre-existing, OUT OF SCOPE).** The PTY resize / `tput cols` round-trip (SC3 terminal fidelity) fails isolated. Proven pre-existing: the spec is byte-identical to the pre-plan HEAD, this plan changed zero `src/`/PTY/resize code, and running the spec against the pristine pre-plan 12-02 commit `1335853` reproduces the SAME failure. Logged to `deferred-items.md`, routed to a terminal-fidelity / Phase-15 follow-up. NOT a regression from this plan; all plan-relevant smokes are GREEN.
- **session-edit + startup-command parallel-load flake (documented).** Both pass 3/3 isolated (the STATE.md bar); the new SESS-05 round-trip passed in the first full 15-spec run and 3/3 isolated re-runs. The round-trip's async `rehydrateProfiles` can miss its waitUntil under 14 concurrent Electron instances — a timing flake, not a regression.

## Known Stubs
None — this plan adds test coverage + a capture; it introduces no data paths or placeholders. The pre-existing disabled "Finding shells…" `<option>` is an in-flight UI state (not a stub), unchanged.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **BLOCKING human-verify (Task 3) is PENDING and orchestrator-owned.** The automated gate is GREEN and the packaged build (`58f5bb2`) is ready. The operator must run `npm run make`, open the packaged macOS app, and confirm LIVE: SC1 (one cohesive designed surface), SESS-05 O-1 (brand-new session's first edit-open default cwd) + the round-trip, SESS-06 O-2 (Browse… fills an absolute path + CR-01 gates a bad path), and the calm validation tone. On the explicit unqualified "approved", `nyquist_compliant` flips true in `12-VALIDATION.md` and the phase closes. `nyquist_compliant` stays **false** until then.
- No blockers introduced. Main process + bridge untouched (EXPECTED_API_KEYS stays 20); terminal fidelity safe by construction (test/harness-only changes). The pre-existing `pty-resize` failure is logged and routed downstream.

## Self-Check: PASSED

- Modified files exist on disk: `tests/smoke/session-edit.smoke.test.ts`, `tests/smoke/helpers/xterm-driver.ts`, `tests/ui-lab/surfaces.ts`, `.planning/phases/12-session-form-polish-edit-ux/12-VALIDATION.md` — all FOUND.
- Capture artifacts exist: `artifacts/ui-lab/p12-form-gate/edit-modal.png` + `edit-modal-validation.png` (tag p12-form-gate, gitSha d57576d) — FOUND, scored PASS.
- Commits exist: `d57576d` (Task 1 test), `58f5bb2` (Rule-1 fix) — both in `git log 1335853..HEAD`.
- Acceptance criteria re-verified by command: `grep -c "clickMenuItem('Save')"` == 0; `grep -c "Save changes"` >= 1 (==4); `grep -Ec "edit-cwd|edit-startup"` == 6; session-edit GREEN 3/3 isolated incl. the SESS-05 round-trip; `npm run test:unit` 418/418; `npx tsc --noEmit` exit 0; security.guard + tokens-completeness GREEN (EXPECTED_API_KEYS === 20); ui:shots:fresh emitted both surfaces, scored PASS every rubric line.

---
*Phase: 12-session-form-polish-edit-ux*
*Completed: 2026-06-15 (automated half — Task 3 BLOCKING human-verify pending)*
