# Phase 12: Session Form — Polish + Edit UX - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

> **Scope-reality note (read first):** A code scout during discussion found that **SESS-05
> (edit-modal prefill) and SESS-06 (Browse… folder picker) are already implemented in code**,
> shipped during Phase 6 (06-01/06-02) AFTER the 2026-06-06 Phase-05.1 human-verify that logged
> the two pending todos. The operator last saw them broken *before* that fix. Phase 12 is
> therefore **~90% UI-04 form visual polish** (compose the form onto the locked chassis, like
> Phase 11 did for the terminal area) **+ live-verify/finish the two SESS round-trips** — NOT a
> greenfield build of the picker or the hydration. Evidence is cited inline in `<decisions>` and
> `<code_context>`. Operator confirmed this re-scope during discuss ("对:打磨 + 验证走").

<domain>
## Phase Boundary

One renderer-weighted surface — the **create/edit session form** (today `SessionEditModal.tsx`)
— composed onto the LOCKED Phase-9/10/11 token system (`src/renderer/tokens.css`, the Switchboard
"warm cozy parlour" direction — DESIGN.md). Three threads:

1. **UI-04 — form visual polish (the headline, ~90% of the phase).** The form is today a raw
   stack of `.edit-field` inputs. This phase makes it read as **one cohesive designed surface**:
   grouped fields with clear section structure, a designed icon/color picker, and inline
   validation feedback — composed from the locked tokens, mirroring how Phase 11 framed the
   terminal area.

2. **SESS-05 — edit-modal prefill (verify + finish; already built).** `rehydrateProfiles()`
   (`SessionManager.tsx:388-405`) already re-reads `listSessions()` and merges main's authoritative
   `cwd`/`shell`/`startupCommand` back into the renderer rows after spawn (`onAdd:452`) and after
   save (`handleSaveProfile:423`); the modal already seeds from the record (`SessionEditModal.tsx:68-75`).
   This phase **verifies the round-trip works live** and closes any residual gap (notably the
   first-open default-cwd display, Open Q O-1).

3. **SESS-06 — Browse… folder picker (verify; already built).** Main owns the native dialog
   (`src/main/index.ts:178` → `dialog.showOpenDialog({ properties: ['openDirectory'] })`), the
   `pickDirectory` bridge key exists (the 19th key; `EXPECTED_API_KEYS` already 20), and the modal
   has the Browse… button (`SessionEditModal.tsx:194-205`). This phase **verifies it live** and
   styles the button as part of the UI-04 polish.

**Requirements:** UI-04 (form visual polish) + SESS-05 (edit prefill) + SESS-06 (folder picker).

**Explicitly NOT in this phase:**
- Real icon-system replacement (swap emoji glyphs for an icon font/SVG set) → backlog.
- A create-first form (form → then spawn). Phase 4 D-01 locks instant-spawn-then-edit (D-05 below).
- A live `validatePath` existence-probe IPC (D-04 below — keeps `EXPECTED_API_KEYS` at 20).
- Empty/loading/error-state design (UI-05) + app-wide hover/focus/active consistency (UI-06) → Phase 13.
- App-wide animation/motion system → Phase 13 / standalone.
- Design-token / font / palette re-decision (Phase 9, locked). Sidebar (Phase 10) + terminal area (Phase 11) — done.

</domain>

<decisions>
## Implementation Decisions

### Scope framing
- **D-01: Phase 12 = UI-04 polish + verify-and-finish SESS-05/06, NOT greenfield.** The picker and
  the prefill hydration are already in the codebase (Phase 6). The planner MUST treat SESS-05/06 as
  *verify the live round-trip + close residual gaps*, not as new builds. The headline deliverable is
  the form's visual composition onto the locked chassis. (Operator-confirmed re-scope.)

