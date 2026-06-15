---
slug: gap-12-b-restart-probe-timeout
status: diagnosed
trigger: "Phase 12 GAP-12-B — 'Restart to apply?' (Restart now) fails LIVE: the new startup command does not auto-run; the session prints 'Startup command didn't auto-run — shell wasn't ready in time.' (READINESS_FAIL_NOTICE). Operator changed cwd to a REAL existing dir, so this is the TERM-05 readiness probe timing out on the in-place restart respawn, NOT a CR-01 cwd rejection."
created: 2026-06-16
updated: 2026-06-16
goal: find_root_cause_only
phase: 12
gaps: ["GAP-12-B (primary)", "GAP-12-C (secondary — confirm-or-deny)"]
---

# Debug — GAP-12-B restart-to-apply readiness-probe timeout

## Symptoms (prefilled from operator human-verify 2026-06-16)

1. **Expected:** After editing a RUNNING session's Startup command + Working directory and clicking Save changes → "Restart to apply?" → "Restart now", the session respawns in place (same logicalId, new ptyPid) and the new startup command auto-runs (its output appears).
2. **Actual:** The session prints `Startup command didn't auto-run — shell wasn't ready in time.` (READINESS_FAIL_NOTICE) and the new command never runs.
3. **Error message:** `Startup command didn't auto-run — shell wasn't ready in time.` (pty-manager.ts `READINESS_FAIL_NOTICE`, the D-04 readiness-timeout fallback).
4. **Timeline:** Surfaced at the Phase 12 re-gate (12-07) human-verify, 2026-06-16. GAP-12-B (the Restart-to-apply prompt) was newly added in 12-06.
5. **Reproduction:** Live packaged app. Add a session → let it run → Edit → set Startup command (e.g. `echo HELLO-RESTART`) AND set Working directory to a real existing dir → Save changes → "Restart to apply?" → Restart now. The notice appears; the command does not run.

## Current Focus

GAP-12-B root cause CONFIRMED (see Resolution + Evidence). Now confirming/denying GAP-12-C.

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

- **next_action:** Confirm/deny GAP-12-C: read applyStatusEvent + mergeAuthoritativeProfiles, trace whether a bad-cwd restart rejection (create() pid -1 + 'Working directory not found') surfaces visibly on a LIVE→failed-restart session or is swallowed; determine whether updateProfile persisted the bad cwd.

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

files_changed: []  # diagnose-only — NO production code changed. Diagnosis artifacts created:
  # - .planning/spikes/005-restart-probe-timeout/drive-restart-probe.cjs (throwaway driver)
  # - .planning/spikes/005-restart-probe-timeout/drive-restart-probe-2.cjs (throwaway driver)
  # - .planning/spikes/005-restart-probe-timeout/capture-restart-probe*.jsonl (forensic logs)
  # - src/main/__tests__/gap-12-c-bad-cwd-restart.diag.test.ts (diagnosis test — REMOVE/relocate in fix plan)
  # - src/renderer/__tests__/gap-12-c-surface.diag.test.ts (diagnosis test — REMOVE/relocate in fix plan)

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
