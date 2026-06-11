---
phase: 09-design-token-foundation
plan: 02
subsystem: renderer-design-tokens
tags: [css-tokens, refactor, value-preserving, tdd, guard-test]
requires:
  - "tokens.css :root layer (Plan 09-01) — defines every --color-*/--accent-*/--shadow-*/--font-*/--duration-fast/--ease-standard this plan references"
  - "@fontsource fonts + index.tsx import order (Plan 09-01)"
provides:
  - "terminal.css consuming tokens via var()/color-mix (SC2/SC3 for global primitives)"
  - "status-colors.ts accents migrated to var(--accent-*) (D-03)"
  - "tokens-completeness.test.ts — static-text SC2/SC3 single-source-of-truth guard"
affects:
  - "Phases 10–13 (per-surface polish) inherit a token-sourced terminal.css; retuning --color-accent now re-themes every accent surface from one line"
tech-stack:
  added: []
  patterns:
    - "value-preserving token migration: solid → bare var(--token); alpha wash (/ 0.08) → color-mix(in oklch, var(--token) 8%, transparent)"
    - "guard-test lockstep (TDD): test RED first, then impl GREEN"
    - "pure-node static-text guard (readFileSync, no jsdom)"
key-files:
  created:
    - "src/renderer/__tests__/tokens-completeness.test.ts"
  modified:
    - "src/renderer/terminal.css"
    - "src/renderer/status-colors.ts"
    - "src/renderer/__tests__/status-colors.test.ts"
decisions:
  - "Allow-listed --accent (the per-row inline runtime custom property fed by status-colors.ts) out of the tokens.css completeness check — it is a runtime channel, never a :root token (PATTERNS.md §status-colors.ts)"
  - "Updated two inline doc-comment literals (the .modal-btn-confirm comment in terminal.css and the statusAccent docstring) so the literal-absence grep reaches 0 and the docstring no longer asserts a stale oklch value"
metrics:
  duration_min: 6
  tasks_completed: 3
  files_changed: 4
  unit_tests: "326 passed (39 files)"
  completed: 2026-06-11
---

# Phase 9 Plan 02: terminal.css + status-colors.ts Token Migration Summary

Migrated every globally-repeated raw design primitive in `terminal.css` (28× accent blue, 8× danger red, 3 elevation shadows, 8× Nunito + 2× JetBrains-Mono font stacks, the 0.12s motion) and the 5 status accents in `status-colors.ts` from literals to `var(--token)` references (and `color-mix` for the alpha washes), then added a pure-node static-text guard proving the single source of truth holds — a strictly value-preserving refactor that cashes in UI-01's "re-theme in one place" payoff.

## What Was Built

**Task 1 — terminal.css primitive migration (commit `3c822fe`).** Applied the two-case value-preserving migration across the whole stylesheet:
- 28× solid accent blue `oklch(0.62 0.14 248)` → `var(--color-accent)`; the 1× hover-strong `oklch(0.58 0.14 248)` → `var(--color-accent-strong)`.
- 8× danger red `oklch(0.58 0.16 25)` → `var(--color-danger)`; 2× destructive-hover `oklch(0.54 0.16 25)` → `var(--color-danger-strong)`.
- 5 alpha hover-washes `oklch(... / 0.08)` → `color-mix(in oklch, var(--color-accent|--color-danger) 8%, transparent)` (percent mirrored exactly).
- 3 elevation shadows → `var(--shadow-pop)` / `var(--shadow-dialog)` / `var(--shadow-menu)`.
- 8× `'Nunito', system-ui, sans-serif` → `var(--font-ui)`; 2× `'JetBrains Mono', monospace` → `var(--font-mono)`.
- 2× `transition: opacity 0.12s ease` → `var(--duration-fast) var(--ease-standard)`.
- Removed the duplicated top `:root` block (old lines 6–17) so tokens.css is the sole home.
- **Untouched (as required):** the `box-shadow: 0 0 0 2px var(--surface)` focus ring, all `999px` pills, every padding/gap/margin value, and the warm-dark scrim/text-shadow one-offs (not global primitives).

**Task 2 — status-colors.ts accent migration, TDD (RED `ae19da8`, GREEN `ce44ba6`).** Updated `status-colors.test.ts` FIRST to expect `var(--accent-*)` strings; ran it RED against the unmigrated module (6 literal tests failed, the 3 behavioral `.toEqual(STATUS_STYLE.x)` overlay-contract tests stayed green). Then migrated `STATUS_STYLE`/`AGENT_STYLE` accents to `var(--accent-running|-finished|-idle|-error|-waiting)` — labels unchanged, `presentation()` overlay-only-when-running contract byte-for-byte intact — and confirmed GREEN (9/9).

