# Just-Wrapper — Whole-App Design Audit
**Date:** 2026-06-21 · **Scope:** all renderer UI surfaces (v1.1 / Phase 12) · **Mode:** UIUX orchestrator advisory audit (E5+E7), code-based · **Method:** 5 parallel opus surface auditors + cross-validation + synthesis

> This is a **diagnosis (体检)**. No `src/` was changed. The Upgrade Plan at the bottom is what 升级 would look like — you pick what to run.

---

## 1. Verdict (business-first)

The design has **good bones and a genuinely intentional system** — oklch color space, a real token layer, designed hover/active/dormant/drag states on the sidebar rows, uniform modal chrome, and a clear two-bucket lifecycle visual language. This is **not** a template-looking app.

But it's a polished product with **a few load-bearing cracks**, and they cluster in three places:

1. **One silent visual bug** — the active-session status indicator (the most prominent status in the app) renders with **no color and no dot** because a CSS rule that the markup depends on was never written. The whole status color language dies at the header cap.
2. **The color foundation fails accessible-contrast math in 3 spots** — the primary blue buttons, the faint helper text, and a blue that means two different things at once.
3. **Keyboard/focus accessibility is the systemic weak spot** — focusable rows and the terminal itself have no visible focus ring, and modals don't trap Tab.

**None of these are crashes.** They're the difference between "works" and "feels finished + accessible." All are fixable, and **one small token pass clears 3 of the 4 visible P0s.**

### Health scorecard (avg across 5 surfaces, /5)

| Pillar | Score | Read |
|---|---|---|
| Hierarchy | **4.0** | Consistently strong — clear scale contrast, intentional row/card hierarchy |
| Typography | **3.6** | Good pairing (Nunito/JetBrains), but **12 distinct font-sizes** vs a ≤4 target |
| Color & Semantics | **3.6** | Strong palette dragged down by 3 contrast fails + the blue-means-two-things collision |
| Spacing & Rhythm | **3.2** | The `--space-*` scale exists but ~25 literals bypass it (the deferred Phase 10-13 debt) |
| States & Interaction | **3.2** | Sidebar/overlay states are designed; terminal well + modals miss focus states |
| **Consistency & A11y** | **2.8** | ⚠️ **The weak pillar** — keyboard focus, focus-trap, aria wiring are systematically missing |

**Overall ≈ 3.4/5** — "a strong product one focused pass away from feeling truly finished."

---

## 2. P0 — fix before claiming "polished + accessible"

### P0-A · Status signal is silently invisible in the header cap + IdleCard  🔁 *cross-validated ×2 + self-verified*
- **What:** `.status-badge` has **no CSS rule** — it exists only in comments ("reuses .status-badge", `terminal-area.css:175,362`). Bare `.status-dot` is styled **only** under `.sidebar-row .row-secondary` (`sidebar.css:156`), so the badge in `IdentityHeader.tsx:89,93` and `IdleCard.tsx:60,64` gets nothing. The inline `--accent` color (`IdentityHeader.tsx:90`, `IdleCard.tsx:61`) has no painter in that scope.
- **Why it matters:** The active session's status — the single most prominent status in the app — shows as **colorless run-in text with no dot**. "Waiting for you" (amber) is visually identical to "Running" (blue). The entire `status-colors.ts` `presentation()` ramp (running/finished/idle/error/waiting) dies at the cap. The sidebar row works (it has the scoped rule + a left-edge bar); the header + IdleCard don't.
- **Fix:** Add a shared, **unscoped** `.status-badge` rule (pill: padding, `border-radius: 999px`, tinted bg) + a bare `.status-dot` rule (8px round, `background: var(--accent)`). ~15 lines of CSS resurrects the whole signal system.

### P0-B · Three WCAG-AA contrast failures in the token foundation  *(computed oklch→sRGB→WCAG)*
- **White-on-accent-blue CTAs = 3.62:1** (need 4.5) — the highest-emphasis buttons: Save `form.css:110`, Start/Create `terminal-area.css:456,547`, `sidebar.css:315`.
- **`--ink-faint` text = 3.11:1 on surface / 2.69 on cream** (`tokens.css:27`) — used for *load-bearing* prose: cwd breadcrumb `terminal-area.css:210`, "not run automatically" helper `:422`, form hints `form.css:428`.
- *(Danger red passes at 4.63 — the failure is specific to the blue + the faint ink.)*
- **Fix:** Darken `--color-accent` to L≈0.55 and `--ink-faint` to L≈0.58. One token pass; no markup change.

