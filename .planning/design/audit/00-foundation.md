# Design Foundation — Design Audit

> Scope: the token system (`src/renderer/tokens.css`) + how faithfully every renderer surface honors it.
> Read-only audit. Every claim cites `file:line`. Contrast ratios computed oklch→sRGB→WCAG (script `/tmp/contrast.mjs`).

## Pillar scores

| Pillar | Score /5 | Verdict |
|---|---|---|
| 1. Hierarchy | 4 | Strong: weight/case/tone carry hierarchy by design (form.css:398-406); only weakened by `--ink-faint` text failing contrast. |
| 2. Spacing & Rhythm | 3 | A real `--space-*` scale exists and is 68× consumed, but ~25 raw spacing literals still bypass it — `.idle-card`/`.welcome-state` are unmigrated islands. |
| 3. Color & Semantics | 2 | Clean ramp design, BUT a P0 semantic collision (interactive blue ≡ running-status blue) and white-on-accent CTA labels fail AA. |
| 4. Typography | 3 | Disciplined pairing (Nunito/JetBrains) + CJK fallback, but 12 distinct font-sizes vs the ≤4 chassis target = scale sprawl. |
| 5. States & Interaction | 4 | Genuinely designed: every interactive element has hover + `:focus-visible` blue ring + collapse-to-zero reveal logic. Consistent and complete. |
| 6. Consistency & Accessibility | 3 | High token discipline (guarded by a test), but two dead tokens, a literal hex leak, and 3 AA contrast failures pull the accessibility half down. |

## Findings

