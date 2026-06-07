# Spike Manifest

## Idea
Validate the **frame-stability** agent-state detection model for TERM-09 (feeds Phase 6.1).
Phase 6 shipped detection that triggered on **output silence** (no PTY bytes for IDLE_MS) — but
agent TUIs like `claude --rc` repaint continuously, so silence never happens and the status
stays permanently blue "in-progress". The alternative: watch whether the rendered **viewport
text stops changing** (frame settles) and classify the settled frame's content as
WAITING vs FREE. Spikes capture real PTY output through a headless xterm to prove (or kill) it.

## Requirements
(Design decisions that emerged; non-negotiable for the Phase 6.1 build.)

- Detection MUST use **frame-stability** (rendered viewport text settling), NOT output silence.
- The animated "✻ Thinking…" line **counts as churn → WORKING** (validated 001) — this is the
  property the old model lacked.
- Classify only the **cursor region** of the settled frame (last ~4 non-empty lines), NOT raw
  bottom rows (blank padding) and NOT a broad scrollback scan (stale-menu false positives).
- A **shell prompt on the active line is authoritative FREE**.
- Production detector ticks over the **live xterm `term.buffer.active`** (no headless in prod;
  headless is only the offline spike harness). `@xterm/headless` pinned to `5.5.0` to match the
  app's `@xterm/xterm@5.5.0`.
- Final WAITING-signal patterns + stability threshold T to be confirmed against real `claude --rc`
  output (002).

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | frame-stability-mechanism | standard | Spinner→idle synthetic stream: churn never settles, idle settles & classifies | ✓ VALIDATED | term-09, detection, frame-stability |
| 002 | real-agent-frames | standard | Real `claude --rc`/vim/ssh/REPL: thinking churns, waiting settles with capturable signals | ⏳ PENDING (human-driven) | term-09, detection, claude |
