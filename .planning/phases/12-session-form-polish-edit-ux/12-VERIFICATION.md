---
phase: 12
slug: session-form-polish-edit-ux
status: gaps_found
nyquist_compliant: false
verified_by: operator human-gate
verified: 2026-06-15
gaps_total: 5
requirements: [UI-04, SESS-05, SESS-06]
---

# Phase 12 — Verification (human-gate result)

The BLOCKING end-of-phase human-verify (12-03 Task 3) was run by the operator on the
packaged app (2026-06-15). Verdict: **QUALIFIED FAIL** — `nyquist_compliant` stays **false**,
Phase 12 does NOT ship. Five gaps + one process meta-finding. Route: gap-closure
(`/gsd-plan-phase 12 --gaps` → `/gsd-execute-phase 12 --gaps-only` → re-gate).

## What PASSED (operator: "approve the rest")

- **SESS-05 prefill (O-1 first-open default cwd)** — first Edit-open shows the resolved home path. ✓
- **SESS-05 round-trip** — edit cwd + startup → Save → reopen shows the saved values. ✓

## Gaps

| ID | Severity | Requirement | Operator report | Root cause (code-confirmed) | Fix direction |
|----|----------|-------------|-----------------|------------------------------|---------------|
| GAP-12-A | high | UI-04 (SC1) | "no blue save change, not evenly spaced" | The Save button (`SessionEditModal.tsx:339`) carries BOTH `modal-btn-save` (blue ramp) AND `context-menu-item` (added only as a WDIO text-click hook); `.context-menu-item` is defined later in `form.css` (~:142 > :107) so it overrides the blue background. Spacing in `.modal-actions`/`.edit-field`/groups reads uneven on the real window. | Drive the Save click by `data-testid` (drop `context-menu-item` from the button); restore the accent-blue `modal-btn-save`; tune group/field/actions rhythm to the UI-SPEC. |
| GAP-12-B | high | SESS-05 / UX | "after edit, there should be a pop-up to restart the session with the new applied command" | cwd/shell/startup are "Applies on restart," but Phase 11 (D-01) REMOVED the restart UI — no path applies them. `ptyRestart` IPC + `handleRestart` were retained un-surfaced. | **Operator decision 2026-06-15: add a "Restart to apply?" prompt.** After Save, if a LIVE session's launch fields (cwd/shell/startup) changed, show a prompt → "Restart now / Later", reusing the retained `ptyRestart`. (Partially reverses P11 restart-removal — intentional, operator-requested. Touches DEBT-02-governed lifecycle → plan with care + threat/R&C lens.) |
| GAP-12-C | high | SESS-06 / CR-01 (T-12-01) | "there is no inline working directory not found" | The inline cwd error renders only while the modal is open AND `errorMessage` is set, but CR-01 only fires at Start — AFTER the modal closes (`SessionEditModal.tsx:158-163`). So the rejection surfaces on the row/IdleCard, never inline in the form. | Surface the CR-01 rejection on the GAP-B restart-to-apply (bad cwd → restart fails → "Working directory not found" shown where the user acted) AND/OR a live "path does not exist" hint while typing cwd. Keep main as validator of record. |
| GAP-12-D | high | UI-04 / interaction | "select all in the name text box closes the edit window" | **No application `Menu` is configured anywhere in `src/main`** → `Cmd+A` has no Select-All role and bubbles out (Cmd+C/V/X/Z likely broken in the form inputs too); additionally the `.modal-overlay` `onClick={onCancel}` can fire on a drag-select overshoot. | Add a proper application Menu with the standard Edit roles (undo/redo/cut/copy/paste/selectAll); guard the overlay close to only fire when mousedown STARTED on the overlay (not on a selection drag ending there). |
| GAP-12-E | medium | UI-04 (validation tone) | "not sure what 5 asks for" | Check-5 instruction was unclear; the neutral validation hints exist in code (`validateSessionForm` → name/cwd notices) but were not clearly verifiable live. | Clarify the check; verify the neutral hints (empty name, non-absolute cwd) render visibly + calm (not red), red only on a genuine main rejection. |

## Process meta-finding (orchestrator owns)

- **The `ui:shots` visual gate false-passed GAP-12-A.** The `edit-modal` capture framed the form with the **Save button below the fold**, so the rubric scored "PASS" without ever seeing the button — that is how a non-blue Save slipped the automated gate. **Fix the ui-lab `edit-modal` surface to capture the full form including the `.modal-actions` row** (scroll-into-view or size the capture) so the visual gate cannot pass without seeing the primary action. Add this to the gap-closure scope.

