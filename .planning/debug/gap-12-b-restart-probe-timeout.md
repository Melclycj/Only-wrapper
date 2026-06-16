---
slug: gap-12-b-restart-probe-timeout
status: awaiting_human_verify
trigger: "Phase 12 GAP-12-B — 'Restart to apply?' (Restart now) fails LIVE: the new startup command does not auto-run; the session prints 'Startup command didn't auto-run — shell wasn't ready in time.' (READINESS_FAIL_NOTICE). Operator changed cwd to a REAL existing dir, so this is the TERM-05 readiness probe timing out on the in-place restart respawn, NOT a CR-01 cwd rejection. ROUND 3 (reopened): the round-2 fix (12-08 dual-deadline 8s idle / 15s ceiling + 12-09 handleRestart else) STILL fails on the operator's real machine — both gaps reopened at the round-2 re-gate."
created: 2026-06-16
updated: 2026-06-16
goal: find_and_fix
phase: 12
round: 3
gaps: ["GAP-12-B (primary — instrument the operator's real machine)", "GAP-12-C (now ACTIVE — handleStart path unfixed)"]
---

# Debug — GAP-12-B restart-to-apply readiness-probe timeout

## Symptoms (prefilled from operator human-verify 2026-06-16)

1. **Expected:** After editing a RUNNING session's Startup command + Working directory and clicking Save changes → "Restart to apply?" → "Restart now", the session respawns in place (same logicalId, new ptyPid) and the new startup command auto-runs (its output appears).
2. **Actual:** The session prints `Startup command didn't auto-run — shell wasn't ready in time.` (READINESS_FAIL_NOTICE) and the new command never runs.
3. **Error message:** `Startup command didn't auto-run — shell wasn't ready in time.` (pty-manager.ts `READINESS_FAIL_NOTICE`, the D-04 readiness-timeout fallback).
4. **Timeline:** Surfaced at the Phase 12 re-gate (12-07) human-verify, 2026-06-16. GAP-12-B (the Restart-to-apply prompt) was newly added in 12-06.
5. **Reproduction:** Live packaged app. Add a session → let it run → Edit → set Startup command (e.g. `echo HELLO-RESTART`) AND set Working directory to a real existing dir → Save changes → "Restart to apply?" → Restart now. The notice appears; the command does not run.

## Current Focus

ROUND 3. GAP-12-C FIXED (renderer handlers — resolveSpawnResult reducer; both Start + Restart paths surface a failed spawn; regression-tested; suite GREEN). GAP-12-B operator instrument BUILT + validated (all 3 outcomes) — HUMAN-ACTION checkpoint: the operator runs it on their machine and pastes the real probe timeline back; only then is the budget/mechanism tuned to their measured reality. NO budget number changed this cycle. (Round-1/2 root cause + evidence below remain valid.)

reasoning_checkpoint:
  hypothesis: "The READINESS_FAIL_NOTICE on Restart-now is the D-04 readiness-probe timeout firing because the login-shell rc init latency exceeded the FIXED 4000ms READINESS_TIMEOUT_MS budget. The probe match time ≈ rc-init time (the queued ':' marker only matches once the shell finishes rc and re-prompts onto a produced `\\n…<nonce>` line). It is NOT restart-specific; restart and dormant Start cross the same 4000ms wall at the same init latency."
  confirming_evidence:
    - "Driver 1: bare restart respawn matched 4/4 at ~1041ms; dormant matched at 1469ms — restart is NOT slower."
    - "Driver 2 F: respawn inside the old child's onExit (verbatim restart()) matched 3/3 at ~1064ms — no restart-specific penalty."
    - "Driver 2 E: heavy-init sleep4 → BOTH dormant AND restart timed out at 4000ms; sleep3 → both matched ~3050ms. The 4000ms wall is shell-init-latency-bound, identical for both paths."
    - "Byte timeline: marker written t=1ms (before rc done), echoed raw (no match), then DEAD until rc completes (~2.5s), then re-prompt re-echoes ':' onto a produced `\\n…<nonce>` line → match. Match time = rc-init time."
    - "05.1-VALIDATION L100 + RESEARCH A5: 4000ms was an ASSUMED, dev-machine-only budget, explicitly flagged 'tune from measured cold-spawn latency'."
  falsification_test: "If a bare restart respawn timed out while a dormant Start matched at the SAME machine/load, the cause would be restart-specific. It did NOT — both match fast in isolation and both fail together under heavy init. Falsification attempted and not observed."
  fix_rationale: "(direction only) The root cause is an insufficient/fixed latency budget with no headroom or adaptation, NOT a logic bug. Fix targets the budget mechanism (raise/adapt the timeout, or extend-on-progress, or make the bound robust to slow login-shell rc) — addresses the actual wall, not a symptom."
  blind_spots: "Could not measure the OPERATOR'S real rc-init latency (no access to their machine). The dev box rc is fast (~1s); the heavy-init repro (sleep N) MODELS a slow machine deterministically but is synthetic. The exact operator-side init weight (nvm/rvm/oh-my-zsh/p10k/direnv/conda-per-dir) is inferred, not measured."

- **next_action:** ROUND 3 (see "## Round 3" below). (B) Build an OPERATOR-RUN instrument that captures their real machine's probe byte-timeline + where the 8s-idle/15s-hard deadline fires — do NOT guess the budget a third time. (C) Reproduce the dormant→Start (handleStart) bad-cwd failure locally and fix the missing pid<=0 surface on BOTH Start and Restart.

## Confirmed facts

