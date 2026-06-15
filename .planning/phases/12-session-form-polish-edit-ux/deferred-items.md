# Phase 12 — Deferred Items (out-of-scope discoveries)

## pty-resize.smoke — CORRECTED: parallel-load flake, NOT a real failure

- **Discovered during:** 12-03 Task 2 (full-smoke gate run, 2026-06-15)
- **Spec:** `tests/smoke/pty-resize.smoke.test.ts` (`tput cols` resize round-trip; SC3 terminal fidelity)
- **CORRECTION (orchestrator, 2026-06-15):** the 12-03 SUMMARY/this file originally recorded this
  as "fails ISOLATED... not a parallel-load flake." That is **wrong**. Run in isolation it
  **PASSES**: `npx wdio run wdio.conf.ts --spec tests/smoke/pty-resize.smoke.test.ts` →
  `1 passing (2.2s)` ("reports a new column count via tput cols within 1s of a window resize").
  It only fails under the **full parallel smoke suite** — the same documented parallel-load timing
  flake class as `session-edit.smoke` and `startup-command.smoke` (which also pass 3/3 isolated).
- **Terminal fidelity (Core Value) is INTACT.** Confirmed two ways: (1) the live resize→SIGWINCH→
  `tput cols` round-trip passes solo; (2) Phase 12 changed ZERO resize-path code — `terminal-area.css`
  (which owns every `.term-mount`/`.viewport-stack`/`.xterm` sizing rule) is byte-untouched; the
  Wave-2 `terminal.css`→`form.css` extraction moved only modal/form rules, and `index.tsx` imports
  `terminal-area.css` AFTER `form.css` so no cascade regression.
- **Route:** NOT a fidelity gap. This is the known wdio parallel-load smoke flake — a test-harness
  isolation/timing issue, candidate for serializing the flaky smoke specs or raising their settle
  budget in a test-infra follow-up. Does not block Phase 12.

## Code-review deferrals (Phase 12 — 12-REVIEW.md)

The Phase-12 code review found 0 critical, 5 warning, 3 info. Five were fixed in-phase
(WR-01/WR-02/WR-03/IN-01/IN-03). Three are deferred by orchestrator decision:

### WR-04 → Phase 14 / DEBT-02 (lifecycle re-verify) — `SessionManager.tsx` confirmClose stale snapshot

- `confirmClose` reads the `isConfiguredLive` row from the render-time `sessions` snapshot; a
  `onPtyStatus` event firing between opening the Remove-confirm modal and clicking confirm could
  evaluate `isConfiguredLive` against a stale status.
- **Impact: benign (NO data loss).** The reviewer confirmed `ptyStop` on an already-dead PID is a
  no-op (fire-and-forget); the only effect is an optimistic `not_started` flip racing the
  `applyStatusEvent` that already handles the exit correctly.
- **Why deferred, not auto-fixed:** this is Phase-06.1 lifecycle code. Project STATE governance
  (DEBT-02 blocker) requires that the 06.1 lifecycle fixes be redone with tests that exercise the
  real failure/edge paths AND gated on a **mandatory human re-verify in the running app** — because
  automated-green has previously masked broken lifecycle fixes here. Silently patching it in a
  form-polish phase would repeat that exact failure mode. The suggested fix (read `row` inside the
  `setSessions` functional updater, drop the `sessions` dep) should be applied under the Phase-14
  protocol.

### WR-05 → pre-existing harness debt — `tests/ui-lab/surfaces.ts` idle-card "Stop" surface

- The `idle-card` ui-lab surface opens the context menu and clicks "Stop", which Phase 11 removed
  (menu is now Edit / Start / Remove / Delete), so the surface is always `SkipSurface`-skipped and
  the dormant IdleCard visual is never captured.
- Already logged in Phase 11 STATE ("idle-card SKIPPED — pre-existing harness limitation"). Unrelated
  to the Phase-12 session form. Fix (route via "Remove" to reach `not_started`) is a harness-only
  change; carry as ui-lab harness debt.

### IN-02 → Phase 13 — proactive `SessionManager.tsx` split

- `SessionManager.tsx` is at ~795 lines (one under the 800-line hard rule). Phase 13 adds more
  form-adjacent code and will breach it. Extract the `confirmClose`/`handleCloseRequest`/
  `handleDeleteRequest`/`cancelClose` group (~59 lines) into a `session-lifecycle-actions.ts` helper
  at the start of Phase 13 (same pattern as `session-add.ts`/`session-close.ts`). NB: this overlaps
  WR-04's surface, so do the WR-04 lifecycle fix and the IN-02 extraction together in Phase 14/13.

## 12-06 deferred (out of scope)

- `npm run lint` reports 12 pre-existing errors in `.planning/spikes/*.cjs`
  (require()-style imports + unused vars in 001/002/003 spike scripts). These are
  NOT introduced by 12-06 and are unrelated to the renderer/main source. Scoped lint
  of all 12-06-touched files (SessionManager.tsx, RestartApplyPrompt.tsx,
  session-restart-prompt.ts, session-lifecycle-actions.ts + tests) is GREEN.
