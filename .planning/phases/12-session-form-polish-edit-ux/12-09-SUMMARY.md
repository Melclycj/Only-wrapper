---
phase: 12-session-form-polish-edit-ux
plan: 09
subsystem: renderer-session-form
tags: [gap-closure, GAP-12-C, GAP-12-E, UI-04, SESS-06, restart-surface, cwd-drop]
requires:
  - "handleRestart pid>0 optimistic-flip guard (12-06)"
  - "applyStatusEvent notice-informational contract (06.1-04 ITEM-4)"
  - "rehydrateProfiles listSessions re-read + mergeAuthoritativeProfiles (12-01)"
  - "SessionEditModal edit-field-notice danger ramp (12-01)"
  - "main updateProfile CR-01 isValidCwd validator of record"
provides:
  - "cwdWasDropped / cwdDropNoticeFor pure reducer + frozen CWD_DROPPED_NOTICE (GAP-12-E)"
  - "handleRestart pid<=0 dead-pid clear → visible IdleCard on a failed restart (GAP-12-C)"
  - "SessionEditModal cwdDropNotice prop (inline save-time drop notice, modal kept open)"
  - "committed session-restart-error-surface regression (relocated from spike-005)"
affects:
  - "src/renderer/SessionManager.tsx handleRestart + handleSaveProfile"
  - "src/renderer/SessionEditModal.tsx cwd-field notice precedence"
tech-stack:
  added: []
  patterns:
    - "renderer reports main's outcome (compare submitted vs persisted cwd) — never a second validator; no existence check, no new IPC"
    - "failed-respawn surfacing via an explicit pid<=0 dead-pid clear (the broadcast error wins; reducer contract untouched)"
    - "line-shedding by extracting decision logic into a pure Node-testable module + condensing comments to hold the <800-line rule"
key-files:
  created:
    - "src/renderer/cwd-save-outcome.ts"
    - "src/renderer/__tests__/cwd-save-outcome.test.ts"
    - "src/renderer/__tests__/session-restart-error-surface.test.ts"
  modified:
    - "src/renderer/SessionManager.tsx"
    - "src/renderer/SessionEditModal.tsx"
  deleted:
    - ".planning/spikes/005-restart-probe-timeout/gap-12-c-surface.diag.test.ts.txt"
decisions:
  - "GAP-12-C fix lives in handleRestart's pid<=0 else (clear the dead ptyPid), NOT in applyStatusEvent — the notice-informational contract is a pinned test invariant"
  - "GAP-12-E detection compares the submitted cwd against main's authoritative persisted cwd off the SAME listSessions re-read rehydrateProfiles already does — no new bridge key (EXPECTED_API_KEYS stays 20)"
  - "handleSaveProfile now OWNS the modal-close decision (closes on a valid save, holds open with the notice on a drop); onSaveProfile no longer calls cancelEdit unconditionally"
  - "the save-time drop notice OUTRANKS the format hint and the CR-01 errorMessage in the cwd field (freshest signal); cleared on cwd typing/cancel/next edit"
metrics:
  duration: ~25min
  tasks: 3
  files: 5
  completed: 2026-06-16
---

# Phase 12 Plan 09: Session Form Residual Renderer Gaps (GAP-12-C + GAP-12-E) Summary

Closes the two RESIDUAL renderer gaps the round-2 diagnosis confirmed: a failed restart-to-apply (`create()` pid<=0 on the deleted-after-save / corrupt-store edge) now surfaces VISIBLY as an IdleCard + notice instead of leaving a stale-`running` row stranded on a dead PTY (GAP-12-C), and a silently-dropped non-existent absolute cwd at Save now shows an inline "that folder doesn't exist — kept the previous directory" notice with the modal held OPEN instead of closing with no feedback (GAP-12-E). The renderer adds NO existence check and NO new IPC — main stays the validator of record and the renderer only reports its outcome.

## What Was Built

