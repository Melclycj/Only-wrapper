---
status: pending
phase: 11-terminal-area-polish-live-start-restart
source: [11-VALIDATION.md, 11-03-PLAN.md]
started: 2026-06-14
updated: 2026-06-14
approved: null
---

## Current Test

[AWAITING OPERATOR — this is the BLOCKING end-of-phase human-verify gate for Phase 11
(Terminal Area Polish + Live Start/Restart). `nyquist_compliant` in 11-VALIDATION.md stays
FALSE until the operator explicitly approves. `human_verify_mode: end-of-phase`,
`workflow.auto_advance: false` — this gate is NEVER auto-approved (the 06.1 "passed while
broken" + the 10-10 "never present a known-failing app" lessons are why this gate exists).]

## Context

This is the end-of-phase human-verify gate for Phase 11 (UI-03 + SESS-07). Everything below
was proven AUTOMATICALLY against the freshly-PACKAGED app before this checklist (the app is in
a known-GOOD state — the 10-10 rule):

- **Full suite GREEN against the packaged app** — `npm run test` exits 0: **401 unit tests**
  (46 files) + **15/15 smoke spec files** (incl. the rewritten `startup-command` recycle-model
  SC3 + the dormant Start re-spawn, `header-controls` menu-Restart-absent, `alt-screen-reset`,
  `app-restart-restore`, `pty-resize`, `search-bar`).
- **`security.guard.test.ts` GREEN at `EXPECTED_API_KEYS === 20`** — the contextBridge surface
  is dynamically asserted (`Object.keys(exposed).sort()` === the 20-key array, incl. the
  retained-but-un-surfaced `ptyRestart`). `src/main/*` is byte-untouched this phase.
- **`tokens-completeness.test.ts` + `status-colors.test.ts` GREEN** — every `var(--token)`
  resolves; no banned literals; overlay-only-when-running contract intact.
- **No restart affordance in the build** — `grep -rc 'data-testid="restart-session"'
  src/renderer` → **0** (sidebar ↻ + context-menu Restart deleted; the `ptyRestart` machinery
  is kept un-surfaced per D-01).
- **Fresh packaged no-injection capture** — `npm run ui:shots:fresh` exits 0 (tag `p11-gate`,
  gitSha `8e14a12`); the `terminal-card`, `terminal-running`, and `agent-busy-confirm` surfaces
  captured cleanly and were scored against `tests/ui-lab/DESIGN-RUBRIC.md`:
  - `terminal-card` / `terminal-running`: framed ONE rounded `--surface` card breathing on the
    cream `--bg` with a visible gutter + soft `--shadow-pop` lift — **NOT edge-to-edge**; the
    identity-header cap (icon + name + In progress + Clear/✕) reads attached; the JetBrains-Mono
    prompt renders complete with **NO clipped last row / corner-glyph clip** (the D-03a fidelity
    proof). This closes the Phase-9 baseline Gap #2 ("terminal is an unframed hard rectangle").
  - `agent-busy-confirm`: 18px rounded dialog on a dimmed backdrop, the **Remove** button in the
    danger-ramp red fill + a quiet Cancel (edit-modal/context-menu DNA). The captured frame is
    in the **Free (idle)** agent state so it shows the BASELINE consequence copy — the ESCALATED
    D-04 copy fires only at a real mid-task agent state (unit-proven by `confirm-copy.test.ts`,
    NOT harness-drivable) and is item D-04 below for the operator to confirm LIVE.
  - `idle-card`: recorded **SKIPPED** (manifest reason: *"context menu has no 'Stop' item
    (items: Edit, Remove)"*) — a pre-existing harness limitation, NOT a Phase-11 regression. The
    skip reason itself corroborates SESS-07/D-01 (the context menu is now Edit + Remove only; no
    Stop/Restart). The IdleCard-as-card-sibling is verified LIVE in SC2 + SC3 below.

The contract: `nyquist_compliant` flips `true` ONLY on the explicit operator "approved" signal
recorded here. Automated green alone is NOT proof for these lifecycle-adjacent + visual changes.

## How to Launch

Run the **PACKAGED** app (the gate uses the packaged build, NOT `npm start`):

- `npm run package` → open the built app under `out/Just-Wrapper-darwin-arm64/Just-Wrapper.app`.
  (NOTE: `npm run make` is known to crash on open due to a separate tracked lowdb-LocalStorage
  module-resolution issue — `npm run package` boots clean. The fresh capture above already
  packaged the app; the same `out/` build can be opened directly.)

## Tests

### SC1. FRAMED SESSION CARD + Clear/Remove cluster (UI-03 / D-03)
steps: Glance at the active session.
expected: It reads as ONE framed, breathing terminal card — rounded corners, a soft shadow,
a visible cream gutter to the `--bg` background — NOT an edge-to-edge rectangle. The Clear + ✕
(Remove) controls top-right read as one designed cluster (Remove warms to red on hover).
evidence: `artifacts/ui-lab/p11-gate/terminal-card.png` + `terminal-running.png` (framed card,
gutter, shadow, no clipped row) vs the BEFORE `artifacts/ui-lab/phase9-baseline/terminal-running.png`
(unframed edge-to-edge). `tokens-completeness` GREEN.
result: [PENDING]

### SC1-CV. CORE-VALUE FIDELITY — terminal still native (UI-03, BLOCKING)
steps: Type in the terminal; run `claude --rc` (the canonical 🛋️ scenario), `vim`, and a
scrolling command. Exercise scroll, ANSI/truecolor, alt-screen enter/exit, and a window resize.
expected: Scroll, ANSI/truecolor, alt-screen enter/exit, and resize are ALL unaffected — NO
glyph is clipped by a rounded corner, the last row is fully visible, the cursor is correct. The
card frame is on the WRAPPER only; the xterm grid is untouched (the ResizeObserver re-fits).
evidence: `app-restart-restore.smoke`, `alt-screen-reset.smoke`, `pty-resize.smoke` (correct
`tput cols` after framing) GREEN; the `terminal-card` capture shows no clipped glyph. This is
the BLOCKING Core-Value check — automated smoke corroborates but the operator signs off.
result: [PENDING]

### SC2. WORKING AREA vs INACTIVE LIST clarity (D-03 sibling)
steps: With at least one live session + one dormant (Inactive) session, glance at the layout.
expected: The Working Area (the live framed card) vs the Inactive List (dormant entries) is
obvious at a glance; the dormant IdleCard reads as the live card's SIBLING (same card language,
slate/idle "ready when you are", not an error/empty-void treatment).
evidence: `artifacts/ui-lab/p11-gate/inactive-recipes.png` (dashed eggshell recipe rows + ghost
▶ Start) + `terminal-card.png` (Working Area · n / Inactive · n section labels visible).
result: [PENDING]

### SC3. LIFECYCLE — Start / Remove / Clear + Remove→Start recycle + NO restart anywhere (SESS-07 / D-01)
steps: (a) Scan everywhere for a restart control — sidebar rows, the right-click context menu,
the header. (b) Recycle a running session: Remove it → confirm it lands in the Inactive List →
click Start ▶ → confirm it starts fresh.
expected: There is NO restart control ANYWHERE (no ↻ on any sidebar row, no "Restart" in any
context menu, none on the header). Recycling is Remove → Inactive List → Start ▶ (a fresh
process); you are NEVER forced to type `exit`.
evidence: `grep -rc 'data-testid="restart-session"' src/renderer` → 0; `header-controls.smoke`
asserts the menu Restart is absent; `startup-command.smoke` SC3 proves Remove → Inactive → Start ▶
re-runs the stored command on a fresh process with no "— restarted" separator; the idle-card
skip reason ("context menu has no Stop item: Edit, Remove") corroborates the menu is Edit+Remove.
result: [PENDING]

### SC4. IDENTITY PRESERVED across Remove → Start (SESS-07 / SESS-04 / D-02)
steps: Take a CONFIGURED session (custom name / icon / startup recipe). Remove it → Start it.
expected: It keeps its name, icon, and recipe (same logical identity) — Remove → Start is a
recycle, not a delete. EXPECTED_API_KEYS stays 20 (the IPC surface is unchanged); the xterm/PTY
fidelity path is untouched.
evidence: `app-restart-restore.smoke` (configured persists; dormant Start has no separator) +
`startup-command.smoke` R1 (the dormant Start ▶ re-spawns + RUNS the saved command);
`security.guard.test.ts` GREEN at 20 keys; `src/main/*` byte-untouched this phase.
result: [PENDING]

### D-04. AGENT-BUSY ESCALATION COPY (LIVE, requires a real mid-task agent)
steps: With an agent mid-task (`claude` actively WORKING, or WAITING for your input at a prompt),
click Remove on that session.
expected: The confirm modal copy ESCALATES before the normal consequence sentence:
- working/in-progress → "…still working… end the task mid-run" (or equivalent), then the
  consequence sentence;
- waiting → "…waiting for your input… discard what it's asking for", then the consequence.
When the agent is idle (Free), the modal shows the BASELINE copy ("This ends its running
process and removes the session") with no escalation prefix.
evidence: `confirm-copy.test.ts` unit-proves the escalation string branches by `agentState ∈
{in-progress, waiting}`; the `agent-busy-confirm.png` capture shows the modal chrome + danger
ramp in the Free state (baseline copy). The LIVE escalation requires a real agent state (not
harness-drivable) — this is the operator's check.
result: [PENDING]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
partial: 0
skipped: 0
blocked: 0

(SC1, SC1-CV, SC2, SC3, SC4, D-04 — all PENDING the operator's LIVE sign-off. On approval, mark
each PASS and flip `nyquist_compliant: true` in 11-VALIDATION.md, closing UI-03 + SESS-07.)

## Gaps

(none yet — populated if the operator reports a regression. If terminal fidelity regresses or
any restart control is still reachable, the operator reports it here and does NOT approve →
gap-closure routing.)
