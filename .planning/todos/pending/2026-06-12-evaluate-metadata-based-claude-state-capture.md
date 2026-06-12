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

Reference source provided (2026-06-12): **`~/Project/warp`** — the Warp terminal
codebase (Rust, AGPL/MIT dual-licensed). MECHANISM FULLY IDENTIFIED (2026-06-12
deep-dive, all evidence-backed):

**Warp's screenshot feature is `app/src/terminal/cli_agent_sessions/` — in-band
OSC signaling from a plugin installed INTO Claude Code, NOT transcript polling
and NOT Warp hosting the agent:**

1. Warp's `ClaudeCodePluginManager` (plugin_manager/claude.rs) installs the
   public plugin **`warp@claude-code-warp`** (marketplace repo
   `warpdotdev/claude-code-warp` on GitHub) into Claude Code via the `claude`
   CLI's own plugin system (lands under `~/.claude`).
2. The plugin hooks Claude Code lifecycle events — enum CLIAgentEventType:
   SessionStart / PromptSubmit / ToolComplete / Stop / **PermissionRequest** /
   PermissionReplied / QuestionAsked / IdlePrompt.
3. On each event the plugin emits an **OSC 777 escape sequence** into the
   terminal stream: title sentinel `warp://cli-agent`, JSON body
   `{v, agent, event, session_id, cwd, project, payload:{tool_name,
   tool_input_preview, query, summary, transcript_path, ...}}` (event/mod.rs).
4. Warp, being the terminal, intercepts the (invisible) OSC before render,
   parses it (versioned parsers; protocol negotiated via the
   `WARP_CLI_AGENT_PROTOCOL_VERSION` env var Warp exports on the PTY), and
   drives `CLIAgentSessionStatus { InProgress, Success, Blocked{message} }` —
   the "Blocked / Wants to run WebSearch: {query…}" card = PermissionRequest's
   tool_name + tool_input_preview.
5. Fallback tier exists: Codex without the rich plugin degrades to native OSC 9
   (`CLIAgentEventSource::CodexOsc9Fallback`). Gemini/OpenCode have their own
   plugins (plugin_manager/{gemini,opencode,codex}.rs).

(Warp ALSO has a first-party agent loop — `Harness::Oz`, "Warp's built-in MAA
infrastructure", crates/ai/src/agent/ — but that is a different surface from the
CLI-agent tracking above. `claude` in a Warp pane runs as a REAL CLI in a REAL
PTY; only the state signal rides the PTY stream as OSC.)

**Why this fits Just-Wrapper perfectly:** we also own the terminal (node-pty +
xterm.js). xterm.js exposes `registerOscHandler(ident, cb)` — we can intercept
OSC 777 (or our own sentinel) in the renderer, or parse in main's PTY data tap.
Claude Code supports hooks (PreToolUse/Stop/Notification) natively, so we can
either (a) reuse/install the public `warpdotdev/claude-code-warp` plugin and
speak ITS sentinel (license check first), or (b) define our own minimal hooks
config emitting our own OSC sentinel. Deterministic events, exact tool+args,
AND PermissionReplied = amber can both SET and CLEAR on events instead of frame
heuristics. Strictly better than transcript-JSONL polling (real-time, in-band,
no fs watching). Keep the TERM-09 frame heuristic as the no-plugin fallback
tier (Warp does exactly this tiering).

LICENSE NOTE: AGPL components in the Warp app code — fine to read for reference;
do not copy code into this project without a license decision. The
`warpdotdev/claude-code-warp` plugin repo's own license needs checking before
reuse.

## Solution

TBD — research/spike first:
1. Spike the OSC path end-to-end: a Claude Code hooks config (PreToolUse/Stop)
   that `printf`s an OSC 777 with a JSON body → xterm.js `registerOscHandler`
   (or main-process PTY tap) → drive the existing agentState seam. Compare with
   reusing the public warp plugin. Frame heuristic stays as fallback tier.
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
