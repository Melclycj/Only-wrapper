---
phase: 10-sidebar-visual-polish
verified: 2026-06-11T22:22:00Z
status: gaps_found
score: 7/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/8
  gaps_closed:
    - "GAP-10-A: hover-control cluster now collapses to zero layout width at rest (max-width:0 + overflow:hidden + border-width:0 on .row-control, zeroed container gap/margin-left) — name reclaims full rail width. Human gate ITEM 1 APPROVED."
    - "GAP-10-B / WR-03: data-agent seam now running-gated via pure rowAgentAttr() helper; finished rows can no longer carry stale amber. 8-case unit test green."
    - "WR-04: amber-beats-active edge-bar precedence is now order-independent via compound selector .sidebar-row.active[data-agent='waiting'] (expanded + collapsed rail mirror)."
    - "IN-05: ui-lab sidebar-waiting surface unblocked — deterministic styling-only DOM poke produces a PNG; amber CSS regression now has capture coverage."
  gaps_remaining:
    - "GAP-10-D (S1 blocker): live amber waiting never fires on the current claude --rc permission-prompt frame shape at the human gate."
    - "GAP-10-E (S3): leading gutter too wide — drag handle + icon tile steal too much width from session name."
    - "GAP-10-F (S3): no deterministic name-completeness assertion in ui-lab harness."
  regressions:
    - "WR-01 (code review finding, WARNING): border-width:0 at rest is dead code clobbered by the later .row-control { border: 1px solid transparent } shorthand — hidden controls still contribute ~2px each. The dominant control-cluster width reservation is gone but a residual 2-4px per hidden control remains. Functional impact is minor (name is no longer crushed) but the comment claiming zero-width is inaccurate."
    - "WR-02 (code review finding, WARNING): dormant rows still reserve ~12-18px dead trailing space from flex gap applied between zero-width hidden controls."
    - "WR-03 (code review finding, WARNING): sidebar-agent-attr.test.ts imports SessionStatus from '../shared/types' (wrong path — resolves to nonexistent src/renderer/shared/types); passes silently because it is a type-only import erased by esbuild and tsconfig excludes __tests__."
    - "WR-04 (code review finding, WARNING): ui-lab sidebar-waiting surface has no cleanup hook — the fabricated data-agent='waiting' attribute leaks amber into subsequent captures (inactive-recipes, sidebar-collapsed)."
    - "WR-05 (code review finding, WARNING): ui-lab sidebar-waiting surface poke has no assertion that the attribute or CSS paint landed — a silent no-op produces a false-success screenshot."
