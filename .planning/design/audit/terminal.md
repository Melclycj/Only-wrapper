# Terminal Area — Design Audit

> READ-ONLY senior product-design + design-systems audit. Cluster = THE TERMINAL AREA
> (the core-value surface). Files read in full: `src/renderer/SessionView.tsx`,
> `src/renderer/terminal-area.css`, `src/renderer/terminal.css`, `src/renderer/IdleCard.tsx`,
> `src/renderer/WelcomeEmptyState.tsx`, cross-checked against `src/renderer/tokens.css`,
> `src/renderer/status-colors.ts`, `src/renderer/IdentityHeader.tsx`,
> `src/renderer/SessionManager.tsx`, `src/renderer/sidebar.css`.

## Pillar scores

| Pillar | Score /5 | Verdict |
|---|---|---|
| 1. Hierarchy | 4 / 5 | Card→header→well→inset stack reads cleanly; IdleCard identity→config→action is well-ordered. Loses a point because the live terminal well has zero focus/active hierarchy cue (it is the primary input target but looks identical focused vs blurred). |
| 2. Spacing & Rhythm | 3 / 5 | The `--space-7` (28px) white gutter is the right idea and is even on all four sides, but the IdleCard / Welcome / search-bar families are still hand-tuned literal px (24/16/12/8/48/32) instead of the scale — the GAP-11-A token discipline stops at the card shell and never reaches the children. |
| 3. Color & Semantics | 4 / 5 | Token-routed `var()` everywhere in the CSS; danger ramp via `color-mix` is tasteful; accent/danger semantics are consistent. Loses a point for the `TERMINAL_THEME` hex mirror being a hand-maintained 3-key subset with NO ANSI palette, so program output (`claude`, `vim`) is uncoordinated with the app's blue/red. |
| 4. Typography | 4 / 5 | UI=Nunito / mono=JetBrains split is disciplined and the breadcrumb-as-mono-path is a nice touch; CJK fallback is mirrored into xterm. Loses a point for literal `font-size` values (20/13/12px) scattered across IdleCard/Welcome with no type-scale token. |
| 5. States & Interaction | 2 / 5 | Buttons have proper hover + 2px blue `:focus-visible`. But the terminal well — the app's whole reason to exist — has NO visible focus affordance, and `.status-badge` (used by IdentityHeader AND IdleCard) has NO CSS rule at all, so both badges render unstyled. Two real breaks on the core surface. |
| 6. Consistency & Accessibility | 3 / 5 | Strong intent (shared `renderIcon`/`row-control`/`row-name` reuse, consistent focus color). Undercut by the missing `.status-badge` rule (silent cross-component breakage), the unstyled badge dot, and no AA verification path for the dim `\x1b[2m` scrollback separators against `#1e232c`. |

## Findings

### [P0] `.status-badge` pill has no CSS rule — IdentityHeader + IdleCard badges render unstyled
- Pillar · States & Interaction / Consistency
- `src/renderer/IdentityHeader.tsx:89` and `src/renderer/IdleCard.tsx:60` (consumers); searched all 5 stylesheets — `terminal-area.css:175` and `:362` only *comment* "reuses `.status-badge`", no rule exists; `sidebar.css` has only `.sidebar-row .row-secondary .status-dot` (`sidebar.css:156`).
- What: Both the live header status pill ("Running / Waiting for you / …") and the dormant IdleCard pill ("Idle / Error") apply `className="status-badge"` and set `style={{ '--accent': style.accent }}`, but no `.status-badge` selector is defined anywhere in `src/`. The element falls back to a bare inline `<span>` with default flow layout — no pill shape, no padding, no `--accent` background/foreground, no gap. The `--accent` custom property has zero consumer.
- Why it matters: This is on the core-value surface and the dormant placeholder — the two states a user sees most. The status badge is the single colour-coded signal of session lifecycle (esp. the amber "Waiting for you" attention state, `status-colors.ts:49`); rendering it as unstyled text destroys that signal and looks broken next to the otherwise-polished card. It is also a silent drift: the comments assert reuse that the CSS does not deliver.
- Fix: Add a real `.status-badge` rule (pill: `display:inline-flex; align-items:center; gap:var(--space-1); padding:var(--space-0_5) var(--space-2); border-radius:999px; font:600 12px var(--font-ui); color:var(--accent); background:color-mix(in oklch, var(--accent) 12%, transparent);`) and a `.status-badge .status-dot` rule (`width:8px; height:8px; border-radius:999px; background:var(--accent)`), unscoped so all three call sites (sidebar, header, idle-card) share it. Verify the dot is not being unintentionally caught only by the `.sidebar-row .row-secondary` selector.

