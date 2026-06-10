# Roadmap: Just-Wrapper

## Milestones

- ✅ **v1.0 MVP** — Phases 1–8 (shipped 2026-06-10) — full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

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

### 🚧 v1.1 (Planned)

Scope defined via `/gsd-new-milestone`. Carried debt (see [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) + STATE.md Deferred Items):

- [ ] Windows real-hardware verification — installer run, shell dropdown + per-shell auto-run, pre-1809 dialog
- [ ] Session-edit UX polish — edit-modal prefill, working-directory folder picker, Start-control discoverability
- [ ] Close deferred code-review findings (Phase 05.1) + re-hand-verify Phase 06.1 CR-01..04/WR-02
- [ ] Flip Nyquist validation flags for phases 01/02/03 (formal only)

## Progress

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
