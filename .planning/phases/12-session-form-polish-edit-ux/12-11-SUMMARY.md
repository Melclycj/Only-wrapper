---
phase: 12-session-form-polish-edit-ux
plan: 11
subsystem: main-process / readiness-probe
tags: [GAP-12-B, marker-resend, readiness-probe, gap-closure, DEBT-02]
requires:
  - "create() probe gate dual-deadline (12-08): READINESS_IDLE_TIMEOUT_MS / READINESS_HARD_TIMEOUT_MS"
  - "buildPosixProbe seam (05.1): unchanged marker `: <nonce>\\r` + matcher `\\n[^\\n]*<nonce>`"
provides:
  - "READINESS_RESEND_INTERVAL_MS (exported) — the bounded marker re-send cadence (1300ms)"
  - "bounded marker re-send in create()'s probe gate: re-writes the SAME marker while !settled, capped by the existing hard ceiling"
  - "tests/integration/readiness-marker-loss.integration.test.cjs — the DEBT-02 marker-loss regression"
affects:
  - "dormant Start + Restart-to-apply auto-run of the saved startupCommand (both funnel through create())"
tech-stack:
  added: []
  patterns:
    - "marker RE-SEND (retry) bounded by an absolute hard ceiling that is never reset — idempotent because the marker is a stateless POSIX `:` no-op (D-01)"
key-files:
  created:
    - tests/integration/readiness-marker-loss.integration.test.cjs
  modified:
    - src/main/pty-manager.ts
    - package.json
decisions:
  - "GAP-12-B root cause is one-shot MARKER-LOSS on cold zle init (NOT a latency budget) — fix = marker RE-SEND, budget numbers UNCHANGED"
  - "the re-send is bounded by the EXISTING READINESS_HARD_TIMEOUT_MS (never reset by a re-send) so a chatty/never-ready shell still takes the D-04 give-up — no retry storm"
  - "the DEBT-02 regression models marker-loss with a FAKE pty (swallow the first marker, ready prompt, no redraw) — NOT the spike-005 sleep-heavy slow-but-matching driver"
metrics:
  duration: ~15min
  tasks: 3
  files: 3
  completed: "2026-06-16"
---

# Phase 12 Plan 11: GAP-12-B marker RE-SEND Summary

Fixed GAP-12-B with the confirmed app-side root cause — a one-shot readiness-marker loss on cold/heavy login-shell rc init — by re-sending the same-nonce POSIX no-op marker on a bounded interval until a ready prompt echoes it onto a matchable line, removed the temporary DIAG instrumentation, and added a marker-loss regression that proves the re-send recovers a lost marker while a never-ready shell still hits the hard ceiling.

## What This Plan Did

The operator's #5 re-gate failed live twice while two prior rounds tuned a timeout budget. Round-3 in-app DIAG sampling proved the real failure: the typed-ahead `: <nonce>\r` marker is **lost** — zsh does not redraw it onto a matchable `\n…<nonce>` line on cold zle init, so the matcher never fires even though the shell reaches a ready prompt at ~1.15s (the failing samples go quiet at ~1.15s with a max silent gap of ~1.5s, far under the 8s idle window). A bigger timeout changes nothing.

The fix is **marker re-send**: while the probe is unsettled, re-write the SAME marker every `READINESS_RESEND_INTERVAL_MS` (1300ms). The marker is a stateless POSIX `:` no-op, so re-sending the same nonce is idempotent. Once the shell is at a ready prompt, a re-sent marker echoes on a produced `\n`-preceded line and the unchanged matcher fires → the saved startup command auto-runs. Both the dormant Start path and Restart-to-apply funnel through `create()`, so both are fixed.

### Task 1 — Remove the temporary DIAG instrumentation (commit c541015)
Deleted all five `// DIAG GAP-12-B` bracketed blocks from `create()`'s probe gate: the `JW_PROBE_DIAG` env gate, the `diag` state object + `diagWrite()` `~/jw-probe-timeline.jsonl` appender, the per-chunk timeline push, the match-branch `diagMatchMs` capture + its `diagWrite('match')`, and the `diag.t0` capture before `child.write(probe.marker)`. The `os`/`fs`/`path` imports were retained (still used by `os.homedir`, `fs.statSync`, `path.isAbsolute` outside DIAG). The dual-deadline budget, give-up path, and stale-timeout guard are byte-unchanged. Zero `DIAG GAP-12-B` / `JW_PROBE_DIAG` / `jw-probe-timeline` residue remains anywhere in `src/`. The probe path returns to no-disk-write (T-12-11-02).

