# Phase 12 — RESUME POINT (gap-closure, paused 2026-06-15 at ~65% context)

## Where we are

Phase 12 (Session Form: UI-04/SESS-05/SESS-06) shipped its 3 original plans, then **FAILED the
operator human-gate** with 5 gaps + 1 capture meta-finding (see `12-VERIFICATION.md`). A gap-closure
cycle was planned (12-04..07, plan-checker PASSED 12/12) and **Waves 1+2 are DONE + committed + green**.

| Gap plan | Wave | Status |
|---|---|---|
| 12-04 — blue Save + overlay guard + ui-lab Save-capture + hint assert (GAP-A/E/D-overlay/META) | 1 | ✅ done (ed2fea5, 619c658, ce6467c) |
| 12-05 — app Edit menu (GAP-D root: Cmd+A/C/V/X) | 1 | ✅ done (25507ba, 5ba4a3d, 71894fe) |
| 12-06 — Restart-to-apply prompt + CR-01 surfacing + IN-02 split (GAP-B/C) | 2 | ✅ done (27f4eb9..3d2f7a2) |
| **12-07 — RE-GATE (automated evidence + BLOCKING human-verify)** | 3 | ⏳ **NEXT — resume here** |

**Green state at pause:** `npm run test:unit` 51 files / **448 passed** · `tsc` 0 · restart smoke 4/4
(isolated) · `EXPECTED_API_KEYS` = **20** · `SessionManager.tsx` 798 lines (<800). Working tree clean
(only `.DS_Store` untracked). Branch: `gsd/phase-03-multi-session-session-lifecycle` (the shared dev branch).

## How to resume (next session)

Run the 12-07 re-gate (plan: `12-07-PLAN.md`). Recommended order:
1. **Code-review the gap diff** (12-04..06 — esp. the 12-06 lifecycle/restart code): `/gsd-code-review 12 --fix`
   (or a `gsd-code-reviewer` subagent over the new files: app-menu.ts, RestartApplyPrompt.tsx,
   session-restart-prompt.ts, session-lifecycle-actions.ts, SessionManager.tsx changes, overlay guard).
2. **Automated evidence:** `npm run test:unit && npm run test:smoke` GREEN + `npm run ui:shots:fresh`
   (tag e.g. `p12-regate`) — the `edit-modal` capture now scrolls the **Save button into frame**
   (assertEditSaveCaptured), so confirm the blue Save + even spacing + hints score PASS vs DESIGN-RUBRIC.
   Known parallel-load smoke flake (session-edit/startup-command/pty-resize) → isolate-retry, 3/3 bar.
3. **BLOCKING operator human-verify** (12-07 Task 3) on the packaged app — re-check the 5 fixes LIVE:
   (A) blue "Save changes" + even spacing; (D) Cmd+A selects text / Cmd+C/V/X work / select-all no longer
   closes the modal; (B) edit a live session's launch field → Save → "Restart to apply?" → Restart now
   applies the new command; (C) bad cwd on restart → "Working directory not found" inline; (E) calm hints.
   nyquist flips true ONLY on explicit unqualified "approved".
4. On approval → set `12-VALIDATION.md` `nyquist_compliant: true` → `/gsd-pr-branch main` → `/gsd-ship 12`
   → `/gsd-extract-learnings 12`. Phase 12 then closes; next is Phase 13 (UI-05/UI-06).

## Carried context
- **P0 (separate):** recurring intermittent PACKAGED-app whole-window garble on M1 — build proven sound,
  GPU/env suspect, parked pending a screenshot → see `.planning/debug/packaged-app-intermittent-garble.md`.
- 3 deferred code-review items (WR-04→Phase14 lifecycle, WR-05→harness debt, IN-02 done in 12-06) — see `deferred-items.md`.
- The wdio smoke runs the PACKAGED binary → `npm run package` after any renderer change before smoke/ui:shots.
