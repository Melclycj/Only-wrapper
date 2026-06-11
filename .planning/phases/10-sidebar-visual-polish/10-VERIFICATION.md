---
phase: 10-sidebar-visual-polish
verified: 2026-06-11T00:00:00Z
status: gaps_found
score: 5/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Each row reads as two lines: line 1 = full-width session name (ellipsis on overflow), line 2 = a status dot + the D-03 secondary text — names are no longer crushed (SC2, D-01/D-03)"
    status: failed
    reason: "GAP-10-A: hover-reveal row controls (.row-controls flex:0 0 auto + per-button opacity:0 rather than display:none or max-width:0) reserve their full rendered width permanently. The name column is squeezed at rest; on hover the controls become visible and the crush becomes legible. Human gate step 4 failed: 'the edit, remove and restart icon occupy most of the space'. Root cause confirmed in WR-01: opacity:0 does not remove layout box — the cluster width is always reserved."
    artifacts:
      - path: "src/renderer/sidebar.css"
        issue: ".row-controls is flex:0 0 auto; individual .row-control buttons use opacity:0 (not display:none or max-width:0), permanently consuming layout width equal to drag-handle + 4 buttons × 24px + gaps. On a 220px rail this leaves ~40–60px for the name."
      - path: "src/renderer/Sidebar.tsx"
        issue: "Controls are always in DOM (by design for E2E driver) but the CSS does not collapse their box contribution when hidden. No max-width:0 or layout-zero trick is applied at rest."
    missing:
      - "Apply max-width:0 + overflow:hidden on .row-control at rest so the invisible controls consume no layout width; restore max-width on hover/active/focus-within. OR use an alternative zero-layout approach (e.g. position:absolute controls overlay rather than displace the text). The always-visible dormant .row-control-start must continue to reserve its width. Validate fix with a long-name session on a non-active, non-dormant row in the packaged ui-lab capture."

  - truth: "A waiting row (active OR not) carries an amber left edge bar + a light amber tint wash + 'Waiting for you' on line 2 (D-09)"
    status: failed
    reason: "GAP-10-B: No amber treatment appeared in the running app (human gate step 5: 'no'). Root causes confirmed in WR-02 and WR-03 of 10-REVIEW.md. WR-02: agentState can only be *stored* on a row when row.status==='running' (SessionManager.tsx:567), but the live detector path has no automated proof that it ever emits 'waiting' for a real claude --rc permission screen — the harness permanently SkipSurface'd sidebar-waiting (surfaces.ts:338), so the amber path has zero capture coverage and the only proof was the manual gate, which failed. WR-03: the data-agent attribute in Sidebar.tsx:242 is gated only on agentState being truthy, NOT on status==='running' — a row that was 'waiting' and then self-exited retains data-agent='waiting' (stale amber on a finished row). The apply-status-event.ts reducer correctly clears agentState on lifecycle transitions (line 80), but the JSX seam does not enforce the running gate independently."
    artifacts:
      - path: "src/renderer/SessionManager.tsx"
        issue: "WR-02: handleAgentState (line 567) only stores agentState while row.status==='running'. Whether the live agent detector (decideAgentTick in SessionView) actually emits 'waiting' for a real waiting agent is unproven — the SkipSurface means this path has never been exercised in the automated harness."
      - path: "src/renderer/Sidebar.tsx"
        issue: "WR-03: data-agent attribute (line 242) is gated on agentState truthiness only, not on status==='running'. A finished/exited row that was previously waiting retains data-agent='waiting', causing the amber edge bar + wash on a done session."
      - path: "tests/ui-lab/surfaces.ts"
        issue: "sidebar-waiting permanently throws SkipSurface (lines 338-342) — zero automated capture coverage for the amber styling. Any CSS regression in the waiting treatment is invisible to the harness."
    missing:
      - "Investigate whether decideAgentTick in SessionView emits 'waiting' for a real claude --rc permission screen; if the detector is the failure point, fix the detection logic (not just the CSS)."
      - "Gate the data-agent JSX attribute on s.status==='running' AND agentState truthy (prevents stale amber on finished rows, WR-03 fix)."
      - "Add a deterministic test-only seam in the ui-lab harness to set data-agent='waiting' on a row directly so the amber styling is capturable without a real agent process (IN-05 fix), and unblock the sidebar-waiting surface from permanent SkipSurface."
      - "Add a unit/component test that drives handleAgentState(id, 'waiting') on a running row and asserts data-agent='waiting' is rendered."

  - truth: "A full packaged, no-injection ui-lab capture exists for the Phase-10 surfaces and is scored against DESIGN-RUBRIC.md with pixel-cited verdicts (Plan 04 SC)"
    status: failed
    reason: "GAP-10-A and GAP-10-B are live-app failures the static capture could not exercise. The packaged capture itself was produced (p10-after, gitSha bf00a94, 11 surfaces) and all drivable rubric lines passed, but SC2 (two-line hierarchy / Gap 1) and D-09 (amber waiting) are proven failures in the live app. The capture is incomplete as evidence because it cannot drive hover states or a real agent process."
    artifacts:
      - path: "artifacts/ui-lab/p10-after/"
        issue: "Capture exists and 11 surfaces present, but hover-state name crush (GAP-10-A) and amber waiting treatment (GAP-10-B) are not exercised by static capture — these require live-app verification which failed."
    missing:
      - "After gap closure: re-run npm run ui:shots:fresh and rescore SC2 (name not crushed in hover state) and D-09 (amber wash visible) — these require the live-app human re-verify to confirm."
