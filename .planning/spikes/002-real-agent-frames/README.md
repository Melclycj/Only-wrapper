---
spike: 002
name: real-agent-frames
type: standard
validates: "Given real claude --rc / vim / ssh / a REPL run through the frame-stability recorder, when the user drives thinking→waiting, then thinking reads WORKING (frame churns) and the waiting prompt is a stable frame matching capturable WAITING signals"
verdict: PENDING
related: [001]
tags: [term-09, agent-state, detection, claude, phase-06.1, human-driven]
---

# Spike 002: Real Agent Frames (human-driven)

## What This Validates
001 proved the mechanism on a synthetic stream. 002 proves it against the REAL thing —
`claude --rc` (and vim / ssh / a REPL) — and captures the exact on-screen content that
marks "waiting," so the Phase 6.1 classifier patterns are grounded in real output, not
assumptions. This is the kill-or-confirm spike.

## How to Run
The recorder transparently forwards stdin/stdout, so you interact with the tool normally
while it analyzes in the background. Run from a **real project directory**:

```bash
cd ~/some-project
/Users/jerry/Project/Just-wrapper/.planning/spikes/002-real-agent-frames/capture.sh claude claude --rc
```

Then:
1. Ask claude to do something that ends in a confirmation (e.g. "run git status and
   summarize", which triggers a tool-permission y/N or the numbered ❯ menu).
2. When it shows the menu / `[y/N]`, **wait ~2 seconds** (let the frame settle), then answer.
3. Repeat once or twice if you like, then **exit** (Ctrl-D / `/exit`).

Optional extra captures (each writes its own log):
```bash
capture.sh vim  vim          # alt-screen editor — should NOT read WAITING (no prompt)
capture.sh repl python3      # REPL >>> prompt
capture.sh ssh  ssh you@host # password prompt
```

## What to Expect (the hypotheses 002 tests)
- While claude is **thinking** (spinner + ticking tokens) → timeline shows **WORKING**,
  no settle (the frame keeps changing).
- When claude **stops at a prompt** → a **settle** event whose `verdict` is **WAITING**,
  with `sig` showing which patterns fired (expect `numbered_menu` / `arrow_marker` /
  `claude_footer`).
- After you answer → back to WORKING, then FREE/shell when done.
- vim idle → settles but verdict FREE (it's an editor, not an agent prompt) — confirms we
  don't false-amber non-agent TUIs.

## Investigation Trail
(to be filled after capture)

## Results
(PENDING — paste the timeline + any signal mismatches here; tune the 001 classifier patterns
and stability threshold T from the real captures.)
