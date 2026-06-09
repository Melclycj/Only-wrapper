# Phase 7: Terminal Search + Scrollback Config - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Two additive features on the already-working terminal — **neither requires architecture changes**:

1. **TERM-10 — In-session search.** Pressing the find chord inside an active session opens an in-terminal search bar; the user types a query and navigates matches in that session's scrollback buffer. Escape dismisses it; when closed it never interferes with terminal input.
2. **TERM-11 — Configurable scrollback.** A global settings panel exposes a scrollback buffer size with a sensible default.

Out of bounds: per-session scrollback overrides, search-across-sessions, search history, any non-search/non-scrollback setting, PTY/lifecycle/identity changes.

</domain>

<decisions>
## Implementation Decisions

### Terminal Search (TERM-10)
- **D-01 — Search capability tier:** search bar = text input + next/previous nav + **"N of M" match count** + **case-sensitive (Aa) toggle**. Backed by `@xterm/addon-search` (`SearchAddon`) using its `caseSensitive` option + `decorations` (highlight all matches; live count via the `onDidChangeResults` event). **Regex and whole-word toggles are explicitly DEFERRED** — `SearchAddon` supports them, so they can be added later with no rework.
- **D-02 — Search keybinding rides the EXISTING global-chord channel (zero new bridge key):** **Cmd+F (macOS) / Ctrl+F (Windows)** is matched main-side in `before-input-event` → `matchSwitchKey` as a NEW `{ kind: 'search' }` `SwitchIntent` variant, dispatched over the existing `'session:switch'` channel. `EXPECTED_API_KEYS` stays at 19 (mirrors the Clear-chord precedent, D-13). The renderer's `onSwitchSession` handler branches `'search'` exactly like it branches `'clear'`, toggling the active session's search bar.
- **D-03 — Fidelity preserved (Core Value):** literal-Ctrl+F-on-both-platforms was REJECTED because on macOS it would steal `Ctrl+F` (readline forward-char / vim / emacs) from the PTY. With D-02, macOS `Cmd+F` never reaches the PTY, and Windows `Ctrl+F` is intercepted main-side before xterm/PTY — the same accepted tradeoff already in force for the `Cmd/Ctrl+1-9` switch chords. Escape dismiss + no-interference-when-closed is locked by SC3.

### Scrollback Configuration (TERM-11)
- **D-04 — Value + bounds:** global scrollback setting, **default 5000 lines, range 1000–50000, NO "unlimited" option** (unbounded would OOM across N sessions). 5000 is the midpoint between the roadmap's `3000` example and the current hardcoded `10000`. The hardcoded `scrollback: 10000` at `src/renderer/SessionView.tsx:168` becomes the global default read from settings.
- **D-05 — DYNAMIC live-apply (chosen over SC2's new-sessions-only minimum):** changing the setting fans the new value out to ALL mounted `SessionView`s via `term.options.scrollback = newValue` (xterm option is runtime-settable; mirrors VS Code's `terminal.integrated.scrollback`) **and** applies to new sessions. The apply path is a **renderer-side broadcast** from `SessionManager` to each live `term` — no PTY/main involvement. This satisfies AND exceeds SC2 ("takes effect for new sessions").
- **D-06 — Decrease behavior (accepted):** lowering the value trims existing scrollback rows beyond the new cap on already-open terminals (xterm-inherent; those rows are dropped). Expected behavior, not a blocker.
- **D-07 — Persistence:** the scrollback value is a GLOBAL app preference, persisted via the established validated lowdb path (the renderer-never-touches-disk pattern used for `ui` collapse/bounds via `persistUiState` + `setUiState`/`getUiState`). Planner decides whether to extend the store-schema `ui` section or add a dedicated `settings` section, and whether one new validated bridge key is warranted vs reuse — under the `EXPECTED_API_KEYS` / `security.guard` invariant.

