---
status: complete
slug: design-wave1-token-contrast-status-badge
quick_id: 260621-dw1
date: 2026-06-21
branch: gsd/phase-03-multi-session-session-lifecycle
source: .planning/design/DESIGN-AUDIT-2026-06-21.md (Wave 1 of 4)
pending: human visual sign-off before Wave 2
---

# SUMMARY — Design Audit Wave 1 (token / contrast / status-badge)

3 **visible** P0s from the whole-app design audit cleared in one low-risk foundation pass.
CSS-only — no `src/` logic touched.

## What changed
- **P0-A — status badge now renders.** Added scoped `.status-badge` (pill) + `.status-dot`
  rules (`terminal-area.css`) for the two consumers (`.identity-header`, `.idle-card-identity`).
  Was: colorless run-in text + zero-size dot (the class had no CSS outside the sidebar's
  scoped rule). The sidebar's own `.status-dot` / `.collapsed-status-dot` are untouched
  (lower-specificity bare class, scoped selectors don't reach the sidebar).
- **P0-B — WCAG-AA contrast (computed, not guessed).** `tokens.css`:
  `--color-accent` 0.62→0.55 (white-on **3.62→4.83**), `--color-accent-strong` 0.58→0.51,
  `--ink-faint` 0.66→0.55 (**3.11→~4.85**). Darkening the token fixed every faint-text use
  at once and kept the 3-step ink gap; `--ink-soft` left as-is (6.0:1).
- **P0-C — semantic decouple.** `--accent-running` no longer `var(--color-accent)`; explicit
  `oklch(0.62 0.14 248)` so "running" (bright blue) ≠ "clickable" (now-darker accent).

## Verification
- `npm run test:unit` → **56 files / 480 tests PASS** (tokens-completeness incl.)
- `npx tsc --noEmit` → clean (CSS-only change)
- contrast recomputed via `.planning/design/contrast-check.mjs` — all AA (proof above)
- **ui-lab before/after** (`UI_LAB_LIVE_CSS=1`, tags `wave1-before` / `wave1-after`):
  `terminal-card` identity badge now renders a pill + colored dot (was bare text);
  `Restart now` / accent buttons render a deeper blue. Screenshots in
  `artifacts/ui-lab/wave1-{before,after}/` (gitignored — local evidence).

## Files
- `src/renderer/tokens.css` (3 token edits)
- `src/renderer/terminal-area.css` (+ scoped `.status-badge` / `.status-dot`)

## Deferred (not this wave)
`--radius`→`--radius-card` rename → Wave 3 · spacing-literal migration → Wave 3 ·
xterm `TERMINAL_THEME` → Wave 4 · running-blue re-hue to cyan → Wave 4 option.

## Next
Human visual sign-off (operator eyeball) → then Wave 2 (keyboard/focus a11y).
