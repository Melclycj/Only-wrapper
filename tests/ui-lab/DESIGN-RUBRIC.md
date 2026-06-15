# ui-lab Design Rubric

Screenshot-checkable expectations derived from the visual authority
`.planning/DESIGN.md` (+ the reference mockup
`.planning/design/switchboard-mockup.html`). An evaluating agent scores each
captured surface against these lines — **every verdict must cite visible pixel
evidence from the screenshot**, never the CSS source ("the CSS says 18px" is
not evidence; "the card corners render visibly rounded" is).

**Authority chain:** `.planning/DESIGN.md` is the design authority. This rubric
only *operationalizes* it into checkable lines. If a rubric line contradicts
DESIGN.md, DESIGN.md wins and the rubric must be fixed. Never edit DESIGN.md to
match the current output — direction changes come from the human.

---

## How to evaluate (protocol)

1. Read `artifacts/ui-lab/<tag>/manifest.json`, then Read each captured PNG.
2. For each surface: score every rubric line `PASS / PARTIAL / FAIL` with
   one line of pixel evidence.
3. Collect FAIL/PARTIAL lines into a **gap table**, ranked by severity:
   - **S1** breaks the design language (wrong family of color/type/shape)
   - **S2** clearly off-spec (wrong ramp color, missing elevation, harsh contrast)
   - **S3** refinement (spacing rhythm, hover polish, microcopy)
4. Map every gap to its **fix route**: `token` (edit `src/renderer/tokens.css` —
   re-themes everywhere) vs `surface` (per-component CSS in `terminal.css`)
   vs `structure` (TSX change — needs repackage to preview).
5. Only then edit code. Re-capture before claiming anything improved.

### Output format (per run)

| Surface | Rubric line | Verdict | Evidence | Severity | Fix route |
|---------|------------|---------|----------|----------|-----------|

---

## Global (applies to every surface)

From DESIGN.md §Aesthetic direction + §Design tokens:

- [ ] **Warm, not clinical** — app interior reads warm cream/ivory
      (`--bg` oklch(0.975 0.008 85)), never stark white or cold gray.
- [ ] **Cozy rounding** — cards ≈18px radius, chips/pills fully round,
      inputs ≈8px. No sharp-cornered rectangles in chrome.
- [ ] **Nunito everywhere in UI** — rounded geometric sans for all chrome text;
      monospace appears ONLY inside terminal/code fields (JetBrains Mono).
- [ ] **Warm ink, not black** — text is warm charcoal (`--ink`), secondary text
      visibly softer (`--ink-soft`/`--ink-faint`); no pure-#000 text.
- [ ] **Calm, low-contrast chrome** — borders are hairline-soft (`--line`,
      `--line-soft`); the terminal content is the visual focus, chrome recedes.
- [ ] **Status color language** — any status surfacing uses the ramp table:
      waiting=amber, running=blue, finished=green, idle=slate, error=red.
      Color is semantic, never decorative.
- [ ] **Intentional depth** — pop/dialog/menu elevations are distinct and soft;
      nothing floats shadowless that should float, nothing is harshly drop-shadowed.
- [ ] **No template smell** — the surface should read as a designed "parlour,"
      not default-Electron / unstyled-HTML / generic dashboard.

## empty-state

- [ ] Welcome glyph + heading ("Your parlour is quiet") render in Nunito with
      clear scale hierarchy (heading visibly larger/warmer than body).
- [ ] Body copy is soft-ink, friendly, comfortably line-lengthed (not edge-to-edge).
- [ ] CTA is an accent pill (blue `--color-accent`, fully-round) that reads as
      THE action on the screen.
- [ ] Composition feels intentional (centered/balanced with generous whitespace),
      not a lost fragment in a void.

## terminal-running

