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
> Per-task map populated by the planner; frontmatter seeded by plan-phase orchestrator.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit) + WebdriverIO `@wdio/electron-service` (smoke, against the PACKAGED binary) |
| **Config file** | `vitest` (package.json) / `wdio.conf.ts` |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test` (unit + smoke) |
| **Estimated runtime** | unit seconds + smoke minutes (smoke requires `npm run make` / `npm run package` output) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm run test` (smoke requires a fresh `npm run make`/`npm run package`)
- **Before `/gsd-verify-work`:** Full suite green AND the packaged-app smoke passes on macOS
- **Max feedback latency:** unit < 30s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01 T1 | 01 | 1 | PKG-01 | T-08-02 | Pre-1809 host detected by a pure gate BEFORE any node-pty spawn (fail-open on unparseable) | unit | `npm run test:unit -- src/main/__tests__/os-gate.test.ts` | ❌ W0 → src/main/os-gate.ts (+test) | ⬜ pending |
| 08-01 T2 | 01 | 1 | PKG-01 | T-08-01 | Env-gated osxSign/osxNotarize slots; NO committed Apple secret | static/grep | `grep -q appBundleId forge.config.ts && grep -q osxNotarize forge.config.ts && ! grep -RnE "APPLE_[A-Z_]+\s*[:=]\s*['\"][^'\"]+" forge.config.ts` | ❌ W0 → assets/icon.*, docs/PACKAGING.md | ⬜ pending |
| 08-01 T3 | 01 | 1 | PKG-01 | T-08-03 | Packaged PTY round-trip from inside ASAR (spawn-helper from app.asar.unpacked); proven node-pty mechanics untouched | smoke (packaged) | `npm run make && npm run test:smoke` | ✅ extend pty-roundtrip.smoke.test.ts + ❌ W0 wdio.conf.ts OS-conditional | ⬜ pending |
| 08-02 T1 | 02 | 1 | PKG-01 | T-08-06 | WindowsShellProvider never-empty (Windows-aware default first); env-expanded paths, no bare hardcode | unit | `npm run test:unit -- src/main/__tests__/shell-discovery.test.ts` | ✅ extend shell-discovery.ts + test | ⬜ pending |
| 08-02 T2 | 02 | 1 | PKG-01 | T-08-05 | Windows readiness: POSIX reuse (Git Bash/WSL) + degrade-loudly (CMD/PowerShell) — no mis-fire; zero new bridge key | unit | `npm run test:unit -- src/main/__tests__/readiness-probe.test.ts` | ✅ extend readiness-probe.ts + test | ⬜ pending |
| 08-03 T1 | 03 | 2 | PKG-01 | T-08-09 | 2-OS CI matrix; ZERO secrets; unsigned; no mandatory rebuild | static/CI | `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/build.yml'))"` + CI `make` GREEN both legs | ❌ W0 → .github/workflows/build.yml | ⬜ pending |
| 08-03 T2 | 03 | 2 | PKG-01 | T-08-12 | Canonical `claude --rc` packaged scenario (SC2) + live SC4 dialog | human-verify (blocking) | manual — macOS primary, Windows best-effort | N/A — human gate | ⬜ pending |
| invariant | all | — | PKG-01 | T-08-04/08 | contextBridge surface unchanged — exactly 20 EXPECTED_API_KEYS; node-pty in main | unit | `npm run test:unit` (security.guard stays GREEN) | ✅ exists (must stay GREEN) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> These MISSING references are created in Wave 1 (Plans 01/02) before / as their tasks run.

- [ ] `src/main/os-gate.ts` + `src/main/__tests__/os-gate.test.ts` — pure parseWindowsBuild + isUnsupportedWindows (D-05/SC4) — **Plan 01 Task 1**
- [ ] `wdio.conf.ts` OS-conditional `appBinaryPath` (macOS .app / Windows .exe) — **Plan 01 Task 3** (greenfield edit to a hardcoded slot)
- [ ] `assets/icon.{icns,ico,png}` placeholder + `docs/PACKAGING.md` (D-04/D-07) — **Plan 01 Task 2**
- [ ] `buildWindowsShellList` pure builder + filled `WindowsShellProvider` + extended `shell-discovery.test.ts` (D-02) — **Plan 02 Task 1**
- [ ] Filled `WindowsReadinessProbe.forShell()` (POSIX reuse + CMD/PowerShell marker-or-degrade) + extended `readiness-probe.test.ts` (D-03) — **Plan 02 Task 2**
- [ ] Extend `tests/smoke/pty-roundtrip.smoke.test.ts` for an OS-appropriate stand-in command (D-08) — **Plan 01 Task 3**
- [ ] `.github/workflows/build.yml` — the 2-OS matrix (D-01) — **Plan 03 Task 1** (Wave 2; covers SC1 + drives SC3 on Windows)

**Sampling continuity check:** No 3 consecutive tasks lack an automated verify — 08-01 T1/T2/T3 (unit/grep/smoke), 08-02 T1/T2 (unit/unit), 08-03 T1 (static+CI) all carry automated commands; only 08-03 T2 is the (final) human gate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canonical `claude --rc` scenario in the PACKAGED app (SC2) | PKG-01 | CI runners lack `claude`; interactive agent launch needs a human | Build with `npm run make`; open the packaged `.app`; create session Name "Parlour Claude RC" / Icon 🛋️ / Path a real project dir / Command `claude --rc`; confirm it launches interactively |
| Windows `.exe` / installer runs + PTY-in-ASAR (SC1/SC3 on real Windows) | PKG-01 | Dev/test is macOS-only; CI smoke is best-effort | Download the `just-wrapper-windows-latest` CI artifact (or run the installer on the user's Windows machine); confirm a session opens a working shell |
| Windows shell dropdown + per-shell auto-run (D-02/D-03) | PKG-01 | Real-Windows byte semantics cannot be proven on macOS | On the user's Windows machine: confirm PowerShell/CMD/Git Bash/WSL are listed; Git Bash/WSL startup-command auto-runs; CMD/PowerShell auto-runs or shows the degrade notice (no garbled injection) |
| Pre-1809 Windows error dialog (SC4) | PKG-01 | Requires a real/VM Windows build < 17763 | Launch on a pre-1809 Windows; confirm the native error dialog + clean quit (no crash). If unavailable, backed by GREEN os-gate.test.ts logic proof |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (Plan 03 Task 2, on explicit user approval)

**Approval:** pending
