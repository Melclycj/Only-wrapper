---
phase: 12-session-form-polish-edit-ux
plan: 08
subsystem: pty-readiness
tags: [gap-closure, GAP-12-B, DEBT-02, readiness-probe, dual-deadline, TERM-05]
requires:
  - "create() single-funnel TERM-05 readiness probe (05.1)"
  - "buildPosixProbe send-vs-match matcher (05.1 / 06-01 WR-02)"
  - "stale-timeout + stale-exit guards (06.1-04 round 2)"
provides:
  - "READINESS_IDLE_TIMEOUT_MS (8000) — extend-on-progress idle window"
  - "READINESS_HARD_TIMEOUT_MS (15000) — absolute wall-clock ceiling (LOAD-BEARING)"
  - "test:integration npm script (heavy-init real-timing regression; 12-10 depends on it)"
  - "committed GAP-12-C bad-cwd restart regression (relocated from spike-005)"
affects:
  - "src/main/pty-manager.ts create() probe block"
  - "the 12-10 BLOCKING operator re-gate (runs npm run test:integration)"
tech-stack:
  added: []
  patterns:
    - "dual-deadline budget: idle timer re-armed on progress + an absolute ceiling never reset, both routing one shared D-04 give-up closure"
    - "real-timing integration regression via a ZDOTDIR-sleep heavy-init zsh (electron-free CJS driver, opt-in)"
key-files:
  created:
    - "src/main/__tests__/pty-readiness-budget.test.ts"
    - "src/main/__tests__/pty-bad-cwd-restart.test.ts"
    - "tests/integration/readiness-probe-heavy-init.integration.test.cjs"
  modified:
    - "src/main/pty-manager.ts"
    - "src/main/__tests__/pty-readiness-revert.test.ts"
    - "src/main/__tests__/readiness-probe.test.ts"
    - "package.json"
    - "eslint.config.ts"
  deleted:
    - ".planning/spikes/005-restart-probe-timeout/gap-12-c-bad-cwd-restart.diag.test.ts.txt"
decisions:
  - "Idle window raised 4000→8000ms (contract-safe headroom: the smoke already tolerates an 8000ms command-output wait) and made extend-on-progress; hard ceiling fixed at 15000ms (typescript-reviewer LOAD-BEARING)."
  - "Retired READINESS_TIMEOUT_MS (renamed → READINESS_IDLE_TIMEOUT_MS); updated its three consumers (revert + probe suites)."
  - "Integration regression ported as an electron-free, build-step-free CJS driver under tests/ (mirrors spike-005); exempted tests/**/*.cjs from the ESM require-ban (same precedent as scripts/**/*.cjs)."
metrics:
  duration: "~10 min"
  tasks: 3
  files: 9
  completed: "2026-06-16"
---

# Phase 12 Plan 08: GAP-12-B Dual-Deadline Readiness Budget Summary

Replaced the fixed 4000ms TERM-05 readiness wall with an 8000ms extend-on-progress idle window plus a mandatory 15000ms absolute ceiling, so a stored startup command auto-runs after a heavy login-shell rc init while a never-ready shell still falls back safely — proven by a real-timing ZDOTDIR-sleep regression that fails the old code and passes the new.

## What This Plan Did

GAP-12-B was the operator's #5 re-gate failure: a saved startup command (e.g. `claude --rc`) did not auto-run after a restart-to-apply on a slow-rc machine. The diagnosis (already `diagnosed`, not re-opened here) pinned the root cause as a **latency-budget defect** — the probe `\n…<nonce>` match can only fire after the login shell finishes rc and re-prompts, and that match time ≈ the rc-init time, which exceeds the fixed 4000ms `READINESS_TIMEOUT_MS`. Because `create()` is the single spawn funnel, the same wall guillotined both the dormant-Start and the restart-respawn paths — it was never restart-specific.

The fix is a **dual-deadline budget** (the absolute ceiling was flagged LOAD-BEARING by the typescript-reviewer):

1. **IDLE window** (`READINESS_IDLE_TIMEOUT_MS = 8000`) — re-armed on every produced byte while the probe is unsettled, so a heavy-but-progressing rc is not guillotined at a fixed wall.
2. **HARD ceiling** (`READINESS_HARD_TIMEOUT_MS = 15000`) — measured from probe-arm, NEVER reset by the idle-extend logic. Without it a chatty-but-never-ready shell that streams a byte per idle window would extend forever and never inject (a latency/DoS runaway, T-12-08-01).

Both timers route through ONE shared give-up closure, so the D-04 fallback (flush the buffered bare prompt once, emit `READINESS_FAIL_NOTICE`, NEVER inject) is byte-identical on idle-expiry and hard-ceiling. The stale-timeout guard (`live.pty !== child`) no-ops a dead/replaced child on both timers; a successful match clears both. The bare-shell / `skipStartupCommand` path, `restart()`, and `updateProfile()` were untouched; a match still injects `cmd + '\r'` exactly once.

## Tasks Completed

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 | Dual-deadline readiness budget in create() | `800de51` | src/main/pty-manager.ts (+ revert/probe suites updated to the renamed/raised constants) |
| 2 | Dual-deadline unit regression + relocate bad-cwd diag stub | `f2cfb47` | pty-readiness-budget.test.ts (new), pty-bad-cwd-restart.test.ts (relocated), .txt stub deleted |
| 3 | Real-timing heavy-init integration regression (DEBT-02) | `342a3b7` | tests/integration/readiness-probe-heavy-init.integration.test.cjs, package.json (test:integration), eslint.config.ts |

## Verification Evidence (real stdout)

### Heavy-init integration regression — `npm run test:integration` (the DEBT-02 real-timing proof)