- The cwd in the failing run was a REAL existing directory → NOT a CR-01 cwd rejection; the failure is purely the readiness-probe timeout on restart.
- The SAME `create()`+probe path WORKS on a dormant Start ▶ (Phase 05.1 human-verify, Phase 08, and `tests/smoke/startup-command.smoke.test.ts` dormant-Start specs GREEN).
- **DEBT-02 caveat:** `tests/smoke/session-edit.smoke.test.ts` "applies a changed startup command via Restart to apply (GAP-12-B)" PASSES — the probe matches in the fast wdio env, so automated green does NOT reproduce this live timeout. Reproduce the LIVE timing; do not trust the green smoke. Precedent: `.planning/spikes/003-live-amber-repro` used a node-pty + @xterm/headless autonomous driver to reproduce a live timing bug — a similar driver likely reproduces the restart probe timing (and a dormant-Start control for comparison).

## Code path

- `src/renderer/SessionManager.tsx` `handleRestart` (~209) → `window.api.ptyRestart(id)` → onRestartNow (~333).
- `src/main/pty-manager.ts` `restart()` → `stop()` → await exit → `create()`.
- `create()` probe block (~405–473): empty cmd → skip probe + normal forwarding; non-empty cmd → `selectReadinessProbe(process.platform).forShell(record.shell)`, write `probe.marker`, wait ≤ `READINESS_TIMEOUT_MS` (4000ms, ~89) for `probe.matches(buffer)`; on timeout → flush buffered bytes + emit `READINESS_FAIL_NOTICE` (~97), command NOT injected (D-04). On match → dispose interceptor, inject `cmd + '\r'`.
- `src/main/readiness-probe.ts` `buildPosixProbe`: matches only when the nonce appears AFTER a newline boundary (`\n[^\n]*<nonce>`), scan bounded to the last ~8KB tail.

## Hypotheses to test (reproduce, don't assume)

- (a) Race: `restart()` does stop→SIGTERM→await-exit→create(); residual bytes from the dying old shell contaminate the new probe buffer, OR the new shell isn't reading its input yet when `probe.marker` is written, so the nonce never echoes after a newline.
- (b) Restart-specific output ordering makes the `\n…<nonce>` match never land (vs a clean cold spawn).
- (c) 4000ms is too tight for a restart respawn on a real shell (heavier re-init).
- (d) `restart()` reuses listener/buffer/PtySession state the dormant `create({id})` Start path does not (stale onData listener, un-reset buffer, double-attached interceptor).

## Secondary — GAP-12-C (confirm or deny, then leave for the fix plan)

Reproduce a restart-to-apply where cwd is set to a NON-EXISTENT path. `create()` should return pid -1 + a "Working directory not found" notice. `handleRestart` (SessionManager.tsx:209) only flips to running on pid>0 and has NO else on pid<=0, relying on `onPtyStatus` 'error'+notice → IdleCard — but the session was LIVE (SessionView mounted, no IdleCard). Determine: (1) does the rejection actually surface visibly on a live→failed-restart session, or is it swallowed? (2) does `updateProfile` persist the bad cwd? Report a verdict; do not fix here.

## Constraints

- Branch `gsd/phase-03-multi-session-session-lifecycle` (shared dev). Do NOT flip `nyquist_compliant`.
- DEBT-02-governed lifecycle code: any eventual fix needs a test that exercises the REAL failure timing + a mandatory human re-verify. This session is **diagnose-only** — produce a confirmed Root Cause Report; the fix is planned separately (`/gsd-plan-phase 12 --gaps`).
- Core Value: do not regress terminal fidelity / the working dormant-Start auto-run.

## Evidence

- timestamp: 2026-06-16 (code read)
  checked: src/main/pty-manager.ts create() probe block (419-512), restart() (788-828), wireNormalOnData (638-642).
  found: restart() does stop(id) (SIGTERM→SIGKILL grace) → on the OLD pty's onExit (guarded respawned-once) → create({cwd, id, name, order}). create() funnels EVERY spawn (new / restart-respawn / dormant-Start) through the SAME probe block. The probe: child.onData buffers bytes (never forwarded), writes probe.marker (`: <nonce>\r`), arms a 4000ms timer; on probe.matches(buffer) it injects cmd+'\r'; on timeout it flushes buffer + emits READINESS_FAIL_NOTICE and does NOT inject. So the code path is byte-identical between restart respawn and dormant Start — the divergence must be TIMING/IO-state, not branch logic.
  implication: A purely logical difference is ruled out by construction (one create() for all). The probe-timeout-on-restart must come from the runtime environment of the respawn (the dying old shell, the just-killed pty fd, or shell re-init latency) — must be reproduced live, not read.