### [P0] Semantic collision — interactive blue is the same blue as "running" status
- Pillar 3 (Color & Semantics) · `tokens.css:40,46` · `--color-accent: oklch(0.62 0.14 248)` and `--accent-running: var(--color-accent)` are the **same color literal**.
- What: The brand accent reserved for "clickable / primary action" (Save button, Start button, focus ring, link) is byte-identical to the status color that means "this session is Running" on the sidebar status dot (`sidebar.css:161` `.status-dot { background: var(--accent) }` resolving to `--accent-running`).
- Why it matters: On the active sidebar row, a blue **status dot** (a read-only state indicator) sits inches from blue **interactive affordances** (the `.row-control-start` ▶ outlined in the same blue, `sidebar.css:307-309`; the active card's blue focus ring, `sidebar.css:381`). A user cannot tell from color alone what is a *state* vs what is *clickable*. The IdentityHeader compounds this: a "Running" badge (blue) sits in the same cap as the blue-ringed Clear/Remove controls. This is the classic "is it a link or a label?" failure — color is doing two contradictory jobs.
- Fix: Split the tokens. Either (a) shift `--accent-running` off the exact accent hue (e.g. a desaturated/darker blue `oklch(0.55 0.10 248)`) so status-blue ≠ action-blue, or (b) make the running indicator non-blue (the app already owns a 5-color status ramp — running could borrow a distinct treatment). The token indirection (`var(--color-accent)`) already exists; only the value needs to diverge. Cheap, high-impact.

### [P0] White text on the accent-blue fill fails WCAG AA on primary CTAs
- Pillar 6 / 3 · `form.css:110`, `terminal-area.css:456`, `terminal-area.css:547`, `sidebar.css:315` · white (`#ffffff` / `var(--surface)`) on `--color-accent` = **3.62:1** (AA normal text needs 4.5:1).
- What: Every constructive primary action renders white label text on the blue fill: `.modal-btn-save` (the session-form **Save**, form.css:107-111), `.idle-start-button:hover` (terminal-area.css:454-456), `.welcome-cta` (the empty-state **Create**, terminal-area.css:542-547), `.row-control-start:hover` (sidebar.css:312-315). All measure 3.62:1. The hover ramp `--color-accent-strong` is worse-direction at **4.26:1** (still < 4.5).
- Why it matters: These are the single highest-emphasis buttons in the app, with 13-14px text (normal-size, not large). Note the **danger** red is fine — white on `--color-danger` = 4.63:1 PASS (`form.css:90` `.modal-btn-confirm`). So the bug is specific to the blue, and it's the blue on the *most important* buttons.
- Fix: Darken the accent until white clears 4.5:1. `--color-accent` at L≈0.55 (current 0.62) lifts white-on-fill past AA while staying recognizably the same blue; cascade the same shift into `--color-accent-strong`. This also helps the next finding. (Borders/rings/dots keep passing at 3:1, so only the *filled-with-white-text* case forces the change.)

### [P0] `--ink-faint` body text fails AA on every background it is used on
- Pillar 6 · `tokens.css:27` · `--ink-faint: oklch(0.66 0.01 75)` ≈ `#96918c`. Contrast: **3.11:1 on --surface**, **2.69:1 on --bg**, **2.73:1 on --bg-sunk** — all < 4.5.
- What: `--ink-faint` is used as real prose color in 11 places, several of them *information the user must read*: the IdentityHeader breadcrumb path (`terminal-area.css:210`), the idle-card "Saved for reference — not run automatically" helper (`terminal-area.css:422`), the empty-startup placeholder (`terminal-area.css:428`), and the form validation hint `.edit-field-notice--hint` (`form.css:428`). The cwd breadcrumb (the thing telling the user *which directory this session runs in*) is below-AA.
- Why it matters: This isn't decorative chrome — the breadcrumb path and the "not run automatically" caveat are load-bearing. At 2.7-3.1:1 they're hard to read for normal vision and effectively invisible for low-vision users.
- Fix: Darken `--ink-faint` to ≈ `oklch(0.58 0.012 70)` (≈ `#7b756f`) to reach ~4.5:1 on `--surface`. It still sits clearly below `--ink-soft` (which is 6.01:1) so the three-tier ink hierarchy survives — the tiers just compress slightly. Where a value is genuinely decorative (the `·` breadcrumb separator at 0.6 opacity, terminal-area.css:215-217), AA-large (3:1) is acceptable and no change is needed.

### [P1] Two dead tokens: `--term-text` / `--term-faint` are defined but never consumed
- Pillar 6 · `tokens.css:35-36` · `grep var(--term-text|--term-faint)` across all css/tsx = **0 hits**.
- What: Both were "ADD (D-03)" tokens. The actual terminal foreground is a literal hex in `SessionView.tsx:56` `foreground: '#d8dfe6'` (and cursor:57). The token comment even concedes the xterm theme is "a SEPARATE hex mirror; --term-text/--term-faint are NOT routed into it" (`tokens.css:31-33`). So the tokens exist purely to *document* a value that lives elsewhere as a literal.
- Why it matters: A token that nothing reads is a lie in the single source of truth — it invites a future edit to `--term-text` that silently does nothing (the terminal won't change; only `SessionView.tsx:56` controls it). Confirmed harmless-today but a drift trap. (Good news: the literal `#d8dfe6` and the token value `oklch(0.9 0.012 250)` ≈ `#d8dfe6` currently *agree* to ~11.7:1 contrast, so there's no live visual bug — just a duplicated source.)
- Fix: Either delete the two dead tokens, or make `SessionView.tsx` read them (it can't use `var()` in the xterm JS theme, but it could import a shared constant so there's one source). Given the xterm constraint, the honest move is to drop them from `tokens.css` and leave a one-line comment pointing at `SessionView.tsx:55-57` as the terminal palette home.

### [P1] `--space-*` scale is 68× applied but ~25 raw spacing literals still bypass it
- Pillar 2 · `tokens.css:13,81-97` (the admitted "defined-not-applied" debt) · raw `padding/gap/margin: Npx` declarations that skip `var(--space-*)`: **terminal-area.css 12, sidebar.css 8, terminal.css 4, form.css 0**.
- What: `form.css` is fully migrated (34 `var(--space-*)` uses, 0 raw) — proof the scale works. But two surfaces are unmigrated islands. The `.idle-card` block (terminal-area.css:347-468) hardcodes `padding:24px` (350), `gap:16px` (353), `gap:8px` (366,464,467), `padding:16px` (386), `gap:12px` (386), `gap:4px` (394) — all of which map cleanly to existing steps (`--space-6/4/2/3/1`). `.welcome-state` (terminal-area.css:505-549) hardcodes `gap:32px`/`padding:48px`/`gap:8px`. `terminal.css` `.search-bar`/`.search-input` hardcode `8px/6px/4px` (47-117).
- Why it matters: The whole point of the scale (tokens.css:13) was to let Phases 10-13 retune rhythm in one place. Two surfaces opted out, so the idle-card and welcome-state can't be re-rhythmed without hand-editing literals — exactly the drift the scale was meant to kill. It also means a global spacing tweak silently skips these two surfaces.
- Fix: Migrate the `.idle-card` + `.welcome-state` + `.search-*` literals to `var(--space-*)` (every value already maps to a step — 24→`--space-6`, 16→`--space-4`, 12→`--space-3`, 8→`--space-2`, 6→`--space-1_5`, 4→`--space-1`). This is the carried Phase-10-13 debt; ~25 mechanical substitutions, no visual change.

### [P1] Off-scale one-off spacing values (the 5/7/14px literals) don't map to a step
- Pillar 2 · `tokens.css:96-97` (admits the one-offs) · concrete leaks: `padding: 7px var(--space-3)` (`form.css:145` context-menu-item, `sidebar.css:281`/`terminal.css:112` row-control radius `7px`=`--radius-sm` which is fine, but the *padding* 7px is not a step), `padding: 5px 10px` (`sidebar.css:542` rail-tooltip), `text-shadow ... 14px`-class one-offs.
- What: The scale is 2/4/6/8/10/12/16/20/24/28/32/48. `7px` (context-menu vertical padding, form.css:145) and `5px` (tooltip, sidebar.css:542) fall *between* steps. `--radius-sm:7px` (tokens.css:54) is a legit radius token, but raw `7px`/`5px` *padding* is genuine off-scale drift.
- Why it matters: These produce micro-rhythm inconsistency (a 7px gutter next to an 8px gutter reads as a wobble, not intent). Small but it's exactly the "uniform-but-slightly-off" tell.
- Fix: Round `7px`→`--space-2` (8) and `5px`→`--space-1_5` (6) unless a deliberate optical reason is documented. If 7px is intentional (e.g. visual centering of a glyph), promote it to a named `--space-1_75` or leave a comment — silent one-offs are the problem, not the value.

### [P1] Type scale sprawl — 12 distinct font-sizes vs the ≤4 chassis target
- Pillar 4 · all renderer css · distinct px sizes: **10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 28, 48** (12 values).
- What: Counts: 14px×12, 13px×10, 12px×9 (the workhorses), then a long tail of singletons — 17px (`.modal-title` form.css:44), 15px (`.sidebar-collapse` glyph sidebar.css:446), 11px (`.row-icon-color` initial sidebar.css:559), 10px (`.sidebar-section-label` sidebar.css:38), 16/18/20/28/48 (icon/heading sizes). Several are emoji/glyph sizes (legit — an icon isn't "type"), but 17px-title-vs-20px-heading-vs-15px-glyph is real text-scale sprawl.
- Why it matters: The chassis discipline (≤4 distinct *text* sizes) keeps hierarchy legible. 13px and 14px coexisting as body sizes (10 + 12 uses) is a near-duplicate pair doing the same job — that's the sprawl signal, not the icon sizes.
- Fix: Collapse the 13/14px body pair to one (pick 14px for body, keep 12px for captions, 17→18px for titles, 20px for headings). Target a 4-step *text* ramp (12 caption / 14 body / 18 title / 20+ heading); leave glyph/emoji sizes out of the count but consider tokenizing them (`--icon-sm/md/lg`) so they stop reading as type sizes.

### [P2] Legacy `--radius:18px` is a second radius system alongside `--radius-xs..xl`
- Pillar 6 · `tokens.css:58` · `--radius: 18px` used 5× (form.css:1, terminal-area.css:3, sidebar.css:1).
- What: There are two radius systems: the geometric scale `--radius-xs/sm/md/lg/xl` = 6/7/8/10/12 (tokens.css:53-57), and the legacy `--radius:18px` (tokens.css:58) reserved for cards (modal-dialog form.css:36, terminal-card/terminal-well terminal-area.css:71/100/543, idle-card terminal-area.css:356). The comment marks it "KEEP existing alias … D-04 Discretion."
- Why it matters: 18px is a real jump from the 12px top of the scale (1.5×) — it *is* a deliberate "card" radius, not drift, and used consistently. So this is defensible. The only issue is naming: an unscaled `--radius` next to `--radius-xl` invites someone to assume `--radius` is the scale default.
- Fix: Rename `--radius` → `--radius-card` (or `--radius-2xl`) to make it read as a deliberate top step, not a competing system. Pure rename, no visual change. Verdict: keep the value, fix the name.

### [P2] Literal `#ffffff` button-text leaks where a token exists
- Pillar 6 · `form.css:90,110`, `sidebar.css:559` · `color: #ffffff` instead of `var(--surface)`.
- What: Three button labels use raw `#ffffff` (`.modal-btn-confirm`, `.modal-btn-save`, `.row-icon-color`). Elsewhere the identical "white text on color" case uses `var(--surface)` (`terminal-area.css:456,547`, `sidebar.css:315`). The file even comments this is "the single #ffffff … where contrast over a colored fill requires it" (form.css:11-13) — but `var(--surface)` IS `#ffffff` (tokens.css:18), so the literal buys nothing.
- Why it matters: Inconsistent — two idioms for the same thing. Minor, but it's the kind of leak the `tokens-completeness.test.ts` guard exists to prevent; these slipped through as "intentional."
- Fix: Replace the three `#ffffff` with `var(--surface)` for consistency. (The `oklch()` text-shadow at sidebar.css:563 and the `#1e232c` at SessionView.tsx:55 are the other literal leaks — the latter is the xterm JS theme which genuinely can't use `var()`, so leave it but see the dead-token finding.)

### [P2] StatusSummary removal left a CLEAN seam — no scar (verified, no action)
- Pillar 2 · `SessionManager.tsx:636-639` + `terminal-area.css:34-40` · the removed pill strip was handled correctly.
- What: The top StatusSummary pill strip was removed 2026-06-14 (SessionManager.tsx:638 comment). I checked for a leftover rhythm scar: the `.terminal-area` flex column previously had an inter-child gap for the strip; terminal-area.css:34-40 explicitly documents "the prior inter-child gap is dropped" and the margin was tightened `--space-6`→`--space-4`. No orphaned `gap`, no dead `padding-top`, no empty wrapper div remains.
- Why it matters: This is a *clean* removal — calling it out as a non-finding so the synthesis knows it was checked and is fine. The only residue is stale prose in two comments (terminal-area.css:25,37 still describe the strip as present) — cosmetic doc drift, not a layout scar.
- Fix: None required. Optionally scrub the two stale comments.

## Contrast table

| Pair | Ratio | AA pass? |
|---|---|---|
| `--ink` / `--surface` | 12.71:1 | PASS (normal) |
| `--ink` / `--bg` | 10.96:1 | PASS (normal) |
| `--ink-soft` / `--surface` | 6.01:1 | PASS (normal) |
| `--ink-soft` / `--bg` | 5.19:1 | PASS (normal) |
| `--ink-faint` / `--surface` | 3.11:1 | **FAIL** (normal) |
| `--ink-faint` / `--bg` | 2.69:1 | **FAIL** (normal) |
| `--ink-faint` / `--bg-sunk` | 2.73:1 | **FAIL** (normal) |
| `--color-accent` / `--surface` (as link/body text) | 3.62:1 | **FAIL** (normal) |
| `--color-accent` / `--surface` (as large/UI ≥3:1) | 3.62:1 | PASS (large/UI) |
| white(`#fff`) / `--color-accent` (button label) | 3.62:1 | **FAIL** (normal) |
| white / `--color-accent-strong` (hover label) | 4.26:1 | **FAIL** (normal) |
| white / `--color-danger` (button label) | 4.63:1 | PASS (normal) |
| `--term-text` (token) / `--term-bg` | 11.71:1 | PASS (normal) |
| `--term-text` literal `#d8dfe6` / `--term-bg` | 11.72:1 | PASS (normal) |
| `--term-faint` / `--term-bg` | 5.07:1 | PASS (normal) |
| `--accent-running` (blue) / `--surface` (dot, UI) | 3.62:1 | PASS (UI 3:1) |
| `--accent-finished` (green) / `--surface` (dot, UI) | 3.73:1 | PASS (UI 3:1) |
| `--accent-idle` (slate) / `--surface` (dot, UI) | 3.36:1 | PASS (UI 3:1) |
| `--accent-waiting` (amber) / `--surface` (dot, UI) | 3.25:1 | PASS (UI 3:1) |
| `--line` (border) / `--surface` | 1.31:1 | FAIL (decorative — N/A) |

> Note: `--line` at 1.31:1 is a hairline border, not a UI component boundary that conveys state — decorative, AA does not apply. Listed for completeness.

## Token leak map

| Literal | file:line | Correct token |
|---|---|---|
| `#ffffff` (button label) | form.css:90 | `var(--surface)` |
| `#ffffff` (button label) | form.css:110 | `var(--surface)` |
| `#ffffff` (icon initial) | sidebar.css:559 | `var(--surface)` |
| `oklch(0.255 0.018 264 / 0.35)` (text-shadow) | sidebar.css:563 | needs a `--shadow-text` token (none exists) |
| `#1e232c` (xterm bg) | SessionView.tsx:55 | mirrors `--term-bg`; xterm JS can't use `var()` — share a constant |
| `'#d8dfe6'` (xterm fg) | SessionView.tsx:56 | duplicates dead `--term-text`; share a constant |
| `'#d8dfe6'` (xterm cursor) | SessionView.tsx:57 | same as above |
| `padding:24px` | terminal-area.css:350 | `var(--space-6)` |
| `gap:16px` | terminal-area.css:353 | `var(--space-4)` |
| `gap:8px` | terminal-area.css:366,464,467 | `var(--space-2)` |
| `padding:16px` + `gap:12px` | terminal-area.css:386 | `var(--space-4)` / `var(--space-3)` |
| `gap:4px` | terminal-area.css:394 | `var(--space-1)` |
| `padding:8px 16px` | terminal-area.css:443,479 | `var(--space-2) var(--space-4)` |
| `border-radius:10px` / `12px` | terminal-area.css:444,480,388 | `var(--radius-lg)` / `var(--radius-xl)` |
| `gap:32px` / `padding:48px` | terminal-area.css:511-513 | `var(--space-8)` / `var(--space-12)` |
| `padding:10px 20px` | terminal-area.css:543 | `var(--space-2_5) var(--space-5)` |
| `top:8px; right:8px; gap:4px; padding:6px 8px` | terminal.css:49-50,55-56 | `--space-2 / --space-1 / --space-1_5 --space-2` |
| `border-radius:10px` (search-bar) | terminal.css:59 | `var(--radius-lg)` |
| `padding:6px 8px` (search-input) | terminal.css:68 | `var(--space-1_5) var(--space-2)` |
| `border-radius:8px` (search-input) | terminal.css:76 | `var(--radius-md)` |
| `padding:10px` (sidebar) | sidebar.css:13 | `var(--space-2_5)` |
| `gap:4px` (sidebar/section/pinned) | sidebar.css:12,27,423 | `var(--space-1)` |
| `margin-top:6px; padding:8px 10px` (add-session) | sidebar.css:396-398 | `--space-1_5` / `--space-2 --space-2_5` |
| `border-radius:10px` (add-session) | sidebar.css:398 | `var(--radius-lg)` |
| `padding:5px 10px` (rail-tooltip) | sidebar.css:542 | `--space-1_5`(≈) / `--space-2_5` |
| `padding:7px var(--space-3)` (context-menu-item) | form.css:145 | off-scale 7px → `var(--space-2)` |
| `font-size:14` (inline, terminal) | SessionView.tsx:254 | xterm fontSize — JS theme, not CSS-tokenable |

## Upgrade opportunities

1. **Break the action/status color identity (the single biggest level-up).** Forking `--accent-running` off `--color-accent` doesn't just fix the P0 collision — it lets the status ramp become a coherent *signal language* (blue=running, green=finished, amber=waiting, slate=idle, red=error) that is visually distinct from the *one* interactive blue. Right now the product can't fully exploit its own 5-color status system because one of the five is impersonating the action color.

2. **Darken accent + ink-faint together to clear AA, then earn a stronger hierarchy.** Both P0 contrast fixes pull values darker; do them as one pass. A slightly darker accent (L≈0.55) reads as *more confident/saturated* on white, and a darker ink-faint widens the gap to ink-soft — net result is a crisper three-tier text hierarchy and AA-clean CTAs in one move. Accessibility and aesthetics align here, they don't trade off.

3. **Finish the `--space-*` migration the tokens file promised.** The scale is proven (form.css is 100% migrated). Closing the ~25 remaining `.idle-card`/`.welcome-state`/`.search-*` literals makes the entire app re-rhythmable from one file — the original Phase-10-13 intent. Pair it with a `--space-1_75` (7px) decision so the context-menu/tooltip one-offs stop being silent exceptions.

4. **Tokenize glyph/icon sizing so the type scale can shrink to 4.** Introduce `--icon-sm/md/lg` (and `--font-size-caption/body/title/heading`) so the 12-value font-size count separates into "4 text sizes" + "named icon sizes." This makes the chassis ≤4-text-size rule pass honestly and stops emoji sizes from reading as typographic decisions.

5. **Add a `--shadow-text` token + rename `--radius`→`--radius-card`.** Two small coherence wins: the lone `text-shadow` literal (sidebar.css:563) gets a home, and the legacy 18px radius stops looking like a rogue second system (it's a legitimate, consistently-used card radius — it just needs a name that says so).
