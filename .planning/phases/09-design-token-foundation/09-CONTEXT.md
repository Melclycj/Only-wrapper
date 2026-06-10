# Phase 9: Design Token Foundation - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the v1.1 **design-token foundation** that the per-surface polish phases
(10–13) build on. The visual direction is **already locked** — DESIGN.md ("Switchboard,"
the user's own high-fidelity mockup) is the visual authority. This phase does **NOT**
re-decide the look; it makes the look **real and systematic**.

The true nature of this phase, established from the code (not assumption):

- The design system is **already partially in the code but scattered as raw literals**.
  The primary interactive blue `oklch(0.62 0.14 248)` is **copy-pasted 28×** in
  `terminal.css`; the error red `oklch(0.58 0.16 25)` 10×; box-shadows 7× (each hand-written);
  the `'Nunito'` UI stack 14× and `'JetBrains Mono'` 3×. The same blue/red **also** live
  independently in `status-colors.ts` (TS oklch strings). There is **no single source of truth**.
- The signature cozy typography **is not actually on screen**: `@font-face` count = **0**,
  and there are **0 woff2/woff/ttf files** in the repo. Every `'Nunito'` / `'JetBrains Mono'`
  reference falls back to `system-ui` / generic monospace. The app today does not look like
  the mockup's typographic identity.
- `terminal.css` is **1252 lines** (1.5× the project's 800-line hard limit) and holds the
  styling for the **whole app**, not just the terminal.

**Phase 9 delivers:** a complete, single-source-of-truth token layer (`tokens.css`),
migration of the **globally-repeated primitives** (color accent/danger + 5 status accents,
shadow, radius, motion, font stacks) from raw literals → tokens across `terminal.css` and
`status-colors.ts`, and **actually loading** Nunito + JetBrains Mono so the cozy identity
renders. It is a **refactor-to-tokens + fill-the-gaps + load-the-fonts** phase — visually
identical to today **except** the fonts finally render correctly.

**Explicitly NOT in this phase (the hybrid scope boundary):**
- **Per-surface spacing/layout tuning** — the `--space-*` scale is *defined* here for 10–13
  to consume, but existing padding/gap/margin values are **not migrated or retuned** now.
  Spacing is part of per-surface visual polish → Phases 10–13 own it.
- **Per-surface CSS file extraction** — Phase 9 extracts only the `:root` token layer into
  `tokens.css`. Splitting the remaining component styles per surface (sidebar.css / modal.css /
  …) happens naturally as 10–13 polish each surface. `terminal.css` staying >800 lines after
  this phase is **accepted tracked debt** (pre-existing, not introduced here; reduces as 10–13
  migrate surfaces out).
- **Any restyling / new visual direction** — DESIGN.md is locked. No new palette, no dark mode,
  no layout changes.
- **User-configurable theme / fonts / density** → v2 (APPR-01/02), per DESIGN.md "Deferred."

**Requirement covered:** UI-01 (the design-token foundation the per-surface requirements build on).

</domain>

<decisions>
## Implementation Decisions

### Foundation scope (the central decision)
- **D-01: Hybrid scope — migrate the global primitives now, defer per-surface spacing to 10–13.**
  Phase 9 defines the *complete* token set, but the **migration** (raw literal → `var(--token)`)
  this phase covers only the **globally-repeated primitives**: the accent/danger colors, the 5
  status accents, shadows, radius, motion, and font stacks — i.e. the values that are duplicated
  across many surfaces and whose scatter is the actual debt. The `--space-*` scale is **defined**
  for downstream use but existing spacing values are **left untouched** (per-surface tuning is
  10–13's job). Rationale: UI-01 says tokens are "the foundation the per-surface requirements build
  on"; the 28× blue / 10× red / unloaded fonts are precisely the cross-cutting items that must be
  unified *before* per-surface work, while spacing is inherently per-surface and migrating it now
  would both pre-empt 10–13 and create same-file churn/conflicts. (Chosen over tokens-only —
  which doesn't cash in the single-source-of-truth value now — and full migration — which collides
  with 10–13.)
- **D-02: Extract a dedicated `tokens.css` layer.** The complete `:root` token set lives in a new
  `src/renderer/tokens.css`, imported **before** `terminal.css` in the renderer entry
  (`index.tsx`). `terminal.css` keeps component styles and consumes the tokens. This is the file
  split a token foundation should have; full per-surface extraction is deferred (D-01). Accept that
  `terminal.css` remains >800 lines after this phase (tracked debt, shrinks as 10–13 extract surfaces).

### Color single source of truth
- **D-03: CSS tokens are the single source; `status-colors.ts` references them.** All color values
  move into `tokens.css` `:root`. `status-colors.ts` stops carrying literal `oklch(...)` strings and
  instead returns **`var(--accent-*)`** references for its `accent` field (labels like `'Running'`
  stay in TS — they are not colors). This works because the app is plain CSS (no CSS-in-JS),
  Chromium resolves `var()` inside inline styles natively, and `STATUS_STYLE.accent` is **already**
  fed in as the per-row inline `--accent` custom property — so swapping its value from a literal to a
  `var(--accent-running)` reference is a natural, low-risk change. (Chosen over a TS-module source —
  too heavy for a plain-CSS app — and over a token+TS mirror with a drift-guard test — unnecessary
  duplication when one home suffices.)
  - **Token color set (names; exact oklch carried verbatim from today's values — value-preserving):**
    `--color-accent` (blue `oklch(0.62 0.14 248)`), `--color-accent-strong` (`0.58 0.14 248`, hover),
    `--color-danger` (`oklch(0.58 0.16 25)`), `--color-danger-strong` (`0.54 0.16 25`, hover);
    status accents `--accent-running` (= accent blue), `--accent-finished` (green `0.60 0.13 150`),
    `--accent-idle` (slate `0.64 0.02 260`, used by `stopped` + `not_started`),
    `--accent-error` (= danger), `--accent-waiting` (amber `0.66 0.15 60`, TERM-09 overlay — reserved);
    plus the existing surface/ink/line tokens and the terminal palette (`--term-bg` exists;
    **add** `--term-text` `oklch(0.90 0.012 250)` and `--term-faint` `oklch(0.66 0.02 255)` from
    DESIGN.md for xterm-theme completeness).
  - **`status-colors.test.ts` must be updated** — it currently asserts literal oklch strings; after
    D-03 it asserts the `var(--accent-*)` references (and a separate check can assert `tokens.css`
    defines each referenced custom property).

### New scales + naming
- **D-04: Numeric 4px-base spacing scale; semantic names for everything else.** Naming convention:
  `--space-*` numeric on a 4px base (`--space-1`=4px, `--space-2`=8px, `--space-3`=12px,
  `--space-4`=16px, `--space-5`=20px, `--space-6`=24px, `--space-8`=32px, `--space-12`=48px, with
  half-steps `--space-0_5`=2px / `--space-1_5`=6px / `--space-2_5`=10px as needed to cover existing
  values); semantic names for the rest — `--radius-{xs,sm,md,lg,xl}`, `--shadow-{pop,dialog,menu}`,
  `--font-{ui,mono}`, `--color-*`, `--duration-fast`, `--ease-standard`. Matches the token examples in
  `~/.claude/rules/web/coding-style.md`. (Chosen over all-t-shirt sizing, which can't cleanly express
  the intermediate values the code already uses.)
  - **Radius scale (value-preserving, from existing distinct radii 6/7/8/10/12/18px):** map to named
    tokens `--radius-xs … --radius-xl`; `--radius-lg`/`--radius-xl` covers the existing 18px `--radius`
    (keep `--radius` as an alias to avoid touching the many sites that use it, or rename in lockstep —
    planner's call). Migration changes names, **not** rendered values.
  - **Shadow tokens (from the 3 distinct shadows in use):** `--shadow-pop`
    (`0 6px 18px oklch(0.32 0.012 70 / 0.14)` — cards/tooltip/search/dragging),
    `--shadow-dialog` (`0 18px 48px oklch(0.255 0.018 264 / 0.28)` — modal/idle-card),
    `--shadow-menu` (`0 10px 30px oklch(0.255 0.018 264 / 0.22)` — context-menu).
  - **Motion:** `--duration-fast` = 120ms (matches the existing `0.12s`), `--ease-standard` = `ease`
    (keep the current calm easing; a gentle cubic-bezier is acceptable if visually equivalent).
    Compositor-friendly only (opacity/transform), per web rules — no new layout-animating transitions.

### Font loading
- **D-05: Self-host Nunito + JetBrains Mono via `@fontsource`, load now.** Add `@fontsource/nunito`
  (weights 400/600/700 — the weights the UI actually uses) and `@fontsource/jetbrains-mono`
  (400/700), latin subset, `font-display: swap`, imported in the renderer entry. Tokenize the stacks
  as `--font-ui` (`'Nunito', system-ui, sans-serif`) and `--font-mono`
  (`'JetBrains Mono', monospace`); migrate the 14 + 3 raw references. The xterm `fontFamily`
  (SessionView/TerminalPane) must reference the now-loaded JetBrains Mono so the terminal renders in
  it too. **Local-only constraint:** fonts are self-hosted/bundled — **no** Google Fonts / CDN.
  (Chosen over extracting base64 woff2 from `switchboard-mockup.html` — `@fontsource` is versioned,
  licensed (SIL OFL), and cleaner — and over deferring, which would ship the "foundation" without its
  signature typography.)

### Claude's Discretion (grounded in DESIGN.md + existing values + web rules)
- Exact `--space-*` step membership and the precise radius name↔value map — derive from the distinct
  px values already in `terminal.css` under the **value-preserving** constraint (Phase 9 is a
  refactor; rendered geometry must not change except fonts).
- Whether `--radius` (18px) is kept as an alias or renamed to `--radius-xl` in lockstep across sites.
- Mechanism for verifying `@fontsource` woff2 is correctly emitted by Vite into the renderer build
  (these are renderer assets, **not** native modules — no node-pty-style ASAR-unpack concern — but
  the researcher should confirm Vite bundles/serves them in the packaged app).
- Whether to add a drift-guard test asserting every `var(--accent-*)` returned by `status-colors.ts`
  is actually defined in `tokens.css` (nice-to-have; not required by D-03).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual authority (the locked design — do not re-decide)
- `.planning/DESIGN.md` — the v1 design system: §"Design tokens" oklch table (surface/ink/line,
  terminal palette, the 4+2 status ramps), §"Typography" (Nunito UI / JetBrains Mono terminal),
  §"Reconciliation notes" (5 process statuses → mockup color/label language; derive the red `error`
  ramp). **MUST read — this is the source of every token value.**
- `.planning/design/switchboard-mockup.html` — the source mockup (reference asset; embeds the woff2 if
  the `@fontsource` route is ever reconsidered). Reference only; ignore its v2/out-of-scope screens.

### Phase intent
- `.planning/ROADMAP.md` §"Phase 9: Design Token Foundation" — goal + success criteria.
- `.planning/REQUIREMENTS.md` — UI-01 (this phase) and UI-02..06 (downstream consumers 10–13), so the
  token set is shaped to serve all of them.

### Code to tokenize (full relative paths)
- `src/renderer/terminal.css` — the 1252-line whole-app stylesheet being tokenized. Holds the 28× blue,
  10× error, 7× shadow, 14×+3× font raw literals and the existing partial `:root` token set.
- `src/renderer/status-colors.ts` — `STATUS_STYLE` / `AGENT_STYLE` / `presentation()` — the color
  source-of-truth migration target (D-03). The 5-status + agent-overlay color/label language.
- `src/renderer/__tests__/status-colors.test.ts` — asserts literal oklch; **must update** for D-03.
- `src/renderer/index.tsx` — renderer entry; where `tokens.css` (before `terminal.css`) and the
  `@fontsource` imports are wired (D-02/D-05).
- `src/renderer/SessionView.tsx` (and `TerminalPane`'s `TERMINAL_THEME` / `fontFamily`) — xterm theme
  must reference `--term-*` + the loaded JetBrains Mono (D-05).
- `package.json` / `forge.config.ts` / Vite config — `@fontsource` dependency + font-asset bundling
  for the packaged app (D-05 verification).

### Prior decisions carried forward
- `.planning/phases/04-session-identity-sidebar-ui/04-CONTEXT.md` — D-09 fixed warm color swatches from
  DESIGN.md, the status color/label language, and the established fact that **`terminal.css` is the
  styling home** + DESIGN.md is the visual authority for every surface.

### Convention references (token naming + font perf)
- `~/.claude/rules/web/coding-style.md` §"CSS Custom Properties" — token naming convention reference.
- `~/.claude/rules/web/performance.md` §"Font Loading" — `font-display: swap`, latin subset, preload
  only the critical weight, max two families.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Existing `:root` token set** (`terminal.css` lines 6–17) — `--surface`, `--bg-sunk`, `--ink`,
  `--ink-soft`, `--ink-faint`, `--line`, `--line-soft`, `--radius`, `--term-bg`. These move into
  `tokens.css` as-is and are the precedent for the new tokens.
- **Per-row inline `--accent` mechanism** — `status-colors.ts` already injects its accent as the
  inline `--accent` custom property consumed by `.status-dot` / `.collapsed-status-dot`. D-03 only
  changes what value that accent *is* (literal → `var(--accent-running)` etc.), not the mechanism.
- **`oklch()` everywhere** — Chromium-native; the whole palette is oklch already, so no color-space
  conversion is needed.

### Established Patterns
- Single renderer stylesheet imported once in `index.tsx` (`import './terminal.css'`); D-02 inserts
  `tokens.css` before it.
- Plain CSS classes (`className`) + a few inline custom props — **no** Tailwind / CSS-in-JS /
  styled-components. The token layer is plain CSS custom properties; no tooling change.
- `status-colors.test.ts` is the guard that keeps the status color/label language honest — it travels
  in lockstep with `status-colors.ts` (update both together, per the project's guard-test pattern).

### Integration Points
- `index.tsx`: `tokens.css` import (first) + `@fontsource` imports.
- `terminal.css`: every migrated declaration swaps a raw literal for `var(--token)`.
- `status-colors.ts`: accent values → `var(--accent-*)`; `status-colors.test.ts` updated.
- xterm theme (SessionView / TerminalPane): `fontFamily` → loaded JetBrains Mono; theme bg/fg →
  `--term-bg` / `--term-text` / `--term-faint`.

</code_context>

<specifics>
## Specific Ideas

- **Cozy "parlour" north star (DESIGN.md)** — warm cream surfaces, 18px rounding, Nunito UI /
  JetBrains Mono terminal. The whole point of D-05 is that this identity **finally renders** — today
  it does not, because the fonts were never loaded.
- **The migration is value-preserving.** Phase 9 must look identical to today's app **except** the
  fonts (which is the one intended visible change). Any other visible difference is a regression. The
  human verify step checks exactly this: "same layout/colors, now in the right fonts."
- **Change one thing, change it everywhere** is the payoff — after this phase, retuning the brand blue
  or the danger red is a one-line edit in `tokens.css`, not 28 + 10 hand-edits. That is the concrete
  value UI-01 promises the downstream phases.

</specifics>

<deferred>
## Deferred Ideas

Routed to owning phases / later (not lost):
- **Per-surface spacing/layout retuning** → Phases 10–13 (each surface), consuming the `--space-*`
  scale defined here (D-01).
- **Per-surface CSS file extraction** (sidebar.css / modal.css / …) → happens as 10–13 polish each
  surface; Phase 9 only extracts `tokens.css` (D-02). `terminal.css` >800 lines is accepted tracked debt.
- **Dark mode / theme switch / user-configurable fonts + density** → v2 (APPR-01/02), per DESIGN.md
  "Deferred."

### Reviewed Todos (not folded)
The 5 todos that keyword-matched Phase 9 (area: ui) were reviewed and **not** folded — the v1.1 roadmap
already assigns each to a later phase, and none concern design tokens:
- `add-folder-picker-for-working-directory-selection` (SESS-06) → **Phase 12**.
- `improve-start-control-discoverability-for-live-sessions` (SESS-07) → **Phase 11**.
- `edit-modal-does-not-prefill-saved-cwd-and-startup-command` (SESS-05) → **Phase 12**.
- `redo-phase-06.1-code-review-criticals` (DEBT-02) → **Phase 14**.
- `address-deferred-code-review-findings-phase-05.1` (DEBT-01) → **Phase 14**.

</deferred>

---

*Phase: 9-Design Token Foundation*
*Context gathered: 2026-06-10*
</content>
</invoke>
