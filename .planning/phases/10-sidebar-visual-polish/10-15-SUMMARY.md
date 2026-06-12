---
phase: 10-sidebar-visual-polish
plan: 15
subsystem: gate (round-5 delta review + packaged evidence chain + BLOCKING human re-verify)
tags: [GAP-10-J, GAP-10-K, gate, attempt-5, human-verify, nyquist, gap-closure]
requires:
  - "10-14 round-5 fixes (GAP-10-J baseY sampling + GAP-10-K locale/CJK font)"
  - "the ui-lab harness (packaged, no-injection capture)"
provides:
  - "the attempt-5 human-gate verdict (APPROVED, unqualified) + nyquist_compliant: true"
  - "the round-5 delta code-review record (0 Critical / 0 High)"
  - "UI-02 closed; Phase 10 closeable"
affects:
  - ".planning/phases/10-sidebar-visual-polish/10-VALIDATION.md (gate verdict + flag)"
  - ".planning/phases/10-sidebar-visual-polish/10-REVIEW.md (round-5 delta review)"
tech-stack:
  added: []
  patterns:
    - "gate plan: delta review → packaged evidence chain → BLOCKING human re-verify → record verdict"
key-files:
  created: []
  modified:
    - .planning/phases/10-sidebar-visual-polish/10-REVIEW.md (round-5 delta review section, Task 1)
    - .planning/phases/10-sidebar-visual-polish/10-VALIDATION.md (attempt-5 verdict + nyquist_compliant true, Task 4)
decisions:
  - "Operator verdict \"approve all three\" judged an explicit unqualified approval (all three asked items: ITEM J + ITEM K + no-regression sweep; no qualification/but/new-defect) → gate flips"
  - "idle-card ui-lab surface remained the documented pre-existing skip (not a new failure); all 10 other surfaces captured"
  - "Gate ran inline (not via a spawned executor) — the prior 10-14 executor dropped its API socket on a 29-min run; the gate's heavy packaged-app build + the human checkpoint are orchestrator-owned anyway"
metrics:
  duration: ~25min
  completed: 2026-06-13
  tasks: 4
  files: 2
---

# Phase 10 Plan 15: Round-5 Closing Gate (attempt 5) — APPROVED

**One-liner:** The fifth and final human gate for Phase 10 returned an explicit, unqualified **"approve all three"** — the operator confirmed live in the packaged app that scrolling the session history no longer flips the sidebar status (GAP-10-J), that Chinese renders in the terminal (GAP-10-K), and that the six prior gaps (GAP-10-D/E/F/G/H/I) stay closed. `nyquist_compliant` flips to **true**; UI-02 is complete; Phase 10 is closeable. The round-5 delta code-review was clean (0 Critical / 0 High) and the full automated evidence chain is green against the packaged app.

## Task 1 — Round-5 delta code-review (10-REVIEW.md)

Delta review over commits `e395509^..0cd0662` (the 10-14 GAP-10-J + GAP-10-K source deltas): `agent-tick.ts` (`sampleAgentFrame`), `SessionView.tsx` (viewportLines delegation + xterm fontFamily), `pty-locale.ts` (`resolvePtyLocale`), `pty-manager.ts` (spawn-env wiring), `tokens.css` (`--font-mono`), and the two new regression tests.

**Verdict: clean — 0 Critical / 0 High / 0 Medium / 0 Low / 1 Info.** No Critical/High to fix pre-gate (consistent with the rounds 2-4 verdict).

- **GAP-10-J sampler** — Sound. Reads `buffer.baseY + i` (live tail), pure/DOM-free structural type, preserves the `ln ? … : ''` semantics, both call sites delegate, keep-alive mount + data path untouched, 001 stale-scrollback mitigation preserved.
- **GAP-10-K locale** — Sound. Honors inherited UTF-8 LC_ALL/LANG (never clobbers `zh_CN.UTF-8`), defaults only when absent, win32→`{}`; spread AFTER `process.env` so the override order is correct (C→UTF-8 upgrade works); pure, no console, no bridge edit (EXPECTED_API_KEYS stays 20).
- **GAP-10-K font** — Sound. JetBrains Mono primary → `PingFang SC`/`Microsoft YaHei` → `monospace`, identical in CSS + xterm, no font file bundled.
- **New tests** — genuine, not tautologies: the scroll-invariance assertions would fail on the old `viewportY` code, and a separate case proves a LIVE-tail menu still classifies `waiting`; the locale test pins 8 truth-table rows. No `sleep`/`waitForTimeout`.

**IN-R5-01 (Info, accepted):** `resolvePtyLocale` sets `LC_ALL` (override-all) when defaulting; would supersede an individually-set non-UTF-8 `LC_CTYPE` in the rare case a user sets only that. Non-blocking — the default only fires when no UTF-8 LANG/LC_ALL is present (nothing to clobber), both values are UTF-8, and core-value (CJK) is preserved.

## Task 2 — Full evidence chain against the PACKAGED app (real stdout)

