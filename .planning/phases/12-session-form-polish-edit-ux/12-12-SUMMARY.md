---
phase: 12-session-form-polish-edit-ux
plan: 12
subsystem: renderer
tags: [gap-closure, GAP-12-E, save-precedence, edit-modal, restart-prompt]
requires:
  - "src/renderer/cwd-save-outcome.ts (cwdDropNoticeFor / CWD_DROPPED_NOTICE)"
  - "src/renderer/session-restart-prompt.ts (restartPromptIdFor)"
provides:
  - "handleSaveProfile precedence fix: restart prompt gated behind the cwd-drop check"
  - "src/renderer/__tests__/save-precedence.test.ts (save-time ordering regression)"
affects:
  - "Edit Session modal save flow (UI-04, SESS-06)"
tech-stack:
  added: []
  patterns:
    - "Defer a state SET behind an async authoritative re-read so the later truth wins"
    - "Compose two pure reducers to model handler precedence in a node-env unit test"
key-files:
  created:
    - "src/renderer/__tests__/save-precedence.test.ts"
  modified:
    - "src/renderer/SessionManager.tsx"
decisions:
  - "Reused the existing pure reducers (cwdDropNoticeFor / restartPromptIdFor) — no new module, no new state/prop/IPC/bridge key"
  - "Statement move only: setRestartPromptId moved inside the async block, gated on notice === null"
metrics:
  duration: "~10 min"
  completed: "2026-06-16"
  tasks: 2
  files-changed: 2
requirements: [UI-04, SESS-06]
---

# Phase 12 Plan 12: Session Form Polish / Edit UX — GAP-12-E Precedence Fix Summary

Fixed the confirmed GAP-12-E precedence bug so an invalid/dropped cwd at Save now blocks the close, shows the inline reminder, and suppresses the restart-to-apply prompt — closing the operator's round-3 re-gate failure ("the restart window popup first").

## What Was Built

**The bug (confirmed, not re-investigated):** In `handleSaveProfile`, `setRestartPromptId(promptId)` ran SYNCHRONOUSLY in the handler tail, BEFORE the async `void (async () => { … cwdDropNoticeFor … })()` block resolved. So on a running session with a dropped cwd AND changed launch fields, the "Restart to apply?" prompt popped first and the drop notice queued behind it (the old code comment even admitted "the prompt still queues behind it").

**The fix (statement move only):**
- Deleted the synchronous `if (promptId !== null) setRestartPromptId(promptId);` from the handler tail.
- Moved it INSIDE the existing async block, after `const notice = cwdDropNoticeFor(id, fields.cwd, authoritative)`, gated on `notice === null`:
  ```ts
  if (notice === null) {
    cancelEdit();
    if (promptId !== null) setRestartPromptId(promptId);
  }
  ```
- `promptId` is still computed SYNCHRONOUSLY at the top of the handler from the PRE-save row (it must read the row before `ptyUpdateProfile`/rehydrate overwrite the launch fields); only the SET is deferred behind the drop-check so the drop wins.

**Resulting behavior:**
- DROP (invalid/dropped cwd): inline `CWD_DROPPED_NOTICE` shows, modal STAYS OPEN, restart prompt SUPPRESSED entirely (regardless of whether launch fields changed).
- CLEAN save + changed live launch fields: modal closes AND the restart-to-apply prompt shows.
- CLEAN save + no change: modal closes, no prompt.

**Regression test:** `src/renderer/__tests__/save-precedence.test.ts` models the handler's precedence by composing the two existing pure reducers (`restartPromptIdFor` for the pre-save promptId, `cwdDropNoticeFor` for the post-save notice) and asserting the gate `the prompt/close apply ONLY when notice === null`. 6 cases: drop+changed → suppress+open; drop+cwd-only → suppress+open; clean+changed-live → prompt+close; clean+no-change → close+no-prompt; clean+dormant → close+no-prompt; drop+dormant → block close. Asserts against the exported `CWD_DROPPED_NOTICE`, not a literal.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Pin save-time precedence (drop blocks + suppresses prompt) + handler fix | 05de169 | src/renderer/SessionManager.tsx, src/renderer/__tests__/save-precedence.test.ts |
| 2 | Full renderer suite green + EXPECTED_API_KEYS invariant intact | (verify-only, no code change) | — |

## Verification Evidence

Task 1 (`PRECEDENCE-OK`):
```
npx tsc --noEmit               # clean
npx eslint src/renderer/SessionManager.tsx   # clean
npx vitest run src/renderer/__tests__/save-precedence.test.ts
  Test Files  1 passed (1)   Tests  6 passed (6)
wc -l src/renderer/SessionManager.tsx → 799 (< 800)
grep -q 'notice === null' → present
```

Task 2 (`SUITE-GREEN`):
```
npx vitest run src/renderer/__tests__/
  Test Files  27 passed (27)   Tests  223 passed (223)
npx vitest run src/shared/__tests__/security.guard.test.ts
  Test Files  1 passed (1)   Tests  4 passed (4)
EXPECTED_API_KEYS count → 20 (unchanged)
```

## Deviations from Plan

None — plan executed exactly as written.

- Task 1 was tagged `tdd="true"`. The new test composes two ALREADY-CORRECT pure reducers, so it passed on first run (RED-via-reducers is satisfied; the actual defect was in the handler's wiring, which the test pins as a composition contract). The production fix (statement move) is what closes the bug; the test guards the ordering going forward. This is the expected shape for a precedence-of-existing-reducers fix and is not a deviation.
- Task 2 made no production-code change per its explicit instruction ("Do NOT modify production code in this task") — it is a regression gate confirming Task 1 broke nothing. No commit was produced for Task 2.

## Invariants Honored

- NO new contextBridge key, NO new IPC — renderer adds NO existence check; main stays the validator of record. EXPECTED_API_KEYS stays 20.
- SessionManager.tsx stays under 800 lines (799).
- Core-Value guard: renderer-only modal/state change; the xterm/PTY/fit path is untouched; terminal fidelity unregressed.
- Touched ONLY src/renderer — no overlap with 12-11's src/main marker re-send.

## Known Stubs

None.

## Next Step

NOTE: automated GREEN is NOT proof of the live fix. The cold-Dock-launch human-verify (plan 12-13) on the operator's machine is the real gate for GAP-12-E.

## Self-Check: PASSED

- FOUND: src/renderer/__tests__/save-precedence.test.ts
- FOUND: .planning/phases/12-session-form-polish-edit-ux/12-12-SUMMARY.md
- FOUND commit: 05de169
