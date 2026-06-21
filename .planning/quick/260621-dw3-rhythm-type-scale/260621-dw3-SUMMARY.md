---
status: complete
slug: rhythm-type-scale
quick_id: 260621-dw3
date: 2026-06-21
branch: gsd/phase-03-multi-session-session-lifecycle
source: .planning/design/DESIGN-AUDIT-2026-06-21.md (Wave 3 of 4)
pending: human visual sign-off before Wave 4
---

# SUMMARY — Design Audit Wave 3 (rhythm + type scale + radius rename)

Closed the audit's token-application debt. CSS-only; implemented by an opus executor, the
full diff + value-preservation audited line-by-line by the orchestrator, before/after
captured + byte-compared.

## What changed
- **25 spacing literals → `--space-*`** (all value-preserving exact matches: 4→space-1,
  8→space-2, 10→space-2_5, 12→space-3, 16→space-4, 24→space-6, 32→space-8, 48→space-12 …).
- **`--text-*` scale (5 steps)** added to tokens.css: xs 12 / sm 13 / base 14 / lg 18 / xl 20.
  Font-size literals migrated onto it. Glyph/emoji sizes (10/11/15/16/18/28/48) kept as
  literals (not type). The 13↔14 body pair kept as two steps (folding deferred, not silent).
- **`--radius` → `--radius-card`** renamed + all 5 consumers updated; **zero bare `var(--radius)`
  remains** (verified by grep). Also folded 9 mapped `border-radius` literals onto the radius scale.

## Value-CHANGING edits (only 3 — exhaustive, all 1px)
1. `.modal-title` font-size 17px → 18px (`--text-lg`) — form.css.
2. `.context-menu-item` vertical padding 7px → 8px (`--space-2`) — form.css.
3. `.rail-tooltip` padding 5px → 6px (`--space-1_5`) — sidebar.css.

## Verification
- `npm run test:unit` → **481 passed** (+1 new token-floor test asserting `--text-*` +
  `--radius-card` exist and bare `--radius` is gone) · `npx tsc --noEmit` → clean.
- `grep var(--radius)` → none (only `--radius-card` / `--radius-xs..xl`).
- **ui-lab before/after** (`wave3-before` / `wave3-after`): byte-compared all surfaces.
  Differences = the 3 snap sites + surfaces showing the live terminal timestamp; `search-bar`
  before/after confirmed pixel-identical except the timestamp → migration is regression-free.

## Files
`tokens.css`, `terminal.css`, `terminal-area.css`, `sidebar.css`, `form.css`,
`__tests__/tokens-completeness.test.ts`.

## Note
`.prettierrc.json` config debt (from dw2) still open — operator to run the one-liner. This
wave is CSS-only so it was unaffected; only the one `.ts` test file was normalized to
single-quote via Bash prettier.

## Deferred
Wave 4 (optional flagship): xterm ANSI palette coordination, status signal-language
elevation, designed empty state, subtle motion.
