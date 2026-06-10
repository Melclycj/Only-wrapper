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
- **Do NOT use `❯` (arrow_marker) as a waiting signal** — real Claude Code shows it persistently
  in its input caret, so it false-positives on idle/thinking (002, 10/11 settles). The real
  discriminators are the **confirmation footer** ("Esc to cancel · Tab to amend · ctrl+e") and a
  **numbered menu** (≥2 "N." lines), plus y/N, trailing-?, password for non-Claude tools.
- Stability threshold **T ≈ 400–600ms** at a ~100ms tick (validated on real claude output).
- OPEN (UX, not detection): does the *idle input box* (claude done, awaiting your next message —
  no footer/menu) go amber, slate, or a third tier? Detection already distinguishes it.
- Production detector ticks over the **live xterm `term.buffer.active`** (no headless in prod;
  headless is only the offline spike harness). `@xterm/headless` pinned to `5.5.0` to match the
  app's `@xterm/xterm@5.5.0`.
- Final WAITING-signal patterns + stability threshold T to be confirmed against real `claude --rc`
  output (002).

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | frame-stability-mechanism | standard | Spinner→idle synthetic stream: churn never settles, idle settles & classifies | ✓ VALIDATED | term-09, detection, frame-stability |
| 002 | real-agent-frames | standard | Real `claude --rc`/vim/ssh/REPL: thinking churns, waiting settles with capturable signals | ✓ VALIDATED (1/11 settles WAITING — the real confirmation; ❯ dropped) | term-09, detection, claude |
