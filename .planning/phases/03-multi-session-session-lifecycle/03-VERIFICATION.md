---
phase: 03-multi-session-session-lifecycle
verified: 2026-06-05T03:45:00Z
status: human_needed
score: 6/6
overrides_applied: 2
overrides:
  - must_have: "User can stop a running session; it stays in the list with status 'stopped' (never auto-removed) and the badge turns slate"
    reason: "D-03a revision at human-verify checkpoint: Stop is now a destructive Close behind a confirm modal (ptyClose/pty:close). PtyManager.stop() is retained + unit-tested but its UI button was removed. Restart-identity is still demonstrated on self-exited (exited/error) sessions. ROADMAP SC3 reframing accepted by user on 2026-06-04."
    accepted_by: "user (verify checkpoint 2026-06-04)"
    accepted_at: "2026-06-04T00:00:00Z"
  - must_have: "Restart keeps the existing scrollback and inserts a visible '— restarted HH:MM —' separator, then re-runs the startup command if configured"
    reason: "TERM-05 (startup command auto-run) descoped at verify checkpoint. startupCommand field is retained on SessionRecord for Phase 4/5. Restart separator and scrollback preservation are fully implemented; only the startup-command re-run on restart is deferred. ROADMAP SC5 struck-through and marked DEFERRED."
    accepted_by: "user (verify checkpoint 2026-06-04)"
    accepted_at: "2026-06-04T00:00:00Z"
human_verification:
  - test: "Keep-alive feel (SC1): Add a session, run 'while true; do echo TICK; sleep 0.5; done' in it. Add a second session and switch back and forth several times. Confirm the first session's output kept advancing while hidden and neither process died on switch."
    expected: "Both sessions remain alive; TICK count advances while session is hidden; no process death on tab switch."
    why_human: "Automated E2E (multi-session-keepalive smoke) runs against a packaged app — requires real Electron runtime. The automated test verifies the logic path; human confirms the UX feel and absence of subtle regressions."
  - test: "Current scrollback (SC2): In a session, run a full-screen TUI (htop or vim), switch away while it is on screen, switch back. Confirm no torn/blank/frozen frame."
    expected: "Buffer is current and non-blank/non-torn immediately on switch-back."
    why_human: "Visual rendering quality of the xterm.js visibility:hidden / WebGL hand-off cannot be asserted by grep or unit test."
  - test: "Restart identity (SC3 reframed): Let a session exit on its own (type 'exit'). Confirm the row shows a green 'Finished' badge and a Restart button. Click Restart. Confirm same name + icon, a visible '— restarted HH:MM —' separator with prior scrollback above it, and status returns to Running (blue)."
    expected: "logicalId unchanged; new ptyPid; scrollback preserved; separator visible; badge transitions correctly."
    why_human: "IDENT-02 restart identity is unit-proven, but the visual UX of the separator, the badge transition, and the scrollback preservation require human observation."
  - test: "Destructive Close flow (D-03a): Click Close on a running session. Confirm the DESIGN.md-styled confirm modal appears. Click Cancel — confirm the session is NOT removed. Click Close again, then Confirm — confirm the session row is permanently removed from the sidebar."
    expected: "Modal appears with appropriate copy; Cancel preserves the session; Confirm removes it permanently with no re-appearance."
    why_human: "Modal visual appearance, accessibility (Esc=cancel, focus on confirm button), and the absence of any re-add from the reconcile poll cannot be verified programmatically."
  - test: "Status badges (SC4): Watch badge transitions — running=blue, clean exit (type 'exit')=green 'Finished', non-zero exit (run 'exit 1')=derived red 'Error', never-started=slate 'Idle'. Confirm each badge color and label matches DESIGN.md status system."
    expected: "running: blue oklch(0.62 0.14 248); exited: green oklch(0.60 0.13 150); error: red oklch(0.58 0.16 25); stopped/not_started: slate oklch(0.64 0.02 260)."
    why_human: "Color rendering accuracy and label text require visual confirmation against DESIGN.md spec."
  - test: "WebGL hand-off at scale: Open 10-15 sessions and cycle through them. Confirm no 'too many WebGL contexts' console warning and the active terminal always renders correctly."
    expected: "No WebGL context exhaustion warning; every session renders cleanly on activation."
    why_human: "Chromium's ~16 WebGL context limit is a runtime constraint that cannot be asserted in unit tests. The detachWebgl/attachWebgl logic is in the code but runtime behavior at 15 sessions requires human observation."