### [P0] No focus affordance on the terminal well — the primary input target is visually indistinguishable focused vs blurred
- Pillar · States & Interaction
- `src/renderer/terminal-area.css:85` (`.terminal-well`), `:119` (`.viewport-stack`), `:152` (`.term-mount`); `SessionView.tsx:646-648` (`term.focus()` on activate) — no `:focus-within` / ring rule for the well in any stylesheet (confirmed: the only `:focus-visible` rules in `terminal-area.css` are on buttons at `:274/:304/:314/:459/:495/:558`).
- What: When the user clicks into the terminal (or it auto-focuses on tab switch), the charcoal well gets no border-glow, ring, or accent edge. The xterm cursor blinks, but the *container* gives no affordance that "this well is now the active input." Every other interactive element in the app (search input `terminal.css:80`, header buttons, sidebar rows) has a 2px blue `:focus-visible` ring; the most important focus target has none.
- Why it matters: Core value = real terminal fidelity, and the well is where 100% of typing goes. With N kept-alive sessions stacked in one well, a clear "this is the live, focused terminal" cue is exactly the affordance that sells the manager. Its absence is a real accessibility + orientation gap (keyboard users tabbing in get nothing).
- Fix: Add `.terminal-well:focus-within { box-shadow: inset 0 0 0 2px var(--color-accent); }` (inset so it lives inside the `overflow:hidden`/`--radius` mask and never clips a glyph — D-03a-safe, no geometry change). Optionally pair with a calmer rest-state hairline. xterm's helper textarea receiving focus will satisfy `:focus-within`.

### [P1] `TERMINAL_THEME` is a 3-key hex mirror with no ANSI palette — program output is uncoordinated with the app
- Pillar · Color & Semantics
- `src/renderer/SessionView.tsx:54-58` (`background:#1e232c; foreground:#d8dfe6; cursor:#d8dfe6`); `tokens.css:31-36` documents the divergence (`--term-text/--term-faint NOT routed into it`).
- What: The xterm JS theme is a separate, hand-maintained literal. The bg `#1e232c` DOES match `--term-bg` (`tokens.css:34`) — good. But `foreground:#d8dfe6` is a *fourth* value that is not any token (`--term-text` is `oklch(0.9 0.012 250)`; they are close but not identical, and one can drift without the other noticing). Critically, `TERMINAL_THEME` defines NO ANSI 16-colour block, so red/green/blue/yellow from `claude`, `vim`, `npm` come from xterm's stock defaults — never coordinated with `--color-accent` (blue) or `--color-danger` (red).
- Why it matters: A premium terminal wrapper's signature is that program colours feel like they belong to the app. Right now an error line in `claude` is stock-ANSI red, not the app's `--color-danger` hue (~25); a prompt's blue is not the app's accent. It also means the `[process exited]` / `— restarted HH:MM —` dim grey (`\x1b[2m`, `SessionView.tsx:486,536`) is whatever xterm's default "dim white" resolves to against `#1e232c` — unverified for AA and not tied to `--term-faint`.
- Fix: Derive `TERMINAL_THEME` from the `--term-*` tokens at startup (read computed styles once, or generate the const from the same oklch source) and add a deliberate 16-colour ANSI block whose accent/danger/success hues echo `--color-accent` / `--color-danger` / `--accent-finished`. At minimum, set `foreground` to the exact `--term-text` value and add a `theme` entry for the dim/faint colour used by the separators.

