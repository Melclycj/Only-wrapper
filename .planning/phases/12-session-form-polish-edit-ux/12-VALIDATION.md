---
phase: 12
slug: session-form-polish-edit-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `12-RESEARCH.md` §"Validation Architecture (Nyquist)". The Per-Task
> Verification Map is populated by the planner as PLAN.md tasks are created.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (`environment: 'node'` — NO jsdom; renderer logic must be tested via pure electron/react-free modules) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test:unit && npm run test:smoke` |
| **Type gate** | `npx tsc --noEmit` |
| **Visual gate** | `npm run ui:shots:fresh` (packaged no-injection capture, scored vs `tests/ui-lab/DESIGN-RUBRIC.md`) |
| **Estimated runtime** | ~unit < 20s · smoke ~couple min · ui:shots:fresh ~min |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit` (+ `npx tsc --noEmit` after TS edits)
- **After every plan wave:** Run `npm run test:unit && npm run test:smoke`
- **Before `/gsd-verify-work`:** Full suite green + a fresh `npm run ui:shots:fresh` packaged capture
- **Max feedback latency:** ~20s (unit)

---

## Per-Task Verification Map

> Populated by the planner. Shape below; one row per task. SESS-05 logic = TDD (RED→GREEN);
> UI-04 visual + SESS-06 Browse = manual (see Manual-Only section).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-T* | 01 | 0 | SESS-05 / UI-04 (D-04) | T-12-01 (cwd → CR-01) | pure reducers: mergeAuthoritativeProfiles 4-field merge never touches status/errorMessage; validateSessionForm hints are convenience-only | unit | `npm run test:unit` | ✅ `src/renderer/merge-profiles.ts`, `validate-session-form.ts` | ✅ green (418/418) |
| 12-02-T* | 02 | 1-2 | UI-04 / SESS-05 / SESS-06 | T-12-01 | renderer-only D-02 restructure + blue 'Save changes'; rehydrateProfiles delegates to the tested reducer; **no new bridge key (EXPECTED_API_KEYS===20)** | unit + smoke | `npm run test:unit && npm run test:smoke` | ✅ `SessionEditModal.tsx`, `form.css` | ✅ green (unit 418; security.guard + tokens-completeness GREEN) |
| 12-03-T1 | 03 | 3 | SESS-05 (SC2 automated half) | T-12-01 (round-trip exercises CR-01-accepted path) | edit→Save changes→reopen cwd+startup round-trip proves main's persisted truth re-seeds the form (rehydrateProfiles + seed effect); identity stable | smoke | `npx wdio run wdio.conf.ts --spec tests/smoke/session-edit.smoke.test.ts` | ✅ `tests/smoke/session-edit.smoke.test.ts` | ✅ green (2/2 isolated; 3/3 isolated re-runs — parallel-load flake documented) |
| 12-03-T2 | 03 | 3 | UI-04 (SC1 visual) | — | packaged no-injection `ui:shots:fresh` (tag `p12-form-gate`, gitSha `d57576d`) of edit-modal + edit-modal-validation, scored PASS on every rubric line | visual (capture) | `UI_LAB_TAG=p12-form-gate npm run ui:shots:fresh` | ✅ `artifacts/ui-lab/p12-form-gate/{edit-modal,edit-modal-validation}.png` | ✅ green (both surfaces PASS rubric) |
| 12-03-T3 | 03 | 3 | UI-04 (SC1 LIVE) / SESS-05 (O-1) / SESS-06 (O-2) | T-12-01 (operator hand-types a bad cwd → main rejects inline) | one cohesive designed surface; first-open default cwd; Browse… fills absolute path + CR-01 still gates | manual (BLOCKING human-verify) | — (operator on packaged `npm run make`) | — | ⬜ pending (BLOCKING — orchestrator owns) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Pre-existing out-of-scope note:** `tests/smoke/pty-resize.smoke.test.ts` (PTY resize / `tput cols`
> round-trip — SC3 terminal fidelity) fails on this macOS dev box, but it fails **identically at the
> pre-plan 12-02 HEAD** and 12-03 changed **zero `src/` / PTY / resize code** (test files + ui-lab
> surfaces only). It is therefore pre-existing and out of scope for this verify-and-polish plan —
> logged in `deferred-items.md`, routed to a terminal-fidelity / Phase-15 follow-up. All
> **plan-relevant** smokes (session-edit incl. SESS-05 round-trip, startup-command, boot, security,
> + 9 others) are GREEN.

---

## Wave 0 Requirements

Pure electron/react-free reducer modules + their RED tests (the established repo pattern — `session-edit.ts`, `apply-status-event.ts`, etc. — so renderer logic is unit-testable in the Node/Vitest env):

