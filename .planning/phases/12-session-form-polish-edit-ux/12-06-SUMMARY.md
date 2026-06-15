---
phase: 12-session-form-polish-edit-ux
plan: 06
subsystem: ui
tags: [react, electron, pty, restart, lifecycle, node-pty, xterm]

# Dependency graph
requires:
  - phase: 12-04
    provides: the data-testid-driven Save button + cwd-error overlay in SessionEditModal (this plan's edits there are additive)
  - phase: 11
    provides: the RETAINED ptyRestart IPC bridge key + main's restart()/handleRestart machinery (kept un-surfaced in D-01)
  - phase: 06.1
    provides: the DEBT-02 lifecycle (respawned-once guard, stale-exit guard, applyStatusEvent notice→errorMessage path)
provides:
  - "Restart-to-apply prompt: after Save, a LIVE session whose launch fields changed offers Restart now / Later, reusing the retained ptyRestart (same logicalId, new ptyPid)"
  - "GAP-12-C surfacing: a bad-cwd restart leaves the CR-01 'Working directory not found' rejection on the row/IdleCard via the existing onPtyStatus→errorMessage path (handleRestart pid>0 guard)"
  - "IN-02 extraction: SessionManager lifecycle decision logic moved to pure session-lifecycle-actions.ts so the file stays < 800 lines"
affects: [12-07 re-gate, session-edit, lifecycle, restart]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure decision reducers (session-restart-prompt.ts / session-lifecycle-actions.ts) mirroring session-close.ts — React/xterm/electron-free, Node-env unit-tested"
    - "Dedicated controlled modal (RestartApplyPrompt.tsx) copies the ConfirmModal a11y skeleton WITHOUT generalizing ConfirmModal; constructive accent-blue primary vs destructive red"

key-files:
  created:
    - src/renderer/session-restart-prompt.ts
    - src/renderer/session-lifecycle-actions.ts
    - src/renderer/RestartApplyPrompt.tsx
    - src/renderer/__tests__/session-restart-prompt.test.ts
    - src/renderer/__tests__/session-lifecycle-actions.test.ts
  modified:
    - src/renderer/SessionManager.tsx
    - tests/smoke/session-edit.smoke.test.ts

key-decisions:
  - "Re-surfaced handleRestart with a pid>0 guard (DEBT-02 WR-02) so a failed restart (bad cwd → create() pid -1) does NOT do the optimistic running flip — it leaves the CR-01 error on the IdleCard (GAP-12-C surfacing). No new bridge key — ptyRestart reused, EXPECTED_API_KEYS stays 20."
  - "The restart-to-apply prompt is a NEW dedicated RestartApplyPrompt component (not a generalized ConfirmModal); testids restart-apply-now / restart-apply-later are additive, the primary uses the accent-blue .modal-btn-save ramp."
  - "IN-02 extraction: resolveRemoveAction + flipToDormant pulled out of confirmClose, and the prompt decision moved to restartPromptIdFor — these line-shedding moves (plus condensing comments that now duplicate the extracted modules' docs) keep SessionManager.tsx at 798 lines."

patterns-established:
  - "Pure restart-needed reducer: launchFieldsChanged (WR-05 startupCommand trim) + needsRestartPrompt (running-only) + restartPromptIdFor save-site convenience"
  - "Behavior-preserving lifecycle extraction: resolveRemoveAction reproduces confirmClose's isConfiguredLive branch byte-for-byte; flipToDormant is generic over the transient-overlay row shape"

requirements-completed: [SESS-05, SESS-06]

# Metrics
duration: 12min
completed: 2026-06-15
---

# Phase 12 Plan 06: Restart-to-Apply Prompt + CR-01 Rejection Surfacing Summary

**A post-Save "Restart to apply?" prompt re-surfaces the retained ptyRestart so a LIVE session's edited launch fields actually take effect (new ptyPid, same logicalId), and a bad working directory now surfaces "Working directory not found" where the user acted — with the SessionManager lifecycle logic extracted to pure modules to stay under 800 lines.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-15T22:02Z
- **Completed:** 2026-06-15T22:15Z
- **Tasks:** 3
- **Files created:** 5 / **Files modified:** 2

## Accomplishments
- GAP-12-B closed: editing cwd/shell/startupCommand on a running session → Save → a "Restart to apply?" prompt (Restart now / Later) reusing the retained `ptyRestart` IPC; Restart now respawns under the same logicalId with a new ptyPid and the new values take effect, Later persists without restarting.
- GAP-12-C closed (surfacing): a bad-cwd restart makes `create()` return pid -1 with the CR-01 'Working directory not found' notice already broadcast over `onPtyStatus`; `handleRestart`'s pid>0 guard skips the optimistic running flip so the error lands on the IdleCard where the user can act. Main stays the validator of record (no renderer-side cwd validation).
- IN-02 extraction: confirmClose's decision + state transforms moved to the pure `session-lifecycle-actions.ts` (`resolveRemoveAction`, `flipToDormant`); the prompt decision moved to `restartPromptIdFor`. SessionManager.tsx ends at **798 lines** (< 800).
- EXPECTED_API_KEYS stays **20** — no new bridge key (ptyRestart reused); `security.guard` GREEN.

## Task Commits

1. **Task 1: Pure restart-needed reducer + IN-02 lifecycle-action extraction** - `27f4eb9` (feat)
2. **Task 2: Wire the Restart-to-apply prompt + surface CR-01 rejection** - `758b553` (feat) + `3b232d1` (feat — flipToDormant reducer + tests, used by Task 2's confirmClose refactor)
3. **Task 3: Smoke proof — Restart-to-apply applies launch edits + Later dismisses** - `5b9d9b8` (test)

## Files Created/Modified
- `src/renderer/session-restart-prompt.ts` - PURE reducer: `launchFieldsChanged` (WR-05 startupCommand trim), `needsRestartPrompt` (running-only), `restartPromptIdFor` (save-site convenience)
- `src/renderer/session-lifecycle-actions.ts` - PURE reducers: `resolveRemoveAction` (confirmClose's isConfiguredLive branch) + `flipToDormant` (configured-remove transform)
- `src/renderer/RestartApplyPrompt.tsx` - the dedicated "Restart to apply?" controlled modal (copies ConfirmModal a11y skeleton; accent-blue primary; testids passed by the caller)
- `src/renderer/SessionManager.tsx` - re-surfaced `handleRestart` (pid>0 guard); `restartPromptId` state + `confirmRestartApply`/`dismissRestartApply`; `handleSaveProfile` computes the prompt via `restartPromptIdFor`; renders `<RestartApplyPrompt>`; confirmClose now uses the extracted pure reducers (798 lines)
- `src/renderer/__tests__/session-restart-prompt.test.ts` - 13 cases (launchFieldsChanged / needsRestartPrompt / restartPromptIdFor)
- `src/renderer/__tests__/session-lifecycle-actions.test.ts` - 8 cases (resolveRemoveAction four-branch + flipToDormant)
- `tests/smoke/session-edit.smoke.test.ts` - 2 new GAP-12-B specs: apply-via-Restart (new ptyPid, marker in buffer, stable logicalId) + Later-dismisses (ptyPid unchanged)

## Decisions Made
See `key-decisions` frontmatter. In short: reuse ptyRestart (no new bridge key), pid>0 guard for GAP-12-C, dedicated prompt component, pure-module extraction for the < 800-line discipline.

## Deviations from Plan

None - plan executed exactly as written. The plan explicitly anticipated the < 800-line pressure and authorized the IN-02 extraction + "move more of confirmClose's body into session-lifecycle-actions.ts"; this was applied as designed (`flipToDormant` added + comment condensation of blocks now documented by the extracted modules). The plan listed Task 2 files as SessionManager.tsx/SessionEditModal.tsx/form.css; SessionEditModal.tsx and form.css needed no change (12-04 already owned the Save/overlay/error-inline work), and the prompt's UI was implemented as the sanctioned "NEW dedicated prompt" (RestartApplyPrompt.tsx) rather than inline in those files.

## Issues Encountered
- **Stale package on first smoke run.** The wdio smoke runs the PACKAGED binary at `out/Just-Wrapper-darwin-*`; the first run hit the pre-change package, so the prompt never appeared (both new specs failed). Re-packaged with `npm run package`, then both GAP-12-B specs passed.
- **Known first-spawn flake.** On the first post-package run the pre-existing `renames a session LIVE` spec failed ("Sidebar row name did not update live after edit Save") — the documented session-edit parallel-load/first-spawn flake. Isolated re-runs (attempts 2 and 3) were 4/4 GREEN, clearing the 3/3 isolated bar. Both new GAP-12-B specs passed on all three runs.

## Verification Results
- `npm run test:unit`: **51 files / 448 tests GREEN** (incl. session-restart-prompt, session-lifecycle-actions, security.guard 20-keys unchanged).
- `npx tsc --noEmit`: clean.
- `npm run lint`: my touched files are GREEN (scoped eslint clean). 12 PRE-EXISTING errors remain in `.planning/spikes/*.cjs` (require()-imports / unused vars) — out of scope, logged to `deferred-items.md`.
- `npm run test:smoke` (session-edit, isolated): **4/4 GREEN** on attempts 2 & 3; the new GAP-12-B specs prove a real respawn (new ptyPid, same logicalId, startup marker in buffer) and Later-without-restart (ptyPid unchanged).
- EXPECTED_API_KEYS === **20**; SessionManager.tsx === **798 lines**.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 12-06 closes GAP-12-B + GAP-12-C (surfacing). The smoke RUN (with isolate-retry) plus the BLOCKING operator human-verify covering GAP-B (values apply on restart), GAP-C (bad-cwd rejection visible on the live restart path), and the live restart path are owned by 12-07.
- DEBT-02 lifecycle note: this re-surfaces a restart path in the Phase-06.1-governed lifecycle area — the pid>0 guard + reuse of the respawned-once/stale-exit guards were applied; 12-07's human re-verify should confirm the live restart behavior.

## Self-Check: PASSED
- All 5 created files + 2 modified files present on disk.
- All task commits present (27f4eb9, 758b553, 3b232d1, 5b9d9b8).

---
*Phase: 12-session-form-polish-edit-ux*
*Completed: 2026-06-15*
