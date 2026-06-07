---
phase: 06-robustness-flow-control-polish
plan: 03
type: execute
wave: 3
depends_on: [06-01, 06-02]
files_modified:
  - src/renderer/SessionView.tsx
  - src/renderer/status-colors.ts
  - src/renderer/__tests__/status-colors.test.ts
  - src/renderer/Sidebar.tsx
  - src/renderer/IdentityHeader.tsx
  - src/renderer/SessionManager.tsx
autonomous: true
requirements: [TERM-09]
must_haves:
  truths:
    - "A running session whose output is flowing shows blue 'In progress' (D-07)"
    - "A running session idle ≥ IDLE_MS whose last non-empty line matches the prompt set shows amber 'Waiting for you' oklch(0.66 0.15 60) — this is TERM-09/SC4 (D-07/D-08)"
    - "A running session idle ≥ IDLE_MS with no prompt-pattern match shows slate 'Free' (D-07)"
    - "The agent-state is computed for ALL running sessions and shown on every sidebar row, the collapsed-rail dot, and the identity header — never nags, clears state-driven (D-10)"
    - "Non-running statuses (not_started/stopped/exited/error) are presented exactly as before — the agent-state overlay only applies while status==='running' (D-07)"
  artifacts:
    - path: "src/renderer/SessionView.tsx"
      provides: "renderer-side idle-timer agent-state detector off the onPtyData stream, lifted via onAgentState (zero IPC)"
    - path: "src/renderer/status-colors.ts"
      provides: "AGENT_STYLE ramp + presentation(status, agentState) resolver"
    - path: "src/renderer/__tests__/status-colors.test.ts"
      provides: "unit coverage of the presentation resolver overlay rules"
    - path: "src/renderer/Sidebar.tsx"
      provides: "row dot/badge + collapsed-rail dot consume presentation(status, agentState)"
    - path: "src/renderer/IdentityHeader.tsx"
      provides: "header badge consumes presentation(status, agentState)"
  key_links:
    - from: "src/renderer/SessionView.tsx onPtyData"
      to: "SessionManager per-row agentState"
      via: "onAgentState(id, state) callback prop"
      pattern: "onAgentState"
    - from: "src/renderer/SessionManager.tsx agentState"
      to: "Sidebar + IdentityHeader presentation()"
      via: "presentation(status, agentState)"
      pattern: "presentation\\("
---

<objective>
Vertical slice for SC4 / TERM-09 — the agent-state presentation layer. Builds DESIGN.md's
long-specified attention overlay (amber "Waiting for you" + the running busy/idle split) on
top of the existing 5-state process status, using the pure classifier from Plan 01 driven by
a renderer-side idle timer (zero IPC, no bridge change).

After this slice, while a user works in one session, a backgrounded `claude --rc` that has
printed a `[y/N]` confirmation and gone quiet shows an amber "Waiting for you" dot in the
sidebar rail — honest, conservative, best-effort state that clears itself when the session
moves on. This is the user's north-star framing: "the status should reflect the agent's state."