## Re-gate criterion

After the gap-closure plans land: full suite GREEN + a fresh `ui:shots:fresh` capture that **includes the Save button**, then a re-run of the BLOCKING operator human-verify covering GAP-12-A..E. `nyquist_compliant` flips true only on the operator's explicit unqualified approval.

---

## Re-Gate 1 Result (12-07 Task 2) — 2026-06-16: **QUALIFIED FAIL**

Automated chain GREEN (tsc 0 / scoped lint clean / unit 448 / smoke 15-15 / ui:shots `p12-regate` rubric PASS; one stale smoke fixed test-only at `3bb9f28`). Operator ran the BLOCKING human-verify on the packaged app. Verdict: **QUALIFIED FAIL** — `nyquist_compliant` stays **false**; Phase 12 does NOT ship.

### Operator results (verbatim, per item)

| Item | Result | Operator words |
|------|--------|----------------|
| 1 GAP-12-A (blue Save + spacing) | ✅ approve | "approve" |
| 2 GAP-12-D (Cmd+A / clipboard / overlay) | ✅ approve | "approve" |
| 3 GAP-12-E (validation hints) | ⚠️ partial | "name can see hint, false path still can not see … when i input a false path, which action will it hint me wrong path? if … click on save, then save directly close window" |
| 4 SESS-06 (Browse…) | ✅ approve | "approve" |
| 5 GAP-12-B (restart-to-apply) | ❌ FAIL | "failed, it outputs shell wasnt ready in time. there was a restart function that was working, why not directly use it?" |
| 6 GAP-12-C (visible bad-cwd rejection) | ❌ FAIL | "cant see, i think when there is a false path, the working directory [isn't] saved at all" |
| 7 existing chords (Cmd+1/2/K/F) | ❌ FAIL | "no" |
| 8 SC1 cohesive surface | ✅ yes | "yes" |

### Remaining / reopened gaps (root cause code-confirmed where noted)

