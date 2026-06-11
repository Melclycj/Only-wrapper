---
phase: 09-design-token-foundation
plan: 01
subsystem: renderer-design-tokens
tags: [css-tokens, fonts, fontsource, refactor-foundation, value-preserving]
requires:
  - "DESIGN.md token values (visual authority)"
  - "terminal.css existing :root block (structural precedent)"
provides:
  - "src/renderer/tokens.css — the single :root design-token layer (D-02/D-03/D-04)"
  - "@fontsource/nunito + @fontsource/jetbrains-mono installed (D-05) — Nunito UI + JetBrains Mono now render for real"
  - "renderer entry import order: fonts → tokens.css → terminal.css"
affects:
  - "Plan 09-02 (migrates terminal.css + status-colors.ts literals onto these tokens)"
  - "Phases 10–13 (consume --space-* + the token set during per-surface polish)"
tech-stack:
  added:
    - "@fontsource/nunito@5.2.7 (exact-pinned)"
    - "@fontsource/jetbrains-mono@5.2.8 (exact-pinned)"
  patterns:
    - "CSS custom properties as single source of truth (:root layer, plain CSS)"
    - "@fontsource per-weight imports (latin subset, font-display:swap), no CDN — local-only"
    - "value-preserving token derivation (every value carried verbatim)"
key-files:
  created:
    - "src/renderer/tokens.css"
  modified:
    - "package.json"
    - "package-lock.json"
    - "src/renderer/index.tsx"
decisions:
  - "D-04 Discretion: kept --radius (18px) as an alias rather than renaming to --radius-xl in lockstep — minimizes churn at the ~3 card sites that use var(--radius); both are value-preserving (RESEARCH A3 / Open-Q2)"
  - "Wave 1 scope: this plan ADDS the token home + loaded fonts ONLY; it migrates NO literal — terminal.css and status-colors.ts keep their literals until Plan 02 (D-01 hybrid scope)"
metrics:
  duration: ~9min
  completed: 2026-06-11
  tasks: 2
  files: 4
---

# Phase 9 Plan 01: Design Token Foundation — Font Install + tokens.css Layer Summary

Established the Phase 9 design-token home: installed self-hosted Nunito + JetBrains Mono via `@fontsource` (exact-pinned, no CDN), created `src/renderer/tokens.css` as the complete value-preserving `:root` token layer (colors, status accents, radius, shadow, motion, font stacks, and the defined-not-applied `--space-*` scale), and wired the renderer entry to load fonts → `tokens.css` → `terminal.css` so `@font-face` and `:root` vars exist before the consuming stylesheet parses. This is Wave 1 — it produces the token layer and the loaded fonts that Plan 02's migration consumes; no literal in `terminal.css`/`status-colors.ts` is migrated here.

## What Was Built

- **Fonts installed (D-05):** `@fontsource/nunito@5.2.7` + `@fontsource/jetbrains-mono@5.2.8`, exact-pinned (no caret), landing alphabetically between `@dnd-kit/*` and `@xterm/*` in `package.json` dependencies. Both have an empty `postinstall` (confirmed via `npm view`) — no install-time script surface.
- **`src/renderer/tokens.css` (NEW, 87 lines):** the single `:root` design-token layer carrying every value verbatim from `terminal.css` / `status-colors.ts` / DESIGN.md. Defines: surface/ink/line (incl. `--bg` from DESIGN.md not previously in `:root`); terminal palette `--term-bg` + new `--term-text`/`--term-faint` (CSS gutter only, NOT routed into the xterm JS theme); brand `--color-accent`/`--color-accent-strong`/`--color-danger`/`--color-danger-strong`; the 5 `--accent-*` status accents; `--radius-xs..--radius-xl` + the `--radius` alias; the 3 `--shadow-*` elevations; `--duration-fast`/`--ease-standard`; `--font-ui`/`--font-mono`; and the full `--space-0_5..--space-12` scale (defined-not-applied this phase).
- **`src/renderer/index.tsx` (MODIFY):** the 5 font CSS files import FIRST (`nunito/400|600|700`, `jetbrains-mono/400|700`), then `./tokens.css` BEFORE the existing `./terminal.css`; the `SessionManager` import and the explanatory comment block are preserved.

## Verification

- `npx tsc --noEmit` — exit 0 (clean).
- `npm run test:unit` — GREEN: 38 files, 317 tests passed (no migration yet, so `status-colors.test.ts` stays green against the existing literals; `security.guard` stays at 20 keys).
- `npm run lint` on the changed files (`src/renderer/index.tsx`, `src/renderer/tokens.css`) — 0 errors (the CSS "ignored" line is the expected eslint-doesn't-lint-CSS notice).
- `forge.config.ts` and `vite.renderer.config.ts` — unchanged (`git diff` empty); no packaging change, per RESEARCH (fonts are relative-base renderer assets, not native modules).
- `git diff --name-only HEAD~1 HEAD` — exactly `package.json`, `package-lock.json`, `src/renderer/index.tsx`, `src/renderer/tokens.css`; no deletions.

## Deviations from Plan

None functional. The plan executed exactly as written for Task 2. The pre-approved supply-chain gate (Task 1) was confirmed (both packages resolve at the exact pinned versions with empty postinstall) and not re-prompted, per the orchestrator's resolution.

## Deferred Issues

- **`npm run lint` (whole-repo) exits non-zero due to 8 PRE-EXISTING errors in `.planning/spikes/*.cjs`** (`record.cjs`, `reanalyze.cjs` — `no-require-imports` + `no-unused-vars`). These scratch files predate this work (logged in STATE.md under the Phase 06.1-04 gap-closure entry and that phase's `deferred-items.md`), are untouched by this task (`git diff` confirms), and are out of this plan's SCOPE BOUNDARY. The plan's chained `&& npm run lint` acceptance gate therefore cannot return a whole-repo exit 0 until those scratch files are cleaned — a pre-existing condition, NOT a regression introduced here. This plan's own changed files lint clean (0 errors).

## Self-Check: PASSED

- `src/renderer/tokens.css` — FOUND (87 lines; contains `--color-accent`, `--color-danger`, all 5 `--accent-*`, `--term-text`/`--term-faint`, `--radius-xs..--radius-xl` + `--radius`, all 3 `--shadow-*`, `--duration-fast`/`--ease-standard`, `--font-ui`/`--font-mono`, `--space-0_5..--space-12`).
- `package.json` — `@fontsource/nunito` `5.2.7` + `@fontsource/jetbrains-mono` `5.2.8` exact-pinned, alphabetically placed.
- `src/renderer/index.tsx` — 5 font imports before `./tokens.css` before `./terminal.css`.
- Commit `b9be293` — FOUND in `git log`.
