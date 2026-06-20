# Modals & Forms — Design Audit

Scope: `SessionEditModal.tsx`, `PreferencesModal.tsx`, `ConfirmModal.tsx`, `RestartApplyPrompt.tsx`, `form.css`, `validate-session-form.ts`, `confirm-copy.ts`. Read-only audit; every claim cites `file:line`. Checked against `src/renderer/tokens.css` truth.

## Pillar scores

| Pillar | Score /5 | Verdict |
|---|---|---|
| 1. Hierarchy | 4 | Strong constructive-vs-destructive ramp split (blue Save / red Confirm); title→subhead→label→hint cascade reads well. Loses a point: identity `<span class="edit-label">Icon</span>` is a label that points at nothing; modal width inconsistency (420 vs 460) is unmotivated. |
| 2. Spacing & Rhythm | 4 | Fully migrated onto `--space-*` in form.css — genuinely disciplined. Loses a point for residual hardcoded literals (`min-width:140px`, `padding:7px var(--space-3)` on context-menu-item, tile px) and the `--font-mono` token never reaching path inputs. |
| 3. Color & Semantics | 4 | Danger spent only on real errors; calm faint-ink hints; blue reserved for constructive primary. Loses a point: Delete (permanent) and Remove (reversible) share the *identical* red — destructive proportionality is carried entirely by copy, not color/weight. |
| 4. Typography | 3 | Nunito throughout, case/weight hierarchy is deliberate. But font sizes are raw px literals (`17px` title, `13px` body, `14px` btn/input, `12px` label) with no type-scale token, and path/shell inputs render in Nunito where `--font-mono` is the stated intent. |
| 5. States & Interaction | 3 | Token-based blue `:focus-visible` ring is consistent and real; hover ramps present. But cwd error has **no programmatic association** (no `aria-invalid`, no `aria-describedby`, no error border on the field), and the cwd-drop notice has **no visible dismiss affordance**. |
| 6. Consistency & Accessibility | 2 | **P0**: no focus-trap in any of the 4 modals — Tab escapes to the background app while a scrim-blocked dialog is "modal". No focus-restore on close. ConfirmModal/RestartApplyPrompt close on a naive single `onClick` (no mousedown-origin guard the edit modal added). Chrome is otherwise shared. |

## Findings

