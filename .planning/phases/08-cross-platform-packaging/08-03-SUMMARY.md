---
phase: 08-cross-platform-packaging
plan: 03
subsystem: ci-packaging
tags: [github-actions, ci-matrix, cross-platform, unsigned, no-secrets, packaging, human-verify]
status: in-progress
# Dependency graph
requires:
  - phase: 08-cross-platform-packaging
    plan: 01
    provides: "npm run make produces the macOS .app; OS-conditional wdio appBinaryPath; packaged PTY smoke (SC1mac/SC3)"
  - phase: 08-cross-platform-packaging
    plan: 02
    provides: "WindowsShellProvider enumeration + WindowsReadinessProbe.forShell() (the Windows leg exercises these)"
provides:
  - ".github/workflows/build.yml — 2-OS GitHub Actions matrix (windows-latest + macos-latest), npm ci -> make -> test:smoke -> upload-artifact, zero secrets, unsigned (D-01/D-04)"
  - "docs/PACKAGING.md Continuous Integration section — how the Windows artifact is produced/downloaded; no-secrets/unsigned posture"
affects: [windows-human-verify, phase-08-gate]
# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fail-fast:false 2-OS matrix so a Windows-only flake does not kill the macOS leg"
    - "Layered gate policy in CI: make = hard gate, test:smoke = strong-preferred (best-effort on headless flake), canonical claude --rc human-verify = binding SC2 gate"
key-files:
  created:
    - ".github/workflows/build.yml"
  modified:
    - "docs/PACKAGING.md"
key-decisions:
  - "make stays a HARD gate (no continue-on-error); test:smoke ships as a real gate first — relax to best-effort ONLY on observed CI headless flake, noted here"
  - "ZERO secrets referenced; unsigned build (maker-squirrel unsigned by default, osxSign/osxNotarize env-gated off) — D-04 lock; negative grep enforces"
  - "NO mandatory native rebuild step in the workflow — the postinstall (fix-node-pty.cjs) does the opportunistic non-fatal rebuild during npm ci (D-06)"
requirements-completed: []
metrics:
  duration: "~10min (Task 1 only; Task 2 awaiting human-verify)"
  completed: "2026-06-10 (Task 1)"
  tasks: "1 of 2 (Task 2 = blocking human-verify, awaiting user approval)"
  files: 2
---

# Phase 8 Plan 03: CI Matrix + Canonical Human-Verify Summary

**Stood up the 2-OS GitHub Actions build matrix that is the canonical producer + verifier of the cross-platform distributables (windows-latest + macos-latest, `npm ci` -> `npm run make` -> `npm run test:smoke` -> upload `out/make`, zero secrets, unsigned). Task 2 — the blocking canonical `claude --rc` packaged human-verify (SC2) + live pre-1809 dialog (SC4) — is AWAITING explicit user approval; `nyquist_compliant` has NOT been flipped.**

## Status

| Task | Type | State |
|------|------|-------|
| 1 — GitHub Actions 2-OS build matrix (D-01 / SC1 both OSes) | auto | ✅ DONE — committed `b85b434`, YAML valid, all acceptance criteria pass |
| 2 — Canonical `claude --rc` packaged human-verify + Nyquist sign-off (SC2 / SC4 live) | checkpoint:human-verify (blocking-human) | ⏸ AWAITING USER APPROVAL — no code to write; `nyquist_compliant` NOT flipped |

## Task 1 — CI Matrix (D-01 / SC1 / drives SC3 on Windows)

Created `.github/workflows/build.yml` from RESEARCH Pattern 4:

- `on: [push, pull_request]`; one job `make` with `strategy.fail-fast: false` and `matrix.os: [windows-latest, macos-latest]`; `runs-on: ${{ matrix.os }}`.
- Steps: `actions/checkout@v4`, `actions/setup-node@v4` (node-version 20, cache npm), `npm ci` (postinstall `fix-node-pty.cjs` runs the opportunistic online rebuild + spawn-helper chmod — D-06), `npm run make`, `npm run test:smoke`, `actions/upload-artifact@v4` (name `just-wrapper-${{ matrix.os }}`, path `out/make/**`).
- **Gate policy encoded as a YAML comment:** `make` = HARD gate (no `continue-on-error`); `test:smoke` = STRONG-PREFERRED (best-effort only on observed headless flake); canonical `claude --rc` human-verify = the binding SC2 gate (CI runners lack `claude`).
- **Zero secrets, unsigned (D-04):** no `secrets.*` reference; maker-squirrel unsigned by default; no Windows signing config; osxSign/osxNotarize env-gated off.
- **No mandatory native rebuild (D-06):** no standalone native-rebuild step — the postinstall handles it opportunistically and non-fatally.

Appended a **Continuous Integration** section to `docs/PACKAGING.md`: the matrix builds both OSes on every push/PR; the canonical Windows `.exe`/`Setup.exe` is downloaded from the `just-wrapper-windows-latest` run artifact; the matrix needs no secrets (unsigned this phase; signing is the later env-gated flip).

### Verification Evidence (Task 1)

- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build.yml'))"` → exit 0 (valid YAML).
- Full plan automated verify → **ALL VERIFY PASS**:
  - present: `windows-latest`, `macos-latest`, `npm run make`, `npm run test:smoke`, `upload-artifact`, `fail-fast: false`, `windows-latest` in `docs/PACKAGING.md`.
  - negative greps PASS: NO `secrets.`, NO `electron-rebuild`, NO `windowsSign` anywhere in the workflow.
- `make` step has no `continue-on-error` (hard gate intact); `test:smoke` ships as a real gate (NOT relaxed — no observed flake yet, since CI has not been triggered from this executor).

## Deviations from Plan

**[Rule 3 — Blocking issue] Reworded two explanatory YAML comments to satisfy the acceptance negative-greps.** The initial workflow header comments used the literal tokens `windowsSign` and `electron-rebuild` while *prohibiting* them ("no `windowsSign` configured", "do NOT add an electron-rebuild step"). The plan's acceptance criteria enforce `! grep -qiE "electron-rebuild|windowsSign"` over the whole file, so the documentation phrasing tripped the negative grep. Reworded to "no Windows signing config" and "do NOT add a standalone native rebuild step here" — same intent, the negative greps now pass. No behavioral change to the workflow.

## Awaiting Human-Verify (Task 2)

Task 2 is a **blocking** `checkpoint:human-verify` (`gate="blocking-human"`). Per the auto-mode rules, blocking-human gates are NOT auto-approved. The executor STOPPED and returned the checkpoint to the orchestrator. On explicit user `approved`:
- `nyquist_compliant: true` is set in `08-VALIDATION.md` frontmatter,
- the per-task map Status column + Validation Sign-Off checkboxes are filled,
- this SUMMARY records which SC items were live-confirmed vs Windows-best-effort vs logic-proven.

Until then: `nyquist_compliant` stays `false`; the phase is NOT verified; PKG-01 is NOT marked complete.

## Known Stubs

None.

## Threat Flags

None. The workflow introduces no new network endpoint, auth path, or trust-boundary surface beyond the 08-03-PLAN `<threat_model>` register (T-08-09 zero-secrets, T-08-10 unsigned-squirrel, T-08-11 bounded matrix cost, all honored).

## Self-Check: PASSED

- FOUND: .github/workflows/build.yml
- FOUND: docs/PACKAGING.md (Continuous Integration section)
- FOUND commit: b85b434 (Task 1)

---
*Phase: 08-cross-platform-packaging · Task 1 complete 2026-06-10 · Task 2 awaiting human-verify*