### Settings Panel (TERM-11)
- **D-08 — Settings surface:** a lightweight **Preferences modal**, launched from a **gear icon in the sidebar**, reusing the existing modal idiom (`ConfirmModal` / `SessionEditModal` / `IconPicker`). It holds only the scrollback setting now but is structured as an **extensible Preferences shell** for future settings.

### Claude's Discretion
- Search bar visual placement (VS Code-style top-right overlay over the active terminal) and styling per `.planning/DESIGN.md`.
- Search wrap-around at buffer ends (`SearchAddon` default wraps).
- Store-schema landing for the setting (`ui` section vs new `settings` section) and whether a new validated bridge key is needed vs reuse — planner decides under the 19-key / `security.guard` invariant. (Claude leans: new `settings` section for clarity.)
- Exact gear-icon placement in the sidebar (expanded body vs collapsed rail) and Preferences modal layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` § "Phase 7: Terminal Search + Scrollback Config" — goal + 3 success criteria (find-chord search bar over scrollback; global scrollback setting w/ sensible default; Esc dismiss + no input interference when inactive).
- `.planning/REQUIREMENTS.md` — **TERM-10** (search a session's scrollback) and **TERM-11** (scrollback size configurable via a global setting w/ sensible default).
- `.planning/DESIGN.md` — terminal palette/theme + modal & sidebar visual language the search bar and Preferences modal must match.

### Search + chord touchpoints
- `src/renderer/SessionView.tsx` — xterm init (`scrollback: 10000` at line ~168 → reads the global default); `attachCustomKeyEventHandler` (per-term key path; search bar mounts on this view); `termRef.current` (the live `Terminal` that `SearchAddon` attaches to and that receives runtime scrollback changes).
- `src/main/switch-keys.ts` — `matchSwitchKey` pure matcher + `SwitchIntent` union (add `{ kind: 'search' }`); documents the D-12/D-13 Cmd-on-mac / Ctrl-on-win convention + the Clear-chord zero-new-key precedent.
- `src/main/index.ts` — the `before-input-event` wiring that casts Electron `Input` → `KeyInput` → `matchSwitchKey` → `'session:switch'` send.
- `src/renderer/SessionManager.tsx` — `onSwitchSession` handler (the `intent.kind === 'clear'` branch ~L477 is the exact template for a `'search'` branch); `handleClear` ~L224 is the template for toggling the search bar; owns per-session state and is the fan-out point for live scrollback changes.

### Settings persistence touchpoints
- `src/main/store-schema.ts` — `StoreSchema` (`ui` section, `SCHEMA_VERSION = 2`, `coerceOnLoad`); where the scrollback setting lands (`ui` vs new `settings`).
- `src/shared/api-types.ts` — `ElectronAPI` + `EXPECTED_API_KEYS` (19 keys); `persistUiState` (the validated fire-and-forget global-pref pattern to mirror).
- `src/main/pty-manager.ts` — `setUiState` / `getUiState` (~L1068), the in-memory validated UI-prefs holder a scrollback setter mirrors.
- `src/main/session-store.ts` — `SessionStore` (lowdb dynamic import, debounce/flush) — the persistence producer.

### xterm addon (NEW dependency)
- `@xterm/addon-search` — **NOT yet installed; must be added** (matches the `@xterm/*` 5.x line). API: `findNext` / `findPrevious`, `ISearchOptions { caseSensitive, regex, wholeWord, decorations }`, `onDidChangeResults` (for the match count).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Global-chord pipeline** (main `before-input-event` → `matchSwitchKey` → `'session:switch'` → renderer `onSwitchSession`): reuse verbatim for the find chord — add a `{ kind: 'search' }` variant, **zero new bridge key** (Clear-chord precedent).
- **Modal idiom** (`ConfirmModal` / `SessionEditModal` / `IconPicker`): reuse for the Preferences modal.
- **Global-pref persistence** (`persistUiState` + store-schema `ui` section + `setUiState`/`getUiState` validated holder): the canonical pattern for the scrollback setting.
- **`termRef.current` per `SessionView`**: the live `Terminal` that `SearchAddon` attaches to and where `term.options.scrollback = N` applies live.
- **`SessionManager` per-row state + `onSwitchSession` clear/switch branch**: the place to add search-toggle state + the scrollback fan-out.

### Established Patterns
- **Bridge discipline:** `EXPECTED_API_KEYS = 19`, enforced by the `security.guard` test; prefer reusing existing channels over adding keys (search adds zero; scrollback adds at most one validated key — planner confirms).
- **Cmd-on-mac / Ctrl-on-win** primary modifier (D-12/D-13) — one pure matcher covers both platforms.
- **Renderer never imports electron/node-pty and never touches disk** — all persistence goes through validated main-side IPC.
- **Pure, electron-free modules** (`switch-keys.ts`, `store-schema.ts`) are Node/Vitest-testable — keep any new helpers (scrollback clamp, search-intent extension) in that style.
- **macOS-first verification**; Windows chord/enumeration is verified in Phase 8.

### Integration Points
- `matchSwitchKey` (main) gains a `search` branch; `index.ts` `before-input-event` already forwards the resulting intent.
- `SessionManager.onSwitchSession` (renderer) gains a `'search'` branch → toggles the active `SessionView`'s search bar.
- `SessionView` mounts `@xterm/addon-search` on its `termRef` term + renders the search-bar overlay; receives the global scrollback value (prop from `SessionManager`) and applies it live.
- A new gear control in `Sidebar` opens the Preferences modal; the modal writes the scrollback value through the persistence path; `SessionManager` reads it and fans it out to live terms.

</code_context>

<specifics>
## Specific Ideas

- The **"real terminal fidelity" Core Value** explicitly drove the find-chord decision: Cmd+F (mac) / Ctrl+F (win) via the chord channel, NOT literal Ctrl+F everywhere — don't steal readline `forward-char` on macOS.
- Match-count "**N of M**" + case-sensitive toggle modeled on VS Code's terminal find; regex / whole-word deliberately held back to keep the bar light.
- **Dynamic live-apply** of scrollback modeled explicitly on VS Code's `terminal.integrated.scrollback` (applies to open terminals immediately).
- Default **5000** chosen as the midpoint between the roadmap's `3000` example and the current hardcoded `10000`.

</specifics>

<deferred>
## Deferred Ideas

- **Search regex + whole-word toggles** — `SearchAddon` supports them; add later if needed (D-01 keeps the bar light for now).
- **Per-session scrollback override** — this phase is global-only.
- **Search history / search-across-all-sessions** — out of scope (new capability, own phase).
- **"Unlimited" scrollback option** — rejected (OOM risk across N sessions).

### Reviewed Todos (not folded)
The `cross_reference_todos` step surfaced 5 pending todos by keyword/area match; **none touch search or scrollback**, so all are deferred (folding any would be scope creep into Phase 7):
- *"Add folder picker for working directory selection"* — already wired in Phase 06-02 (`pickDirectory` + Browse…); not Phase 7 scope.
- *"Improve Start control discoverability for live sessions"* — addressed by the Phase 06.1 two-bucket Inactive List + Start ▶; not Phase 7 scope.
- *"Edit modal does not prefill saved cwd and startup command"* — edit-prefill added in Phase 06-02; not Phase 7 scope.
- *"Redo phase 06.1 code-review criticals (CR-01..CR-04 + WR-02)"* — deferred 06.1 follow-up (recorded in commit `9375ea1`); its own task, not search/scrollback.
- *"Address deferred code-review findings from phase 05.1"* — separate 05.1 follow-up; not Phase 7 scope.

</deferred>

---

*Phase: 7-Terminal Search + Scrollback Config*
*Context gathered: 2026-06-09*
