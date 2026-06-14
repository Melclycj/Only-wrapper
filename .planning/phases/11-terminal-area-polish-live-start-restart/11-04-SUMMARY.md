---
phase: 11-terminal-area-polish-live-start-restart
plan: 04
subsystem: ui
tags: [terminal, css, design-tokens, xterm, electron-renderer, status-pills, breadcrumb, gap-closure]

# Dependency graph
requires:
  - phase: 11-02
    provides: the framed terminal card + IdentityHeader cap + the D-03a fidelity guardrail (radius/overflow on the wrapper only)
  - phase: 10
    provides: the status ramp (status-colors.ts presentation()) + the --space scale + sidebar.css extraction precedent
provides:
  - Inset rounded terminal WELL — the charcoal terminal is a rounded block inset inside a white --surface card with breathing room around it (mockup-faithful, not flush edge-to-edge)
  - Warmer cream --bg (toward #f3e6d6) so the white card visibly floats on a warm field
  - Breadcrumb session header (session tab + "local · name · cwdTail" path + status on the right)
  - Top status-summary pill strip (live per-status counts Running/Done/Idle/Waiting, colored from the status ramp)
  - A pure, React-free status aggregation reducer (summarizeStatuses) + its unit truth table
affects: [11-05, phase-12, phase-13, terminal-area-polish, ui-lab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inset WELL pattern: a dedicated .terminal-well wrapper owns radius/overflow/charcoal-fill so the xterm grid stays flush inside it (D-03a fidelity-safe) — the ResizeObserver re-fits to the well's inner box, no manual fit()"
    - "Card/container split: .terminal-area is a transparent flex column on cream holding the StatusSummary strip + the white .terminal-card (so chrome can sit on the cream above the card)"
    - "Pure-reducer-for-aggregation: summarizeStatuses (status-summary.ts) keeps the COUNT logic React-free + unit-testable; StatusSummary.tsx only renders pills, colors via presentation() (no re-derived color)"

key-files:
  created:
    - src/renderer/StatusSummary.tsx
    - src/renderer/status-summary.ts
    - src/renderer/__tests__/status-summary.test.ts
  modified:
    - src/renderer/terminal-area.css
    - src/renderer/tokens.css
    - src/renderer/SessionManager.tsx
    - src/renderer/IdentityHeader.tsx
    - tests/smoke/pty-resize.smoke.test.ts
    - tests/ui-lab/surfaces.ts
    - tests/ui-lab/helpers.ts

key-decisions:
  - "Inset well = a NEW .terminal-well wrapper element (not styling the .viewport-stack) — radius/overflow live on the wrapper only so the xterm grid stays flush + un-clipped (fidelity guardrail held)"
  - "Split .terminal-area (transparent container on cream) from .terminal-card (the white surface) so the status pills sit on the cream ABOVE the card, matching the mockup placement"
  - "Status pills colored via presentation() from the existing status ramp — never re-derived; the aggregation is a pure React-free reducer mirroring session-status.ts"
  - "Warmed --bg to oklch(0.915 0.032 74) ≈ #f3e6d6 (tuned across two ui-lab passes), kept as a var() token (no literal leak)"

patterns-established:
  - "Inset WELL: charcoal terminal as a rounded block inside a padded white card — the fidelity-safe way to round/inset the terminal without touching the xterm grid"
  - "ui-lab injection now covers terminal-area.css so well/header CSS-only tuning previews without a repackage"

requirements-completed: [UI-03]

# Metrics
duration: ~95min
completed: 2026-06-14
---

# Phase 11 Plan 04: GAP-11-A — Mockup-Faithful Terminal Area Summary

**The charcoal terminal is now an inset rounded WELL inside a white card with generous breathing room, a warmer cream field, a breadcrumb session header, and a top status-summary pill strip — a faithful match to the mockup IDE view that replaces the operator-rejected flush card.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-06-14T05:30Z
- **Completed:** 2026-06-14T06:10Z
- **Tasks:** 3 (T1 inset well + breathing + cream + breadcrumb; T2 status pills; T3 ui-lab iteration + gate)
- **Files modified:** 10 (3 created, 7 modified)

## Accomplishments
- **Inset rounded terminal well** — the headline fix. The charcoal `--term-bg` terminal is now a rounded block sitting inside a white `--surface` card with `--space-5` white padding all around it (the `--surface` shows around the well). No longer flush edge-to-edge. This is what the operator rejected 11-02 for ("没看出来呼吸感 … 很丑").
- **Generous breathing room inside AND outside** — `--space-5` inner padding + `--space-6` outer margin, so the white card visibly floats on the cream field.
- **Warmer cream `--bg`** — tuned across two ui-lab passes toward the mockup's `#f3e6d6` (`oklch(0.915 0.032 74)`), kept a `var()` token.
- **Breadcrumb session header** — the header reads as a session tab (icon + name) + a `local · {name} · {cwdTail}` JetBrains-Mono path line + the status badge + Clear/✕ on the right, like the mockup.
- **Top status-summary pill strip** — `4 Running · 1 Done · 1 Idle` style pills with status-ramp-colored dots, on the cream field above the card (a new small feature: a pure count-aggregation reducer + the strip).
- **Fidelity held** — all 8 smoke fidelity checks GREEN; no glyph clipped; the terminal still fits correctly on resize.

## Task Commits

Each task was committed atomically:

1. **T1: Inset well + breathing + warmer cream + breadcrumb** — `f6b4d99` (feat)
2. **T2: Status summary pills + card restructure** — `91de57d` (feat)
3. **T3: ui-lab iteration infra + status-summary surface** — `96c081f` (test)

## Files Created/Modified
- `src/renderer/terminal-area.css` — split `.terminal-area` (transparent cream container) from `.terminal-card` (white surface); new `.terminal-well` (charcoal, `--radius`, `overflow:hidden`); breadcrumb header CSS; `.status-summary` + pill styles. Token-only.
- `src/renderer/tokens.css` — warmed `--bg`; new `--space-7`.
- `src/renderer/SessionManager.tsx` — `.terminal-card` wrapper + `.terminal-well` around the viewport-stack (always mounted, all SessionViews); mounted `<StatusSummary>` top strip; IdleCard overlays the well on a `--surface` stage.
- `src/renderer/IdentityHeader.tsx` — breadcrumb header markup + `formatCwdTail` (pure, exported, unit-shaped).
- `src/renderer/StatusSummary.tsx` (new) — the pill strip; colors via `presentation()`.
- `src/renderer/status-summary.ts` (new) — pure `summarizeStatuses` / `rowGroup` aggregation.
- `src/renderer/__tests__/status-summary.test.ts` (new) — 14-case truth table.
- `tests/smoke/pty-resize.smoke.test.ts` — wrap-tolerant `colsFromBuffer` (deviation, below).
- `tests/ui-lab/surfaces.ts` — retargeted `terminal-card` expects + new `status-summary` surface.
- `tests/ui-lab/helpers.ts` — inject `terminal-area.css` in the live-CSS preview list.

## ui-lab Iteration (the look→edit→re-look loop vs the mockup)

The plan T3 requires ≥2 documented passes against `.planning/design/rendered/switchboard-ide-view.png`. I did **three**:

- **Pass 1 (`p11-gapfix-a-iter1`, packaged):** First structural render of the inset well + breadcrumb. Look vs mockup: the well + breathing room + breadcrumb landed and read MUCH better than the rejected flush card, BUT (a) the cream field was too pale/under-saturated vs `#f3e6d6`, and (b) the outer margin was a touch tight so the cream barely showed. **Edit:** warmed `--bg` from `oklch(0.93 0.024 78)` → `oklch(0.915 0.032 74)` (more chroma, slightly lower L) and stepped the outer margin `--space-5` → `--space-6`.
- **Pass 2 (`p11-gapfix-a-iter2`, injection preview):** Re-look vs mockup: the cream now reads as a genuinely warm peachy-cream present all around the card; the inset well + breathing genuinely "breathe" now. The warmth + margin matched. (Used the new `terminal-area.css` injection so this CSS-only tune previewed in seconds without a repackage.)
- **Pass 3 (`p11-gapfix-a-iter3`, packaged):** After adding the StatusSummary strip (T2) + the `.terminal-area`/`.terminal-card` split. Re-look vs mockup: the top pills (`4 Running · 1 Done · 1 Idle` with colored dots) now sit on the cream above the card exactly like the mockup's top strip. All five mockup properties present.

**Final proof capture:** `npm run ui:shots:fresh` under tag **`p11-gapfix-a`** (packaged, no injection — the ground-truth proof). The `terminal-card` + `terminal-running` + `status-summary` captures show the inset rounded well + breathing room + breadcrumb + warm cream + status pills — visibly, dramatically closer to the mockup than the rejected `artifacts/ui-lab/p11-gate/terminal-card.png` (flush edge-to-edge).

## Decisions Made
- **Inset well via a dedicated wrapper, not the viewport-stack** — the `.terminal-well` element owns radius/overflow/charcoal-fill; the `.viewport-stack` keeps its original relative-flex box model flush inside it. This is the only fidelity-safe way to round/inset the terminal (D-03a): the xterm grid is never rounded/padded, the `.term-mount` ResizeObserver re-fits to the well's inner box, no glyph is clipped, no manual `fit()`.
- **`.terminal-area` (cream container) vs `.terminal-card` (white surface) split** — needed so the status pills can sit on the cream ABOVE the card (mockup placement) rather than inside the white card.
- **Status pill colors via `presentation()`** — reused the existing status ramp; the aggregation is a pure React-free reducer (`summarizeStatuses`) so the count logic is unit-tested in Node, mirroring `session-status.ts` / `start-affordances.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrap-tolerant `colsFromBuffer` in pty-resize.smoke**
- **Found during:** Task 1 (running the fidelity smokes after the inset-well landed)
- **Issue:** The `pty-resize.smoke` SC3 test went red. Diagnostic capture proved the terminal DID resize correctly (renderer `term.cols` 109→34, `.term-mount` 290px, and `tput cols` printed **34** with an 800ms settle). The failure was in the test HELPER: my inner padding + outer margin made the resized-to-600px terminal NARROWER (34 cols) than the baseline (~48 cols), so at 34 cols the shell prompt + the echoed `tput cols` command WRAPPED mid-word (`t put cols` after whitespace-collapse). The helper's `lastIndexOf('tput cols')` then missed the most-recent (narrow) echo and fell back to an earlier WIDE reading (109), reporting a stale count for a terminal that DID resize.
- **Fix:** Made `colsFromBuffer` wrap-tolerant — match the command with a whitespace-flexible regex (`t\s*p\s*u\s*t\s+c\s*o\s*l\s*s`) via `matchAll`, take the LAST match, then read the first standalone 2–3 digit number after it. The SC3 reflow assertion (`after !== before`) is UNCHANGED — this is a parser-robustness fix, not a loosening of the test's rigor.
- **Files modified:** tests/smoke/pty-resize.smoke.test.ts
- **Verification:** pty-resize.smoke GREEN 4/4 consecutive runs after the fix (was 0/4 before); the other fidelity smokes (app-restart-restore / alt-screen-reset) stayed GREEN throughout. Diagnostic confirmed the real behavior (cols→34, tput→34) was always correct.
- **Committed in:** f6b4d99 (T1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule-1 test-helper bug)
**Impact on plan:** The fix was necessary for the fidelity smoke to read a correctly-resized narrow terminal. No scope creep; the SC3 assertion is unchanged; the terminal fidelity (Core Value) is provably intact.

## Issues Encountered
- **`min-width:0` needed on the well + stack** — the new flex layer initially could not shrink below the xterm canvas's intrinsic min-content width (default `min-width:auto`), which combined with the test-helper bug above. Added `min-width:0` to `.terminal-well` + `.viewport-stack` so the flex item shrinks on resize. (Resolved as part of T1.)
- **macOS userData case-variants** — the three `Just-Wrapper` / `Just-wrapper` / `just-wrapper` Application Support dirs are the same case-insensitive dir; no window bounds were persisted (`bounds=None`), so the window boots at the 1200×800 default — ruling out a stale-bounds theory during the pty-resize investigation.

## Known Stubs
None — the status-summary reads live renderer session state; the breadcrumb reads the real session record; the inset well wraps the real xterm. No placeholder/empty data flows to the UI.

## User Setup Required
None — renderer-only, no external service configuration.

## Next Phase Readiness
- **GAP-11-A is code-complete and ready for the 11-05 re-gate.** The mockup-faithful terminal area (inset well + breathing + warmer cream + breadcrumb + status pills) is captured fresh-packaged under tag `p11-gapfix-a`. The operator-APPROVED functional gates (SC1-CV fidelity, SC2, SC3 no-restart + Remove→Start recycle, SC4 identity, D-04) are NOT regressed: fidelity smokes GREEN, `restart-session` grep 0, `EXPECTED_API_KEYS` 20, `src/main/*` byte-untouched.
- **Blocker:** `nyquist_compliant` stays FALSE until the operator approves SC1 LIVE on the packaged app (this is the end-of-phase human-verify gate — never auto-approved). UI-03 + SESS-07 stay OPEN until 11-05 re-gates and the operator signs off.

## Self-Check: PASSED

- Created files exist: StatusSummary.tsx, status-summary.ts, status-summary.test.ts, 11-04-SUMMARY.md — all FOUND.
- Task commits exist: f6b4d99 (T1), 91de57d (T2), 96c081f (T3) — all FOUND.
- Fidelity guardrail grep: OK (no radius/overflow/padding on .viewport-stack/.term-mount/.xterm).
- No-restart grep: 0 (restart affordance not regressed).
- Fresh packaged proof capture: artifacts/ui-lab/p11-gapfix-a/terminal-card.png — FOUND.

---
*Phase: 11-terminal-area-polish-live-start-restart*
*Completed: 2026-06-14*
