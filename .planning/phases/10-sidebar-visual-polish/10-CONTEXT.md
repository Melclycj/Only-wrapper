# Phase 10: Sidebar Visual Polish - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the session sidebar an **intentional visual hierarchy in both expanded and collapsed
modes** — icon, name, and 5-state status legible and clearly styled, the active session
unmistakable — applying the Phase-9 token foundation (`tokens.css`, the `--space-*` scale,
the status accent ramps) to the first real surface. Requirement: **UI-02**.

This phase directly closes the three sidebar gaps logged at the Phase-9 human gate
(`09-HUMAN-UAT.md ## Gaps`):

- **Gap 1 (S1):** row names crushed to ~1 visible character (controls + status text eat
  the width) — session identity invisible.
- **Gap 4 (S2, sidebar half):** context menu opens mispositioned (overlaps the sidebar
  header); Remove is not in the danger ramp. The **position fix + Remove danger color are
  in scope here** as definite fixes (no design discussion needed); the app-wide danger/
  interaction-state sweep stays Phase 13.
- **Gap 5 (S2):** inactive rows float unanchored with no card structure.

**Hard constraints (carried from prior phases):**
- **Core-Value guard:** sidebar interactions must not regress — click-to-switch,
  drag-to-reorder (one SortableContext spanning both sections), Cmd/Ctrl+1-9 + Shift+[/]
  keyboard switching, terminal keep-alive on switch. Renderer-only work; the xterm/PTY
  data path and the 20-key bridge surface (`EXPECTED_API_KEYS`) are untouched.
- **Visual direction is LOCKED** (DESIGN.md "Switchboard" — warm cozy parlour). This phase
  composes the sidebar from the locked tokens; it does not re-decide palette/type/direction.
- **Two-bucket model is LOCKED** (Phase 6.1): Working Area (live) + Inactive List
  (dormant configured "recipes"); Start ▶ always-visible on every Inactive entry.
- **Verification protocol:** the ui-lab loop (`tests/ui-lab/README.md`) — tagged
  before/after captures, live-CSS preview for iteration, **packaged no-injection capture
  as proof**, DESIGN-RUBRIC scoring. No visual claim without a capture.

**Explicitly NOT in this phase:**
- Terminal-area chrome / pane framing (Gap 2) → Phase 11. Session form (Gap 3) → Phase 12.
- Empty/loading/error states + app-wide hover/focus/active consistency → Phase 13 (UI-05/06).
- Start-control discoverability for LIVE sessions (SESS-07) → Phase 11.
- Any lifecycle/behavior change — this is presentation only.

</domain>

<decisions>
## Implementation Decisions

### Row anatomy — the name-crush fix (Gap 1)
- **D-01: Two-line row.** Line 1 = session name at full width (ellipsis on overflow);
  line 2 = small secondary line. This is DESIGN.md's sanctioned SessionCard anatomy
  (icon + name + status … + cwd/host secondary). Accepted cost: ~40% taller rows.
- **D-02: Controls are hover/keyboard-focus-revealed only — including the active row.**
  No width is reserved: edit ✎ / close ✕ float over the row's right end on hover or
  `:focus-visible` (keyboard a11y required). The right-click context menu remains the
  full control surface. **Exception (6.1 D-06 honored):** the Inactive-entry Start ▶ stays
  always-visible (see D-13); start-no-cmd + Delete follow the hover-reveal policy.