deferred: []
human_verification:
  - test: "After gap closure for WR-01: verify hover-state name is no longer crushed"
    expected: "Hovering over any running/non-active row shows the edit/remove/restart controls but the session name remains legible (not crushed to a few characters); the full name is visible or clearly ellipsis-truncated at a reasonable length"
    why_human: "hover state cannot be exercised by the static packaged ui-lab capture harness; requires live app interaction"
  - test: "After gap closure for WR-02/WR-03: verify amber waiting treatment fires in the running app"
    expected: "A session waiting for agent input (e.g. claude --rc permission prompt) shows an amber left edge bar and light amber row wash; a backgrounded waiting session shows amber while you are on another session; a session that has finished does NOT show amber"
    why_human: "requires a real agent process (claude --rc) to trigger the waiting state; the automated harness permanently skips this surface"
---

# Phase 10: Sidebar Visual Polish — Verification Report

**Phase Goal:** The session sidebar presents an intentional visual hierarchy in both expanded and collapsed modes — icon, name, and 5-state status are legible and clearly styled, and the active session is unmistakably distinguished.
**Verified:** 2026-06-11
**Status:** gaps_found
**Re-verification:** No — initial verification
**Human gate verdict:** NOT APPROVED (recorded in 10-04-SUMMARY.md) — the blocking human-verify returned two FAIL items (GAP-10-A hover-state name-crush, GAP-10-B missing amber waiting treatment) and one design-feedback item (GAP-10-C edge-bar color semantics). A visual phase cannot pass on automated green alone; nyquist_compliant remains false.

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | A human scanning the sidebar can instantly tell which session is active — it is visually distinct from inactive rows at a glance | VERIFIED | Packaged capture p10-after/sidebar-populated.png: filled card + status-colored border-left + box-shadow vs flat inactive rows. Human gate step 3 passed (with design note GAP-10-C). .sidebar-row.active CSS exists with background:var(--surface), border-left:3px solid var(--accent), box-shadow:var(--shadow-pop). |
| SC2 | Each row's icon, name, and status badge read with clear hierarchy; the 5 statuses are legible and distinguishable | FAILED | Human gate step 4: "the edit, remove and restart icon occupy most of the space." Name is crushed in hover state. WR-01: .row-controls flex:0 0 auto + opacity:0 (not max-width:0) reserves full control cluster width permanently. |
| SC3 | In collapsed (icon-only) mode the active session and per-row status remain identifiable; layout stays clean at narrow rail width | VERIFIED | Human gate step 8 PASS ("yes"). CSS: .sidebar.collapsed .sidebar-row.active has edge bar; .row-text/.row-secondary hidden; .collapsed-status-dot 10px with ring. |
| SC4 | Sidebar interactions (click-to-switch, drag-to-reorder, keyboard switching) and terminal keep-alive on switch are not regressed | VERIFIED | Human gate step 9 PASS ("yes"). Smoke suite 15/15 PASS against packaged binary (session-edit, app-restart-restore, keyboard-switch, reorder, sidebar-collapse, header-controls). |