### Form layout & grouping (Area A)
- **D-02: Two semantic groups, single column.** Group the fields into **Identity** (Name +
  Icon/color) and **Launch / "Applies on restart"** (Working directory + Browse…, Shell, Startup
  command), each with a section subhead + a hairline divider, in a **single column**. The grouping
  boundary REUSES the existing Phase-4 live-vs-restart split (Phase-4 D-02: name/icon apply live;
  cwd/shell/startup apply on restart) — so the structure mirrors the data model the user already
  experiences. Single column (not two-column) keeps the modal narrow and small-laptop-friendly.

### Icon/color picker (Area B)
- **D-03: Polish the EXISTING emoji + color picker into a designed grid/popover.** Keep the current
  `SessionIconSpec` (`emoji | color`) model and `IconPicker.tsx`; turn the picker into a proper
  designed control — an emoji grid + a color-swatch row with hover/selected states from the tokens.
  Do **NOT** build a new "real icon system" (icon font/SVG glyph set) — that is explicitly backlog.
  UI-04's "real icon/color picker" is satisfied by a real *picker UI*, not new glyphs.

### Inline validation (Area C)
- **D-04: Lightweight inline validation; main stays the validator of record; 0 new IPC.** Inline,
  cheap, renderer-only checks: empty-name → "keeps current name" hint (Phase-4 discretion preserved);
  Working-directory → format/absolute-path hint; Startup command → optional. On Save/Start, surface
  **main's existing** "Working directory not found" rejection (CR-01 guard, `pty-manager.ts:298-314`)
  **inline in the form** instead of only as the post-Start error card. **NO `validatePath`
  existence-probe IPC** — directory existence is already functionally guaranteed by main's CR-01
  guard regardless of the form, and Browse… already returns only existing dirs, so a new channel
  would duplicate the guard and dent the budget. `EXPECTED_API_KEYS` STAYS 20 (SC4 green). Main
  remains the validator of record (SC3).

### Create vs edit framing (Area D)
- **D-05: Keep edit-only (instant-spawn-then-edit); the polished Edit modal IS the UI-04 form.**
  Phase 4 D-01 locked "no create-first path — `+ Add` instant-spawns a live session, Edit customizes
  it." That stays. UI-04's "create/edit session form" wording is satisfied by making the single Edit
  modal the cohesive designed surface. No create-first form is introduced (it would reverse D-01 and
  is its own phase if ever wanted).

### Hard constraints (carried / locked)
- **Visual direction is LOCKED** (Switchboard — DESIGN.md). Compose from `tokens.css`; do not
  re-decide palette/type/radius/direction. Tokens-first rule (guarded by `tokens-completeness.test.ts`).
- **`EXPECTED_API_KEYS` stays 20.** No new bridge key (D-04). `pickDirectory` + `listSessions` +
  `ptyUpdateProfile` are reused; `security.guard` invariant must stay GREEN.
- **Terminal fidelity untouched.** The form is a modal — renderer-only, no xterm/PTY/fit path
  touched. Fidelity is safe by construction, but the suite (incl. the fidelity smokes) must stay GREEN.
- **CR-01 cwd guard stays the validator of record** (SC3). The form pre-checks are convenience only.
- **ui-lab harness is MANDATORY** (Phases 10-13 protocol): tagged before/after captures, live-CSS
  preview for CSS-only tweaks, **packaged no-injection capture as proof**, DESIGN-RUBRIC scoring, and
  a **BLOCKING end-of-phase human-verify** for the visual SC. No visual claim without a capture. The
  form/edit-modal needs a ui-lab surface (O-3).

### Claude's Discretion
- Exact section-subhead styling, divider treatment, and inter-field spacing rhythm (from `--space-*`)
  — tuned in the ui-lab look→edit→re-look loop against DESIGN-RUBRIC.md.
- Exact picker geometry (grid column count, inline vs popover, swatch size/shape) — tuned in ui-lab.
- Inline-validation visual treatment (red helper text under the field vs disabled-Save vs both),
  composed from the `--color-danger` ramp per the Phase-10 D-15 danger precedent.
