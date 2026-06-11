---
spike: 003
name: live-amber-repro
type: debug-first
validates: "GAP-10-D (S1 blocker): live amber 'Waiting for you' never fires at a real claude --rc Web Search permission prompt — the sidebar row stays BLUE. Reproduce the REAL frame, diagnose the ONE broken link in the live chain with captured evidence (NOT an assumed root cause), fix exactly that link."
verdict: DIAGNOSED (live-confirmation owned by the 10-10 human gate)
related: [001, 002]
tags: [term-09, agent-state, gap-10-d, amber, claude, phase-10, debug-first]
---

# Spike 003: Live Amber Repro — GAP-10-D Diagnosis

## What This Is

The 2nd blocking human gate (10-06) FAILED ITEM 2: at a real `claude --rc` Web Search
permission prompt the sidebar row stayed BLUE (Running) — the amber "Waiting for you"
treatment never fired. Operator verbatim: *"i reached here, but the status is till blue.
how did you detect when to use aimber?"* (screenshot-2).

10-06 supplied a **hypothesis** (the tail-anchored `classify()`/`PROMPT_RE` recognizer
doesn't recognize the frame shape). This spike's job — per the 10-07 plan — is to
**REPRODUCE the real frame** and **DIAGNOSE the actual broken link with evidence**, and
the evidence DISPROVES the 10-06 hypothesis: `classify()` recognizes the real frame fine.

## How the Real Frame Was Captured (autonomous)

The spike-002 `record.cjs` recorder only forwards stdin when `process.stdin.isTTY` —
false inside an agent subprocess — so it can't be driven non-interactively. So a thin,
bounded driver (`drive-claude-websearch.cjs`) was written that uses the SAME mechanism:
it spawns `claude --rc` under a REAL `node-pty` and tees the bytes into the SAME
`@xterm/headless@5.5.0` emulator + the SAME `viewportLines()` (b.viewportY..+rows,
translateToString(true)) the production renderer uses. It is NOT a hand-synthesised
frame — every line in `capture-claude-websearch.jsonl` is a real PTY frame the emulator
rendered from claude's real bytes (GAP-10-D exists precisely because synthetic frames
passed while the real one failed, so a hand-written capture would poison the diagnosis).

Driving strategy (bounded, never hangs): boot → answer the fresh-cwd "trust this folder?"
gate once → send a prompt that forces a Web Search tool call → detect the permission
prompt ("Do you want to proceed?" + ❯-numbered options + "Esc to cancel · Tab to amend"
footer, requiring a Web-Search/proceed marker so the trust gate is not mistaken for it) →
hold ~3s for a deterministic settle → **Esc + Ctrl-C to CANCEL** (we never approve a real
Web Search side effect) → exit. A hard `MAX_MS` kill backstops it.

Run from a fresh trusted temp cwd (so Web Search is NOT pre-approved and the gate fires;
in the Just-wrapper repo Web Search was already pre-approved and ran with no prompt — that
is itself a finding: the gate only appears in dirs without a prior "don't ask again").

```bash
FRESH=$(mktemp -d /tmp/jw-amber-repro.XXXXXX)
REC_CWD="$FRESH" COLS=120 ROWS=40 \
  LOG="$(pwd)/.planning/spikes/003-live-amber-repro/capture-claude-websearch.jsonl" \
  PROMPT="Use the Web Search tool to find the current latest version of the npm package is-odd. You must use the Web Search tool to answer." \
  node .planning/spikes/003-live-amber-repro/drive-claude-websearch.cjs
```

## The Real Captured Frame (the screenshot-2 reproduction)

Full viewport at the moment the permission prompt is on screen (COLS=120, ROWS=40),
captured verbatim in `capture-claude-websearch.jsonl` (`websearch-prompt-detected` event,
`fullViewport`, and the `verdict:"WAITING"` settle):

```
22|──────────────────────────────────────────────────────────────────────────────────────────
23| Tool use
25|   Web Search("is-odd npm package latest version 2026", only allowing domains: npmjs.com)
26|   Claude wants to search the web for: is-odd npm package latest version 2026
28| Do you want to proceed?
29| ❯ 1. Yes
30|   2. Yes, and don't ask again for Web Search commands in /private/tmp/jw-amber-repro.2BTNsY
31|   3. No
33| Esc to cancel · Tab to amend
34-39| (blank)
```

This matches the operator's screenshot-2 structure exactly: "Do you want to proceed?",
"❯ 1. Yes / 2. Yes, and don't ask again for Web Search commands in <dir> / 3. No", footer
"Esc to cancel · Tab to amend". Below the footer the viewport is BLANK — claude's
persistent input box is NOT rendered while the permission menu is up, so the footer IS the
last non-empty line.

## Per-Link Trace of the Live Chain (with captured evidence)

The chain: `PTY data → viewportLines() → classify() → decideAgentTick → emitAgent →
handleAgentState → row.agentState → rowAgentAttr → data-agent → amber CSS`.

