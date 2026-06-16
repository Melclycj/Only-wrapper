# Spike 005 — GAP-12-B restart-to-apply readiness-probe timeout (DIAGNOSIS)

Diagnose-only spike for `.planning/debug/gap-12-b-restart-probe-timeout.md`.
Reproduces the LIVE readiness-probe timeout the passing wdio smoke (DEBT-02) masks,
and confirms/denies the GAP-12-C secondary.

## What it proves

The READINESS_FAIL_NOTICE on Restart-to-apply is a **latency-budget defect**, not a
restart-specific code bug. The TERM-05 probe writes its marker (`: <nonce>\r`) at spawn
time, before the login shell's rc finishes initializing. The match (`\n…<nonce>` on a
PRODUCED line) cannot fire until the shell completes rc init and re-prompts — so the
match time ≈ rc-init time. `READINESS_TIMEOUT_MS` is a fixed 4000ms with no headroom.
When rc init exceeds 4000ms the probe times out and the startup command is never injected.

The "dormant Start works / restart fails" observation is NOT a code divergence: `create()`
is the single funnel for both paths, and the drivers show restart and dormant Start cross
the 4000ms wall **together** at the same init latency.

## Drivers (plain-node node-pty + ported buildPosixProbe — no Electron)

- `drive-restart-probe.cjs` — A dormant-Start control, B restart respawn, C delayed-marker
  restart, plus B×4 repeats. Result: ALL match; B (restart) matches ~1041ms 4/4 (faster than
  dormant 1469ms). Eliminates "restart is intrinsically slower / 4000ms too tight for restart".
- `drive-restart-probe-2.cjs` — F respawn INSIDE the dying child's onExit (verbatim restart(),
  3/3 ~1064ms, no penalty); E heavy-init threshold via a temp ZDOTDIR `.zshrc` that sleeps N
  seconds: sleep3 BOTH match ~3050ms, **sleep4 + sleep5 BOTH dormant AND restart TIMEOUT at
  4000ms**. Proves the wall is shell-init-latency-bound, identical for both paths.
- `capture-restart-probe*.jsonl` — forensic byte/timing logs (probe nonce only, no secrets).

Run: `node .planning/spikes/005-restart-probe-timeout/drive-restart-probe.cjs`
     `node .planning/spikes/005-restart-probe-timeout/drive-restart-probe-2.cjs`

The heavy-init (ZDOTDIR-sleep) scenario in driver 2 is the DETERMINISTIC repro the DEBT-02
fix-plan test should fold in (it makes the timeout fire on demand without needing a slow host).

## Round 3 (2026-06-16) — OPERATOR instrument (measure, don't guess a 3rd budget)

`operator-probe-timeline.cjs` — a SELF-CONTAINED diagnostic the OPERATOR runs ONCE on
their real machine. The round-1 (4000ms) and round-2 (8000ms-idle / 15000ms-hard) budgets
BOTH failed live because the operator's real rc-init timeline was never measured. This
instrument ports `buildPosixProbe` VERBATIM and mirrors the SHIPPED dual-deadline EXACTLY
(`READINESS_IDLE_TIMEOUT_MS=8000` reset-on-byte + `READINESS_HARD_TIMEOUT_MS=15000`
absolute), then logs with ms timestamps: every probe-byte arrival (size + head/tail peek,
no secrets), the `\n…<nonce>` match OR which deadline trips (idle vs hard) + why, the
longest SILENT gap between output bytes, and a bare first-prompt control. It runs against
the operator's real `zsh -l` + actual rc, in the cwd they pass (per-dir init matters),
3 runs to show jitter. Output: a pasteable human summary + `operator-timeline.jsonl`.

Run (from the repo root, pointing at the cwd that failed):

    node .planning/spikes/005-restart-probe-timeout/operator-probe-timeline.cjs "/the/cwd/you/edited/into"

Validated on the dev box across all three outcomes before hand-off: MATCH (~1031-1427ms
fast rc), IDLE-TIMEOUT (a silent >8s rc gap → "reset-on-byte is the wrong signal"), and
HARD-TIMEOUT (chatty-but-never-ready rc, total >15s → "raise the ceiling"). Whichever the
operator hits, the summary disambiguates the three round-3 hypotheses. The budget/mechanism
is tuned to their MEASURED numbers (NOT another synthetic guess) and folded into the DEBT-02
regression only after their timeline is in hand.

## GAP-12-C diagnosis tests (kept as .txt — outside the vitest glob)

- `gap-12-c-bad-cwd-restart.diag.test.ts.txt` (main; 3 pass when run as a .test.ts): updateProfile
  REJECTS a non-existent cwd (keeps prior); restart-to-apply after a bad-cwd edit SUCCEEDS pid>0
  with the prior cwd (NO pid -1 / NO error notice); pid -1 + notice only for an already-bad
  (deleted-dir/corrupt) record.cwd reaching create().
- `gap-12-c-surface.diag.test.ts.txt` (renderer; 2 pass): on a LIVE row, an error event carrying
  a notice is treated as informational by applyStatusEvent (status stays 'running', no IdleCard)
  → the deleted-dir rejection is SWALLOWED; a bare error WITHOUT a notice flips an identity row
  to the Inactive List.

To re-run, copy a `.txt` back to its `src/**/__tests__/` path (drop the `.txt`) and
`npx vitest run <path>`. They are diagnosis artifacts; the fix plan authors the real
regression tests.

## Verdict (full report in the debug session file)

- **GAP-12-B root cause:** fixed/insufficient `READINESS_TIMEOUT_MS` (4000ms) vs login-shell
  rc-init latency — no headroom / no extend-on-progress / no retry. Fix DIRECTION: raise the
  budget (smoke already tolerates 8000ms) AND extend-the-deadline-on-probe-progress; preserve
  D-02 invisibility + D-04 never-inject-on-timeout.
- **GAP-12-C:** the literal "edit bad cwd → restart → pid -1 + notice" is NOT reachable
  (updateProfile rejects the bad cwd first; restart succeeds with the prior cwd). The residual
  risk is a deleted-after-persist record.cwd: there main DOES return pid -1 + the notice, but
  the renderer SWALLOWS it (the ITEM-4 notice guard keeps status 'running'; handleRestart has
  no pid<=0 branch), leaving a stale-running row on a dead PTY with an unsurfaced errorMessage.