### P0-C · Interactive-blue ≡ running-status-blue (semantic collision)  🔁 *cross-validated ×2*
- **What:** `--color-accent` (clickable) **===** `--accent-running` (status) — same oklch (`tokens.css:40,46`). Focus rings, Start ▶, drag outline, *and* the "running" dot are all the identical blue.
- **Why it matters:** Color can't tell the user "this is clickable" from "this is running." On a terminal manager where running-state is core meaning, that's a real ambiguity.
- **Fix:** Fork `--accent-running` to a distinct hue, or shift the interactive accent. Combines naturally with P0-B's accent darkening — one coordinated color pass solves B + C together.

### P0-D · Keyboard focus is systemically missing  🔁 *cross-validated across all 4 surface audits — this is the 2.8 A11y pillar*
- Sidebar rows are `role="button" tabIndex={0}` (`Sidebar.tsx:229`) but have **no `:focus-visible` ring** (`sidebar.css`) — WCAG 2.4.7 fail on the primary navigation, and Enter-to-switch is a shipped feature.
- The **terminal well** — the primary text-input target — has **no focus affordance** (`terminal-area.css:85,119`; `term.focus()` at `SessionView.tsx:646`). Every button has a ring; the main input surface doesn't.
- **No focus-trap in any modal** — Tab escapes the `aria-modal="true"` dialog to the background app (`ConfirmModal.tsx:36`, `SessionEditModal.tsx:120`, `PreferencesModal.tsx:50`, `RestartApplyPrompt.tsx:41`).
- `ContextMenu` `role="menu"` doesn't contain Tab / has no Home-End (`ContextMenu.tsx:93`).
- cwd error not programmatically tied to its field — no `aria-invalid`/`aria-describedby`/`role="alert"` (`SessionEditModal.tsx:297`).
- **Fix:** A focus-ring pass (rows + well) + one shared `<Modal>` focus-trap (the 4 modals already hand-copy the same skeleton) + ContextMenu Tab containment + the cwd `aria` wiring. **Biggest single quality lever in the app.**

### P0-E · SearchBar prev/next look live but no-op at 0 matches  *(lightest P0)*
- **What:** No `:disabled` state — the controls are clickable and silently do nothing when `count===0` (`SearchBar.tsx:201-209`; no `:disabled` rule in `terminal.css:105-131`).
- **Fix:** Set `disabled` when count is 0 + add `.search-control:disabled` styling.

---

## 3. P1 — real quality gaps

| # | Finding | Where | Fix |
|---|---|---|---|
| 1 | `--space-*` defined-not-applied: ~25 raw spacing literals bypass the scale (worst: terminal-area 12, sidebar 8, SearchBar) | `terminal-area.css:351-353,386-388`; `sidebar.css:9,12,396-398,423,436`; `terminal.css:49-59` | Migrate literals → scale steps (this *is* the deferred Phase 10-13 polish debt; `form.css` is already 100% migrated — proof it works) |
| 2 | xterm `TERMINAL_THEME` hex mirror diverges: `foreground:#d8dfe6` ≠ `--term-text`; **no ANSI palette** → program red/blue uncoordinated with `--color-danger`/`--color-accent` | `SessionView.tsx:54-58` | Define a coordinated ANSI palette; document the JS-mirror-vs-token boundary |
| 3 | Two dead tokens never consumed (`--term-text`/`--term-faint`, 0 hits); terminal fg is a literal | `tokens.css:35-36` ↔ `SessionView.tsx:56` | Either route the tokens into TERMINAL_THEME or delete them (drift trap) |
| 4 | IdentityHeader icon unsized — `.identity-header .row-icon` undefined | `IdentityHeader.tsx:80` | Add the icon-tile rule so the cap glyph matches the row icon |
| 5 | Terminal-card top rhythm hole after the StatusSummary pill strip was removed — breadcrumb floats unanchored (no layout scar, but a rhythm gap + stale comments) | `terminal-area.css:25,37,63`; `SessionManager.tsx:638` | Re-tune the header→well top gap; clean stale comments |
| 6 | Permanent **Delete** and reversible **Remove** styled identically (same danger red) — destructive weight is copy-only | `form.css:87-101`; `SessionManager.tsx:712` | Make the more-destructive Delete more strongly marked |
| 7 | Modal backdrop-click guard inconsistent — only the edit modal has the mousedown-origin guard; other 3 dismiss on naive click | `SessionEditModal.tsx:193` vs `ConfirmModal.tsx:53`, `PreferencesModal.tsx:74`, `RestartApplyPrompt.tsx:61` | Move the guard into the shared Modal |
| 8 | No focus restoration on modal close (focus dumped to `<body>`) | all 4 modals | Restore focus to the opener (shared Modal) |
| 9 | SearchBar overlay occludes the first/freshest terminal output lines | `terminal.css:47-62` + `terminal-area.css:75-110` | Inset the live tail when search is open, or reposition the bar |
| 10 | No separator before destructive Remove/Delete in the context menu | `SessionManager.tsx:721-754` + `form.css:127-174` | Add a divider above destructive items |
| 11 | Match-count not `tabular-nums` → cluster width jitters while paging | `SearchBar.tsx:271` + `terminal.css:88` | `font-variant-numeric: tabular-nums` |
| 12 | Type-scale sprawl: 12 distinct font-sizes (≤4 target); hardcoded 17/13/14/12px, no `--text-*` token | foundation-wide; `form.css:44,52,67,312` | Establish a named `--text-*` scale, collapse to 4–5 steps |