- [ ] `src/renderer/merge-profiles.ts` + `src/renderer/__tests__/merge-profiles.test.ts` — pure `mergeAuthoritativeProfiles(rows, authoritative)` (SESS-05): merge main's persisted `cwd`/`shell`/`startupCommand`/`configured` back into rows by `logicalId`; never disturb `status`/`errorMessage`. RED: a fresh-spawn row (`cwd:''`) → main's truth; an edited-then-saved row → trimmed/validated truth.
- [ ] `src/renderer/validate-session-form.ts` + `src/renderer/__tests__/validate-session-form.test.ts` — pure `validateSessionForm(fields)` (D-04): empty-name → "keeps current name" neutral hint; cwd → absolute-path format hint; startup → optional/no-error. RED: each rule's field→message mapping.

*These extractions mirror the inline logic at `SessionManager.tsx:391-403` and the D-04 validation rules; they make the SESS-05 merge + the form validation TDD-able without jsdom.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Form reads as one cohesive designed surface (two-group structure, designed picker, blue Save, inline validation) | UI-04 (SC1) | Visual aesthetic judgment | Fresh `npm run ui:shots:fresh` packaged capture of the `edit-modal` + new `edit-modal-validation` surfaces, scored vs DESIGN-RUBRIC; then BLOCKING operator human-verify on the packaged app |
| Browse… fills the working-directory field with an absolute path; CR-01 still gates at Start | SESS-06 (SC3) | Native OS folder dialog cannot be driven in unit/smoke (no `dialog.showOpenDialog` automation) | Operator opens Edit → Browse… → picks a dir → field fills with the absolute path → Start spawns there; pick a non-existent/invalid path by hand → main rejects inline |
| Re-opening Edit shows the persisted cwd + startup command (not empty) | SESS-05 (SC2) | End-to-end main↔renderer round-trip on the packaged app (unit covers the merge reducer; live confirms the wiring) | Operator: edit a session (set cwd + startup) → Save → reopen Edit → fields show the saved values; also a brand-new session's first edit-open (O-1: resolved-home vs empty) |

*Unit tests cover the SESS-05 merge reducer + the D-04 validation rules; the live round-trips + the visual SC are the BLOCKING human-gate (mirrors Phases 10/11).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (UI-04 visual + SESS-06 Browse are documented Manual-Only)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the two pure-reducer extractions (merge-profiles + validate-session-form)
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter (only after the BLOCKING human-verify passes)

**Approval:** pending

---

## Re-Gate Evidence (12-07, Task 1) — 2026-06-16

Re-gate after gap-closure plans 12-04/05/06. Automated evidence chain against the
PACKAGED app + a fresh `ui:shots:fresh`. `nyquist_compliant` is NOT flipped here —
that is Task 3, only on the operator's explicit unqualified "approved" (Task 2).

**Capture:** tag `p12-regate` · gitSha `3aebb04` · binary `out/Just-Wrapper-darwin-arm64/Just-Wrapper.app` · window 1280×800.
A subsequent **test-only** fix (`3bb9f28`, below) does not affect the packaged binary or any captured surface, so the capture remains valid.

### Automated chain (no claim without stdout — testing-policy)

| # | Command | Result | Evidence |
|---|---------|--------|----------|
| 1 | `npx tsc --noEmit` | ✅ 0 errors | exit 0 (`TSC_EXIT=0`) |
| 2 | `npm run lint` (`eslint .`) | ✅ scoped clean | `npx eslint src tests` → exit 0. `eslint .` reports 12 errors, ALL in `.planning/spikes/{001,002,003}/*.cjs` (require()-style + unused-vars) — pre-existing, deferred (deferred-items.md §"12-06 deferred"); ZERO in `src/`/`tests/`. |
| 3 | `npm run test:unit` (`vitest run`) | ✅ GREEN | `Test Files 51 passed (51)` · `Tests 448 passed (448)` |
| 4 | `npm run test:smoke` (`wdio`) | ✅ GREEN | `Spec Files: 15 passed, 15 total (100% completed) in 00:01:05`, exit 0. Incl. the GAP-12-B specs: `applies a changed startup command via Restart to apply` ✓, `Later dismisses … without restarting` ✓, `round-trips cwd + startup … (SESS-05)` ✓ |
| 5 | `npm run ui:shots:fresh` | ✅ 14/14 captured | `14 passing`; `edit-modal` + `edit-modal-validation` captured (manifest p12-regate). `idle-card` SKIPPED — known WR-05 harness debt (menu has no "Stop"), deferred-items.md. |

### Smoke-fix finding (the re-gate caught a real defect — fixed test-only)