```
$ npm run test:unit          → Test Files  44 passed (44) | Tests  384 passed (384)   (round-4 baseline 373 + 11 new round-5 cases)
$ npx tsc --noEmit           → exit 0
$ npm run lint               → 12 errors, ALL in .planning/spikes/{001,002,003}/*.cjs (the documented tolerated baseline); 0 in any Phase-10 source/test file
$ npm run package            → out/Just-Wrapper-darwin-arm64/Just-Wrapper.app (fresh, includes the 10-14 fixes)
$ npm run test:smoke         → 15 passed, 15 total (100%) in 00:01:13   (startup-command 5/5 — no flake this run)
$ UI_LAB_TAG=p10-gapfix-round5-gate npm run ui:shots
                             → 11 surfaces: 10 captured + idle-card SKIPPED (documented pre-existing harness limitation, not a new failure);
                               name-completeness assertion ENFORCED + PASSING; wash-only sidebar-waiting; none failed.
```

The two NEW 10-14 regression tests (`agent-frame-sample.test.ts` scroll-invariance, `pty-locale.test.ts` locale truth table) are inside the 384 green; the standing 10-07 real-frame regression, the agent-state-replay oracle, tokens-completeness (sidebar.css), and the 10-12 start-affordances truth-table all stay green.

### Rubric rescore (pixel-cited, no-regression items)

Capture tag `p10-gapfix-round5-gate` (gitignored `artifacts/ui-lab/`), window 1280×800:

- **SC1 active-distinct** — PASS. `sidebar-populated`: the active "Session 1" is an elevated white card with the drag handle vs flat sibling rows; `sidebar-waiting`: the active row carries the selection wash.
- **SC2 name complete incl. the ACTIVE row (GAP-10-F/G)** — PASS. "Session 1" (active) reads complete; "Parlour Claude" full on a non-active row; "Marketing Par…" is graceful ellipsis on a genuinely-long name (not a crush). Machine `assertNameNotCrushed` ENFORCED + passing.
- **D-09 wash-only waiting (GAP-10-I)** — PASS. `sidebar-waiting`: amber wash, **no** left edge bar.
- **D-11 dashed recipe cards + single Start (GAP-10-H)** — PASS. `inactive-recipes`: "Dev Server" dashed card with `npm run dev`; the idle detail shows **exactly one** "▶ Start session".
- **Collapsed continuity (SC3)** — PASS (machine-captured `sidebar-collapsed` + smoke `sidebar-collapse` spec green).

**Static-capture caveat (recorded):** GAP-10-J (scroll→status, a live interaction) and GAP-10-K (CJK rendering, needs the running runtime locale + installed fonts) are NOT screenshot-checkable — the capture proves the sidebar STYLING is unregressed; the two round-5 fixes are the human gate's job (Task 3).

## Task 3 — BLOCKING human re-verify (attempt 5)

The packaged app was built and launched for the operator (`out/Just-Wrapper-darwin-arm64/Just-Wrapper.app`; no quarantine xattr — locally built). The operator was given the three-item verification script (ITEM J scroll, ITEM K `echo 你好世界`, no-regression sweep) and asked for an explicit unqualified verdict.

**Verbatim operator verdict:** `"approve all three"`

Judged an **explicit, unqualified approval** of all three asked items — no qualification, no "but", no new defect/request. Mapped:
- **ITEM J** (scrolling no longer flips the sidebar status — GAP-10-J) → APPROVED, CLOSED.
- **ITEM K** (Chinese renders in the terminal — GAP-10-K) → APPROVED, CLOSED.
- **No-regression sweep** (GAP-10-D/E/F/G/H/I + SC1-SC4) → CONFIRMED unregressed.

This is the FIFTH gate; attempts 1-4 all returned NOT APPROVED / QUALIFIED, and each prior gate caught a live failure the static capture passed (GAP-10-D, GAP-10-G, GAP-10-H, GAP-10-J, GAP-10-K). The human gate held: it was never auto-approved.

## Task 4 — Verdict recorded (10-VALIDATION.md)

- `nyquist_compliant: false → true`; `status: draft → complete`.
- Human Gate History: attempt-5 row added (10-15, 2026-06-13, ✅ APPROVED unqualified).
- Attempt-5 verbatim section + per-item classification appended.
- The Approval line updated to ✅ APPROVED.
- STATE.md / ROADMAP.md NOT touched in this task (the orchestrator owns those writes).

## Outcome

- **UI-02 COMPLETE.** All gaps GAP-10-A through GAP-10-K are closed and operator-approved live.
- `nyquist_compliant: true`. Phase 10 is closeable (orchestrator verifier + `phase.complete` own the final mark).
- **Backlog (non-gate, carried):** real icons; an animation system; metadata-based Claude state capture; the `npm run make` lowdb packaging crash (separate todo — `npm run package` boots clean).

## Self-Check: PASSED

- 10-REVIEW.md round-5 section present + references `10-14`, 0 Critical/High — FOUND.
- 10-VALIDATION.md `nyquist_compliant: true` + attempt-5 row citing `10-15` + verbatim verdict — FOUND.
- Evidence chain real stdout: unit 384/384, tsc 0, lint (12 tolerated spike .cjs only), smoke 15/15, ui-lab 10 captured + 1 documented skip — RUN + GREEN.
- No source code changed in this gate plan (review + suite + verdict only); EXPECTED_API_KEYS stays 20.
