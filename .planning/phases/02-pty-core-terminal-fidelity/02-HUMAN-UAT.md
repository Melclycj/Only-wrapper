---
status: partial
phase: 02-pty-core-terminal-fidelity
source: [02-VERIFICATION.md]
started: 2026-06-04
updated: 2026-06-04
note: User approved the Phase 2 human-verify checkpoint on automated evidence (all SC1–SC5 GREEN via E2E against the packaged app). These visual/interactive items remain available for an optional manual pass via `npm start`; the implementation is fully wired and code-verified.
---

## Current Test

[awaiting optional human testing — phase advanced on automated evidence + user approval]

## Tests

### 1. PATH parity + `claude --rc` (canonical Core Value scenario)
expected: In the app's terminal, `echo $PATH` and `which claude` / `which codex` match Terminal.app; `claude --rc` launches interactively.
result: [pending]

### 2. vim / python REPL / ssh interactive fidelity
expected: `vim` (arrows, `:q`), `python` REPL (a few lines, Ctrl+D), `ssh localhost` all behave like a native terminal; Ctrl+C kills `sleep 100`; arrow keys navigate shell history.
result: [pending]

### 3. Truecolor + htop borders + CJK/emoji cell widths (SC4 visual)
expected: a 24-bit truecolor gradient is smooth; `htop` box-drawing borders are aligned/intact; `echo "日本語 🛋️ 表示"` renders with correct cell widths (no clipping).
result: [pending]

### 4. Multi-line bracketed paste does not auto-execute (SC2 runtime)
expected: copy a 3-line snippet, paste via Cmd+V and via right-click — it does NOT run until Enter (bracketed paste / DECSET 2004); Ctrl+C still sends SIGINT.
result: [pending]

### 5. vim/ncurses reflow on window resize (SC3 visual)
expected: open `vim` or `htop`, resize the window — content reflows correctly within ~1s.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
