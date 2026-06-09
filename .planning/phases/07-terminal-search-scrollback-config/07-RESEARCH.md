# Phase 7: Terminal Search + Scrollback Config - Research

**Researched:** 2026-06-09
**Domain:** xterm.js addon integration (search) + runtime terminal option fan-out (scrollback) + validated lowdb global-pref persistence, inside an Electron 42 / React 19 / TS desktop app
**Confidence:** HIGH

## Summary

Both features are additive on the working terminal and require **zero architecture change**. TERM-10 (in-session search) is delivered by adding the one missing `@xterm/addon-search` package and mounting a `SearchAddon` on each `SessionView`'s existing `termRef.current`. The find chord (Cmd+F mac / Ctrl+F win) rides the **existing** main-side `before-input-event → matchSwitchKey → 'session:switch'` channel as a brand-new `{ kind: 'search' }` `SwitchIntent` variant — exactly mirroring the already-shipped Clear-chord precedent (`matchClearKey`, D-13), so `EXPECTED_API_KEYS` stays at **19** and the `security.guard` test stays green with no bridge change. TERM-11 (configurable scrollback) is a global preference persisted through the **existing** `persistUiState` → `setUiState` → store `ui` slot validated path, read on boot and fanned out live to every mounted `SessionView` via the runtime-settable `term.options.scrollback = N`.