- **D-03: Secondary line content = status + cwd tail.** Live rows: `● Running ·
  Marketing-parlour-room` — cwd shows only its last path segment, truncated when long;
  sessions without a cwd show status only. Inactive recipe cards show the **startup
  command** as the secondary detail (the recipe's essence), falling back to cwd, else
  status word only.
- **D-04: Large icon tile spanning both lines.** ~32-36px rounded tile, vertically
  centered — the row's visual anchor. Must keep rendering all three `SessionIconSpec`
  kinds (emoji | preset | color badge) via the single `renderIcon` source in Sidebar.tsx.
  The collapsed rail reuses the same tile styling for expanded/collapsed continuity.

### Active session distinction (SC1 "unmistakable")
- **D-05: Active = filled card + left accent edge bar.** Active row becomes a filled
  surface card (white bg + border + soft shadow lift, e.g. `--shadow-pop`-tier) with a
  ~3-4px accent bar on its left edge. Non-active rows sit flat/transparent on the rail bg.
- **D-06: The accent follows the session's status color** — running blue / waiting amber /
  error red / finished green — via the existing per-row inline `--accent` custom-property
  mechanism (`status-colors.ts presentation()`). Not fixed brand blue: "which agent needs
  me" is the product's soul, and active+waiting must read amber at a glance.
- **D-07: Collapsed rail uses the same language.** Active icon tile = filled/lifted +
  a status-color bar on the rail's left edge. Switching collapse modes keeps the active
  marker visually continuous.

### 5-state status presentation (SC2)
- **D-08: Secondary-line status = colored dot + word, no tint pill.** Calm low-contrast
  chrome (DESIGN.md north star): dot carries the color, word in `--ink-soft`. Status
  loudness is delegated to the active edge bar (D-06) and the waiting treatment (D-09).
- **D-09: Waiting gets a row-level amber treatment — on non-active rows too.** Light
  amber tint wash across the row + amber left edge bar (the same bar slot as D-05, so a
  non-active waiting row also carries a bar) + secondary line flips to `● Waiting for
  you`. Static — no pulsing/animation. The collapsed rail mirrors it (amber edge bar on
  that tile). Rides the existing agent-state overlay (`presentation(status, agent)` —
  amber only while running, per the locked Phase-6 D-06/D-07 contract).
- **D-10: Collapsed-rail status dot: keep bottom-right position (proven NAV-01 mechanism),
  enlarge to ~10px with a thicker `--surface` ring** so it floats off the icon. No
  whole-tile status tint (would fight user-chosen color-badge icons).

### Inactive List + rail structure (Gap 5)
- **D-11: Inactive rows = dashed-border "recipe" cards.** Same dashed language as the
  existing `+ Add session` button (dashed = potential/not-yet-running): live rows are
  solid entities, recipes are eggshells. Two-line layout retained (secondary = startup
  command per D-03). Cross-section drag-reorder must stay intact (one SortableContext).
- **D-12: Section labels = small caps + count.** `WORKING AREA · 2` / `INACTIVE · 3`,
  `--ink-faint`, letter-spaced; hairline divider between sections; labels stay hidden in
  collapsed mode (existing behavior). Empty Inactive section stays unrendered (06.1
  behavior unchanged).
- **D-13: Inactive Start ▶ = circular ghost button** (thin outline ▶) at the card's right
  end, filling to accent-blue solid on hover. Always visible (6.1 D-06); pairs with the
  eggshell metaphor.

### Definite fixes folded in (from 09-HUMAN-UAT Gap 4 — no design debate)
- **D-14: Context menu position fix** — must open at the cursor without overlapping the
  sidebar header (clamp to viewport; investigate the current mispositioning root cause).
- **D-15: Remove menu item styled in the danger ramp** (`--color-danger`), consistent with
  the destructive Delete affordance. Full app-wide danger/interaction sweep remains P13.

### Claude's Discretion
- Exact row heights, paddings, gaps — retune onto the `--space-*` scale (defined-not-applied
  in Phase 9 precisely for this); odd-ball 5/14/22px values snap to the nearest step.
- Edge-bar exact width (3 vs 4px), tint wash strengths, dot ring thickness, shadow tier —
  tuned through the ui-lab look→edit→re-look loop against DESIGN-RUBRIC.md.
- Drag-handle treatment under the hover-reveal policy (follow the same reveal pattern;
  keep the dragging-state visuals working).
- Name/cwd truncation mechanics (ellipsis vs middle-truncate for cwd tails).
- Whether to extract sidebar styles from `terminal.css` into a `sidebar.css` (sanctioned
  by 09-CONTEXT deferred items; planner's call — counts toward the >800-line debt paydown).
- Whether to add new ui-lab surfaces (e.g. a waiting-state or inactive-list capture) to
  `tests/ui-lab/surfaces.ts` for evidence of D-09/D-11.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual authority (locked — do not re-decide)
- `.planning/DESIGN.md` — the design system: §"Design tokens" (surface/ink/line), §"Status
  system" (the 5-state accent ramps + tint/ring concepts D-06/D-09 build on), §"Aesthetic
  direction" (calm low-contrast chrome), SessionCard/IdeSidebarRow anatomy.
- `.planning/design/switchboard-mockup.html` — source mockup (reference only; v2 screens
  out of scope).

### Phase intent + evidence
- `.planning/ROADMAP.md` §"Phase 10: Sidebar Visual Polish" — goal + 4 success criteria.
- `.planning/REQUIREMENTS.md` — UI-02 (this phase); UI-03..06 (downstream consumers).
- `.planning/phases/09-design-token-foundation/09-HUMAN-UAT.md` §"Gaps" — Gaps 1/4/5 with
  severity + evidence paths (the operator's own "still ugly" specifics this phase closes).
- `artifacts/ui-lab/phase9-baseline/sidebar-populated.png`, `sidebar-collapsed.png`,
  `context-menu.png` — the BEFORE evidence; Phase-10 after-captures pair against these.

### Verification harness (mandatory protocol)
- `tests/ui-lab/README.md` — the self-evolve loop + hard rules (no claim without capture;
  injection is preview, packaged is proof; tokens first; suite stays green).
- `tests/ui-lab/DESIGN-RUBRIC.md` — screenshot-checkable expectations the captures are
  scored against.
- `tests/ui-lab/surfaces.ts` — the surface registry (sidebar-populated / sidebar-collapsed
  exist; extend here if new state captures are added).

### Prior decisions carried forward
- `.planning/phases/09-design-token-foundation/09-CONTEXT.md` — D-01 hybrid scope (spacing
  + per-surface extraction are THIS phase's job), D-03/D-04 token set + naming.
- `src/renderer/tokens.css` — the single token source: `--space-*` scale (consume now),
  `--accent-*` status ramp, `--radius-*`, `--shadow-*`, `--font-*`. Tokens-first rule:
  any value that can live here must.

### Code being restyled (full paths)
- `src/renderer/Sidebar.tsx` — the sidebar component: row markup, two-bucket partition,
  single `renderIcon` source, SortableContext, rail tooltip, collapsed-status-dot.
- `src/renderer/terminal.css` — sidebar styles live at ~lines 23-360 (`.sidebar`,
  `.sidebar-row`, `.row-name`, `.status-badge`, `.row-controls`, `.sidebar-pinned`,
  `.collapsed-status-dot`, `.rail-tooltip`, collapse rules).
- `src/renderer/status-colors.ts` — `STATUS_STYLE`/`AGENT_STYLE`/`presentation()` + the
  per-row inline `--accent` mechanism D-06/D-09 ride on.
- `src/renderer/ContextMenu.tsx` — D-14 position fix + D-15 danger ramp target.
- `src/renderer/start-affordances.ts` — Start/start-no-cmd logic the D-13 button wraps.
- `src/renderer/session-status.ts` — `resolveRowStatus` (identity rows present exited/error
  as not_started → Inactive List); determines which bucket/styling a row gets.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Per-row inline `--accent` custom property** (status-colors.ts → Sidebar rows): D-05/
  D-06/D-09 edge bars + washes consume it directly — `border-left-color: var(--accent)`,
  `color-mix` washes. Zero new plumbing.
- **`renderIcon` single source** (Sidebar.tsx, Phase 4 D-09): emoji | preset | color-badge
  branches; D-04 enlarges the tile around it without forking the logic.
- **`presentation(status, agent)` resolver**: amber waiting overlay applies only while
  running — D-09 inherits this contract; do NOT add a parallel state path.
- **Dashed affordance precedent**: `.add-session` already uses dashed border — D-11
  extends the same visual family to recipe cards.
- **`--space-*` scale** (tokens.css): defined-not-applied; this phase is its first consumer.

### Established Patterns
- **Guard tests travel in lockstep**: `status-colors.test.ts` asserts the var() references;
  `tokens-completeness.test.ts` asserts every `var(--token)` resolves + bans migrated
  literals. New CSS must keep both GREEN (`npm run test:unit`, `npx tsc --noEmit`).
- **Smoke/ui-lab selector contract**: smoke tests + ui-lab `prepare` drivers select
  `.sidebar-row[...]`, `.row-name`, `data-testid` (sidebar-collapse, start-no-cmd-session,
  delete-session, header-* etc.). Markup restructuring MUST keep these selectors working
  or update tests in the same plan (Rule-1 discipline from 06.1).
- **Collapse touches ONLY `.sidebar`** (Phase-4 anti-pattern guard): `.session-view` /
  `.viewport-stack` visibility is untouched — keep-alive intact.
- **ui-lab loop**: baseline tag → live-CSS preview iterations → packaged proof capture.
  `UI_LAB_TAG=before-phase10 npm run ui:shots` before the first edit.

### Integration Points
- `Sidebar.tsx` row JSX (lines ~230-395): two-line restructure, icon tile, hover-reveal
  controls, recipe cards.
- `terminal.css` sidebar block (or extracted `sidebar.css`): all visual rules.
- `ContextMenu.tsx`: position clamp + danger item class.
- `tests/ui-lab/surfaces.ts`: optional new captures (waiting row, inactive recipes).
- Drag-and-drop (dnd-kit): two-line rows change row geometry — verify drag overlay +
  activation distance still feel right; reorder.smoke must stay GREEN.

</code_context>

<specifics>
## Specific Ideas

- The user picked concrete ASCII previews for every major decision (recorded in
  10-DISCUSSION-LOG.md): two-line card with big icon tile, status-color left edge bar on
  a lifted active card, amber row wash for waiting, dashed eggshell recipe cards with a
  ghost ▶ that fills on hover. These previews are the shared mental image — the planner
  should treat them as the wireframe intent.
- "Calm, low-contrast chrome so the terminal content is the focus" (DESIGN.md) — the
  sidebar should feel quieter overall after this phase, with attention spent only on
  active + waiting.
- The canonical scan test: with 5+ sessions across both buckets, a human glancing at the
  sidebar instantly finds (1) the active session, (2) any amber "Waiting for you" row,
  (3) which project each session belongs to (cwd tails).

</specifics>

<deferred>
## Deferred Ideas

- **App-wide hover/focus/active consistency + full danger-ramp sweep** → Phase 13 (UI-06);
  this phase only does the sidebar's own reveal affordances + the Remove danger color.
- **Terminal pane framing** (Gap 2) → Phase 11. **Save-button accent** (Gap 3) → Phase 12.
- **Empty/loading/error state design** (incl. WelcomeEmptyState restyle) → Phase 13 (UI-05).
- **Sidebar width resize / user density settings** → v2 (APPR-02 territory); not raised,
  noted as out of scope.

### Reviewed Todos (not folded)
The 5 pending todos that keyword-matched this phase were reviewed and NOT folded — the
v1.1 roadmap already assigns each to a later phase; none concern sidebar visual hierarchy:
- `add-folder-picker-for-working-directory-selection` (SESS-06) → **Phase 12**.
- `improve-start-control-discoverability-for-live-sessions` (SESS-07) → **Phase 11**.
- `edit-modal-does-not-prefill-saved-cwd-and-startup-command` (SESS-05) → **Phase 12**.
- `redo-phase-06.1-code-review-criticals` (DEBT-02) → **Phase 14**.
- `address-deferred-code-review-findings-phase-05.1` (DEBT-01) → **Phase 14**.

</deferred>

---

*Phase: 10-Sidebar Visual Polish*
*Context gathered: 2026-06-11*