gaps:
  - truth: "A waiting row (active OR not) carries an amber left edge bar + amber tint wash (D-09) — fires in the live running app on a real claude --rc permission prompt"
    status: failed
    reason: "GAP-10-D (S1 blocker): at the 2nd human gate (10-06) the row status stayed BLUE at a real Web Search permission prompt (screenshot 2). ITEM 2 failed at step 5-6. The 10-06-SUMMARY hypothesis attributes the failure to the recognizer not matching the frame, but codebase analysis shows classify() DOES match both numberedMenu (❯ 1./2./3.) and claudeFooter ('Esc to cancel · Tab to amend') for the screenshot-2 frame, AND decideAgentTick (agent-tick.ts, from Phase 6.1 080807a) has a settle-INDEPENDENT path that fires regardless of full-frame hash settling. The actual root cause is unconfirmed at the code level; the human gate verdict is the authoritative record. nyquist_compliant stays false."
    artifacts:
      - path: "src/renderer/agent-tick.ts"
        issue: "The settle-INDEPENDENT waiting fast path exists and the unit test (agent-tick.test.ts 4/4 green) proves it fires within WAITING_TICKS (3 × 100ms = 300ms) even when the footer keeps churning the full-frame hash. However the live-app amber still did not appear at the human gate. The discrepancy between code-level analysis (should work) and live gate (did not fire) is unresolved. Requires 10-07 diagnosis with the real frame from screenshot-2."
      - path: "src/shared/agent-state.ts"
        issue: "classify() correctly matches the screenshot-2 frame ('Esc to cancel · Tab to amend' triggers claudeFooter; ❯ 1./2./3. triggers numberedMenu). The recognizer hypothesis in 10-06-SUMMARY.md appears incorrect based on static analysis, but the live failure is the ground truth."
    missing:
      - "10-07 must reproduce the live failure with the exact screenshot-2 frame shape, diagnose whether the issue is in the recognizer, the settle-independent path, the agentRunning gating, the active-pane focus model, or another factor — then fix it and confirm with a real claude --rc permission prompt in the running app."

  - truth: "The leading gutter (drag handle + icon tile) is compactly sized so the session name gets maximum width (GAP-10-E)"
    status: failed
    reason: "GAP-10-E (S3 design adjustment): ITEM 1 was APPROVED at the 2nd gate but the operator requested a NEW minor adjustment — 'the space in the front is too wide. compact a bit to leave more sapace'. This is a post-approval design tweak, not a gate failure, but it blocks the unqualified 'approved' the phase requires."
    artifacts:
      - path: "src/renderer/sidebar.css"
        issue: "The leading gutter (drag handle dots + large icon tile) consumes too much row width per operator feedback. Width values need compaction."
    missing:
      - "Reduce the leading gutter width (drag handle + icon tile) in sidebar.css so the session name receives more horizontal space. Re-verify visually in the running app as part of the 10-07 gate."

  - truth: "The ui-lab harness deterministically asserts name completeness so name-crush regressions are machine-checked (GAP-10-F)"
    status: failed
    reason: "GAP-10-F (S3 harness improvement): operator asked 'why isnt the visualization harness used here to verify whether name is complete?' — no scrollWidth <= clientWidth assertion exists on .row-name in the harness. The SC2 name-legibility verdict is currently eye-scored from PNGs only."
    artifacts:
      - path: "tests/ui-lab/surfaces.ts"
        issue: "No deterministic name-completeness assertion (e.g. scrollWidth <= clientWidth on .row-name, or a long-name fixture + truncation budget check). Human eye-scoring is the only verification path for name legibility."
    missing:
      - "Add a deterministic assertion in the ui-lab harness (scrollWidth <= clientWidth on .row-name, or a long-name fixture asserting no visible overflow) so future name-crush regressions are caught automatically."
---

# Phase 10: Sidebar Visual Polish — Re-Verification Report (after plans 10-05 + 10-06)

**Phase Goal:** The session sidebar presents an intentional visual hierarchy in both expanded and collapsed modes — icon, name, and 5-state status are legible and clearly styled, and the active session is unmistakably distinguished.
**Verified:** 2026-06-11T22:22:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure plans 10-05 + 10-06 executed (2nd gate attempt)

## Context

The prior VERIFICATION.md (1st gate, 10-04 plan) recorded `gaps_found` with 5/8 score and two blockers: GAP-10-A (name crush at hover), GAP-10-B (amber waiting never fired). Plans 10-05 (code fixes) and 10-06 (2nd gate) then executed. This report captures the current state after both gap-closure plans.

**Key facts confirmed from artifacts:**
- 10-VALIDATION.md: `nyquist_compliant: false`; 2nd gate verdict `NOT_APPROVED_PARTIAL` recorded verbatim
- 10-06-SUMMARY.md: ITEM 1 (name legibility) APPROVED with minor adjustment request; ITEM 2 (live amber) FAILED
- 10-REVIEW.md: delta code review of 10-05 changes found 0 Critical / 5 Warning / 1 Info
- Unit suite 365/365 green; tsc 0 errors; scoped lint clean; smoke 15/15 green (per 10-06-SUMMARY)

## Goal Achievement

### Roadmap Success Criteria

| # | SC | Status | Evidence |
|---|----|---------|---------| 
| SC1 | A human scanning the sidebar can instantly tell which session is active — it is visually distinct from inactive rows at a glance | VERIFIED | 2nd human gate: ITEM 1 APPROVED. sidebar.css: .sidebar-row.active has background: var(--surface) + border-left: 3px solid var(--accent) + box-shadow: var(--shadow-pop). Packaged capture p10-gapfix-after: pixel-cited PASS. |
| SC2 | Each row's icon, name, and status badge read with clear hierarchy; the 5 statuses are legible and distinguishable | VERIFIED (with open minor adjustment) | 2nd human gate ITEM 1 APPROVED. GAP-10-A (hover control name crush) closed by 10-05: .row-control now collapses to max-width:0 + overflow:hidden at rest. WR-01 border-width dead code leaves ~2px residual per hidden control (code review WARNING) but name is no longer crushed. GAP-10-E (leading gutter width) is a new minor adjustment request — separate gap, not a gate block on SC2 itself. |
| SC3 | In collapsed (icon-only) mode the active session and per-row status remain identifiable; layout stays clean at narrow rail width | VERIFIED | 1st gate PASS (confirmed not regressed). sidebar.css: .sidebar.collapsed .sidebar-row.active edge bar + .row-text/.row-secondary hidden + .collapsed-status-dot 10px ring. |
| SC4 | Sidebar interactions (click-to-switch, drag-to-reorder, keyboard switching) and terminal keep-alive on switch are not regressed | VERIFIED | Smoke suite 15/15 PASS including session-edit, app-restart-restore, keyboard-switch, reorder, sidebar-collapse. |