### [P1] IdleCard + Welcome + search-bar use hardcoded px instead of the `--space-*` / `--radius-*` scale
- Pillar · Spacing & Rhythm / Consistency
- `terminal-area.css`: idle-card `padding:24px; gap:16px` (`:351-353`), config `padding:16px; gap:12px; border-radius:12px` (`:386-388`), `idle-card-actions gap:8px` (`:467`), button `padding:8px 16px; border-radius:10px` (`:445-446`); welcome `gap:32px; padding:48px` (`:511-512`), CTA `padding:10px 20px; border-radius:10px` (`:544-545`); identity-header breadcrumb `font-size:12px` (`:207`); `terminal.css` search-bar `top/right:8px; padding:6px 8px; border-radius:10px` (`:48-59`).
- What: The well shell was migrated to tokens in GAP-11-A (`--space-7`, `--radius`, `--shadow-pop`), but every child surface is still literal px. These values mostly *coincide* with scale steps (`16=--space-4`, `8=--space-2`, `10=--radius-lg`, `12=--radius-xl`, `48=--space-12`, `32=--space-8`), so this is low-risk mechanically — but it is exactly the "DEFINED-NOT-APPLIED" debt `tokens.css:14,81` warns about, and it means a future scale retune silently skips these surfaces.
- Why it matters: Consistency of rhythm is what makes the IdleCard read as a sibling of the live card rather than a separate widget. Literal px also makes the `idle-card-stage inset:calc(-1*var(--space-3))` bleed (`:338`) fragile: the stage padding (`:342`) is `var(--space-6)` while the card padding is literal `24px` — they happen to differ by intent but the mix of token + literal hides whether that's deliberate.
- Fix: Migrate these literals to the nearest `--space-*` / `--radius-*` token (the mapping is 1:1 for almost all of them). Keep the genuinely off-scale one-offs (e.g. `min(440px, …)`) as one-offs, but everything 4px-aligned should reference the scale.

### [P1] The removed StatusSummary pill strip left the card with a header→well gap that now has no anchoring content
- Pillar · Hierarchy / Spacing & Rhythm
- `terminal-area.css:34-39` (round-3 comment: strip "removed 2026-06-14 … the prior inter-child gap is dropped"), `:63` (`.terminal-card gap:var(--space-4)`); `SessionManager.tsx:638` confirms the removal; `IdentityHeader` is a 2-line grid (`terminal-area.css:176-186`).
- What: The card is a flex column of exactly two children now — IdentityHeader cap and the well — separated by `gap:var(--space-4)` (16px) plus the breadcrumb's own line. No leftover *dead* spacer survives (good — the gap was correctly removed), but the result is that the breadcrumb's faint mono path (`:200-211`) floats in a 16px no-man's-land between the bold name line and the charcoal well with nothing to relate it to. The top-of-card rhythm reads slightly unbalanced: heavy header, then a soft gap, then a hard charcoal edge.
- Why it matters: This was flagged as the place to look for a "spacing scar." There is no literal scar, but the *rhythm* the strip used to provide (a mid-weight band bridging header and well) is gone, leaving a top-heavy cap. On the core surface this is the difference between "designed card" and "two stacked things."
- Fix: Either tighten the header→well gap to `--space-3` and let the white gutter (`--space-7`) carry the breathing room, or re-introduce a lightweight bridging element (e.g. a thin `--line-soft` hairline under the breadcrumb, or move the status badge down to bridge). Verify against the mockup whether the breadcrumb should sit closer to the name.

### [P2] IdleCard error state is calm to the point of under-signalling a failure
- Pillar · States & Interaction / Color
- `IdleCard.tsx:111-124` (error block), `terminal-area.css:431-438` (`.idle-card-error` — `color:var(--color-danger)`, regular 13px weight, no background, no icon).
- What: A failed spawn shows a red-text line plus a neutral helper line plus Edit/Retry buttons. The only error signal is red text colour at body weight; there is no error glyph, no tinted container, no border accent. The card chrome (white surface, `--shadow-dialog`) is identical to the healthy dormant card.
- Why it matters: The brief asks: "is the error state alarming-enough but not broken-looking?" It is firmly on the *too-quiet* side — a red sentence is easy to skim past, and the identical card framing makes a hard failure look like a normal idle state. It does avoid looking *broken* (good), but it under-delivers the "something went wrong, act on it" read.
- Fix: Add a subtle error affordance that stays on-brand: wrap the message in a `color-mix(in oklch, var(--color-danger) 8%, transparent)` tinted block with a `1px solid var(--color-danger)` left edge (mirroring the `row-control-close` danger idiom at `terminal-area.css:313-318`), and prefix a `⚠`/`✕` glyph. Keep the Retry button as the primary blue affordance.