Purpose: Ship TERM-09 as an honest state overlay (D-06 — NOT a 6th process status, NOT a
separate nagging indicator), computed once and shown everywhere a status is shown.
Output: the detector + the color ramp + the resolver + the three consuming surfaces, GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06-robustness-flow-control-polish/06-CONTEXT.md
@.planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md
@.planning/phases/06-robustness-flow-control-polish/06-PATTERNS.md
@.planning/phases/06-robustness-flow-control-polish/06-UI-SPEC.md
@.planning/phases/06-robustness-flow-control-polish/06-01-SUMMARY.md
@.planning/phases/06-robustness-flow-control-polish/06-02-SUMMARY.md
@src/shared/agent-state.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Agent-state color ramp + presentation() resolver</name>
  <files>src/renderer/status-colors.ts, src/renderer/__tests__/status-colors.test.ts</files>
  <read_first>
    - src/renderer/status-colors.ts (the STATUS_STYLE Record lines 22-31 — the {label, accent} shape + inline oklch accents to mirror)
    - src/shared/agent-state.ts (the AgentState union — imported here for the resolver signature)
    - src/shared/types.ts (the SessionStatus union lines 31-36)
    - .planning/phases/06-robustness-flow-control-polish/06-UI-SPEC.md (§Color "Agent-state accent ramps" lines 93-101 — authoritative oklch; amber reserved exclusively for waiting)
    - .planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md (§Code Examples "status-colors mapping" lines 425-438)
    - .planning/phases/06-robustness-flow-control-polish/06-PATTERNS.md (§status-colors.ts lines 81-97)
  </read_first>
  <behavior>
    - presentation('running', 'in-progress') returns { label: 'In progress', accent: 'oklch(0.62 0.14 248)' } (blue)
    - presentation('running', 'waiting') returns { label: 'Waiting for you', accent: 'oklch(0.66 0.15 60)' } (amber — TERM-09)
    - presentation('running', 'free') returns { label: 'Free', accent: 'oklch(0.64 0.02 260)' } (slate)
    - presentation('running', undefined) returns STATUS_STYLE['running'] (no agent-state yet → process default)
    - presentation('exited', 'waiting') returns STATUS_STYLE['exited'] (the overlay applies ONLY when status==='running' — D-07)
    - presentation('error', anything) returns STATUS_STYLE['error'] (red, unchanged)
    - presentation('not_started', undefined) and presentation('stopped', undefined) return their STATUS_STYLE entries unchanged
  </behavior>
  <action>
    In `src/renderer/status-colors.ts`, add an `AGENT_STYLE` Record mirroring the `STATUS_STYLE` `{ label, accent }` shape with the authoritative oklch ramps from UI-SPEC §Color: `'in-progress'` → blue `oklch(0.62 0.14 248)` "In progress"; `'waiting'` → amber `oklch(0.66 0.15 60)` "Waiting for you"; `'free'` → slate `oklch(0.64 0.02 260)` "Free". Export a `presentation(status: SessionStatus, agent?: AgentState)` resolver: when `status === 'running' && agent` return `AGENT_STYLE[agent]`, else return `STATUS_STYLE[status]`. Import `AgentState` from `src/shared/agent-state.ts`. Do NOT modify `STATUS_STYLE` itself (process-status accents unchanged). Amber `oklch(0.66 0.15 60)` must appear in exactly one place (the waiting ramp) — it is reserved for the highest-attention signal.

    Create `src/renderer/__tests__/status-colors.test.ts` covering every case in the behavior block, asserting the exact label + accent strings AND the overlay-only-when-running rule.
  </action>
  <verify>
    <automated>npm test -- src/renderer/__tests__/status-colors.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `npm test -- src/renderer/__tests__/status-colors.test.ts` passes every behavior-block case
    - `grep -c "oklch(0.66 0.15 60)" src/renderer/status-colors.ts` returns exactly 1 (amber reserved for waiting only)
    - `grep -n "presentation" src/renderer/status-colors.ts` shows the exported resolver
    - `presentation('exited','waiting')` returns the exited style (overlay does NOT leak past running) — asserted in the test
    - `grep -n "STATUS_STYLE =" src/renderer/status-colors.ts` shows STATUS_STYLE is unchanged in shape (process accents intact)
  </acceptance_criteria>
  <done>The agent-state ramp + presentation resolver are GREEN with the overlay-only-when-running contract enforced.</done>
</task>