**PLAN frontmatter truths (Plans 01-04) merged with roadmap SCs:**

| # | Plan Truth | Status | Evidence |
|---|-----------|--------|----------|
| P01-T1 | secondaryText derives a live row's line-2 as '{statusWord} · {cwdTail}' and a recipe row's as startupCommand→cwdTail→statusWord (D-03) | VERIFIED | row-secondary.ts exists, exports cwdTail and secondaryText. 26 unit tests pass (357/357 suite green). |
| P01-T2 | cwdTail returns only the last path segment of a cwd, on both / and \\ separators | VERIFIED | row-secondary.test.ts: separator-tolerant tests pass. |
| P01-T3 | clampToViewport keeps a menu's left/top inside [margin, viewport-size] for every corner/overflow case (D-14) | VERIFIED | viewport-clamp.test.ts: all corner cases pass. ContextMenu.tsx imports and calls clampToViewport. Human gate step 7 PASS. |
| P01-T4 | sidebar CSS rules served from sidebar.css, imported after tokens.css in index.tsx; terminal.css no longer contains .sidebar-row block | VERIFIED | index.tsx: tokens.css → terminal.css → sidebar.css. grep '.sidebar-row {' terminal.css: no match. sidebar.css contains .sidebar-row. |
| P01-T5 | tokens-completeness.test.ts scans sidebar.css; ui-lab injection helper injects sidebar.css | VERIFIED | tokens-completeness.test.ts line 32+98 scan sidebar.css. helpers.ts line 97 includes src/renderer/sidebar.css. |
| P02-T1 | Active row is a filled --surface card with --line border, --shadow-pop lift, and status-colored left edge bar (SC1) | VERIFIED | sidebar.css lines 86-91: .sidebar-row.active confirmed. |
| P02-T2 | Every row reads as two lines: name full-width (line 1), status dot + D-03 secondary (line 2) — names no longer crushed (SC2/Gap 1) | FAILED | GAP-10-A: opacity:0 on buttons does not remove layout box; name crushed at rest and on hover. Human gate FAIL. |
| P02-T3 | Waiting row carries amber left edge bar + amber tint wash + 'Waiting for you' on line 2 (D-09) — fires on non-active rows | FAILED | GAP-10-B: amber treatment never appeared in running app. WR-02/WR-03 root causes in 10-REVIEW.md. |
| P02-T4 | Inactive-List rows render as dashed-border recipe cards with always-visible ghost ▶ Start (D-11/D-13, Gap 5) | VERIFIED | Human gate step 6 PASS. sidebar.css: .sidebar-row[data-dormant] dashed border + .row-control-start opacity:1 + 999px radius. packaged capture inactive-recipes.png. |
| P02-T5 | Collapsed icon-only mode: active tile filled/lifted with edge bar, status dot ~10px, two-line text hidden (SC3/D-07/D-10) | VERIFIED | Verified above under SC3. |
| P02-T6 | Section labels read 'WORKING AREA · {n}' / 'INACTIVE · {n}' with hairline divider; frozen interactions unregressed (SC4) | VERIFIED | Sidebar.tsx: sidebar-section-count span + workingArea.length/inactiveList.length. Human gate step 6+9 PASS. |
| P03-T1 | Context menu opens at cursor, clamped into viewport, never overlaps sidebar header (D-14/Gap 4 position) | VERIFIED | ContextMenu.tsx: clampToViewport called after getBoundingClientRect. Human gate step 7 PASS. |
| P03-T2 | Destructive menu item (Remove/Delete) renders in --color-danger ramp (D-15/Gap 4 danger) | VERIFIED | SessionManager.tsx: danger:true on lines 742+747. terminal.css: .context-menu-item-danger. Human gate step 7 PASS. |
| P04-T1 | Full packaged no-injection ui-lab capture exists, scored against DESIGN-RUBRIC.md with pixel-cited verdicts | FAILED | Capture exists (p10-after, 11 surfaces) but SC2 and D-09 are live-app failures the static capture cannot exercise. Human gate NOT APPROVED. |
| P04-T2 | Full test suite (unit + tsc + eslint + smoke) GREEN against packaged app | VERIFIED | 357/357 unit, tsc 0, 15/15 smoke, lint clean (pre-existing spikes errors out of scope). |
| P04-T3 | Human verifies SC1-SC4 in running app and signs off | FAILED | Human gate returned NOT APPROVED. Operator failed steps 4 (name crush) and 5 (amber waiting). nyquist_compliant: false confirmed in 10-VALIDATION.md. |

