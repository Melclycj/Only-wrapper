---
phase: 09-design-token-foundation
verified: 2026-06-11T12:36:30Z
status: human_needed
score: 8/8
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Confirm Nunito + JetBrains Mono render in the running app (not system fallback)"
    expected: "UI text is rounded geometric Nunito; terminal/mono fields are JetBrains Mono; matches the Switchboard mockup typographic identity"
    why_human: "Font-render is a visual judgment — grep proves the imports and font-display:swap @font-face are present, but pixel-level rendering cannot be verified without the live app. Already approved in 09-HUMAN-UAT.md (2026-06-11)."
  - test: "Confirm SC3 re-theme — changing --color-accent in tokens.css re-themes every accent surface from one place"
    expected: "Focus rings, Start buttons, CTAs, running-status accents all shift together; Finished/Idle ramps stay independent"
    why_human: "Single-source-of-truth is proven structurally by the tokens-completeness test, but the visual re-theme cascade needs eyes. Already verified via ui-lab demo in 09-HUMAN-UAT.md (2026-06-11)."
---

# Phase 9: Design Token Foundation — Verification Report

**Phase Goal:** Establish the design-token foundation for v1.1 UI polish — a single source-of-truth tokens.css :root layer (colors/status accents/radius/shadow/motion/fonts/spacing scale), self-hosted Nunito + JetBrains Mono actually rendering, the globally-repeated raw primitives in terminal.css/status-colors.ts migrated to var(--token) value-preservingly, and packaging-survival of the fonts proven. (Requirement UI-01 — the foundation per-surface Phases 10-13 build on.)
**Verified:** 2026-06-11T12:36:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All 8 must-have truths VERIFIED by codebase evidence. Human verification items are pre-approved in 09-HUMAN-UAT.md (2026-06-11, operator sign-off); they are carried here per verification protocol because status `passed` requires the human section to be empty.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The app self-hosts Nunito + JetBrains Mono (no CDN); fonts imported in renderer entry before consuming stylesheet | VERIFIED | `package.json`: `@fontsource/nunito@5.2.7` (no caret), `@fontsource/jetbrains-mono@5.2.8` (no caret). `index.tsx` lines 6-10: 5 font imports before `./tokens.css` (line 14) which is before `./terminal.css` (line 15). No CDN reference anywhere. |
| 2 | A single src/renderer/tokens.css :root layer defines the complete design-token set (colors, status accents, radius, shadow, motion, font stacks, full --space-* scale) with value-preserving values | VERIFIED | `tokens.css` is 87 lines. All 31 required token families confirmed present: `--color-accent`, `--color-danger`, `--accent-running/-finished/-idle/-error/-waiting`, `--radius-xs/-sm/-md/-lg/-xl`, `--radius` (alias), `--shadow-pop/-dialog/-menu`, `--duration-fast`, `--ease-standard`, `--font-ui`, `--font-mono`, `--space-0_5` through `--space-12`. Old terminal.css :root block fully removed (0 :root blocks remain in terminal.css). |
| 3 | tokens.css imported before terminal.css so :root vars exist when component styles parse | VERIFIED | `index.tsx` import order: fonts (lines 6-10) → `./tokens.css` (line 14) → `./terminal.css` (line 15). Comment on line 12-13 explicitly states ordering rationale. |
| 4 | The globally-repeated raw primitives (28× accent blue, 8× danger red, font stacks, 3 elevation shadows, 0.12s motion) no longer appear as raw literals in terminal.css — they reference var(--token) or color-mix | VERIFIED | Literal-absence greps all return 0: `oklch(0.62 0.14 248`=0, `oklch(0.58 0.16 25`=0, `oklch(0.58 0.14 248`=0, `oklch(0.54 0.16 25`=0, `'Nunito'`=0, `'JetBrains Mono'`=0, `0.12s ease`=0. Sentinel presence confirmed: `color-mix(in oklch, var(--color-accent)`, `var(--shadow-pop)`, `var(--shadow-dialog)`, `var(--shadow-menu)`, `var(--font-ui)`, `var(--font-mono)`, `var(--duration-fast)`. |
| 5 | status-colors.ts returns var(--accent-*) references for its accent field instead of literal oklch; labels unchanged; overlay-only-when-running contract intact | VERIFIED | All 5 required var refs present: `var(--accent-running)`×2, `var(--accent-finished)`×1, `var(--accent-idle)`×3, `var(--accent-error)`×1, `var(--accent-waiting)`×1. Zero oklch literals on non-comment lines. Labels unchanged. `presentation()` body byte-for-byte intact. |
| 6 | A pure-node tokens-completeness test proves every var(--*) referenced in terminal.css + status-colors.ts is defined in tokens.css, AND the migrated literals are absent from terminal.css | VERIFIED | `src/renderer/__tests__/tokens-completeness.test.ts` exists (145 lines, pure node env, readFileSync). Contains 9 assertions across 3 describe blocks: definition sanity floor, reference completeness for terminal.css, reference completeness for status-colors.ts, 4 literal-absence assertions, 5 accent-shape assertions. `npx vitest run` on this file: 9/9 PASS. |
| 7 | A packaged npm run make build emits Nunito + JetBrains Mono woff2 as relative-path renderer assets; emitted CSS has no absolute url(/ font path | VERIFIED | `scripts/assert-fonts-bundled.cjs` exists (143 lines, pure-node CJS): checks assets dir exists, asserts ≥1 woff2 emitted, scans all emitted CSS for absolute `url(/` font paths. `package.json` has `"verify:fonts": "node scripts/assert-fonts-bundled.cjs"`. 09-03-SUMMARY reports `npm run make && npm run verify:fonts` exits 0: 23 woff2 emitted, 0 absolute url paths. |
| 8 | The rendered colors/geometry are identical to before the migration (value-preserving; only intended visible change is now-real fonts) | VERIFIED (automated + human) | Old :root tokens removed from terminal.css (0 occurrences of `--surface:`, `--bg-sunk:`, etc. in terminal.css). Focus ring `0 0 0 2px var(--surface)` preserved at line 1 instance. 999px pills: 2 instances preserved. Unit suite 326/326 GREEN including the guard test. 09-HUMAN-UAT.md Check 3 (VALUE-PRESERVING): PASS — operator confirmed no unintended visible changes. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/tokens.css` | Complete :root design-token layer (D-02/D-03/D-04); contains --color-accent; min 50 lines | VERIFIED | 87 lines, all 31 required token families confirmed present |
| `package.json` | @fontsource/nunito exact-pinned; @fontsource/jetbrains-mono exact-pinned; verify:fonts script | VERIFIED | `@fontsource/nunito: 5.2.7` (no caret), `@fontsource/jetbrains-mono: 5.2.8` (no caret), `"verify:fonts": "node scripts/assert-fonts-bundled.cjs"` |
| `src/renderer/__tests__/tokens-completeness.test.ts` | Static-text SC2/SC3 guard; contains readFileSync; runs in node env | VERIFIED | 145 lines, readFileSync-based, no jsdom, 9 assertions, 9/9 PASS |
| `src/renderer/status-colors.ts` | Status accents migrated to var(--accent-*); contains var(--accent-running) | VERIFIED | All 5 var(--accent-*) refs present, 0 oklch on non-comment lines |
| `scripts/assert-fonts-bundled.cjs` | Build-output assertion: woff2 emitted + no absolute font url; contains woff2 | VERIFIED | 143 lines, checks woff2 count, scans CSS for url(/ paths, exits 0/1/2 |
| `.planning/phases/09-design-token-foundation/09-HUMAN-UAT.md` | End-of-phase checklist; contains SC1; 5 checks PASS | VERIFIED | status: passed, 5/5 checks, approved 2026-06-11 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/renderer/index.tsx` | `@fontsource/nunito` + `@fontsource/jetbrains-mono` + `./tokens.css` | import statements (fonts first, tokens before terminal.css) | WIRED | Lines 6-14: 5 font CSS imports, then `import './tokens.css'` at line 14 |
| `src/renderer/index.tsx` | `src/renderer/tokens.css` | import order (tokens.css before terminal.css) | WIRED | `./tokens.css` at line 14, `./terminal.css` at line 15 — correct order |
| `src/renderer/terminal.css` | `src/renderer/tokens.css` | var(--color-accent) / color-mix / var(--shadow-*) / var(--font-*) | WIRED | `color-mix(in oklch, var(--color-accent)` present; `var(--shadow-pop)`, `var(--shadow-dialog)`, `var(--shadow-menu)`, `var(--font-ui)`, `var(--font-mono)` all present |
| `src/renderer/status-colors.ts` | `src/renderer/tokens.css` | STATUS_STYLE/AGENT_STYLE accent → var(--accent-*) | WIRED | 5 var(--accent-*) refs present; each token confirmed defined in tokens.css by the completeness guard |
| `src/renderer/__tests__/tokens-completeness.test.ts` | tokens.css + terminal.css + status-colors.ts | readFileSync static text parse | WIRED | readFileSync calls confirmed in test, 9/9 assertions pass |
| `package.json scripts` | `scripts/assert-fonts-bundled.cjs` | verify:fonts npm script | WIRED | `"verify:fonts": "node scripts/assert-fonts-bundled.cjs"` confirmed |

### Data-Flow Trace (Level 4)

This phase is a pure CSS/TS refactor with no dynamic data rendering. The artifacts are design tokens (static :root declarations), font imports, and test files. Level 4 data-flow tracing is not applicable — no component renders dynamic data from a data source.

| Artifact | Assessment |
|----------|-----------|
| `tokens.css` | Static :root declarations — no data source needed |
| `status-colors.ts` | Returns static string var() references — consumed downstream by React component styles |
| `tokens-completeness.test.ts` | Reads files via readFileSync — deterministic static analysis |
| `assert-fonts-bundled.cjs` | Reads build output dir — deterministic build check |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 326 unit tests pass (including guard tests) | `npm run test:unit` | 39 files, 326 tests PASS | PASS |
| tokens-completeness + status-colors guard tests specifically | `npx vitest run ...tokens-completeness.test.ts ...status-colors.test.ts` | 2 files, 18 tests PASS | PASS |
| @fontsource/nunito exact-pinned in package.json | `node -e "require('./package.json')"` | 5.2.7, no caret | PASS |
| @fontsource/jetbrains-mono exact-pinned | node check | 5.2.8, no caret | PASS |
| All migrated literals absent from terminal.css | python3 count | 7/7 literals = 0 occurrences | PASS |
| All 5 var(--accent-*) refs present in status-colors.ts | python3 check | 5/5 present, 0 oklch on non-comment lines | PASS |
| npm run verify:fonts (packaging proof) | Reported in 09-03-SUMMARY.md: `npm run make && npm run verify:fonts` exit 0 | 23 woff2 emitted, no absolute url | PASS (run at phase gate; build not re-run during verification) |

### Probe Execution

No probe scripts declared in PLANs or SUMMARY. Conventional `scripts/*/tests/probe-*.sh` scan: none found. Step 7c: SKIPPED (no probes).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UI-01 | 09-01, 09-02, 09-03 | Single design-token system (palette, type, spacing, surface, elevation, radius, motion) applied consistently app-wide; foundation for per-surface Phases 10-13 | SATISFIED | tokens.css is the sole :root token home; terminal.css/status-colors.ts migrated to var(); packaging-proven via assert-fonts-bundled.cjs; unit suite 326/326 GREEN; human-verify approved 2026-06-11 |

No orphaned requirements: REQUIREMENTS.md maps UI-01 to Phase 9 only; all 3 plans declare `requirements: [UI-01]`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/terminal.css` | 3 | `oklch(0.255 0.018 264)` in a file-level comment (prose reference) | Info | Comment only — not a code value. No impact. |
| `src/renderer/terminal.css` | 572 | `background: oklch(0.255 0.018 264 / 0.45)` — modal scrim | Warning | This oklch(0.255…) is the dark-navy color, NOT the accent blue or danger red. WR-01 from 09-REVIEW.md notes this as outside the plans' declared migration set (blue/danger/fonts/shadows/motion). No `--shadow-scrim` token is defined. Value is consistent with `--shadow-dialog` (same base hue, different alpha). Advisory only — Phases 10-13 can tokenize if desired. |
| `src/renderer/terminal.css` | 656 | `text-shadow: 0 1px 1px oklch(0.255 0.018 264 / 0.35)` — badge text-shadow | Warning | Same dark-navy value as line 572. Same WR-01 disposition. Advisory only — outside the declared migration scope. |

**Debt-marker gate check:** No TBD, FIXME, or XXX markers found in any phase-modified file (5/5 files CLEAN). Gate: PASS.

**WR-01 classification:** Both remaining oklch(0.255…) literals are the dark-navy secondary value (NOT accent blue or danger red). The plans explicitly declare the migration set as: accent blue, danger red, font stacks, 3 elevation shadows, 0.12s motion. These one-off scrim and text-shadow uses fall outside that scope. The tokens.css already defines `--shadow-dialog` and `--shadow-menu` using the same base hue — a future `--color-overlay` token is natural follow-up for Phases 10-13. This is a WARNING, not a BLOCKER.

### Human Verification Required

The following items require human confirmation. Both have already been approved by the operator in 09-HUMAN-UAT.md (2026-06-11). They are carried here because verification protocol requires status `human_needed` whenever this section is non-empty.

### 1. Fonts Render in Running App

**Test:** Launch the app (`npm start` or the packaged build from `npm run make`). Confirm UI text renders in Nunito (rounded geometric sans) and terminal/mono fields render in JetBrains Mono — NOT the previous system-ui/generic-monospace fallback.
**Expected:** Typographic identity matches `.planning/design/switchboard-mockup.html`; UI feels warmer and more characterful than the pre-Phase-9 system font fallback.
**Why human:** Font-render is a visual judgment; grep confirms the imports and @fontsource @font-face are present but cannot verify actual rendering. Already confirmed in 09-HUMAN-UAT.md Check 1 (PASS).

### 2. SC3 Re-Theme from One Place

**Test:** Temporarily change `--color-accent` in `src/renderer/tokens.css` to a visually different hue (e.g. `oklch(0.7 0.15 150)` green), reload, confirm every accent surface (focus rings, Start buttons, CTAs, running-status accent) shifts together. Revert.
**Expected:** All accent surfaces update from the single token edit; Finished/Idle ramps are unaffected (they use `--accent-finished`/`--accent-idle`, not `--color-accent` directly).
**Why human:** Structural single-source-of-truth is proven by the tokens-completeness test, but the visual re-theme cascade needs eyes on the running app. Already verified via the ui-lab SC3 green-accent demo in 09-HUMAN-UAT.md Check 4 (PASS).

### Gaps Summary

No gaps. All 8 must-have truths are VERIFIED. The 2 WR-01 unmigrated oklch(0.255…) literals are advisory warnings (outside the plans' declared migration scope) and do not block the phase goal.

The human verification section is non-empty solely because SC1 visual coherence and SC3 re-theme require human eyes — both checks were already operator-approved in 09-HUMAN-UAT.md on 2026-06-11. The phase goal (UI-01 foundation) is substantively achieved.

---

_Verified: 2026-06-11T12:36:30Z_
_Verifier: Claude (gsd-verifier)_