<task type="auto">
  <name>Task 2: Renderer-side detector in SessionView + lift to SessionManager</name>
  <files>src/renderer/SessionView.tsx, src/renderer/SessionManager.tsx</files>
  <read_first>
    - src/renderer/SessionView.tsx (the onPtyData watermark closure lines 189-204 — extend it; the resize-debounce single-slot timer discipline lines 240-249 cleared in cleanup lines 257-279 — mirror it for the idle timer; the `active` prop lines 84-89 — model onAgentState as a sibling callback prop; the onPtyStatus handler lines 215-236; window.__sessionTerms registration lines 173-178)
    - src/renderer/SessionManager.tsx (how id/active are passed to SessionView lines 381-385; the onPtyStatus per-session subscription effect lines 269-284 — add a parallel renderer-only agentState row state updated by onAgentState; the row-state shape extended with errorMessage in Plan 02 — add agentState beside it)
    - src/shared/agent-state.ts (IDLE_MS, classifyIdle, lastNonEmptyLine — the detector imports these)
    - src/renderer/status-colors.ts (presentation — SessionManager will pass agentState down; consumed by Sidebar/Header in Task 3)
    - .planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md (§Pattern 1 lines 209-233; §Code Examples "detector wiring" lines 407-423; §Common Pitfalls 6 lines 337-339 — timer leak discipline)
    - .planning/phases/06-robustness-flow-control-polish/06-PATTERNS.md (§SessionView.tsx detector lines 44-77; §SessionManager.tsx aggregation lines 101-115; §Single-slot timer discipline lines 251-253)
  </read_first>
  <action>
    In `src/renderer/SessionView.tsx`, add an `onAgentState: (id: LogicalId, state: AgentState) => void` callback prop beside the existing `active` prop. Inside the EXISTING `onPtyData` closure (lines 189-204), alongside the watermark logic, add the detector exactly per Research §Code Examples: maintain a rolling tail `tail = (tail + data).slice(-4096)` (bounded ~4 KB — WR-03 lesson, also bounds ReDoS exposure); on every chunk call `onAgentState(id, 'in-progress')` (output is flowing), clear the single-slot idle-timer ref, then re-arm `setTimeout(() => onAgentState(id, classifyIdle(tail)), IDLE_MS)`. Use a single-slot timer ref cleared-before-re-arm AND cleared in the effect cleanup (lines 257-279), mirroring the resize-debounce discipline (Pitfall 6 — no leak across unmount/rapid output). Gate the whole detector on the session being `running` (do not classify a dormant/exited session). Only call `onAgentState` when the value CHANGES (track the last emitted value to avoid render churn).

    In `src/renderer/SessionManager.tsx`, add a renderer-only `agentState?: AgentState` to the per-session row state (beside `errorMessage` from Plan 02 — no type/bridge change, never persisted). Pass `onAgentState` down to each SessionView (mirror how `id`/`active` are passed at lines 381-385); its handler updates the matching row's `agentState` via functional `setSessions` (mirror the onPtyStatus update pattern lines 269-284). When a session leaves `running` (status change), clear/ignore its agentState so the overlay does not linger (D-10 / D-07). Expose `agentState` per row so Sidebar + IdentityHeader (Task 3) can call `presentation(status, agentState)`.
  </action>
  <verify>
    <automated>npm test 2>&1 | tail -10 && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "onAgentState" src/renderer/SessionView.tsx src/renderer/SessionManager.tsx` returns matches in BOTH (callback defined + passed down)
    - `grep -n "classifyIdle\|IDLE_MS" src/renderer/SessionView.tsx` shows the detector uses the pure module (no inline reimplementation)
    - `grep -n "slice(-4096)\|slice(-4_096)" src/renderer/SessionView.tsx` shows the rolling tail is bounded
    - The idle timer is a single-slot ref cleared in the effect cleanup (verify: the cleanup return clears the timer ref — grep for clearTimeout in the cleanup region)
    - `grep -n "agentState" src/renderer/SessionManager.tsx` shows the per-row state added and passed to the consuming surfaces
    - `npm test` full Vitest suite GREEN; `npm run build` succeeds
  </acceptance_criteria>
  <done>SessionView computes the agent-state off its existing data stream with leak-safe timer discipline and lifts it to SessionManager's per-row state — full suite GREEN.</done>
</task>

<task type="auto">
  <name>Task 3: Consume presentation() in Sidebar row/rail + IdentityHeader badge</name>
  <files>src/renderer/Sidebar.tsx, src/renderer/IdentityHeader.tsx</files>
  <read_first>
    - src/renderer/Sidebar.tsx (the .status-badge/.status-dot markup lines 220-227 using STATUS_STYLE[status]; the .collapsed-status-dot line 215; the renderIcon helper lines 37-60 — unchanged)
    - src/renderer/IdentityHeader.tsx (the identity-only header lines 19-38 — the .status-badge at line 23 using STATUS_STYLE[status]; the leading comment lines 1-8 noting controls are Phase 6/TERM-12)
    - src/renderer/status-colors.ts (the presentation resolver from Task 1)
    - src/renderer/SessionManager.tsx (how agentState reaches these components — props threaded in Task 2)
    - .planning/phases/06-robustness-flow-control-polish/06-UI-SPEC.md (§Interaction 1 lines 143-155 — where shown, calm/no-animation visual treatment, identical chip geometry)
    - .planning/phases/06-robustness-flow-control-polish/06-PATTERNS.md (§Sidebar.tsx lines 138-142; §IdentityHeader.tsx badge line 134)
  </read_first>
  <action>
    In `src/renderer/Sidebar.tsx`, replace the `STATUS_STYLE[status]` accent/label source at lines 222-226 (and the collapsed-rail dot at line 215) with `presentation(status, agentState)` so the row `.status-badge`, `.status-dot`, and the `.collapsed-status-dot` carry the agent-state accent/label for `running` sessions and the unchanged process-status accent otherwise. Thread `agentState` in from the row props (SessionManager passes it). The `renderIcon` helper is unchanged. Visual treatment: identical chip geometry (8px dot, 11px/700 label, gap 5px) — only color + text change; NO animation, NO pulse, NO count badge (calm by design, UI-SPEC §Interaction 1).

    In `src/renderer/IdentityHeader.tsx`, replace the `STATUS_STYLE[status]` badge source at line 23 with `presentation(status, agentState)` so the header badge reflects the agent-state for the active running session. Add an `agentState` prop threaded from SessionManager. Do NOT add the control cluster here yet — that is Plan 04 (SC5). Only the badge source changes in this task.
  </action>
  <verify>
    <automated>npm test 2>&1 | tail -10 && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "presentation(" src/renderer/Sidebar.tsx src/renderer/IdentityHeader.tsx` returns matches in BOTH (the resolver is consumed)
    - `grep -n "STATUS_STYLE\[" src/renderer/Sidebar.tsx src/renderer/IdentityHeader.tsx` returns NO direct lookups for the row/rail/header badge (all routed through presentation())
    - `grep -n "agentState" src/renderer/Sidebar.tsx src/renderer/IdentityHeader.tsx` shows the prop is threaded
    - No animation/pulse keyframe is introduced for the badge (grep for new @keyframes tied to the status badge returns nothing — calm by design)
    - `npm test` full Vitest suite GREEN; `npm run build` succeeds
  </acceptance_criteria>
  <done>The sidebar row, collapsed rail, and identity header badges all render the agent-state overlay via presentation() for running sessions — full suite GREEN.</done>
