# v2 Idea — Command Composer / "Better Shell for Agents"

> **Status: DEFERRED to v2** (operator decision 2026-06-14). Not committed — a v2 candidate
> to *evaluate whether to do*. Raised during Phase 11 (UI-03) when comparing against the
> switchboard mockup's bottom "type a command…" input. Deferred because, taken literally, it
> conflicts with the v1 Core Value (real terminal fidelity) and is currently out-of-scope
> ("Warp-style blocks" in `REQUIREMENTS.md`).

## What was requested

A fixed input line pinned to the **bottom** of the terminal area, always visible regardless
of scroll position, that **expands upward to ~7 lines** then becomes internally scrollable.
That is the Warp-style **command composer** input editor.

## Why it is NOT a v1 polish item

The v1 Core Value is **real terminal fidelity** — a session behaves *exactly* like a native
terminal; `claude --rc` / `codex` / `vim` / REPLs all work. A separate fixed composer fights
that:

- **Plain shell**: the shell already has its input line at the bottom — readline/zle owns
  line-editing (tab-complete, `Ctrl-R`, history). A second app-level box can't host that
  editing and would double / desync the input.
- **Full-screen TUI** (`claude --rc`, `codex`, `vim`, `less`, `ssh`): the program owns the
  whole **alt-screen**, including input. An app-level composer would steal keystrokes and
  break it — and these are the app's **primary** use case.
- `REQUIREMENTS.md` lists **"Warp-style blocks"** as an explicit out-of-scope exclusion.

## How Warp actually implements it (the model we'd be adopting)

1. **Blocks via shell integration** — Warp injects shell hooks (zsh `preexec`/`precmd`, bash
   `PROMPT_COMMAND`, PowerShell prompt fn) that emit **semantic-prompt markers** (OSC 133 —
   the same family iTerm2 / VS Code terminal use) around prompt / command-start / command-end
   + exit-code. That is how it knows command boundaries to build "blocks". Without shell
   integration a terminal only sees an opaque byte stream.
2. **Composer = its own input editor, NOT direct-to-PTY** — at the shell prompt, keystrokes
   go into Warp's local text editor (multi-line, highlight, autocomplete, AI); the shell's
   readline is bypassed. On Enter, Warp writes the **finished line** to the PTY. (This app
   today is the classic model: `term.onData → ptyWrite`, every keystroke straight to the PTY.)
3. **Alt-screen fallback** — when a program enters the alt-screen, Warp detects it and turns
   the composer **OFF** → classic pass-through real terminal (keys real-time to the PTY, no
   blocks). **This is Warp's own answer to "the composer breaks TUIs": only use it at the
   shell prompt; get out of the way for full-screen apps.**

## Key insight for "better shell for agents"

`claude --rc` / `codex` are themselves **full-screen TUI agents** → they run in the alt-screen
→ the composer must **step aside** for them. So a composer improves the **shell-prompt layer**
(composing `claude --rc` / `git` / `npm run dev`, starting & managing agent processes, and
making command+output+exit-code legible as blocks for an AI to consume) — **NOT the in-agent
typing experience** (that stays raw TUI). Set expectations accordingly.

## Work required (if pursued)

| # | Piece | Status in this repo |
|---|---|---|
| 1 | Shell integration / OSC 133 markers (zsh/bash + Windows pwsh/cmd/git-bash/wsl) — the foundation | ❌ net-new; cross-platform × multi-shell |
| 2 | Composer input widget (multi-line, 7-line expand-then-scroll, submit whole line to PTY; reconcile echo / line-discipline vs readline) | ❌ net-new |
| 3 | Alt-screen auto-fallback (composer OFF when a TUI takes the screen) — protects claude/codex/vim | ✅ alt-screen detection ALREADY exists (`SessionView.tsx`: `1049` / `buffer.active.type === 'alternate'`) — reusable foundation |
| 4 | (optional) Blocks: command/output grouping + folding | ❌ larger scope |
| 5 | **Redefine Core Value**: "keystroke-identical to a native terminal" → "TUI full-fidelity **+** an enhanced shell-prompt layer"; formally overturn the "Warp-blocks = out-of-scope" line in `REQUIREMENTS.md` | ⚠️ doc / vision decision |

## Recommended path

Treat as a deliberate **v2 spike**, not a polish tweak. Minimal-viability gate: prove pieces
**#1 (shell integration) + #3 (alt-screen fallback)** work together first — those are the
load-bearing foundations — then decide how far to take the composer (#2) and whether blocks
(#4) earn their keep.