- Whether to extract the form/modal CSS into its own `form.css` (vs the existing modal/terminal CSS)
  — planner's call, counts toward the <800-line file discipline.
- For SESS-05 O-1: whether a brand-new session's first edit-open shows main's resolved home cwd vs an
  empty field — verify both live and pick the clearer behavior.

### Folded Todos
- **`2026-06-06-edit-modal-does-not-prefill-saved-cwd-and-startup-command.md`** (SESS-05,
  `resolves_phase: 12`) — folded as **verify-and-close**. Root cause (renderer record minted with
  `cwd: ''`, not refreshed after save) was addressed in Phase 6 via `rehydrateProfiles()`. Phase 12
  confirms the live round-trip and closes the todo.
- **`2026-06-06-add-folder-picker-for-working-directory-selection.md`** (SESS-06,
  `resolves_phase: 12`) — folded as **verify-and-close**. The todo's "Solution sketch" (add a new
  `pickDirectory` IPC key) is STALE — the key + handler + Browse… button already exist. Phase 12
  verifies live + styles the button; **no new bridge key** (D-04).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, ui-researcher, planner) MUST read these before planning or implementing.**

### Visual authority (locked — do not re-decide)
- `.planning/DESIGN.md` — warm-parlour direction, the design tokens, the modal/form component
  inventory; the radius/shadow/spacing scale Phase 12 composes from.
- `src/renderer/tokens.css` — the single token source: `--space-*`, `--accent-*`, `--radius-*`,
  `--shadow-*`, `--color-danger`, `--font-*`. Any value that can live here must (tokens-first rule).
- `.planning/design/switchboard-mockup.html` — source mockup (reference only).

### Phase intent + requirements
- `.planning/ROADMAP.md` §"Phase 12: Session Form — Polish + Edit UX" — goal + 4 success criteria.
- `.planning/REQUIREMENTS.md` — UI-04, SESS-05, SESS-06 (and SESS-07 done-context for the lifecycle vocabulary).

### Precedent — how Phase 11/10 composed the locked tokens onto a surface (MIRROR the method)
- `.planning/phases/11-terminal-area-polish-live-start-restart/11-CONTEXT.md` — the unified-card
  framing method, the ui-lab verification protocol, the renderer-only/keep-alive discipline, the
  `--color-danger` danger-ramp usage, the selector-contract (frozen-or-update-in-lockstep) rule.
- `.planning/phases/10-sidebar-visual-polish/10-UI-SPEC.md` — the token-application contract shape,
  the control vocabulary, the `data-testid` selector contract, the ui-lab protocol.
- `.planning/phases/10-sidebar-visual-polish/10-CONTEXT.md` — D-15 Remove-in-danger-ramp precedent;
  the "calm low-contrast chrome, spend color only where it matters" north star.

### Verification harness (MANDATORY protocol — Phases 10-13)
- `tests/ui-lab/README.md` — the self-evolve loop + hard rules (no claim without capture; injection
  is preview, packaged is proof; tokens first; suite stays green).
- `tests/ui-lab/DESIGN-RUBRIC.md` — the screenshot-checkable expectations captures are scored on.
- `tests/ui-lab/surfaces.ts` — the surface registry (extend for an edit-modal / validation-error capture, O-3).

### Code being changed / verified (full paths)
- `src/renderer/SessionEditModal.tsx` — the form: re-seed effect (68-75), Browse… button (194-205,
  SESS-06 done), shell `<select>`, the `.edit-field`/`.edit-restart-group` structure (the D-02 regroup
  + D-03 picker + D-04 validation land here).
- `src/renderer/IconPicker.tsx` — the emoji + color-initial picker (D-03 polish target).
- `src/renderer/session-edit.ts` — the pure `splitEdit` live-vs-restart reducer (reused; the D-02 grouping boundary).
- `src/renderer/SessionManager.tsx` — `rehydrateProfiles()` (388-405, SESS-05 hydration), `handleSaveProfile`
  (407-426), `onAdd` hydrate (436-454), the modal wiring (`onSaveLive`/`onSaveProfile`/`onCancel`, ~775-785).