---

# Phase 3: Multi-Session + Session Lifecycle — Verification Report

**Phase Goal:** Multiple concurrent terminal sessions can run independently; switching between them never kills a background process; and a user can stop and restart any session while its logical identity remains unchanged.
**Verified:** 2026-06-05T03:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Scope Revisions Applied

Three scope changes were directed by the user at the human-verify checkpoint (documented in 03-CONTEXT.md D-03a, 03-03-SUMMARY.md, and ROADMAP.md). Verification is against the REVISED scope, not the original plan verbatim:

1. **D-03a**: "Stop" is now a destructive Close (ptyClose/confirm modal) — not keep-as-stopped. PtyManager.stop() retained + unit-tested but its UI button removed. ROADMAP SC3 reframed accordingly.
2. **TERM-05 DEFERRED**: Startup-command auto-run descoped; startupCommand field retained on SessionRecord for Phase 4/5. ROADMAP SC5 struck-through and marked DEFERRED.
3. **Shutdown crash fix**: Guarded PtyManager.send() + detachWindow() added; regression test pty-shutdown.test.ts.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | N concurrent PTY-backed sessions run independently in a `Map<LogicalId, PtySession>` in main | VERIFIED | `PtyManager.sessions = new Map<LogicalId, PtySession>()` in pty-manager.ts:134; multiple sessions keyed by distinct LogicalIds |
| 2 | Switching between sessions never kills a background process; hidden sessions keep buffering (TERM-06) | VERIFIED | SessionView `term.write(data)` is unconditional (line 197 — no `active` guard); hidden panes use `visibility:hidden` not `display:none` (terminal.css); all SessionViews kept mounted in viewport-stack |
| 3 | Restart preserves logicalId + mints new ptyPid (IDENT-02) | VERIFIED | `restart()` calls `create({ ...record, id })` reusing the same id (pty-manager.ts:326); pty-lifecycle.test.ts asserts `second.id === first.id && second.pid !== first.pid`; 54 unit tests green |
| 4 | 5-state status machine with DESIGN.md badge colors incl. derived red error ramp (TERM-08) | VERIFIED | `deriveStatus()` exported from pty-manager.ts:107; `STATUS_STYLE` in status-colors.ts maps all 5 states to oklch values: running=`oklch(0.62 0.14 248)`, exited=`oklch(0.60 0.13 150)`, stopped/not_started=`oklch(0.64 0.02 260)`, error=`oklch(0.58 0.16 25)` |
| 5 | Destructive Close+confirm (D-03a): ptyClose kills PTY + removes SessionRecord from sidebar (13th key) | VERIFIED | `PtyManager.close(id)` at pty-manager.ts:391 kills and deletes; `ptyClose` in preload/index.ts:88; ConfirmModal.tsx and session-close.ts wired in SessionManager.tsx; EXPECTED_API_KEYS has 13 keys |
| 6 | 13-key contextBridge with security guard; node-pty in main only (TERM-05-descoped-SC3) | VERIFIED | EXPECTED_API_KEYS = 13 keys in window-config.ts:51-65; security.guard.test.ts asserts exact key set + no ipcRenderer; `npm run test:unit` = 54 passed; tsc --noEmit = 0 errors; lint = 0 errors |

