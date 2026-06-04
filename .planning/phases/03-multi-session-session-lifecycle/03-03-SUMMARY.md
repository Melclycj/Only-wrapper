---
phase: 03-multi-session-session-lifecycle
plan: 03
subsystem: lifecycle-controls
tags: [stop, restart, close, confirm-modal, contextbridge, shutdown-guard, react, vitest, wdio]

# Dependency graph
requires:
  - phase: 03-multi-session-session-lifecycle
    plan: 02
    provides: "SessionView (controlled, restart-separator hasRunBefore seam), SessionManager (sole spawn owner, live status badges), basic DESIGN.md Sidebar, status-colors, 12-key bridge + ptyStop/ptyRestart"
provides:
  - "Restart control (TERM-07/IDENT-02): per-row Restart on non-running sessions → ptyRestart(id) → same logicalId, new ptyPid, scrollback kept with '— restarted HH:MM —' separator"
  - "Destructive Close flow (D-03a): per-row Close → DESIGN.md-styled in-app ConfirmModal → ptyClose(id) kills PTY + removes the SessionRecord + the row; reselects next session"
  - "ptyClose / pty:close bridge method (13th key) wired to PtyManager.close(id); EXPECTED_API_KEYS + security.guard.test.ts updated in lockstep"
  - "Shutdown crash guard: PtyManager.send() guards isDestroyed() on window + webContents; index.ts detachWindow() before disposeAll() — no 'Object has been destroyed' on quit while streaming"
affects: [04-session-identity-sidebar-ui, 05-persistence]

# Tech tracking
tech-stack:
  added: []  # no new packages
  patterns:
    - "Destructive action behind an in-app DESIGN.md-styled confirm modal (ConfirmModal: role=dialog, aria-modal, Esc/overlay cancel, red oklch confirm), no native OS dialog, no new IPC beyond ptyClose"
    - "Safe renderer send: a single guarded PtyManager.send() is the ONLY path PTY events take to the window; window target nulled on 'closed' before PTY disposal"
    - "Pure session-close.ts reducer (React/xterm-free) so close-removes-row + reselect-active is node-unit-testable"

key-files:
  created:
    - src/renderer/ConfirmModal.tsx
    - src/renderer/session-close.ts
    - src/renderer/__tests__/session-close.test.ts
    - src/main/__tests__/pty-shutdown.test.ts
  modified:
    - src/main/pty-manager.ts
    - src/main/index.ts
    - src/main/window-config.ts
    - src/shared/api-types.ts
    - src/shared/__tests__/security.guard.test.ts
    - src/preload/index.ts
    - src/renderer/SessionManager.tsx
    - src/renderer/Sidebar.tsx
    - src/renderer/terminal.css
  deleted:
    - tests/smoke/startup-command.smoke.test.ts

requirements-completed: [TERM-07]

# Metrics
commits: 8
status: complete

# Phase 3 Plan 03: Lifecycle Controls + Verify-Checkpoint Summary

This plan wired the per-session lifecycle CONTROLS onto the 03-02 renderer and ran the
blocking human-verify checkpoint. The checkpoint surfaced three changes the user
directed live; all are folded in here.

## Accomplishments

### Task 1 — stop/restart controls + restart separator (commit `f3cd989`)
Wired the per-row controls and the `— restarted HH:MM —` separator (hasRunBefore seam from
03-02). The startup-command pass-through originally added here was later DESCOPED (see below).

### Verify checkpoint (human-verify, blocking) — APPROVED with changes
Human confirmed against the running app: **SC1 keep-alive ✓, SC2 scrollback ✓, SC4 badge
colors ✓, WebGL hand-off ✓**, plus the two changes below. Three items were directed during
the checkpoint:

1. **Shutdown crash fixed (commit `91c2ca7`).** On quit, node-pty flushed a final onData/onExit
   into a destroyed BrowserWindow → `TypeError: Object has been destroyed`. Fixed with a guarded
   `PtyManager.send()` (checks `isDestroyed()` on window + webContents) routed for all three
   send sites, plus `detachWindow()` before `disposeAll()`. Regression: `pty-shutdown.test.ts`.

2. **Stop → destructive Close (D-03a, commits `e27b947`, `f6ccb77`).** The user revised D-03:
   stop now CLOSES + REMOVES the session behind a DESIGN.md-styled confirm modal, instead of
   keeping it as a restartable `stopped` row. New `ptyClose`/`pty:close` bridge (13th key,
   guard test in lockstep) → `PtyManager.close(id)`. The old `PtyManager.stop` + `ptyStop` are
   retained (still unit-tested) but the keep-as-stopped Stop button was removed. Restart-identity
   stays demonstrable on self-exited (exited/error) rows.

3. **Startup command (TERM-05) DESCOPED (commits `8e88a5c` then `d5b86fd`, `4ffb859`).** The
   settle-delay injection was unreliable on cold first spawn (worked on warm restart) — the
   shell-ready-detection weakness RESEARCH flagged. A MIN_DELAY floor was tried (`8e88a5c`) but
   the user judged the feature low-value and directed removal. The auto-injection + plumbing +
   E2E were removed; `SessionRecord.startupCommand` is KEPT as a persisted-profile field (Phase 4
   form sets it, Phase 5 persists it). TERM-05 marked **deferred** (not deleted) in
   ROADMAP/REQUIREMENTS/CONTEXT(D-05 REMOVED note)/VALIDATION/plan frontmatter.

## Deviations from Plan
- D-03a supersedes the STOP semantics of D-03 (user decision at verify). SC3 reframed: restart-
  identity proven via self-exited sessions; stop is now destructive Close.
- TERM-05/SC5 descoped from Phase 3 (user decision). Phase 3 delivers TERM-06/07/08.
- Plan body prose referencing TERM-05 was neutralized so the descope is consistent across artifacts.

## Verification
- `npx tsc --noEmit` clean · `npm run lint` clean
- `npm run test:unit` — 54 passed (incl. security.guard at 13 keys, session-close, pty-shutdown)
- `npm run package && npm run test:smoke` — 5 spec files passed (multi-session-keepalive +
  Phase-2 roundtrip/resize/throughput/boot; startup-command smoke removed)
- Human-verify checkpoint: APPROVED (SC1/SC2/SC4/WebGL + shutdown fix + Close flow)

## Self-Check: PASSED
