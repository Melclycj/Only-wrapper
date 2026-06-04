---
phase: 3
slug: multi-session-session-lifecycle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (unit/guard) + WebdriverIO 9 / `@wdio/electron-service` 10 (boot + multi-session E2E) |
| **Config file** | `vitest.config.ts` (unit) + `wdio.conf.ts` (E2E) — both present from Phase 1/2 |
| **Quick run command** | `npm run test:unit` (`vitest run`) |
| **Full suite command** | `npm test` (unit + WDIO smoke) |
| **Estimated runtime** | ~25 seconds unit; ~90 seconds full suite (WDIO boots Electron) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~25 seconds (unit, per-commit); ~90 seconds (full, per-wave)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | TERM-05..08 (Wave 0 RED scaffolds) | T-03-02 | RED stubs reference not-yet-built symbols; no PTY bytes asserted via logs | unit + E2E scaffold | `npm run test:unit 2>&1 \| grep -E "pty-status\|pty-lifecycle"` | ❌ W0 (this task creates them) | ⬜ pending |
| 03-01-02 | 01 | 1 | TERM-05, TERM-07, TERM-08 (bridge contract) | T-03-06 | Typed surface only; `EXPECTED_API_KEYS` is the reviewed 12-key tripwire; contract stays electron-free | unit (tsc + guard contract) | `npx tsc --noEmit && grep -E "ptyStop\|ptyRestart\|onPtyStatus\|listSessions" src/main/window-config.ts \| grep -vc '^\s*\*'` | ❌ W0 (api-types/window-config exist; new keys added here) | ⬜ pending |
| 03-01-03 | 01 | 1 | TERM-05, TERM-06, TERM-07, TERM-08 | T-03-01 / T-03-04 / T-03-05 | `id` validated against live record store; never log startupCommand/PTY bytes; grace timer cleared on exit | unit | `npm run test:unit && npx tsc --noEmit && npm run lint` | ❌ W0 (pty-status.test.ts / pty-lifecycle.test.ts created in 03-01-01) | ⬜ pending |
| 03-02-01 | 02 | 2 | TERM-05, TERM-06, TERM-07, TERM-08 (preload bridge) | T-03-06 | Preload exposes exactly the typed 12-key set; never raw ipcRenderer | unit (guard GREEN) | `npm run test:unit -- security.guard && npx tsc --noEmit` | ✅ (security.guard.test.ts exists; goes GREEN here) | ⬜ pending |
| 03-02-02 | 02 | 2 | TERM-06, TERM-08 | T-03-07 / T-03-08 | WebGL active-only (≤16 cap); renderer never logs PTY bytes | unit (tsc + lint + token assert) | `npx tsc --noEmit && npm run lint && grep -c "oklch(0.58 0.16 25)" src/renderer/status-colors.ts` | ❌ W0 (status-colors.ts / SessionView.tsx created here) | ⬜ pending |
| 03-02-03 | 02 | 2 | TERM-06, TERM-08 | T-03-06 / T-03-07 | SessionManager is sole spawn owner — exactly one ptyCreate per add (no orphan PTY) | unit (no-double-spawn spy) + E2E | `npx tsc --noEmit && npm run lint && npm test 2>&1 \| grep -E "multi-session-keepalive\|session-manager\|passing\|failing"` | ❌ W0 (SessionManager.tsx / Sidebar.tsx + session-manager.spawn.test.ts created here; multi-session-keepalive E2E from 03-01-01) | ⬜ pending |
| 03-03-01 | 03 | 3 | TERM-05, TERM-07 | T-03-01 / T-03-03 / T-03-05 | stop keeps record as 'stopped' (no auto-remove); restart orchestrated in main (one live pty/id); startupCommand not logged | E2E (startup-command GREEN) | `npx tsc --noEmit && npm run lint && npm test 2>&1 \| grep -E "startup-command\|multi-session-keepalive\|passing\|failing"` | ❌ W0 (startup-command.smoke.test.ts from 03-01-01; goes GREEN here) | ⬜ pending |
| 03-03-02 | 03 | 3 | TERM-05, TERM-06, TERM-07, TERM-08 (fidelity gate) | — | Human confirms SC1 feel / SC2 fidelity / SC3 identity / SC4 badge colors / SC5 startup visibility / WebGL hand-off | manual (human-verify) | `<human-check>` — see Manual-Only Verifications | n/a (checkpoint) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*"❌ W0" = the test/file is a Wave 0 deliverable created RED in 03-01-01; it goes GREEN as its owning task lands.*

