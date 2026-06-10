---
phase: 07-terminal-search-scrollback-config
plan: 03
subsystem: renderer-scrollback-config
tags: [scrollback, preferences, modal, gear, term-11, renderer-only, live-fan-out]
requires:
  - "07-01: clampScrollback (main) + ui.scrollback schema field + setUiState scrollback validate/clamp (T-07-01)"
  - "07-01: getUiState bridge read key (20th) — boot-read of validated UI prefs"
  - "07-01: persistUiState widened payload (scrollback rides the existing key, no new key)"
  - "07-02: SessionView .term-mount wrapper + SearchBar sibling structure (extended, not disturbed)"
  - "ConfirmModal overlay/dialog/Esc/focus-on-open a11y skeleton; .edit-field/.modal-* CSS idioms; .sidebar-collapse footprint"
provides:
  - "PreferencesModal.tsx — gear-launched extensible Preferences shell hosting the scrollback field (live-apply-on-commit, single Done)"
  - "scrollback-clamp.ts — pure renderer-side clampScrollback mirror (defense in depth; main stays the security boundary)"
  - "Sidebar ⚙ gear in a .sidebar-pinned control row beside the collapse chevron (dual-mode reachable) + onOpenPreferences prop"
  - "SessionManager scrollback state (boot-read via getUiState, default 5000) + handleSetScrollback (clamp + persist) + preferencesOpen"
  - "SessionView scrollback prop seeding new Terminal({ scrollback }) + a guarded live-apply useEffect (term.options.scrollback)"
affects:
  - "Plan 04 (macOS-first manual verification): the live fan-out (D-05), decrease-trim (D-06), and SC2 restore-on-boot sign-off runs against this UI"
tech-stack:
  added: []
  patterns:
    - "Owner-state + prop fan-out: SessionManager owns scrollback; each SessionView live-applies it via term.options.scrollback (guarded on actual change — Pitfall 5)"
    - "Defense-in-depth clamp: renderer clampScrollback (UX) mirrors the main clampScrollback (persistence security boundary); both [1000,50000] default 5000"
    - "Validate-in-main persist: scrollback rides the existing persistUiState payload (no new bridge key; surface stays 20); boot-read via getUiState"
    - "Modal idiom clone: PreferencesModal clones the ConfirmModal skeleton (NOT a generalization); extensible .prefs-body settings stack (D-08)"
key-files:
  created:
    - "src/renderer/scrollback-clamp.ts"
    - "src/renderer/__tests__/scrollback-clamp.test.ts"
    - "src/renderer/PreferencesModal.tsx"
  modified:
    - "src/renderer/Sidebar.tsx"
    - "src/renderer/SessionManager.tsx"
    - "src/renderer/SessionView.tsx"
    - "src/renderer/terminal.css"
decisions:
  - "Live-apply-on-commit with a single Done dismiss (07-UI-SPEC §2 default — Claude's Discretion): the scrollback input commits onChange (clamped) AND re-snaps onBlur, so no draft Save/Cancel split for one self-applying setting."
  - "Renderer clampScrollback is a hand-kept verbatim mirror of the main helper (NOT an import): importing src/main/store-schema would pull electron into the renderer bundle. The two are kept in sync intentionally; both unit-tested."
  - "The gear lives in a NEW .sidebar-pinned inline-flex row wrapping the collapse chevron + gear; .sidebar-collapse/.sidebar-prefs now share one CSS rule (28×28 radius-8 + blue focus ring). The row inherits the chevron's dual-mode (right-aligned expanded, centered collapsed)."
  - "SessionView mount effect stays keyed on [id] only — scrollback is the SEED at mount; live changes flow through the separate useEffect([scrollback]) (no term teardown on a scrollback change)."
  - "Zero new bridge keys: scrollback persist rides persistUiState; boot-read uses the getUiState key 07-01 added. EXPECTED_API_KEYS = 20, security.guard GREEN unchanged."
metrics:
  duration: ~16min
  tasks: 3
  files: 7
  completed: 2026-06-09
---

# Phase 7 Plan 03: TERM-11 Scrollback Config + Preferences Modal Summary