**GAP-12-C (handleRestart pid<=0 surface):** Added an explicit `else` to `handleRestart` — on a failed respawn (pid<=0) it clears the now-dead `ptyPid` (sets `undefined`, does NOT set `running`). The error state `create()` already broadcast over `onPtyStatus` then drives the row to a card via `resolveRowStatus`/`applyStatusEvent`, so the IdleCard + 'Working directory not found' notice surface where the user acted. The pid>0 branch is byte-identical; `applyStatusEvent`'s notice-informational contract is untouched.

**GAP-12-E (silent cwd drop):** New pure `cwd-save-outcome.ts` module — `cwdWasDropped(submitted, persisted)` (true only when a non-empty trimmed submission differs from main's persisted cwd) + `cwdDropNoticeFor(id, submitted, snapshot)` (the per-session find+compare returning the frozen `CWD_DROPPED_NOTICE` or null). `rehydrateProfiles` now returns main's authoritative `listSessions` snapshot so `handleSaveProfile` reads the post-validation persisted cwd off the SAME re-read. On a drop it sets `cwdDropNotice` and keeps the modal open; on a valid save it clears the notice and closes. `SessionEditModal` gained a `cwdDropNotice` prop rendered under the cwd field (danger ramp, outranking the format hint and the CR-01 errorMessage), cleared on cwd typing.

**Relocated surface regression:** The spike-005 `gap-12-c-surface.diag.test.ts.txt` became a committed regression (`session-restart-error-surface.test.ts`) — fixed the `CONTROST` typo, kept the two contract assertions (notice-error stays running; bare-error flips to not_started), and added the new pid<=0 card-outcome case. The `.txt` stub was deleted.

## Verification Evidence

**`npm run test:unit`** — 55 files, 469 tests PASSED:
```
 Test Files  55 passed (55)
      Tests  469 passed (469)
   Duration  1.27s
```

**`npx tsc --noEmit`** — clean (`===TSC OK===`).

**`npx eslint src tests`** — clean (no findings).

**Renderer suite** (`npx vitest run src/renderer/__tests__/`) — 26 files, 212 passed (incl. the new `cwd-save-outcome` 11 tests, the relocated `session-restart-error-surface` 3 tests, and the UNCHANGED `apply-status-event` suite).

**`security.guard`** — 4 passed (EXPECTED_API_KEYS=20, no new bridge key).

**Hard rules:** `SessionManager.tsx` = 799 lines (< 800 ✓); EXPECTED_API_KEYS array = 20 entries (✓); the `.txt` stub is gone (`test ! -f … && echo RELOCATED` → RELOCATED ✓).

## Deviations from Plan

**[Rule 3 - Blocking] SessionManager.tsx exceeded 800 lines after the GAP-12-E wiring (peaked at 859).** The new functional code + documentation pushed the file past the hard < 800-line rule. Per the plan's stated line-shedding mechanism, I (a) extracted the per-session drop lookup into `cwdDropNoticeFor` in the pure module (so the handler is a single call) and (b) condensed verbose comment blocks — both my own additions and several over-verbose pre-existing blocks (the handleRestart/boot/keyboard-switch/agent-state docstrings) — WITHOUT changing any behavior. Final: 799 lines. No logic was altered; only comment density and one extraction.

**Plan verify-grep quirk (not a deviation, recorded for the verifier):** Task 2's `<verify>` uses `grep -q "EXPECTED_API_KEYS = 20"`. The actual symbol is an exported ARRAY (`export const EXPECTED_API_KEYS = [ … ]`), not `= 20`, so that literal grep never matches. The real invariant — 20 keys + `security.guard` GREEN — was verified directly: the array has exactly 20 quoted entries and `security.guard` passes. No code change was needed.

## Known Stubs

None. No empty/placeholder data paths introduced — both gaps wire real renderer behavior to main's existing outcomes.

## Self-Check: PASSED

- `src/renderer/cwd-save-outcome.ts` — FOUND
- `src/renderer/__tests__/cwd-save-outcome.test.ts` — FOUND
- `src/renderer/__tests__/session-restart-error-surface.test.ts` — FOUND
- `.planning/spikes/005-restart-probe-timeout/gap-12-c-surface.diag.test.ts.txt` — DELETED (RELOCATED)
- Commit ba1b529 (Task 1), 151fea2 (Task 2), 4937146 (Task 3) — present in git log
