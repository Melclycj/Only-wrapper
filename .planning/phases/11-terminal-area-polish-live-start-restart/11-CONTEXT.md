# Phase 11: Terminal Area Polish + Session Lifecycle Simplification - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

> **Naming note:** the phase dir/slug carries the original ROADMAP title (`…-live-start-restart`).
> A 2026-06-13 operator decision (D-01/D-02 below) **removes the restart UI** — the phase's
> effective lifecycle scope is now *Start / Remove / Clear*, not Start/Restart. The dir slug is
> kept to avoid reference churn; the ROADMAP title + SC4 + REQUIREMENTS SESS-07 are amended to
> match (D-05).

<domain>
## Phase Boundary

Two threads, both renderer-weighted, composed onto the LOCKED Phase-9/10 token system
(`src/renderer/tokens.css`, the Switchboard "warm cozy parlour" direction — DESIGN.md):

1. **UI-03 — terminal-area visual polish (the headline).** The terminal pane is today an
   unframed hard rectangle slammed edge-to-edge (09-HUMAN-UAT Gap 2, S1). This phase turns
   the active terminal + its identity header into ONE **unified, framed session card** —
   an 18px rounded surface floating on the cream `--bg` with real breathing room, the
   `--term-bg` charcoal-indigo terminal inside — and makes the live-session control cluster
   (header) read as designed. The Working-Area (live terminal) vs Inactive-List (dormant)
   distinction must be unambiguous at a glance.

2. **SESS-07 — session-lifecycle simplification (reframed by operator decision).** The
   operator chose to **remove the restart concept from the UI** rather than make it more
   discoverable. The confusing restart duality (a scrollback-preserving `ptyRestart` on the
   sidebar/menu co-existing with a "Remove → Start-fresh" header path) WAS the
   discoverability problem. After this phase the lifecycle vocabulary is **Start (fresh) /
   Remove (retire to Inactive) / Clear (wipe buffer)**; recycling a running session is
   **Remove → Start** (a fresh process). No `exit`-typing required, no restart verb.

**Requirements:** UI-03 (terminal area chrome) + SESS-07 (live-session lifecycle
discoverability — reframed to "Start discoverability + drop the restart duality").

**Hard constraints (carried / locked):**
- **Core-Value guard — terminal fidelity is sacred.** The card framing (radius, padding,
  shadow, breathing room) is a **container-layer** treatment ONLY. The xterm viewport must
  never have its content clipped; `@xterm/addon-fit` must recompute against the new inner
  box; scroll / alt-screen / resize / ANSI / truecolor must not regress. The xterm/PTY data
  path is untouched (renderer-only visual work).
- **Visual direction is LOCKED** (Switchboard — DESIGN.md). This phase composes the terminal
  area from the locked tokens; it does not re-decide palette/type/direction/radius scale.
- **Two-bucket model is LOCKED** (Phase 6.1): Working Area (live) + Inactive List (dormant
  "recipes"); Start ▶ always-visible on every Inactive entry.
