---
phase: 11
slug: terminal-area-polish-live-start-restart
status: complete
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Renderer-only restyle
> + UI deletion + D-04 copy escalation — zero new packages, zero new IPC. Source: 11-RESEARCH.md
> §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Unit framework** | Vitest |
| **Smoke framework** | WebdriverIO + `@wdio/electron-service` |
| **Visual harness** | ui-lab (`tests/ui-lab/`) — `ui:shots` injection preview / `ui:shots:fresh` packaged proof |
| **Type / lint** | `npx tsc --noEmit`, `eslint .` |
| **Quick run command** | `npm run test:unit && npx tsc --noEmit` |
| **Full suite command** | `npm run test` (unit + smoke) |
| **Phase gate** | `npm run test` GREEN + `npm run ui:shots:fresh` packaged capture scored vs `tests/ui-lab/DESIGN-RUBRIC.md` + BLOCKING human-verify |
| **Estimated runtime** | unit ~seconds; smoke ~minutes; packaged capture ~minutes |

---

## Sampling Rate

- **After every task commit:** `npm run test:unit` + `npx tsc --noEmit` + `eslint .` (fast loop)
- **After every plan wave:** full `npm run test` (unit + smoke)
- **Before `/gsd-verify-work`:** full suite GREEN + fresh packaged capture
- **Max feedback latency:** unit loop < ~30s
- **`nyquist_compliant` flipped TRUE 2026-06-14** on the operator BLOCKING human-verify sign-off (LIVE: framed inset-well card + Clear/Remove cluster + no-restart-anywhere + agent-busy copy; SC1 visual approved after the GAP-11-A rounds 2-3 redesign — inset floating well, tightened gutter, lightened cream, status-pills removed, cwd hint)

---

## Observable Behaviors → Evidence (the nyquist sampling map)

> Per-task IDs are assigned during planning; this behavior-level map is the validation contract
> the per-task `<automated>` blocks must satisfy.

| Behavior to validate | Requirement | Test type | Command / evidence | Sampling |
|----------------------|-------------|-----------|--------------------|----------|
| Terminal still native after framing (scroll, alt-screen, resize, restart-restore) | UI-03 (Core Value) | smoke | `app-restart-restore.smoke` + scroll/alt-screen smoke GREEN | wave merge + gate |
| No clipped last row / corner-glyph clip after the card frame | UI-03 / D-03a | visual | `ui:shots:fresh` `terminal-running` (+ new `terminal-card`) scored vs DESIGN-RUBRIC | phase gate (packaged) |
| Re-fit fires on the card inner-box change (no stale cols/rows) | UI-03 / D-03a / O-2 | smoke | `proposeDimensions()`-guarded ResizeObserver re-fit; smoke GREEN | per task commit |
| Remove → Start recycle works for every state | SESS-07 / D-02 | unit + smoke | `session-status.test.ts` (`resolveRowStatus`); `app-restart-restore.smoke` (dormant Start, NO separator) | wave merge |
| No restart affordance reachable (sidebar `↻` + menu Restart gone) | SESS-07 / D-01 | grep + smoke | grep `data-testid="restart-session"` → absent; `header-controls.smoke` asserts menu Restart absent | per task commit |
| `EXPECTED_API_KEYS` stays 20 | SESS-07 / D-01 | unit | `security.guard.test.ts` dynamic `Object.keys` assertion GREEN unchanged | per task commit |
| Agent-aware confirm copy escalates on `agentState ∈ {working, waiting}` | D-04 | unit + visual | unit assert on the body-string branch by `agentState`; ui-lab `agent-busy-confirm` capture | wave merge |
| Tokens-first (no banned literals) | UI-03 | unit | `tokens-completeness.test.ts`, `status-colors.test.ts` GREEN | per task commit |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| *(assigned during planning — each task's `<automated>` block maps to a behavior row above)* | — | — | UI-03 / SESS-07 / D-04 | unit / smoke / visual | per the map above | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The test-surface churn that must land in lockstep with the code changes (11-RESEARCH §Wave 0 Gaps):

- [ ] Rewrite/remove `tests/smoke/startup-command.smoke.test.ts` SC3 (D-05-voided restart-re-runs assertion) → recycle-without-restart model (Remove → Start re-runs the stored command via `handleStart`)
- [ ] Update `tests/smoke/header-controls.smoke.test.ts` — replace `clickMenuItem('Restart')` drives with an assertion the menu Restart item is **absent**; keep the `header-restart` absent assertion
- [ ] Add unit assert: `SessionManager` confirm body escalates by `agentState ∈ {working, waiting}` (pure string-branch test — extract the body builder if needed for testability)
- [ ] Add unit assert: a non-active `error` row's recycle path (select → IdleCard Retry) — closes O-1 edge A1
- [ ] (Recommended) Add ui-lab surfaces `terminal-card` (framed live card) + `agent-busy-confirm` (escalated modal) to `tests/ui-lab/surfaces.ts`
- [ ] grep guard (or smoke assert): `restart-session` testid absent in the packaged build

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Framed terminal card reads designed + terminal still feels native | UI-03 (Core Value) | Visual + fidelity judgment in the running app — automated capture corroborates but the operator signs off | Launch packaged app; confirm the active session is a framed, breathing card; type, run `claude --rc` / `vim`; confirm scroll/ANSI/resize unaffected |
| Remove → Start recycle is discoverable + no restart anywhere | SESS-07 | UX discoverability judgment | Remove a live session → it lands in Inactive → Start ▶ recycles it; confirm no ↻ / Restart control exists anywhere |
| Agent-busy close copy escalates LIVE | D-04 | Requires a real mid-task agent state | With `claude` mid-task (working/waiting), click Remove; confirm the confirm modal copy escalates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit loop)
- [x] `nyquist_compliant: true` set in frontmatter (only on operator BLOCKING human-verify sign-off)

**Approval:** APPROVED 2026-06-14 (operator LIVE sign-off; all 6 UAT gates PASS — see 11-HUMAN-UAT.md)