---

## Wave 0 Requirements

All Wave 0 RED scaffolds are created by **03-01 Task 1**. They reference symbols/DOM that do not exist yet (intended RED); they go GREEN as Tasks 03-01-03, 03-02-*, 03-03-01 land.

- [ ] `src/main/__tests__/pty-status.test.ts` — pure `deriveStatus({ exitCode, userStopped })` mappings (stopped/exited/error; never reads `signal`) — SC4 / TERM-08
- [ ] `src/main/__tests__/pty-lifecycle.test.ts` — stop grace timer (Vitest fake timers + mock IPty): SIGTERM→SIGKILL after `STOP_GRACE_MS` on POSIX, bare `kill()` on win32, timer cleared when `onExit` fires first; restart keeps `logicalId` / changes `ptyPid` — SC3 / TERM-07
- [ ] `tests/smoke/multi-session-keepalive.smoke.test.ts` — 3 sessions, background printer in A keeps advancing while B active, switch back → buffer current, no blank frame — SC1/SC2 / TERM-06
- [ ] `tests/smoke/startup-command.smoke.test.ts` — WDIO calls `window.api.ptyCreate({ shell, cwd, startupCommand: 'echo STARTUP_OK' })` directly (bypassing the absent Phase-4 form), asserts `STARTUP_OK` AND the echoed command text appear in that session's xterm buffer — SC5 / TERM-05 / D-05
- [ ] `tests/smoke/helpers/xterm-driver.ts` — extend the single-pane Phase-2 driver with N-pane addressing (`sendKeysTo(id)`, `readBufferOf(id)`, `clickAddSession()`, `clickSidebarRow(id)`) keyed off `data-session-id` / `data-testid="add-session"`; keep the original single-pane helpers
- [ ] `src/main/window-config.ts` `EXPECTED_API_KEYS` + `src/shared/__tests__/security.guard.test.ts` — extend to the 4 new bridge methods (12-key surface). These files already EXIST (updated, not created)

*The new unit-test files plus the two E2E scaffolds are net-new this phase; the guard test + identity guard already exist and are extended in place.*

---

## Manual-Only Verifications

The single human-verify checkpoint is **03-03 Task 2** (blocking, no auto-advance). The *feel* + visual-fidelity facets below cannot be fully asserted by Vitest/WDIO and must be confirmed against the running app (`npm start`).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC1 keep-alive *feel* | TERM-06 | "feel" of non-destructive switching can't be asserted; E2E covers the count-advanced fact but not the UX | Open `🛋️ Parlour Claude RC` (`claude --rc`) alongside an `npm run dev` session; switch back and forth; confirm dev output kept scrolling while hidden and neither process died |
| SC2 scrollback fidelity | TERM-06 | visual "no torn/blank/frozen frame" of a full-screen TUI is a pixel-level judgment | Run `htop`/`vim` in a session, switch away while it's on screen, switch back; confirm no torn/blank frame, buffer is current |
| SC3 identity *as felt* | TERM-07 | unit/E2E prove logicalId/ptyPid; the human confirms same name+icon+scrollback+separator UX | Stop a running session → row stays as slate "Stopped"; restart → same name+icon, `— restarted HH:MM —` separator above prior scrollback, startup command re-runs |
| SC4 badge colors vs DESIGN.md | TERM-08 | oklch accent correctness is a visual match against DESIGN.md §"Status system" | Drive transitions (run → `exit` → `exit 1` → stop); confirm running=blue `oklch(0.62 0.14 248)`, exited=green `oklch(0.60 0.13 150)`, stopped/idle=slate `oklch(0.64 0.02 260)`, error=derived red `oklch(0.58 0.16 25)` |
| SC5 startup-command visibility | TERM-05 / D-05 | "typed as keystrokes, lands in shell history" is verified by up-arrow recall, not asserts | Create/restart a session with a startup command; confirm it's echoed AND recallable via Up-arrow (typed, not silently executed) |
| WebGL hand-off at ~15 sessions | D-01 / TERM-06 | GPU-context-cap behavior at scale + active-terminal-always-renders is visual; console-warning assert is partial | Open ~10–15 sessions, cycle; confirm no "too many WebGL contexts" warning and the active terminal always renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < ~25s (unit) / ~90s (full)
- [ ] `nyquist_compliant: true` set in frontmatter (flips during execution AFTER Wave 0 completes — currently false by design)

**Approval:** pending