---

## 4. P2 / upgrade opportunities (beyond fixing)

- **Establish a `--text-*` type scale** — collapse 12 sizes into 4–5 named steps; biggest single typography upgrade.
- **Design the xterm ANSI palette** — make the terminal's 16 colors a deliberate, coordinated extension of the brand (accent/danger), not the xterm default.
- **Elevate the status signal language** — once the badge renders (P0-A), make the 5-state ramp legible + color-blind-safe (dot *shape*/icon, not color alone).
- **A designed first-run / empty moment** — `WelcomeEmptyState` is currently a bare fallback; it's the first thing a new user sees.
- **Subtle, compositor-friendly motion** — status transitions, row reorder, modal enter/exit (currently minimal; `--duration-fast`/`--ease-standard` already exist).
- **Reconcile the two radius systems** — legacy `--radius:18px` is a *deliberate, consistently-used* card radius (foundation confirmed) — keep the value, rename it `--radius-card` and fold into the documented scale.

---

## 5. Recommended upgrade plan (you pick — each wave is independently shippable, ordered by leverage ÷ risk)

| Wave | What | Clears | Risk | Suggested GSD route |
|---|---|---|---|---|
| **1 · Foundation token pass** | Darken `--color-accent` + `--ink-faint`; fork `--accent-running`; **write the missing `.status-badge`/`.status-dot` rule**; rename `--radius`→`--radius-card` | **P0-A, P0-B, P0-C** + 1 P1 | **Low** (mostly `tokens.css` + 1 CSS rule) | `/gsd-quick` or a tight `/gsd-ui-phase` |
| **2 · Keyboard/focus a11y pass** | focus-visible rings (rows + well); shared `<Modal>` focus-trap + focus-restore + backdrop guard; ContextMenu Tab containment; search disabled state; cwd `aria` wiring | **P0-D, P0-E** + P1 #7,#8 | Low–Med | `/gsd-ui-phase` (a11y) |
| **3 · Rhythm + type scale** | Migrate ~25 spacing literals → `--space-*`; establish `--text-*` scale (12→5 sizes) | P1 #1, #12 | Low | the deferred Phase 10-13 polish, finished |
| **4 · Flagship polish (optional)** | Coordinated xterm ANSI palette; elevated status signal; designed empty state; subtle motion | P1 #2,#3 + all P2 | Med | `/gsd-ui-phase` + `uiux` taste pass |

**If you do only one thing: run Wave 1.** It's almost all `tokens.css`, carries the least regression risk, and clears three of the four *visible* P0s in a single coordinated color/CSS pass.

> All four waves are visual changes to a shipped product → each should go through a GSD UI phase with a human visual sign-off (and the `ui-lab` harness for screenshots), per the project's own Phase 10-13 discipline. The UIUX orchestrator stays advisory here — it didn't install a gate.

---

## 6. Detail reports (per surface)

- `.planning/design/audit/00-foundation.md` — tokens, contrast table, full token-leak map
- `.planning/design/audit/sidebar.md` — session-list rail + IdentityHeader + IconPicker
- `.planning/design/audit/terminal.md` — terminal card/well + IdleCard + Welcome + xterm theme
- `.planning/design/audit/modals.md` — 4 modals + forms + cross-modal consistency matrix
- `.planning/design/audit/overlays.md` — SearchBar + ContextMenu

*Audit method: 5 independent opus auditors read ~5,600 lines of renderer code against a 6-pillar rubric + the token truth + WCAG math; findings cross-validated where ≥2 agents converged; the headline P0 was independently re-verified by grep. Code-based audit (no live screenshots) — the "max" tier adds real renders via the ui-lab harness if you want a true-visual second pass.*
