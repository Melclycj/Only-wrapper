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
| **Framework** | Vitest 4.1.8 (unit) + WebdriverIO (packaged smoke, `wdio.conf.ts`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:unit` (`vitest run`) |
| **Full suite command** | `npm test` (unit + `npm run test:smoke`) |
| **Estimated runtime** | unit ~seconds; smoke requires a packaged build (minutes) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm run test:unit` (and `npm run lint`)
- **Before `/gsd-verify-work`:** `npm run test:unit` green; packaged smoke (`npm run test:smoke`) green for the font/asset + PTY-roundtrip checks
- **Max feedback latency:** ~30 seconds (unit)

---

## Per-Task Verification Map

*Populated from PLAN.md task IDs after planning. Seed rows reflect the research-derived checks:*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (TBD by planner) | 01 | 1 | UI-01 | — | tokens.css defines every `var(--*)` referenced; no migrated raw literal remains in terminal.css | unit (pure-node static text) | `npm run test:unit` | ❌ W0 | ⬜ pending |
| (TBD by planner) | 01 | 1 | UI-01 | — | status-colors.ts returns `var(--accent-*)`; values match tokens.css | unit | `npm run test:unit` | ❌ W0 | ⬜ pending |
| (TBD by planner) | 01 | 1 | UI-01 | T-09 supply-chain | @fontsource woff2 emit as relative assets in packaged build | smoke | `npm run test:smoke` | ❌ W0 | ⬜ pending |
| (TBD by planner) | 01 | 1 | UI-01 | — | SC4: PTY round-trip + EXPECTED_API_KEYS unchanged (terminal fidelity intact) | smoke + existing security-guard | `npm run test:unit && npm run test:smoke` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/renderer/__tests__/tokens-coverage.test.ts` (new) — pure-node static assertion: every `var(--token)` referenced in `tokens.css` + `terminal.css` + `status-colors.ts` is defined in `tokens.css`, AND the migrated raw literals (blue `oklch(0.62 0.14 248)`, error `oklch(0.58 0.16 25)`, the 3 box-shadows, the Nunito/JetBrains font stacks) no longer appear as raw literals in `terminal.css`.
- [ ] `src/renderer/__tests__/status-colors.test.ts` (update) — assert `var(--accent-*)` references instead of literal oklch (D-03).
- [ ] No framework install needed — Vitest covers unit; WebdriverIO covers the packaged smoke.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One coherent visual direction across all surfaces (SC1) | UI-01 | Subjective visual coherence — "looks like one design system" can't be asserted in code | Open the running app; confirm sidebar, terminal chrome, modals, forms, cards read as one warm cohesive system |
| Token values re-theme the whole app from one place (SC3) | UI-01 | The single-source-of-truth is provable in code (var refs), but "visibly re-themes" needs eyes | Temporarily change `--color-accent` in `tokens.css`; confirm every accent surface (focus rings, Start buttons, CTAs) shifts together |
| Nunito + JetBrains Mono actually render (not system fallback) | UI-01 | The signature typography finally on screen is a visual judgment | Open the app; confirm UI text is Nunito (rounded geometric) and terminal/mono fields are JetBrains Mono — compare against the Switchboard mockup |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
