---
phase: 09-design-token-foundation
plan: 03
subsystem: ui
tags: [electron-forge, vite, fontsource, woff2, packaging, design-tokens, human-verify]

# Dependency graph
requires:
  - phase: 09-01
    provides: tokens.css single-source-of-truth layer + @fontsource Nunito/JetBrains Mono installed and imported
  - phase: 09-02
    provides: terminal.css + status-colors.ts global primitives migrated to var()/color-mix
provides:
  - "Automated packaged-font build-output assertion (scripts/assert-fonts-bundled.cjs) + verify:fonts npm script — locks in the relative-base finding so a future Vite/Forge absolute-base regression is caught (T-09-06 mitigated)"
  - "End-of-phase human-verify sign-off (09-HUMAN-UAT.md) — all 5 checks PASS; nyquist_compliant flipped true; Phase 9 token+font foundation closed"
  - "5 deferred per-surface visual gaps logged + routed to Phases 10–13 (downstream polish backlog, not Phase 9 failures)"
affects: [phase-10-sidebar-visual-polish, phase-11-terminal-area-polish, phase-12-session-form, phase-13-state-interaction-design]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-node CommonJS build-output assertion (no test framework) reading .vite/renderer/main_window/assets — mirrors scripts/fix-node-pty.cjs style"
    - "Packaging guard run AFTER npm run make in the same verify command so emptyOutDir clears stale assets — no false pass"

key-files:
  created:
    - scripts/assert-fonts-bundled.cjs
    - .planning/phases/09-design-token-foundation/09-HUMAN-UAT.md
    - .planning/phases/09-design-token-foundation/09-03-SUMMARY.md
  modified:
    - package.json
    - .planning/phases/09-design-token-foundation/09-VALIDATION.md

key-decisions:
  - "Check 2 (SC1 coherence) recorded as PASS-AT-FOUNDATION-SCOPE, not an unqualified pass — operator honestly verdicted 'the UI is still ugly'; per-surface composition is Phases 10–13, Phase 9 owns only the token+font foundation"
  - "Check 4 (SC3 re-theme) verified mechanically via the ui-lab SC3 green-accent demo (zero source edits) rather than a live token edit, with operator reviewing the before/after evidence in-session"
  - "verify:fonts deliberately NOT wired into the default `test` script — it requires a prior npm run make; it is an explicit phase-gate command"

patterns-established:
  - "Pattern: packaged-font regression guard — assert woff2 emitted + no leading-slash url(/ font path in the emitted renderer CSS (RESEARCH Pitfall 2 lock-in)"
  - "Pattern: deferred visual gaps logged in HUMAN-UAT ## Gaps as observations-for-downstream-phases with severity + route + evidence ref, explicitly NOT counted as phase failures"

requirements-completed: [UI-01]

# Metrics
duration: ~30min (across the human-verify gate)
completed: 2026-06-11
---

# Phase 9 Plan 03: Packaged-Font Assertion + End-of-Phase Human-Verify Summary

**Automated packaged-font build-output guard (23 woff2 emitted as relative assets, no absolute url) plus the operator-approved end-of-phase human-verify that closed the Phase 9 design-token + font foundation (all 5 checks PASS, nyquist_compliant true).**

## Performance

- **Duration:** ~30 min (spanning the blocking human-verify gate)
- **Started:** 2026-06-11 (Task 1 commit 2026-06-11T10:40:33+10:00)
- **Completed:** 2026-06-11
- **Tasks:** 2 (Task 1 auto; Task 2 blocking-human checkpoint, approved)
- **Files modified:** 5 (2 created code/script + 3 planning docs)

## Accomplishments

