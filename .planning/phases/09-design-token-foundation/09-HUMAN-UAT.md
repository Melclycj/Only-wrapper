---
status: passed
phase: 09-design-token-foundation
source: [09-VALIDATION.md, 09-03-PLAN.md]
started: 2026-06-11
updated: 2026-06-11
approved: 2026-06-11
---

## Current Test

[COMPLETE — operator approved end-of-phase gate 2026-06-11; "approve — close Phase 9".
nyquist_compliant flipped true in 09-VALIDATION.md on this signal.]

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
result: [PASS] — operator confirmed ("approve"). Corroborated by the ui-lab screenshots:
Nunito UI text + JetBrains Mono terminal output are visible in
`artifacts/ui-lab/phase9-baseline/*.png` (empty-state, sidebar-populated, terminal-running).

### 2. SC1 COHERENCE (one warm cohesive design system)
expected: The sidebar, terminal chrome, modals/forms, and cards read as ONE warm,
cohesive design system — colors, type, and surfaces clearly belong together, not
piecemeal. Cream/ivory surfaces, generous rounding, calm low-contrast chrome.
result: [PASS AT FOUNDATION SCOPE] — honest operator verdict: "the UI is still ugly."
Resolution agreed with the operator: Phase 9 is the design-TOKEN + FONT FOUNDATION
(single source of truth + signature typography), NOT per-surface visual polish. The
tokens cohere as a system and the warm palette/type is in place; the remaining visual
ugliness is per-surface composition work owned by Phases 10–13. The operator explicitly
chose "Approve — close Phase 9" with the specific gaps logged below (see `## Gaps`). This
is NOT an unqualified coherence pass — it is a pass on the foundation scope this phase owns.

### 3. VALUE-PRESERVING (fonts are the only intended visible change)
expected: The layout, colors, spacing, radius, and the ~4 hover-wash backgrounds
(Start hover, Close hover, search-case-active, and the running-status accent wash)
look identical to before. The fonts are the ONLY intended visible change. Any other
visible difference (shifted spacing, changed color, missing hover wash, broken
alignment) is a regression to report here.
result: [PASS] — operator confirmed no unintended visible changes; the fonts are the only
intended visible change, layout/colors/spacing/radius/hover-washes preserved.

### 4. SC3 RE-THEME FROM ONE PLACE (single source of truth)
expected: Temporarily change `--color-accent` in `src/renderer/tokens.css` to a
visibly different hue (e.g. a green like `oklch(0.7 0.15 150)`), reload the app, and
confirm EVERY accent surface — focus rings, Start buttons, CTAs, running-status accent —
shifts together to the new hue. Then **REVERT** the change so the original warm accent
is restored before approving.
result: [PASS] — verified mechanically via the ui-lab SC3 demo. A green `--color-accent`
`:root` override shifted the Create-a-session CTA AND all Running-status accents together
while the Finished/Idle ramps stayed independent. Evidence:
`artifacts/ui-lab/sc3-green-demo/empty-state.png` + `sidebar-populated.png` vs the
`artifacts/ui-lab/phase9-baseline/` equivalents. Zero source edits, zero residue (the
override was applied at capture time only); operator reviewed the evidence in-session.

### 5. SC4 FIDELITY (terminal still behaves like a native terminal)
expected: A session still launches and behaves like a native terminal — type a command,
optionally run `claude --rc` or `vim` — input, output, ANSI colors, and resize all work.
The terminal is visually unchanged by this phase.
result: [PASS] — operator confirmed the terminal behaves natively and is visually unchanged
(Core-Value fidelity preserved; the xterm/PTY data path was untouched this phase).

## Summary

total: 5
passed: 5
issues: 0
pending: 0
partial: 0
skipped: 0
blocked: 0

(Check 2 SC1 COHERENCE is recorded as PASS-AT-FOUNDATION-SCOPE — see its honest note.
The 5 checks were operator-approved on 2026-06-11; `nyquist_compliant` is now true.)

## Gaps

All 5 end-of-phase checks PASSED (Check 2 at foundation scope). Automated SC4/D-05 packaging
proof was GREEN before the gate — 23 woff2 emitted as relative assets, no absolute font url,
`npx tsc --noEmit` clean.

### Deferred visual gaps (observations for downstream phases — NOT failures of Phase 9)

These are the operator's honest "the UI is still ugly" specifics, captured from the ui-lab
`artifacts/ui-lab/phase9-baseline/` evidence. They are per-surface COMPOSITION work, which is
explicitly the scope of Phases 10–13 — Phase 9 only owns the token + font foundation. None of
these block Phase 9; each is routed downstream.

| # | Gap | Severity | Surface | status | route | Evidence |
|---|-----|----------|---------|--------|-------|----------|
| 1 | Sidebar row names crushed to ~1 visible character (edit/close controls eat the width) — session identity invisible | S1 | sidebar | deferred | Phase 10 (first per operator) | `phase9-baseline/sidebar-populated.png` |
| 2 | Terminal pane is an unframed hard rectangle slammed edge-to-edge — design calls for a rounded card with breathing room | S1 | terminal | deferred | Phase 11 | `phase9-baseline/terminal-running.png` |
| 3 | Edit-modal Save button has no accent fill — primary action reads weaker than Cancel | S2 | session form | deferred | Phase 12 | `phase9-baseline/edit-modal.png` |
| 4 | Context menu opens mispositioned (overlaps sidebar header) and Remove is not in the danger ramp | S2 | sidebar / context menu | deferred | Phase 10 / 13 | `phase9-baseline/context-menu.png` |
| 5 | Inactive sidebar rows have no card structure / hierarchy — float unanchored | S2 | sidebar | deferred | Phase 10 | `phase9-baseline/sidebar-populated.png` |