**Score:** 6/6 truths verified (2 truths carry overrides for D-03a scope revision and TERM-05 deferral; both approved at human-verify checkpoint)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/pty-manager.ts` | Per-session status machine, stop/restart/close/listSessions, deriveStatus, os.homedir() default, pty:status emission | VERIFIED | All methods present and substantive; `deriveStatus` exported; `os.homedir()` fallback at line 153; `setStatus` broadcasts pty:status; `close()` for D-03a; `detachWindow()` for shutdown guard |
| `src/shared/api-types.ts` | PtyStatusPayload, 13-key ElectronAPI incl. ptyClose; PtyCreateOptions with id? | VERIFIED | PtyStatusPayload defined at line 54; ElectronAPI has all 13 methods; PtyCreateOptions has `id?: LogicalId` |
| `src/main/window-config.ts` | EXPECTED_API_KEYS — 13 keys including ptyClose | VERIFIED | 13 keys listed at lines 51-65; JSDoc updated noting 03-03 ptyClose addition |
| `src/preload/index.ts` | All 13 bridge methods wired; no raw ipcRenderer exposed | VERIFIED | All 13 methods in the typed `api` object; contextBridge.exposeInMainWorld('api', api) at line 119 |
| `src/renderer/SessionView.tsx` | Per-session xterm kept alive, WebGL-on-active, visibility:hidden hide, restart separator, NO ptyCreate | VERIFIED | attachWebgl/detachWebgl at lines 59-82; term.write unconditional at line 197; visibility via `hidden-pane` attribute; restart separator at lines 217-219 gated on hasRunBeforeRef; grep "ptyCreate" = 0 matches |
| `src/renderer/SessionManager.tsx` | Sole spawn owner (ptyCreate), listSessions, onPtyStatus subscriptions, Close+Restart handlers | VERIFIED | ptyCreate via addSession helper at line 113; listSessions at line 126; onPtyStatus subscription array at line 140; handleCloseRequest/confirmClose/handleRestart all present |
| `src/renderer/Sidebar.tsx` | Icon+name+status badge, data-session-id, Close+Restart controls, add-session button | VERIFIED | STATUS_STYLE used at line 71; data-session-id at line 85; close-session at line 130; restart-session at line 113; add-session button with data-testid at line 146 |
| `src/renderer/ConfirmModal.tsx` | DESIGN.md-styled confirm modal for Close (D-03a) | VERIFIED | role="dialog" aria-modal; Esc=cancel; auto-focus confirm; scrim click cancels; data-testid attributes present |
| `src/renderer/session-close.ts` | Pure close reducer (remove row + reselect activeId) | VERIFIED | closeSession() is pure, React/xterm-free; 4 assertions in session-close.test.ts all green |
| `src/renderer/status-colors.ts` | STATUS_STYLE — 5-state map with DESIGN.md oklch values incl. derived red | VERIFIED | All 5 states present; error=`oklch(0.58 0.16 25)` confirmed |
| `src/main/__tests__/pty-status.test.ts` | deriveStatus unit tests (6 cases) | VERIFIED | 6 tests green; covers userStopped, exitCode 0, non-zero, signal passthrough |
| `src/main/__tests__/pty-lifecycle.test.ts` | Stop grace timer, restart identity, cwd-default, platform branching | VERIFIED | 6 tests green; POSIX SIGTERM→SIGKILL, win32 bare kill(), early-exit clears timer, restart IDENT-02, os.homedir() default |
| `src/main/__tests__/pty-shutdown.test.ts` | Shutdown crash guard regression tests | VERIFIED | 3 tests green; detachWindow no-throw, destroyed-window guard, disposeAll no-throw |
| `src/renderer/__tests__/session-close.test.ts` | Destructive close reducer tests (D-03a) | VERIFIED | 5 tests green |
| `src/renderer/__tests__/session-manager.spawn.test.ts` | No-double-spawn: exactly 1 ptyCreate per add | VERIFIED | 3 tests green; asserts spy called N times for N adds |
| `src/shared/__tests__/security.guard.test.ts` | Exact 13-key bridge surface, no ipcRenderer | VERIFIED | 4 tests green; asserts EXPECTED_API_KEYS exact match and not.toHaveProperty('ipcRenderer') |
| `tests/smoke/multi-session-keepalive.smoke.test.ts` | SC1/SC2 E2E: background printer advances while hidden | VERIFIED (code) | File exists with correct assertions; requires packaged Electron runtime for full green — human verification item |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/main/pty-manager.ts` | `SessionStatus` in types.ts | `import type { SessionStatus }` | VERIFIED | Line 20: `import type { LogicalId, SessionStatus, SessionRecord }` |
| `src/main/pty-manager.ts` | `PTY_CHANNELS.status` = 'pty:status' | `this.send(PTY_CHANNELS.status, ...)` in setStatus | VERIFIED | Lines 255-256; `setStatus` called from create(), onExit |
| `src/preload/index.ts` | EXPECTED_API_KEYS via exact-key-set assertion | security.guard.test.ts | VERIFIED | 13 keys match; `npm run test:unit` 54 passed |
| `src/renderer/SessionManager.tsx` | `window.api.ptyCreate / onPtyStatus / listSessions` | sole spawn owner + subscriptions | VERIFIED | ptyCreate via addSession (line 113); onPtyStatus array (line 140); listSessions (line 126) |
| `src/renderer/Sidebar.tsx` | `STATUS_STYLE` from status-colors.ts | status → badge accent | VERIFIED | `import { STATUS_STYLE }` at line 11; used at line 71 |
| `src/renderer/SessionView.tsx` | `window.api.ptyStop / ptyRestart` | NOT in SessionView (owned by SessionManager) | VERIFIED | grep ptyStop/ptyRestart in SessionView.tsx = 0 — correctly owned by SessionManager |
| `src/renderer/SessionManager.tsx` | `window.api.ptyClose` | confirmClose() → ptyClose(id) | VERIFIED | Line 73: `window.api.ptyClose(id)` |
| `src/renderer/SessionManager.tsx` | `window.api.ptyRestart` | handleRestart → ptyRestart(id) | VERIFIED | Line 91: `await window.api.ptyRestart(id)` |
| `src/main/index.ts` | `ptyManager.detachWindow()` before `disposeAll()` | win.on('closed') handler | VERIFIED | Lines 33-34: detachWindow() then disposeAll() |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SessionManager.tsx` | `sessions: SessionRecord[]` | `window.api.listSessions()` on mount; `onPtyStatus` subscriptions; addSession | FLOWING — listSessions returns real records from PtyManager.sessions Map; onPtyStatus pushes real status transitions from pty:status IPC | VERIFIED |
| `Sidebar.tsx` | `sessions`, `status` per row | Props from SessionManager | FLOWING — receives live sessions[] + status transitions; STATUS_STYLE maps to real oklch values | VERIFIED |
| `SessionView.tsx` | xterm buffer | `window.api.onPtyData(id, ...)` term.write | FLOWING — real PTY bytes from node-pty via pty:data IPC; unconditional write while hidden | VERIFIED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `deriveStatus` correct mappings | `npm run test:unit 2>&1 \| grep pty-status` | 6 passed | PASS |
| Restart identity (same id, new pid) | `npm run test:unit 2>&1 \| grep pty-lifecycle` | 6 passed | PASS |
| Security guard (13-key surface) | `npm run test:unit 2>&1 \| grep security.guard` | 4 passed | PASS |
| No-double-spawn invariant | `npm run test:unit 2>&1 \| grep session-manager.spawn` | 3 passed | PASS |
| Destructive close reducer | `npm run test:unit 2>&1 \| grep session-close` | 5 passed | PASS |
| Shutdown crash guard | `npm run test:unit 2>&1 \| grep pty-shutdown` | 3 passed | PASS |
| TypeScript clean | `npx tsc --noEmit` | 0 errors | PASS |
| Lint clean | `npm run lint` | 0 errors | PASS |
| Full unit suite | `npm run test:unit` | 54 passed (11 files) | PASS |

### Probe Execution

Step 7c skipped — no probe-*.sh files found in scripts/; SUMMARY.md does not declare probes. Unit test suite run above serves as the equivalent automated gate.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TERM-06 | 03-01, 03-02 | Session remains alive on tab switch | SATISFIED | SessionView keeps xterm mounted + buffers; visibility:hidden hide; multi-session-keepalive E2E |
| TERM-07 | 03-01, 03-02, 03-03 | Stop and restart preserving logicalId | SATISFIED (D-03a) | stop() retained + unit-tested; close() for D-03a UI; restart() IDENT-02 proven by pty-lifecycle.test.ts; Restart control wired in Sidebar |
| TERM-08 | 03-01, 03-02, 03-03 | 5-state status machine | SATISFIED | deriveStatus + STATUS_STYLE + onPtyStatus subscriptions; all 5 states handled; badge updates on every transition |
| TERM-05 | — | Startup command auto-run | DEFERRED | Descoped from Phase 3 at verify checkpoint; startupCommand field retained on SessionRecord; REQUIREMENTS.md updated to DEFERRED |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | Scanned all 9 phase-modified files for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/return null/hardcoded empty arrays | — | No debt markers, no stubs, no hardcoded empty data in render paths |

**Specific checks performed:**
- `grep TBD/FIXME/XXX` across all phase files: 0 matches
- `grep "return null"` in components: ConfirmModal returns null when `!open` — this is correct controlled behavior, not a stub
- `term.write` in SessionView: unconditional (no active guard) — correct, not a stub
- `sessions` initial state `[]` in SessionManager: populated immediately by listSessions() on mount — not a stub

### Human Verification Required

The automated test suite (54 unit tests green, tsc clean, lint clean) covers all mechanically verifiable truths. The following items require the running app because they test visual quality, runtime rendering, and interaction feel:

#### 1. Keep-alive feel + no process death (SC1)

**Test:** Add a session, run `while true; do echo TICK; sleep 0.5; done` in it. Add a second session and switch back and forth several times.
**Expected:** First session's TICK count advances while hidden; neither process dies on switch.
**Why human:** The multi-session-keepalive E2E smoke exists and has the correct assertions, but running it requires a packaged Electron app with WDIO. The automated test validates the code path; human confirms the UX feel.

#### 2. Current scrollback, no frozen frame (SC2)

**Test:** Run a full-screen TUI (htop or vim) in a session, switch away, switch back.
**Expected:** Buffer is current and non-blank/non-torn immediately on switch-back.
**Why human:** Visual rendering quality of the xterm.js visibility:hidden / WebGL hand-off cannot be asserted programmatically.

#### 3. Restart identity UX (SC3 reframed)

**Test:** Let a session exit naturally (type `exit`). Confirm green "Finished" badge and Restart button appear. Click Restart. Confirm same name + icon, visible `— restarted HH:MM —` separator with prior scrollback above it, status returns to Running blue.
**Expected:** IDENT-02 preserved in UI; separator visible; scrollback continuous.
**Why human:** The unit test proves the identity invariant; the visual UX requires observation.

#### 4. Destructive Close flow (D-03a)

**Test:** Click Close on a running session. Confirm DESIGN.md-styled modal appears. Click Cancel — session persists. Click Close again, click Confirm — session row permanently removed from sidebar.
**Expected:** Modal is visually correct (warm surface, red Confirm, neutral Cancel, Esc=cancel); row never re-appears.
**Why human:** Modal visual appearance and accessibility behavior are not verifiable by grep or unit tests.

#### 5. Status badge colors (SC4)

**Test:** Trigger all five status transitions and observe badge colors and labels.
**Expected:** running=blue `oklch(0.62 0.14 248)`, exited=green `oklch(0.60 0.13 150)`, error=red `oklch(0.58 0.16 25)`, stopped/not_started=slate `oklch(0.64 0.02 260)`.
**Why human:** Color rendering accuracy requires visual comparison against DESIGN.md spec.

#### 6. WebGL hand-off at scale

**Test:** Open 10-15 sessions and cycle through them.
**Expected:** No "too many WebGL contexts" console warning; every active terminal renders.
**Why human:** The Chromium ~16-context limit is a runtime constraint; unit tests cannot simulate 15 concurrent WebGL contexts.

### Gaps Summary

No gaps — all must-haves are VERIFIED or carry documented approved overrides. The two overrides reflect user-directed scope revisions at the human-verify checkpoint (D-03a destructive Close replacing keep-as-stopped Stop; TERM-05 startup-command auto-run deferred). Both are tracked in ROADMAP.md, REQUIREMENTS.md, and 03-CONTEXT.md.

The `human_needed` status reflects 6 items that require the running Electron app to verify visual quality, rendering behavior, and interaction feel — a standard outcome for any phase delivering UI components.

---

_Verified: 2026-06-05T03:45:00Z_
_Verifier: Claude (gsd-verifier)_
