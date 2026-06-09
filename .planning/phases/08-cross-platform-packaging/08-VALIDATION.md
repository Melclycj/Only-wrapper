---
phase: 8
slug: cross-platform-packaging
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Per-task map is populated by the planner; frontmatter seeded by plan-phase orchestrator.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit) + WebdriverIO `@wdio/electron-service` (smoke, against the PACKAGED binary) |
| **Config file** | `vitest` (package.json) / `wdio.conf.ts` |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test` (unit + smoke) |
| **Estimated runtime** | ~unit seconds + smoke minutes (smoke requires `npm run package` output) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm run test` (smoke requires a fresh `npm run package`/`npm run make`)
- **Before `/gsd-verify-work`:** Full suite must be green AND the packaged-app smoke must pass on macOS
- **Max feedback latency:** unit < 30s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {planner fills} | | | PKG-01 | | | unit / smoke | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Planner fills from RESEARCH.md Wave 0 gap list. Expected areas: Windows shell-discovery pure-helper unit stubs, Windows readiness-probe pure-helper unit stubs, ConPTY build-number parse pure-helper unit stub, os-conditional `appBinaryPath` smoke harness wiring.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canonical `claude --rc` scenario in the PACKAGED app (SC2) | PKG-01 | CI runners lack `claude`; interactive agent launch needs a human | Build with `npm run make`; create session Name "Parlour Claude RC" / Icon 🛋️ / Path a real project dir / Command `claude --rc`; confirm it launches interactively |
| Windows `.exe` / installer runs + PTY-in-ASAR (SC1/SC3 on real Windows) | PKG-01 | Dev/test is macOS-only; CI smoke is best-effort | Run CI matrix `windows-latest` artifact, or user launches the installer on their Windows machine |
| Pre-1809 Windows error dialog (SC4) | PKG-01 | Requires a real/VM Windows build < 17763 | Launch on a pre-1809 Windows; confirm the native error dialog + clean quit (no crash) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
