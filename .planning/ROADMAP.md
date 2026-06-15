### Phase 12: Session Form — Polish + Edit UX

**Goal**: The create/edit session form reads as one designed surface (grouped fields, clear labels, icon/color picker, inline validation), the Edit modal pre-fills the actually-persisted working directory and startup command, and the working-directory field offers a native Browse… folder picker.
**Depends on**: Phase 9
**Requirements**: UI-04, SESS-05, SESS-06
**Success Criteria** (what must be TRUE):

  1. A human opening the create/edit form sees one cohesive designed surface — grouped fields, clear labels, a real icon/color picker, and inline validation feedback rather than a raw stack of inputs.
  2. Re-opening the Edit Session modal shows the saved working directory and startup command already filled in, matching exactly what is persisted in main (the renderer record is refreshed from main after spawn / save, fixing the empty-field root cause).
  3. A native "Browse…" folder picker fills the working-directory field with an absolute path, and main still validates the value (the CR-01 path guard still gates it).
  4. Any new IPC bridge surface added for the folder picker is accounted for against the security key budget, and the EXPECTED_API_KEYS guard stays green.

**Plans**: 10 plans (3 original + 4 gap-closure round 1 + 3 gap-closure round 2)
**Wave 1**

- [x] 12-01-PLAN.md — Wave-0 foundation: extract mergeAuthoritativeProfiles + validateSessionForm pure reducers (RED→GREEN) + add the edit-modal-validation ui-lab surface + DESIGN-RUBRIC update

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 12-02-PLAN.md — Renderer composition: SessionEditModal D-02 two-group restructure + IconPicker polish + D-04 inline validation + blue Save + form.css extract + SESS-05 rehydrate rewire

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 12-03-PLAN.md — Gate: SESS-05 round-trip smoke + Save-label lockstep + packaged ui:shots:fresh capture + BLOCKING end-of-phase human-verify (SC1 / O-1 / O-2) — QUALIFIED FAIL (5 gaps, see 12-VERIFICATION.md)

**Gap-closure round 1 (from 12-VERIFICATION.md human-gate — `gap_closure: true`)**

*Wave 1 (parallel — no file overlap)*

- [x] 12-04-PLAN.md — Renderer/CSS: GAP-12-A (Save → accent-blue, drop context-menu-item, drive Save by data-testid) + GAP-12-E (calm validation tone verify) + GAP-12-D overlay-close guard + META (ui-lab edit-modal capture now includes the Save button)
- [x] 12-05-PLAN.md — Main process: GAP-12-D (application Menu with standard Edit roles — Cmd+A/C/V/X work; chords untouched)

*Wave 2 (blocked on 12-04)*

- [x] 12-06-PLAN.md — Lifecycle: GAP-12-B (Restart-to-apply prompt reusing the retained ptyRestart — same logicalId, new ptyPid) + GAP-12-C (bad-cwd CR-01 rejection surfaced where the user acted) + IN-02 SessionManager extraction (<800 lines) — **DONE** (RestartApplyPrompt + pure session-restart-prompt/session-lifecycle-actions reducers; handleRestart re-surfaced with pid>0 guard; SessionManager.tsx 798 lines; EXPECTED_API_KEYS stays 20; 448 unit GREEN, tsc/scoped-lint clean, session-edit smoke 4/4 isolated incl. 2 new GAP-12-B specs proving new ptyPid + marker-in-buffer + Later-no-restart)

*Wave 3 (blocked on 12-04/05/06)*

- [x] 12-07-PLAN.md — Re-gate (round 1): full suite + packaged ui:shots:fresh (Save button in-frame) + BLOCKING operator human-verify covering GAP-12-A..E — QUALIFIED FAIL: GAP-12-B/C/E reopened (see 12-VERIFICATION.md §"Re-Gate 1 Result" + §"Diagnosis complete"); root causes diagnosed in .planning/debug/gap-12-b-restart-probe-timeout.md; nyquist stays false

**Gap-closure round 2 (from the re-gate-1 reopened gaps — root causes CONFIRMED + diagnosed — `gap_closure: true`)**

*Wave 1 (parallel — no file overlap: main vs renderer)*

- [ ] 12-08-PLAN.md — Main process: GAP-12-B (the headline) — replace the fixed 4000ms READINESS_TIMEOUT_MS with a dual-deadline budget (8000ms idle-extend-on-progress + a mandatory 15000ms hard absolute ceiling, both routing through the D-04 give-up path) + the DEBT-02 real-timing regression built from the spike-005 heavy-init driver (npm run test:integration) + relocate the gap-12-c-bad-cwd-restart diag stub into a committed test
- [ ] 12-09-PLAN.md — Renderer: GAP-12-C (handleRestart pid<=0 else surfaces a failed restart visibly — IdleCard + notice, applyStatusEvent contract unchanged) + GAP-12-E (no silent cwd drop — compare submitted vs persisted cwd via the existing listSessions re-read, surface an inline drop notice, keep the modal open; no new bridge key) + relocate the gap-12-c-surface diag stub into a committed test

*Wave 2 (blocked on 12-08/09)*

- [ ] 12-10-PLAN.md — Re-gate (round 2): full suite + npm run test:integration (DEBT-02 real-timing) + BLOCKING operator human-verify ON THE OPERATOR'S MACHINE covering GAP-12-B/C/E (rc-init latency is machine-specific); nyquist_compliant flips true only on explicit unqualified approval

**UI hint**: yes