- **SC4/D-05 packaging proof (Task 1):** `scripts/assert-fonts-bundled.cjs` reads the built `.vite/renderer/main_window/assets`, asserts woff2 are emitted (23 found), and asserts the emitted renderer CSS has no absolute `url(/` font path. `npm run make && npm run verify:fonts` exits 0 GREEN. `verify:fonts` added to package.json (not wired into default `test`). T-09-06 (fonts 404 under file://) mitigated and a future absolute-base regression is now caught.
- **End-of-phase human-verify (Task 2):** operator launched the running app and approved all 5 checks — fonts render (Nunito UI + JetBrains Mono terminal), value-preserving (no unintended visible change), SC3 re-theme from one place, SC4 terminal fidelity unchanged, and SC1 coherence at foundation scope.
- **Phase gate flipped:** `09-VALIDATION.md` `nyquist_compliant: true`, `status: complete`; `09-HUMAN-UAT.md` status `passed` (5/5).
- **Backlog seeded honestly:** 5 per-surface visual gaps logged + routed to Phases 10–13.

## Task Commits

1. **Task 1: packaged-font build-output assertion + verify:fonts** - `2404754` (feat)
2. **Task 2 pre-work: persist end-of-phase human-verify checklist** - `aafe84a` (test)
3. **Task 2: human-verify approved** — recorded in `09-HUMAN-UAT.md` + `09-VALIDATION.md` (this plan-completion commit)

**Plan metadata / docs:** this SUMMARY + the filled-in HUMAN-UAT + flipped VALIDATION + STATE/ROADMAP tracking (docs commit referencing 09-03)

## Files Created/Modified

- `scripts/assert-fonts-bundled.cjs` - Pure-node build-output assertion: woff2 emitted (23) + no absolute font url (SC4/D-05 packaging guard, RESEARCH Pitfall 2 lock-in)
- `package.json` - Added `"verify:fonts": "node scripts/assert-fonts-bundled.cjs"`
- `.planning/phases/09-design-token-foundation/09-HUMAN-UAT.md` - End-of-phase checklist; 5 checks filled in with operator verdicts (Check 2 scoped note) + 5 deferred visual gaps
- `.planning/phases/09-design-token-foundation/09-VALIDATION.md` - `nyquist_compliant: true`, `status: complete`, per-task map + Wave-0 + sign-off updated
- `.planning/phases/09-design-token-foundation/09-03-SUMMARY.md` - This summary

## Decisions Made

- **Check 2 SC1 coherence = PASS AT FOUNDATION SCOPE (honest, not inflated).** The operator's verbatim verdict was "the UI is still ugly." Phase 9 delivers the design-token single source of truth + the signature fonts — the per-surface visual composition that makes the app actually look good is the explicit scope of Phases 10–13. The pass is on the foundation this phase owns; the remaining ugliness is logged as downstream gaps, not papered over.
- **Check 4 SC3 verified via the ui-lab demo (mechanical), not a live token edit.** A green `--color-accent` `:root` override (capture-time only, zero source edits, zero residue) shifted the Create-a-session CTA AND all Running-status accents together while Finished/Idle ramps stayed independent — proving the single-source-of-truth re-theme. Operator reviewed the before/after evidence in-session.
- **`verify:fonts` kept out of the default `test` script** — it depends on a prior `npm run make`, so it is an explicit phase-gate command.

## Deviations from Plan

### Session deviation (factual — NOT a plan task)

**1. [user-directed] ui-lab visual capture harness built mid-plan (commit `81192cd`)**
- **Found during:** between Task 2 pre-work and the human-verify gate
- **What:** the user directed building a `ui-lab` visual capture + self-evolve harness on the existing wdio smoke stack. This is **session work alongside the plan, not a task in 09-03-PLAN.md** (the plan's only files are `scripts/assert-fonts-bundled.cjs`, `package.json`, and `09-HUMAN-UAT.md`).
- **How it was used:** the harness produced `artifacts/ui-lab/phase9-baseline/*.png` and `artifacts/ui-lab/sc3-green-demo/*.png`, which became the corroborating evidence for Check 1 (fonts render), the mechanical proof for Check 4 (SC3 re-theme), and the source for the 5 documented deferred visual gaps.
- **Scope note:** ui-lab files were committed separately (`81192cd`) and were NOT modified by this plan-completion work.

---

**Total deviations:** 1 (a user-directed, separately-committed harness used as evidence — not a plan task, no scope creep into the plan's own artifacts).
**Impact on plan:** none on the plan's deliverables; the harness strengthened the human-verify evidence.

## Issues Encountered

None. Task 1 verification (`npm run make && npm run verify:fonts && npx tsc --noEmit && npm run lint`) was GREEN; the human-verify gate was approved with the SC1 scope qualification recorded honestly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 9 (UI-01) is COMPLETE** — design-token single source of truth + Nunito/JetBrains Mono fonts in place and packaging-proven; `nyquist_compliant: true`.
- **Phase 10 (Sidebar Visual Polish) is unblocked** and is the operator's chosen next surface — deferred gaps #1 (sidebar row names crushed), #4 (context-menu position + danger ramp), and #5 (inactive rows lack card structure) are its primary targets.
- Deferred gaps #2 (terminal pane framing → Phase 11) and #3 (Save button accent → Phase 12) are routed.
- Core-Value fidelity preserved: the xterm/PTY data path was untouched; SC4 terminal fidelity confirmed unchanged.

## Self-Check: PASSED

- Files: `scripts/assert-fonts-bundled.cjs`, `09-HUMAN-UAT.md`, `09-VALIDATION.md`, `09-03-SUMMARY.md` all FOUND
- Commits: `2404754` (Task 1), `aafe84a` (Task 2 pre-work), `81192cd` (ui-lab session deviation) all FOUND

---
*Phase: 09-design-token-foundation*
*Completed: 2026-06-11*