The complete TERM-11 vertical slice, end-to-end: a ⚙ gear in the sidebar's pinned-control row (beside the collapse chevron, reachable expanded + collapsed) opens an extensible Preferences modal whose single scrollback field (default 5000, clamp 1000–50000, no "unlimited") drives a SessionManager-owned `scrollback` value. On commit it (a) live-applies to every open terminal via `term.options.scrollback = N` (a renderer-side fan-out through the prop + a guarded SessionView effect — no PTY/main involvement), (b) seeds new sessions (`new Terminal({ scrollback })` replaces the old hardcoded 10000), and (c) persists through the existing validated `persistUiState` path and is read back on boot via the 07-01 `getUiState` key — so the change takes effect immediately and survives a restart (SC2 + D-05). Lowering trims off-screen rows (D-06, accepted). Zero new bridge keys; the surface stays at 20.

## What Was Built

**Task 1 — renderer clamp helper + Preferences modal shell (`ecdcf71`)**
- New `src/renderer/scrollback-clamp.ts`: a pure, electron-free `clampScrollback(n: unknown): number` mirroring the main `store-schema.ts` helper EXACTLY (`[1000, 50000]`, default 5000, non-finite/non-number → 5000, rounds). Defense in depth — the renderer clamp is the input UX; the main `setUiState` clamp remains the persistence security boundary. Hand-kept verbatim mirror (not an import — importing the main module would pull electron into the renderer bundle).
- New `src/renderer/__tests__/scrollback-clamp.test.ts` (7 cases, mirrors the main test): below-min → 1000, above-max → 50000, in-range passthrough, undefined/null → 5000, NaN/±Infinity → 5000, string/object/array → 5000, fractional rounds (3000.7 → 3001).
- New `src/renderer/PreferencesModal.tsx`: clones the `ConfirmModal` overlay/dialog/Esc/focus-on-open skeleton (NOT a generalization). Props `{ open, onClose, scrollback, onScrollbackChange }`; `if (!open) return null`; overlay `onClick={onClose}` + dialog `onClick={stopPropagation}`; Esc-to-close `useEffect([open, onClose])`; focuses + selects the scrollback input on open. Title "Preferences"; body is an extensible `.prefs-body` stack of `.edit-field` groups (one now — D-08). The scrollback field: `.edit-label` "Scrollback lines" + `<input type="number" min={1000} max={50000} step={1000}>` (`.edit-input`, `data-testid="pref-scrollback"`, `defaultValue` from the prop falling back to 5000) committing `clampScrollback(Number(raw))` onChange (live-apply) and re-snapping onBlur; `.idle-card-helper` line with the verbatim 07-UI-SPEC copy ("How many lines of history each terminal keeps. Between 1,000 and 50,000." + "Changes apply right away — to open terminals and new ones."). A single neutral `.modal-btn modal-btn-cancel` "Done" (`data-testid="preferences-done"`) dismiss — no destructive (red) styling.
- `.prefs-body` CSS added to `terminal.css` (vertical `.edit-field` stack; reuses the shipped modal/edit classes — no new shell CSS).

