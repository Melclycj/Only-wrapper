# Roadmap: Just-Wrapper

## Milestones

- ✅ **v1.0 MVP** — Phases 1–8 (shipped 2026-06-10) — full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 UI Polish & Debt Cleanup** — Phases 9–15 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–8) — SHIPPED 2026-06-10</summary>

Built inside-out: Core Value (real terminal fidelity) proven first, then the session model, identity, persistence, and finally cross-platform packaging. Every phase left the app runnable. Full phase detail (goals, success criteria, plan breakdowns) is in [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

- [x] Phase 1: Project Scaffold + Dev Infrastructure (3/3 plans) — completed 2026-06-03
- [x] Phase 2: PTY Core + Terminal Fidelity (4/4 plans) — completed 2026-06-04
- [x] Phase 3: Multi-Session + Session Lifecycle (3/3 plans) — completed 2026-06-04
- [x] Phase 4: Session Identity + Sidebar UI (4/4 plans) — completed 2026-06-05
- [x] Phase 5: Persistence + Shell Discovery (4/4 plans) — completed 2026-06-06
- [x] Phase 5.1: TERM-05 startup-command auto-run (INSERTED) (3/3 plans) — completed 2026-06-06
- [x] Phase 6: Robustness + Flow-Control Polish — ⚠️ SUPERSEDED by Phase 6.1 (idle-detection model failed human-verify, redesigned)
- [x] Phase 6.1: Terminal Lifecycle Redesign (INSERTED) (4/4 plans) — completed 2026-06-09
- [x] Phase 7: Terminal Search + Scrollback Config (5/5 plans) — completed 2026-06-09
- [x] Phase 8: Cross-Platform Packaging (3/3 plans) — completed 2026-06-10

</details>

### 🚧 v1.1 UI Polish & Debt Cleanup (Phases 9–15) — In Progress

**Milestone Goal:** Clear the v1.0 carried debt and give the whole app one cohesive visual-polish pass — from "works" to "looks intentionally designed" — without regressing terminal fidelity (the v1.0 Core Value). No major new features; APPR appearance + BROW browser companion stay in v2.

Phase numbering continues from v1.0 (which ended at Phase 8). v1.0 phase directories (`01-*` … `08-*`, including `05.1` and `06.1`) are preserved untouched — the debt phases read their REVIEW / VALIDATION artifacts.

- [x] **Phase 9: Design Token Foundation** — Lock one cohesive design-token system (palette, type, spacing, surface, radius, motion) and wire it app-wide. (completed 2026-06-11)
- [ ] **Phase 10: Sidebar Visual Polish** — Apply the tokens to the session sidebar: clear hierarchy, legible 5-state status, unmistakable active session (expanded + collapsed). (gaps found 2026-06-11 — human gate; 2nd gate 2026-06-11 NOT_APPROVED_PARTIAL: GAP-10-D/E/F → 10-07 pending)
- [ ] **Phase 11: Terminal Area Polish + Live Start/Restart** — Polish the terminal-area chrome (header, Working Area / Inactive List, controls) and add a discoverable Start/Restart control for live sessions.
- [ ] **Phase 12: Session Form — Polish + Edit UX** — Make the create/edit form one designed surface, fix saved-cwd/startup prefill (record round-trip), and add a native folder picker.
- [ ] **Phase 13: State & Interaction Design** — Design the empty / loading / error states and consistent hover / focus / active + keyboard-focus states across the app.
- [ ] **Phase 14: Code-Review Debt Closure** — Resolve the Phase 05.1 deferred findings and correctly redo the Phase 06.1 lifecycle criticals with real-path tests + a mandatory human re-verify.
- [ ] **Phase 15: Formal Validation + Windows Verification Kit** — Flip the Nyquist flags for phases 01/02/03 with evidence, build the Windows real-hardware verification kit, and carry WIN-02 as a deferred human-UAT sign-off gate.

## Phase Details

### Phase 9: Design Token Foundation

**Goal**: One deliberately-chosen visual direction exists as a single design-token system (palette, typography scale, spacing scale, surface/elevation, radius, motion) and is wired app-wide as the foundation every later surface applies. The actual direction is decided at plan time via the UI-SPEC step (gsd-ui-phase), not in this roadmap.
**Depends on**: Phase 8 (v1.0 complete)
**Requirements**: UI-01
**Success Criteria** (what must be TRUE):

  1. A human opening the running app sees one coherent visual direction — colors, type, spacing, and surfaces clearly belong to the same design system, not a piecemeal mix.
  2. All surface colors, type sizes, spacing, radius, and motion durations are sourced from named design tokens (no ad-hoc hardcoded values scattered across components).
  3. Switching the token values in one place visibly re-themes the whole app consistently, proving the tokens are the single source of truth.
  4. The terminal renders and behaves exactly as before — token wiring touches chrome only and does not regress terminal fidelity.

**Scope note (hybrid, D-01)**: Phase 9 DEFINES the complete `--space-*` scale and FULLY migrates the GLOBAL repeated primitives (accent/danger + 5 status accents, 3 shadows, radius, motion, font stacks) to tokens, and LOADS the fonts. Per-surface spacing-VALUE migration completes across Phases 10–13. SC2 is satisfied for the global primitives + the scale exists; SC3 is proven by the color/font primitives.**Plans**: 3 plans
**Wave 1**

  - [x] 09-01-PLAN.md — Install @fontsource fonts (supply-chain gate) + create tokens.css single-source layer + wire renderer-entry imports (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

  - [x] 09-02-PLAN.md — Migrate global primitives in terminal.css → var()/color-mix + status-colors.ts → var(--accent-*) + add tokens-completeness guard test (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

  - [x] 09-03-PLAN.md — Packaged-font build-output assertion + end-of-phase human-verify (SC1/SC3/font render) phase gate (Wave 3)

**UI hint**: yes

### Phase 10: Sidebar Visual Polish

**Goal**: The session sidebar presents an intentional visual hierarchy in both expanded and collapsed modes — icon, name, and 5-state status are legible and clearly styled, and the active session is unmistakably distinguished.
**Depends on**: Phase 9
**Requirements**: UI-02
**Success Criteria** (what must be TRUE):

  1. A human scanning the sidebar can instantly tell which session is active — it is visually distinct from inactive rows at a glance.
  2. Each row's icon, name, and status badge read with clear hierarchy; the 5 statuses (not started / running / stopped / exited / error) are legible and distinguishable by their styling.
  3. In collapsed (icon-only) mode the active session and per-row status remain identifiable, and the layout stays clean at the narrow rail width.
  4. Sidebar interactions (click-to-switch, drag-to-reorder, keyboard switching) continue to work unchanged and the terminal keep-alive on switch is not regressed.

**Plans**: 6 plans (4 original + 2 gap-closure)
**Wave 1**

  - [x] 10-01-PLAN.md — Pure modules (row-secondary D-03 + viewport-clamp D-14) with tests + extract sidebar CSS → sidebar.css and wire the 3 touch-points (Wave 1)

**Wave 2** *(blocked on Wave 1; the two run in parallel — disjoint files)*

  - [x] 10-02-PLAN.md — Sidebar.tsx two-line restructure + sidebar.css visual rules (active card/edge bar, amber waiting wash, icon tile, dashed recipe cards, ghost ▶, section counts, collapsed continuity) + ui-lab evidence surfaces (Wave 2)
  - [x] 10-03-PLAN.md — ContextMenu D-14 viewport clamp + D-15 danger-ramp Remove/Delete + SessionManager wiring + danger CSS (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

  - [x] 10-04-PLAN.md — Full suite + packaged ui-lab capture scored against the rubric + blocking end-of-phase human-verify (SC1-SC4) phase gate (Wave 3) — verdict NOT_APPROVED; 3 gaps routed to gap-closure

**Gap-closure** *(human gate NOT_APPROVED — closing GAP-10-A name-crush + GAP-10-B amber-waiting + WR-03/WR-04/IN-05; GAP-10-C resolved by user, no code change)*

**Wave 4 (gap-closure code fixes)**

  - [x] 10-05-PLAN.md — Collapse hover-control box to zero width at rest (GAP-10-A/WR-01) + running-gate the data-agent seam & unit-test it & trace the WR-02 live chain (GAP-10-B/WR-03) + order-independent waiting-beats-active edge bar (WR-04) + unblock the ui-lab sidebar-waiting capture seam (IN-05) (Wave 4)

**Wave 5 (gap-closure gate; blocked on Wave 4)**

  - [x] 10-06-PLAN.md — Full suite + fresh packaged no-injection capture (incl. the unblocked sidebar-waiting surface) + rescore SC2/D-09 + BLOCKING human re-verify of the two live-app items (closes P04-T1/P04-T3, flips the Nyquist gate only on explicit "approved") (Wave 5)

**UI hint**: yes

### Phase 11: Terminal Area Polish + Live Start/Restart

**Goal**: The terminal-area chrome is visually polished and clearly structured — session header, the Working Area vs Inactive List split, and the live-session controls (Clear / Remove / Restart, plus Start on inactive entries) — and a live session exposes a discoverable Start/Restart control so the user never has to type `exit` to recycle a session.
**Depends on**: Phase 9
**Requirements**: UI-03, SESS-07
**Success Criteria** (what must be TRUE):

  1. A human sees a clearly structured terminal area — the session header, the Working Area, and the Inactive List are visually distinct and the live-session controls read as a designed control cluster.
  2. The Working Area vs Inactive List boundary is obvious at a glance, and Start ▶ on inactive entries vs the live controls are unambiguous.
  3. A live session shows a discoverable Start/Restart control (consistent with the dormant-record Start ▶ promotion path) — the user can recycle a session without typing `exit`.
  4. Restart preserves the logical session id and scrollback, and the terminal surface keeps full native fidelity (no scroll / alt-screen regression).

**Plans**: TBD
**UI hint**: yes

### Phase 12: Session Form — Polish + Edit UX

**Goal**: The create/edit session form reads as one designed surface (grouped fields, clear labels, icon/color picker, inline validation), the Edit modal pre-fills the actually-persisted working directory and startup command, and the working-directory field offers a native Browse… folder picker.
**Depends on**: Phase 9
**Requirements**: UI-04, SESS-05, SESS-06
**Success Criteria** (what must be TRUE):

  1. A human opening the create/edit form sees one cohesive designed surface — grouped fields, clear labels, a real icon/color picker, and inline validation feedback rather than a raw stack of inputs.
  2. Re-opening the Edit Session modal shows the saved working directory and startup command already filled in, matching exactly what is persisted in main (the renderer record is refreshed from main after spawn / save, fixing the empty-field root cause).
  3. A native "Browse…" folder picker fills the working-directory field with an absolute path, and main still validates the value (the CR-01 path guard still gates it).
  4. Any new IPC bridge surface added for the folder picker is accounted for against the security key budget, and the EXPECTED_API_KEYS guard stays green.

**Plans**: TBD
**UI hint**: yes

### Phase 13: State & Interaction Design

**Goal**: Empty, loading, and error states across the app are intentionally designed and informative, and every interactive control has consistent, designed hover / focus / active states with a visible keyboard-focus indicator.
**Depends on**: Phase 10, Phase 11, Phase 12
**Requirements**: UI-05, UI-06
**Success Criteria** (what must be TRUE):

  1. A human sees designed, informative empty / loading / error states — no-sessions-yet, session-starting, spawn/error cards, and the ready-fail notice all communicate clearly instead of appearing raw or blank.
  2. Hovering, focusing, and activating any control produces consistent, intentional visual feedback across the whole app.
  3. Keyboard-only navigation shows a visible focus indicator on every actionable element, so a human tabbing through can always see where focus is.
  4. These interaction states layer onto the existing surfaces without regressing terminal focus behavior or the app-wins keyboard switching.

**Plans**: TBD
**UI hint**: yes

### Phase 14: Code-Review Debt Closure

**Goal**: The Phase 05.1 deferred code-review findings are resolved or explicitly closed with rationale, and the Phase 06.1 lifecycle criticals are correctly redone with tests that exercise the real code path (including failure/edge paths) followed by a mandatory user re-verify in the running app. Automated green is explicitly NOT accepted as proof of the lifecycle fixes — the 2026-06-09 remediation passed the suite while broken and was reverted.
**Depends on**: Phase 8 (reads `05.1-REVIEW.md` + `06.1-REVIEW.md` artifacts; independent of the UI phases)
**Requirements**: DEBT-01, DEBT-02
**Success Criteria** (what must be TRUE):

  1. Every Phase 05.1 deferred finding (WR-01..05, IN-01..03) is either fixed or explicitly closed with written rationale — notably WR-01 (dead D-02 invisibility-scrub path) and WR-02 (probe-matcher same-chunk-echo false-positive), tuned against real cold zsh/bash captures.
  2. The Phase 06.1 criticals (CR-01 dock-relaunch quit-flag reset, CR-02 concurrent-restart lock cleared in `finally`, CR-03 failed-write-does-not-clear-dirty + follow-up write, CR-04 setOrder id-validate + clamp, WR-02 handleRestart `pid > 0` guard) are redone with tests that exercise the real failure/edge paths (failed respawn, write rejection), not a suite that can pass while broken.
  3. A human re-verifies the lifecycle in the running app — start / restart / quit→relaunch round-trip / rapid double-restart / mid-write durability — and signs off; the fix is not considered done on automated green alone.
  4. No regression in persistence or lifecycle, and terminal fidelity is unchanged.

**Plans**: TBD

### Phase 15: Formal Validation + Windows Verification Kit

**Goal**: The Nyquist validation flags for phases 01/02/03 are flipped to compliant with backing evidence (formal closure only — the functional behavior already passed during v1.0), and a ready-to-run Windows real-hardware verification kit is delivered. The actual Windows real-hardware run (WIN-02) is carried as an explicit deferred human-UAT sign-off gate the user executes on real Windows hardware (mirroring the existing `08-HUMAN-UAT.md` pattern); it does not block this phase's delivery.
**Depends on**: Phase 8 (reads phase 01/02/03 evidence + phase 08 packaging artifacts); independent of the UI phases
**Requirements**: VAL-01, WIN-01, WIN-02
**Success Criteria** (what must be TRUE):

  1. The `nyquist_compliant` flags for phases 01, 02, and 03 are flipped to true with the backing evidence cited (the functional verification that already passed during v1.0).
  2. A Windows real-hardware verification kit exists and is ready to execute without further setup — a UAT checklist (installer run, shell-dropdown enumeration, per-shell `claude --rc` auto-run, pre-1809 ConPTY dialog), the build artifacts, and run instructions.
  3. WIN-02 is recorded as an explicit deferred human-UAT gate (e.g. a `HUMAN-UAT.md`) the user runs on real Windows hardware and signs off, mirroring the `08-HUMAN-UAT.md` precedent; the milestone delivers the kit and earlier phases are not blocked on it.
  4. The kit-building work leaves the app runnable on macOS and does not regress terminal fidelity.

**Plans**: TBD

## Progress

**Execution Order:**
v1.1 phases execute in numeric order: 9 → 10 → 11 → 12 → 13 → 14 → 15. (Phases 14 and 15 are independent of the UI phases and may be scheduled flexibly; WIN-02 is a deferred gate.)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Scaffold + Dev Infrastructure | v1.0 | 3/3 | Complete | 2026-06-03 |
| 2. PTY Core + Terminal Fidelity | v1.0 | 4/4 | Complete | 2026-06-04 |
| 3. Multi-Session + Session Lifecycle | v1.0 | 3/3 | Complete | 2026-06-04 |
| 4. Session Identity + Sidebar UI | v1.0 | 4/4 | Complete | 2026-06-05 |
| 5. Persistence + Shell Discovery | v1.0 | 4/4 | Complete | 2026-06-06 |
| 5.1 TERM-05 startup-command auto-run | v1.0 | 3/3 | Complete | 2026-06-06 |
| 6. Robustness + Flow-Control Polish | v1.0 | — | Superseded by 6.1 | 2026-06-09 |
| 6.1 Terminal Lifecycle Redesign | v1.0 | 4/4 | Complete | 2026-06-09 |
| 7. Terminal Search + Scrollback Config | v1.0 | 5/5 | Complete | 2026-06-09 |
| 8. Cross-Platform Packaging | v1.0 | 3/3 | Complete | 2026-06-10 |
| 9. Design Token Foundation | v1.1 | 3/3 | Complete    | 2026-06-11 |
| 10. Sidebar Visual Polish | v1.1 | 6/6 | Gaps found |  |
| 11. Terminal Area Polish + Live Start/Restart | v1.1 | 0/TBD | Not started | - |
| 12. Session Form — Polish + Edit UX | v1.1 | 0/TBD | Not started | - |
| 13. State & Interaction Design | v1.1 | 0/TBD | Not started | - |
| 14. Code-Review Debt Closure | v1.1 | 0/TBD | Not started | - |
| 15. Formal Validation + Windows Verification Kit | v1.1 | 0/TBD | Not started | - |