**SC score from roadmap: 3/4 SCs VERIFIED, SC2 provisionally VERIFIED at the capture level but the phase gate is blocked by GAP-10-D (ITEM 2 amber failure) and GAP-10-E (adjustment request).**

### Plan Frontmatter Must-Have Truths

| # | Plan Truth | Status | Evidence |
|---|-----------|--------|----------|
| P01-T1 | secondaryText derives a live row's line-2 as '{statusWord} · {cwdTail}' and a recipe row's as startupCommand→cwdTail→statusWord (D-03) | VERIFIED | row-secondary.ts exists, exports cwdTail and secondaryText. Full suite 365/365 green including row-secondary tests. |
| P01-T2 | cwdTail returns only the last path segment of a cwd, on both / and \\ separators | VERIFIED | row-secondary.test.ts: separator-tolerant tests pass (365/365 suite green). |
| P01-T3 | clampToViewport keeps a menu's left/top inside [margin, viewport-size] for every corner/overflow case (D-14) | VERIFIED | viewport-clamp.test.ts: all corner cases pass. ContextMenu.tsx imports and calls clampToViewport (line 15 + line 57). Human gate PASS (step 7, 1st gate). |
| P01-T4 | sidebar CSS rules served from sidebar.css, imported after tokens.css in index.tsx; terminal.css no longer contains .sidebar-row block | VERIFIED | grep confirms: terminal.css has no `.sidebar-row {`; sidebar.css contains `.sidebar-row`; index.tsx import order: tokens.css → terminal.css → sidebar.css. |
| P01-T5 | tokens-completeness.test.ts scans sidebar.css; ui-lab injection helper injects sidebar.css | VERIFIED | tokens-completeness.test.ts readFileSync on sidebar.css (confirmed in prior verification, test green). helpers.ts includes `src/renderer/sidebar.css` in UI_LAB_LIVE_CSS. |
| P02-T1 | Active row is a filled --surface card with --line border, --shadow-pop lift, and status-colored left edge bar (SC1) | VERIFIED | sidebar.css: .sidebar-row.active contains var(--shadow-pop) and border-left: 3px solid var(--accent). Packaged capture p10-gapfix-after PASS. Human gate ITEM 1 APPROVED. |
| P02-T2 | Every row reads as two lines: name full-width (line 1), status dot + D-03 secondary (line 2) — names no longer crushed (SC2/Gap 1) | VERIFIED (open minor adjustment) | GAP-10-A closed: .row-control max-width/padding/border-width collapse to 0 at rest (.sidebar-row .row-control lines 201-209); .row-controls container gap/margin-left zeroed at rest (lines 169-179); restored on hover/active. WR-01 code review WARNING: border-width:0 is dead code (clobbered by later border: shorthand at line 242), leaving ~2px per hidden control — minor residual, not a name-crush blocker. Human gate ITEM 1 APPROVED. GAP-10-E (leading gutter width) is a separate adjustment request. |
| P02-T3 | Waiting row carries amber left edge bar + amber tint wash (D-09) — fires on non-active rows AND in live running app | FAILED | GAP-10-D (S1 blocker): at 2nd human gate ITEM 2 FAILED — amber never appeared at a real claude --rc Web Search permission prompt (screenshot 2, row stayed BLUE). CSS seam is correct (sidebar.css lines 96-108: [data-agent='waiting'] with amber border-left + color-mix wash; collapsed mirror at line 473). rowAgentAttr running gate is correct (row-secondary.ts:33-37; 8-case unit test green). decideAgentTick settle-independent path is correct (agent-tick.ts:94-117; 4-case unit test green). classify() matches screenshot-2 frame (claudeFooter + numberedMenu). Live failure root cause unresolved. |
| P02-T4 | Inactive-List rows render as dashed-border recipe cards with always-visible ghost ▶ Start (D-11/D-13, Gap 5) | VERIFIED | sidebar.css: .sidebar-row[data-dormant] with dashed border; .row-control-start opacity:1 (always-visible ▶). Human gate PASS (1st gate step 6). Packaged capture inactive-recipes.png: PASS. |
| P02-T5 | Collapsed icon-only mode: active tile filled/lifted with edge bar, status dot ~10px, two-line text hidden (SC3/D-07/D-10) | VERIFIED | sidebar.css collapsed block: .sidebar.collapsed .sidebar-row.active border-left + .row-text/.row-secondary hidden (display:none). .collapsed-status-dot ~10px with ring. Human gate SC3 PASS (1st gate step 8). |
| P02-T6 | Section labels read 'WORKING AREA · {n}' / 'INACTIVE · {n}' with hairline divider; frozen interactions unregressed (SC4) | VERIFIED | Sidebar.tsx: sidebar-section-count span with workingArea.length/inactiveList.length (lines 552+568). Smoke suite 15/15 green. |
| P03-T1 | Context menu opens at cursor, clamped into viewport, never overlaps sidebar header (D-14/Gap 4 position) | VERIFIED | ContextMenu.tsx: clampToViewport imported (line 15) and called after getBoundingClientRect (line 57). Human gate PASS (1st gate step 7). |
| P03-T2 | Destructive menu item (Remove/Delete) renders in --color-danger ramp (D-15/Gap 4 danger) | VERIFIED | SessionManager.tsx: danger:true on lines 742+747. terminal.css: .context-menu-item-danger rule exists. Human gate PASS (1st gate step 7). |
| P04-T1 | Full packaged no-injection ui-lab capture exists, scored against DESIGN-RUBRIC.md with pixel-cited verdicts | VERIFIED (with caveat) | p10-gapfix-after capture: 11 surfaces including now-capturable sidebar-waiting.png (unblocked by IN-05/10-05). Rubric rescored: SC2 PASS (name no longer crushed at rest), D-09 PASS (amber edge bar + wash on sidebar-waiting.png). Static capture caveat: cannot prove live amber detection — that requires human gate which FAILED for ITEM 2. |
| P04-T2 | Full test suite (unit + tsc + eslint + smoke) GREEN against packaged app | VERIFIED | 365/365 unit (42 files), tsc exit 0, lint clean on phase-10 files (8 pre-existing spike errors scoped out), 15/15 smoke — all confirmed GREEN in 10-06-SUMMARY against packaged binary. |
| P04-T3 | Human verifies SC1-SC4 in running app and signs off with unqualified approval | FAILED | 2nd gate (10-06) returned NOT_APPROVED_PARTIAL: ITEM 1 APPROVED (with minor adjustment request GAP-10-E); ITEM 2 FAILED (amber never fired — GAP-10-D). No unqualified "approved" received. nyquist_compliant stays false (10-VALIDATION.md confirmed). |