The two highest-value verified findings the planner must encode: (1) the xterm `SearchAddon.onDidChangeResults` event — which produces the live "N of M" count required by D-01 — **only fires when `decorations` are enabled** in the search options, and its `resultIndex` returns **-1 when the match threshold is exceeded** (the "N of M" UI must handle that sentinel). (2) The search-decoration-over-WebGL desync bug (#5008) was **fixed in xterm 5.5.0** — the exact version this project pins — so decorations render correctly over the active `@xterm/addon-webgl` renderer with no workaround. `term.options.scrollback = N` is confirmed runtime-settable (scalar option), so the D-05 live fan-out is a direct assignment per term.

**Primary recommendation:** Install `@xterm/addon-search@0.15.0` (peer `@xterm/xterm@^5.0.0`, matches the project's 5.5.0 + sibling-addon line). Add a `{ kind: 'search' }` matcher in `switch-keys.ts` + a renderer `'search'` branch in `SessionManager.onSwitchSession` (zero new bridge key). Add a global `scrollback` pref to the store-schema `ui` section with a clamp helper (1000–50000, default 5000), persisted via the existing `persistUiState`/`setUiState` path (no new key required) and fanned out from `SessionManager` to each live `term.options.scrollback`.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — Search capability tier:** search bar = text input + next/previous nav + **"N of M" match count** + **case-sensitive (Aa) toggle**. Backed by `@xterm/addon-search` (`SearchAddon`) using its `caseSensitive` option + `decorations` (highlight all matches; live count via the `onDidChangeResults` event). **Regex and whole-word toggles are explicitly DEFERRED** — `SearchAddon` supports them, so they can be added later with no rework.
- **D-02 — Search keybinding rides the EXISTING global-chord channel (zero new bridge key):** Cmd+F (macOS) / Ctrl+F (Windows) is matched main-side in `before-input-event` → `matchSwitchKey` as a NEW `{ kind: 'search' }` `SwitchIntent` variant, dispatched over the existing `'session:switch'` channel. `EXPECTED_API_KEYS` stays at 19 (mirrors the Clear-chord precedent, D-13). The renderer's `onSwitchSession` handler branches `'search'` exactly like it branches `'clear'`, toggling the active session's search bar.
- **D-03 — Fidelity preserved (Core Value):** literal-Ctrl+F-on-both-platforms REJECTED (would steal macOS `Ctrl+F` readline forward-char). Cmd+F (mac) never reaches the PTY; Windows Ctrl+F intercepted main-side before xterm/PTY. Escape dismiss + no-interference-when-closed locked by SC3.
- **D-04 — Value + bounds:** global scrollback setting, **default 5000 lines, range 1000–50000, NO "unlimited" option**. The hardcoded `scrollback: 10000` at `src/renderer/SessionView.tsx:168` becomes the global default read from settings.
- **D-05 — DYNAMIC live-apply:** changing the setting fans the new value out to ALL mounted `SessionView`s via `term.options.scrollback = newValue` **and** applies to new sessions. Renderer-side broadcast from `SessionManager` to each live `term` — no PTY/main involvement. Satisfies AND exceeds SC2.
- **D-06 — Decrease behavior (accepted):** lowering the value trims existing scrollback rows beyond the new cap on already-open terminals (xterm-inherent). Expected behavior, not a blocker.
- **D-07 — Persistence:** scrollback value is a GLOBAL app preference, persisted via the established validated lowdb path (the `persistUiState` + `setUiState`/`getUiState` pattern). Planner decides `ui` section vs new `settings` section, and whether one new validated bridge key is warranted vs reuse — under the `EXPECTED_API_KEYS` / `security.guard` invariant.
- **D-08 — Settings surface:** a lightweight **Preferences modal**, launched from a **gear icon in the sidebar**, reusing the existing modal idiom (`ConfirmModal` / `SessionEditModal` / `IconPicker`). Holds only the scrollback setting now but structured as an **extensible Preferences shell**.

### Claude's Discretion
- Search bar visual placement (VS Code-style top-right overlay over the active terminal) and styling per `.planning/DESIGN.md`.
- Search wrap-around at buffer ends (`SearchAddon` default wraps).
- Store-schema landing for the setting (`ui` section vs new `settings` section) and whether a new validated bridge key is needed vs reuse — planner decides under the 19-key / `security.guard` invariant. (Claude leans: new `settings` section for clarity.)
- Exact gear-icon placement in the sidebar (expanded body vs collapsed rail) and Preferences modal layout.

### Deferred Ideas (OUT OF SCOPE)
- **Search regex + whole-word toggles** — `SearchAddon` supports them; add later (D-01 keeps the bar light).
- **Per-session scrollback override** — this phase is global-only.
- **Search history / search-across-all-sessions** — out of scope (own phase).
- **"Unlimited" scrollback option** — rejected (OOM risk across N sessions).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TERM-10 | User can search a session's scrollback (e.g. Ctrl+F) | `@xterm/addon-search` `SearchAddon` mounted on `termRef.current`; `findNext`/`findPrevious` over the buffer; `onDidChangeResults` (decorations-gated) drives "N of M"; `caseSensitive` option drives the Aa toggle; the find chord rides the existing `'session:switch'` channel as a `{ kind: 'search' }` intent (zero new bridge key). [VERIFIED: xterm.js typings + npm registry] |
| TERM-11 | Scrollback buffer size configurable via a global setting w/ sensible default | `term.options.scrollback = N` confirmed runtime-settable [CITED: xterm.js ITerminalOptions]; default 5000, clamp 1000–50000; persisted via existing `persistUiState`/`setUiState`/store `ui` slot; fanned out from `SessionManager` to each live `term`; read on boot to seed `new Terminal({ scrollback })`. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Find-chord interception (Cmd+F / Ctrl+F) | Main (`before-input-event`) | — | "App always wins" over a focused xterm requires main-side interception; the Clear/Switch chords already prove this is the only reliable path on Windows Ctrl combos and inside vim/tmux. Renderer-side key handling would leak the chord to the PTY. |
| Search execution + match highlight | Renderer (`SessionView` + `SearchAddon` on `termRef`) | — | Search runs entirely against the in-memory xterm buffer in the renderer; the PTY/main is never involved. `SearchAddon` is a renderer-only browser module (uses DOM decorations). |
| Search-bar UI (input, prev/next, count, Aa) | Renderer (`SessionView` overlay) | — | Pure presentation over the active term; mounted per-view, styled from DESIGN.md. |
| Scrollback value persistence | Main (`setUiState` validated holder → `SessionStore` lowdb) | — | Renderer-never-touches-disk invariant: all persistence goes through validated main-side IPC. |
| Scrollback live fan-out | Renderer (`SessionManager` → each `SessionView` `term`) | — | The live `Terminal` objects live in the renderer; D-05 broadcast is a renderer-internal prop/assignment, no IPC. |
| Preferences modal + gear launcher | Renderer (`Sidebar` gear + new `PreferencesModal`) | — | Pure renderer UI reusing the existing modal idiom; writes the value through the persistence bridge. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xterm/addon-search` | **0.15.0** (consider 0.16.0 — see Alternatives) | `SearchAddon` — find over the terminal buffer, highlight-all decorations, live match count | Official xterm.js core-team addon (developed in the main `xtermjs/xterm.js` repo). 379K weekly downloads. The exact addon VS Code's terminal find uses. Peer `@xterm/xterm@^5.0.0` — same peer the project's installed addons satisfy. [VERIFIED: npm registry] |

### Supporting
No other new dependencies. All other building blocks already exist in the project:
| Existing asset | Purpose | When to Use |
|---------|---------|-------------|
| `@xterm/xterm@5.5.0` `term.options.scrollback` | Runtime-settable scrollback (D-05 live-apply) | Direct scalar assignment per live term |
| `persistUiState` / `setUiState` / store `ui` slot | Validated global-pref persistence (D-07) | Reuse for the scrollback value — zero or one bridge key |
| `matchSwitchKey` / `SwitchIntent` / `'session:switch'` channel | Find-chord dispatch (D-02) | Add `{ kind: 'search' }` variant — zero bridge key |
| `ConfirmModal` modal idiom + `modal-overlay`/`modal-dialog` CSS | Preferences modal shell (D-08) | Clone the structure for `PreferencesModal` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@xterm/addon-search@0.15.0` | `@xterm/addon-search@0.16.0` (current `latest`) | 0.16.0 is the newest stable (`latest` tag) and also peers `@xterm/xterm@^5.0.0`, so it is compatible with 5.5.0. 0.15.0 is the conservative pick whose API matches the typings researched here verbatim and is closest in vintage to the project's other pinned addons (addon-fit 0.10.0, addon-web-links 0.11.0). **Planner picks one; verify the resolved version against `npm view` at install time** (the `0.17.0-beta.*` line tracks xterm 5.6+ beta and must NOT be used — the project is on stable 5.5.0). [VERIFIED: npm registry] |
| New `settings` store section | Extend existing `ui` section | Both migration-safe (see Persistence Shape). `ui` reuse = zero schema-shape churn + likely zero new bridge key (rides `persistUiState`). New `settings` = cleaner semantics for the "extensible Preferences shell" framing (D-08) but needs either a `persistUiState` payload widening or one new validated bridge key (`EXPECTED_API_KEYS` 19→20). CONTEXT marks this Claude's discretion; **research recommendation: extend `ui` and ride `persistUiState`** to keep `EXPECTED_API_KEYS` at 19 and the `security.guard` test untouched. |
| `SearchAddon` decorations for count | Manual buffer scan for count | Hand-rolling a match counter over `term.buffer` re-implements what `onDidChangeResults` gives for free and would drift from the addon's own match semantics. Don't hand-roll. |

**Installation:**
```bash
npm install @xterm/addon-search@0.15.0
# After install, the postinstall (scripts/fix-node-pty.cjs) runs — addon-search is a
# PURE JS browser module (no native build), so it does NOT need @electron/rebuild.
```

**Version verification (run at plan/execute time, do not trust this doc blindly):**
```bash
npm view @xterm/addon-search version          # confirm 'latest' has not moved to a 5.6-only line
npm view @xterm/addon-search@0.15.0 peerDependencies   # expect { "@xterm/xterm": "^5.0.0" }
```
Verified 2026-06-09: `latest = 0.16.0`, `0.15.0` peer = `@xterm/xterm@^5.0.0`, `0.17.0-beta.*` is the active pre-release line (avoid). [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@xterm/addon-search` | npm | stable since 2023 (0.15.0 pub 2024-04-05) | ~379K/week | github.com/xtermjs/xterm.js (official core-team monorepo) | `[OK]` | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

slopcheck 0.6.1 ran `slopcheck install @xterm/addon-search` → `[OK]` (1 OK, 0 SLOP, 0 SUS). Registry cross-check: package is the official scoped `@xterm/*` namespace published from the xtermjs org monorepo, 379K weekly downloads, no `postinstall` script. The transient node_modules/package.json changes slopcheck produced during verification were reverted (`git checkout package.json package-lock.json`; node_modules/@xterm/addon-search removed) — the working tree is clean. **Planner should still gate the actual install behind the normal task flow** and re-run `npm view` to confirm the resolved version at execute time.

## Architecture Patterns

### System Architecture Diagram

```
TERM-10 (search) — find chord path:
  ┌─────────────── MAIN ───────────────┐         ┌──────────── RENDERER ────────────┐
  Cmd+F / Ctrl+F keypress                         │
        │ (focused xterm)                         │
        ▼                                         │
  win.webContents.on('before-input-event')        │
        │                                         │
        ▼  cast Input → KeyInput                   │
  matchSwitchKey(key)  ──► returns                 │
        │  { kind: 'search' }  (NEW variant)       │
        ▼                                         │
  event.preventDefault()  (chord NEVER reaches xterm/PTY — fidelity preserved)
        │                                         │
        └── win.webContents.send('session:switch', intent) ──┐
                                                  │           ▼
                                                  │   window.api.onSwitchSession(cb)
                                                  │           │  intent.kind === 'search'
                                                  │           ▼
                                                  │   SessionManager: toggle active session's
                                                  │   search-bar visibility state (per-row, like 'clear')
                                                  │           │
                                                  │           ▼
                                                  │   SessionView renders <SearchBar> overlay
                                                  │           │  onInput / next / prev / Aa / Esc
                                                  │           ▼
                                                  │   SearchAddon.findNext/findPrevious(term, {caseSensitive, decorations})
                                                  │           │  ▲ onDidChangeResults → {resultIndex, resultCount}
                                                  │           ▼  └──────────────► "N of M" label
                                                  │   highlight-all decorations render over WebGL term
                                                  └───────────────────────────────────┘

TERM-11 (scrollback) — set + fan-out + persist:
  ┌──────────── RENDERER ────────────┐                 ┌─────────── MAIN ───────────┐
  Sidebar gear ▸ PreferencesModal                      │
        │ user sets scrollback = N (clamped 1000–50000)│
        ▼                                              │
  SessionManager.handleSetScrollback(N)                │
        ├─► broadcast: each live term.options.scrollback = N   (D-05 live-apply, no IPC)
        ├─► new SessionViews read N as prop → new Terminal({ scrollback: N })
        └─► window.api.persistUiState({ scrollback: N }) ──► ipcRenderer.send('store:persist-ui')
                                                       │           ▼
                                                       │   ptyManager.setUiState(ui)  [validate-in-main]
                                                       │           │  finite + range guard
                                                       │           ▼
                                                       │   SessionStore.setUi(...) → debounced lowdb write
  Boot: window.api.listSessions() (existing)           │   store.ui.scrollback persisted (SCHEMA_VERSION bump if added)
  + read persisted scrollback (see Persistence note) ◄─┘
```

### Recommended Project Structure (new/changed files)
```
src/
├── main/
│   ├── switch-keys.ts          # + { kind: 'search' } SwitchIntent variant + matchSearchKey (or fold into matchSwitchKey)
│   ├── store-schema.ts         # + scrollback?: number on ui (or new settings); + clampScrollback helper; SCHEMA_VERSION bump if shape changes
│   └── pty-manager.ts          # setUiState(): validate + hold scrollback (extend existing validator)
├── shared/
│   └── api-types.ts            # persistUiState payload gains scrollback?: number (NO new key if riding ui)
├── renderer/
│   ├── SessionView.tsx         # mount SearchAddon on termRef; render <SearchBar> overlay; scrollback prop → new Terminal({scrollback}) + term.options.scrollback on prop change
│   ├── SearchBar.tsx           # NEW — the in-terminal find UI (input, prev/next, "N of M", Aa, Esc)
│   ├── SessionManager.tsx      # onSwitchSession 'search' branch (toggle per-row searchOpen); scrollback state + fan-out; pass scrollback prop to SessionView
│   ├── PreferencesModal.tsx    # NEW — gear-launched modal shell (clone ConfirmModal idiom), hosts the scrollback field
│   └── Sidebar.tsx             # + gear control that opens PreferencesModal
└── (pure helpers, electron-free, Vitest-testable):
    ├── main/switch-keys.ts (matchSearchKey)        # pure
    ├── main/store-schema.ts (clampScrollback)      # pure
    └── renderer/scrollback-clamp.ts (if shared)    # pure clamp helper if reused renderer-side for the input
```

### Pattern 1: Find-chord as a new SwitchIntent variant (mirror the Clear-chord)
**What:** Add `{ kind: 'search' }` to the `SwitchIntent` union and a pure `matchSearchKey` (or extend `matchSwitchKey`); intercept in `before-input-event`; branch it in the renderer's single `onSwitchSession` subscription.
**When to use:** This is the locked D-02 approach — the ONLY way that keeps fidelity (chord never reaches the PTY) and adds zero bridge keys.
**Example (the exact existing Clear-chord shape to mirror):**
```typescript
// Source: src/main/switch-keys.ts (matchClearKey — the verbatim precedent)
export function matchClearKey(i: KeyInput): SwitchIntent | null {
  if (i.type !== 'keyDown') return null;
  if (!isKeyK(i)) return null;
  if (i.meta) return { kind: 'clear' };            // macOS: Cmd+K
  if (i.control && i.shift) return { kind: 'clear' }; // Windows: Ctrl+Shift+K
  return null;
}
// → NEW matchSearchKey: same shape, isKeyF, macOS Cmd+F → {kind:'search'},
//   Windows Ctrl+F → {kind:'search'}. NOTE the platform asymmetry below (Pitfall 2):
//   on Windows, plain Ctrl+F is INTENDED to be intercepted (D-03), unlike Clear's
//   Ctrl+Shift+K. Confirm the matcher does NOT also fire on macOS Ctrl+F (must let
//   readline forward-char through — D-03).
```
```typescript
// Source: src/main/index.ts (before-input-event — already forwards matchClearKey)
const clear = matchClearKey(key);
if (clear) { event.preventDefault(); win.webContents.send('session:switch', clear); }
// → add a sibling matchSearchKey(key) check, identical shape.
```
```typescript
// Source: src/renderer/SessionManager.tsx (onSwitchSession — the 'clear' branch template)
if (intent.kind === 'clear') {
  setActiveId((cur) => { if (cur !== null) handleClear(cur); return cur; });
  return;
}
// → add: if (intent.kind === 'search') { toggle the active session's searchOpen state; return; }
```

### Pattern 2: SearchAddon lifecycle on the keep-alive SessionView term
**What:** Load `SearchAddon` ONCE per `Terminal` in the mount effect (alongside `FitAddon`/`WebLinksAddon`/`Unicode11Addon`); keep a ref; dispose it in the existing cleanup before `term.dispose()`.
**When to use:** Always. The `SessionView` term is created once per session and kept mounted for its whole life (it is NOT recreated on tab switch), so the addon must load once, not per-search.
**Example:**
```typescript
// Source: pattern derived from SessionView.tsx existing addon loading (lines 180–186)
import { SearchAddon } from '@xterm/addon-search';
const search = new SearchAddon();
searchRef.current = search;
term.loadAddon(search);
// ... in cleanup (before term.dispose()):  search.dispose();  searchRef.current = null;
```

### Pattern 3: Live "N of M" via decorations-gated onDidChangeResults
**What:** Subscribe to `searchAddon.onDidChangeResults(({resultIndex, resultCount}) => ...)`. It **only fires when `decorations` is set in the search options**, so every `findNext`/`findPrevious` call MUST pass a `decorations` object (D-01 wants highlight-all anyway).
**When to use:** To populate the "N of M" label.
**Example:**
```typescript
// Source: @xterm/addon-search typings (xtermjs/xterm.js master)
const opts: ISearchOptions = {
  caseSensitive,                 // D-01 Aa toggle
  decorations: {                 // REQUIRED for onDidChangeResults to fire + highlight-all
    matchOverviewRuler: '#'+'…', // required string fields
    activeMatchColorOverviewRuler: '#'+'…',
    matchBackground: '…',        // optional; style from DESIGN.md
    activeMatchBackground: '…',
  },
};
const off = search.onDidChangeResults(({ resultIndex, resultCount }) => {
  // resultIndex is 0-based active match, OR -1 when the match threshold is exceeded.
  // Render "resultCount === 0 ? 'No results' : `${resultIndex+1} of ${resultCount}`",
  // and handle the -1 sentinel (e.g. show "M matches" without a current index).
  setMatchState({ index: resultIndex, count: resultCount });
});
search.findNext(query, opts);  // findPrevious for prev
// off() on bar close / term dispose.
```

### Pattern 4: Scrollback as a controlled prop + live runtime assignment
**What:** `SessionManager` owns the scrollback value (boot-read + Preferences-set). It passes it as a prop to every `SessionView`. The mount effect seeds `new Terminal({ scrollback })`; a small effect keyed on the prop assigns `term.options.scrollback = value` on change (D-05 live-apply).
**When to use:** Always for TERM-11.
**Example:**
```typescript
// Source: xterm.js ITerminalOptions — scrollback is a scalar, runtime-settable.
useEffect(() => {
  const term = termRef.current;
  if (term) term.options.scrollback = scrollback;  // live-apply (D-05). Decrease trims (D-06).
}, [scrollback]);
```

### Anti-Patterns to Avoid
- **Handling Cmd/Ctrl+F in the renderer's `attachCustomKeyEventHandler`:** would leak the chord to the PTY and break fidelity on Windows. Intercept main-side (D-02/D-03).
- **Loading `SearchAddon` per-search or per-tab-activate:** the term is keep-alive; load once in the mount effect, dispose once in cleanup (mirrors WebGL/Fit lifecycle).
- **Calling `findNext`/`findPrevious` WITHOUT `decorations`:** `onDidChangeResults` will not fire → no "N of M" count (D-01 fails silently).
- **Adding a new bridge key for the find chord:** violates D-02 — it rides `'session:switch'`. `EXPECTED_API_KEYS` must stay 19 (search) or at most 20 (scrollback, only if a new `settings` key is chosen — research recommends NOT doing this).
- **Injecting `clear`/Ctrl+L into the PTY for any of this:** never. Search and scrollback are pure client-side xterm ops (consistent with the existing `handleClear` discipline).
- **Letting the search box's Esc/typing reach the PTY:** the search input must be a real DOM `<input>` overlay, NOT routed through xterm's helper textarea; its `onKeyDown` must `stopPropagation` (Esc closes the bar; chars go to the input, not the term).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Search over terminal buffer | Manual `term.buffer.active` line scan + regex + scroll-to-match | `SearchAddon.findNext/findPrevious` | Handles reflow, wrapped lines, scrollback paging, viewport scroll, wrap-around, and decoration highlight — all edge cases you'd reintroduce by hand. |
| Live match count "N of M" | Custom counter recomputed on each keystroke | `onDidChangeResults` (`resultIndex`/`resultCount`) | The addon already computes and caches this; recomputing drifts from the addon's match semantics (and 5.5.0 fixed the cache-on-linefeed bug). |
| Highlight-all matches | Manual decoration loop over buffer | `decorations` in `ISearchOptions` | Built-in, WebGL-correct in 5.5.0, includes overview-ruler markers. |
| Scrollback runtime change | Recreate the Terminal with a new scrollback | `term.options.scrollback = N` | Recreating tears down the live PTY-attached buffer (loses session state). The option is runtime-settable. |
| Global-pref persistence + validation | New disk-writing IPC + ad-hoc JSON | Existing `persistUiState`→`setUiState`→`SessionStore` path | Already validated-in-main, debounced, corrupt-safe, and `security.guard`-covered. |

**Key insight:** Every piece of this phase already has a battle-tested home in the codebase or the addon. The phase is wiring, not building.

## Common Pitfalls

### Pitfall 1: "N of M" count never updates
**What goes wrong:** `onDidChangeResults` never fires; the count stays blank.
**Why it happens:** `decorations` was not passed in the `ISearchOptions` on `findNext`/`findPrevious` — the event is **decorations-gated** by design. [VERIFIED: xterm.js typings — "When decorations are enabled, fires when the search results change."]
**How to avoid:** Always pass a `decorations` object (D-01 wants highlight-all regardless). Provide the two REQUIRED string fields (`matchOverviewRuler`, `activeMatchColorOverviewRuler`).
**Warning signs:** Search jumps between matches correctly but the count label is empty.

### Pitfall 2: macOS Ctrl+F readline regression / Windows asymmetry
**What goes wrong:** A naive `i.control` check in the matcher would intercept macOS `Ctrl+F` and steal readline forward-char (the exact thing D-03 forbids) — or miss Windows Ctrl+F.
**Why it happens:** Unlike the switch chords (one `meta||control` rule) and unlike Clear (Cmd+K mac / Ctrl+**Shift**+K win), the find chord is **Cmd+F on mac but plain Ctrl+F on Windows**. The matcher must branch on platform-equivalent modifiers, not a unified `meta||control`.
**How to avoid:** macOS arm matches `i.meta && isKeyF` (NOT `i.control`); Windows arm matches `i.control && !i.meta && isKeyF`. Cover both in the `switch-keys` unit test (a macOS-Ctrl+F input must return `null`). Note: `before-input-event` runs in main where there is no per-key platform tag on the `Input` — the matcher cannot know the OS from the event alone. Resolve by either (a) passing `process.platform` into the matcher, or (b) accepting both `Cmd+F` and `Ctrl+F` as `{kind:'search'}` and relying on the fact that macOS Ctrl+F users rarely also hold the app focused — **(a) is the correct, testable choice** and matches how the codebase keeps matchers pure (pass platform as an arg, assert both branches in Vitest).
**Warning signs:** `Ctrl+F` inside `claude`/vim on macOS stops moving the cursor forward.

### Pitfall 3: Search input keystrokes leak to the PTY
**What goes wrong:** Typing in the search box also types into the shell, or Esc both closes the bar AND hits the shell.
**Why it happens:** If the search input is rendered inside the xterm element or events aren't stopped, xterm's handlers or the global `before-input-event` see them.
**How to avoid:** Render `SearchBar` as a sibling overlay `<div>` (absolute-positioned over the term, not inside `.xterm`). Its `<input>` `onKeyDown` handles Enter (next), Shift+Enter (prev), Esc (close) and calls `stopPropagation()`. The find chord that OPENS the bar is intercepted main-side and never reaches xterm; once open, focus is on the DOM input, so xterm's helper-textarea handler is not focused (the existing `attachCustomKeyEventHandler` already returns `false` when focus isn't on `.xterm-helper-textarea` — SessionView.tsx:215-222 — so this composes cleanly).
**Warning signs:** Searching for "ls" runs `ls`; Esc closes the bar but also cancels something in the shell.

### Pitfall 4: SearchAddon not disposed → leak on session removal
**What goes wrong:** Removing a session leaves a dangling addon/decoration subscription.
**Why it happens:** The mount-effect cleanup disposes the term but not the new addon/listener.
**How to avoid:** Add `search.dispose()` and the `onDidChangeResults` unsubscribe to the existing cleanup return in SessionView's mount effect (before `term.dispose()`), mirroring how `offData/offExit/offStatus` and `detachWebgl` are already handled (SessionView.tsx:464-487).
**Warning signs:** Console warnings about disposed terminals; decorations from an old session lingering.

### Pitfall 5: Scrollback prop change doesn't re-fit / wastes work
**What goes wrong:** Lowering scrollback on many live terms triggers reflow churn.
**Why it happens:** Each `term.options.scrollback = N` assignment on a large buffer trims rows (D-06).
**How to avoid:** Fan out only on actual change (guard against redundant assignment); the assignment is cheap per term (no re-fit needed — scrollback change does not alter cols/rows). For N≈50 sessions this is negligible, but only broadcast when the value actually changed (compare prev). [ASSUMED — perf is fine at this project's ~50-session ceiling; not load-tested this session.]
**Warning signs:** Visible hitch when changing scrollback with many sessions open (not expected at this scale).

## Code Examples

### Mounting SearchAddon (verified API)
```typescript
// Source: @xterm/addon-search typings (github.com/xtermjs/xterm.js master)
import { SearchAddon, type ISearchOptions } from '@xterm/addon-search';

const search = new SearchAddon();
term.loadAddon(search);

const opts: ISearchOptions = {
  caseSensitive: false,
  decorations: {
    matchOverviewRuler: '#777777',            // REQUIRED (non-optional in typings)
    activeMatchColorOverviewRuler: '#a0a0a0', // REQUIRED
    matchBackground: '#5f5f00',               // optional
    activeMatchBackground: '#bcaa00',         // optional
  },
};

search.onDidChangeResults(({ resultIndex, resultCount }) => {
  // resultIndex === -1 when the threshold of matches is exceeded.
});

const ok: boolean = search.findNext('query', opts);   // forward
search.findPrevious('query', opts);                   // backward
search.clearDecorations();                             // on bar close
```

### Runtime scrollback (verified)
```typescript
// Source: xterm.js ITerminalOptions — scrollback default 1000, runtime-settable scalar.
const term = new Terminal({ scrollback: scrollbackFromSettings });  // boot seed
term.options.scrollback = newValue;                                 // live-apply (D-05)
```

## Runtime State Inventory

> This phase is additive feature work, not a rename/migration. The only persisted-state touchpoint is the NEW scrollback preference. Included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The store `ui` slot (`{ collapsed?, bounds? }`) gains a `scrollback?: number` (if `ui` chosen). No existing record key is renamed or migrated. | Schema additive change + `coerceOnLoad`/load-default for absent `scrollback` |
| Live service config | None — no external services. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None. | None |
| Build artifacts | One new dependency (`@xterm/addon-search`) lands in `node_modules` + `package.json`/`package-lock.json`. Pure JS — NO `@electron/rebuild` needed (only native `node-pty` needs that). | `npm install @xterm/addon-search@<ver>`; no rebuild |

**Nothing found in categories Live/OS/Secrets:** None — verified by reading the persistence path (`store-schema.ts`, `pty-manager.ts` setUiState, `session-store.ts`); the only durable artifact is the additive scrollback pref.

## Persistence Shape (answers planner Q4)

The existing path: renderer `window.api.persistUiState(ui)` → preload `ipcRenderer.send('store:persist-ui', ui)` → `ptyManager.setUiState(ui)` (validate-in-main, finite/boolean guards) → `signalStore()` → `index.ts` pushes `getUiState()` into `store.setUi(...)` → `SessionStore` debounced lowdb write into `db.data.ui`. On load, `SessionStore.load()` returns `data.ui` (default `{}`); `coerceOnLoad` only touches `sessions`, not `ui`.

**Recommended minimal, migration-safe shape (research lean — ride `ui`, NO new bridge key, stays at 19):**
1. `store-schema.ts`: `ui: { collapsed?: boolean; bounds?: {...}; scrollback?: number }`. Add a pure `clampScrollback(n: unknown): number` helper (1000–50000, default 5000, non-finite → default) — Vitest-testable like the existing `coerceOnLoad`/`clampDimension` helpers.
2. **Migration:** absent `scrollback` on an old `ui` slot is migration-safe **without** a SCHEMA_VERSION bump because the read site applies the default (`store.data.ui.scrollback ?? 5000`, run through `clampScrollback`). Only bump `SCHEMA_VERSION` (2→3) if you want an explicit on-load normalization pass; **a read-time default is sufficient and lower-risk** (mirrors how `ui` already tolerates an empty `{}`).
3. `pty-manager.ts setUiState`: extend the existing validator — when `scrollback` is present, accept only a finite number, then `clampScrollback` it before holding. A forged/out-of-range payload clamps (or no-ops) — never writes arbitrary data (T-05-01 invariant preserved).
4. `api-types.ts`: widen the `persistUiState` payload type to `{ collapsed?; bounds?; scrollback?: number }`. **This does NOT change `EXPECTED_API_KEYS`** (same method, wider payload) — the `security.guard` test asserts key NAMES, not payload shapes, so it stays green. Confirmed by reading `security.guard.test.ts` (asserts `Object.keys(exposed).sort() === EXPECTED_API_KEYS`).
5. **Boot read:** `SessionManager` needs the persisted value to seed new terms. Two options: (a) widen what `listSessions()` returns — NO, it returns `SessionRecord[]`; (b) add a read. The cleanest no-new-key path: have `index.ts` include the persisted scrollback in the initial render data the renderer already reads, OR expose it via the existing `getUiState` round-trip. **If a clean read requires a new bridge key, that is the ONE allowable 19→20 expansion — but first check whether the renderer can receive it through an existing channel.** [Open Question 1 — planner must resolve the boot-read channel precisely.]

**If the planner instead chooses a dedicated `settings` section (D-07 discretion):** add `settings: { scrollback: number }` to `StoreSchema`, bump `SCHEMA_VERSION` 2→3 with a `coerceOnLoad`-style default-fill for absent `settings`, and EITHER widen `persistUiState` (no new key) OR add a `persistSettings` validated bridge key (`EXPECTED_API_KEYS` 19→20, update window-config array + preload + security.guard in one atomic lockstep, exactly as the 06-01 `pickDirectory` expansion did). Research recommends the `ui` reuse to avoid the lockstep churn.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unscoped `xterm-addon-search` | Scoped `@xterm/addon-search` | xterm v5 (2023) | Use the scoped package; the unscoped one is deprecated (consistent with the project's already-scoped `@xterm/*` deps). |
| Search decorations desync over WebGL | Fixed (cache-on-linefeed bug #5008) | **xterm 5.5.0** | The project's pinned 5.5.0 renders search decorations correctly over the active WebGL addon — no workaround needed. [VERIFIED: xterm.js 5.5.0 release notes via WebSearch] |

**Deprecated/outdated:**
- Unscoped `xterm-addon-search` / `xterm-addon-webgl` — superseded by `@xterm/*` scoped packages.
- `0.17.0-beta.*` addon-search line — tracks xterm 5.6+ beta; do NOT use against stable 5.5.0.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `term.options.scrollback = N` live fan-out to ~50 terms is performance-negligible (no re-fit, cheap trim) | Pitfall 5 | If wrong, a visible hitch on scrollback change with many sessions — mitigated by change-guarded broadcast. Not load-tested this session. |
| A2 | 0.15.0 is the right pin vs 0.16.0; both peer `@xterm/xterm@^5.0.0` and work with 5.5.0 | Standard Stack / Alternatives | Low — both are `^5.0.0`-compatible; planner re-verifies resolved version at install via `npm view`. The real risk is accidentally pulling `0.17.0-beta.*` (5.6-only) — pin an exact `0.15.0`/`0.16.0` to avoid. |
| A3 | Riding `persistUiState` (wider payload, same key) keeps `security.guard` green | Persistence Shape | Low — verified the test asserts key names only, not payload shape. |

**Note:** All core API claims (SearchAddon surface, decorations-gated event, -1 threshold, scrollback runtime-settable, 5.5.0 WebGL fix, package legitimacy) are `[VERIFIED]`/`[CITED]`, not assumed.

## Open Questions (RESOLVED)

1. **Boot-read channel for the persisted scrollback value.**
   - What we know: the value persists into `store.data.ui` (or `settings`); the renderer needs it to seed `new Terminal({ scrollback })` on first mount and to initialize the Preferences field.
   - What's unclear: whether the renderer can receive it through an existing channel (`listSessions` returns only `SessionRecord[]`; `getUiState` is a main-internal accessor not currently bridged to the renderer) or needs ONE new read bridge key.
   - Recommendation: planner traces the boot data flow in `index.ts` + `SessionManager` boot effect and picks the minimal path. Prefer reusing an existing inbound channel; if a new key is unavoidable, it is the single allowable 19→20 expansion and must go through the full atomic lockstep (api-types + window-config array + preload + security.guard) like 06-01's `pickDirectory`. Until first-render read exists, a sensible interim is to default to 5000 on boot and apply the persisted value once read.
   - **RESOLVED:** Plan 07-01 adds `getUiState` as the 20th validated read key (19→20 atomic lockstep, `pickDirectory`-style), rather than widening the `listSessions` response shape. The renderer reads it in the boot effect (`window.api.getUiState()`) to seed the initial `scrollback` state; the default remains 5000 until the read resolves.

2. **Gear-icon placement (Claude's discretion, D-08).**
   - What we know: `Sidebar.tsx` has the collapse toggle (top) and the `+ Add session` button (bottom); both expanded and collapsed-rail modes exist.
   - What's unclear: expanded-body vs collapsed-rail placement.
   - Recommendation: place the gear near the collapse toggle / footer so it's reachable in both modes; UI-phase or planner decides per DESIGN.md. Not a research blocker.
   - **RESOLVED:** Plan 07-03 places the gear in the sidebar's pinned-control row at the top of `<nav>`, as a sibling of the existing collapse chevron (`.sidebar-collapse`), reachable in both expanded and collapsed-rail modes. It is NOT placed in the footer near `+ Add session` (those are distinct affordances).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@xterm/addon-search` | TERM-10 search | ✗ (not installed) | 0.15.0/0.16.0 target | None needed — install is trivial pure-JS, no native build |
| `@xterm/xterm` | both (runtime scrollback + addon peer) | ✓ | 5.5.0 | — |
| `@xterm/addon-webgl` | search decorations render target | ✓ | 0.18.0 | canvas fallback already wired (attachWebgl) |
| Node/npm | install the addon | ✓ | project toolchain | — |

**Missing dependencies with no fallback:** `@xterm/addon-search` must be installed (one `npm install`). No native rebuild required (pure JS).
**Missing dependencies with fallback:** none.

## Validation Architecture

> Nyquist validation is enabled for this project (Phase 6 recorded both VALIDATION flags true). This section maps every success criterion + requirement to a concrete approach. The project's test stack is **Vitest (`npm run test:unit`)** for pure/Node modules + **WebdriverIO `@wdio/electron-service` smoke (`npm run test:smoke`)** for renderer/integration + **macOS-first manual** for the interactive surface.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (unit, Node env) + WebdriverIO 9.x `@wdio/electron-service` 10 (smoke) + Mocha (wdio) |
| Config file | `wdio.conf.ts` (smoke); Vitest config via project default; pure tests in `src/**/__tests__/*.test.ts` |
| Quick run command | `npm run test:unit` (Vitest, runs all pure-module unit tests) |
| Full suite command | `npm run test` (`test:unit` then `test:smoke`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TERM-10 / D-02 | `matchSearchKey` returns `{kind:'search'}` for Cmd+F (mac) and Ctrl+F (win); returns `null` for macOS Ctrl+F (no readline theft — D-03), non-keyDown, and other keys | unit (pure) | `npm run test:unit` → `src/main/__tests__/switch-keys.test.ts` (extend) | ❌ Wave 0 — extend existing switch-keys.test.ts |
| TERM-10 / SC1 | Find chord opens the bar; typing + next/prev navigates matches in scrollback | integration (renderer) + manual | `npm run test:smoke` (best-effort drive) + macOS manual | ❌ Wave 0 smoke spec + manual |
| TERM-10 / SC3 | Esc dismisses the bar; when closed, keystrokes go to the PTY (no interference) | manual (macOS-first) + smoke assertion if drivable | macOS manual; optional smoke | ❌ Wave 0 manual checklist |
| TERM-10 / D-01 | "N of M" count populates (decorations-gated event); Aa toggles case-sensitivity | integration (renderer, needs DOM xterm) + manual | smoke / manual | ❌ Wave 0 |
| TERM-11 / D-04 | `clampScrollback(n)` clamps to 1000–50000, default 5000, non-finite → default | unit (pure) | `npm run test:unit` → new `src/main/__tests__/scrollback-clamp.test.ts` (or fold into store-schema.test.ts) | ❌ Wave 0 |
| TERM-11 / D-07 | `setUiState` accepts + clamps a valid scrollback, no-ops/clamps a forged/out-of-range payload (T-05-01) | unit (pure-ish, existing pattern) | `npm run test:unit` → extend `src/main/__tests__/pty-validation.test.ts` or session-store.test.ts | ❌ Wave 0 (extend) |
| TERM-11 / D-07 | scrollback survives reopen (persist → load round-trip) | unit | `npm run test:unit` → extend `src/main/__tests__/session-store.test.ts` / `store-schema.test.ts` | ❌ Wave 0 (extend) |
| TERM-11 / SC2 + D-05 | Changing the setting applies to new sessions AND live terms (`term.options.scrollback = N`) | manual (macOS-first) — needs live xterm | macOS manual | ❌ Wave 0 manual checklist |
| TERM-11 / D-06 | Lowering trims existing scrollback (accepted behavior) | manual | macOS manual | ❌ Wave 0 manual checklist |
| security invariant | `EXPECTED_API_KEYS` 19→20 (`getUiState` boot-read key added; search chord adds zero) and preload surface exact | unit | `npm run test:unit` → existing `src/shared/__tests__/security.guard.test.ts` (must stay GREEN at 20 keys) | ✅ exists — must remain passing |

### Sampling Rate
- **Per task commit:** `npm run test:unit` (fast; covers the pure matchers, clamp, validators, schema, security guard).
- **Per wave merge:** `npm run test` (adds smoke).
- **Phase gate:** full suite green + macOS-first manual checklist signed off before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Extend `src/main/__tests__/switch-keys.test.ts` — covers TERM-10/D-02/D-03 (search-chord matcher, incl. the macOS-Ctrl+F → null case).
- [ ] `src/main/__tests__/scrollback-clamp.test.ts` (or fold into store-schema.test.ts) — covers TERM-11/D-04 clamp.
- [ ] Extend `src/main/__tests__/pty-validation.test.ts` (or session-store.test.ts) — covers TERM-11/D-07 setUiState scrollback validate/clamp + persist round-trip.
- [ ] New smoke spec (wdio) for find-chord-opens-bar + count, if drivable through the existing xterm driver; otherwise document as manual-only with justification (renderer DOM + WebGL make headless match-count assertions brittle).
- [ ] macOS-first manual checklist: find chord opens bar; type + next/prev navigates; "N of M" updates; Aa toggles; Esc dismisses; closed bar does NOT interfere with PTY input; Preferences gear opens modal; scrollback change live-applies to open sessions + new sessions; decrease trims.
- Framework install: none — Vitest + wdio already present.

*Manual-only justification:* the interactive search bar, "N of M" against a real buffer, and live scrollback fan-out depend on a rendered xterm with a WebGL canvas; per the project's macOS-first convention and the existing precedent (Phase 6.1 used human-verify for terminal-frame behavior), the interactive surface is verified manually on macOS, with the pure logic (matchers, clamp, validators, schema) fully Vitest-covered.

## Security Domain

> `security_enforcement` is not disabled for this project. This phase adds a renderer-facing feature and one persisted preference, so the relevant controls are bridge-surface discipline and input validation — both already established invariants.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `setUiState` validates `scrollback` is a finite number and clamps to 1000–50000 before any disk write (T-05-01 validate-in-main). A forged/out-of-range `persistUiState` payload clamps or no-ops — never writes arbitrary data. The `clampScrollback` helper is the single chokepoint. |
| V12 File/Resource | yes | Renderer-never-touches-disk preserved — the scrollback pref persists ONLY through the existing validated main-side IPC; no new fs access in the renderer. |
| V1/V14 Architecture (bridge discipline) | yes | `EXPECTED_API_KEYS` 19→20 — search adds zero (rides `'session:switch'`); scrollback write rides `persistUiState` (no new key); the boot-read adds `getUiState` as the one new validated key (planner decision, see Open Questions Q1 RESOLVED). The `security.guard` test (asserts the exact contextBridge surface) MUST stay green at 20 — the new key went through the full atomic lockstep (api-types + window-config array + preload + guard). |
| V2/V3/V4 Auth/Session/Access | no | Local single-user desktop app; no auth surface introduced. |
| V6 Cryptography | no | No crypto introduced. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged `persistUiState` payload writing arbitrary/oversized scrollback | Tampering | Finite-number + range clamp in `setUiState` before write (existing T-05-01 pattern, extended). |
| ANSI/terminal injection via search highlight | Tampering | N/A — `SearchAddon` decorations are DOM/canvas overlays, not written into the PTY; search never injects into the shell (consistent with `handleClear` never injecting `clear`/Ctrl+L). |
| Unreviewed bridge key leak (e.g. raw `ipcRenderer`) | Elevation | `security.guard` test asserts exact `EXPECTED_API_KEYS`; riding existing channels keeps it at 19. |
| Search input chars leaking to the PTY | Tampering (wrong-target input) | DOM overlay `<input>` with `stopPropagation`; main-side chord interception + existing `attachCustomKeyEventHandler` focus gate. |

## Sources

### Primary (HIGH confidence)
- `@xterm/addon-search` TypeScript typings (github.com/xtermjs/xterm.js master, `addons/addon-search/typings/addon-search.d.ts`) — ISearchOptions (caseSensitive/regex/wholeWord/incremental/decorations), ISearchDecorationOptions, findNext/findPrevious signatures, onDidChangeResults (`resultIndex` -1 threshold, `resultCount`), clearDecorations/clearActiveDecoration. **decorations-gated event** confirmed verbatim ("When decorations are enabled, fires when the search results change").
- `@xterm/xterm` ITerminalOptions typings — `scrollback?: number` (default 1000), runtime-settable via `term.options`.
- npm registry (`npm view @xterm/addon-search`) — `latest = 0.16.0`, `0.15.0` peer `@xterm/xterm@^5.0.0`, `0.17.0-beta.*` pre-release line, ~379K weekly downloads, official xtermjs monorepo, no postinstall.
- slopcheck 0.6.1 `install @xterm/addon-search` → `[OK]`.
- Project source (read this session): SessionView.tsx, SessionManager.tsx, switch-keys.ts, store-schema.ts, api-types.ts, window-config.ts, preload/index.ts, pty-manager.ts (setUiState), session-store.ts (setUi), index.ts (before-input-event), security.guard.test.ts, ConfirmModal.tsx, package.json.

### Secondary (MEDIUM confidence)
- xterm.js 5.5.0 release/discussion (WebSearch) — search-decoration-over-WebGL cache desync (#5008) fixed in 5.5.0; the project pins 5.5.0.
- WebSearch on `onDidChangeResults` semantics — corroborates decorations-gated firing + -1 threshold sentinel (matches the typings).

### Tertiary (LOW confidence)
- Perf of live scrollback fan-out at ~50 sessions — reasoned, not load-tested (A1).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — addon verified on npm + slopcheck + official typings; scrollback runtime-settable cited from xterm typings.
- Architecture: HIGH — grounded in the actual existing Clear-chord + persistUiState patterns read this session; the phase is wiring into proven seams.
- Pitfalls: HIGH — the decorations-gated event, -1 sentinel, WebGL 5.5.0 fix, and platform-asymmetric find chord are all verified from authoritative sources.

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (stable; re-`npm view` the addon version at install time — the `latest` tag may advance toward a 5.6-only line).
