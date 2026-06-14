---
phase: 11-terminal-area-polish-live-start-restart
verified: 2026-06-14
status: passed
score: 6/6 success criteria operator-verified LIVE (GAP-11-A closed over rounds 2-3; SC1 approved)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "GAP-11-A (SC1, S1): the framed terminal card lacked breathing room and read flush / uglier than the switchboard mockup. Closed over rounds 2-3. Round 2 (11-04): the charcoal terminal became an inset rounded WELL — the .terminal-well wrapper owns radius/overflow + a --space-3 inner pad so the xterm content breathes inside the block (no corner jam), inside a --space-7 white card gutter; the dormant .idle-card-stage bleeds over the well pad (negative inset) so an idle session shows NO charcoal ring (D-04). Round 3 (operator mockup compare): tightened the OUTER cream margin --space-6 -> --space-4 ('too much background space'); lightened --bg to oklch(0.95 0.022 74) ('背景颜色改的淡一点'); REMOVED the top status-summary pill strip (wrong placement/counting — component+reducer+test+ui-lab surface deleted, deferred for redesign); marked the breadcrumb cwd as the CONFIGURED working dir (dotted-underline + title hint), not the live pwd. Operator approved SC1 LIVE 2026-06-14. D-03a fidelity guardrail held throughout (xterm / term-mount / viewport-stack flush, ResizeObserver re-fits; fidelity smoke GREEN)."
---

# Phase 11: Terminal Area Polish + Live Start/Restart — Verification Report

**Phase Goal:** The terminal-area chrome is visually polished and clearly structured — the active
session reads as one framed, breathing session card (header + terminal), the dormant IdleCard reads
as its sibling, and the live-session controls (Clear / Remove, plus Start on inactive entries) read
as a designed cluster. The session lifecycle is simplified to Start / Remove / Clear — the restart
duality removed, and recycling a session (Remove → Start) no longer requires typing `exit`.
**Verified:** 2026-06-14
**Status:** passed
**Requirements:** UI-03, SESS-07

## Context

Phase 11 reached a BLOCKING human-verify gate (`11-HUMAN-UAT.md`) on 2026-06-14. The first gate
(`NOT_APPROVED_QUALIFIED`) passed 5/6 SCs LIVE — SC1-CV (Core-Value fidelity), SC2, SC3, SC4, D-04 —
but FAILED SC1 (the framed-card visual) → **GAP-11-A**. The gap was closed over two redesign rounds
(11-04 inset well + a round-3 operator-driven refinement pass) and re-gated; the operator approved
SC1 LIVE on the packaged app 2026-06-14. `nyquist_compliant` flipped TRUE in `11-VALIDATION.md`.

## Goal Achievement (goal-backward)

### UI-03 — terminal-area chrome polished + clearly structured — ✅ DELIVERED
- The active session renders as one framed white `--surface` card on the cream `--bg`, with the
  charcoal terminal as an INSET ROUNDED WELL floating inside it with breathing room on all sides
  (`terminal-area.css` `.terminal-card` + `.terminal-well`). Operator-approved SC1 LIVE.
- Header: a breadcrumb `IdentityHeader` — icon + name + status badge + Clear/Remove cluster, then a
  `local · name · cwd` path line (the cwd marked as the configured dir, not the live pwd).
- Working Area (live framed card) vs Inactive List (dormant rows) is obvious at a glance; the dormant
  IdleCard reads as the card's sibling on white — no dark void (D-04). Operator-approved SC2 LIVE.
- Evidence: `artifacts/ui-lab/p11-gapfix-a-final/{terminal-running,inactive-recipes}.png`; 401 unit +
  `tokens-completeness` GREEN.

### SESS-07 — lifecycle Start / Remove / Clear, restart removed, recycle path — ✅ DELIVERED
- NO restart control anywhere: `grep -rc 'data-testid="restart-session"' src/renderer` → 0; the
  header is Clear + Remove only; the context menu is Edit + Remove. `header-controls.smoke` asserts
  the menu Restart is absent. Operator-approved SC3 LIVE.
- Recycle = Remove → Inactive List → Start ▶ (a fresh process); `startup-command.smoke` SC3 proves the
  stored command re-runs with no "— restarted" separator; the user is never forced to type `exit`.
- The hidden `ptyRestart` machinery is retained (D-01); `EXPECTED_API_KEYS` stays 20
  (`security.guard.test.ts` GREEN); `src/main` byte-untouched this phase. Identity (name/icon/recipe)
  preserved across Remove → Start (SC4, operator-approved LIVE).

## Core Value (terminal fidelity) — ✅ NOT REGRESSED
SC1-CV operator-approved LIVE: the terminal stays native (typed, ran the agent / `vim` / scrolling;
ANSI/truecolor + alt-screen enter-exit + resize unaffected; no glyph clipped). **D-03a guardrail**:
radius/overflow/padding live on the `.terminal-well` WRAPPER only; `xterm` / `term-mount` /
`viewport-stack` stay flush; the ResizeObserver re-fits. Fidelity smoke GREEN: `pty-resize` (correct
`tput cols` after framing), `pty-roundtrip`, `pty-throughput`, `alt-screen-reset`, `startup-command`,
`multi-session-keepalive`.

## Test Evidence
- `npm run test:unit` → **401 passed** (46 files); `tokens-completeness` + `status-colors` +
  `confirm-copy` truth-table GREEN.
- `npx tsc --noEmit` → **clean**.
- `npm run test:smoke` → fidelity-critical specs GREEN. NOTE: the `session-edit` smoke
  ("rename did not update live after edit Save") is a CONFIRMED parallel-load timing flake — it
  passes **3/3 in isolation** and passed **15/15 in-suite** before the color-only `--bg` change; it
  is not on a release-critical path and is not a regression of this phase.

## Deferred (out of this phase)
A fixed bottom input line / Warp-style **command composer** (raised during the mockup compare)
conflicts with the v1 Core Value (real-terminal fidelity for TUI agents — `claude --rc` / `codex` /
`vim` run in the alt-screen) and is currently out-of-scope; **deferred to v2** — see
`.planning/v2-ideas/command-composer-agent-shell.md` (`REQUIREMENTS.md` COMP-01).

## Verdict
**PASSED.** UI-03 + SESS-07 delivered; all 6 success criteria operator-verified LIVE; Core Value
intact; `nyquist_compliant` TRUE. **Phase 11 complete.**