**Score: 5/8 must-have truths verified** (SC1/SC3/SC4 + P03 context menu both sub-truths + base infrastructure verified; SC2 and D-09 FAILED; human gate NOT APPROVED).

### Deferred Items

None — no gaps are addressed by later milestone phases. Phases 11-15 address different requirements (UI-03 through WIN-02); none cover GAP-10-A/B/C.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/row-secondary.ts` | Pure D-03 secondary-line + cwdTail | VERIFIED | Exists; exports cwdTail + secondaryText; no react/electron/xterm imports |
| `src/renderer/viewport-clamp.ts` | Pure D-14 clampToViewport math | VERIFIED | Exists; exports clampToViewport; pure |
| `src/renderer/sidebar.css` | Extracted sidebar visual rules consuming tokens.css var() | VERIFIED | Exists; contains .sidebar-row, .collapsed-status-dot, .rail-tooltip, [data-agent='waiting'], .row-text, .row-secondary |
| `src/renderer/__tests__/row-secondary.test.ts` | Branch coverage of secondaryText/cwdTail | VERIFIED | Exists; 26 tests pass |
| `src/renderer/__tests__/viewport-clamp.test.ts` | Corner/overflow coverage of clampToViewport | VERIFIED | Exists; all cases pass |
| `src/renderer/Sidebar.tsx` | Two-line row, hover-reveal controls, dashed recipe cards, section counts, --accent + data-agent on row | PARTIAL | Row structure exists; .row-text/.row-secondary/.data-agent present; HOWEVER: hover-reveal layout defect (WR-01) means name is crushed |
| `src/renderer/ContextMenu.tsx` | measure-then-clamp positioning via clampToViewport + danger-styled item branch | VERIFIED | clampToViewport imported + called; danger? branch renders .context-menu-item-danger |
| `src/renderer/SessionManager.tsx` | danger:true on Remove and Delete items | VERIFIED | Lines 742+747: danger:true on both |
| `src/renderer/terminal.css` | .context-menu-item-danger rule with --color-danger and color-mix hover | VERIFIED | Lines 317-323: rule present, token-clean |
| `tests/ui-lab/surfaces.ts` | inactive-recipes surface + sidebar-waiting SkipSurface | PARTIAL | inactive-recipes drivable surface exists (line 345). sidebar-waiting is permanent SkipSurface (line 338) — amber styling has zero capture coverage (IN-05) |
| `.planning/phases/10-sidebar-visual-polish/10-04-SUMMARY.md` | Phase-gate evidence: before/after captures, rubric scores, human sign-off | VERIFIED (gate failed) | Exists; human gate verdict NOT APPROVED documented verbatim; nyquist_compliant stays false |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/renderer/index.tsx` | `src/renderer/sidebar.css` | import './sidebar.css' after './terminal.css' | WIRED | index.tsx line 16 |
| `src/renderer/__tests__/tokens-completeness.test.ts` | `src/renderer/sidebar.css` | readFileSync + var()-completeness scan | WIRED | Line 32: resolve path; line 98: test block |
| `tests/ui-lab/helpers.ts` | `src/renderer/sidebar.css` | UI_LAB_LIVE_CSS injection list | WIRED | Line 97 |
| `src/renderer/Sidebar.tsx` | `src/renderer/row-secondary.ts` | import { secondaryText } | WIRED | Line 29 + line 286/292 |
| `src/renderer/Sidebar.tsx` | `src/renderer/status-colors.ts` | presentation(s.status, agentState) | WIRED | Line 195 |
| `src/renderer/sidebar.css` | per-row inline --accent channel | border-left-color: var(--accent) on .active | WIRED | Lines 89+97 |
| `src/renderer/ContextMenu.tsx` | `src/renderer/viewport-clamp.ts` | import { clampToViewport } | WIRED | Line 15 + line 57 |
| `src/renderer/SessionManager.tsx` | `src/renderer/ContextMenu.tsx` | danger: true on Remove/Delete items | WIRED | Lines 742+747 |
| `src/renderer/Sidebar.tsx` → data-agent | `src/renderer/sidebar.css` | [data-agent='waiting'] amber CSS | PARTIAL — wired, functionally broken | data-agent attr emitted (Sidebar.tsx:242) and CSS selector exists (sidebar.css:96-99), but: (a) detector may not emit 'waiting' for real agent; (b) no status guard prevents stale amber on finished rows (WR-03) |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/renderer/Sidebar.tsx` `.row-secondary` | `secondaryText(s, stat.label)` | row-secondary.ts pure function reading s.status/s.cwd/s.startupCommand from SessionRecord | Yes — derives from live session data | FLOWING |
| `src/renderer/Sidebar.tsx` `.sidebar-row[data-agent]` | `agentState` | SessionManager.tsx handleAgentState (line 564), stored when row.status==='running' | Uncertain — agentState storage path is code-correct but the real detector path (decideAgentTick) has no automated proof it emits 'waiting' for a live agent; human gate confirmed amber never appeared | HOLLOW — wired at the CSS/JSX level but not proven to produce amber in the live app |
| `src/renderer/ContextMenu.tsx` `pos.left/pos.top` | `clampToViewport(x, y, ...)` after `getBoundingClientRect()` | window.innerWidth/innerHeight + measured rect | Yes — reads real viewport dimensions | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — behavioral spot-checks require a running packaged Electron app (PTY + display). The human gate serves as the live behavioral verification. Human gate results are recorded in 10-04-SUMMARY.md.

---

## Probe Execution

No phase-declared probes. No conventional probe scripts found for this phase. Step 7c: SKIPPED.

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UI-02 | 10-01, 10-02, 10-03, 10-04 | The session sidebar presents a clear visual hierarchy — icon, name, 5-state status legible and intentionally styled; active session unmistakably distinguished | BLOCKED | Human gate NOT APPROVED. GAP-10-A (hover-state name crush) and GAP-10-B (amber waiting treatment missing) are live-app failures. Requirement UI-02 stays open per 10-04-SUMMARY.md frontmatter: `requirements-completed: []`. |

No orphaned requirements — UI-02 is the only requirement declared for Phase 10 and it is explicitly tracked.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/sidebar.css` | 161-184 | `.row-controls flex:0 0 auto` + `.row-control { opacity:0 }` — opacity:0 does not remove layout box; name column permanently squeezed | BLOCKER | WR-01: root cause of GAP-10-A (human gate FAIL step 4). Name is crushed at rest, not just on hover. |
| `src/renderer/Sidebar.tsx` | 242 | `data-agent` gated on `agentState` truthiness only (not `status==='running'`) | WARNING | WR-03: stale amber on finished/exited rows that were previously waiting. |
| `src/renderer/SessionManager.tsx` | 477-501 | `onPtyStatus` subscription re-binds on every `sessions` change | WARNING | WR-06: listener churn proportional to session count × update frequency. Performance/correctness risk. |
| `src/renderer/ContextMenu.tsx` | 48-67 | `useEffect` (not `useLayoutEffect`) for post-mount clamp; `pos` initialized to raw anchor | WARNING | WR-05: one-frame flash of unclamped position; does not re-clamp on item-count change or window resize. |
| `src/renderer/sidebar.css` | 86-99 | `.sidebar-row.active` and `.sidebar-row[data-agent='waiting']` have equal specificity (0,2,0); waiting wins only by source order | WARNING | WR-04: fragile — any future reorder silently inverts the priority; semantics are order-dependent. |
| `tests/ui-lab/surfaces.ts` | 338 | `sidebar-waiting` permanent `SkipSurface` | WARNING | IN-05: amber styling (the most critical visual signal) has zero automated capture coverage. |

