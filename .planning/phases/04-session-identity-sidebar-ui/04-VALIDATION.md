---
phase: 4
slug: session-identity-sidebar-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Per-task map + Wave 0 list are populated by the planner (see 04-RESEARCH.md §"Validation Architecture").

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit, Node env) + WebdriverIO/@wdio/electron-service (E2E) |
| **Config file** | vitest.config.ts / wdio.conf.ts |
| **Quick run command** | `npm test` (Vitest unit) |
| **Full suite command** | `npm test && npm run test:e2e` |
| **Estimated runtime** | ~quick: seconds (unit) · full: minutes (E2E launches Electron) |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (Vitest unit + guard tests)
- **After every plan wave:** Run full suite (`npm test && npm run test:e2e`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** unit seconds; E2E per-run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(populated by planner from 04-RESEARCH.md Validation Architecture)_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] _(populated by planner — RED test stubs for IDENT-03, SESS-01..04, NAV-01/02/03/05)_

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| _(populated by planner — e.g. emoji rendering fidelity, visual cozy-aesthetic checks)_ | | | |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency low
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
