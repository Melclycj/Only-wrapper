---
phase: 10-sidebar-visual-polish
plan: 07
subsystem: renderer
tags: [term-09, agent-state, amber, gap-10-d, gap-closure, claude, debug-first, mount-race]

# Dependency graph
requires:
  - phase: 10-06
    provides: "GAP-10-D blocker routing + screenshot-2 frame description (the reproduction target) + the hypothesis (recognizer frame-shape) that this plan had to confirm against the real frame"
  - phase: 06.1-04
    provides: "decideAgentTick settle-independent fast path + classify() recognizer + the agent-state-replay oracle this plan extends"
provides:
  - "The captured REAL claude --rc Web Search permission-prompt frame (.planning/spikes/003-live-amber-repro/capture-claude-websearch.jsonl) — the screenshot-2 reproduction, real PTY bytes, not synthetic"
  - "Evidence-based diagnosis DISPROVING the 10-06 hypothesis: classify()/decideAgentTick are CORRECT on the real frame; the broken link is the SessionView agentRunning GATE (a create()/mount race)"
  - "The GAP-10-D code fix: agentGateOpen() seeds the gate from the authoritative running status; SessionView takes a `running` prop; offline RED→GREEN regression locks it"
affects: [10-10-human-gate, phase-10-close, nyquist-gate, UI-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Debug-first gap-closure: REPRODUCE the real frame deterministically (bounded autonomous node-pty + @xterm/headless driver) BEFORE fixing — the captured evidence overturned the routed hypothesis (recognizer was fine; the bug was the gate)"
    - "Mount/subscribe race: a status broadcast emitted SYNCHRONOUSLY in main during create() is missed by a renderer subscription that binds post-mount — seed the dependent local state from the authoritative prop the renderer already holds, don't rely on catching the raced event"
    - "Offline oracle blind spot: a test that calls classify() directly bypasses the SessionView gate, so a gate race is invisible to it — the regression must exercise the gate precondition (agentGateOpen), not just the recognizer"

key-files:
  created:
    - ".planning/spikes/003-live-amber-repro/README.md"
    - ".planning/spikes/003-live-amber-repro/capture-claude-websearch.jsonl"
    - ".planning/spikes/003-live-amber-repro/drive-claude-websearch.cjs"
  modified:
    - "src/renderer/agent-tick.ts"
    - "src/renderer/SessionView.tsx"
    - "src/renderer/SessionManager.tsx"
    - "src/renderer/__tests__/agent-tick.test.ts"
    - "src/shared/__tests__/agent-state-replay.test.ts"

key-decisions:
  - "The 10-06 hypothesis (tail-anchored recognizer fails on the frame) is DISPROVEN by the captured frame: classify() returns 'waiting' on the real Web Search prompt — the diagnosis followed the evidence to the agentRunning gate instead of restating the routed cause"
  - "Smallest-fix discipline: closed ONLY the diagnosed link (the gate seeding) via a pure agentGateOpen helper + one new `running` prop; did NOT touch classify() regexes, the region window, decideAgentTick, or the keep-alive xterm mount"
  - "Live amber confirmation is owned by the 10-10 BLOCKING human gate (the plan's own verification section): only a real agent process at a real prompt proves the live behavior; this plan delivers the captured frame + the evidence-based fix + the offline RED→GREEN lock"
  - "The dev trace seam (window.__AGENT_TRACE) is KEPT but permanently dev-gated (INERT in production, lint+tsc clean) so 10-10's operator can confirm the gate hypothesis from the running app if needed"

patterns-established:
  - "Bounded autonomous TUI capture: spawn the real CLI under node-pty + tee into @xterm/headless@5.5.0 (same viewportLines() as production), script the input to a permission gate, hold for a deterministic settle, then Esc+Ctrl-C CANCEL (never approve the real side effect) + hard MAX_MS backstop"

requirements-completed: []  # UI-02 stays OPEN — live amber confirmation is the 10-10 human gate's to grant

# Gap-closure resolution (machine-readable)
gap_resolved: GAP-10-D
gap_root_cause: "SessionView agentRunning gate never opened for a first-launch session: main broadcasts the spawn 'running' status synchronously inside create() (pty-manager setStatus) BEFORE the SessionView mounts and binds onPtyStatus, so the event is missed and the per-tick classify() never runs"
gap_fix: "agentGateOpen(runningProp, sawRunningEvent) — the gate opens from the authoritative running prop (SessionManager row.status, seeded from the spawn return) OR a live 'running' event; SessionView takes a `running` prop read via runningRef (no mount re-bind)"
gap_hypothesis_disproven: "10-06 routed 'recognizer frame-shape' as the likely cause; the captured frame proves classify() returns 'waiting' — the recognizer was never the broken link"
live_confirmation_owner: 10-10-human-gate

# Metrics
duration: ~40min
completed: 2026-06-11
task_count: 2
file_count: 8
---

# Phase 10 Plan 07: GAP-10-D Diagnosis + Fix — Live Amber Gate Race Summary

**The S1 blocker (live amber "Waiting for you" never fired at a real `claude --rc` Web Search permission prompt) is DIAGNOSED against the captured real frame and FIXED at the one broken link. The 10-06 hypothesis was wrong: the recognizer `classify()` reads the real frame as `waiting` perfectly — the bug was the SessionView `agentRunning` gate never opening because main broadcasts the spawn's `running` status synchronously inside `create()` before the SessionView's `onPtyStatus` subscription binds. The gate now seeds from the authoritative running status the renderer already holds. RED→GREEN regression proven offline; live confirmation is the 10-10 human gate's.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-06-11
- **Tasks:** 2 (Task 1 capture+diagnose, Task 2 TDD fix)
- **Files:** 3 created (spike-003 dir) + 5 modified

## Task 1 — Reproduce + Diagnose (commit c14c28c)

**Autonomous capture (no operator action needed).** The spike-002 recorder forwards stdin only when `process.stdin.isTTY` (false in an agent subprocess), so a thin bounded driver (`drive-claude-websearch.cjs`) reuses the SAME mechanism: spawns `claude --rc` under a real `node-pty`, tees bytes into the SAME `@xterm/headless@5.5.0` + the SAME `viewportLines()` shape production uses, scripts a prompt that forces a Web Search tool call, detects the permission prompt, holds ~3s for a deterministic settle, then **Esc + Ctrl-C to CANCEL** (never approves a real search) with a hard `MAX_MS` backstop. Run from a fresh trusted temp cwd so Web Search is NOT pre-approved and the gate fires.

**Captured the genuine screenshot-2 frame** into `capture-claude-websearch.jsonl` (full viewport, COLS=120):

```
 Tool use
   Web Search("is-odd npm package latest version 2026", only allowing domains: npmjs.com)
   Claude wants to search the web for: is-odd npm package latest version 2026
 Do you want to proceed?
 ❯ 1. Yes
   2. Yes, and don't ask again for Web Search commands in /private/tmp/jw-amber-repro.2BTNsY
   3. No
 Esc to cancel · Tab to amend
```

**Per-link trace (evidence-anchored):**

| Link | Verdict on the REAL frame | Evidence |
|------|---------------------------|----------|
| `viewportLines()` | OK — surfaces the full menu + footer (input box NOT below it) | capture `fullViewport` |
| `classify()` | **OK — returns `waiting`** | recorder logged `verdict:"WAITING" sig:[numbered_menu, claude_footer]`; re-checked against production regexes (last-4 region fires both). **Disproves the 10-06 recognizer hypothesis.** |
| `decideAgentTick()` | OK — emits `waiting` after 3 ticks (static AND churning footer) | offline trace |
| **`agentRunning` gate** | **BROKEN — never opened** | `pty-manager.ts:388` `setStatus(id,'running')` runs synchronously in `create()` BEFORE SessionView binds `onPtyStatus` → the event is missed → gate shut → classify() never runs. Row badge is blue/running correctly (SessionManager seeds it from the spawn return), but the SessionView's local gate stays false forever. |

**Diagnosis:** the single broken link is the SessionView `agentRunning` gate (a classic mount/subscribe race), NOT the recognizer. Written to `.planning/spikes/003-live-amber-repro/README.md`. A dev-only `window.__AGENT_TRACE` seam was added to `SessionView.tsx` `agentTick` (INERT in production) to let 10-10's operator confirm the gate hypothesis from the running app.

## Task 2 — Fix + Regression (TDD, commit efed57f)

**Smallest fix at the diagnosed link:**
- New pure `agentGateOpen(runningProp, sawRunningEvent) = runningProp || sawRunningEvent` in `agent-tick.ts`.
- `SessionView` takes a `running` prop (the authoritative `row.status === 'running'` SessionManager already holds), read via `runningRef` so the keep-alive mount effect (keyed on `id`) never re-binds. The tick gates on `agentGateOpen(runningRef.current, sawRunningEvent)` instead of the event-only local flag.
- `SessionManager` passes `running={s.status === 'running'}`.
- Leaving 'running' flips `sawRunningEvent` false AND SessionManager flips the prop → the gate closes on dormant/exited (D-12 false-positive guard intact).

**RED→GREEN evidence (proven by reverting the helper to the old event-only semantics):**
- `agent-tick.test.ts` GAP-10-D repro: `expect(agentGateOpen(true, false)).toBe(true)` — **FAILS** against the old event-only gate (the live blue-stays-blue defect), **PASSES** with the fix. Verified by temporarily restoring `return sawRunningEvent` (1 failed) then the fix (7 passed).
- `agent-state-replay.test.ts` extended: reconstructs the REAL captured Web Search frame via `@xterm/headless` and asserts production `classify()` reads it `waiting` (recognizer anti-regression — the frame is now in the oracle corpus).

**No false-positive regression — all existing detection assertions stay GREEN:**
- spike-002 oracle: `waitingCount === 1`, `freeCount === 10`, the per-settle FREE sweep (❯ caret still not a signal).
- the 4 `decideAgentTick` fast-path cases (churning footer / transient debounce / Thinking-never-waiting / settled-shell-free).
- `agent-state.test.ts` unchanged.

## Verification

| Gate | Result |
|------|--------|
| `npx vitest run` (full suite) | **370/370 PASS** across 42 files (365 baseline + 5 new) |
| plan Task-2 verify set (replay + agent-tick + agent-state) | 32/32 PASS |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint` (all modified files) | clean (0 errors, 0 warnings) |
| console in production agent path | only the `window.__AGENT_TRACE`-gated trace (no unconditional console.*) |
| RED→GREEN | confirmed by reverting `agentGateOpen` to event-only (1 failed) → fix (green) |

Live amber confirmation in the running app is **deferred to plan 10-10's BLOCKING human gate** (the plan's own `<verification>`): only a real agent process at a real prompt proves the live behavior. EXPECTED_API_KEYS unchanged (no bridge key added). Amber accent stays reserved exclusively for `waiting`.

## Deviations from Plan

**[Diagnosis followed evidence away from the routed hypothesis]** — Not an execution deviation; the plan explicitly mandated this ("The plan MUST NOT assume a root cause. … DIAGNOSE the actual broken link with evidence"). The 10-06 routing suggested the recognizer/`classify()` frame-shape was the likely cause; the captured frame DISPROVED it (classify() returns `waiting`), so the fix targets the `agentRunning` gate instead. The plan's Task-2 `<action>` listed exactly this branch ("If `agentRunning` is false at the prompt … fix the gate timing in SessionView without breaking the keep-alive xterm"), so the fix is within the plan's provisioned scope.

**[The pure RED test is the gate helper, not a classify() RED]** — The plan's behavior text said "a new test … asserts the chain yields 'waiting' — and FAILS against the current code". A classify()-level RED is impossible here because classify() was never broken (the finding). The faithful RED is the gate precondition (`agentGateOpen` against the old event-only semantics), which DOES reproduce GAP-10-D offline. The real captured frame is still encoded in the oracle (green, anti-regression) per the plan's explicit "add the screenshot-2 reproduction frame to the replay-oracle corpus".

## Known Stubs

None. The dev trace seam is intentional and dev-gated (documented in the spike README + SessionView comments); it is the diagnosis instrument 10-10 may use, not a stub.

## Self-Check: PASSED

- All 9 created/modified files verified present on disk.
- Both per-task commits verified in git history: `c14c28c` (Task 1), `efed57f` (Task 2).
