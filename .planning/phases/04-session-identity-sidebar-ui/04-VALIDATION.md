---
phase: 4
slug: session-identity-sidebar-ui
status: complete
nyquist_compliant: true
wave_0_complete: true
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
| 01-T1 | 04-01 | 0 | NAV-05, SESS-01..04 | — | RED stubs assert the not-yet-built contracts (fail-fast Nyquist) | Unit + E2E stub | `npm run test:unit` (5 new files RED) | ✅ stubs exist | ✅ green (RED-by-design) |
| 01-T2 | 04-01 | 1 | NAV-05, SESS-03 | — | Pure matcher/reducer/icon/split modules, React/xterm/electron-free | Unit | `npm run test:unit` (switch-keys, session-switch, icon-spec, session-edit GREEN) | ✅ | ✅ green |
| 01-T3 | 04-01 | 1 | SESS-01, SESS-04 | T-04-01/02/03/04 | id-validated + type-guarded `updateProfile`; 15-key guard; startupCommand stored-only | Unit | `npm run test:unit` (security.guard + pty-update-profile GREEN) | ✅ | ✅ green |
| 02-T* | 04-02 | 2 | SESS-01, SESS-02, SESS-03, SESS-04, IDENT-03 | T-04-01/02 | Create/Edit modal + IconPicker + IdentityHeader wired through `ptyUpdateProfile` | Unit + E2E | `npm run test:smoke -- session-edit.smoke` | ✅ | ✅ green |
| 03-T* | 04-03 | 3 | NAV-05 | T-04-03 | `before-input-event` → `session:switch` → `resolveSwitch` (A1 proof) | E2E | `npm run test:smoke -- keyboard-switch.smoke` | ✅ | ✅ green |
| 04-T* | 04-04 | 4 | NAV-01, NAV-02 | — | Collapsible sidebar keeps icon + status dot identifiable; closes Nyquist | E2E | `npm run test:smoke -- sidebar-collapse.smoke` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Plans 02–04 task rows are placeholders (`*`) the later planners refine per-task; the requirement/test-type/command columns are the binding Wave map.*

---

## Wave 0 Requirements

RED stubs landed in 04-01 Task 1 (fail-fast Nyquist — each imports a not-yet-built
module/method or drives a not-yet-wired DOM surface):

- [x] **NAV-05** — `src/main/__tests__/switch-keys.test.ts` (matchSwitchKey) + `src/renderer/__tests__/session-switch.test.ts` (resolveSwitch) + `tests/smoke/keyboard-switch.smoke.test.ts` (A1 E2E proof)
- [x] **SESS-03** — `src/renderer/__tests__/icon-spec.test.ts` (emojiSpec/colorSpec/COLOR_INITIAL)
- [x] **SESS-01 / SESS-04** — `src/main/__tests__/pty-update-profile.test.ts` (id-validated, type-guarded record write; stored shell drives respawn; startupCommand stored-only)
- [x] **SESS-01 / SESS-02 / SESS-04** — `src/renderer/__tests__/session-edit.test.ts` (splitEdit) + `tests/smoke/session-edit.smoke.test.ts` (live rename, stable id E2E)
- [x] **NAV-01 / NAV-02** — `tests/smoke/sidebar-collapse.smoke.test.ts` (collapse keeps icon + status dot)
- [x] **5 driver helpers** — `tests/smoke/helpers/xterm-driver.ts` exports `openContextMenu`, `clickMenuItem`, `toggleCollapse`, `pressSwitchChord`, `readIdentityHeader`

The five Wave-0 UNIT stubs close in 04-01 Tasks 2–3 (this plan); the three E2E stubs
go GREEN as plans 04-02 (edit), 04-03 (keyboard-switch), 04-04 (collapse) land.
`nyquist_compliant` stays `false` until Plan 04 closes the last E2E gap.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| _(populated by planner — e.g. emoji rendering fidelity, visual cozy-aesthetic checks)_ | | | |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency low
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** signed off 2026-06-05 — all six Wave-0 stubs GREEN (82 unit tests + the
three Phase-4 E2E smoke tests: `session-edit`, `keyboard-switch`, `sidebar-collapse`).
The collapse vertical slice (04-04) closed the last E2E gap; NAV-01/NAV-02/SESS-03
satisfied. Nyquist contract met.