### [P0] No focus-trap in any modal — Tab leaves the dialog while it claims `aria-modal`
- Pillar 6 · `ConfirmModal.tsx:36-47`, `SessionEditModal.tsx:120-131`, `PreferencesModal.tsx:50-62`, `RestartApplyPrompt.tsx:41-52`
- What: every modal sets `role="dialog" aria-modal="true"` and focuses one element on open, but none contains Tab/Shift+Tab. A keyboard user tabbing past the last button lands on focusable elements in the dimmed app behind the scrim (sidebar rows, terminal buttons). No `keydown` handler intercepts `Tab`; the only key wired is `Escape`.
- Why it matters: `aria-modal="true"` is a promise to assistive tech that focus is contained. Breaking it is a WCAG 2.4.3 / 2.1.2 (keyboard trap inverse) failure and lets a user blindly interact with controls they can't see. For a destructive ConfirmModal this means Tab can reach app controls mid-confirmation.
- Fix: add a shared focus-trap (cycle Tab within the dialog's focusable set; wrap last→first and first→last on Shift+Tab). Factor it into one hook reused by all four — they already copy the same skeleton.

### [P0] cwd error is not programmatically associated with its field
- Pillar 5/6 · `SessionEditModal.tsx:297-303` (notice), `267-280` (input), `form.css:420-433`
- What: the cwd `<input>` (`edit-cwd`) carries no `aria-invalid` and no `aria-describedby` pointing at the error `<span>`. The notice is a plain sibling `<span class="edit-field-notice--error">`, not a `role="alert"`/`aria-live` region, so it is neither announced when it appears nor tied to the field for a screen reader. Visually the input border is unchanged on error — only the helper text turns red.
- Why it matters: the brief's own P0 bar ("missing error association"). A screen-reader user focused on the cwd field on a "Working directory not found" rejection gets no signal the field is in error; a sighted user gets only sub-text red, no field-level error border. The cwd-drop case (`cwdDropNotice`) is the freshest, most important signal and is the worst hit.
- Fix: on `cwdNotice.tone==='error'` set `aria-invalid="true"` + `aria-describedby={noticeId}` on the input, give the notice `id={noticeId}` and `role="alert"`, and add an `.edit-input` error-border modifier (`border-color: var(--color-danger)`).

### [P1] Delete (permanent) and Remove (reversible) are styled identically — destructive weight is copy-only
- Pillar 3 · `form.css:87-101` (single `.modal-btn-confirm` red), `SessionManager.tsx:712` (`confirmLabel` Delete vs Remove), `confirm-copy.ts:45-51`
- What: both the permanent **Delete** (wipes the saved recipe) and the recoverable **Remove** (keeps recipe, retires to Inactive List) render through the *same* `.modal-btn-confirm` using `--color-danger`. The only differentiator is the button word and the body sentence. The more-destructive action is not more strongly marked.
- Why it matters: the brief explicitly flags "destructive action under-marked" as P0-adjacent. Delete is irreversible; it should outweigh Remove visually, not just lexically — users pattern-match on color/shape, and these are identical.
- Fix: reserve `--color-danger-strong` (already a token, `tokens.css:43`) as the *fill* for permanent Delete (not just its hover), keeping Remove on the lighter `--color-danger`; or add an outline/weight bump for Delete. Copy is good; give color a job too.

### [P1] Inconsistent backdrop-click guard across the four modals
- Pillar 6 · `SessionEditModal.tsx:193-201` (guarded) vs `ConfirmModal.tsx:53-57`, `PreferencesModal.tsx:74`, `RestartApplyPrompt.tsx:61` (naive `onClick={onCancel}`)
- What: SessionEditModal correctly guards backdrop dismissal with a mousedown-origin ref (GAP-12-D — a text-selection drag that ends on the overlay no longer closes it). The other three close on a bare overlay `onClick`, so a drag-select that releases over the scrim, or a click that began inside and ended outside, dismisses them.
- Why it matters: ConfirmModal is destructive and PreferencesModal/RestartApplyPrompt are losable-state — an accidental drag-overshoot dismiss is exactly the gesture the edit modal was hardened against. The fix already exists in the codebase and isn't shared.
- Fix: lift the `overlayMouseDownRef` mousedown/click pattern into the shared modal skeleton so all four dismiss identically (and safely).

### [P1] No focus restoration when any modal closes
- Pillar 6 · `ConfirmModal.tsx:36-47`, `SessionEditModal.tsx:120-131`, `PreferencesModal.tsx:50-62`, `RestartApplyPrompt.tsx:41-52`
- What: each modal focuses an element on open but none captures the previously-focused element and restores it on close. After Esc/confirm/cancel, focus is lost to `<body>`.
- Why it matters: WCAG 2.4.3 focus order — a keyboard user who opened the dialog from a sidebar row's context menu is dumped to the top of the document on close instead of returning to that row, breaking flow.
- Fix: in the shared skeleton, snapshot `document.activeElement` on open and `.focus()` it on unmount/close.

### [P1] Token drift: hard-coded font sizes with no type-scale token
- Pillar 4 · `form.css:44` (`17px`), `:52` (`13px`), `:67`/`:325`/`:387` (`14px`), `:312`/`:402`/`:424` (`12px`)
- What: every type size in the modal/form layer is a raw px literal. tokens.css defines space/radius/shadow/motion/color tokens but **no `--text-*` scale**, so these sizes can't be governed and silently diverge surface-to-surface.
- Why it matters: the file header (`form.css:11-13`) claims "references them via var() ONLY … permitted literals are element dimensions and the single #ffffff" — font-size literals violate the stated tokens-first contract and aren't caught by `tokens-completeness.test.ts`.
- Fix: add a `--text-xs/sm/md/lg` scale to tokens.css (12/13/14/17 already cluster cleanly) and replace the literals.

### [P2] Path/shell inputs render in Nunito, not the mono font the design intends
- Pillar 4 · `form.css:315-325` (`.edit-input` → `font-family: inherit` = Nunito), `:377-387` (`.edit-select`), tokens.css:79 (`--font-mono`)
- What: the cwd `Working directory` input, the shell `<select>`, and the startup-command input all inherit `--font-ui` (Nunito). `--font-mono` (JetBrains Mono) is defined and is the natural choice for filesystem paths / shell paths / commands where character alignment and `l`/`1`/`I` disambiguation matter.
- Why it matters: paths and commands are the one place proportional type actively hurts legibility; the design system already ships the right token, unused here.
- Fix: apply `font-family: var(--font-mono)` to the cwd input, shell select, and startup-command input (keep Name in Nunito).

### [P2] cwd-drop notice has no discoverable dismissal
- Pillar 5 · `SessionEditModal.tsx:182-187`, `:274-279` (cleared only by typing in cwd)
- What: the `cwdDropNotice` (modal held open after main rejected the submitted dir) clears *only* when the user edits the cwd field (`onClearCwdDropNotice` on change) or via Browse. There is no ×/dismiss and no copy telling the user how to clear it — discoverability rests on the user guessing that editing dismisses it.
- Why it matters: the brief asks specifically whether "the notice dismissal is discoverable." It isn't — a user who reads the notice but doesn't re-edit cwd has a persistent red they can't obviously clear.
- Fix: the notice copy is fine; add one calm sub-clause ("…edit the path to dismiss") or a small inline dismiss control.

### [P2] `<span class="edit-label">Icon</span>` is a label bound to nothing
- Pillar 1/6 · `SessionEditModal.tsx:243-244`
- What: the Icon group uses a `<span>` styled as `.edit-label` (not a `<label htmlFor>`), sitting above the `IconPicker`. Every other field uses a real `<label htmlFor>`. The IconPicker's own groups are `role="group"` with `aria-label` (`IconPicker.tsx:45,73`), so the visible "Icon" caption is decorative-only and not associated.
- Why it matters: minor inconsistency in the label model; a screen reader hears the picker's own group labels but the visible "Icon" heading is orphaned.
- Fix: make it an `aria-hidden` heading or wire it as the picker's labelling element; low stakes but tidy.

### [P2] Modal width differs without rationale (420 vs 460)
- Pillar 1 · `form.css:31` (`.modal-dialog` 420px), `:297` (`.modal-dialog-edit` 460px)
- What: Confirm/Preferences/Restart use `min(420px, …)`; the edit modal overrides to `min(460px, …)`. The wider edit modal is defensible (more fields) but the value is a bare literal with no shared token, so the family reads as two arbitrary widths.
- Why it matters: cosmetic consistency; not wrong, but ungoverned.
- Fix: tokenize as `--modal-w` / `--modal-w-wide` if more sizes appear; otherwise leave with a comment.

## Cross-modal consistency matrix

| Modal | radius | shadow | scrim | title | button-order | primary-style |
|---|---|---|---|---|---|---|
| ConfirmModal | `--radius` 18 ✓ | `--shadow-dialog` ✓ | `--scrim` ✓ | `.modal-title` 17/700 ✓ | Cancel → **Confirm** ✓ | red `.modal-btn-confirm` (destructive) |
| SessionEditModal | `--radius` 18 ✓ | `--shadow-dialog` ✓ | `--scrim` ✓ | `.modal-title` ✓ | Cancel → **Save changes** ✓ | blue `.modal-btn-save` (constructive) |
| RestartApplyPrompt | `--radius` 18 ✓ | `--shadow-dialog` ✓ | `--scrim` ✓ | `.modal-title` ✓ | Later → **Restart now** ✓ | blue `.modal-btn-save` (constructive) |
| PreferencesModal | `--radius` 18 ✓ | `--shadow-dialog` ✓ | `--scrim` ✓ | `.modal-title` ✓ | **Done** only (single) | neutral `.modal-btn-cancel` only |

**Chrome divergences (all 4 share radius/shadow/scrim/title/button-order/primary-ramp — strong):**
1. **Backdrop-dismiss guard**: only SessionEditModal has the mousedown-origin guard (`SessionEditModal.tsx:193-201`); the other 3 use naive `onClick` (P1 above).
2. **Width**: edit = 460, others = 420 (`form.css:31` vs `:297`).
3. **Initial focus target differs by intent** (acceptable): Confirm/Restart focus the *primary* (`ConfirmModal.tsx:42`, `RestartApplyPrompt.tsx:43`); Edit focuses the *first field name* (`SessionEditModal.tsx:121`); Prefs focuses + selects the input (`PreferencesModal.tsx:52-53`). Consistent rule ("focus the primary affordance") — fine.
4. **PreferencesModal has no primary-action ramp** — its "Done" is the neutral cancel style (`PreferencesModal.tsx:123-130`). Correct for a no-commit live-apply surface, but means the 4th modal has no blue/red primary, an intentional asymmetry worth noting.

## Token drift vs truth

| Literal | file:line | Correct token / status |
|---|---|---|
| `font-size: 17px` (title) | `form.css:44` | No `--text-*` token exists → add `--text-lg: 17px`. P1. |
| `font-size: 13px` (body) | `form.css:52` | add `--text-sm: 13px`. P1. |
| `font-size: 14px` (btn/input/select/browse) | `form.css:67,325,387,355` | add `--text-md: 14px`. P1. |
| `font-size: 12px` (label/subhead/notice) | `form.css:312,402,424` | add `--text-xs: 12px`. P1. |
| `font-family: inherit` on path/shell inputs | `form.css:323,385` | should be `var(--font-mono)` (token exists, unused). P2. |
| `padding: 7px var(--space-3)` (context-menu-item) | `form.css:144` | 7px off-scale; nearest `--space-2` (8) per tokens.css:96 retune note. P2. |
| `min-width: 140px` (context-menu) | `form.css:129` | element dimension — permitted literal per header; acceptable. |
| `width: min(420px…)` / `min(460px…)` | `form.css:31,297` | element dimension — permitted, but ungoverned (P2 above). |
| `#ffffff` button text | `form.css:90,110` | permitted single literal per header contract ✓ — not drift. |
| tile sizes `28px/26px/16px` etc. | `form.css:196-198,259-264` | element dimensions — permitted ✓. |

No **color** drift found — all colors route through `var(--color-*)`/`--ink*`/`--line*`/`--scrim`. Radius/shadow/motion all tokenized. Drift is confined to the type scale (no token home) + the unused mono font.

## Upgrade opportunities

1. **Extract a `<Modal>` skeleton component.** Four files hand-copy overlay+dialog+Esc+focus-on-open. Lifting it into one component would (a) close the focus-trap P0 once, (b) make backdrop-guard + focus-restore uniform, (c) delete ~40 duplicated lines. Highest leverage fix.
2. **Field-level error state, not just sub-text.** Add an `.edit-input--error` border (`var(--color-danger)`) + `aria-invalid` + `role="alert"` notice so errors are felt at the field, satisfy WCAG, and match the danger ramp the rest of the system uses.
3. **Mono path/shell/command inputs.** One-line win using the already-shipped `--font-mono` — meaningfully better legibility for the app's core value (paths to coding-agent projects).
4. **Proportional destructive marking.** Give permanent Delete a heavier red (`--color-danger-strong` fill) than reversible Remove so the visual weight tracks reversibility, not just the verb.
5. **Type-scale tokens.** Add `--text-xs/sm/md/lg` to tokens.css and migrate form.css off the 4 px literals — completes the tokens-first contract the file header already claims and lets `tokens-completeness.test.ts` guard it.
