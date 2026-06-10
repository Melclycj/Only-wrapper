---
spike: 001
name: frame-stability-mechanism
type: standard
validates: "Given a headless xterm fed a synthetic spinner→idle PTY stream, when the viewport text is hashed on a tick, then 'working' shows continuous churn (no settle) and 'idle' shows a ≥T stable window classifiable as WAITING vs FREE"
verdict: VALIDATED
related: [002]
tags: [term-09, agent-state, detection, frame-stability, phase-06.1]
---

# Spike 001: Frame-Stability Mechanism

## What This Validates
Given a headless xterm fed a synthetic "spinner → menu → shell-prompt" PTY stream,
when the rendered viewport text is hashed on a tick interval, then a continuously
repainting frame ("working") never settles, while a stabilized frame settles and can
be classified as WAITING (prompt on screen) or FREE (no prompt / shell prompt).

This is the core question behind Phase 6's failure: the old detector triggered on
**output silence** (no PTY bytes for IDLE_MS), but agent TUIs repaint continuously so
silence never happens → status stuck blue. Frame-stability triggers on the **rendered
content settling**, which is detectable even while bytes keep flowing.

## Research / approach
- **Emulator:** `@xterm/headless@5.5.0`, pinned to match the app's `@xterm/xterm@5.5.0`
  so the recorded `buffer.active` viewport has identical semantics to the real terminal.
  `translateToString(true)` returns ANSI-interpreted, trailing-trimmed text — so patterns
  run on clean text and a blinking cursor (a render-layer concern) is naturally excluded.
- **PTY:** project `node-pty@1.1.0` — N-API, loads under plain Node (v22) without rebuild.
- **Detector:** every `TICK_MS` (100ms) read the visible viewport rows, FNV-1a hash the
  joined text; if changed → `WORKING`, reset the stable clock; if unchanged for ≥T → `SETTLED`,
  then classify the frame content.
- Production note: the real app **already holds a live xterm** in `SessionView`, so the
  production detector needs NO headless — it ticks over `term.buffer.active` directly.
  Headless is only this offline harness.

## How to Run
```bash
# synthetic, self-verifying (no claude needed):
node record.cjs -- bash "$PWD/synthetic.sh"
```
Env knobs: `TICK_MS` (100), `THRESHOLDS` ("400,600,800,1000"), `COLS`, `ROWS`, `LOG`, `MAX_MS`, `REC_CWD`.

## What to Expect
A timeline with NO settle during the spinner phase, a `WAITING` settle on the menu,
and a `FREE(shell)` settle on the shell prompt.

## Observability
Forensic JSONL at `record.jsonl`: per-tick `{hash, changed}`, `state` transitions,
and `settle` events `{threshold, stableMs, last, verdict, sig}`.

## Investigation Trail
1. **Harness build.** node-pty + headless tee; tick hash of viewport. First run failed
   (exit 127) — recorder hard-coded `cwd:HOME`; fixed to `REC_CWD || cwd()`.
2. **Run 1 (mechanism).** Spinner churned (27/59 ticks changed) → `WORKING`, zero settles.
   Menu + shell-prompt both settled. **Mechanism proven: animated "Thinking…" DOES mutate
   viewport text → never falsely idle.** (Directly answers the open question.)
3. **Finding #1 — wrong window.** Menu settled but verdicted `FREE [no-signals]`: the
   classifier scanned the last 8 *raw rows*, which were blank viewport padding (content sat
   at the top of the normal buffer). Fixed → window the last 8 *non-empty* lines.
4. **Finding #2 — stale-viewport false positive.** After the fix the shell prompt verdicted
   `WAITING` because the previous menu was still scrolled above it and a broad multi-line
   scan matched its `❯`/footer. Fixed → tight cursor-region window (last 4 non-empty lines)
   + **a shell prompt on the active line is authoritative FREE**. (Note: real `claude --rc`
   runs in the alt-screen which fully repaints, so staleness is a normal-buffer artifact;
   the active-line anchoring is a sound general rule regardless.)
5. **Run 3 (final).** Menu → `WAITING [arrow_marker, numbered_menu, claude_footer]`;
   shell prompt → `FREE(shell)`; spinner → `WORKING`. All correct.

## Results
**VALIDATED.** Frame-stability cleanly separates working (churning frame) from settled
(waiting/free), where output-silence cannot. Calibration that worked on synthetic data:
`TICK_MS=100`, stability threshold `T≈400–600ms` (400 was already unambiguous; the real
A1 tuning belongs to 002 against live claude output).

**Candidate WAITING signals (to confirm/tune in 002 with real data):**
`arrow_marker (❯)`, `numbered_menu (≥2 "N." lines)`, `claude_footer (Esc to cancel / Tab
to amend / ctrl+e)`, `trailing_question`, `yn_bracket`, `password_prompt`.
**Authoritative FREE:** a shell prompt on the active line.

**Carries into the build:** detector = tick-hash the live xterm viewport (not output
silence); classify the cursor-region of the settled frame; shell-prompt-active ⇒ FREE.