`startup-command.smoke` failed **3/3 ISOLATED** (not a parallel-load flake). Diagnosed to a **stale test**, NOT a product regression:
- **Root cause:** GAP-12-A (12-04) dropped the Save button's `context-menu-item` class (it was overriding the accent-blue). `clickMenuItem('Save changes')` queries only `.context-menu-item`, so Save never fired → modal stayed open → Remove could not run → "did not move into the Inactive List". 12-04 migrated `session-edit.smoke` to `clickByTestId('edit-save')` but missed this sibling.
- **Product proven correct independently:** `app-restart-restore.smoke` (Remove→dormant) + `session-edit.smoke`'s two GAP-12-B specs (live edit → prompt → Restart-now/Later) both pass; the ui-lab capture shows the blue Save in-frame. DEBT-02 lifecycle code was investigated, not hand-waved.
- **Fix (`3bb9f28`, test-only):** Save via `clickByTestId('edit-save')`; dismiss the now-appearing GAP-12-B "Restart to apply?" prompt with "Later". Result: **5/5 passing, 3/3 isolated GREEN (12.4s, no timeouts)** + full suite **15/15**.

### Visual rubric score (pixel evidence vs DESIGN-RUBRIC)

**§edit-modal** (`artifacts/ui-lab/p12-regate/edit-modal.png`)

| Rubric line | Verdict | Pixel evidence |
|-------------|---------|----------------|
| Save = accent-blue fill, "Save changes"; Cancel quiet neutral | ✅ PASS | Bottom-right "Save changes" renders as a solid BLUE pill; "Cancel" is neutral text (GAP-12-A) |
| `.modal-actions` (incl. Save) VISIBLE IN FRAME (not below fold) | ✅ PASS | The actions row + blue Save are in-frame at the dialog bottom (GAP-12-A/META `assertEditSaveCaptured`) |
| 18px dialog card + dialog shadow on dimmed backdrop | ✅ PASS | Rounded white card, soft elevation, screened backdrop |
| Two-group structure (Identity / "Launch · Applies on restart") + subhead + divider, single column | ✅ PASS | "LAUNCH · APPLIES ON RESTART" subhead + hairline above the cwd/Shell/Startup group; single column |
| Fields labeled soft-ink; ~8px inputs; accent focus ring | ✅ PASS | Working directory/Shell/Startup labels; rounded inputs; Name field shows blue focus ring |
| Icon/emoji picker tidy grid + selected ring; swatch row aligned | ✅ PASS | Emoji grid with the selected tile ringed; aligned color-swatch row |
| Even vertical rhythm; clear inter-group break | ✅ PASS | Even field spacing; the divider reads as a clear group break |

**§edit-modal-validation** (`artifacts/ui-lab/p12-regate/edit-modal-validation.png`)

| Rubric line | Verdict | Pixel evidence |
|-------------|---------|----------------|
| Empty-name hint "Keeps the current name" in `--ink-faint` | ✅ PASS | Grey calm hint under the empty Name field |
| cwd non-absolute hint in `--ink-faint` | ✅ PASS | "Enter an absolute path, or use Browse…" grey under the `not-absolute` cwd |
| Hints CALM — danger red NOT present (red only on real main rejection) | ✅ PASS | Both hints are faint grey; NO red anywhere in the frame (GAP-12-E) |
| Rest of form undisturbed; per-field validation | ✅ PASS | Other fields unaffected; hints are field-local |

> Note: the manifest's `edit-modal-validation` `expects` string ("Danger-ramp helper text") predates GAP-12-E; scored against DESIGN-RUBRIC §edit-modal-validation (authority: calm `--ink-faint`, no danger unless main rejects). Pixels match the rubric.

**Verdict (Task 1):** all rubric lines PASS, no FAIL/PARTIAL → cleared to present to the operator (T-10-10-01: never present a known-failing app).

**Verdict (Task 2/3) — 2026-06-16: QUALIFIED FAIL.** Operator ran the packaged-app human-verify: approved GAP-12-A / GAP-12-D / SESS-06 / SC1 (items 1/2/4/8), but reported failures on GAP-12-B (restart-to-apply → "shell wasn't ready in time", command not applied), GAP-12-C (bad-cwd rejection not visible), GAP-12-E (a non-existent path gets no feedback; Save closes anyway), and a NEW GAP-12-F (Cmd+1/2/K/F chords broke after the 12-05 Menu). Per-item words + reopened-gap table + routing recorded in `12-VERIFICATION.md` §"Re-Gate 1 Result". **`nyquist_compliant` stays `false`** (NOT flipped). Route: `/gsd-debug` (B/C/F) → `/gsd-plan-phase 12 --gaps` → re-execute → re-gate.
