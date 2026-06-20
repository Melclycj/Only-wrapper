---
plan: 12-13
phase: 12
title: Round-3 re-gate (cold-Dock-launch human-verify)
outcome: ran-qualified-fail
nyquist_compliant: false
self_check: passed
date: 2026-06-20
---

# 12-13 — Round-3 Re-Gate — SUMMARY

**Outcome:** the re-gate RAN and produced its verdict — **QUALIFIED FAIL** → round 4. `nyquist_compliant` stays **false**; Phase 12 does NOT ship. (The plan completed its job: run the floor + the blocking human gate + record the verdict. The PHASE is not complete.)

**Self-Check: PASSED** — automated floor green, blocking human-verify executed, verdict recorded verbatim in `12-VERIFICATION.md` (RE-GATE 3 section). No production code changed by this plan.

## Task 1 — automated floor (GREEN, the floor not the proof)
- `tsc --noEmit` 0; `eslint src tests` clean; unit **56 files / 480 tests**; marker-loss regression `(a) one-shot fail · (b) re-send match@48ms · (c) never-ready hard@302ms`; heavy-init regression GREEN; `npm run package` → `out/Just-Wrapper-darwin-arm64/Just-Wrapper.app`, bundled `app.asar` **PACKAGED-CLEAN** (`JW_PROBE_DIAG` / `jw-probe-timeline` absent, re-send bundled).

## Task 2 — BLOCKING cold-Dock-launch human-verify (operator, 2026-06-20)
`sudo purge` → cold Dock launch. Verbatim verdict in `12-VERIFICATION.md`. Summary:
- **GAP-12-B — PASS-core + NEW visual defect.** Cold auto-run WORKS (the marker-LOSS root cause is fixed live — the hardest part). But the re-sent `: __JW_READY_*` markers leaked ×2 to the terminal → **GAP-12-B-2** (scrub all re-sent marker echoes).
- **GAP-12-C — PASS.** Failed spawn surfaces visibly. Operator's live-folder-removed design question **DECIDED: leave it to the shell** (real terminal fidelity; no live cwd watcher). Closed.
- **GAP-12-E — FAIL (redesign).** Operator wants live inline cwd existence detection (red as-you-type + disable Save) → **GAP-12-E-2**; intentional reversal of the "stays 20 keys / no live check" decision, adds a read-only IPC (EXPECTED_API_KEYS 20→21).

## Task 3 — verdict recorded
- `12-VERIFICATION.md` "RE-GATE 3 VERDICT" section appended (verbatim quotes + round-4 scope table). `nyquist_compliant` left false.

## Route
`/gsd-plan-phase 12 --gaps` (round 4 — GAP-12-B-2 marker-echo scrub + GAP-12-E-2 live cwd detection w/ new read-only bridge key; GAP-12-C closed) → execute → **round-4 re-gate** (supersedes 12-13).
