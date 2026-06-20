# Sidebar / Session List — Design Audit

Cluster: the left navigation rail (sessions as rows + Working/Inactive buckets + collapse + drag-reorder + IdentityHeader cap + IconPicker). Read in full: `Sidebar.tsx`, `sidebar.css`, `IdentityHeader.tsx`, `IconPicker.tsx`, `status-colors.ts`, `row-secondary.ts`, `session-status.ts`, `start-affordances.ts`, plus the IconPicker/IdentityHeader CSS that actually lives in `form.css` + `terminal-area.css`, and `tokens.css`.

Verdict up front: the **sidebar row** is genuinely well-designed — intentional two-line hierarchy, real hover/active/drag/dormant states, disciplined dot-carries-color semantics, careful zero-collapse so controls never crush the name. It is NOT generic. The damage is concentrated in **two shared pieces the rail leans on but never styles**: the IdentityHeader `.status-badge` (and its inner `.status-dot`) have **no CSS at all**, and the keyboard-focusable rows have **no focus ring**. Those two pull Color and A11y down hard despite the row craft.

## Pillar scores

| Pillar | Score /5 | Verdict |
|---|---|---|
| 1. Hierarchy | 4 / 5 | Strong: bold 14/700 name over 12/400 muted secondary, large icon tile, section captions + counts. Loses 1 only because the cap's `.status-badge` (the active session's status) renders as bare unstyled text. |
| 2. Spacing & Rhythm | 3 / 5 | Row internals are well-tuned via `--space-*`, but the rail frame + add-session + pinned controls are still hardcoded px (`220px`/`10px`/`4px`/`28px`/`52px`/`6px`) — `--space-*` is defined-not-applied exactly where tokens.css warned. |
| 3. Color & Semantics | 3 / 5 | 5-state ramp is well-reasoned and dot-isolated (text stays `--ink-soft`), but running BLUE == interactive/accent BLUE (same `--color-accent`), and the badge that should carry the color is invisible. Color-blind safety rests on a tiny 8px dot + a text label. |
| 4. Typography | 4 / 5 | Nunito 700/400 pairing is clean and consistent across row/header; breadcrumb correctly switches to mono for the path. Minor: header session icon has no sized tile so its glyph size is undefined. |
| 5. States & Interaction | 4 / 5 | Excellent designed states — hover wash, active card+edge+shadow, dormant dashed recipe card, drag ghost with blue outline, color-mix danger hover. Loses 1 for the missing **row** focus-visible and missing add-session focus-visible. |
| 6. Consistency & A11y | 2 / 5 | Two P0 a11y gaps (no row focus ring on `role=button` rows; the active-status badge is unstyled/invisible) plus the running/interactive blue collision. Good ARIA wiring (`aria-current`, `aria-label`, `role=tooltip`) can't offset a missing visible focus indicator. |

## Findings

### [P0] The active session's status badge has zero CSS — `.status-badge` + its `.status-dot` are unstyled
- Pillar · Color & Semantics / Hierarchy · `IdentityHeader.tsx:88-95` renders `<span className="status-badge">…<span className="status-dot"/>{label}</span>`, but **no stylesheet defines `.status-badge` or a bare `.status-dot`** (grep across `sidebar.css` / `terminal-area.css` / `terminal.css` / `form.css` / `tokens.css` returns only the *comment* `terminal-area.css:175,362` "reuses .status-badge" and the *scoped* `sidebar.css:156` `.row-secondary .status-dot` + `sidebar.css:466` `.collapsed-status-dot`).
- What · The header sets `--accent` inline (`IdentityHeader.tsx:90`) expecting a pill + colored dot to read it. With no `.status-badge` rule there is no pill (no background, no padding, no radius, no gap); with no bare `.status-dot` rule the inner `<span>` is an empty zero-size inline element. The result is plain run-in text ("Running"/"In progress"/"Waiting for you") with **no color and no dot** — the inline `--accent` is dead.
- Why it matters · This is the app's single always-visible **active-session status** indicator, capping the terminal (the core surface). The entire `presentation()` / agent-overlay color system (`status-colors.ts:44-72`) terminates here and renders colorless. "Waiting for you" (the highest-attention, amber, rank-0 signal) is indistinguishable from "Running". The sidebar's own secondary-line dot still works, but the header — the most prominent status read — is broken.
- Fix · Add the missing shared rules (the comments say it was *meant* to exist): `.status-badge { display:inline-flex; align-items:center; gap:var(--space-1_5); padding:var(--space-0_5) var(--space-2); border-radius:999px; background:color-mix(in oklch, var(--accent) 12%, transparent); color:var(--ink); font-size:12px; font-weight:700; }` and a bare `.status-dot { width:8px; height:8px; border-radius:999px; background:var(--accent); flex:0 0 auto; }`. Mirror the sidebar's existing 8px dot (`sidebar.css:156-162`).

