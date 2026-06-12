---
created: 2026-06-12T03:50:00.000Z
title: Evaluate metadata-based Claude state capture (vs frame heuristic)
area: terminal
files:
  - src/shared/agent-state.ts
  - src/renderer/agent-tick.ts
  - src/renderer/SessionView.tsx
---

## Problem

At the Phase-10 gate attempt 3 (2026-06-12) the operator shared a screenshot of a
competing terminal-wrapper app that derives Claude session state from **metadata**,
not screen-frame heuristics. Its sidebar shows a "Blocked" badge plus the exact
pending action with arguments — `Wants to run WebSearch: {"query":"Sydney weather
today June 2026"}` — attributed to "Claude Code".

Our current detection (TERM-09, Phase 6.1 + 10-07) is a best-effort frame
heuristic: `classify()` recognizes prompt shapes in the rendered frame and
`decideAgentTick` debounces to the amber "Waiting for you" overlay. It works (live
confirmed at gate attempt 3) but is inherently brittle to Claude Code chrome
changes and can never say WHAT the agent is waiting on.

Metadata capture could give: exact state (blocked/working/done), the pending tool +
args for the secondary line, and faster/zero-debounce transitions.

Operator offer: "i can pull the source code for you to reference" — the reference
app's source is available on request.

## Solution

TBD — research/spike first:
1. Ask the operator for the reference app source; identify its capture mechanism
   (likely candidates: reading Claude Code session transcript JSONL under
   `~/.claude/projects/<cwd-slug>/`, hooks, MCP, or OTel events).
2. Spike: watch the transcript/metadata for a live `claude --rc` session in
   Just-Wrapper's cwd; map events → existing agent-state model
   (waiting/in-progress/finished per 6.1 D-11).
3. Design decision: metadata as PRIMARY source with frame heuristic as fallback
   (non-Claude agents like codex still need the heuristic), or metadata as
   enrichment overlay only (tool name + args on line 2).
4. Constraint: local-only (no telemetry, PROJECT.md constraint); must not couple
   the wrapper to one agent vendor — keep the agent-state seam generic.

Candidate: v1.2 milestone phase (touches the product's soul — "which agent needs
me" — so worth a proper discuss-phase, not a quick fix).