- **`EXPECTED_API_KEYS` stays 20.** The restart *machinery* (`window.api.ptyRestart` + main's
  stop→await-exit→respawn orchestration) is KEPT but un-surfaced (operator chose "remove UI
  entry points, keep the underlying mechanism"). No IPC bridge key is removed → the
  security-key budget guard is unchanged.
- **Verification protocol:** the ui-lab loop (`tests/ui-lab/`) is the visual source of truth
  — tagged before/after captures, live-CSS preview for iteration, **packaged no-injection
  capture as proof**, DESIGN-RUBRIC scoring. No visual claim without a capture.

**Explicitly NOT in this phase:**
- Design-token / font re-decision (Phase 9, locked). Sidebar restyle (Phase 10, done).
- Session create/edit form (Gap 3) → Phase 12. Edit-prefill + folder-picker → Phase 12.
- Empty/loading/error state design + app-wide hover/focus/active consistency → Phase 13.
- App-quit-time confirmation guard (the agent-aware-close todo's part 2) → DEFERRED (operator
  chose copy-escalation only).
- App-wide animation/motion system → Phase 13 / standalone; this phase uses only the existing
  Phase-9 motion tokens for control transitions.
- Real icon system (replace emoji glyphs) → backlog.
- 06.1 lifecycle criticals + 05.1 deferred findings → Phase 14. `npm run make` lowdb crash →
  separate build todo.

</domain>

<decisions>
## Implementation Decisions

### Session lifecycle — restart removal (operator decision, 2026-06-13)
- **D-01: Remove the restart UI entry points; keep the machinery hidden.** Delete the
  sidebar `restart-session` ↻ button (`Sidebar.tsx` ~334-349), the context-menu "Restart"
  item (`SessionManager.tsx` ~728-730), and the `onRestart` prop threading. **KEEP**
  `window.api.ptyRestart` + main's restart orchestration + the `— restarted —` separator
  machinery un-wired/hidden (operator chose "remove UI entry points, keep the underlying
  mechanism"). Net: `EXPECTED_API_KEYS` stays **20**, main is untouched, test churn is
  limited to the removed UI affordances. Accepted trade: temporarily-unreachable code.
  `handleRestart` may stay as a dormant helper or be reduced — planner's call — but it MUST
  NOT be reachable from any UI surface after this phase.
- **D-02: Recycle = Remove → Start (fresh, no scrollback).** Recycling a running session is
  the two-step Remove (retire to Inactive List, keeps the recipe) → Start ▶ (fresh process).
  No scrollback-preserving restart remains in the UI. The existing Remove ConfirmModal copy
  already states "moves the session to the Inactive List. You can start it again later." —
  that IS the discoverable recycle path SESS-07 now points to.
- **D-04: Agent-aware close confirmation — copy escalation only.** Thread `agentState` into
  the `ConfirmModal` copy branch in `SessionManager.tsx` (~698-716): when the target row's
  `agentState ∈ {working, waiting}`, the Remove/Delete confirm uses escalated wording (e.g.
  "Claude is still working in this session — closing will end it mid-task."). `ConfirmModal`
  stays a dumb controlled component; the branch logic lives in `SessionManager`. **No
  app-quit guard** (operator deferred the `before-quit` part).

### Terminal-area visual polish (UI-03)
- **D-03: Unified session card.** The active session's IdentityHeader + the terminal
  viewport become ONE rounded card (≈18px `--radius`, `--surface`/`--line` framing, a soft
  shadow lift, generous breathing room from the `--space-*` scale) floating on the cream
  `--bg`. The `--term-bg` charcoal-indigo terminal sits inside the card. The IdleCard
  (dormant) and WelcomeEmptyState already render in the same `.terminal-area` slot — they
  should read as siblings of the live card (consistent framing language), so the area always
  looks intentional whether live, dormant, or empty.
- **D-03a: Fidelity guardrail (blocking).** Card padding/radius is applied to the wrapper,
  NOT the xterm element. After layout the fit addon re-fits to the inner box; corners never
  clip glyphs; the `app-restart-restore`, scroll, and alt-screen smoke specs stay GREEN. A
  rounded corner over a terminal must mask the *container*, not crop terminal cells.

### Roadmap / requirements amendment (bookkeeping of D-01/D-02)
- **D-05: Amend ROADMAP SC4 + REQUIREMENTS SESS-07 to match the restart removal.** SC4
  ("Restart preserves the logical session id and scrollback") is **void** — replaced by a
  recycle-without-restart criterion (Remove → Start fresh; logical id preserved across the
  retire/restart-fresh cycle for a *configured* session via its kept recipe; terminal
  fidelity unchanged). SESS-07 rewrites from "discoverable Start/Restart" to "the lifecycle
  is Start/Remove/Clear — no restart verb, no `exit`-to-recycle; the dormant Start ▶ and the
  Remove→Inactive→Start path are the discoverable recycle model." This is a **sanctioned
  scope reduction** per explicit operator decision, not check relaxation.

### Claude's Discretion
- **Control-cluster exact styling** (icon vs text, order, the Remove destructive affordance
  in the `--color-danger` danger ramp per the Phase-10 D-15 precedent) — composed from the
  locked tokens + the Sidebar `.row-control` shape (the header already reuses it), tuned
  through the ui-lab look→edit→re-look loop against DESIGN-RUBRIC.md.
- **Exact card geometry** — radius (the 18px `--radius` vs a slightly tighter terminal radius
  if 18px reads soft on a dense grid), padding/breathing-room steps, shadow tier, whether the
  header is flush-inside the card vs a hairline-divided cap — tuned in the ui-lab loop.
- **"Working Area vs Inactive List" terminal-area clarity** — REUSE the Phase-10 sidebar
  two-bucket split + the existing live-`SessionView` ↔ dormant-`IdleCard` swap in the
  terminal area. Do NOT render a second inactive list inside the terminal pane (that would
  re-do Phase 10). The terminal area's job is the framing + the live control cluster; the
  bucket *labeling* stays in the sidebar.
- Whether to extract terminal-area styles into their own `terminal-area.css` (vs the existing
  `terminal.css`) — planner's call; counts toward the >800-line file-size debt discipline.
- Whether to add ui-lab surfaces (e.g. a framed-terminal-card capture, an agent-busy
  Remove-confirm capture) to `tests/ui-lab/surfaces.ts` for D-03 / D-04 evidence.

### Folded Todos
- **`improve-start-control-discoverability-for-live-sessions`** (SESS-07, `resolves_phase: 11`)
  — folded. Resolved by the D-01/D-02 reframe: the restart duality is removed and the
  Remove→Start recycle path is the discoverable lifecycle (no `exit` required).
- **`agent-aware-close-confirmation`** — folded as **copy-only** (D-04). The app-quit-guard
  half is explicitly deferred.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, ui-researcher, planner) MUST read these before planning or implementing.**

### Visual authority (locked — do not re-decide)
- `.planning/DESIGN.md` — §"Aesthetic direction" (warm parlour, 18px cards, calm chrome),
  §"Design tokens" (`--term-bg`/`--term-text`/`--term-faint` terminal palette; `--radius`
  18px), the "Session header / quick controls (clear, restart)" component-inventory row (now
  clear-only after D-01).
- `.planning/design/switchboard-mockup.html` — source mockup (reference only).
- `src/renderer/tokens.css` — the single token source: `--space-*`, `--accent-*` status ramp,
  `--radius-*`, `--shadow-*`, `--term-*`, `--font-*`. Tokens-first rule: any value that can
  live here must (guarded by `tokens-completeness.test.ts`).

### Phase intent + evidence
- `.planning/ROADMAP.md` §"Phase 11" — goal + 4 success criteria (SC4 amended per D-05).
- `.planning/REQUIREMENTS.md` — UI-03 + SESS-07 (SESS-07 amended per D-05).
- `.planning/phases/09-design-token-foundation/09-HUMAN-UAT.md` §"Gaps" → **Gap 2** (the
  terminal-pane S1 gap this phase closes) with its evidence path.
- `artifacts/ui-lab/phase9-baseline/terminal-running.png` — the BEFORE evidence (unframed
  edge-to-edge terminal); Phase-11 after-captures pair against it.

### Precedent — how Phase 10 composed the locked tokens onto a surface (mirror the method)
- `.planning/phases/10-sidebar-visual-polish/10-UI-SPEC.md` — the token-application contract
  shape, the control-vocabulary (Start ▶ / Remove ✕ / hover-reveal), the **selector contract**
  (frozen-or-update-in-lockstep `data-testid`s), the ui-lab verification protocol.
- `.planning/phases/10-sidebar-visual-polish/10-CONTEXT.md` — D-15 Remove-in-danger-ramp
  precedent; the "calm low-contrast chrome, spend color only where it matters" north star.

### Verification harness (mandatory protocol)
- `tests/ui-lab/README.md` — the self-evolve loop + hard rules (no claim without capture;
  injection is preview, packaged is proof; tokens first; suite stays green).
- `tests/ui-lab/DESIGN-RUBRIC.md` — screenshot-checkable expectations captures are scored on.
- `tests/ui-lab/surfaces.ts` — the surface registry (extend for the framed-terminal-card +
  agent-busy-confirm captures if added).

### Code being changed (full paths)
- `src/renderer/SessionManager.tsx` — the terminal-area JSX (`.terminal-area` ~651-697:
  IdentityHeader + `.viewport-stack` + IdleCard); `handleRestart` ~235 + `onRestart` ~636 +
  context-menu Restart ~728-730 (D-01 removal); the ConfirmModal copy branch ~698-716 (D-04).
- `src/renderer/IdentityHeader.tsx` — the live control cluster (Clear + Remove); now the cap
  of the unified card (D-03).
- `src/renderer/IdleCard.tsx` — the dormant placeholder; must read as a sibling of the live
  card (D-03 framing consistency).
- `src/renderer/Sidebar.tsx` — the `restart-session` ↻ button removal (D-01, ~334-349).
- `src/renderer/ContextMenu.tsx` — the menu "Restart" item removal (D-01).
- `src/renderer/ConfirmModal.tsx` — stays a dumb controlled component; receives the
  agent-aware copy from SessionManager (D-04).
- `src/renderer/terminal.css` — terminal-area visual rules (card frame, breathing room);
  candidate for extraction to `terminal-area.css`.
- `src/renderer/start-affordances.ts` / `src/renderer/session-status.ts` — the dormant/live
  bucketing + Start-affordance reducer; confirm an `exited`/`stopped` row's recycle path
  after the ↻ removal (Open question O-1 below).
- `src/main/pty-manager.ts` — `ptyRestart` machinery (KEPT, un-surfaced — D-01); the
  no-orphans `before-quit` (untouched — app-quit guard deferred).
- the IPC bridge surface (`EXPECTED_API_KEYS` guard) — confirm it stays **20** after D-01.

### Open questions for research/planning
- **O-1 (restart-removal coherence):** after deleting the sidebar ↻, how does an `exited` /
  `stopped` once-live row get recycled? Confirm `session-status.ts resolveRowStatus` already
  buckets it as Inactive-with-Start-▶ (fresh), so no row is left with a dead-end "no way to
  recycle" state. Resolve before writing the removal task.
- **O-2 (fit re-fit):** confirm where `@xterm/addon-fit` re-fits so the D-03 card padding/
  radius triggers a correct re-fit (no stale cols/rows, no clipped last row).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Shared identity chain** (`renderIcon` + `.row-name` + `.status-badge` + `presentation()`):
  IdentityHeader, IdleCard, and the Sidebar row already render from the SAME source — the
  unified card (D-03) reuses it; no new identity plumbing.
- **`--term-*` palette + the token system** (`tokens.css`): the card frame, breathing room,
  radius, and shadow all come from existing tokens — D-03 is composition, not new values.
- **The `.terminal-area` flex column** (SessionManager ~651): already swaps live `SessionView`
  ↔ `IdleCard` ↔ `WelcomeEmptyState` in one slot — D-03 frames that slot consistently.
- **The Sidebar `.row-control` button shape**: IdentityHeader already copies it verbatim;
  the control-cluster polish extends the same family (no new button primitive).

### Established Patterns
- **Tokens-first + guard tests in lockstep**: `tokens-completeness.test.ts` (every
  `var(--token)` resolves, bans literals) + `status-colors.test.ts` must stay GREEN; new CSS
  uses `var()` only (`npm run test:unit`, `npx tsc --noEmit`).
- **ui-lab loop**: baseline tag before first edit → live-CSS preview for CSS-only tweaks →
  **packaged no-injection capture as proof** → DESIGN-RUBRIC scoring. Structural TSX changes
  (the card wrapper) require `npm run ui:shots:fresh` (injection previews old markup).
- **Selector contract (Rule-1 discipline)**: every `data-testid` (`identity-header`,
  `clear-terminal`, `header-remove`, `idle-start-session`, `start-session`, the
  `working-area`/`inactive-list` containers, etc.) must survive the restructure OR be updated
  with its tests in the same plan. Removing `restart-session` (D-01) means removing its
  smoke/ui-lab references in the same plan.
- **Renderer-only / keep-alive guard**: the card framing touches `.terminal-area` /
  `.viewport-stack` styling only — `SessionView` panes keep `inset:0`; the xterm/PTY data
  path, click-to-switch, and keyboard switching must not regress.

### Integration Points
- `SessionManager.tsx` terminal-area JSX (~651-697): the card wrapper goes around
  IdentityHeader + `.viewport-stack`; the ConfirmModal copy branch (~698-716) gets the D-04
  agent-aware branch.
- `terminal.css` (or a new `terminal-area.css`): the card frame, breathing room, header cap.
- `Sidebar.tsx` (~334-349) + `ContextMenu.tsx`: restart-affordance removal.
- `tests/ui-lab/surfaces.ts`: optional framed-card + agent-busy-confirm captures.
- xterm fit: verify the re-fit path after the card inner-box change (O-2).

</code_context>

<specifics>
## Specific Ideas

- **Gap 2 operator words (the wireframe intent):** "Terminal pane is an unframed hard
  rectangle slammed edge-to-edge — design calls for a **rounded card with breathing room**."
  The user picked the **unified session card** (header + terminal as one rounded surface),
  not a terminal-only inset.
- **Lifecycle simplification intent:** the operator explicitly wanted the restart concept
  **gone from the UI**, not made more prominent — Start / Remove / Clear is the whole live
  vocabulary; recycle is Remove → Start (fresh). Keep the underlying `ptyRestart` mechanism
  in place but unreachable.
- **The canonical scan test:** glancing at the app, a human instantly reads (1) the active
  session as a framed, breathing terminal card, (2) a dormant entry as the IdleCard sibling,
  (3) the live controls (Clear / Remove) as one designed cluster — with no restart control
  anywhere and no confusion about how to recycle a session.

</specifics>

<deferred>
## Deferred Ideas

- **App-quit-time agent-aware confirmation guard** (the `before-quit` half of the
  agent-aware-close todo) → deferred by operator decision; only the in-app close copy
  escalation (D-04) is in scope.
- **App-wide animation / motion system** → Phase 13 / standalone; Phase 11 control
  transitions use only the existing Phase-9 motion tokens (`--duration-*`, `--ease-*`).
- **Empty / loading / error state design + app-wide hover/focus/active consistency** →
  Phase 13 (UI-05/UI-06). The WelcomeEmptyState restyle is NOT this phase (only its framing
  must be consistent with the new card language).
- **Real icon system** (replace emoji glyphs) → backlog.

### Reviewed Todos (not folded)
The keyword-matched todos that belong elsewhere (per REQUIREMENTS traceability), reviewed and
NOT folded:
- `add-folder-picker-for-working-directory-selection` (SESS-06) → **Phase 12**.
- `edit-modal-does-not-prefill-saved-cwd-and-startup-command` (SESS-05) → **Phase 12**.
- `define-and-implement-animation-system` → **Phase 13 / standalone** (not Phase 11).
- `replace-emoji-icons-with-real-icons` → **backlog**.
- `redo-phase-06.1-code-review-criticals` (DEBT-02) → **Phase 14**.
- `address-deferred-code-review-findings-phase-05.1` (DEBT-01) → **Phase 14**.
- `evaluate-metadata-based-claude-state-capture` → **backlog**.
- `npm-run-make-lowdb-localstorage-crash` → **separate build todo** (out of phase scope).
- `rebaseline-flaky-smoke-specs-quiet-machine` → **pre-ship testing task** (revisit at ship).

</deferred>

---

*Phase: 11-Terminal Area Polish + Session Lifecycle Simplification*
*Context gathered: 2026-06-13*
