---
spike: 002
name: real-agent-frames
type: standard
validates: "Given real claude --rc / vim / ssh / a REPL run through the frame-stability recorder, when the user drives thinking→waiting, then thinking reads WORKING (frame churns) and the waiting prompt is a stable frame matching capturable WAITING signals"
verdict: VALIDATED
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
1. **First real `claude --rc` capture** (513 ticks / 51.7s, "Opus 4.8 (1M context)" Remote
   Control). 11 settle events. Frame churned **218/513 ticks (42%) across 63 working-spans** —
   confirms the gate: claude streams (churn=WORKING) then pauses (settle) repeatedly; the
   thinking periods produced no spurious settles in the long gaps (7–18s).
2. **The kill-finding:** `arrow_marker (❯)` fired on **10 of 11** settles — the idle input
   box, the splash, mid-stream pauses — because Claude Code's persistent input caret/status
   bar always contains `❯`. The synthetic only had `❯` inside the menu, so it never caught
   this. **`❯` is useless as a waiting signal in real Claude Code.**
3. **The real discriminator:** only the genuine confirmation @29.0s carried `numbered_menu`
   **and** `claude_footer` ("Esc to cancel · Tab to amend · ctrl+e to explain"). The idle
   input box carried neither.
4. **Fix + re-verify on the captured log** (`reanalyze.cjs`, no re-run): dropping
   `arrow_marker` from the decision → **11 settles → exactly 1 WAITING** (the @29s prompt),
   all 10 idle/splash/exit settles → FREE. Applied the same change to `record.cjs`; the
   synthetic still passes (menu → WAITING via menu+footer).

## Results
**VALIDATED.** Frame-stability + content classification detects the "Waiting for you"
confirmation prompt in real Claude Code with **zero false positives** on this session, once
`❯` is removed from the decision.

**Final detection algorithm (feeds Phase 6.1):**
- **Gate:** tick (~100ms) over the live xterm `term.buffer.active` viewport; FNV-1a hash the
  visible text; unchanged for **T ≈ 400–600ms** ⇒ settled, else WORKING. (Animated
  "Thinking…" churns the text ⇒ WORKING — the property the old output-silence model lacked.)
- **Classify the settled cursor-region (last ~4 non-empty lines):**
  - `claude_footer` (Esc to cancel / Tab to amend / ctrl+e) **or** `numbered_menu` (≥2 "N." lines)
    **or** `yn_bracket` **or** `trailing_question` **or** `password_prompt` ⇒ **WAITING** (amber)
  - shell prompt on the active line ⇒ **FREE**
  - otherwise ⇒ **FREE**
- **Do NOT use `❯`** as a waiting signal (ambient in Claude Code's input caret).

**Open product question for the discussion:** the *idle input box* (claude finished its turn,
cursor waiting for your next message — no footer/menu) classifies as FREE here. Whether that
"your turn to type" state should be amber, slate, or a third tier is a UX decision, not a
detection limit — the signals already distinguish it from a confirmation prompt.