- `src/renderer/ConfirmModal.tsx` — the overlay/scrim/Esc/focus a11y skeleton the edit modal copies.
- `src/main/index.ts` — `ipcMain.handle('dialog:pick-directory', …)` (175-181, SESS-06 handler, DONE).
- `src/main/pty-manager.ts` — `create()` cwd CR-01 guard (~298-314, the validator of record — SC3);
  `listSessions()` return shape + `updateProfile` persist (the SESS-05 truth source).
- `src/main/window-config.ts` — `EXPECTED_API_KEYS` = 20 + the bridge-key list (confirm it stays 20 — SC4).
- The form/modal CSS — the `.modal-dialog-edit` / `.edit-field` / `.edit-label` / `.edit-input` /
  `.edit-select` / `.edit-cwd-row` / `.edit-browse-button` / `.applies-on-restart-hint` rules
  (currently in the modal/terminal CSS; candidate for extraction to `form.css` — planner's call).

### Folded todos (full paths)
- `.planning/todos/pending/2026-06-06-edit-modal-does-not-prefill-saved-cwd-and-startup-command.md`
- `.planning/todos/pending/2026-06-06-add-folder-picker-for-working-directory-selection.md`

### Open questions for research/planning
- **O-1 (SESS-05 first-open default cwd):** After `onAdd`, main resolves an unspecified cwd to
  `os.homedir()` (`pty-manager.ts:314`). Confirm live what the FIRST edit-open shows in the
  Working-directory field (resolved home path vs empty) and decide the clearer behavior. The
  edit→save→reopen case is already handled by `rehydrateProfiles()`; verify it end-to-end.
- **O-2 (SESS-06 live):** Confirm Browse… works end-to-end on the **packaged** app (native dialog →
  fills the field → CR-01 still gates at Start). It is wired; needs a live proof, not just unit green.
- **O-3 (ui-lab surface):** Add the edit-modal (and a validation-error state) to
  `tests/ui-lab/surfaces.ts` so the UI-04 visual SC has a capture to score against.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SessionEditModal.tsx`** — the form already exists with the Browse… button (SESS-06) and the
  record re-seed effect (SESS-05 modal side). Phase 12 RESTRUCTURES it (grouping/picker/validation),
  it does not build it from scratch.
- **`rehydrateProfiles()`** (`SessionManager.tsx:388-405`) — the SESS-05 main→renderer hydration,
  already called after spawn and after save. The SESS-05 fix is *this function working live*.
- **`pickDirectory` bridge + `dialog:pick-directory` handler** — the SESS-06 plumbing, already done;
  reused, not re-added (no new key — D-04).
- **`IconPicker.tsx`** — the emoji + color-initial model (`SessionIconSpec`) to polish into the D-03 picker.
- **`splitEdit` (`session-edit.ts`)** — the pure live-vs-restart reducer; the D-02 grouping mirrors it.
- **`ConfirmModal.tsx` skeleton** (overlay/scrim/Esc/focus-on-open) — the edit modal copies it (do NOT generalize it).
- **`tokens.css`** — every visual value (spacing rhythm, divider, danger-red for validation, picker
  swatches) comes from existing tokens; D-02/D-03/D-04 are composition, not new values.

### Established Patterns
- **Tokens-first + guard tests in lockstep:** `tokens-completeness.test.ts` (every `var(--token)`
  resolves; bans literals) + `status-colors.test.ts` stay GREEN; new CSS uses `var()` only.
- **ui-lab loop:** baseline tag → live-CSS preview for CSS-only tweaks → **packaged no-injection
  capture as proof** → DESIGN-RUBRIC scoring. Structural TSX changes (the regroup) require
  `npm run ui:shots:fresh` (injection previews old markup).
- **Selector contract (Rule-1 discipline):** the modal's `data-testid`s — `session-edit-modal`,
  `edit-name`, `edit-cwd`, `browse-cwd`, `edit-shell`, `edit-startup`, `applies-on-restart`,
  `edit-save`, `edit-cancel` — must survive the restructure OR be updated WITH their tests in the
  same plan (the `session-edit` smoke + any ui-lab refs).
- **`EXPECTED_API_KEYS` = 20 invariant** (`security.guard` test) — must stay GREEN (no new key).
- **Renderer-only / fidelity-safe:** the form is a modal; it never touches the xterm/PTY/fit path.

### Integration Points
- `SessionManager.tsx` modal wiring (~775-785): `onSaveLive` (name/icon live), `onSaveProfile`
  (cwd/shell/startup → main + `rehydrateProfiles`), `onCancel`.
- Main truth: `window.api.listSessions()` (SESS-05 re-read), `window.api.ptyUpdateProfile()`
  (persist), `window.api.pickDirectory()` (SESS-06).
- `tests/ui-lab/surfaces.ts`: add the edit-modal capture(s) (O-3).

</code_context>

<specifics>
## Specific Ideas

- **The headline finding (don't lose it):** SESS-05 + SESS-06 were already fixed in Phase 6; the
  operator's "they're broken" memory is from the 2026-06-06 Phase-05.1 checkpoint that PRE-dates the
  fix. Phase 12 must verify them live (so the operator sees they work) and not re-implement them.
- **Method to mirror:** treat the form exactly like Phase 11 treated the terminal area — compose the
  locked warm-parlour tokens into one designed surface, prove it through the ui-lab capture loop, and
  gate on a BLOCKING human-verify. "One cohesive designed surface" is the canonical scan-test for SC1.
- **Validation tone:** calm, helpful, low-contrast chrome; spend the `--color-danger` red only on a
  genuine error (empty/invalid), mirroring the Phase-10/11 "spend color only where it matters" north star.

</specifics>

<deferred>
## Deferred Ideas

- **Real icon system** (replace emoji glyphs with an icon font/SVG set) → backlog (out of scope; D-03 keeps the emoji+color model).
- **Create-first form** (form → then spawn) → its own phase if ever wanted; D-05 keeps edit-only (Phase 4 D-01).
- **`validatePath` live cwd-existence probe IPC** → rejected (D-04); main's CR-01 guard + Browse… already cover it, and it would grow the bridge budget past 20.
- **Empty / loading / error-state design (UI-05) + app-wide hover/focus/active consistency (UI-06)** → Phase 13.
- **App-wide animation / motion system** → Phase 13 / standalone (this phase uses only existing Phase-9 motion tokens for control transitions).

### Reviewed Todos (not folded)
Keyword-matched todos that belong elsewhere (already adjudicated by Phase 11's CONTEXT), reviewed and NOT folded:
- `2026-06-12-replace-emoji-icons-with-real-icons` → **backlog** (D-03 boundary).
- `2026-06-12-define-and-implement-animation-system` → **Phase 13 / standalone**.
- `2026-06-12-agent-aware-close-confirmation` → already folded as copy-only in **Phase 11** (D-04 there); app-quit guard deferred.
- `2026-06-06-address-deferred-code-review-findings-phase-05.1` (DEBT-01) → **Phase 14**.
- `2026-06-09-redo-phase-06.1-code-review-criticals` (DEBT-02) → **Phase 14**.
- `2026-06-12-evaluate-metadata-based-claude-state-capture` → **backlog**.
- `2026-06-12-npm-run-make-lowdb-localstorage-crash` → **separate build todo**.
- `2026-06-11-rebaseline-flaky-smoke-specs-quiet-machine` → **pre-ship testing task** (revisit at ship).

</deferred>

---

*Phase: 12-Session Form — Polish + Edit UX*
*Context gathered: 2026-06-15*
