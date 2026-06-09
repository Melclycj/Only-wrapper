---
phase: 07-terminal-search-scrollback-config
plan: 04
subsystem: nyquist-signoff-human-verify
tags: [human-verify, nyquist, smoke, term-10, term-11, gap-surfacing, resume-closeout]
requires:
  - "07-02: SearchBar overlay + SearchAddon (the TERM-10 surface under verification)"
  - "07-03: PreferencesModal + live scrollback fan-out (the TERM-11 surface under verification)"
provides:
  - "tests/smoke/search-bar.smoke.test.ts — best-effort WDIO smoke (find-chord-opens-bar + Esc dismiss) driven via the native before-input-event path"
  - "tests/smoke/helpers/xterm-driver.ts — smoke driver helper for the search-bar spec"
  - "07-HUMAN-UAT.md — the macOS-first manual sign-off record: 9/14 PASS, 5 defects (G1..G5) found"
affects:
  - "07-05 (gap closure): owns the G1..G5 fixes AND the deferred nyquist_compliant flip / TERM-10/TERM-11 completion"
key-files:
  created:
    - "tests/smoke/search-bar.smoke.test.ts"
    - "tests/smoke/helpers/xterm-driver.ts"
    - ".planning/phases/07-terminal-search-scrollback-config/07-HUMAN-UAT.md"
  modified: []
decisions:
  - "PATH DEVIATION (recorded): the smoke spec landed at tests/smoke/search-bar.smoke.test.ts (with tests/smoke/helpers/xterm-driver.ts), NOT the plan-predicted src/renderer/__tests__/search-bar.smoke.test.ts — tests/smoke/ is where the project's WDIO specs actually live. Functionally complete; path differs from the plan's files_modified."
  - "Count/Aa/navigation deferred to manual per the documented WebGL/headless brittleness (07-VALIDATION §Manual-Only) — the smoke scope is bar-opens + Esc-dismiss only."
  - "RESUME CLOSE-OUT: Task 2 (blocking human-verify) EXECUTED on macOS and correctly surfaced 5 search defects (G1..G5) instead of signing off. Per GSD gap-closure protocol the verdict did NOT flip nyquist_compliant; a gap-closure plan (07-05) was created. This SUMMARY closes out 07-04's tracking (safe_resume_gate: commits existed without a SUMMARY); the nyquist flip + TERM-10/TERM-11 completion are owned by 07-05 Task 3."
metrics:
  tasks: 2
  task1_status: complete
  task2_status: executed-surfaced-gaps
  files: 3
  completed: 2026-06-09
  nyquist_flipped_here: false
---

# Phase 7 Plan 04: Nyquist Sign-Off Human-Verify — Close-Out Summary

This is the end-of-phase Nyquist sign-off plan. It ran in two parts: an automated best-effort smoke spec (Task 1, complete) and a **blocking macOS-first human-verify** (Task 2). The human-verify did its job — it caught real defects on the live WebGL canvas that no headless suite could — so rather than flip `nyquist_compliant`, it produced the gap record `07-HUMAN-UAT.md` and a gap-closure plan `07-05`. This SUMMARY is the deliberate close-out of 07-04's tracking; the actual Nyquist flip is now owned by **07-05 Task 3** (the macOS re-verify after the 5 fixes land).

## What Was Done

**Task 1 — best-effort search-bar smoke + full suite green (`34ef2f9`)** — COMPLETE
- Created `tests/smoke/search-bar.smoke.test.ts` (best-effort WDIO spec: drives the find chord via the native `webContents.sendInputEvent` path — NOT `browser.keys`, which does not reach `before-input-event` per the 04-03 finding — and asserts the search-bar overlay opens + Esc dismisses) and the `tests/smoke/helpers/xterm-driver.ts` helper.
- Per 07-VALIDATION §Manual-Only, the brittle WebGL-dependent assertions ("N of M" count, Aa, match navigation/highlight) were intentionally NOT chased in headless; they are owned by the macOS manual checklist.
- **Path note:** the spec landed under `tests/smoke/` (the project's real WDIO spec home), not the plan-predicted `src/renderer/__tests__/` path. Functionally complete; recorded here so traceability is accurate.
- Unit baseline at close-out: **290 passed (36 files)**, GREEN.

**Task 2 — blocking macOS-first human-verify (`192f509`)** — EXECUTED → SURFACED 5 GAPS
- The user ran the 13-item macOS-first checklist against the live app. Result: **9/14 checks PASS, 5 defects found** (3 High, 1 Medium, 1 Low), recorded in `07-HUMAN-UAT.md`.
- **TERM-11 (scrollback) passed entirely** (gear→Preferences, live-apply to open + new sessions, clamp-snap, decrease-trim, restart-persist).
- **TERM-10 (search) defects** — all behavioral (implementation present, misbehaving on the live WebGL canvas), clustered into two root causes:
  - **WebGL render-flush:** G3 (matches don't paint the amber highlight) + G2 (active match doesn't repaint until a manual scroll).
  - **Focus + toggle logic:** G1 (input doesn't auto-focus on open), G5 (terminal doesn't refocus on close), G4 (Aa advances instead of recomputing in place).
- Correct GSD verdict: `nyquist_compliant` was NOT flipped. Root-cause hints were refined after a source read (`be13705`), then gap-closure plan `07-05` was authored (`2e5c1c2`, `950b1df`) targeting exactly G1..G5 as behavioral fixes (no re-implementation, no new bridge key, surface stays at 20).

## Verification

- `npm run test:unit`: **290 passed (36 files)** — GREEN (resume baseline).
- `tests/smoke/search-bar.smoke.test.ts` + helper present and committed (`34ef2f9`).
- `07-HUMAN-UAT.md` present with `nyquist_signed_off: false` and the 5-gap register.
- `07-VALIDATION.md` frontmatter `nyquist_compliant: false` / `wave_0_complete: false` — correctly NOT yet flipped.

## Deviations from Plan

1. **Smoke spec path:** `tests/smoke/` instead of the plan's `src/renderer/__tests__/` — corrected/recorded above (the project keeps WDIO specs in `tests/smoke/`).
2. **Task 2 outcome:** the human-verify surfaced gaps rather than signing off — the designed-for branch of a blocking checkpoint. The Nyquist flip + TERM-10/TERM-11 completion are deferred to **07-05 Task 3** (re-verify after the 5 fixes), exactly mirroring the Phase 6.1 end-of-phase human-verify precedent (verify → gaps → gap-closure plan → re-verify).

## Known Stubs / Open

- `nyquist_compliant` and `wave_0_complete` remain **false** by design. They flip in 07-05 Task 3 after the macOS re-verify of G1..G5 signs off. TERM-10 / TERM-11 remain Pending until then.

## Threat Flags

None. This plan added no production code, no IPC, no bridge key, no dependency — `EXPECTED_API_KEYS` stays 20. The only artifacts are a smoke spec, a smoke helper, and the human-verify record.

## Self-Check: PASSED
- Files: FOUND tests/smoke/search-bar.smoke.test.ts, tests/smoke/helpers/xterm-driver.ts, .planning/phases/07-terminal-search-scrollback-config/07-HUMAN-UAT.md
- Commits: FOUND 34ef2f9 (smoke), 192f509 (human-verify record), be13705 (root-cause refinement), 2e5c1c2 + 950b1df (07-05 gap-closure plan)
- Nyquist: correctly NOT flipped here — deferred to 07-05 Task 3 (recorded)