- timestamp: 2026-06-16 (code read)
  checked: readiness-probe.ts buildPosixProbe — re = /\n[^\n]*<nonce>/, scan bounded to last 8KB tail. marker = `: <nonce>\r`.
  found: Match requires the nonce to appear AFTER a newline (a PRODUCED line, not the bare echo of the typed marker which is the first line with no preceding \n). On a normal cold zsh, the marker is echoed, then the no-op ':' completes and zsh RE-PROMPTS on a fresh line → the re-prompt line is preceded by \n → match fires. The match therefore depends on the shell ECHOING input (so the marker's own echo appears) AND re-prompting after the ':' line.
  implication: If on a restart respawn the shell is NOT yet in a state where it echoes the written marker (echo off / line discipline not ready / input consumed before the shell's read loop starts), the marker round-trip never produces a `\n…<nonce>` line, so matches() never fires and the 4000ms timer expires → READINESS_FAIL_NOTICE. This is hypothesis (a)'s "new shell isn't reading input yet when probe.marker is written" — testable by capturing the raw probe buffer on a restart respawn vs a dormant Start control.

- timestamp: 2026-06-16 (env check)
  checked: node_modules/node-pty (v1.1.0) loads in plain node; @xterm/headless 5.5.0 present; $SHELL=/bin/zsh.
  found: An autonomous node-pty driver (the spike-003 precedent) CAN reproduce the live restart timing in plain node — no Electron needed. The probe + restart logic is electron-free enough to port the exact create()/restart() sequence into a standalone driver.
  implication: Build a driver that (1) spawns zsh, (2) does a stop→await-exit→respawn (restart), writes the SAME `: <nonce>\r` marker, and measures whether `\n…<nonce>` appears within 4000ms; (3) compares against a clean dormant create() control. This reproduces the LIVE timing the green wdio smoke masks (DEBT-02).

- timestamp: 2026-06-16 (autonomous driver — spike 005, driver 1: .planning/spikes/005-restart-probe-timeout/drive-restart-probe.cjs)
  checked: Ported buildPosixProbe + create()-probe + restart() (stop SIGTERM→await exit→respawn) VERBATIM into a plain-node node-pty driver on /bin/zsh -l. Ran A_dormant_start, B_restart_respawn, C_restart_delayed_marker, plus B x4 repeats.
  found: ALL matched. A_dormant matched at 1469ms; B_restart matched at 1041ms; C matched at 1048ms; B repeats 4/4 matched. A bare-shell restart respawn does NOT time out and is actually FASTER than (or equal to) a dormant Start. The nonce appears as a `\n…<nonce>` produced line in every case.
  implication: ELIMINATES hypotheses (b) restart-specific output ordering, (c) "4000ms too tight for a restart respawn" (a bare respawn matches in ~1s), and the in-process form of (a)/(d) (residual bytes / reused listener / un-reset buffer — the driver uses a fresh probe per spawn and still matches). The restart respawn is NOT intrinsically slower than a dormant Start. The live timeout must come from SHELL-INIT LATENCY exceeding 4000ms, not from anything restart-specific in the code.

- timestamp: 2026-06-16 (dev-box shell-init measurement)
  checked: Plain `/bin/zsh -l` cold first-prompt latency on this machine; ~/.zshrc has 9 conda references.
  found: First prompt at ~1257ms (conda init dominates). Driver matches landed ~1041-1469ms — i.e. the match time TRACKS the shell's first-prompt latency almost exactly.
  implication: The probe match fires only once the shell finishes its rc init and RE-PROMPTS (so the queued `:` line is re-echoed onto a produced `\n…<nonce>` line). Match time ≈ rc-init time. A heavier operator rc (more conda envs / nvm / rvm / oh-my-zsh / powerlevel10k instant-prompt off / network-touching init) pushes first-prompt past 4000ms → TIMEOUT → READINESS_FAIL_NOTICE.

- timestamp: 2026-06-16 (autonomous driver — spike 005, driver 2: drive-restart-probe-2.cjs + inline timeline capture)
  checked: (F) restart() VERBATIM with respawn INSIDE the dying old child's onExit closure (3 runs). (E) heavy-init threshold via a temp ZDOTDIR .zshrc that `sleep`s N seconds, comparing E_dormant_sleepN vs E_restart_sleepN at N=3,4,5. Plus a full byte-timeline of an immediate-marker-write heavy-init spawn.
  found:
    - F_restart_verbatim matched 3/3 at ~1064ms — respawning inside onExit adds NO penalty; equal to dormant.
    - E_dormant_sleep3 matched at 3037ms; E_restart_sleep3 matched at 3053ms (≈equal). E_dormant_sleep4 AND E_restart_sleep4 BOTH timed out at 4000ms. E_restart_sleep5 + E_dormant_sleep5 BOTH timed out. The restart and dormant paths cross the 4000ms wall TOGETHER — the threshold is shell-init latency, NOT restart-specific.
    - TIMELINE (sleep 2.5s rc): marker written at t=1ms → echoed raw as ": <nonce>\r\n" (match=false, no preceding \n) → DEAD SILENCE 1ms..2539ms while rc `sleep` runs → at 2539ms the prompt paints → at 2547ms zle re-processes the queued ':' line and re-echoes it onto a produced `\n…<nonce>` line → match=true. The match time is DOMINATED by rc-init latency; the marker is written before the shell can process it and only matches once the rc completes and the shell re-prompts.
  implication: CONFIRMED ROOT CAUSE. The readiness probe writes its marker at spawn time (t≈0) BEFORE the login shell's rc has finished initializing. The `\n…<nonce>` match cannot fire until the shell completes rc init and re-prompts (re-echoing the queued ':' line onto a produced line). On a machine/shell whose login-shell rc init exceeds READINESS_TIMEOUT_MS (4000ms), the probe times out and emits READINESS_FAIL_NOTICE — the startup command is never injected. This is a LATENCY-BUDGET defect, not a restart-vs-dormant code divergence: driver 2 proves restart and dormant cross the 4000ms wall at the SAME init latency.

- timestamp: 2026-06-16 (Phase 05.1 design-doc audit + latency-variance measurement)
  checked: 05.1-VALIDATION.md L100 + 05.1-RESEARCH.md A5/Open-Q2 (the origin of READINESS_TIMEOUT_MS=4000); plus a variance run (8 cold spawns each in HOME and REPO cwd).
  found:
    - The 4000ms budget was chosen as "~4s default, measure and tune from cold-spawn latency" and signed off as "comfortably above observed cold-spawn latency ON THE DEV MACHINE; no tuning needed" (A5 explicitly: "If too short, false-negatives skip valid injects; tune from measured cold-spawn latency"). It is a documented, ASSUMED, machine-dependent budget — never tuned against a heavier real machine.
    - On THIS dev box match-latency is tight: HOME [1022..1440]ms, REPO [1009..1039]ms (conda init dominates). cwd has negligible effect here. So on this machine the budget holds — which is exactly why the green wdio smoke (fast CI-like env) and prior dormant-Start human-verifies passed.
  implication: RESOLVES THE PARADOX. "Dormant Start works but restart fails" is NOT a code divergence (driver F + E prove the paths are byte-identical and cross the 4000ms wall together). It is the single-instance manifestation of a machine/load/warmth-dependent latency budget: the dormant Start the operator ran earlier hit a WARM, fast rc init (under 4000ms); the later restart respawn hit a rc init that exceeded 4000ms (cold caches after the edit flow, heavier operator rc, machine busier, and/or the cwd change touching a slower init path). The probe is correct; the 4000ms wall is too tight for a slow/cold login-shell rc and has no headroom, retry, or adaptive extension. The READINESS_FAIL_NOTICE is the designed D-04 fallback firing because the budget was exceeded.

- timestamp: 2026-06-16 (GAP-12-C — code trace + diagnosis tests)
  checked: pty-manager.ts updateProfile (CR-01 isValidCwd guard, 950) + restart() (reads record.cwd) + create() (pre-validate cwd, 305-313); existing GREEN pty-update-profile.test.ts L368 ("rejects a NON-EXISTENT absolute cwd, keeping the prior value"); SessionManager.handleRestart (209, pid>0-only flip, no else); apply-status-event.ts (notice branch 61-66) + session-status.ts resolveRowStatus. Wrote two diagnosis tests: src/main/__tests__/gap-12-c-bad-cwd-restart.diag.test.ts (3 pass) + src/renderer/__tests__/gap-12-c-surface.diag.test.ts (2 pass).
  found:
    - PREMISE PARTIALLY FALSE: a non-existent cwd is REJECTED at updateProfile (CR-01 isValidCwd → keeps the prior valid cwd, never persisted). So restart()→create() spawns with the PRIOR valid cwd and returns pid > 0 — the GAP-12-C premise (create() pid -1 + 'Working directory not found' on a live restart) does NOT occur in the normal edit→restart flow. Diagnosis test 2 confirms pid>0, spawn cwd = prior, NO error notice broadcast.
    - updateProfile does NOT persist the bad cwd (diagnosis test 1: after.cwd === priorCwd, !== BAD_CWD). The startupCommand (valid) DOES persist.
    - The ONLY way to reach the pid -1 + notice premise is a record whose cwd was ALREADY valid-at-persist but later DELETED (or a corrupt store) reaching create() — diagnosis test 3 confirms create({cwd: bad}) returns pid -1 + the 'Working directory not found' notice (containing the bad path).
    - IF that edge case occurs on a LIVE→failed restart: the rejection is SWALLOWED. create() broadcasts {status:'error', notice:'Working directory not found…'} on onPtyStatus. applyStatusEvent's ITEM-4 guard treats ANY event carrying a `notice` as INFORMATIONAL — it sets row.errorMessage but does NOT change status (surface test asserts next.status stays 'running', activeIsCard=false → NO IdleCard). handleRestart's pid>0 guard also does not flip. Net: the row stays 'running' with a now-dead pid (create returned pid -1, no live pty), the SessionView stays mounted bound to a dead PTY, the badge stays green, and the captured errorMessage has NO visible surface unless the user reopens the edit modal. (Contrast: a bare 'error' WITHOUT a notice DOES flip an identity row to not_started/Inactive — surface test 2.)
  implication: GAP-12-C VERDICT — (1) In the normal edit→restart flow the bad cwd is rejected at persist and the restart succeeds with the prior cwd; updateProfile does NOT persist the bad cwd. So GAP-12-C as literally described (live restart → pid -1 + notice) is NOT reachable via the edit form. (2) The genuine residual risk is a DELETED-after-persist (or corrupt-store) record.cwd reaching create() on a live restart: there the pid -1 + 'Working directory not found' notice IS produced by main but is SWALLOWED renderer-side (the ITEM-4 notice guard keeps status 'running'; handleRestart has no pid<=0 branch), leaving a stale-running row on a dead PTY with an unsurfaced errorMessage. Confirm = the swallow is real (for the deleted-dir edge case); Deny = the edit-form bad-cwd path does not produce pid -1 (updateProfile rejects it first). Leave for the fix plan; this session is diagnose-only.

## Eliminated

- hypothesis: (b) Restart-specific output ordering defeats the `\n…<nonce>` match (vs a clean cold spawn).
  evidence: Driver 1 B_restart_respawn matched 4/4 and driver 2 F_restart_verbatim matched 3/3 — the restart respawn produces the SAME `\n…<nonce>` match the dormant Start does. No ordering difference observed.
  timestamp: 2026-06-16

- hypothesis: (c) 4000ms is too tight for a restart respawn specifically (heavier re-init on restart).
  evidence: A bare restart respawn matches in ~1041-1076ms — FASTER than the dormant Start (1469ms) in driver 1. The respawn is not intrinsically slower. (The 4000ms IS too tight for a SLOW rc init generally — but that is shell-init latency, identical for restart and dormant, NOT restart-specific. See Resolution.)
  timestamp: 2026-06-16

- hypothesis: (a) Race — residual bytes from the dying old shell contaminate the new probe buffer, OR the new shell isn't reading input when the marker is written.
  evidence: Driver uses a FRESH probe + FRESH buffer per spawn (mirrors create(): each spawn builds its own probe + buffer). The new shell DOES queue the marker before its read loop is up, but zsh re-processes the queued ':' line once zle initializes and the match fires — no contamination, no lost marker. The marker survives the pre-read window (the timeline shows the queued ':' re-echoed at re-prompt). Eliminated as the ROOT cause: the marker is not lost to a race; it is matched late, gated purely on rc-init completion time.
  timestamp: 2026-06-16

- hypothesis: (d) restart() reuses listener/buffer/PtySession state the dormant create({id}) path does not (stale onData listener, un-reset buffer, double-attached interceptor).
  evidence: create() is the SINGLE funnel for all three spawn entry points (new / restart-respawn / dormant-Start) and builds a fresh probe interceptor + fresh buffer every call (pty-manager.ts 419-463). restart() does not pass any buffer/listener state into create() — it only passes {cwd,id,name,order}. Driver F (respawn inside the old child's onExit, exactly as restart() does) matched 3/3 with no penalty. No reused state path exists.
  timestamp: 2026-06-16

## Resolution (diagnose-only — Root Cause Report)

root_cause: |
  GAP-12-B is a LATENCY-BUDGET defect in the TERM-05 readiness probe, NOT a restart-specific
  code bug. The probe writes its no-op marker (`: <nonce>\r`) into the freshly-spawned login
  shell at t≈0 — BEFORE the shell's rc (`.zprofile`/`.zshrc`, with conda/nvm/oh-my-zsh/etc.)
  has finished initializing. The match condition (`\n[^\n]*<nonce>` — the nonce on a PRODUCED
  line, not the bare echoed-input line) cannot fire until the shell completes rc init and
  re-prompts, which re-echoes the queued ':' line onto a produced line. So the probe-match
  time ≈ the login-shell rc-init time. READINESS_TIMEOUT_MS is a FIXED 4000ms with no headroom,
  retry, or adaptive extension. On a machine/shell whose login-shell rc init exceeds 4000ms
  (heavier operator rc, cold OS caches after the edit flow, machine under load, and/or a cwd
  change that touches a slower per-directory init path), the probe times out → the D-04
  fallback flushes the buffer and emits READINESS_FAIL_NOTICE → the startup command is never
  injected. The "works on dormant Start but fails on restart" observation is NOT a code
  divergence: create() is the single funnel for both paths and the autonomous driver proves
  restart and dormant Start cross the 4000ms wall TOGETHER at the same init latency — the
  operator simply hit a fast (warm) dormant Start earlier and a slow (cold/heavy) restart later.

fix: |
  (DIRECTION ONLY — diagnose-only session; fix planned via /gsd-plan-phase 12 --gaps)
  The fix targets the latency-budget mechanism, not a logic bug. Lifecycle-safe options,
  smallest-first:
    1. RAISE + ADAPT the budget: bump READINESS_TIMEOUT_MS (e.g. 8000-10000ms — the smoke
       already waits up to 8000ms for the command output, so there is contract headroom) AND
       make it EXTEND-ON-PROGRESS: reset/extend the deadline whenever the probe interceptor
       sees new bytes (the shell is alive and producing), so a slow-but-progressing rc is not
       guillotined at a fixed wall while a truly hung shell still times out. This is the
       minimal, highest-leverage change and keeps the D-04 invisibility/no-garble contract.
    2. (Defense-in-depth, optional) On a confirmed timeout, retry the marker ONCE after a
       short delay before giving up (the shell may have just finished rc) — keeps the inject-
       once invariant since injection still only happens on a real match.
  Constraints to preserve: D-02 invisibility (probe bytes never forwarded pre-match), D-04
  (NEVER best-effort inject on timeout — a bare shell beats garbled keystrokes), the working
  dormant-Start auto-run + terminal fidelity, and DEBT-02 (the eventual fix needs a test that
  exercises the REAL slow-rc timing — the heavy-init ZDOTDIR-sleep driver in spike 005 is the
  deterministic repro to fold into that test — plus a mandatory human re-verify). Do NOT flip
  nyquist_compliant.

verification: |
  (diagnose-only — no fix applied) Root cause REPRODUCED deterministically by the autonomous
  node-pty + buildPosixProbe driver (spike 005):
    - drive-restart-probe.cjs: A_dormant matched 1469ms, B_restart matched 1041ms (4/4) — a
      bare restart respawn does NOT time out; restart is not slower than dormant.
    - drive-restart-probe-2.cjs: F_restart_verbatim (respawn inside the dying child's onExit)
      matched 3/3 ~1064ms (no restart penalty); E heavy-init threshold — sleep3 BOTH match
      ~3050ms, sleep4 + sleep5 BOTH (dormant AND restart) TIMEOUT at 4000ms; byte-timeline
      shows the marker written at t=1ms, dead-silent through rc, then matched only after the
      re-prompt at rc-completion. This proves match-time == rc-init-time and that the 4000ms
      wall is shared, not restart-specific.
  GAP-12-C confirmed/denied by code trace + diagnosis tests (both GREEN):
    - gap-12-c-bad-cwd-restart.diag.test.ts (3 pass): updateProfile rejects a non-existent cwd
      (keeps prior), restart-to-apply after a bad-cwd edit SUCCEEDS pid>0 with the prior cwd
      (NO pid -1 / NO error notice), and the pid -1 + notice only occurs for an already-bad
      (deleted-dir/corrupt) record.cwd reaching create().
    - gap-12-c-surface.diag.test.ts (2 pass): on a LIVE row, an error event carrying a notice
      is treated as informational by applyStatusEvent (status stays 'running', no IdleCard) →
      the rejection is SWALLOWED for the deleted-dir edge case; a bare error without a notice
      DOES flip an identity row to the Inactive List.

files_changed:  # ROUND 3 — GAP-12-C production fix applied (renderer handlers only). GAP-12-B is instrument-only (no prod change until the operator's data is in hand).
  - src/renderer/session-lifecycle-actions.ts          # NEW pure reducer resolveSpawnResult(row,{pid}) — single source of truth for both Start + Restart
  - src/renderer/SessionManager.tsx                     # handleStart / handleStartNoCmd / handleRestart all route pid<=0 through resolveSpawnResult → visible error card
  - src/renderer/__tests__/session-restart-error-surface.test.ts  # round-3 regression: BOTH Start (dormant) + Restart (live) paths surface a failed spawn; ITEM-4 guard stays GREEN
  - .planning/spikes/005-restart-probe-timeout/operator-probe-timeline.cjs  # NEW GAP-12-B operator instrument (plain node + node-pty, mirrors the shipped dual-deadline)
  - .planning/spikes/005-restart-probe-timeout/README.md  # documents the operator instrument + run instructions
  # Round-1 diagnosis artifacts (unchanged): drive-restart-probe.cjs / drive-restart-probe-2.cjs / capture-restart-probe*.jsonl

## Specialist Review (typescript-reviewer, 2026-06-16 — fix-direction sanity check, diagnose-only)

Reviewed the proposed fix DIRECTION only (no patch applied). Verdict per item:

1. **Extend-on-progress timeout → SUGGEST_CHANGE (load-bearing).** Resetting the deadline on
   every new byte is sound against the heavy-rc-init case BUT has a hard correctness gap: a
   chatty-but-never-ready shell (streaming ≥1 byte per <deadline window) would extend the
   deadline forever and NEVER time out — the `settled` flag does not help (it only flips on
   match/timeout). The fix MUST use a **dual deadline**: an idle timer that resets on each new
   byte PLUS a hard absolute wall-clock ceiling (e.g. `READINESS_HARD_TIMEOUT_MS ≈ 15000ms`)
   that calls the SAME timeout-flush-and-notice cleanup path. Without the absolute cap the D-04
   liveness guarantee is broken for the chatty-never-ready case. TS note: `timerRef` is a
   single-slot `{ current?: NodeJS.Timeout }` — two timers (idle + hard) need a second slot /
   named wrapper; widen the type before implementing. The stale-timeout guard
   (`live.pty !== child`) applies to both timers unchanged.

2. **Retry the marker once → LOOKS_GOOD (one constraint).** D-02 invisibility holds (the
   interceptor keeps buffering regardless of marker count; the renderer sees nothing until
   match or timeout-flush). No double-match/double-inject: `probe.matches()` exits early on the
   first match and disposes the listener immediately, so only the first match counts; the
   `: <nonce>\r` no-op is stateless (D-01) so writing it twice is safe. Constraint: gate the
   retry on `!settled` and fire it once, on a fixed delay smaller than the timeout window.

3. **GAP-12-C pid<=0 placement → SUGGEST_CHANGE.** Put the fix in **`handleRestart`'s `else`
   branch**, NOT in `applyStatusEvent`. `create()` already broadcasts the `error` + notice over
   `onPtyStatus` before returning, so by the time the renderer observes `pid<=0`, the
   subscription has already run. The correct idiomatic move is an explicit `else` in
   `handleRestart` that clears `ptyPid` / does not leave a stale optimistic `running` flip —
   letting the already-fired error state win. Adding notice-surface logic to `applyStatusEvent`
   would BREAK the existing ITEM-4 guard (a notice is intentionally informational and must
   never change lifecycle status — tested in `apply-status-event.test.ts`).

**Net for the fix plan:** the timeout fix is NOT a simple "raise + reset-on-byte" — it needs an
absolute hard ceiling alongside the idle-extension, or the never-times-out regression is
re-introduced. Item 2 and the GAP-12-C placement are sound as-described.

---

## Round 3 (REOPENED 2026-06-16) — the round-2 fix failed live; measure, don't guess

**What changed since round 1.** The round-1 fix DIRECTION was implemented and shipped:
- 12-08 implemented the dual deadline: `READINESS_IDLE_TIMEOUT_MS = 8000` (resets on each new probe byte) + `READINESS_HARD_TIMEOUT_MS = 15000` (absolute ceiling), both routing through the shared D-04 flush-and-notice cleanup. Its synthetic `tests/integration/readiness-probe-heavy-init.integration.test.cjs` PASSES (injects @5056ms under a ZDOTDIR-sleep heavy init; never-ready hits the 15003ms ceiling).
- 12-09 implemented the GAP-12-C fix in `handleRestart`'s `pid<=0` else.
- The round-2 re-gate (12-10) automated chain was GREEN.

**But the operator's live re-verify (round-2 re-gate, 2026-06-16) STILL FAILED both:**
- **GAP-12-B:** "the tiem failed, the rest working fine" — the command STILL does not auto-run on the operator's real machine, even with the 8s-idle / 15s-hard budget.
- **GAP-12-C:** "nothing happend, after i **start** it just returned to home" — the failed spawn surfaces nothing.

This is the round-1 `blind_spots` field coming true verbatim: *"Could not measure the OPERATOR'S real rc-init latency (no access to their machine)."* We have now guessed the B budget TWICE (4000ms → 8000/15000ms) and failed live both times. **The round-3 contract is: MEASURE THE OPERATOR'S REAL TIMELINE BEFORE TOUCHING ANY NUMBER. Do not guess a third time.**

### GAP-12-B round-3 plan — build the operator instrument FIRST
Open questions only the operator's machine can answer:
- Does their rc init have a **silent gap > 8000ms** (the shell is working but emits no bytes for >8s — e.g. a network-touching init, a `compinit` rebuild, a conda/nvm/direnv per-dir activation that prints nothing)? → the IDLE timer fires mid-init even though progress is happening. If so, "reset-idle-on-any-byte" is the wrong signal; the fix is a different liveness signal or a much larger idle window.
- Does their **total** rc init exceed **15000ms**? → the HARD ceiling fires. If so, raise the ceiling (and reconsider whether a 15s+ auto-run is even desirable vs a "press enter to run" affordance).
- Does the **idle-extend fail to re-arm** on their byte pattern (a bug in the 12-08 timer-reset wiring under real interleaving)?

**Deliverable (the operator's explicit ask — "做诊断版"):** a small, SELF-CONTAINED diagnostic the operator runs ONCE on their own machine (ideally reusing the ported `buildPosixProbe` + the spike-005 driver shape, NOT requiring a full Electron build) that logs, with millisecond timestamps: every probe-byte arrival (size + first/last bytes), the exact moment the `\n…<nonce>` match fires OR each deadline (idle vs hard) trips and which one, and the shell's first-prompt time. It must run against the operator's REAL login shell (`zsh -l` with their actual rc), and ideally in the cwd they were editing into (per-dir init matters). Output a single jsonl/text the operator pastes back. THEN, and only then, tune the budget/mechanism to their measured reality and fold the real numbers into the DEBT-02 regression. This step is a **human-action checkpoint** — the operator runs the instrument; the orchestrator presents it and waits.

### GAP-12-C round-3 plan — the unfixed path is handleStart
Round-1 confirmed the swallow and round-2 (12-09) fixed `handleRestart`'s `pid<=0` else. **But `handleStart` (SessionManager.tsx:259-278) has NO `pid<=0` branch at all** — its comment claims it clears a stale ptyPid on the error path, but the code only has `if (pid > 0)`. The operator said "after i **START** it just returned to home" → they exercised the dormant→Start path, which the 12-09 fix never touched. Round-3 C is locally reproducible on the dev box (no operator needed):
1. Create a session, point cwd at a real dir, **delete the dir**, then click **Start** (handleStart) → `create()` returns pid -1 + the "Working directory not found" notice main emits (pty-manager.ts:340-345).
2. Confirm what the row does (the operator's "returned to home" → likely the active view falls back to the welcome/empty/home state, or the row goes dormant with no visible error).
3. Fix: give `handleStart` the SAME visible-error treatment as the fixed `handleRestart` (surface the IdleCard + notice where the user acted; do not fall back to home). Verify a genuine bad-cwd **Restart** ALSO surfaces (the 12-09 fix may need a render-path follow-up if "returns to home" affects it too). Add a regression test for BOTH paths.

### Round-3 guardrails (carry into the fix plan)
- **B:** measure first. No number changes before the operator's instrument data is in hand. Preserve D-02 (no pre-match forwarding) + D-04 (never best-effort inject) on every timeout path. Build the DEBT-02 regression from the operator's REAL measured timing, not another synthetic guess.
- **C:** fix belongs in the renderer handlers (`handleStart` else + the render fallback), NOT in `applyStatusEvent` (the ITEM-4 notice-informational guard must stay — `apply-status-event.test.ts` GREEN). EXPECTED_API_KEYS stays 20; no new IPC.
- Branch `gsd/phase-03-multi-session-session-lifecycle` (shared dev). Do NOT flip `nyquist_compliant`. Do not regress the working dormant-Start auto-run / terminal fidelity.

- **next_action (round 3):** Build the GAP-12-B operator instrument → human-action checkpoint (operator runs it on their machine, pastes the timeline). In parallel, reproduce + fix the GAP-12-C handleStart pid<=0 path locally with a regression test.

## Round 3 — Operator instrument results (2026-06-16) — terminal CANNOT reproduce; cause is app-cold-spawn

Operator ran `operator-probe-timeline.cjs` on their real machine. The standalone instrument RULED OUT every terminal-side cause:
- **cwd=/Users/jerry (home):** 3/3 MATCH @ ~1005-1336ms; MAX-SILENT-GAP ~1.3s.
- **cwd=/Users/jerry/Thesis/Thesis-Work** (the operator's named "problem folder"): 3/3 MATCH @ ~1023-1311ms. **NOT folder-specific.** No per-dir init markers in that folder (no .envrc/.nvmrc/conda-meta; 70M, has .git).
- **Dock-like minimal env** (`env -i HOME USER PATH=/usr/bin:/bin:... zsh -lic exit`): ~1.1s. **NOT a stripped-env effect.**
- **15× login-shell timing:** rock-stable 1.02-1.44s, ZERO intermittent spikes. **Not an everyday random stall.**
- **sdkman selfupdate** (`SDKMAN_CANDIDATES_API`, curl 7s-connect/10s-max-time, `sdkman_selfupdate_feature=true`): `~/.sdkman/var/version` mtime = **Sep 29 2023** → the network selfupdate is NOT firing on shell start. Warm component cost: conda hook 0.33s, nvm 0.23s, sdkman 0.03s (≈ the observed 1.0-1.3s total).

**Conclusion:** the terminal/standalone path is fast and reliable everywhere — the readiness timeout is reproducible ONLY inside the packaged app. Remaining live hypothesis: the **cold FIRST `zsh -l` spawn after a Dock launch** (cold disk caches → conda's Python `shell.zsh hook` + cold rc reads take far longer that one time; warm terminal runs never pay this). Secondary: a difference in the app's actual node-pty spawn/lifecycle (stop→SIGTERM→respawn under the full Electron app) not captured by the standalone driver.

**Next decisive tests (cheapest first):**
1. `sudo purge` (flush OS disk cache) THEN run the instrument on Thesis-Work — a fast proxy for the cold-disk first spawn. If it times out / shows a >8s silent gap, cold-cache is confirmed + we capture the real number.
2. If purge does NOT reproduce → instrument the APP itself: add gated probe-timeline logging to `pty-manager.ts` create() (write byte arrivals + which deadline trips to a file), `npm run package`, operator reproduces the GAP-12-B failure in the app, read the log. This is the only path that captures the true app-side cold-spawn timeline.

Fix implication either way: if the stall is an unpredictable cold-spawn (not a fixed budget), the fix is NOT another bigger guess — likely a smarter readiness signal and/or making the auto-run resilient to a late-but-eventually-ready shell, decided from the captured number.

---

## Round 3 progress (2026-06-16) — GAP-12-C FIXED, GAP-12-B instrument BUILT (awaiting operator)

### Round-3 reasoning checkpoint (GAP-12-C — the fixable workstream)

reasoning_checkpoint:
  hypothesis: "The operator's 'after I start it just returned to home' is the dormant→Start (handleStart) path's UNFIXED pid<=0 swallow. handleStart had only `if (pid > 0)`; on a failed spawn (pid -1) it did NOTHING, and main's broadcast error carries a `notice` so applyStatusEvent's ITEM-4 guard keeps the row INFORMATIONAL (status stays not_started). Net: the row stays on the DORMANT IdleCard (the Start button), and the IdleCard error branch (isError = status==='error') never shows the captured message — it looks like nothing happened ('returned to home')."
  confirming_evidence:
    - "Code read: handleStart (SessionManager.tsx:259-278) had NO else on pid<=0 — only the pid>0 optimistic-running flip; the 12-09 fix touched handleRestart ONLY."
    - "applyStatusEvent (apply-status-event.ts:61-66): an event WITH a `notice` returns `{...row, errorMessage}` and NEVER changes status (ITEM-4 guard). So the broadcast error+notice cannot flip a dormant row to 'error' on its own."
    - "IdleCard.tsx:49 + 111 + 128: the error branch is gated on `isError = session.status === 'error'`; a not_started row renders the DORMANT Start branch, hiding errorMessage."
    - "REPRODUCED: a focused test modelling the current handleStart no-op on pid<=0 → status stays 'not_started', errorMessage captured but the error branch is NOT shown (isError=false). The swallow is real on the Start path."
  falsification_test: "If handleStart had ALREADY flipped pid<=0 to 'error' (like handleRestart's fix was assumed to do for both), the repro would have shown status='error'. It showed status='not_started' — the swallow is confirmed for the Start path specifically."
  fix_rationale: "Extract a SINGLE pure reducer resolveSpawnResult(row, {pid}) used by BOTH handleStart and handleRestart so the two paths can never diverge again. pid<=0 → flip to status:'error' + drop the dead pid + preserve any notice-supplied errorMessage (fallback literal if the invoke reply beats the notice push). status:'error' makes the row a CARD (activeIsCard) AND trips the IdleCard error branch → the failure surfaces where the user acted. Fix is in the renderer handlers, NOT applyStatusEvent — the ITEM-4 guard stays GREEN."
  blind_spots: "GAP-12-C's reachable trigger is a deleted-after-save / corrupt-store cwd reaching create() (updateProfile rejects a bad cwd at save, keeping the prior valid one — round 1 finding). The normal edit→Start with a freshly-typed bad cwd is NOT the pid<=0 path (main drops it at save). The fix is still correct + necessary for the deleted-dir edge AND hardens BOTH paths uniformly; the operator should verify by deleting a session's cwd dir on disk, then Start (and Restart)."

### GAP-12-C — FIXED (this cycle, locally reproduced + regression-tested)

- **Reproduced:** modelled the current handleStart pid<=0 no-op composed with applyStatusEvent's notice-guard → the dormant row stays not_started with the error invisible (the operator's "returned to home"). RED confirmed before the fix.
- **Fixed:** added a pure `resolveSpawnResult(row, {pid})` reducer in `src/renderer/session-lifecycle-actions.ts` (the existing home for renderer lifecycle reducers, alongside resolveRemoveAction/flipToDormant). Wired `handleStart`, `handleStartNoCmd`, AND `handleRestart` through it (SessionManager.tsx). pid<=0 now flips to a VISIBLE 'error' card on EVERY spawn path; pid>0 keeps the optimistic running flip. The render-path follow-up is intrinsic: status:'error' → activeIsCard + IdleCard isError branch, so a bad-cwd RESTART surfaces too (not just Start).
- **NOT in applyStatusEvent:** the ITEM-4 notice-informational guard is untouched (`apply-status-event.test.ts` GREEN). EXPECTED_API_KEYS stays 20; no new IPC.
- **Regression test:** extended `src/renderer/__tests__/session-restart-error-surface.test.ts` with round-3 blocks covering BOTH Start (dormant) and Restart (live) paths: pid<=0 → status='error' + dead pid dropped + isCard true + error branch shown; notice-supplied errorMessage preserved (no clobber) when it lands first; pid>0 → running + stale error cleared.
- **Suite:** tsc 0 · scoped lint clean · unit 474 passed (was 469; +5 round-3 assertions) · the ITEM-4 guard + 12-09 handleRestart contracts still GREEN.

### GAP-12-B — instrument BUILT, validated, ready for the operator (HUMAN-ACTION checkpoint)

- Built `.planning/spikes/005-restart-probe-timeout/operator-probe-timeline.cjs`: a self-contained plain-node + node-pty diagnostic (NO Electron build). Ports `buildPosixProbe` VERBATIM and mirrors the SHIPPED dual-deadline EXACTLY (idle=8000 reset-on-byte + hard=15000 absolute). Logs, with ms timestamps: every probe-byte arrival (size + head/tail peek, no secrets), the `\n…<nonce>` match OR which deadline trips (idle vs hard) + why, the longest SILENT gap between bytes, and a bare first-prompt control. Runs against the operator's real `zsh -l` + actual rc in a cwd they pass, 3 runs for jitter. Output: a pasteable human summary + `operator-timeline.jsonl`.
- **Validated on the dev box across ALL THREE outcomes** before hand-off: MATCH (~1031-1427ms fast rc), IDLE-TIMEOUT (a deterministic silent >8s rc gap → confirms the "reset-on-byte is the wrong signal" hypothesis is detectable), HARD-TIMEOUT (chatty-every-2s never-ready rc, total >15s → confirms the "raise the ceiling" hypothesis is detectable). jsonl validated as well-formed + secret-free (only sizes + short peeks).
- **NO budget number changed.** Per the round-3 contract, the budget/mechanism is tuned ONLY after the operator's measured timeline is in hand. This is the human-action checkpoint.

- **next_action (round 3, post-checkpoint):** WAIT for the operator's pasted timeline + operator-timeline.jsonl. Then disambiguate: idle-timeout w/ silent gap >8s → larger idle window or a different liveness signal; hard-timeout → raise the ceiling (and weigh a 'press Enter to run' affordance); match-on-this-cwd but app still fails → the failing cwd has heavier per-dir init, ask them to re-run pointing at the exact folder. Fold the REAL numbers into the DEBT-02 regression; re-verify live; nyquist flips only at the round-3 re-gate.
