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
| (planner populates) | — | — | UI-04 / SESS-05 / SESS-06 | T-12-01 (cwd path → CR-01, unchanged) | main stays validator of record; no new bridge key | unit / smoke / manual | `npm run test:unit` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

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
