---
phase: 10
slug: sidebar-visual-polish
status: complete
nyquist_compliant: true
wave_0_complete: true
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

**Approval:** ✅ APPROVED — human gate attempt 5 (plan 10-15, 2026-06-13): operator gave an explicit unqualified approval of all three items (ITEM J scroll-invariant status + ITEM K CJK rendering + GAP-10-D/E/F/G/H/I no-regression sweep). `nyquist_compliant: true`. UI-02 complete; Phase 10 closeable. See Human Gate History below.

---

## Human Gate History

`nyquist_compliant` stays **false** until the operator gives an explicit, unqualified "approved" in the running app (06.1/08 visual-phase precedent). Automated green is NOT proof.

| Attempt | Plan | Date | Verdict | Outcome |
|---------|------|------|---------|---------|
| 1 | 10-04 | 2026-06-11 | **NOT APPROVED** | step 4 (name crush) + step 5 (amber waiting) failed → GAP-10-A/B/C routed to 10-05 code fixes |
| 2 | 10-06 | 2026-06-11 | **NOT APPROVED (PARTIAL)** | ITEM 1 (name legibility) APPROVED with one minor adjustment; ITEM 2 (live amber waiting) FAILED — amber never fired on a real `claude --rc` permission prompt → GAP-10-D (blocker) + GAP-10-E/F (minor) routed to 10-07 |
| 3 | 10-10 | 2026-06-12 | **NOT APPROVED (QUALIFIED)** | ITEM A/B/C all CONFIRMED working live (GAP-10-D/E/F/G closed); but a NEW defect was reported — a duplicate Start affordance on an inactive/dormant row → **GAP-10-H** (gate-qualifying) routed to round 4 (next plan 10-12). Verbatim verdict + classification below. |
| 4 | 10-13 | 2026-06-12 | **NOT APPROVED (QUALIFIED)** | ITEM H (single Start, GAP-10-H) APPROVED + ITEM I (waiting wash-only, GAP-10-I) APPROVED — both CLOSED; operator accepts the single-Start design (sidebar ▶ suppressed when the IdleCard mounts). But a NEW defect was reported — scrolling the terminal history up flips the sidebar status (free→in-progress→waiting) → **GAP-10-J** (gate-qualifying), plus a CJK/encoding terminal-fidelity gap → **GAP-10-K**, routed to round 5 (next plan 10-14). Verbatim verdict + classification below. |
| 5 | 10-15 | 2026-06-13 | **✅ APPROVED (unqualified)** | ITEM J (scrolling no longer flips the sidebar status — GAP-10-J) + ITEM K (Chinese renders in the terminal — GAP-10-K) + the GAP-10-D/E/F/G/H/I no-regression sweep all CONFIRMED live in the packaged app; operator: "approve all three" → `nyquist_compliant: true`, UI-02 COMPLETE, Phase 10 closeable. Verbatim verdict + classification below. |

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

### Attempt 4 — verbatim operator response (2026-06-12)

> "just notice that chn is not enabled. what is the current char encoding used? ITEM H: approve ITEM I: apprve. One bug: when i scolling the sesison history up, the status changes from free to in progress to awiring for you."

**Classification (orchestrator analysis):**