</task>

</tasks>

<artifacts_this_phase_produces>
Symbols this plan introduces (downstream drift-verification excludes these as newly-created):
- `src/renderer/status-colors.ts`: new export `AGENT_STYLE` (Record), new export `presentation(status, agent?)`
- `src/renderer/SessionView.tsx`: new prop `onAgentState(id, state)`; internal idle-timer detector + rolling tail
- `src/renderer/SessionManager.tsx`: new renderer-only per-row field `agentState?: AgentState`
- `src/renderer/Sidebar.tsx` / `src/renderer/IdentityHeader.tsx`: new `agentState` prop
- New test file: `src/renderer/__tests__/status-colors.test.ts`
(Note: the `AgentState` type and `IDLE_MS`/`classifyIdle`/`PROMPT_RE` are produced by Plan 01, not here.)
</artifacts_this_phase_produces>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| PTY output → renderer detector | Untrusted shell output is scanned by the agent-state regex on the renderer hot path. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-09 | Denial of Service (ReDoS) | PROMPT_RE / ANSI_RE run on attacker-controlled PTY output in SessionView | mitigate | The regexes are linear/anchored (defined in Plan 01); the detector runs them only on a bounded ~4 KB rolling tail, never the full scrollback; the idle timer fires at most once per IDLE_MS, not per chunk. |
| T-06-10 | Denial of Service (resource leak) | The idle setTimeout could stack on rapid output or outlive unmount | mitigate | Single-slot timer ref cleared before re-arm and in the effect cleanup; the detector is gated on status==='running' (Pitfall 6). |
| T-06-11 | Information Disclosure | The detector reads PTY output content | accept | Detection uses ONLY output-activity timing + last-line SHAPE (a regex match boolean), never interprets or stores conversation content — this is the project privacy line (CONTEXT §domain); the tail buffer is ephemeral and bounded. |
| T-06-SC | Tampering | npm/pip/cargo installs | accept | No new dependencies this phase (06-RESEARCH §Package Legitimacy Audit: N/A); no install task. |
</threat_model>

<verification>
- `npm test -- src/renderer/__tests__/status-colors.test.ts` GREEN (resolver)
- `npm test` full Vitest suite GREEN (detector wiring + consumers, no regression)
- `npm run build` succeeds
- E2E + human-verify of the amber "feel" (regex/IDLE_MS tuning A1) is gated at the Plan 04 phase gate per VALIDATION.md Manual-Only Verifications
</verification>

<success_criteria>
- Running + flowing → blue "In progress"; running + idle + prompt → amber "Waiting for you"; running + idle + no-prompt → slate "Free" (D-07)
- Computed for ALL running sessions; shown on every sidebar row, the collapsed rail, and the header; clears state-driven; never nags (D-10)
- The overlay applies ONLY while status==='running'; the 5 process statuses are otherwise unchanged (D-06/D-07)
- The detector is renderer-side, zero-IPC, ReDoS-safe, and leak-safe
</success_criteria>

<output>
Create `.planning/phases/06-robustness-flow-control-polish/06-03-SUMMARY.md` when done
</output>
