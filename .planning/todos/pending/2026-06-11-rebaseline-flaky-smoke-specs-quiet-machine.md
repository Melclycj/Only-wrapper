---
created: 2026-06-11T01:55:00.000Z
title: Re-baseline 4 flaky smoke specs on a quiet machine before v1.1 ship
area: testing
files:
  - tests/smoke/header-controls.smoke.test.ts
  - tests/smoke/keyboard-switch.smoke.test.ts
  - tests/smoke/persistence.smoke.test.ts
  - tests/smoke/startup-command.smoke.test.ts
---

## Problem

During Phase 09's regression gate, the smoke suite (run with the new
`JW_USER_DATA_DIR` isolation seam, on a machine concurrently running a dev
instance with live PTY sessions) failed 4/15 spec files with timing-class
timeouts:

| Spec file | Failing assertion |
|-----------|-------------------|
| header-controls | Restart echo `PRERESTART_*` not in buffer within 10s |
| keyboard-switch | Cmd/Ctrl+2 did not switch to 2nd row |
| persistence | configured/RECIPE session not in store file (2 tests) |
| startup-command | bare-shell prompt `%` not in buffer within 8s |

## Diagnosis (operator accepted "record and continue", 2026-06-11)

Classified **environmental flake, NOT a Phase 9 regression**:
1. Phase 9 production changes are CSS/fonts only — structurally incapable of
   affecting PTY echo / store writes / key chords. The one main-process change
   (userData seam, src/main/index.ts) is env-gated: with `JW_USER_DATA_DIR`
   unset (CI / normal runs) the code path is byte-identical to pre-Phase-9.
2. Zero smoke assertions couple to colors/fonts (grep-verified).
3. Failure sets drifted across 3 runs (4 → 6 → 4 files, different members;
   run 2's extras were caused by leftover store state in the reused
   `.userdata-smoke` dir — wipe the dir between runs, or add an onPrepare
   wipe if smoke adopts the seam permanently).

Unit suite 326/326 GREEN throughout; 11/15 smoke files GREEN.

## Required before v1.1 ship

1. Quit any dev instance (`npm start`), quiet the machine.
2. `rm -rf artifacts/ui-lab/.userdata-smoke` then run BOTH:
   - `npm run test:smoke` (normal mode — the CI-equivalent baseline)
   - `JW_USER_DATA_DIR="$PWD/artifacts/ui-lab/.userdata-smoke" npm run test:smoke`
3. All 15 GREEN in normal mode → close this todo. Any persistent failure in
   normal mode → it is real; route to /gsd-debug.
4. If the seam mode stays flaky on a quiet machine, consider bumping the 4
   specs' wait budgets (8-10s → 15s) for cold-profile boots, or adding a
   per-run userdata wipe to wdio.conf.ts when the env var is set.
