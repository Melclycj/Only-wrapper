### Phase 12: Session Form — Polish + Edit UX

**Goal**: The create/edit session form reads as one designed surface (grouped fields, clear labels, icon/color picker, inline validation), the Edit modal pre-fills the actually-persisted working directory and startup command, and the working-directory field offers a native Browse… folder picker.
**Depends on**: Phase 9
**Requirements**: UI-04, SESS-05, SESS-06
**Success Criteria** (what must be TRUE):

  1. A human opening the create/edit form sees one cohesive designed surface — grouped fields, clear labels, a real icon/color picker, and inline validation feedback rather than a raw stack of inputs.
  2. Re-opening the Edit Session modal shows the saved working directory and startup command already filled in, matching exactly what is persisted in main (the renderer record is refreshed from main after spawn / save, fixing the empty-field root cause).
  3. A native "Browse…" folder picker fills the working-directory field with an absolute path, and main still validates the value (the CR-01 path guard still gates it).
  4. Any new IPC bridge surface added for the folder picker is accounted for against the security key budget, and the EXPECTED_API_KEYS guard stays green.

**Plans**: 13 plans (3 original + 4 gap-closure round 1 + 3 gap-closure round 2 + 3 gap-closure round 3)
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

- [x] 12-08-PLAN.md — Main process: GAP-12-B (the headline) — replaced the fixed 4000ms READINESS_TIMEOUT_MS with a dual-deadline budget (READINESS_IDLE_TIMEOUT_MS=8000 idle-extend-on-progress + a mandatory READINESS_HARD_TIMEOUT_MS=15000 hard absolute ceiling, both routing ONE shared D-04 give-up closure) + the DEBT-02 real-timing regression built from the spike-005 heavy-init ZDOTDIR-sleep driver (npm run test:integration) + relocated the gap-12-c-bad-cwd-restart diag stub into a committed test — **DONE** (commits 800de51/f2cfb47/342a3b7; integration regression PROVES old-4000=timeout / new=match@5059ms / never-ready=hard@15003ms — fails the pre-fix code; EXPECTED_API_KEYS stays 20; 455 unit GREEN, tsc + eslint(src,tests) clean)
- [x] 12-09-PLAN.md — Renderer: GAP-12-C (handleRestart pid<=0 else surfaces a failed restart visibly — IdleCard + notice, applyStatusEvent contract unchanged) + GAP-12-E (no silent cwd drop — compare submitted vs persisted cwd via the existing listSessions re-read, surface an inline drop notice, keep the modal open; no new bridge key) + relocate the gap-12-c-surface diag stub into a committed test — **DONE** (commits ba1b529/151fea2/4937146; new pure cwdWasDropped/cwdDropNoticeFor reducer + frozen CWD_DROPPED_NOTICE; handleRestart pid<=0 clears the dead ptyPid so the broadcast error state wins → IdleCard; SessionEditModal renders the drop notice inline + keeps the modal open; applyStatusEvent contract unchanged; EXPECTED_API_KEYS stays 20, security.guard GREEN; SessionManager.tsx held < 800 lines (799); 469 unit GREEN (55 files), tsc + eslint(src,tests) clean)

*Wave 2 (blocked on 12-08/09)*

- [ ] 12-10-PLAN.md — Re-gate (round 2): full suite + npm run test:integration (DEBT-02 real-timing) + BLOCKING operator human-verify ON THE OPERATOR'S MACHINE covering GAP-12-B/C/E (rc-init latency is machine-specific); nyquist_compliant flips true only on explicit unqualified approval

**Gap-closure round 3 (from the re-gate-2 reopened gaps — APP-SIDE root cause CONFIRMED: GAP-12-B is MARKER-LOSS, not a latency budget — `gap_closure: true`)**

*Wave 1 (parallel — no file overlap: main vs renderer)*

- [x] 12-11-PLAN.md — Main process: GAP-12-B (marker RE-SEND) — re-write the SAME-nonce `: <nonce>` POSIX no-op while `!settled`, bounded by the EXISTING hard ceiling (a re-sent marker matches the UNCHANGED `\n[^\n]*<nonce>` matcher once the shell reaches a ready prompt; KEEP the idle-extend) + REMOVE the temporary DIAG instrumentation (commit 58bd829) + a DEBT-02 MARKER-LOSS regression (electron-free, opt-in — NOT the spike-005 sleep-heavy driver). Explicitly NOT another timeout-budget change. (req: SESS-05) — DONE 2026-06-16 (c541015/382eae5/520d9f7; READINESS_RESEND_INTERVAL_MS=1300; DIAG residue 0 in src/; 474 unit GREEN; EXPECTED_API_KEYS=20; awaiting 12-13 BLOCKING live re-gate)
- [x] 12-12-PLAN.md — Renderer: GAP-12-E (precedence) — move `setRestartPromptId` INTO the async block AFTER the cwd drop-check, gated on `notice === null`; an invalid path BLOCKS Save (inline reminder, modal stays open, restart prompt SUPPRESSED); only a clean save closes + (if live launch fields changed) prompts. No new IPC, EXPECTED_API_KEYS stays 20, SessionManager.tsx < 800 lines. (req: UI-04, SESS-06) — DONE 2026-06-16 (05de169; statement move only, reused cwdDropNoticeFor/restartPromptIdFor; save-precedence.test.ts pins the ordering; tsc+eslint clean; 223 renderer GREEN; security.guard 4 GREEN; SessionManager.tsx 799 lines; awaiting 12-13 BLOCKING live re-gate)

*Wave 2 (blocked on 12-11/12)*

- [ ] 12-13-PLAN.md — Re-gate (round 3): package the fix branch + full suite + both integration regressions + BLOCKING operator human-verify on a COLD Dock launch (`sudo purge` then cold launch — the ONLY condition that reproduces marker-loss) covering GAP-12-B (cold Restart + cold Start auto-run) + GAP-12-C (visible failed-spawn error) + GAP-12-E (invalid path blocks Save). nyquist_compliant flips true ONLY on explicit unqualified approval of all three; automated GREEN is NOT proof (DEBT-02 bit twice). (req: UI-04, SESS-05, SESS-06)

**UI hint**: yes