### [P2] Welcome empty-state sits on `--bg-sunk` inside a white card — a flat panel-in-panel, and self-described as un-restyled
- Pillar · Hierarchy / Consistency
- `WelcomeEmptyState.tsx:18-37`, `terminal-area.css:505-517` (`.welcome-state { background:var(--bg-sunk); padding:48px }`); `:500-504` comment admits "the internal restyle is Phase 13."
- What: Zero-sessions shows a centered 🛋️ glyph + heading + body + blue CTA on a `--bg-sunk` fill that fills the entire `.terminal-card` interior. Because the card is white (`--surface`) and the welcome fills it with `--bg-sunk`, the result is a near-white panel inside a white card — almost no figure/ground separation, and the generous `--space-7` card gutter is hidden behind the sunk fill. It's a competent fallback, not yet a designed first-run moment.
- Why it matters: This is the literal first thing a new user sees. The copy has charm ("Your parlour is quiet"), but the visual is a flat centered stack with one accent button — close to the "banned" generic empty state. The `--bg-sunk` overriding the card surface also breaks the "sibling of the live card" intent the comment claims (`:500-503`).
- Fix (Phase 13 is acknowledged): Let the welcome inherit the white `--surface` so it reads as the same card; give the glyph a tinted circular plate; add depth (a faint illustration or a subtle `--shadow-pop` inner card) so the first-run reads as intentional, not as an empty container. At minimum, drop the `--bg-sunk` override so the card gutter is respected.

### [P2] `.session-view` / `.viewport-stack` / `body` paint `--term-bg` charcoal as a pre-paint ground that can flash behind the white card
- Pillar · Consistency
- `terminal.css:19` (`body { background:var(--term-bg) }`), `terminal-area.css:124` (`.viewport-stack background:var(--term-bg)`), `:135` (`.session-view background:var(--term-bg)`).
- What: `body` is charcoal `--term-bg` while `.ide-layout` is cream `--bg` (`terminal.css:32`). The charcoal body is intentional (it matches xterm before first frame, `terminal.css:1-4`), but it means any layout gap, over-scroll, or first-paint frame before `.ide-layout` covers the viewport shows charcoal — a colour that, post-GAP-11-A, no longer matches the cream-field design language outside the well.
- Why it matters: Minor, but it's a latent seam: the app's outermost ground is the *terminal* colour, inherited from the pre-card era, while the design is now "warm cream field with a charcoal inset." On a slow first paint or a resize jiggle the user can glimpse the old dark ground around the card.
- Fix: Set `body` background to `var(--bg)` (cream) to match the new field, and keep `--term-bg` only on the well / viewport-stack where xterm actually renders. Verify no first-frame flash regression in the pty-resize smoke.

## Token drift vs truth

