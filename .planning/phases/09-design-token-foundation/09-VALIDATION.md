---
phase: 9
slug: design-token-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 09-RESEARCH.md §"Validation Architecture". The Per-Task map is populated
> from PLAN.md task IDs after planning (Dimension 8 reconciliation).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (unit) + WebdriverIO (packaged smoke, `wdio.conf.ts`) + a pure-node build-output assertion (`scripts/assert-fonts-bundled.cjs`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:unit` (`vitest run`) |
| **Full suite command** | `npm test` (unit + `npm run test:smoke`) |
| **Packaging proof** | `npm run make && npm run verify:fonts` |
| **Estimated runtime** | unit ~seconds; smoke + make require a packaged build (minutes) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm run test:unit` (and `npm run lint`)
- **Before `/gsd-verify-work`:** `npm run test:unit` green; `npm run make && npm run verify:fonts` green; existing `npm run test:smoke` (PTY round-trip) green
- **Max feedback latency:** ~30 seconds (unit)

---

## Per-Task Verification Map

*Populated from PLAN.md task IDs (Plan 01 W1, Plan 02 W2, Plan 03 W3):*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01 / Task 1 | 01 | 1 | UI-01 | T-09-SC supply-chain | @fontsource packages legitimacy-verified before install (official org, no postinstall, exact-pin) | manual (blocking-human gate) | n/a — checkpoint | n/a | ⬜ pending |
| 09-01 / Task 2 | 01 | 1 | UI-01 | T-09-SC / T-09-02 | tokens.css defines the complete value-preserving token set; fonts installed exact-pinned; index.tsx imports fonts → tokens.css → terminal.css; suite stays green (no migration yet) | unit + static grep | `npm run test:unit` | ❌ W0 (tokens.css NEW) | ⬜ pending |
| 09-02 / Task 1 | 02 | 2 | UI-01 | T-09-03 / T-09-04 | the migrated global literals (blue/danger oklch, Nunito/JetBrains font stacks, 3 shadows, 0.12s motion) are GONE from terminal.css → var()/color-mix; value-preserving | unit (static text-count) | `npm run test:unit` | ❌ W0 (tokens-completeness NEW) | ⬜ pending |
| 09-02 / Task 2 | 02 | 2 | UI-01 | T-09-04 | status-colors.ts returns `var(--accent-*)`; labels unchanged; overlay-only-when-running contract intact; guard test updated in lockstep | unit | `npx vitest run src/renderer/__tests__/status-colors.test.ts` | ✅ exists — UPDATE | ⬜ pending |
| 09-02 / Task 3 | 02 | 2 | UI-01 | — | every `var(--*)` referenced in terminal.css + status-colors.ts is defined in tokens.css; migrated literals absent | unit (pure-node static text) | `npx vitest run src/renderer/__tests__/tokens-completeness.test.ts` | ❌ W0 — NEW | ⬜ pending |
| 09-03 / Task 1 | 03 | 3 | UI-01 | T-09-06 packaging | @fontsource woff2 emitted as RELATIVE-path renderer assets in the packaged build; no absolute `url(/` font path | build-output assertion (pure-node) | `npm run make && npm run verify:fonts` | ❌ W0 — NEW | ⬜ pending |
| (existing) | — | — | UI-01 | T-09-05 / T-09-08 | SC4: PTY round-trip echoes + EXPECTED_API_KEYS stays 20 (terminal fidelity + bridge surface intact) | smoke + existing security-guard | `npm run test:unit && npm run test:smoke` | ✅ exists — must stay GREEN | ⬜ pending |
| 09-03 / Task 2 | 03 | 3 | UI-01 | T-09-07 | SC1 coherence + SC3 re-theme-from-one-place + Nunito/JetBrains Mono actually render (value-preserving otherwise) | manual (end-of-phase human-verify — the phase gate) | n/a — `09-HUMAN-UAT.md` | ❌ — NEW | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/renderer/tokens.css` (new, Plan 01) — the `:root` design-token layer the completeness test asserts against. Created in Plan 01 Wave 1.
- [ ] `src/renderer/__tests__/tokens-completeness.test.ts` (new, Plan 02 Task 3) — pure-node static assertion: every `var(--token)` referenced in `terminal.css` + `status-colors.ts` is defined in `tokens.css`, AND the migrated raw literals (blue `oklch(0.62 0.14 248)`, error `oklch(0.58 0.16 25)`, the Nunito/JetBrains font stacks) no longer appear as raw literals in `terminal.css`.
- [ ] `src/renderer/__tests__/status-colors.test.ts` (update, Plan 02 Task 2) — assert `var(--accent-*)` references instead of literal oklch (D-03); keep the overlay-only-when-running contract assertions GREEN.
- [ ] `scripts/assert-fonts-bundled.cjs` + `verify:fonts` npm script (new, Plan 03 Task 1) — the packaged-font build-output assertion (woff2 emitted + no absolute font url).
- [ ] `09-HUMAN-UAT.md` (new, Plan 03 Task 2) — the SC1/SC3 + font-render manual checklist (end-of-phase gate).
- [ ] No framework install needed — Vitest covers unit; WebdriverIO covers the packaged smoke; the build-output assertion is pure node. jsdom deliberately NOT added.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One coherent visual direction across all surfaces (SC1) | UI-01 | Subjective visual coherence — "looks like one design system" can't be asserted in code | Open the running app; confirm sidebar, terminal chrome, modals, forms, cards read as one warm cohesive system |
| Token values re-theme the whole app from one place (SC3) | UI-01 | The single-source-of-truth is provable in code (var refs), but "visibly re-themes" needs eyes | Temporarily change `--color-accent` in `tokens.css`; confirm every accent surface (focus rings, Start buttons, CTAs) shifts together; revert |
| Nunito + JetBrains Mono actually render (not system fallback) | UI-01 | The signature typography finally on screen is a visual judgment | Open the app; confirm UI text is Nunito (rounded geometric) and terminal/mono fields are JetBrains Mono — compare against the Switchboard mockup |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (the 2 manual checkpoints are SC1/SC3/legitimacy gates with no code path)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (tokens.css, tokens-completeness.test.ts, assert-fonts-bundled.cjs, 09-HUMAN-UAT.md)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (ONLY on the Plan 03 Task 2 human-verify approval)

**Approval:** pending