```
> just-wrapper@0.1.0 test:integration
> node tests/integration/readiness-probe-heavy-init.integration.test.cjs

━━━ GAP-12-B heavy-init readiness regression ━━━
heavy init: ZDOTDIR .zshrc `sleep 5`  |  old=4000ms  idle=8000ms  hard=15000ms
(a) CONTROL old-4000ms : matched=false at=4000ms
(b) NEW dual-deadline   : matched=true at=5059ms reason=match
(c) never-ready stream  : matched=false at=15003ms reason=hard

✓ PASS — control(old)=timeout, new=match, never-ready=hard-ceiling
exit=0
```

- **(a)** the OLD fixed-4000ms budget TIMES OUT under a sleep-5 heavy init (`matched=false at=4000ms`) — the bug is real and would FAIL against the pre-fix code.
- **(b)** the NEW dual-deadline budget MATCHES at **5059ms** (the rc re-prompts at ~5s; the idle window extended on the rc's progress bytes) — the fix injects under the same heavy init.
- **(c)** the never-producing stream hits the **15000ms** hard ceiling (`at=15003ms reason=hard`) — the LOAD-BEARING DoS guard holds.

### Full unit suite — `npm run test:unit`

```
 Test Files  53 passed (53)
      Tests  455 passed (455)
```

(Main subsuite alone — `npx vitest run src/main/__tests__/` — was 24 files / 219 tests passing, including the new `pty-readiness-budget` (4 cases: idle-extend, hard ceiling, silent, stale) + `pty-bad-cwd-restart` (3 cases) + the unchanged `pty-readiness-revert` and `readiness-probe`.)

### Type-check — `npx tsc --noEmit`

```
(no output — exit 0)
```

### Lint — `npx eslint src tests`

```
(no output — exit 0)
```

### Invariants

- `EXPECTED_API_KEYS` count = **20** (no main IPC change this plan).
- The `.txt` diag stub is gone (`test ! -f …gap-12-c-bad-cwd-restart.diag.test.ts.txt` → TXT_GONE).
- `grep -n 'READINESS_HARD_TIMEOUT_MS\|READINESS_IDLE_TIMEOUT_MS' src/main/pty-manager.ts` → both exported (lines 106, 124) and both timers armed in create() (lines 571–572).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exempted `tests/**/*.cjs` from the ESM require-ban in eslint.config.ts**
- **Found during:** Task 3
- **Issue:** The plan stated the `.cjs` "lives under tests/ (already excluded from … tsconfig)" and assumed it would lint cleanly, but the eslint flat config only exempted `scripts/**/*.cjs` from `@typescript-eslint/no-require-imports`. The new integration driver is intentionally a build-step-free CJS Node script (ports the probe matcher verbatim, spawns real shells) and legitimately uses `require()`, so `npx eslint src tests` failed with 5 require-import errors.
- **Fix:** Broadened the existing CJS-exemption block (#4) to `['scripts/**/*.cjs', 'tests/**/*.cjs']` — same rationale (a Node CJS driver, not application source). `eslint.config.ts` was not in the plan's `files_modified` list; the change is minimal and matches the plan's own assumption.
- **Files modified:** eslint.config.ts
- **Commit:** `342a3b7`

**2. [Rule 3 - Blocking] Updated `readiness-probe.test.ts` advance to the new dual-deadline timing**
- **Found during:** Task 1
- **Issue:** Renaming/retiring `READINESS_TIMEOUT_MS` broke the import in `readiness-probe.test.ts`; additionally its timeout case fired ONE byte then advanced by the old 4000ms — but under extend-on-progress that byte re-arms the idle timer, so 4000ms no longer fires the fallback.
- **Fix:** Switched the import to `READINESS_HARD_TIMEOUT_MS` and advanced past the hard ceiling (`+ 50`) so the give-up fires regardless of which deadline wins. (The same rename consumer in `pty-readiness-revert.test.ts` was likewise updated.)
- **Files modified:** src/main/__tests__/readiness-probe.test.ts, src/main/__tests__/pty-readiness-revert.test.ts
- **Commit:** `800de51`

### Test-design correction (caught by RED, not a code deviation)

The first draft of the `pty-readiness-budget.test.ts` idle-extend case advanced 5 × ~8000ms (~40000ms total), which correctly tripped the 15000ms HARD ceiling and failed the assertion — confirming the hard ceiling fires as designed. Corrected the test to advance ~12000ms (> one idle window, < the hard ceiling) before matching, which is the genuine idle-extend scenario. No production code changed; the failure validated the LOAD-BEARING ceiling.

## Threat Surface

No new network endpoints, auth paths, or schema changes. The threat register dispositions are upheld: T-12-08-01 (the hard ceiling caps a chatty-never-ready shell — proven by integration case (c)), T-12-08-03 (D-02 invisibility unchanged — no new pre-match send), T-12-08-04 (cwd path untouched — bad-cwd regression pins it). No `## Threat Flags` to report.

## Known Stubs

None. All three artifacts are committed, runnable regressions; no placeholder/mock data was introduced.

## Self-Check: PASSED

- src/main/pty-manager.ts — FOUND (constants at 106/124, timers at 571/572)
- src/main/__tests__/pty-readiness-budget.test.ts — FOUND
- src/main/__tests__/pty-bad-cwd-restart.test.ts — FOUND
- tests/integration/readiness-probe-heavy-init.integration.test.cjs — FOUND
- .planning/spikes/005-restart-probe-timeout/gap-12-c-bad-cwd-restart.diag.test.ts.txt — ABSENT (deleted, as required)
- Commits `800de51`, `f2cfb47`, `342a3b7` — all present in `git log`.
