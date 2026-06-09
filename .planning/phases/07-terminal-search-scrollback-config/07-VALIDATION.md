---
phase: 7
slug: terminal-search-scrollback-config
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 07-RESEARCH.md §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit, Node env) + WebdriverIO `@wdio/electron-service` (E2E smoke) + macOS-first manual |
| **Config file** | `wdio.conf.ts` (smoke) + Vitest project default (existing — Phase 1 Wave 0); pure tests in `src/**/__tests__/*.test.ts` |
| **Quick run command** | `npm run test:unit` (`vitest run` — pure matchers, clamp, validators, schema, security guard) |
| **Full suite command** | `npm run test` (`test:unit` then `test:smoke`) |
| **Estimated runtime** | ~30–60s unit; smoke adds minutes (per-test Electron boot) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit` — must be green
- **After every plan wave:** Run `npm run test` (adds smoke) — green
- **Before `/gsd-verify-work`:** Full suite green + macOS-first manual checklist signed off
- **Max feedback latency:** ~60 seconds (unit); smoke gated at wave/phase boundaries

---

## Per-Task Verification Map

| Req / SC | Behavior | Test Type | Automated Command | File Exists |
|----------|----------|-----------|-------------------|-------------|
| TERM-10 / D-02 / D-03 | `matchSearchKey` returns `{kind:'search'}` for Cmd+F (mac) + Ctrl+F (win); returns `null` for macOS Ctrl+F (no readline theft), non-keyDown, and other keys; takes `process.platform` as an arg | unit (pure) | extend `src/main/__tests__/switch-keys.test.ts` via `npm run test:unit` | ❌ Wave 0 — extend |
| TERM-10 / SC1 | Find chord opens the bar; typing + next/prev navigates matches in scrollback | E2E smoke (best-effort) + macOS manual | `npm run test:smoke` + manual | ❌ Wave 0 |
| TERM-10 / SC3 | Esc dismisses the bar; when closed, keystrokes reach the PTY (no interference) | manual (macOS-first) + smoke assertion if drivable | macOS manual; optional smoke | ❌ Wave 0 |
| TERM-10 / D-01 | "N of M" count populates (decorations-gated `onDidChangeResults`; handle `resultIndex === -1` threshold sentinel); Aa toggles `caseSensitive` | E2E smoke (needs DOM xterm) + manual | smoke / manual | ❌ Wave 0 |
| TERM-11 / D-04 | `clampScrollback(n)` clamps to 1000–50000, default 5000, non-finite → default | unit (pure) | new `src/main/__tests__/scrollback-clamp.test.ts` (or fold into store-schema.test.ts) via `npm run test:unit` | ❌ Wave 0 |
| TERM-11 / D-07 | `setUiState` accepts + clamps a valid scrollback; clamps/no-ops a forged/out-of-range payload (T-05-01 validate-in-main) | unit | extend `src/main/__tests__/pty-validation.test.ts` (or session-store.test.ts) | ❌ Wave 0 — extend |
| TERM-11 / D-07 | scrollback survives reopen (persist → load round-trip; coerceOnLoad migration-safe) | unit | extend `src/main/__tests__/session-store.test.ts` / `store-schema.test.ts` | ❌ Wave 0 — extend |
| TERM-11 / SC2 / D-05 | Changing the setting applies to new sessions AND live terms (`term.options.scrollback = N`) | manual (macOS-first) — needs live xterm | macOS manual | ❌ Wave 0 |
| TERM-11 / D-06 | Lowering trims existing scrollback rows on open terminals (accepted) | manual | macOS manual | ❌ Wave 0 |
| security invariant | `EXPECTED_API_KEYS` unchanged (19); preload surface exact | unit | existing `src/shared/__tests__/security.guard.test.ts` — MUST stay GREEN | ✅ exists — must remain passing |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] extend `src/main/__tests__/switch-keys.test.ts` — TERM-10/D-02/D-03 search-chord matcher (incl. macOS-Ctrl+F → `null`)
- [ ] `src/main/__tests__/scrollback-clamp.test.ts` (or fold into store-schema.test.ts) — TERM-11/D-04 clamp
- [ ] extend `src/main/__tests__/pty-validation.test.ts` (or session-store.test.ts) — TERM-11/D-07 setUiState scrollback validate/clamp + persist round-trip
- [ ] new wdio smoke spec for find-chord-opens-bar + "N of M" count IF drivable through the existing xterm driver; otherwise document as manual-only with justification (renderer DOM + WebGL make headless match-count assertions brittle)
- [ ] macOS-first manual checklist (below)
- [ ] Framework install: none — Vitest + wdio already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Find chord opens the bar; type + next/prev navigates; "N of M" updates; Aa toggles case | TERM-10 / SC1 / D-01 | "N of M" against a real buffer depends on a rendered xterm + WebGL canvas; headless assertions are brittle | Run a session, press Cmd+F (mac); type a query present in scrollback; confirm the overlay opens, count shows "N of M", next/prev cycles matches, Aa toggles case-sensitivity |
| Esc dismiss + no interference when closed | TERM-10 / SC3 | Focus/keystroke routing between the overlay `<input>` and the PTY is interactive | Open the bar, press Esc → bar closes; with the bar closed, type into the terminal → keystrokes reach the shell normally (no swallowed input, no stray chars) |
| Live scrollback apply to open + new sessions | TERM-11 / SC2 / D-05 | Live fan-out (`term.options.scrollback = N`) needs live xterm instances | Open ≥2 sessions; open Preferences (gear) → change scrollback; confirm open terminals + a newly-created session all honor the new value |
| Decrease trims existing rows | TERM-11 / D-06 | xterm-inherent trim on a live buffer; accepted behavior | Fill a terminal past the new cap, lower the scrollback value, confirm older rows are trimmed (expected, not a bug) |

*Manual-only justification:* the interactive search bar, "N of M" against a real buffer, and live scrollback fan-out depend on a rendered xterm with a WebGL canvas. Per the project's macOS-first convention and the Phase 6.1 precedent (human-verify for terminal-frame behavior), the interactive surface is verified manually on macOS, with the pure logic (search-intent matcher, clamp, validators, schema, security guard) fully Vitest-covered.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (flips when Wave 0 stubs land + macOS-first manual checklist signed off)

**Approval:** pending