**Task 2 — sidebar gear (dual-mode reachable) + CSS (`8f7e6a3`)**
- `Sidebar.tsx`: added `onOpenPreferences: () => void` to `SidebarProps`; destructured it; rendered the ⚙ gear (`className="sidebar-prefs"`, glyph U+2699, `aria-label`/`title="Preferences"`, `data-testid="open-preferences"`) inside a NEW `.sidebar-pinned` inline-flex row that now wraps the collapse chevron + gear at the TOP of the `<nav>` — NOT the "+ Add session" footer (kept distinct from the create affordance).
- `terminal.css`: added `.sidebar-pinned` (right-aligned expanded, centered when collapsed — inherits the chevron's proven dual-mode handling); merged `.sidebar-collapse` and `.sidebar-prefs` into shared rules (28×28, radius 8px, transparent border, `--ink-soft` rest → `--bg-sunk`/`--ink` hover) + a shared blue `:focus-visible` ring. The gear is neutral at rest (no accent).

**Task 3 — SessionManager state/boot-read/fan-out + SessionView seed/live-apply (`6996904`)**
- `SessionManager.tsx`: added `scrollback` state (default 5000) + `preferencesOpen`; imported `PreferencesModal` + the renderer `clampScrollback`. Extended the boot effect to `await window.api.getUiState()` and seed `setScrollback(clampScrollback(ui.scrollback))` when present (RESEARCH Open Q1 resolved — persisted value seeds the live state). Added `handleSetScrollback` (clamp → `setScrollback` → `window.api.persistUiState({ scrollback })`), `handleOpenPreferences`, `handleClosePreferences`. Passed `onOpenPreferences` to `<Sidebar>`, `scrollback={scrollback}` to each `<SessionView>`, and rendered `<PreferencesModal>` alongside the other modals.
- `SessionView.tsx`: added the `scrollback: number` prop; replaced the hardcoded `scrollback: 10000` in the Terminal constructor with the prop (seed); added a guarded live-apply `useEffect(() => { if (term && term.options.scrollback !== scrollback) term.options.scrollback = scrollback; }, [scrollback])` (D-05 runtime-settable, Pitfall 5 change-guard, no re-fit, SearchAddon/WebGL lifecycle untouched). Mount effect stays keyed on `[id]` — scrollback is the seed; live changes flow through the new effect (no term teardown).

## Verification

- `npx tsc --noEmit`: clean (0 errors) across PreferencesModal/scrollback-clamp/Sidebar/SessionManager/SessionView + all touched files.
- `npm run test:unit`: **290 passed (36 files)** — the +7 from the new renderer `scrollback-clamp.test.ts` over the 283 baseline; all prior suites unchanged.
- `npx vitest run src/renderer/__tests__/scrollback-clamp.test.ts`: **7 passed** (renderer mirror).
- `src/shared/__tests__/security.guard.test.ts`: **4 passed** — `EXPECTED_API_KEYS` is exactly **20** (zero new bridge keys; scrollback rides persistUiState, boot-read via the existing getUiState).
- `npx eslint` on the five touched renderer files: clean (0 errors).
- `data-testid` count in PreferencesModal: 3 (`preferences-modal`, `pref-scrollback`, `preferences-done`). Sidebar gear: `open-preferences`.

## Deviations from Plan

None — plan executed as written. The live-apply-on-commit + single-"Done" model, the `.sidebar-pinned` wrapper row, and the verbatim-mirror (non-import) clamp were all explicitly specified by the plan / 07-UI-SPEC (the UI-SPEC "default — Claude's Discretion" recommendation for live-apply was followed). One minor, plan-sanctioned implementation choice: the scrollback input commits on BOTH `onChange` (live-apply) and `onBlur` (re-snap to the clamped bound + reflect it in the field) — the plan's "input's `onChange` debounced OR `onBlur` — prefer live-apply-on-commit" wording, satisfied by applying live on change and resolving the displayed value on blur (the input is never left invalid).

## Known Stubs

None. Every wired path carries real data: the Preferences field shows the live `scrollback` prop, the commit drives the real `handleSetScrollback` (clamp → state → persist), each SessionView seeds + live-applies the real value, and the boot effect restores the persisted value via `getUiState`. No hardcoded empty values flow to render. The SC2/D-05/D-06 LIVE behaviors (visual fan-out, decrease-trim, restore-on-restart) are manual-only per 07-VALIDATION.md and signed off in Plan 04 — implemented here, human-verified there (not a stub).

## Threat Flags

None. This slice adds zero new security surface: no new bridge key (`EXPECTED_API_KEYS` stays 20 — scrollback persist rides the existing `persistUiState`; boot-read uses the 07-01 `getUiState` read key), the renderer clamp is defense-in-depth only (main `setUiState` re-clamps a forged/out-of-range payload before any disk write — T-07-01), the live fan-out is a renderer-local scalar assignment (no IPC — T-07-07 accept), and `getUiState` returns only the validated UI prefs (T-07-06). All boundaries are accounted for in the plan's `<threat_model>` (T-07-01/02/06/07).

## Self-Check: PASSED
- Files: FOUND src/renderer/scrollback-clamp.ts, src/renderer/__tests__/scrollback-clamp.test.ts, src/renderer/PreferencesModal.tsx, src/renderer/Sidebar.tsx, src/renderer/SessionManager.tsx, src/renderer/SessionView.tsx
- Commits: FOUND ecdcf71, 8f7e6a3, 6996904
