# Phase 7: Terminal Search + Scrollback Config - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 7-Terminal Search + Scrollback Config
**Areas discussed:** Search bar capabilities, Search keybinding & fidelity, Scrollback default & bounds, Settings panel surface

---

## Search bar capabilities (TERM-10)

| Option | Description | Selected |
|--------|-------------|----------|
| Text + next/prev + count + case-sensitive | Text box + up/down + "N of M" match count + Aa case toggle; via `@xterm/addon-search` (caseSensitive + decorations). Regex/whole-word deferred. | ✓ |
| Minimal: text + next/prev | Input box + next/prev only, no count, no toggles. | |
| Full: + regex + whole-word | Add regex + whole-word toggles on top of the recommended tier. | |

**User's choice:** Text + next/prev + match count + case-sensitive (recommended).
**Notes:** Regex and whole-word explicitly held back to keep the search bar light; SearchAddon supports them so they can be added later without rework.

---

## Search keybinding & terminal fidelity (TERM-10)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse chord channel — Cmd+F/Ctrl+F | Cmd+F (mac) / Ctrl+F (win) via main-side `before-input-event` → `matchSwitchKey`, new `{ kind:'search' }` intent over `'session:switch'`; zero new bridge key. macOS Cmd+F never enters PTY; Windows Ctrl+F intercepted main-side (same tradeoff as Ctrl+1-9). | ✓ |
| Literal Ctrl+F on both platforms | Strictly per roadmap wording, Ctrl+F on mac too — but steals readline/vim/emacs `forward-char`, conflicting with terminal fidelity. | |

**User's choice:** Reuse the existing chord channel — Cmd+F (mac) / Ctrl+F (win), zero new bridge key (recommended).
**Notes:** Decision driven by the Core Value (real terminal fidelity). Mirrors the Clear-chord precedent (D-13). Esc-to-dismiss + no-interference-when-closed locked by SC3.

---

## Scrollback default & bounds (TERM-11)

| Option | Description | Selected |
|--------|-------------|----------|
| Default 5000, range 1000–50000 | Midpoint of roadmap's 3000 example and current hardcoded 10000; cap prevents multi-session memory blow-up; no "unlimited". | ✓ (value) |
| Default 3000, range 1000–20000 | Roadmap SC2 example value, more conservative memory. | |
| Default 10000, range 1000–50000 | Keep current hardcoded value as default, just make it configurable. | |
| *(User asked back)* "can this be dynamically configured?" | Open-ended question instead of a pick — answered in plain text. | ✓ (scope) |

**User's choice:** Default **5000 / range 1000–50000** (value, recommended — user did not propose another number) **+ option A: dynamic live-apply** (scope).
**Notes:** User asked whether scrollback can be dynamically configured. Answered: yes — xterm's `scrollback` option is runtime-settable (`term.options.scrollback = N`), mirroring VS Code's `terminal.integrated.scrollback`; low cost (renderer-side fan-out, no PTY/main). Caveat surfaced: decreasing the value trims existing scrollback rows on open terminals (accepted). User chose **A — dynamic live-apply to all open + new sessions** over **B — new-sessions-only (SC2 minimum)**. Live-apply satisfies and exceeds SC2; not scope creep (same capability, more thorough).

---

## Settings panel surface (TERM-11)

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar gear → lightweight Preferences modal | Gear icon in sidebar opens a Settings modal (reuses ConfirmModal / SessionEditModal / IconPicker idiom); holds scrollback now, structured as an extensible Preferences shell. | ✓ |
| App menu bar Preferences (⌘,) | App menu → Preferences… (⌘,) opens modal. Most mac-native, but weak Windows menu-bar UX + needs an Electron Menu. | |
| Minimal inline, no standalone panel | Embed directly somewhere existing (e.g. a field in the sidebar); no modal. Cheapest but not extensible, inconsistent with existing modals. | |

**User's choice:** Sidebar gear → lightweight, extensible Preferences modal (recommended).
**Notes:** Reuses the existing modal idiom; only scrollback for now but structured to grow.

---

## Claude's Discretion

- Search bar visual placement (VS Code-style top-right overlay) + styling per `.planning/DESIGN.md`.
- Search wrap-around at buffer ends (SearchAddon default wraps).
- Store-schema landing for the setting (`ui` section vs new `settings` section) and whether a new validated bridge key is needed vs reuse — under the 19-key / `security.guard` invariant (Claude leans: new `settings` section).
- Exact gear-icon placement (expanded vs collapsed rail) and Preferences modal layout.

## Deferred Ideas

- Search regex + whole-word toggles (SearchAddon supports; add later).
- Per-session scrollback override (global-only this phase).
- Search history / search-across-all-sessions (out of scope).
- "Unlimited" scrollback option (rejected — OOM risk).
- **Reviewed todos (not folded, off-scope):** folder picker (done in 06-02), Start discoverability (done in 06.1), edit-modal prefill (done in 06-02), redo 06.1 code-review criticals (separate 06.1 follow-up), 05.1 deferred code-review findings (separate 05.1 follow-up).