| Item | Disposition |
|------|-------------|
| **ITEM H** — single Start affordance on inactive/dormant rows (GAP-10-H) | **APPROVED — CLOSED.** Operator explicitly accepts the single-Start design: when a dormant row is selected and its IdleCard "▶ Start session" mounts, the sidebar ▶ is suppressed (the IdleCard Start is the sole Start). This is option A (no change requested), and it is exactly the round-3 ask ("remove the original start button"). |
| **ITEM I** — amended waiting look, wash only (GAP-10-I) | **APPROVED — CLOSED.** Waiting = amber wash only (no edge bar), expanded + collapsed; active-row status-colored edge bar preserved. |
| **NEW DEFECT (gate-qualifying)** — "when i scrolling the session history up, the status changes from free to in progress to waiting for you" | **GAP-10-J** — the agent-state classifier samples the terminal frame from the VISIBLE viewport, not the live output tail, so scrolling scrollback re-classifies old frames and the sidebar status flips. Root cause located: `src/renderer/SessionView.tsx` (~lines 396–401) reads `term.buffer.active.getLine(b.viewportY + i)` (viewportY = scroll-dependent) instead of `b.baseY` (the live tail). Fix (round 5): sample from `baseY` / `length - rows` so status is scroll-independent; pin with a scroll-then-assert-status-unchanged regression test. Routes to gap-closure **round 5 (plan 10-14)**. |
| **OPERATOR QUESTION + terminal-fidelity gap** — "chn is not enabled. what is the current char encoding used?" | **GAP-10-K** — CJK/Chinese does not render in the terminal. Encoding is NOT the fault: the data path is UTF-8 end-to-end (node-pty forwards UTF-8 strings; xterm.js decodes UTF-8; `@xterm/addon-unicode11` gives CJK the correct 2-cell width). Likely causes: (1) `pty.spawn` env (`src/main/pty-manager.ts` ~328) inherits `process.env` with NO explicit `LANG`/`LC_ALL`/`LC_CTYPE` — a Finder-launched app lacks a UTF-8 locale, so CLI tools fall back to C/POSIX (ASCII) and won't emit CJK; (2) `--font-mono: 'JetBrains Mono', monospace` (`tokens.css:69`) has no CJK glyphs → tofu / imperfect fallback. Fix (round 5 or todo): set a UTF-8 `LANG`/`LC_ALL` in the spawn env + add a CJK-capable monospace fallback. Core-value relevant (real terminal fidelity). |
| **CARRIED (pre-existing, NOT Phase-10 scope)** — `npm run make` lowdb crash | The `make` distributable build shows lowdb's browser `LocalStorage`/`WebStorage` source on open (module-resolution pulls the browser ESM in the ASAR/make path). The app uses `lowdb/node` JSONFile only; the `npm run package` build boots clean (smoke 15/15 + boot-verify GREEN). `forge.config.ts` / vite config predate Phase 10. A packaging/distribution item — capture as a todo (or fold into round 5 if the operator wants the make path fixed). |

**Current state:** `nyquist_compliant: false` (verified unchanged). Requirement **UI-02 stays OPEN**. GAP-10-H and GAP-10-I are now CLOSED (operator-approved live); GAP-10-D/E/F/G remain closed (no-regression). The verdict is QUALIFIED by a new defect, so it is NOT the required unqualified "approved". New open items: **GAP-10-J** (scroll→status, gate-qualifying) + **GAP-10-K** (CJK locale/font terminal fidelity); carried: the `npm run make` lowdb packaging crash. Route: `/gsd-plan-phase 10 --gaps` → round 5 (fix plan 10-14 + a new gate plan). The gate flips true only after GAP-10-J is closed and the operator re-verifies with an explicit unqualified "approved".

### Attempt 5 — verbatim operator response (2026-06-13)

> "approve all three"

Context: the operator was asked to confirm exactly three items in the running packaged app — ITEM J (scroll-invariant status), ITEM K (CJK rendering), and the GAP-10-D/E/F/G/H/I no-regression sweep. "approve all three" is an explicit, unqualified approval of all three — no qualification, no "but", no new defect or request.

**Classification (orchestrator analysis):**

| Item | Disposition |
|------|-------------|
| **ITEM J** — scrolling the session history no longer flips the sidebar status (GAP-10-J) | **APPROVED — CLOSED.** The classifier now samples the live tail (`buffer.baseY`) via the pure `sampleAgentFrame` helper instead of the scroll-moved `viewportY`; the sidebar status is scroll-position-independent (operator-confirmed live). |
| **ITEM K** — Chinese renders in the terminal (GAP-10-K) | **APPROVED — CLOSED.** A UTF-8 `LANG`/`LC_ALL` reaches the spawned child when none is inherited (the Finder-launch case; an existing UTF-8 locale is honored, win32 untouched) + a CJK monospace fallback (`PingFang SC`/`Microsoft YaHei`) backs JetBrains Mono in both the CSS and xterm font stacks. CJK renders as real glyphs (operator-confirmed live). |
| **No-regression sweep** — GAP-10-D (live amber) / E (gutter) / F+G (name completeness) / H (single Start) / I (wash-only waiting) + SC1-SC4 | **CONFIRMED unregressed** in the running app. |

**Current state:** `nyquist_compliant: true`. Requirement **UI-02 COMPLETE**. All gaps GAP-10-A through GAP-10-K are CLOSED and operator-approved live. Phase 10 is closeable. The fifth human gate (attempt 5, plan 10-15) returned an explicit unqualified approval — the round-5 fixes (scroll-invariant status + CJK rendering) are confirmed in the running packaged app. Backlog items remain non-gate: real icons, an animation system, metadata-based Claude state capture, and the `npm run make` lowdb packaging crash (separate todo; `npm run package` boots clean).
