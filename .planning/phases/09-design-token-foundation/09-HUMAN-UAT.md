---
status: pending
phase: 09-design-token-foundation
source: [09-VALIDATION.md, 09-03-PLAN.md]
started: 2026-06-11
updated: 2026-06-11
---

## Current Test

[awaiting human visual verification of the running app — end-of-phase gate]

## Context

This is the end-of-phase human-verify gate for Phase 09 (Design Token Foundation).
Everything below was proven automatically before this checklist:

- `tokens.css` is the single source of truth; the global primitives in
  `terminal.css` + `status-colors.ts` are migrated to `var()` / `color-mix` (Plan 02).
- Nunito + JetBrains Mono are installed (`@fontsource/nunito`, `@fontsource/jetbrains-mono`),
  imported, and **proven to survive packaging** — `npm run verify:fonts` after
  `npm run make` confirms 23 woff2 are emitted as relative-path renderer assets
  with no absolute `url(/...)` font path (commit `2404754`, Task 1).

`09-VALIDATION.md` `nyquist_compliant` flips `true` ONLY on the human "approved"
signal recorded here. The contract is **value-preserving**: same layout, colors,
spacing, radius, and the ~4 hover-wash backgrounds — the signature fonts are the
ONLY intended visible change. Any OTHER visible difference is a regression to report.

## How to Launch

Either:

- `npm start` (Electron Forge dev), or
- open the packaged build from Task 1: `out/` → the `.app` produced by `npm run make`
  (darwin/arm64 zip distributable under `out/make/`).

## Tests

### 1. FONTS RENDER (Nunito UI + JetBrains Mono terminal)
expected: UI text renders in **Nunito** (rounded geometric sans), and the terminal +
any mono fields render in **JetBrains Mono** — NOT the previous system-ui / generic
`monospace` fallback. The typographic identity matches the Switchboard mockup's
(`.planning/design/switchboard-mockup.html`) and the DESIGN north-star (warm cozy
"parlour", friendly geometric sans for UI, monospace only inside terminals).
result: [pending]

### 2. SC1 COHERENCE (one warm cohesive design system)
expected: The sidebar, terminal chrome, modals/forms, and cards read as ONE warm,
cohesive design system — colors, type, and surfaces clearly belong together, not
piecemeal. Cream/ivory surfaces, generous rounding, calm low-contrast chrome.
result: [pending]

### 3. VALUE-PRESERVING (fonts are the only intended visible change)
expected: The layout, colors, spacing, radius, and the ~4 hover-wash backgrounds
(Start hover, Close hover, search-case-active, and the running-status accent wash)
look identical to before. The fonts are the ONLY intended visible change. Any other
visible difference (shifted spacing, changed color, missing hover wash, broken
alignment) is a regression to report here.
result: [pending]

### 4. SC3 RE-THEME FROM ONE PLACE (single source of truth)
expected: Temporarily change `--color-accent` in `src/renderer/tokens.css` to a
visibly different hue (e.g. a green like `oklch(0.7 0.15 150)`), reload the app, and
confirm EVERY accent surface — focus rings, Start buttons, CTAs, running-status accent —
shifts together to the new hue. Then **REVERT** the change so the original warm accent
is restored before approving.
result: [pending]

### 5. SC4 FIDELITY (terminal still behaves like a native terminal)
expected: A session still launches and behaves like a native terminal — type a command,
optionally run `claude --rc` or `vim` — input, output, ANSI colors, and resize all work.
The terminal is visually unchanged by this phase.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
partial: 0
skipped: 0
blocked: 0

## Gaps

(Automated SC4/D-05 packaging proof is GREEN — 23 woff2 emitted as relative assets,
no absolute font url, `npx tsc --noEmit` clean. Remaining items are the subjective,
human-only checks: SC1 coherence, value-preserving regression eyeballing, the SC3
re-theme live demonstration, and a terminal-fidelity sanity pass. `nyquist_compliant`
does not flip without the explicit human "approved" signal.)