### [P0] Keyboard-focusable rows have no focus ring — `.sidebar-row:focus-visible` is undefined
- Pillar · Consistency & Accessibility / States · `Sidebar.tsx:229-230` makes every row `role="button" tabIndex={0}` (plus dnd-kit's keyboard sensor), but `sidebar.css` only defines `:focus-visible` on **children** — `sidebar.css:189` `.row-controls`, `sidebar.css:254` `.row-control`, `sidebar.css:533` collapsed tooltip. There is **no `.sidebar-row:focus-visible` outline**.
- What · Tab/arrow-focusing a session row (the rail's primary nav targets) produces no visible focus indicator. The `.active` row shows an accent left-bar (`sidebar.css:89-94`) but "active" ≠ "focused": focusing a *non-active* row to switch to it via keyboard gives zero feedback about where focus is.
- Why it matters · Stable identity + instant non-destructive switching is the project's stated second pillar, and keyboard switching is an explicit feature (Enter-to-switch, `Sidebar.tsx:261-264`). A missing focus ring on the primary interactive elements is a WCAG 2.4.7 failure and a real "where am I" break for keyboard users. Every other focusable control in the app *does* get the blue 2px ring (collapse/prefs `sidebar.css:457`, start `sidebar.css:318`, header controls `terminal-area.css:304`), so the row is the conspicuous omission.
- Fix · `.sidebar-row:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }` (offset inward so it reads inside the row card; matches the `.dragging` outline idiom at `sidebar.css:381-382`).

### [P1] Running BLUE collides with the interactive/accent BLUE used for focus, Start, drag, and "engaged"
- Pillar · Color & Semantics · `status-colors.ts:27` maps `running → var(--accent-running)`, and `tokens.css:46` sets `--accent-running: var(--color-accent)` — the **same** oklch(.62 .14 248) used for: focus rings (`sidebar.css:319`, `terminal-area.css:305`), the dormant Start ▶ (`sidebar.css:306-316`), the drag outline (`sidebar.css:381`), the active-row left edge when running, and search "engaged" (`terminal.css:138`).
- What · The one hue does double duty as "this process is running" AND "this thing is interactive / focused / engaged". On a running row the left edge bar, the secondary dot, and (when focused per the P0 fix) the focus ring would all be the identical blue.
- Why it matters · The brief flags this exactly: a blue marker becomes ambiguous between "running status" and "clickable/affordance". It muddies the semantic layer the rest of the system is careful about (amber reserved solely for waiting, `status-colors.ts:49`).
- Fix · Either shift `--accent-running` off the interactive hue (e.g. a teal/cyan oklch(.62 .12 220) so running ≠ accent-248), or keep running=blue but make interactive affordances differ by *treatment* not hue (focus = ring, status = filled dot/bar) and document the rule. Lowest-risk: nudge `--accent-running` hue ~25–30° so the two blues are distinguishable side-by-side.

### [P1] `--space-*` is defined-not-applied across the rail frame, add-session, and pinned controls
- Pillar · Spacing & Rhythm · `tokens.css:81-97` explicitly says the scale is "DEFINED ONLY… Phases 10–13 consume it." The row *internals* were migrated (gaps/padding use `--space-*`), but the rail chrome was not: `.sidebar` `flex:0 0 220px` / `padding:10px` / `gap:4px` (`sidebar.css:9,12,13`); `.add-session` `margin-top:6px` / `padding:8px 10px` / `border-radius:10px` (`sidebar.css:396-398`); `.sidebar-pinned` `gap:4px` / `margin-bottom:2px` (`sidebar.css:423,424`); `.sidebar-collapse/.sidebar-prefs` `28px` (`sidebar.css:436-437`); collapsed `flex-basis:52px` (`sidebar.css:481`); the secondary/collapsed dots `8px`/`10px` (`sidebar.css:158-159,523-524`); tooltip `padding:5px 10px` (`sidebar.css:542`).
- What · Hardcoded px where a scale step exists: `10px`→`--space-2_5`, `4px`→`--space-1`, `6px`→`--space-1_5`, `8px`→`--space-2`, `28px`→`--space-7`, `2px`→`--space-0_5`. (Genuine one-offs: `220px` rail width, `52px` collapsed width, `5px`/`14px`/`22px` — tokens.css:96 already declares these stay literal.)
- Why it matters · Token drift is silent: the next person editing rhythm has two truths (scale + literals) and the rail won't move in lockstep with the row. It's the difference between a real token system and tokens-as-decoration.
- Fix · Swap the listed literals for their `--space-*` equivalents (see Token-drift table). Leave `220px`/`52px`/`5/14/22px` as documented one-offs.

### [P1] IdentityHeader session icon has no sized tile — `.identity-header .row-icon` is undefined
- Pillar · Typography / Consistency · `IdentityHeader.tsx:80` renders `renderIcon(...)` → `<span className="row-icon">`. But `.row-icon` is only ever sized when scoped: `.sidebar-row .row-icon` 32×32 (`sidebar.css:110-119`), `.idle-card-identity .row-icon` 28px (`terminal-area.css:369`), `.icon-picker-preview .row-icon` 28px (`form.css:194`). There is **no `.identity-header .row-icon`** rule.
- What · In the cap, the session icon has no width/height, no border-radius tile, and no `font-size` (the header element `terminal-area.css:176-186` sets none, so the glyph inherits whatever cascades from root). The emoji/color-badge renders at an undefined size next to a 700-weight name — and the `.row-icon-color` badge (`sidebar.css:558`, 11px initial) is tuned for the 32px sidebar tile, so in the unsized header it can look off.
- Why it matters · The header is explicitly meant to "reuse the SAME renderIcon… so identity reads consistently everywhere" (`IdentityHeader.tsx:5-8`). Without a sized tile the cap icon is the one inconsistent identity glyph in the app.
- Fix · `.identity-header .row-icon { width:28px; height:28px; font-size:18px; border-radius:var(--radius-md); display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto; }` (match the idle-card 28px so the two card identities agree).

### [P1] `.add-session` (the primary create affordance) has no focus-visible ring
- Pillar · A11y / States · `sidebar.css:395-405` styles `.add-session` + `:hover` (`sidebar.css:407`) but no `:focus-visible`. `Sidebar.tsx:556-564` is a real `<button>`, Tab-reachable.
- What · Keyboard-focusing "+ Add session" shows no ring — inconsistent with every sibling control (collapse/prefs/start/header all ring at `sidebar.css:457`, `318`, `terminal-area.css:274`).
- Why it matters · The single most important "grow the list" action is invisible to keyboard focus; same WCAG 2.4.7 family as the row gap.
- Fix · `.add-session:focus-visible { outline:2px solid var(--color-accent); outline-offset:1px; }`.

### [P2] Collapsed rail: identity rests entirely on a hover/focus tooltip — no persistent name affordance, and the only control is right-click
- Pillar · States / A11y · Collapsed mode hides name/secondary/controls (`sidebar.css:489-494`); identity = icon + a 10px status dot (`sidebar.css:518-529`) + `.rail-tooltip` shown only on `:hover`/`:focus-visible`/`:focus-within` (`sidebar.css:532-534`). Per `Sidebar.tsx:98-110` the right-click menu is the *only* control surface when collapsed.
- What · A user scanning the collapsed rail can't read any session name without hovering/focusing each tile one at a time, and can't reach Start/Edit/Remove without discovering right-click (no visible hint that right-click is the path).
- Why it matters · For ~50 sessions of similar emoji this is a real findability tax; the collapsed state trades too much legibility for width. Not broken (tooltip + dot work), hence P2.
- Fix · Consider a 1-line truncated name under the icon at a slightly wider collapsed width, or a persistent context-menu/⋯ affordance on collapsed tiles so the only-control-is-right-click isn't undiscoverable.

### [P2] Status color is carried by an 8px dot + a text word — thin for color-blind robustness
- Pillar · Color & Semantics / A11y · Sidebar secondary dot is 8px (`sidebar.css:158-159`); collapsed dot 10px (`sidebar.css:523-524`). The status *word* is always present in the expanded secondary line (`row-secondary.ts:89`) and the (currently unstyled) header badge, so expanded mode is fine — but the **collapsed** rail conveys status by **dot color alone** (no label, tooltip only on hover).
- What · Running-blue vs free/idle-slate vs finished-green differ mainly by hue at 10px; for deuteranopia, green↔slate and blue↔slate at that size are hard, with no shape/label backup when collapsed.
- Why it matters · Color-blind safety in the collapsed rail leans on a single tiny hue cue.
- Fix · Differentiate the collapsed dot by *shape/fill* per state (e.g. ring for idle, solid for running, check-tick or hollow for finished) so status survives desaturation, or surface the status word in the always-on tooltip target. Amber-for-waiting (`status-colors.ts:49`) is already well-isolated; this is about the green/slate/blue trio.

### [P2] Drag handle reads as decorative-only and never appears for keyboard users
- Pillar · States / A11y · `.row-drag-handle` is `aria-hidden` (`Sidebar.tsx:271`), opacity 0 → 1 only on `:hover` and `.active` (`sidebar.css:365-368`), 8px wide (`sidebar.css:355`). Keyboard reorder is real (dnd-kit KeyboardSensor, `Sidebar.tsx:425-428`) but the ⠿ glyph never shows on `:focus-visible`.
- What · The discoverability cue for drag-to-reorder only exists for mouse-hover; a keyboard user tabbing the row gets no hint that Space starts a reorder, and the handle doesn't reveal on row focus.
- Why it matters · Reorder is a shipped feature (NAV-04/D-08) whose only visible affordance is hover-bound; minor, hence P2.
- Fix · Add `.sidebar-row:focus-visible .row-drag-handle { opacity:1; }` and consider a one-time hint or `aria-roledescription` surfacing "draggable; press Space to reorder" (dnd-kit's `attributes` already provides some of this — verify it's announced).

## Token drift vs truth

| Literal in cluster | file:line | Correct token |
|---|---|---|
| `padding: 10px` (rail) | `sidebar.css:13` | `--space-2_5` |
| `gap: 4px` (rail) | `sidebar.css:12` | `--space-1` |
| `gap: 4px` (.sidebar-section) | `sidebar.css:27` | `--space-1` |
| `margin-top: 6px` (.add-session) | `sidebar.css:396` | `--space-1_5` |
| `padding: 8px 10px` (.add-session) | `sidebar.css:397` | `--space-2 --space-2_5` |
| `border-radius: 10px` (.add-session) | `sidebar.css:398` | `--radius-lg` |
| `font-size: 13px` (.add-session) | `sidebar.css:403` | one-off (14px=base; 13 stays literal per tokens.css:96) |
| `gap: 4px` (.sidebar-pinned) | `sidebar.css:423` | `--space-1` |
| `margin-bottom: 2px` (.sidebar-pinned) | `sidebar.css:424` | `--space-0_5` |
| `width/height: 28px` (collapse/prefs) | `sidebar.css:436-437` | `--space-7` |
| `border-radius: 8px` (collapse/prefs) | `sidebar.css:441` | `--radius-md` |
| `width/height: 8px` (.row-secondary .status-dot) | `sidebar.css:158-159` | `--space-2` |
| `width/height: 10px` (.collapsed-status-dot) | `sidebar.css:523-524` | one-off 10px (no scale step; document) |
| `border-radius: 7px` (.row-control) | `sidebar.css:281` | `--radius-sm` (token exists; literal used) |
| `left: calc(100% + 8px)` (tooltip) | `sidebar.css:537` | `--space-2` |
| `padding: 5px 10px` (tooltip) | `sidebar.css:542` | `5px` one-off (tokens.css:96) + `--space-2_5` |
| `font-size: 14px` (.row-name/.sidebar-row) | `sidebar.css:77,135` | base text size — fine, but no `--font-size-*` token exists (gap: no type scale) |
| `font-size: 18px` (.row-icon glyph) | `sidebar.css:117` | one-off (optical) |
| `.status-badge` / bare `.status-dot` | **missing entirely** | should consume `--accent` + `--space-*` + `999px` (see P0) |
| `width/height: 26px` (.color-swatch) | `form.css:260-261` | one-off (no scale step; 24/28 are nearest) |
| `width/height: 28px` (.icon-picker-preview .row-icon) | `form.css:195-196` | `--space-7` |
| `gap/padding: 8/12/16px` (.idle-card-*) | `terminal-area.css:367,398,400` | `--space-2 / --space-3 / --space-4` (adjacent surface, same drift) |

Note: there is **no typographic scale token** (`--font-size-*`) at all — every `font-size` in the cluster is a literal (10/12/13/14/15/16/18px). tokens.css covers color/space/radius/shadow/motion/font-family but not type sizes; that's the structural reason Typography literals can't be "drift-corrected" to a token today.

## Upgrade opportunities

1. **Ship the missing shared status primitives, then unify them.** Define `.status-badge` + bare `.status-dot` once (P0), and have the sidebar secondary dot, collapsed dot, header badge, and idle-card badge all consume that single pair. Right now the dot exists in three near-duplicate scoped forms (`sidebar.css:156`, `466`, and the *expected-but-absent* header one). One source → guaranteed consistent status read everywhere, and the agent-overlay color system finally lights up in the cap.

2. **Resolve the blue/blue semantic collision with a deliberate rule.** Pick: status = *filled* (dot/bar), interaction = *outline* (ring) — and move `--accent-running` ~25–30° off `--color-accent` so a running row and a focused row are never the same blue. Document "amber=waiting, and running-blue ≠ accent-blue" beside `status-colors.ts:44`. This turns a latent ambiguity into an intentional, legible system.

3. **Make the collapsed rail legible at rest.** Add a 1-line truncated name (or initials) beneath each collapsed icon at a slightly wider rail, plus a persistent ⋯/right-click hint, so identity + controls don't depend entirely on per-tile hover. Biggest real-use win for many same-emoji sessions.

4. **Color-blind-proof the status trio by shape, not just hue.** Give idle/running/finished distinct dot fills (ring / solid / hollow-tick) so status survives desaturation in the collapsed rail; keep amber-waiting as the reserved high-attention case. Cheap, and it hardens the one place status is hue-only.

5. **Introduce a type-scale token set** (`--font-size-2xs…lg`) so Typography joins the token system the way color/space already have. It closes the "every font-size is a literal" gap and lets the row/header/breadcrumb rhythm be tuned centrally — the natural next step now that `--space-*` migration is underway.