**Score: 7/9 plan truths verified** (P01-T1 through P01-T5, P02-T1, P02-T4, P02-T5, P02-T6, P03-T1, P03-T2, P04-T1, P04-T2 verified — but P02-T3 FAILED (GAP-10-D amber) and P04-T3 FAILED (human gate not approved). P02-T2 is VERIFIED with open adjustment request (GAP-10-E) treated as separate gap.)

*Note: Score calculated against distinct must-have truths, counting P02-T3 and P04-T3 as the two failing items, all others verified.*

### Deferred Items

None. GAP-10-D/E/F are routed to a 10-07 plan within Phase 10 — not addressed by any later milestone phase. Phases 11-15 address different requirements (UI-03, SESS-05/06/07, DEBT-01/02, VAL-01, WIN-01/02).

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/row-secondary.ts` | Pure D-03 secondary-line + cwdTail + rowAgentAttr | VERIFIED | Exists; exports cwdTail, secondaryText, rowAgentAttr; no react/electron/xterm imports. |
| `src/renderer/viewport-clamp.ts` | Pure D-14 clampToViewport math | VERIFIED | Exists; exports clampToViewport; pure. |
| `src/renderer/sidebar.css` | Extracted sidebar visual rules consuming tokens.css var(); .row-control zero-width-at-rest | VERIFIED (WR-01 residual) | Exists; contains .sidebar-row, [data-agent='waiting'], .row-text, .row-secondary, .row-control max-width:0 at rest. Code review WR-01: border-width:0 is dead code — ~2px per hidden control residual. |
| `src/renderer/__tests__/row-secondary.test.ts` | Branch coverage of secondaryText/cwdTail | VERIFIED | Exists; tests green (365/365 suite). |
| `src/renderer/__tests__/viewport-clamp.test.ts` | Corner/overflow coverage of clampToViewport | VERIFIED | Exists; all corner cases pass. |
| `src/renderer/__tests__/sidebar-agent-attr.test.ts` | 8-case unit test for rowAgentAttr running-gate (WR-03) | VERIFIED (broken import) | Exists; 8/8 cases pass. Code review WR-03: type import from '../shared/types' is WRONG path — should be '../../shared/types'; passes silently because type-only import erased by esbuild + tsconfig excludes __tests__. Not a runtime defect but the type guard is unenforced. |
| `src/renderer/Sidebar.tsx` | Two-line row, zero-width-at-rest controls, data-agent seam running-gated via rowAgentAttr | VERIFIED | Row structure: .row-text/.row-secondary with secondaryText (line 297); rowAgentAttr imported (line 29), called (line 198), applied as data-agent (line 247); --accent on row (line 247). Zero-width collapse in sidebar.css closes GAP-10-A. |
| `src/renderer/ContextMenu.tsx` | measure-then-clamp positioning via clampToViewport + danger-styled item branch | VERIFIED | clampToViewport imported (line 15) + called (line 57); danger? branch renders .context-menu-item-danger (line 126). |
| `src/renderer/SessionManager.tsx` | danger:true on Remove and Delete items | VERIFIED | Lines 742+747: danger:true on both. |
| `src/renderer/terminal.css` | .context-menu-item-danger rule | VERIFIED | Rule present with --color-danger styling. |
| `tests/ui-lab/surfaces.ts` | sidebar-waiting drivable surface (amber PNG capturable) + inactive-recipes | VERIFIED (open WR-04/WR-05) | sidebar-waiting surface unblocked by IN-05 (10-05): deterministic data-agent poke produces PNG. inactive-recipes drivable surface exists. Code review WR-04: no cleanup hook — amber attribute leaks into subsequent captures. WR-05: no assertion the poke landed — silent no-op risk. |
| `src/renderer/agent-tick.ts` | Settle-independent amber-waiting fast path (Phase 6.1) | VERIFIED (live failure unexplained) | Exists (Phase 6.1 commit 080807a); decideAgentTick settle-independent path fires after WAITING_TICKS regardless of full-frame hash; 4-case unit test green. Live amber still failed at 2nd human gate — root cause unresolved, routed to 10-07. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/renderer/index.tsx` | `src/renderer/sidebar.css` | import './sidebar.css' after './terminal.css' | WIRED | Confirmed in prior verification. |
| `src/renderer/__tests__/tokens-completeness.test.ts` | `src/renderer/sidebar.css` | readFileSync + var()-completeness scan | WIRED | Confirmed; test green. |
| `tests/ui-lab/helpers.ts` | `src/renderer/sidebar.css` | UI_LAB_LIVE_CSS injection list | WIRED | Confirmed. |
| `src/renderer/Sidebar.tsx` | `src/renderer/row-secondary.ts` | import { secondaryText, rowAgentAttr } | WIRED | Line 29 imports both; line 198 calls rowAgentAttr; line 297 calls secondaryText. |
| `src/renderer/Sidebar.tsx` | `src/renderer/status-colors.ts` | presentation(s.status, agentState) supplies --accent + secondary label | WIRED | Line 199. |
| `src/renderer/sidebar.css` | per-row inline --accent channel | border-left-color: var(--accent) on .active + [data-agent='waiting'] amber | WIRED | Lines 89 + 96-108. |
| `src/renderer/ContextMenu.tsx` | `src/renderer/viewport-clamp.ts` | import { clampToViewport } | WIRED | Lines 15 + 57. |
| `src/renderer/SessionManager.tsx` | `src/renderer/ContextMenu.tsx` | danger: true on Remove/Delete items | WIRED | Lines 742+747. |
| `src/renderer/Sidebar.tsx` data-agent | CSS [data-agent='waiting'] amber | rowAgentAttr running-gate → data-agent attr → amber CSS | WIRED (live failure on D-09) | CSS selector exists and fires correctly when data-agent='waiting' is present (confirmed by ui-lab sidebar-waiting.png). rowAgentAttr correctly gates on status==='running'. Live amber failed at human gate (GAP-10-D). |
| `src/renderer/SessionView.tsx` agentTick | `src/renderer/agent-tick.ts` decideAgentTick | setInterval tick → decideAgentTick → emitAgent → handleAgentState | WIRED (live failure unexplained) | Wiring confirmed in source: line 384-388 calls decideAgentTick; agent-tick.ts has settle-independent path. classify() matches screenshot-2 frame shape. Live failure root cause unresolved. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `Sidebar.tsx` `.row-secondary` | `secondaryText(s, stat.label)` | row-secondary.ts pure function reading s.status/s.cwd/s.startupCommand from live SessionRecord | Yes | FLOWING |
| `Sidebar.tsx` `.sidebar-row[data-agent]` | `rowAgentAttr(s.status, agentState)` | SessionManager.tsx handleAgentState stores agentState when status==='running'; rowAgentAttr gates the attribute; decideAgentTick emits 'waiting' via settle-independent path | CSS fires correctly when attribute is present (ui-lab captures); live emission path fails at human gate | HOLLOW (CSS-level correct; live detection fails at 2nd gate — GAP-10-D unresolved) |
| `ContextMenu.tsx` `pos.left/pos.top` | `clampToViewport(x, y, ...)` after `getBoundingClientRect()` | window.innerWidth/innerHeight + measured rect | Yes | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — behavioral spot-checks require a running packaged Electron app with PTY and display. The human gate serves as the live behavioral verification. Human gate results are the ground truth.