| # | Link | Verdict on the REAL frame | Evidence |
|---|------|---------------------------|----------|
| 1 | `viewportLines()` (the @xterm/headless read) | **OK** — surfaces the full menu + footer | `fullViewport` in the capture: rows 28-33 carry "Do you want to proceed?", the ❯-numbered options, and the footer; the input box does NOT sit below it. Same emulator + same `viewportLines()` shape as production. |
| 2 | `classify()` (the recognizer) | **OK — returns `waiting`** | The recorder's `classify()` (byte-identical to `src/shared/agent-state.ts`) logged `verdict:"WAITING"` `sig:[numbered_menu, claude_footer]` on this frame. Re-checked against the production regexes offline: the last-4-non-empty region = `❯ 1. Yes / 2. … / 3. No / Esc to cancel · Tab to amend` → `numberedMenu` matches 3, `claudeFooter` fires → `waiting`. **This DISPROVES the 10-06 hypothesis that the recognizer fails on this frame.** |
| 3 | `decideAgentTick()` (settle-independent fast path) | **OK — emits `waiting` after 3 ticks** | Offline trace of `decideAgentTick` fed the real frame both STATIC and with a CHURNING footer (the FIX-1 scenario): both reach `waitingStreak>=WAITING_TICKS(3)` at tick 2 (~200-300ms) and return `'waiting'`. The churning footer does NOT suppress it. |
| 4 | `agentRunning` gate (SessionView SEAM A) | **SUSPECT — the live break** | `agentTick` `return`s early every tick while `agentRunning === false`. `agentRunning` is flipped true ONLY by SessionView's OWN `onPtyStatus` subscription on a `status==='running'` event. But `src/main/pty-manager.ts:388` calls `setStatus(id,'running')` SYNCHRONOUSLY inside `create()` — which runs at spawn, BEFORE the SessionView mounts and binds its `onPtyStatus` handler. The renderer's ROW badge is seeded 'running' separately (SessionManager addSession sets `status:'running'` from the spawn return — `SessionManager.tsx:241/287/312`), so the badge is blue/running CORRECTLY, but the SessionView's internal `agentRunning` local never sees the raced 'running' event → stays false → `agentTick` never calls `classify()`/`decideAgentTick` → amber never fires. The SessionView code COMMENT (lines 411-416) already documents this exact race for `onPtyExit`. |
| 5 | `emitAgent → onAgentState → handleAgentState → row.agentState` | not reached | never gets a value because (4) gates it off. |
| 6 | `rowAgentAttr → data-agent → amber CSS` | proven OK by 10-05 | the CSS seam + data-agent rendering was proven by the ui-lab driven `sidebar-waiting.png` capture (10-06 rescored D-09 PASS) — the styling works; only the live DETECTION never reaches it. |

## Diagnosis (evidence-anchored, NOT the 10-06 hypothesis)

**The single broken link is the `agentRunning` gate in SessionView (link #4), NOT the
recognizer (#2) and NOT `decideAgentTick` (#3).** The recognizer + tick logic are proven
correct on the captured real frame; the failure is upstream of them: for a session that
started `claude --rc` and never restarted, the initial `'running'` status is broadcast by
main during `create()` BEFORE the SessionView's `onPtyStatus` subscription binds, so the
SessionView never opens its `agentRunning` gate and the per-tick `classify()` is never
called. The amber treatment can therefore never fire on a first-launch session — exactly
the operator's report (blue at a real permission prompt that the offline oracle classifies
as `waiting`).

**This is a classic mount/subscribe race.** The fix (Task 2) must SEED `agentRunning` from
the authoritative status the renderer already holds (SessionManager's row.status, which IS
correctly 'running'), rather than relying solely on catching the raced live event — i.e.
pass the running status down to SessionView so the gate opens for an already-running
session, while keeping the live `onPtyStatus` updates for subsequent transitions.

### Why the offline oracle never caught this

`agent-state-replay.test.ts` calls `classify()` DIRECTLY (it reconstructs frames and
classifies them) — it deliberately bypasses the SessionView mount/subscription, so the
`agentRunning` gate is never in the loop. That is correct for testing the recognizer, but
it means the gate race is invisible to it. Task 2 adds a regression test that exercises the
gate-open precondition (a fast-path emission requires the gate to be open), and the live
human gate (10-10) confirms amber fires in the running app.

## Instrumentation Seam (dev-only, INERT in production)

`SessionView.tsx` `agentTick` carries a dev-only trace guarded by
`window.__AGENT_TRACE === true` (T-10-07-02): per tick while mounted it logs
`{ agentRunning, classify, waitingStreak, lastEmitted, region }`. To collect the live
trace in the running app: open DevTools, run `window.__AGENT_TRACE = true`, drive a real
`claude --rc` to a Web Search permission prompt, and read the `[AGENT_TRACE]` lines — the
hypothesis predicts `agentRunning:false` throughout (the gate never opened). It is INERT
otherwise (no unconditional console in the shipped path; lint clean) and is removed /
permanently dev-gated before the plan completes.

## Files

- `drive-claude-websearch.cjs` — the bounded autonomous capture driver (reuses node-pty +
  @xterm/headless@5.5.0 + the production `viewportLines()` shape; never approves a real
  Web Search; Esc+Ctrl-C cancels).
- `capture-claude-websearch.jsonl` — the captured real Web Search permission-prompt frame
  stream (forensic JSONL: spawn / tick / settle / driver / exit, with `fullViewport` on the
  permission settle). The screenshot-2 reproduction that drives the Task-2 regression test.
