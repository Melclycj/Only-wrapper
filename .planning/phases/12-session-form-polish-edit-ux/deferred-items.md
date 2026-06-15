# Phase 12 — Deferred Items (out-of-scope discoveries)

## pty-resize.smoke fails (pre-existing, out of scope for 12-03)

- **Discovered during:** 12-03 Task 2 (full-smoke gate run, 2026-06-15)
- **Spec:** `tests/smoke/pty-resize.smoke.test.ts` (`tput cols` resize round-trip; SC3 terminal fidelity)
- **Symptom:** fails ISOLATED on macOS dev box (not a parallel-load flake).
- **Proof it is pre-existing / NOT introduced by 12-03:** the spec is byte-identical to the
  pre-plan HEAD; 12-03 changed ONLY test files + `tests/ui-lab/surfaces.ts` (zero `src/` diff).
  Running the spec against the pristine pre-plan 12-02 commit `1335853` reproduces the SAME
  failure. So the resize round-trip was already RED before this plan.
- **Why not fixed here:** out of scope (PTY/xterm/resize fidelity — Phase 2 / Phase 15 domain).
  Scope-boundary rule: 12-03 is test-extension + visual-gate only; it must not auto-fix an
  unrelated pre-existing terminal-fidelity failure.
- **Route:** capture for a terminal-fidelity / Windows-verification phase (15) or a `--gaps`
  follow-up. The plan-relevant smokes (session-edit incl. SESS-05 round-trip, startup-command,
  boot/security, the 13 other specs) are GREEN.