| Literal / value | Where | Truth (`tokens.css`) | Verdict |
|---|---|---|---|
| `background:#1e232c` (xterm) | `SessionView.tsx:55` | `--term-bg:#1e232c` (`:34`) | **Matches** — but it's a hand-copied hex mirror, not routed; drift risk if `--term-bg` changes. |
| `foreground:#d8dfe6` (xterm) | `SessionView.tsx:56` | `--term-text:oklch(0.9 0.012 250)` (`:35`) | **Drift** — `#d8dfe6` is a 4th value, NOT equal to `--term-text` and NOT routed; documented as intentional non-routing (`tokens.css:31-33`) but it is real divergence. |
| `cursor:#d8dfe6` | `SessionView.tsx:57` | (no cursor token) | Untracked literal; no token home. |
| ANSI 16-colour palette | absent in `TERMINAL_THEME` | `--color-accent` / `--color-danger` / `--accent-finished` exist | **Drift (omission)** — program colours use xterm stock defaults, uncoordinated with app accent/danger. The single biggest mirror gap. |
| `\x1b[2m` dim separators (`[process exited]`, `— restarted HH:MM —`, `— notice —`) | `SessionView.tsx:486,509,536` | `--term-faint:oklch(0.66 0.02 255)` (`:36`) | **Drift** — the intended faint colour exists as a token but the scrollback uses ANSI SGR dim instead; actual rendered grey is xterm-default, unverified for AA on `#1e232c`. |
| `idle-card padding:24px; gap:16px` | `terminal-area.css:351-353` | `--space-6:24px` / `--space-4:16px` | Off-token (values coincide with scale). |
| `idle-card-config padding:16px; gap:12px; radius:12px` | `:386-388` | `--space-4` / `--space-3` / `--radius-xl` | Off-token (coincide). |
| `idle-start-button padding:8px 16px; radius:10px` | `:445-446` | `--space-2`/`--space-4` / `--radius-lg` | Off-token (coincide). |
| `welcome gap:32px; padding:48px` | `:511-512` | `--space-8:32px` / `--space-12:48px` | Off-token (coincide). |
| `welcome-cta padding:10px 20px` | `:544-545` | `--space-2_5:10px` / `--space-5:20px` | Off-token (coincide). |
| `search-bar top/right:8px; padding:6px 8px; radius:10px` | `terminal.css:48-59` | `--space-2` / `--space-1_5`+`--space-2` / `--radius-lg` | Off-token (coincide). |
| `breadcrumb font-size:12px` / idle/welcome `13/20/28px` font-sizes | `terminal-area.css:207,374,378,408,…` | (no type-scale tokens defined) | No type token exists — literal font-size is currently the only option; flagged as a scale gap, not a violation. |
| `.status-badge` styling | (consumed `IdentityHeader.tsx:89`, `IdleCard.tsx:60`) | n/a | **Missing rule** — references a class with no definition; `--accent` custom prop has no consumer. See P0. |

Note: no off-scale hex/oklch *leaks* were found inside `terminal-area.css` / `terminal.css` — every colour there is `var()`-routed, consistent with the `tokens-completeness.test.ts` contract (`terminal-area.css:10`). All drift is either in the JS `TERMINAL_THEME` mirror (outside the CSS test's reach) or off-scale-px / missing-rule, not literal colour leakage.

## Upgrade opportunities

1. **Route `TERMINAL_THEME` from the token layer + add a designed ANSI palette.** Generate the xterm theme from the same `--term-*`/`--color-*` oklch source (read computed `:root` styles once at boot) and author a deliberate 16-colour ANSI block whose red/green/blue/yellow echo `--color-danger` / `--accent-finished` / `--color-accent` / `--accent-waiting`. This is the single highest-leverage move for "real terminal fidelity that feels like the app" — it makes `claude`/`vim`/`npm` output read as part of the product, and kills the documented mirror drift.

2. **Give the well a focus identity.** An inset `:focus-within` accent ring (P0 fix) plus a near-imperceptible rest-state inner hairline turns the well from "a dark rectangle" into "the live input surface." With multi-session keep-alive, consider a 1px accent top-edge on the *active* well that subtly tints toward the session's status colour — reinforcing identity + focus in one stroke.

3. **Promote the scrollback lifecycle separators to a designed system.** The `[process exited]` / `— restarted HH:MM —` / `— notice —` lines (`SessionView.tsx:486,509,536`) are the terminal's only in-band narrative. Treat them as a typographic system: a centred faint rule with the `--term-faint` colour, consistent em-dash framing, and a relative timestamp — so a long-running session's history reads like a clean log, not stray grey text. Verify AA contrast of the chosen grey on `#1e232c`.

4. **Make the IdleCard error state a real, on-brand alert.** Tinted danger container + left accent edge + glyph (P2 fix), reusing the existing `color-mix` danger idiom already shipped on `.row-control-close` (`terminal-area.css:313-318`) so it's consistent and token-pure. Small change, big jump in "this failed, here's what to do."

5. **Design the first-run / empty state as a moment (Phase 13).** Inherit `--surface`, add a tinted glyph plate and a hint of depth, and consider a one-line "what this app does" framing so a brand-new user understands the side-tab session model before they create anything — turning the bare fallback into an intentional onboarding beat that respects the card's `--space-7` gutter.