---

## Probe Execution

No phase-declared probes. No conventional probe scripts. Step 7c: SKIPPED.

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UI-02 | 10-01, 10-02, 10-03, 10-04, 10-05, 10-06 | The session sidebar presents a clear visual hierarchy — icon, name, 5-state status legible and intentionally styled; active session unmistakably distinguished | BLOCKED | 2nd human gate NOT_APPROVED_PARTIAL. ITEM 2 (live amber waiting — GAP-10-D, S1 blocker) FAILED. UI-02 stays OPEN per 10-06-SUMMARY.md `requirements-completed: []` and 10-VALIDATION.md `nyquist_compliant: false`. |

No orphaned requirements — UI-02 is the only requirement declared for Phase 10.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/sidebar.css` | 206 vs 242 | `border-width: 0` at rest is dead code — clobbered by later `.row-control { border: 1px solid transparent }` shorthand at line 242 (same specificity 0,2,0; later source-order wins). Hidden controls still occupy ~2px each. Comment at line 210 claiming "24px = the .row-control width below" is inaccurate (actual: 26px). | WARNING | WR-01 (code review). Minor residual width; name is no longer crushed but the zero-width invariant is not achieved. Fix: move zero-collapse block after the compact-button block, or add `box-sizing: border-box`. |
| `src/renderer/sidebar.css` | 169-188 | Dormant rows restore `gap: var(--space-1)` on `.row-controls` but flex gap is inserted between ALL flex items including zero-collapsed ones — ~12-18px invisible dead trailing space (3 inter-item gaps + WR-01 border residual). | WARNING | WR-02 (code review). Partial recurrence of name-crush on Inactive-List rows with startup commands. Fix: scope dormant exemption so only the visible ▶ contributes layout width. |
| `src/renderer/__tests__/sidebar-agent-attr.test.ts` | 16 | `import type { SessionStatus } from '../shared/types'` — wrong path; resolves to nonexistent `src/renderer/shared/types`. Passes silently (type-only import + tsconfig excludes __tests__). The typed completeness guard the test header advertises is not actually enforced. | WARNING | WR-03 (code review). Not a runtime defect; the test's 8-case logic is correct. Fix: `import type { SessionStatus } from '../../shared/types'`. |
| `tests/ui-lab/surfaces.ts` | 321-348 | `sidebar-waiting` surface has no `cleanup` hook — `data-agent='waiting'` attribute leaks into subsequent captures (inactive-recipes, sidebar-collapsed), which show unexplained amber-reserved signals that no real state produced. | WARNING | WR-04 (code review). Misleads design reviewers. Fix: add `cleanup` hook to remove the attribute. |
| `tests/ui-lab/surfaces.ts` | 339-346 | `row?.setAttribute('data-agent', 'waiting')` with no assertion that the attribute or CSS amber paint landed. Silent no-op if querySelector misses. | WARNING | WR-05 (code review). False-success screenshot risk. Fix: `browser.waitUntil` that the attribute is present before capture. |

No TBD / FIXME / XXX debt markers found in Phase-10-modified files.

---

## Human Verification Required

The 2nd human gate (10-06) returned NOT_APPROVED_PARTIAL. The items below are required after the 10-07 gap-closure plan resolves the open items.

### 1. Live Amber Waiting Treatment (GAP-10-D — BLOCKER)

**Test:** Launch the app. Start a `claude --rc` session. Wait for it to present a Web Search permission prompt (the "Tool use / Web Search / Do you want to proceed? / ❯ 1. Yes / 2. Yes, don't ask again / 3. No / Esc to cancel · Tab to amend" screen). Observe the sidebar row for that session.
**Expected:** The row shows an amber left edge bar and a light amber wash within 1-2 seconds of the prompt appearing. Line 2 reads "Waiting for you". The amber should appear both when the session is active (foreground) and when another session is active (the claude session is backgrounded in the tab bar).
**Why human:** Requires a live agent process hitting a real permission prompt. The static ui-lab capture proves CSS fires when data-agent='waiting' is poked, but proves nothing about live detection. The 10-06 gate confirmed this gap is live even with the CSS and rowAgentAttr fixes in place.

### 2. Leading Gutter Compaction (GAP-10-E — minor)

**Test:** Launch the app, create sessions with medium-length names. Observe the sidebar row left edge (drag handle dots + icon tile).
**Expected:** After the 10-07 fix, the leading gutter is noticeably more compact, leaving more horizontal space for the session name.
**Why human:** Visual proportion judgment — no automated metric captures "feels right" for gutter width.

### 3. Unqualified Approval (Phase Gate)

**Test:** After 10-07 closes GAP-10-D/E/F, repeat the full verification script (all steps from 10-04-PLAN.md). The phase gate requires an explicit, unqualified "approved" — no "partial" or "with adjustments."
**Expected:** Operator types "approved" without qualification.
**Why human:** The Nyquist gate is human-only; no automated assertion can substitute.

---

## Gaps Summary

Three open gaps block Phase 10 from closing. One is a hard blocker (S1); two are minor (S3) but were requested at the human gate and cannot be waived without explicit decision:

**GAP-10-D (S1 BLOCKER):** Live amber "Waiting for you" treatment never fired at the 2nd human gate at a real `claude --rc` Web Search permission prompt. The CSS and rowAgentAttr seams are correct (confirmed by ui-lab capture and unit tests). The decideAgentTick settle-independent path exists and its unit tests pass. The live failure root cause is unresolved. The 10-06-SUMMARY hypothesis (recognizer misses the frame) appears incorrect from static analysis — classify() matches both numberedMenu and claudeFooter for the screenshot-2 frame. The 10-07 plan must reproduce the failure with the real screenshot-2 frame, diagnose the actual root cause, fix it, and confirm amber fires in the running app.

**GAP-10-E (S3):** Operator requested the leading gutter (drag handle dots + large icon tile) be compacted to give the session name more horizontal width. ITEM 1 was approved but this adjustment was requested alongside the approval and must be addressed.

**GAP-10-F (S3):** No deterministic name-completeness assertion in the ui-lab harness. SC2 name-legibility is currently verified only by eye-scoring PNGs. Operator asked why the harness wasn't used here. A `scrollWidth <= clientWidth` assertion on `.row-name` (or a long-name fixture) should be added.

Additionally, five code-review Warnings (WR-01 through WR-05) from the 10-05 delta review are unfixed but none are blockers. They reduce correctness/robustness and should be addressed in 10-07.

**Structured gaps in YAML frontmatter above for `/gsd-plan-phase 10 --gaps`.**

---

_Verified: 2026-06-11T22:22:00Z_
_Verifier: Claude (gsd-verifier) — re-verification after gap-closure plans 10-05 + 10-06_
