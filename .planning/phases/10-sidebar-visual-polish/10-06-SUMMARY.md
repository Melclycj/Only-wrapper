---
phase: 10-sidebar-visual-polish
plan: 06
subsystem: testing
tags: [ui-lab, packaged-capture, design-rubric, human-uat, nyquist-gate, sidebar-polish, gap-closure-gate]

# Dependency graph
requires:
  - phase: 10-05
    provides: "code-level gap fixes (GAP-10-A name-crush reclaim, GAP-10-B amber waiting emit→store→render, WR-04 precedence, IN-05 capture seam, sidebar-agent-attr + tokens-completeness + agent-state-replay tests)"
provides:
  - "Phase-gate evidence record (2nd attempt): full automated suite GREEN against the packaged app + fresh no-injection capture incl. the now-drivable sidebar-waiting surface"
  - "Rescored rubric: SC2 / D-01·D-03 PASS (name no longer crushed at rest) and D-09 PASS (amber edge bar + wash on sidebar-waiting.png), replacing the prior FAILED/SkipSurface verdicts"
  - "Recorded human re-verify verdict (PARTIAL): ITEM 1 approved with one adjustment; ITEM 2 FAILED — live amber never fires on the current claude --rc permission-prompt frame"
  - "Three gap items routed to a 10-07 gap-closure plan (GAP-10-D blocker, GAP-10-E minor design, GAP-10-F harness improvement)"