- [ ] Terminal background is soft charcoal-indigo (`--term-bg` #1e232c family),
      NOT pure black.
- [ ] Terminal text is JetBrains Mono; readable contrast per `--term-text`.
- [ ] The terminal pane is the clear focal area; surrounding chrome (header,
      sidebar) is calmer than the content.
- [ ] Identity header shows the session's icon + name in UI type, visually
      attached to its terminal.
- [ ] Terminal corners/container integrate with the card language (no abrupt
      unstyled rectangle slammed into the layout).

## sidebar-populated

- [ ] Each row: icon + name + status dot/label — scannable at a glance
      (DESIGN.md: "is it waiting for me / running / done / idle").
- [ ] Active row is unmistakable (accent ring/wash) without shouting.
- [ ] Status colors match the ramp: Running=blue, Finished=green, Idle=slate.
- [ ] Emoji identity (🛋️) renders crisply at the right optical size.
- [ ] Row rhythm: consistent vertical spacing; names truncate gracefully;
      secondary meta (cwd/shell) visibly subordinate.
- [ ] The rail itself sits on `--bg-sunk` (recessed) so rows read as cards/chips
      on a warm ground.

## idle-card

- [ ] Reads as an inviting "ready when you are" state — slate/idle ramp,
      NOT an error or empty-void treatment.
- [ ] Start CTA uses the accent language (pill, `--color-accent`).
- [ ] Card uses the 18px radius + pop elevation; centered composition.

## context-menu

- [ ] Menu card: rounded (≥10px), `--shadow-menu` elevation, surface white.
- [ ] Items in Nunito with comfortable hit-area padding; hover state is a soft
      accent wash, not a harsh highlight.
- [ ] Destructive items (Delete/Close) read in the danger ramp.

## edit-modal

- [ ] Dialog: 18px card, `--shadow-dialog` elevation, on a dimmed/screened backdrop.
- [ ] Two-group structure: an "Identity" group (Name + Icon/color) and a "Launch ·
      Applies on restart" group (cwd + Shell + Startup), each with a section subhead
      + a hairline divider. Single column — no two-column layout.
- [ ] Fields: labeled clearly in soft ink; inputs ~8px radius with visible but
      soft borders; focus shows the accent ring.
- [ ] Save = **accent-blue fill** (constructive, NOT danger-red); label "Save changes";
      Cancel = quiet neutral. Pill shapes (`--radius-lg`).
- [ ] The `.modal-actions` row (incl. the blue Save) is VISIBLE IN THE CAPTURED FRAME —
      not scrolled below the fold (GAP-12-A/META: the surface scrolls Save into view and
      `assertEditSaveCaptured` fails the run if Save is absent or has a zero box).
- [ ] Icon/emoji picker: tidy grid with hover (`--bg-sunk`) + selected ring; swatch
      row aligned; feels playful-but-tidy (parlour, not toolbox).
- [ ] Vertical rhythm between fields is even; inter-group spacing reads as a clear break.

## edit-modal-validation

- [ ] cwd format hint (non-absolute path) renders in `--ink-faint` below the cwd field.
- [ ] Empty-name hint "Keeps the current name" renders in `--ink-faint` below the name
      field.
- [ ] Hint text is CALM — does not read as an alarm; the danger red (`--color-danger`)
      is NOT present unless main actively rejects (an explicit error state).
- [ ] The rest of the form is undisturbed; validation is per-field, not a modal-wide state.

## preferences-modal

- [ ] Same dialog DNA as edit-modal (radius, shadow, type, button language) —
      it must look like a sibling, not a different app.
- [ ] Controls (e.g. scrollback) are labeled, aligned, and quietly styled.

## search-bar

- [ ] Docked compactly to the terminal area; does not shove layout around.
- [ ] Input shows the accent focus ring; match count (`search-count`) legible
      in soft ink; case toggle shows a clear active state (accent wash).
- [ ] Buttons (prev/next/close) are quiet icon affordances with hover states.

## sidebar-waiting

> Skipped surface (the waiting agent-state is not deterministically drivable in the
> harness — see `surfaces.ts`). When captured manually (Plan 03's human-verify gate),
> score against these lines. Otherwise the D-09 treatment is verified by the unit
> `data-agent` contract (`Sidebar.tsx` seam + `sidebar.css [data-agent='waiting']` rule).

- [ ] A waiting row carries an **amber left edge bar** (`--accent-waiting`) — distinct
      from the running-blue / idle-slate edge of its neighbours.
- [ ] A **light amber tint wash** fills the row (static — NO pulse/animation); calm,
      not alarming.
- [ ] Line 2 reads **"Waiting for you"** in soft ink with the amber status dot.
- [ ] The amber treatment is present even when the waiting row is NOT the active row
      (a backgrounded waiting session still signals "needs me").

## inactive-recipes

- [ ] Inactive List rows read as **dashed eggshell recipe cards** (dashed `--line`
      border + faint recipe surface tint) — anchored cards, not unanchored text (Gap 5).
- [ ] Each recipe row reads **icon (line 1) + name (line 1) + the startup command on
      line 2** (e.g. `npm run dev`) — the recipe's essence, visibly subordinate ink.
- [ ] An **always-visible circular ghost ▶ Start** sits on the row (outlined brand-blue
      at rest, NOT hidden behind hover) and **fills brand-blue on hover**.
- [ ] The dormant icon + name read slightly dimmed (present-but-asleep), NOT disabled.
- [ ] The `INACTIVE · {n}` section label + hairline divider separate it from Working Area.

## sidebar-collapsed

- [ ] Icon rail keeps identity: emoji/preset tiles readable at rail width.
- [ ] Status remains visible (dot on/near each tile) — the at-a-glance promise
      survives collapse.
- [ ] Collapse control affordance is discoverable; the terminal visibly gains
      the reclaimed width without layout glitches.
- [ ] The **active tile** keeps its filled/lifted card + a status-colored left edge bar;
      a **waiting tile** mirrors the amber edge bar — and **no secondary text leaks** into
      the narrow rail (D-07/D-10).
