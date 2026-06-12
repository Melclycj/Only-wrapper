---
phase: 10
slug: sidebar-visual-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | {pytest 7.x / jest 29.x / vitest / go test / other} |
| **Config file** | {path or "none — Wave 0 installs"} |
| **Quick run command** | `{quick command}` |
| **Full suite command** | `{full command}` |
| **Estimated runtime** | ~{N} seconds |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `{tests/test_file.py}` — stubs for REQ-{XX}
- [ ] `{tests/conftest.py}` — shared fixtures
- [ ] `{framework install}` — if no framework detected

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | REQ-{XX} | {reason} | {steps} |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — human gate NOT APPROVED through attempt 3 (QUALIFIED — new GAP-10-H; see Human Gate History below)

---

## Human Gate History

`nyquist_compliant` stays **false** until the operator gives an explicit, unqualified "approved" in the running app (06.1/08 visual-phase precedent). Automated green is NOT proof.

| Attempt | Plan | Date | Verdict | Outcome |
|---------|------|------|---------|---------|
| 1 | 10-04 | 2026-06-11 | **NOT APPROVED** | step 4 (name crush) + step 5 (amber waiting) failed → GAP-10-A/B/C routed to 10-05 code fixes |
| 2 | 10-06 | 2026-06-11 | **NOT APPROVED (PARTIAL)** | ITEM 1 (name legibility) APPROVED with one minor adjustment; ITEM 2 (live amber waiting) FAILED — amber never fired on a real `claude --rc` permission prompt → GAP-10-D (blocker) + GAP-10-E/F (minor) routed to 10-07 |
| 3 | 10-10 | 2026-06-12 | **NOT APPROVED (QUALIFIED)** | ITEM A/B/C all CONFIRMED working live (GAP-10-D/E/F/G closed); but a NEW defect was reported — a duplicate Start affordance on an inactive/dormant row → **GAP-10-H** (gate-qualifying) routed to round 4 (next plan 10-12). Verbatim verdict + classification below. |

### Attempt 3 — verbatim operator response (2026-06-12)

> "the start button on the inactive task does not remove the original start button. Also later i need to remove all emoji that represent icon and generate real icons. I also want to define the animation of this application and implement them in the future. Item A yes but i remember in early pahse the decision is to keep the stage color only as the background, confirm. Item B yes, Item C yes."

**Classification (orchestrator analysis):**

| Item | Disposition |
|------|-------------|
| **ITEM A** — live amber waiting (GAP-10-D) | **YES — confirmed live in the running app.** The S1 blocker that failed attempts 1 and 2 is now closed. |
| **ITEM B** — gutter compaction (GAP-10-E) | **YES.** |
| **ITEM C** — active-row name completeness (GAP-10-F / GAP-10-G) | **YES.** Names read complete on inactive AND active rows. |
| **NEW DEFECT (gate-qualifying)** — "the start button on the inactive task does not remove the original start button" | **GAP-10-H** — duplicate Start affordance on an inactive/dormant row. Routes to gap-closure **round 4 (plan 10-12)**. Code pointers for the round-4 plan: `Sidebar.tsx` startAffordances suppression logic (lines ~208-214, ~308-324; R3 2026-06-09 added "IdleCard ▶ is the sole Start surface for the active dormant row" dedup) and `sidebar.css` `[data-dormant] .row-control-start` always-visible rules (~lines 216, 265-267, 309-325). |
| **DESIGN QUESTION** — operator asked to confirm whether an early decision said state color appears "only as the background" | **Answered from decision history — NO change requested, spec conforms.** Evidence: locked **D-09** specifies amber tint wash + amber left edge bar together; **D-06** locks the status-colored edge bar; the **GAP-10-C addendum** (operator's own 2026-06-11 decision) re-confirmed keeping status-colored edge bars and pre-agreed that any post-fix visual re-judgment becomes a NEW design item, not a phase-10 change. The current implementation conforms to the locked spec. If the operator later opts for background-only, that is a new design item. |
| **BACKLOG** (explicitly "later"/"future" — NOT gate items) | Captured in `.planning/todos`: (1) replace emoji icons with real icons; (2) define + implement an animation system; (3) evaluate metadata-based Claude state capture. |

**Current state:** `nyquist_compliant: false` (verified unchanged). Requirement **UI-02 stays OPEN**. ITEM A/B/C (GAP-10-D/E/F/G) are all CONFIRMED closed in the running app — but the response is a QUALIFIED verdict carrying a new defect report, not the required unqualified "approved". The new open item is **GAP-10-H** (duplicate Start affordance on inactive/dormant rows). Route: `/gsd-plan-phase 10 --gaps` → round 4 (plan 10-12 fix + a new gate re-run plan). The gate flips true only after GAP-10-H is closed and the operator re-verifies with an explicit unqualified "approved".