**Task 3 — tokens-completeness guard (commit `436f7a7`).** New pure-node `tokens-completeness.test.ts` (readFileSync, no jsdom): (1) every `var(--token)` referenced in terminal.css + status-colors.ts is defined in tokens.css; (2) the 4 migrated literals are absent from terminal.css; (3) status-colors.ts emits the 5 required `var(--accent-*)` refs and each is defined. The reference scanner strips comments and allow-lists the `--accent` inline runtime channel.

## Verification Evidence

- `npx tsc --noEmit` → exit 0 (clean).
- `npm run test:unit` → **326 passed (39 files)**, including the updated status-colors.test.ts (9), the new tokens-completeness.test.ts (9), and security.guard.test.ts (bridge surface intact, EXPECTED_API_KEYS unchanged).
- Literal-absence greps in terminal.css all 0: `oklch(0.62 0.14 248`=0, `oklch(0.58 0.16 25`=0, `oklch(0.58 0.14 248`=0, `oklch(0.54 0.16 25`=0, `'Nunito'`=0, `'JetBrains Mono'`=0, `0.12s ease`=0.
- Sentinels present: `color-mix(in oklch, var(--color-accent)`, `var(--shadow-pop)`, `var(--font-ui)`.
- Focus ring (`0 0 0 2px var(--surface)`) and `999px` pills retained.
- `npm run lint` → 8 pre-existing errors, ALL in `.planning/spikes/*.cjs` (deferred since Phase 06.1-04, out of scope). ZERO new lint errors in the 4 changed files (eslint targets JS/TS; terminal.css is not an eslint target).
- Scope guard: my 4 task commits touched ONLY terminal.css, status-colors.ts, status-colors.test.ts, tokens-completeness.test.ts. SessionView.tsx / forge.config.ts / vite.renderer.config.ts UNCHANGED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Comment-resident literals tripped the literal-absence grep**
- **Found during:** Task 1 verify (and confirmed via Task 3 completeness test).
- **Issue:** The plan's literal-absence grep counts ALL occurrences, including inside comments. The `.modal-btn-confirm` comment (`destructive derived red ramp (oklch(0.58 0.16 25)...)`) and the `statusAccent` docstring (`(oklch string)`) left stale literals that kept the count at 1.
- **Fix:** Updated the comment to `var(--color-danger)` and the docstring to `var(--accent-*) reference` — value-preserving, no code behavior change. Brings the grep to 0 and keeps docs honest.
- **Files modified:** terminal.css, status-colors.ts. **Commits:** 3c822fe, ce44ba6.

**2. [Rule 2 — Correctness] Completeness test must allow-list the `--accent` inline runtime channel and strip comments**
- **Found during:** Task 3 (first run failed: `--accent` from terminal.css and a `--accent-` doc-glob artifact from status-colors.ts line 79 reported as undefined).
- **Issue:** `var(--accent)` (terminal.css `.status-dot`/`.collapsed-status-dot`) is a per-row inline custom property set at runtime by status-colors.ts via `presentation().accent` — NOT a tokens.css token (documented in PATTERNS.md §status-colors.ts). The `var(--accent-*)` doc-glob in the `statusAccent` docstring is prose, not a real reference.
- **Fix:** The reference scanner now strips `//` and `/* */` comments before matching, and allow-lists `--accent` as the documented inline runtime channel. Without this the test would falsely flag a deliberate, correct mechanism.
- **Files modified:** tokens-completeness.test.ts. **Commit:** 436f7a7.

## Threat Surface

No new network endpoints, IPC/bridge keys, auth paths, file access, or schema changes — pure presentation refactor. T-09-03 (ANSI-injection defense in SessionView.tsx) untouched; T-09-04 (value-preserving regression) mitigated by exact percent-mirroring + the literal-absence guard (the ~4 hover-wash sites remain for the end-of-phase human-verify in Plan 03); T-09-05 (bridge surface) accept — EXPECTED_API_KEYS unchanged, security.guard GREEN.

## Known Stubs

None. No placeholder values, empty data sources, or TODO/FIXME introduced.

## Self-Check: PASSED

- Files: terminal.css, status-colors.ts, status-colors.test.ts, tokens-completeness.test.ts — all FOUND.
- Commits: 3c822fe, ae19da8, ce44ba6, 436f7a7 — all FOUND in git log.