### Task 2 — Bounded marker re-send (commit 382eae5)
Added exported `READINESS_RESEND_INTERVAL_MS = 1300` co-located with the existing budget constants, with a doc comment citing the marker-loss root cause. Widened the timer holder to `{ idle?, hard?, resend? }` and clear `resend` in `clearTimers()` (cleared on match AND give-up, so it can never outlive the probe). After the initial marker write and idle/hard arming, armed a `setInterval` that, while `!settled` AND the child is still the session's live pty (`this.sessions.get(id)?.pty === child` — the same stale-timeout guard), re-writes the SAME `probe.marker` (marker only, no cmd, no new nonce). The re-send is **bounded by the existing hard ceiling** — it never resets `READINESS_HARD_TIMEOUT_MS`, so a chatty/never-ready shell still hits the hard wall and takes the unchanged D-04 give-up (worst-case re-sends ≈ ⌈hard/interval⌉ ≈ 11, no retry storm). The matcher, inject-once, D-02 (pre-match buffering), and the give-up flush are unchanged.

### Task 3 — DEBT-02 marker-loss regression (commit 520d9f7)
Created `tests/integration/readiness-marker-loss.integration.test.cjs` — electron-free, opt-in, with `buildPosixProbe` ported verbatim. It models the marker-loss class with a **fake pty** (not a real slow shell): the first typed-ahead marker is swallowed, then ~400 bytes of non-matching cold rc output land and the fake goes quiet at a ready prompt with no `\n…<nonce>` line; a re-sent marker is echoed on a produced line so the matcher fires. Asserts: (a) the one-shot probe does NOT match the marker-loss fake (idle-times-out at a ready shell — proves the bug class); (b) the re-send probe DOES match (proves the fix recovers); (c) a never-ready fake still hits the hard ceiling (re-send bounded — DoS guard). Budgets are scaled (resend < idle < hard ratio preserved) and everything is driven off emitted bytes + the probe outcome — no `sleep`/`waitForTimeout` oracle. Wired `test:integration:marker-loss` + had `test:integration` run both regressions.

## Test Evidence

```
# Task 1 verify
DIAG-GONE                       # tsc clean + zero DIAG residue in pty-manager.ts

# Task 2 verify
Test Files  3 passed (3) / Tests 24 passed (24)   # readiness-budget + revert + probe
RESEND-WIRED                    # tsc + eslint clean, READINESS_RESEND_INTERVAL_MS + resend slot present

# Task 3 verify
(a) ONE-SHOT (no resend) : matched=false at=128ms reason=idle
(b) RE-SEND              : matched=true  at=48ms  reason=match
(c) never-ready fake     : matched=false at=302ms reason=hard
✓ PASS — one-shot=no-match, re-send=match, never-ready=hard-ceiling
MARKER-LOSS-GREEN

# Overall
TSC-OK
eslint src tests → exit 0
Test Files  55 passed (55) / Tests 474 passed (474)
EXPECTED_API_KEYS = 20 (unchanged) — security.guard.test.ts 4 passed
grep DIAG GAP-12-B|JW_PROBE_DIAG|jw-probe-timeline in src/ → 0 hits
```

## Deviations from Plan

None — plan executed exactly as written.

The plan's verify command for Task 2 referenced `pty-readiness-revert.test.ts` and `readiness-probe.test.ts` (alongside `pty-readiness-budget.test.ts`); all three exist and stayed green.

## Known Stubs

None.

## Deferred Issues

- `src/main/pty-manager.ts` is 1387 lines, over the 800-line guideline. This is **pre-existing** (the file was already ~1357 lines before this plan; this gap-closure added ~30 lines). Splitting it is a large architectural refactor (Rule 4) out of scope for a confined gap-closure plan and unrelated to GAP-12-B. Logged for a future maintenance pass, not fixed here.

## Threat Surface Notes

No new security surface. The re-send writes only the existing `: <nonce>\r` POSIX no-op (T-12-11-01: no shell-state change, idempotent). No new contextBridge key (EXPECTED_API_KEYS stays 20). The DIAG removal eliminated the only probe-path disk write (`~/jw-probe-timeline.jsonl`), returning the probe to no-disk-write (T-12-11-02). The first match still disposes the listener and injects exactly once (T-12-11-03); the re-send is guarded against a replaced/dead child (T-12-11-04). No new dependency (T-12-11-05).

## Live-Verify Note

Automated GREEN is NOT proof of the live fix — the DEBT-02 blind spot bit twice (synthetic tests passed while the operator's real machine failed). The cold-Dock-launch human-verify (12-13: sudo purge → cold launch) is the real gate for GAP-12-B.

## Self-Check: PASSED

- All created files exist (marker-loss regression, SUMMARY).
- All 3 task commits exist (c541015, 382eae5, 520d9f7).