affects: [10-07-gap-closure-plan, phase-10-close, nyquist-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Visual-phase gate = automated GREEN + packaged-capture rubric PASS + BLOCKING human-verify; automated green is NOT proof (06.1/08 precedent) — the human gate again caught a live-app failure the static capture passed"
    - "A NOT_APPROVED human gate is a VALID plan outcome: both tasks ran, the recorded verdict IS the deliverable (mirrors 10-04-SUMMARY.md)"
    - "Recognizer coverage gap pattern: a real agent frame shape (❯-prefixed options, 'Esc to cancel · Tab to amend' tail, question line above the tail) evades the tail-anchored classify()/PROMPT_RE detector — encode the reproduction frame into the replay-oracle corpus, not just the CSS"

key-files:
  created:
    - ".planning/phases/10-sidebar-visual-polish/10-06-SUMMARY.md"
  modified: []

key-decisions:
  - "Recorded the human verdict VERBATIM and routed open items to 10-07 rather than accepting on automated green or on a partial approval (per Task 2 instruction + 06.1/08 visual-phase precedent)"
  - "nyquist_compliant LEFT FALSE in 10-VALIDATION.md — the operator's verdict was PARTIAL (item1 approved w/ adjustment, item2 failed), NOT an unqualified 'approved'; the plan forbids flipping the gate without explicit unqualified approval"
  - "UI-02 stays OPEN (requirements-completed: []) — the blocking ITEM 2 amber failure means the requirement is not met"
  - "Did NOT touch STATE.md / ROADMAP.md (orchestrator owns those writes) and attempted NO code fixes (gap fixes belong to 10-07)"

patterns-established:
  - "Gap items captured as a structured table (id | gap | severity | evidence ref | route) consumable by the 10-07 gap-closure planner"

requirements-completed: []  # UI-02 NOT completed — ITEM 2 (amber waiting) failed the blocking human gate; requirement stays open

# Gap-closure routing (machine-readable for the 10-07 gap-closure planner)
gate_outcome: NOT_APPROVED_PARTIAL
human_gate: NOT_APPROVED_PARTIAL  # item1 approved w/ adjustment, item2 failed
gaps:
  - id: GAP-10-D
    kind: fail
    item: 2
    steps: [5, 6]
    sc: D-09
    spec_refs: [D-09, WR-02, WR-03, WR-04, IN-05]
    summary: "Live amber 'Waiting for you' never fires on the current claude --rc permission-prompt frame shape (bottom line 'Esc to cancel · Tab to amend', ❯-prefixed numbered options, question line 'Do you want to proceed?' sitting above the frame tail). The tail-anchored classify()/PROMPT_RE recognizer does not recognize this frame; the ❯ caret was deliberately dropped from the waiting decision in 06.1 (false-fired as the ambient input caret)."
    human_quote: "i reached here, but the status is till blue. how did you detect when to use aimber?"
    severity: S1
    route: gap-closure
    investigate: [recognizer-frame-shape, classify-PROMPT_RE, agent-tick]
    fix_belongs_in: "recognizer (classify()/PROMPT_RE/agent-tick) + add the operator's screenshot-2 reproduction frame to the replay-oracle corpus"
    hypothesis: true  # likely-cause is orchestrator-supplied; 10-07 must confirm against the real frame
  - id: GAP-10-E
    kind: design-adjustment
    item: 1
    steps: [2, 3]
    sc: SC2
    spec_refs: [D-01, D-03, D-04, D-13]
    summary: "Compact the row's leading gutter (drag-handle dots + large monitor icon tile) so the session name gets more width. ITEM 1 is APPROVED; this is a NEW minor design adjustment requested on top of the approval."
    human_quote: "the space in the front is too wide. compact a bit to leave more sapace"
    severity: S3
    route: gap-closure-design
  - id: GAP-10-F
    kind: harness-improvement
    item: 1
    sc: SC2
    spec_refs: [IN-05]
    summary: "Add a deterministic name-completeness assertion to the ui-lab harness (e.g. scrollWidth<=clientWidth check on .row-name, or a long-name fixture + truncation budget) so name-crush regressions are machine-checked, not eye-scored from PNGs."
    human_quote: "why isnt the visualization harness used here to verify whether name is complete?"
    severity: S3
    route: gap-closure-harness

# Untestable-live note
wr_04_note: "WR-04 (amber-beats-active precedence) was untestable live because amber never rendered (GAP-10-D). CSS-level precedence remains proven by the 10-05 unit/capture evidence only."
gap_10_c_note: "Locked user decision unchanged (status-colored edge bar; per-session custom color on the icon tile) — NOT a fail item this gate."

# Metrics
duration: ~10min (continuation — verdict recording only; Task 1 suite/capture ran in the prior session)
completed: 2026-06-11
---

# Phase 10 Plan 06: End-of-Gap-Closure Verification Gate — Human Verdict Recorded (NOT APPROVED / PARTIAL)

**Automated suite GREEN against the packaged app and the previously-failed rubric lines (SC2 name-crush, D-09 amber) now score PASS in the fresh capture — but the 2nd BLOCKING human re-verify returned a PARTIAL verdict: ITEM 1 (name legibility) APPROVED with one new minor adjustment, ITEM 2 (live amber waiting) FAILED — the amber never fired on a real `claude --rc` permission prompt. Phase 10 stays open, Nyquist gate LEFT FALSE, three items (one blocker + two minor) routed to a 10-07 gap-closure plan.**

## Performance

- **Duration:** ~10 min (continuation agent — verdict recording only)
- **Completed:** 2026-06-11
- **Tasks:** 1 automated (prior session) + 1 human-verify checkpoint (this session, returned NOT APPROVED / PARTIAL)
- **Files modified:** 0 source (verification-only plan; `files_modified: []`)

## Accomplishments

- Full automated suite confirmed GREEN against the **packaged** app (not dev) — unit + tsc + scoped lint + smoke.
- Fresh packaged **no-injection** ui-lab capture (`p10-gapfix-after`, gitSha `452c07f`) produced — including the **now-drivable** `sidebar-waiting` surface (previously a permanent SkipSurface, unblocked by 10-05).
- The two previously-FAILED rubric lines were **rescored PASS** with pixel-cited evidence against the fresh capture.
- BLOCKING human re-verify run against the **running app** — verdict captured verbatim and mapped to ITEM 1 / ITEM 2.
- Honest gate outcome: automated green is **not** proof for a visual phase (the 06.1/08 precedent). The human gate again caught a live-app failure (ITEM 2 amber) that the static capture path scored PASS.

## Task 1 — Full Suite + Fresh Packaged Capture + Rubric Rescore (prior session, verification-only, no commit)

Run against the packaged app `out/Just-Wrapper-darwin-arm64/Just-Wrapper.app`, HEAD `452c07f`.

| Gate | Result |
|------|--------|
| `npm run test:unit` | **365/365 PASS** across 42 files (incl. `sidebar-agent-attr` + `tokens-completeness` scanning sidebar.css + `agent-state-replay` oracle), exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | only the **8 pre-existing** `.planning/spikes/*.cjs` errors (logged in `deferred-items.md`); all Phase-10 source files lint clean |
| `npm run test:smoke` | **15/15 spec files PASS** against the packaged binary |
| `UI_LAB_TAG=p10-gapfix-after npm run ui:shots:fresh` | 11 surfaces captured, packaged no-injection, `manifest.json` present, gitSha `452c07f`, incl. `sidebar-waiting.png` (**now CAPTURED — previously SkipSurface**) and `sidebar-populated.png` |

This task produced **no tracked-file commit** — it is verification-only (`files_modified: []`) and the capture artifacts under `artifacts/ui-lab/` are gitignored.

### Rescored Rubric (fresh capture, pixel-cited) — the two previously-failed lines

| Surface / Spec | Rubric line | Prior verdict | New verdict | Evidence (pixel) |
|----------------|-------------|---------------|-------------|------------------|
| sidebar-populated / D-01·D-03 | SC2 two-line hierarchy — name NOT crushed | **FAILED** | **PASS** | non-hovered rows show full-width ellipsis names; the control box no longer displaces the name at rest |
| sidebar-waiting / D-09 | amber left edge bar + amber wash | **SkipSurface** | **PASS** | `sidebar-waiting.png` shows an amber left edge bar + light amber wash, distinct from white neighbours and the blue active row |

**Static-capture caveat (carried into Task 2):** the fresh capture proves the resting/populated/waiting surfaces but cannot exercise the **live hover state** or a **real agent process** — those are exactly the two items the blocking human re-verify covers.

## Task 2 — BLOCKING Human Re-Verify of the Running App — NOT APPROVED (PARTIAL)

The operator ran the two-item how-to-verify script in the running packaged app and returned a partial verdict with two attached screenshots.

### Verbatim operator response

> "item 1 all approve. one small ajustment is that the space in the front is too wide. compact a bit to leave more sapace. Also why isnt the visualization harness used here to verify whether name is complete? [screenshot 1] i reached here, but the status is till blue. how did you detect when to use aimber? [screenshot 2]"

**Screenshot 1 (ITEM 1 context):** a Working Area sidebar row in hover state — leading edge shows drag-handle dots + a large monitor icon tile occupying a wide leading gutter; the name renders "Ses…"; second line blue dot + "Run…"; ✎ and × controls revealed at the right end.

**Screenshot 2 (ITEM 2 step 5-6 reproduction):** a real `claude --rc` session sitting at a Web Search permission prompt — "Tool use / Web Search(...) / Do you want to proceed? / ❯ 1. Yes / 2. Yes, and don't ask again for Web Search commands in /Users/jerry/Thesis/Thesis-Work / 3. No" with bottom line "Esc to cancel · Tab to amend" — the sidebar row status stayed BLUE (Running); the amber waiting treatment did NOT appear.

### Mapped against the two items

| Item | What it covers | Human verdict |
|------|----------------|---------------|
| **ITEM 1** (steps 1-4) | GAP-10-A name legibility — hover-state + at-rest name not crushed | **APPROVED** — "item 1 all approve". One NEW minor design adjustment requested: the leading gutter (drag handle + icon tile) "space in the front is too wide. compact a bit to leave more sapace" → routed as **GAP-10-E**. Operator also asked why the ui-lab harness doesn't deterministically verify name completeness (SC2 was scored by eye from PNGs) → routed as **GAP-10-F**. |
| **ITEM 2** (steps 5-9) | GAP-10-B amber waiting — fires on a real waiting agent, incl. backgrounded + clears after exit (WR-03) + amber-beats-active (WR-04) | **FAILED** at step 5-6 — at a REAL `claude --rc` Web Search permission prompt the row stayed BLUE; amber never appeared ("the status is till blue"). Steps 7-9 were **NOT reached** because amber never fired. Routed as **GAP-10-D** (blocker). |

**Likely cause of ITEM 2 (hypothesis — 10-07 must confirm against the real frame):** the current `claude --rc` permission frame's BOTTOM line is "Esc to cancel · Tab to amend" and option rows are prefixed with ❯ (deliberately removed from the waiting decision in 06.1 because it false-fired as the ambient input caret); the question line "Do you want to proceed?" sits several lines above the frame tail — this frame shape evades the tail-anchored `PROMPT_RE`/`classify()` recognizer. Screenshot 2 is the exact reproduction frame to encode into the recognizer + the replay-oracle corpus in 10-07.

### Notes (not fail items)

- **WR-04 (amber-beats-active precedence):** untestable live this gate — amber never rendered, so the precedence path could not be exercised. CSS-level precedence remains proven by the 10-05 unit/capture evidence only.
- **GAP-10-C (edge-bar color semantics):** locked user decision unchanged (status-colored edge bar; per-session custom color on the icon tile). NOT a fail item this gate.

### Verdict

**NOT APPROVED (PARTIAL)** — ITEM 1 approved with one minor adjustment; ITEM 2 failed (blocker). The operator did NOT type an unqualified "approved". Per the plan: a partial/failed gate is captured verbatim and routed to a gap-closure plan rather than accepting on automated green.

## Gap Items Routed to 10-07 Gap-Closure

| ID | Kind | Severity | Item / Step | Evidence ref | Summary | Fix belongs in |
|----|------|----------|-------------|--------------|---------|----------------|
| **GAP-10-D** | FAIL (blocker) | **S1** | ITEM 2 / steps 5-6 | Screenshot 2 (operator); D-09; WR-02/WR-03/WR-04/IN-05 | Live amber never fires on the current `claude --rc` permission-prompt frame shape (tail "Esc to cancel · Tab to amend", ❯-prefixed options, question line above the tail) | recognizer (`classify()`/`PROMPT_RE`/agent-tick) + add the screenshot-2 reproduction frame to the replay-oracle corpus |
| **GAP-10-E** | design adjustment | S3 | ITEM 1 / steps 2-3 | Screenshot 1 (operator); D-01/D-03/D-04/D-13 | Compact the row's leading gutter (drag handle + icon tile) so the name gets more width | sidebar layout (leading gutter width) |
| **GAP-10-F** | harness improvement | S3 | ITEM 1 | operator question; IN-05 | Add a deterministic name-completeness assertion (scrollWidth<=clientWidth on `.row-name`, or long-name fixture + truncation budget) so name-crush regressions are machine-checked | ui-lab harness |

## Decisions Made

- **Recorded the human verdict verbatim and routed items to a 10-07 gap-closure plan** rather than accepting on automated green or on a partial approval — per Task 2's explicit instruction and the 06.1/08 visual-phase precedent.
- **Left `nyquist_compliant: false`** in `10-VALIDATION.md` — the verdict was PARTIAL (item1 approved w/ adjustment, item2 failed), not an unqualified "approved"; the plan forbids flipping the gate without explicit unqualified approval. Verified unchanged.
- **UI-02 stays OPEN** — the blocking ITEM 2 amber failure means the requirement is not met (`requirements-completed: []`).
- **Did NOT touch STATE.md / ROADMAP.md** (orchestrator owns those writes) and attempted **NO code fixes** (gap fixes belong to 10-07).

## Deviations from Plan

The plan's success criteria expected the human gate to score an unqualified PASS and the phase to close. Instead the gate returned NOT APPROVED (PARTIAL). This is **not** a deviation in execution — the plan explicitly provisioned for this outcome ("On any fail: capture the failing items verbatim, leave nyquist_compliant false, leave UI-02 open, and route the items to a 10-07 gap-closure plan"). Both tasks ran; the recorded gate verdict IS the deliverable (mirroring 10-04-SUMMARY.md). The honest result: automated gates GREEN, fresh-capture rubric PASS (incl. the previously-failed SC2 + D-09 lines), **human gate FAILED on the live amber item the static capture could not prove**.

## Issues Encountered

- ITEM 2 (GAP-10-D) is exactly the class of failure the blocking human gate exists for: the fresh capture scored D-09 PASS on the driven `sidebar-waiting` surface (the CSS + the data-agent='waiting' seam render amber correctly), but the **live recognizer** never classifies the real `claude --rc` permission frame as "waiting", so the amber never fires in production. The capture proves the *styling* works; only a real agent process proves the *detection* works — and it does not on the current frame shape.

## Next Phase Readiness

- **Phase 10 is NOT closed.** Requirement UI-02 stays open.
- **Next step:** a **10-07 gap-closure plan** addressing GAP-10-D (recognizer frame-shape blocker — fix `classify()`/`PROMPT_RE`/agent-tick + add the screenshot-2 reproduction frame to the replay-oracle corpus), GAP-10-E (compact the leading gutter), and GAP-10-F (deterministic name-completeness harness assertion).
- **Nyquist gate remains FALSE** and flips true only on an explicit unqualified human "approved" after the gaps are closed and re-verified in the running app.

---
*Phase: 10-sidebar-visual-polish*
*Completed: 2026-06-11 (gate verdict: NOT APPROVED / PARTIAL — item1 approved w/ adjustment, item2 failed)*