| ID | Status | Severity | Root cause / hypothesis | Fix direction |
|----|--------|----------|--------------------------|---------------|
| GAP-12-B | REOPENED | high | `handleRestart`→`ptyRestart`→main `restart()`→`create()` runs the TERM-05 readiness probe; it did NOT match within `READINESS_TIMEOUT_MS`=4000ms on the in-place restart respawn → `READINESS_FAIL_NOTICE` ("shell wasn't ready in time") + the command is NOT injected (D-04 safe fallback). Why the probe times out on a restart respawn (vs a working dormant Start, same `create()` path) is UNKNOWN → needs reproduction/trace. | **DEBUG-FIRST.** Reproduce + trace the probe buffer on a restart respawn (race with the dying shell? stale bytes? timeout too tight?). Decide fix (longer/again-on-restart probe, or a restart-specific injection) — do NOT guess. |
| GAP-12-C | REOPENED | high | On a restart-to-apply FAILURE the session was LIVE (SessionView, no IdleCard). `handleRestart` only flips to running on `pid>0`; on `pid<=0` it does nothing (no else), relying on the `onPtyStatus` 'error'+notice to surface via the IdleCard — but a live→failed-restart session may not transition to the IdleCard, so "Working directory not found" is invisible. Operator also suspects the bad cwd "isn't saved at all". | Make the failed restart-to-apply visibly land the error where the user acted (flip to a not_started/error state that shows the IdleCard + notice). Confirm `updateProfile` persists the cwd (validation is at `create()`, not persist). Ties to GAP-12-B debug. |
| GAP-12-E | REOPENED | medium | `validateSessionForm` hints on FORMAT only: a non-empty, NON-ABSOLUTE cwd (`foo/bar`) hints live; an absolute-but-NON-EXISTENT path (`/x/nope`) is format-valid → NO hint by design (existence is main's CR-01 at launch). Hints never block Save (convenience-only; main = validator of record), so Save closes regardless. Operator expected a "wrong path" (non-existent) to be flagged → expectation/spec mismatch. | Clarify the model + make launch-time existence rejection visible (ties to GAP-12-C). Decide whether to add a live existence check (needs IPC / a bridge key — weigh vs the 20-key budget) or rely on a clearly-surfaced launch rejection. |
| GAP-12-F | **NEW** | high | After the 12-05 application `Menu` (`Menu.setApplicationMenu`, appMenu+editMenu+windowMenu), the operator reports the existing chords (Cmd+1/2 switch, Cmd+K clear, Cmd+F find) no longer work. By design these are `before-input-event` intents (index.ts:125-146), NOT menu accelerators (app-menu.ts:14), so the Menu should not shadow them — the regression is UNEXPECTED. | **DEBUG-FIRST.** Reproduce live; determine which chord(s) broke and whether the new Menu changed `before-input-event` delivery / focus. Likely a 12-05 regression. |

**Route:** `/gsd-debug` to root-cause GAP-12-B / GAP-12-C / GAP-12-F (reproducible product/lifecycle defects — the readiness-probe + restart-error-surfacing are DEBT-02-governed; GAP-12-F is a Menu regression) → then `/gsd-plan-phase 12 --gaps` to plan fixes for B/C/E/F with confirmed causes → re-execute → re-gate. `nyquist_compliant` stays false.

### Update — operator clarifications (2026-06-16)

- **GAP-12-F WITHDRAWN.** The operator's gate answer "7, no" was a slip — the Cmd+1/2 / Cmd+K / Cmd+F chords **work**. No Menu regression. Removed from the fix scope.
- **GAP-12-B CONFIRMED (primary).** In the failing #5 test the operator changed the Startup command AND the Working directory **to a real, existing directory** — so the cwd was VALID and the failure is purely the TERM-05 readiness-probe **timing out on the restart respawn** (`READINESS_FAIL_NOTICE`), not a CR-01 cwd rejection. **DEBT-02 note:** `session-edit.smoke`'s GAP-12-B spec PASSES (the probe matches in the fast wdio env) → automated green does NOT reproduce this live timeout. Same failure class the DEBT-02 blocker warns about — debug must reproduce the LIVE timing, not trust the green smoke.
- **GAP-12-C UNCERTAIN — needs a clean repro.** Because #5 used a VALID cwd, the operator hit the probe-timeout path, NOT a missing-cwd rejection — so a genuine bad-cwd restart was never actually exercised at the gate. Debug must reproduce a real missing-cwd restart-to-apply to determine whether "Working directory not found" surfaces on a live→failed-restart session (the `handleRestart` pid<=0 no-else path) or is truly invisible.
- **Active fix scope after clarification: GAP-12-B (confirmed), GAP-12-C (confirm-then-fix), GAP-12-E (design/UX — format-only validation + Save-doesn't-block).**

### Diagnosis complete — `/gsd-debug` (2026-06-16, diagnose-only)

Full Root Cause Report + reproduced evidence: `.planning/debug/gap-12-b-restart-probe-timeout.md` (status: diagnosed) + the deterministic repro driver `.planning/spikes/005-restart-probe-timeout/`. No production code changed; `nyquist_compliant` untouched.

- **GAP-12-B ROOT CAUSE (confirmed + reproduced):** a **latency-budget defect**, NOT a restart-vs-dormant code divergence (`create()` is the single funnel for both). The readiness probe writes its `: <nonce>\r` marker at t≈0, before the login shell's rc init finishes; the `\n…<nonce>` match can only fire after rc completes and the shell re-prompts → **probe match time ≈ rc-init time**. The fixed `READINESS_TIMEOUT_MS = 4000ms` (an assumed dev-box budget, flagged "tune from measured latency" back in 05.1) is exceeded whenever rc init is heavy. The spike-005 heavy-init driver proves dormant Start AND restart cross the 4000ms wall **together** (sleep4 → both time out; sleep3 → both match ~3050ms). Most likely operator trigger: the restart test changed cwd to a project dir whose per-directory init (direnv / conda / nvm-from-.nvmrc / p10k) pushed rc latency past 4s, while the earlier dormant-Start successes were in a fast (home) dir. **Blind spot:** the operator's real rc-init latency was not measured (no machine access) — the fix MUST be re-verified on the operator's actual setup.
- **GAP-12-B fix DIRECTION (not applied):** raise `READINESS_TIMEOUT_MS` + idle-extend-on-progress, **with a mandatory hard absolute ceiling** (typescript-reviewer flagged this as load-bearing: without an absolute cap, a chatty-but-never-ready shell would never time out). Optional: retry the marker once. Build the DEBT-02 regression test from the spike-005 heavy-init driver (it reproduces the real timing) + mandatory human re-verify on the operator's machine.
- **GAP-12-C VERDICT — mostly DENIED as described + one residual swallow CONFIRMED:** `updateProfile` runs the CR-01 `isValidCwd` guard (pty-manager.ts:950) and **silently ignores a non-absolute/non-existent cwd, keeping the prior valid value** → the "save a bad cwd → live restart → pid -1 + notice" path is UNREACHABLE via the form. (This confirms the operator's #6 instinct: a bad path "isn't saved at all" — main drops it at save time.) Residual real bug: for the **deleted-after-save / corrupt-store** edge, `create()` returns pid -1 + "Working directory not found", but the renderer **swallows it on a live row** — `applyStatusEvent` (ITEM-4) treats any notice-bearing event as informational and keeps status `running`, and `handleRestart` has no `pid<=0` branch → a stale-"running" row on a dead PTY with an unsurfaced `errorMessage`. Fix belongs in `handleRestart`'s `pid<=0` else (flip to a visible error/not_started → IdleCard), NOT in `applyStatusEvent`.
- **GAP-12-E reframed (root identified):** the real defect is a **silent save-time cwd rejection** — typing a non-existent absolute path, Save closes with NO feedback and `updateProfile` drops it (keeps the prior cwd). The form's `validateSessionForm` only hints on FORMAT (non-absolute), so a format-valid-but-nonexistent path gets nothing. Fix direction: surface the save-time outcome (e.g. "that folder doesn't exist — kept the previous directory") so a dropped cwd is never silent.

**Refined fix scope for `/gsd-plan-phase 12 --gaps`:** GAP-12-B (probe latency budget — raise + idle-extend + hard ceiling, spike-005 regression test) · GAP-12-C (residual swallow — `handleRestart` pid<=0 surfaces the error visibly) · GAP-12-E (no silent cwd drop — surface the save-time rejection). All three re-verified live (DEBT-02), `nyquist` flips only at the next re-gate.

---

## Re-Gate 2 Result (12-10 round 2) — 2026-06-16: **QUALIFIED FAIL**

Round-2 fixes landed (12-08 dual-deadline readiness budget; 12-09 renderer GAP-12-C/E surfaces) and the automated chain was GREEN (tsc 0 / scoped lint clean / unit 469 / smoke 15-15 / `test:integration` proving old-4000ms fails / new injects @5056ms / never-ready hits 15003ms ceiling — `12-VALIDATION.md §Re-Gate 2`). Operator ran the BLOCKING human-verify on their own machine. Verdict: **QUALIFIED FAIL — `nyquist_compliant` stays `false`; all 3 round-2 gaps reopened.** The automated GREEN once again did NOT reproduce the live failures — the DEBT-02 blind spot biting a second time.

### Operator verdict (verbatim)
| Item | Result | Operator words |
|------|--------|----------------|
| 1 · GAP-12-B (restart auto-runs the new command) | ❌ FAIL | "the tiem failed, the rest working fine" |
| 2 · GAP-12-C (failed restart surfaces visibly) | ❌ FAIL | "nothing happend, after i start it just returned to home" |
| 3 · GAP-12-E (invalid cwd at Save → inline notice, no silent close) | ❌ FAIL (wrong logic) | "wrong interface logic - the restart window popup first. The logic is that if the path is wrong, user can not press save, on click save, the check must detect that path is invalid, display the inline reminder, rather than letting user continue to click save" |

### Reopened gaps (round 3) — code-confirmed where noted
| Gap | Status | Sev | Root cause (this round) | Fix direction |
|-----|--------|-----|-------------------------|---------------|
| GAP-12-B | REOPENED (still) | high | The 12-08 dual-deadline budget (8s idle-extend + 15s hard ceiling) STILL times out on the operator's REAL machine. The round-1 diagnosis explicitly flagged "real rc-init latency unmeasured — must re-verify on the operator's setup" — and it now fails there. The synthetic `test:integration` (injects @5056ms) does NOT reproduce the operator's timing. Likely: a **silent gap > 8s** during their rc init (idle timer fires mid-init even though the shell is still working but emitting no bytes), OR total rc-init > 15s hard ceiling, OR the idle-extend isn't re-arming on their byte pattern. **Unknown without their real byte-timeline.** | **DEBUG-FIRST on the operator's machine.** Build an instrumented diagnostic that logs the actual probe byte-timeline + where/why the deadline fires on THEIR shell. Only then tune (longer idle window / raise ceiling / progress-on-any-data vs progress-on-newline / a restart-time prompt-nudge). Do NOT guess the numbers again. |
| GAP-12-C | REOPENED | high | 12-09 fixed `handleRestart`'s pid<=0 (live→failed-restart). But `handleStart` (dormant→Start, SessionManager.tsx:259-278) has **NO pid<=0 handling at all** (the comment claims it clears stale ptyPid; the code has no else). Operator said "after I **start** it … returned to home" → likely the dormant→Start path the 12-09 fix never touched. Also: main drops a bad cwd at save (`updateProfile` isValidCwd), so a later spawn may use the prior VALID cwd and succeed silently (nothing to surface). Exact path ambiguous. | **DEBUG + clarify the exact repro.** Reproduce a genuine missing-cwd spawn on BOTH Start and Restart; make the failed spawn land a VISIBLE error (IdleCard + "Working directory not found") on whichever path the user acted — fix `handleStart`'s pid<=0 to match `handleRestart`, and confirm the row doesn't fall back to the welcome/home view. |
| GAP-12-E | REOPENED (wrong logic) | high | **CONFIRMED precedence bug.** `handleSaveProfile` (SessionManager.tsx:416) calls `setRestartPromptId(promptId)` **synchronously**, BEFORE the async drop-check (lines 401-412, which awaits `listSessions` then sets the drop notice) resolves. So when the cwd was dropped AND launch fields changed on a running session, the "Restart to apply?" prompt pops FIRST and the drop notice queues behind it (the code comment even admits "the prompt still queues behind it"). Operator's directive: an invalid path must BLOCK the save — show the inline reminder, keep the modal open, and NOT show the restart prompt. | Move `setRestartPromptId` INTO the async block, AFTER the drop-check, and gate it on `notice === null`: on a drop → show reminder + keep modal open + **suppress the restart prompt entirely**; only a clean save (no drop) closes the modal and (if launch fields changed on a live session) shows the restart prompt. |

**Route:** `/gsd-debug` to root-cause GAP-12-B (instrumented build on the operator's machine — the live byte-timeline is the missing evidence) and GAP-12-C (the Start-vs-Restart error-surfacing path) → `/gsd-plan-phase 12 --gaps` (GAP-12-E's precedence fix can be planned straightaway; B/C after debug) → re-execute → **round-3 re-gate** (supersedes 12-10). `nyquist_compliant` stays `false`.

**ROOT-CAUSE UPDATE (2026-06-16, `/gsd-debug` round 3 — app-side data, see `.planning/debug/gap-12-b-restart-probe-timeout.md` §"Round 3 — APP-SIDE ROOT CAUSE"):**
- **GAP-12-C — FIXED** (commit `ba70f8f`): the unfixed `handleStart` pid<=0 path. A shared `resolveSpawnResult` reducer now surfaces a failed spawn on Start AND Restart; regression-tested; suite GREEN (474 unit). Live re-verify rides the round-3 re-gate.
- **GAP-12-B — ROOT CAUSE CORRECTED: it is NOT a latency budget.** An in-app DIAG build captured 5 cold-Dock-launch samples: the failures go QUIET at ~1.15s at an already-ready prompt with a max silent gap of only ~1.5s (far under the 8s idle), and the `\n…<nonce>` match never comes — a bigger timeout changes nothing. The one-shot readiness marker (`: <nonce>\r`), typed-ahead before a cold/heavy rc finishes, is LOST (zsh doesn't redraw it onto a matchable line on the cold zle init); warm spawns redraw it and match. The two prior rounds tuned the wrong failure mode (synthetic slow-but-matching rc). **Fix = marker RE-SEND** (re-write the same-nonce `:` no-op while unsettled, bounded by the hard ceiling; once the shell is at a ready prompt a re-send matches cleanly) + KEEP idle-extend; build the DEBT-02 regression from a MARKER-LOSS repro, not the sleep-heavy driver; remove the DIAG (commit `58bd829`) when the fix lands.
- **Remaining for `/gsd-plan-phase 12 --gaps`:** GAP-12-B (marker re-send) + GAP-12-E (precedence) → execute → round-3 re-gate (BLOCKING operator human-verify, cold Dock launch). `nyquist_compliant` stays `false`.

---

## RE-GATE 3 VERDICT (2026-06-20, BLOCKING cold-Dock-launch human-verify — plan 12-13): QUALIFIED FAIL

`nyquist_compliant` stays **false**; Phase 12 does NOT ship; routes to round 4.

Round-3 fixes landed (12-11 marker RE-SEND + DIAG removal + marker-loss regression; 12-12 GAP-12-E precedence) and the automated floor was GREEN (tsc 0 / scoped lint clean / unit 56 files–480 tests / marker-loss regression `(a) one-shot fail · (b) re-send match@48ms · (c) never-ready hard@302ms` / heavy-init regression GREEN / `npm run package` PACKAGED-CLEAN — DIAG absent from the bundled `app.asar`). Operator ran the BLOCKING cold-Dock-launch human-verify (`sudo purge` → cold Dock launch). Verdict: **QUALIFIED FAIL** — GAP-12-B's core works live but leaks the probe marker; GAP-12-C passes; GAP-12-E needs a redesign. The hardest root cause (cold marker-LOSS) is now CONFIRMED FIXED live — the auto-run works cold.

### Operator verdict (verbatim)

| Item | Verdict | Operator's words |
|------|---------|------------------|
| 1 · GAP-12-B (restart/start auto-runs the new command, cold) | ⚠️ PASS-core + NEW visual defect | "11, yes it worked, but there are two line printed echo Hello … `: __JW_READY_41f631b67097a7bd__` (printed ×2) … echo Hello   that was not expected." |
| 2 · GAP-12-C (failed spawn surfaces visibly) | ✅ PASS + design-Q answered | "2, work, but when the repo is alive but folder was removed, what should be done" |
| 3 · GAP-12-E (invalid path blocks Save) | ❌ FAIL (redesign) | "3, not working ideally, use inline live detection, this revert the previous design decision, but is considered the better option" |

### Round-4 scope (reopened / new / closed)

| Gap | Status | Sev | Finding | Fix direction |
|-----|--------|-----|---------|---------------|
| GAP-12-B-2 (marker echo leak) | **NEW** | high | The marker RE-SEND fixed the cold auto-run (GAP-12-B core CONFIRMED working live), but the re-sent `: <nonce>` markers are now VISIBLE: the cold shell, once awake, echoes every queued marker and the probe's withhold/scrub-until-match only suppressed the matching line, leaking the rest (operator saw `: __JW_READY_41f631b67097a7bd__` ×2 before the command ran). Violates the invisible-probe contract (V7). NOT a security leak (random nonce, no sensitive data) — a fidelity/cleanliness defect. | Scrub ALL nonce-bearing echo lines from the withheld buffer before flush (not just up to the first match) so no `__JW_READY_*` line ever reaches the terminal, on cold OR warm spawns. Re-verify on a cold Dock launch. |
| GAP-12-C | **CLOSED — PASS + decision** | — | Failed spawn now surfaces visibly on Start AND Restart (operator confirmed live). Operator's design question — "live session, working folder removed from disk under it" — **DECIDED 2026-06-20: leave it to the shell (no special handling)**, matching the real-terminal-fidelity Core Value; the GAP-12-C boundary (surface spawn-time failures) is the right scope. | No code. Decision recorded; do NOT add a live-session cwd monitor/watcher. |
| GAP-12-E-2 (live inline cwd detection) | **REOPENED — redesign** | high | The 12-12 precedence fix (block Save on a save-time drop, inline reminder after click) works but the operator judges it not ideal: an invalid path should be flagged LIVE as the user types, not only after clicking Save. **Operator directive 2026-06-20 — intentional reversal of the prior "main is sole validator / renderer format-only / no live existence check / EXPECTED_API_KEYS stays 20" decision, endorsed as the better option.** | Add a read-only main IPC (e.g. `pathExists(path)`) → **EXPECTED_API_KEYS 20 → 21** (security.guard updated in lockstep); renderer debounced live-check while typing the cwd → red inline reminder + disable Save when the absolute path does not exist. main stays validator of record (new IPC is read-only; CR-01 `isValidCwd` at spawn unchanged). The 12-12 precedence/block-on-drop stays as the fallback. |

**Route:** `/gsd-plan-phase 12 --gaps` (round 4 — GAP-12-B-2 marker-echo scrub + GAP-12-E-2 live cwd detection w/ new read-only bridge key; GAP-12-C closed) → execute → **round-4 re-gate** (BLOCKING cold-Dock-launch human-verify, supersedes 12-13). `nyquist_compliant` stays `false`.
