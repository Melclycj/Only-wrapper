---
phase: 07-terminal-search-scrollback-config
verified: 2026-06-10T00:48:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification: []
---

# Phase 7: Terminal Search + Scrollback Config — Verification Report

**Phase Goal:** Terminal Search (TERM-10) + Scrollback Config (TERM-11) — a user can search a session's scrollback (find chord → bar → highlighted matches → N-of-M navigation → case toggle), and the scrollback buffer size is configurable via a global Preferences setting with a sensible default that live-applies and persists.
**Verified:** 2026-06-10T00:48:00Z
**Status:** passed
**Re-verification:** No — initial verification (post human-UAT sign-off)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pressing the find chord (Cmd+F macOS / Ctrl+F Windows) opens an in-terminal search bar; macOS Ctrl+F returns null (readline forward-char preserved) | ✓ VERIFIED | `matchSearchKey` in `switch-keys.ts` lines 131-145: darwin+meta→`{kind:'search'}`, darwin+control→null, win32+control→`{kind:'search'}`. Wired in `src/main/index.ts` lines 119-127 inside `before-input-event`; `preventDefault()` called on match so chord never reaches PTY. |
| 2 | The search bar renders with a text input, next/prev navigation buttons, N-of-M count, Aa case toggle, and close button | ✓ VERIFIED | `src/renderer/SearchBar.tsx`: `data-testid="search-bar"`, `data-testid="search-input"`, `data-testid="search-count"`, `data-testid="search-prev"`, `data-testid="search-next"`, `data-testid="search-case"`, `data-testid="search-close"` all present. Count logic handles empty/zero/over-threshold/-1 sentinel. |
| 3 | Match decorations use regex-safe rgba()/hex colours (not oklch) so highlights actually paint on the WebGL canvas | ✓ VERIFIED | `SearchBar.tsx` MATCH_DECORATIONS (lines 53-66): `matchBackground: 'rgba(211, 120, 18, 0.32)'`, `activeMatchBackground: 'rgba(255, 145, 40, 0.9)'`, `matchOverviewRuler: '#d37812'`, `activeMatchColorOverviewRuler: '#ff9128'`. No oklch. G3 root cause explicitly documented and fixed. |
| 4 | Case (Aa) toggle recomputes from top of results without advancing the active match | ✓ VERIFIED | `search-recompute.ts`: `decideCaseToggle(query)` returns `{shouldRecompute: query.length > 0}`. `SearchBar.handleToggleCase` calls `onResetSearchPositionRef.current?.()` (→ `term.clearSelection()`) before re-issuing `findNext` with flipped `caseSensitive`. G4 fix documented. |
| 5 | Search bar auto-focuses on open; terminal refocuses when bar closes | ✓ VERIFIED | `SearchBar.tsx` line 267: `<input ... autoFocus>`. `SessionView.tsx` lines 580-591: activate effect guards `term.focus()` on `!searchOpen`. Lines 601-608: falling-edge `searchOpen` effect refocuses term. G1/G5 fixes documented. |
| 6 | SearchAddon is mounted per terminal instance (not per search) and disposed before term.dispose() | ✓ VERIFIED | `SessionView.tsx` lines 249-252: `const search = new SearchAddon(); searchRef.current = search; term.loadAddon(search); setSearchReady(true)`. Cleanup lines 553-555: `searchRef.current?.dispose(); searchRef.current = null`. Mounted once per `id`-keyed effect. |
| 7 | clampScrollback clamps inputs to [1000, 50000] with default 5000 for invalid values | ✓ VERIFIED | `store-schema.ts` lines 60-63: `if (typeof n !== 'number' || !Number.isFinite(n)) return SCROLLBACK_DEFAULT; return Math.max(SCROLLBACK_MIN, Math.min(SCROLLBACK_MAX, Math.round(n)))`. Constants: MIN=1000, MAX=50000, DEFAULT=5000. |
| 8 | setUiState validates and clamps scrollback in main; forged/out-of-range payload clamps or no-ops | ✓ VERIFIED | `pty-manager.ts` lines 1099-1106: `const { scrollback } = ui as { scrollback?: unknown }; if (typeof scrollback === 'number' && Number.isFinite(scrollback)) { this.uiState.scrollback = clampScrollback(scrollback); }`. Non-finite/non-number falls through without write. |
| 9 | The preload surface exposes exactly 20 keys (getUiState added); security guard is GREEN | ✓ VERIFIED | `window-config.ts` EXPECTED_API_KEYS: 20 entries confirmed by node parse. `getUiState` is the 20th entry. `npm run test:unit` 292 passed (37 files) — security.guard.test.ts included and GREEN. |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/SearchBar.tsx` | Search bar overlay component with MATCH_DECORATIONS in rgba/hex | ✓ VERIFIED | 325 lines, fully substantive. All 5 interactive behaviours (input, nav, count, toggle, close) wired. MATCH_DECORATIONS fixed to rgba/hex after oklch root-cause diagnosis. |
| `src/renderer/search-recompute.ts` | Pure `decideCaseToggle` helper for G4 recompute-vs-no-op decision | ✓ VERIFIED | File exists, 43 lines, pure function, no electron/xterm imports. |
| `src/renderer/SessionView.tsx` | SearchAddon mount, SearchBar prop wiring, G1/G5 focus, scrollback live-apply effect | ✓ VERIFIED | SearchAddon loaded once (line 249), SearchBar rendered as sibling (line 642), scrollback live-apply effect (lines 618-623), G1 guard (line 584), G5 falling-edge effect (lines 601-608). |
| `src/main/switch-keys.ts` | `{kind:'search'}` SwitchIntent variant + `matchSearchKey(i, platform)` | ✓ VERIFIED | Union variant at line 27. `isKeyF` at lines 111-113. `matchSearchKey` at lines 131-145 with explicit platform asymmetry. |
| `src/main/store-schema.ts` | `ui.scrollback?: number` schema field + `clampScrollback` pure helper | ✓ VERIFIED | `scrollback?: number` in `StoreSchema.ui` (line 41). `clampScrollback` at lines 60-63. Constants SCROLLBACK_MIN/MAX/DEFAULT at lines 45-47. SCHEMA_VERSION remains 2. |
| `src/main/window-config.ts` | EXPECTED_API_KEYS == 20 with `getUiState` | ✓ VERIFIED | Exactly 20 entries, `getUiState` present. |
| `src/preload/index.ts` | `getUiState: () => ipcRenderer.invoke('pty:get-ui-state')` + widened `persistUiState` payload | ✓ VERIFIED | `getUiState` at line 194 invokes `pty:get-ui-state`. `persistUiState` payload includes `scrollback?: number` at line 174. |
| `src/renderer/PreferencesModal.tsx` | Global scrollback setting UI | ✓ VERIFIED | File exists, imports `clampScrollback`, exposes `data-testid="pref-scrollback"` input, calls `onScrollbackCommit` on change. |
| `src/renderer/scrollback-clamp.ts` | Renderer-side pure clamp mirror | ✓ VERIFIED | File exists, mirrors `store-schema.ts` clampScrollback. Used by PreferencesModal and SessionManager. |
| `src/main/__tests__/scrollback-clamp.test.ts` | Unit test for clampScrollback | ✓ VERIFIED | File exists; part of the 292-passed suite. |
| `src/renderer/__tests__/search-recompute.test.ts` | Unit test for decideCaseToggle | ✓ VERIFIED | File exists; part of the 292-passed suite (+2 over the pre-07-05 baseline of 290). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main/index.ts` | `matchSearchKey` | `before-input-event`, `process.platform` arg | ✓ WIRED | Lines 11 (import), 123 (`const search = matchSearchKey(key, process.platform)`), 124-127 (`event.preventDefault()` + `send('session:switch', search)`). |
| `src/main/index.ts` | `pty:get-ui-state` channel | `ipcMain.handle` in `pty-manager.ts` | ✓ WIRED | `pty-manager.ts` line 1234: `ipcMain.handle(PTY_CHANNELS.getUi, () => this.getUiState())`. `PTY_CHANNELS.getUi = 'pty:get-ui-state'` at line 68. Torn down symmetrically at line 1258. |
| `src/preload/index.ts` | `pty:get-ui-state` | `ipcRenderer.invoke('pty:get-ui-state')` | ✓ WIRED | Line 194: `getUiState: (): Promise<{...}> => ipcRenderer.invoke('pty:get-ui-state')`. |
| `SessionManager` | `getUiState` boot-read | `window.api.getUiState()` in mount effect | ✓ WIRED | `SessionManager.tsx` line 468: `const ui = await window.api.getUiState()`. If `ui.scrollback` is a number, `setScrollback(clampScrollback(ui.scrollback))` is called. |
| `SessionManager` | `persistUiState({ scrollback })` | `window.api.persistUiState` on commit | ✓ WIRED | `SessionManager.tsx` line 130: `window.api.persistUiState({ scrollback: clamped })` inside `handleSetScrollback`. |
| `SessionManager` | `searchOpenId` toggle | `onSwitchSession` handler, `intent.kind === 'search'` | ✓ WIRED | `SessionManager.tsx` lines 529-541: `kind === 'search'` toggles `setSearchOpenId(prev => prev === cur ? null : cur)`. |
| `SessionView` | `searchOpen` prop | `s.logicalId === activeId && searchOpenId === s.logicalId` | ✓ WIRED | `SessionManager.tsx` line 672: prop computed as conjunction — a backgrounded session never shows the bar even if its id is searchOpenId. |
| `SessionView` | `scrollback` prop fan-out | `scrollback={scrollback}` in SessionView render | ✓ WIRED | `SessionManager.tsx` line 677: `scrollback={scrollback}` fanned to every SessionView. `SessionView` seeds `new Terminal({ scrollback })` and live-applies via `term.options.scrollback = scrollback` on prop change. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SessionView` (`new Terminal({ scrollback })`) | `scrollback` prop | `SessionManager` state seeded from `getUiState()` → `pty-manager.getUiState()` → `this.uiState.scrollback` (persisted lowdb value) | Yes — reads from lowdb store via validated IPC invoke | ✓ FLOWING |
| `SessionView` (scrollback live-apply) | `term.options.scrollback` | `PreferencesModal` → `handleSetScrollback` → `setScrollback` state → prop | Yes — user input clamped renderer-side, persisted via `persistUiState`, fanned to all open terms | ✓ FLOWING |
| `SearchBar` (`matchState`) | `matchState.index / matchState.count` | `addon.onDidChangeResults` subscription — fired by xterm SearchAddon after `findNext` / `findPrevious` | Yes — driven by live xterm buffer scan; count is only populated when `decorations` is passed (documented pitfall handled) | ✓ FLOWING |
| `SearchBar` (MATCH_DECORATIONS) | `matchBackground / activeMatchBackground` | Hard-coded `rgba()` / hex constants | N/A — static config values that must parse correctly; xterm's `css.toColor` accepts rgba/hex (G3 root cause fixed) | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit suite all pass (292 tests, 37 files) | `npm run test:unit` | 292 passed (37 files), 952ms | ✓ PASS |
| TypeScript type-check clean | `npx tsc --noEmit` | Exit 0, no errors | ✓ PASS |
| ESLint clean on key renderer files | `npx eslint src/renderer/SearchBar.tsx src/renderer/search-recompute.ts src/main/switch-keys.ts src/main/store-schema.ts` | Exit 0, no warnings | ✓ PASS |
| EXPECTED_API_KEYS count exactly 20 | node parse of `window-config.ts` | 20 entries, `getUiState` present | ✓ PASS |
| @xterm/addon-search pure-JS (no native rebuild) | `node_modules/@xterm/addon-search/package.json` | version 0.15.0, no `scripts.install`, no `scripts.postinstall` | ✓ PASS |

---

### Probe Execution

No probe scripts (`scripts/*/tests/probe-*.sh`) exist in this project. Phase uses `npm run test:unit` + macOS-first manual as the validation contract — both complete.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TERM-10 | 07-01, 07-02, 07-04, 07-05 | User can search a session's scrollback (Ctrl+F) | ✓ SATISFIED | Find chord → SearchBar overlay → SearchAddon findNext/Prev → N-of-M count → case toggle → Esc dismiss. All 5 G1..G5 defects closed (human-verified 2026-06-10). |
| TERM-11 | 07-01, 07-03 | Scrollback buffer size configurable via global setting with sensible default | ✓ SATISFIED | `clampScrollback` [1000-50000] default 5000, `setUiState` validates/clamps in main, `getUiState` boot-read, `persistUiState` scroll payload, PreferencesModal UI, live-apply to open sessions, persist/load round-trip. Human-verified 2026-06-10 (passed fully on initial run). |

REQUIREMENTS.md traceability table marks both TERM-10 and TERM-11 Complete under Phase 7.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD / FIXME / XXX markers in any phase-7 file | — | — |
| — | — | No TODO / HACK / PLACEHOLDER in phase-7 files | — | — |
| — | — | No oklch colours in MATCH_DECORATIONS (was the G3 root cause; corrected to rgba/hex) | — | — |

No anti-patterns found in the phase-7 modified files (`SearchBar.tsx`, `SessionView.tsx`, `search-recompute.ts`, `switch-keys.ts`, `store-schema.ts`, `PreferencesModal.tsx`, `scrollback-clamp.ts`, `window-config.ts`, `preload/index.ts`, `pty-manager.ts`).

---

### Human Verification Required

All interactive behaviors were human-verified on macOS on 2026-06-10 per the project's macOS-first convention. The following surfaces are confirmed closed by `07-HUMAN-UAT.md` (signed-off, `nyquist_signed_off: true`):

- Find chord opens bar; type + next/prev navigates; "N of M" updates (TERM-10 / SC1) — ✓ PASSED
- Match decorations visually highlight with amber wash / bright-orange active (TERM-10 / D-01) — ✓ PASSED (G3 fix verified)
- Aa toggle recomputes without advancing active match (TERM-10 / D-01) — ✓ PASSED (G4 fix verified)
- Search input auto-focuses on bar open (TERM-10 / SC1) — ✓ PASSED (G1 fix verified)
- Esc / ✕ dismisses bar; closed bar does not intercept terminal keystrokes (TERM-10 / SC3) — ✓ PASSED
- Terminal refocuses when bar closes (TERM-10 / SC3) — ✓ PASSED (G5 fix verified)
- macOS Ctrl+F does NOT open the search bar (readline forward-char survives — D-03) — ✓ PASSED
- Preferences gear opens modal showing current scrollback (TERM-11 / SC2) — ✓ PASSED
- Scrollback change live-applies to open + new sessions (TERM-11 / SC2 / D-05) — ✓ PASSED
- Out-of-range value snaps to nearest bound with hint (TERM-11 / D-04) — ✓ PASSED
- Lowering scrollback trims existing rows (TERM-11 / D-06) — ✓ PASSED
- Value persists across full quit + reopen (TERM-11 / D-07) — ✓ PASSED

No outstanding human verification items remain. Status is `passed` (not `human_needed`) because all human verifications are already complete and signed off.

---

### Gaps Summary

No gaps. All 9 observable truths are VERIFIED, all artifacts exist and are substantive and wired, data flows end-to-end, both requirements (TERM-10 + TERM-11) are satisfied, and the security guard passes at exactly 20 keys. The 5 search defects (G1..G5) surfaced during human-verify were closed in plan 07-05 and re-verified on macOS 2026-06-10. The phase goal is fully achieved.

---

_Verified: 2026-06-10T00:48:00Z_
_Verifier: Claude (gsd-verifier)_