No TBD / FIXME / XXX debt markers found in Phase-10-modified files.

---

## Human Verification Required

Human gate already conducted and returned NOT APPROVED. The items below are required AFTER gap closure.

### 1. Name Legibility in Hover State (GAP-10-A re-verify)

**Test:** Launch the app, create 3+ sessions with long names across both Working Area and Inactive List. Hover over a running non-active row with Edit/Remove/Restart controls.
**Expected:** Session name remains legible on line 1 — not crushed to a few characters by the control cluster; name is either fully visible or clearly ellipsis-truncated at a reasonable length.
**Why human:** Hover state cannot be captured by the static packaged ui-lab harness; requires live mouse interaction in the running app.

### 2. Amber Waiting Treatment (GAP-10-B re-verify)

**Test:** Launch a `claude --rc` session. When it presents a permission prompt (waiting for user input), observe the row in the sidebar (from both the active state and while on another session).
**Expected:** The waiting row shows an amber left edge bar and a light amber wash; line 2 reads "Waiting for you". A backgrounded waiting session shows amber even while on another session. After the session finishes, the amber disappears.
**Why human:** Requires a real agent process to trigger the waiting state; the automated harness has no deterministic way to drive the real claude --rc permission screen.

---

## Gaps Summary

Phase 10 produced solid automated infrastructure (pure modules, CSS extraction, token-completeness guards, context-menu clamp, danger affordance) and most surfaces pass the packaged rubric. The two blocking gaps are **live-app behavioral failures that the static capture harness cannot exercise**:

**GAP-10-A (BLOCKER):** The hover-reveal control cluster occupies permanent layout width (opacity:0, not display:none or max-width:0), squeezing the name column even at rest. This is a layout defect, not a hover defect — the human reviewer correctly identified it in the hover state because that is when the reserved-but-invisible controls become visible and the crush becomes legible. Root cause: WR-01 in 10-REVIEW.md. Fix: collapse control box width at rest (max-width:0 + overflow:hidden on .row-control, or position:absolute overlay approach).

**GAP-10-B (BLOCKER):** The amber "Waiting for you" treatment (D-09) never appeared in the running app. Two compounding code issues: (WR-02) no automated proof that the live agentState detector emits 'waiting' for a real claude --rc permission screen; (WR-03) the data-agent JSX attribute is not gated on status==='running', so finished rows can carry stale amber. The ui-lab harness permanently SkipSurface's this path (IN-05), so there is no regression safety net.

**GAP-10-C (design decision, S3):** The edge bar is status-colored (running=blue per locked spec), but with amber absent the edge bar reads blue-only. The operator expected per-session custom color on the row. The implementation is spec-conformant; this is a design decision for the gap-closure planner.

**Root causes have code-level confirmation** in the committed 10-REVIEW.md (WR-01 through WR-04). The gap-closure plan should address WR-01 (max-width:0 approach), WR-02/WR-03 (agentState detector + JSX gate), and WR-04 (specificity fix for fragile source-order dependency), and add a deterministic ui-lab seam for the amber styling (IN-05).

---

_Verified: 2026-06-11_
_Verifier: Claude (gsd-verifier)_
