---
phase: 12-session-form-polish-edit-ux
plan: 04
gap_closure: true
status: complete
requirements: [UI-04]
completed: 2026-06-15
self_check: PASS
key_files:
  created: []
  modified:
    - src/renderer/SessionEditModal.tsx
    - src/renderer/form.css
    - tests/smoke/session-edit.smoke.test.ts
    - tests/ui-lab/surfaces.ts
    - tests/ui-lab/DESIGN-RUBRIC.md
commits:
  - ed2fea5  # Task 1 — drop context-menu-item from Save + smoke click by testid
  - 619c658  # Task 3 — overlay guard + ui-lab Save capture + hint assert + rubric line
---

# 12-04 SUMMARY — Renderer/CSS gap fixes (GAP-12-A / E / D-overlay / META)

Executed INLINE on the main thread (Opus 4.8) — the subagent executor spawn was 529-Overloaded
3× in a row; inline execution bypasses the spawn while keeping opus quality.

## Tasks

**Task 1 (GAP-12-A root fix) — committed `ed2fea5`.** Removed the `context-menu-item` class from
the Save button in `SessionEditModal.tsx` (kept `modal-btn modal-btn-save`, `data-testid="edit-save"`,
label "Save changes"). That class was defined later in `form.css` and set `background: transparent`
(killing the accent-blue) **and** `padding: 7px var(--space-3)` (making Save a different size than
Cancel — the "not evenly spaced" action row). Re-routed the session-edit smoke's two Save clicks from
`clickMenuItem('Save changes')` → `clickByTestId('edit-save')` (added the import); left the real
`clickMenuItem('Edit')` menu arm untouched. → **GAP-12-A's blue Save AND the uneven action row are
both fixed by this one class removal.**

**Task 2 (GAP-12-A spacing + GAP-12-E tones) — confirm-only, no commit.** Verified the form geometry
is already fully on the formal token scale (`.edit-field` `--space-3`, `.edit-group-divider` `--space-5`,
`.modal-actions` `--space-2`, inputs `--space-3`; zero off-scale px literals in the edit block — the only
off-scale `7px` lives in the context-menu region, out of scope). `.modal-btn-save` already resolves to
`var(--color-accent)` and is no longer overridden post-Task-1. Validation tones already correct
(`.edit-field-notice--hint` = `--ink-faint`, `--error` = `--color-danger`). Per CLAUDE.md rule 9 (don't
change what's already correct), no CSS churn was invented; the GAP-12-E machine check is the ui-lab
assertion added in Task 3. `tokens-completeness` 20/20 GREEN.

**Task 3 (GAP-12-D overlay half + META + GAP-12-E assertion) — committed `619c658`.**
- **Overlay guard:** the `.modal-overlay` now closes only when a click BOTH starts and ends on the
  overlay itself (`onMouseDown` records `e.target === e.currentTarget` in `overlayMouseDownRef`;
  `onClick` calls `onCancel` only if that ref is true AND `e.target === e.currentTarget`). A Cmd+A /
  drag-select overshoot that ends on the overlay no longer closes the modal. (The Cmd+A *root cause* —
  the missing app Edit menu — is GAP-12-D's main half, fixed in plan 12-05.)
- **META:** `tests/ui-lab/surfaces.ts` `edit-modal` surface now scrolls `[data-testid="edit-save"]` into
  view and `assertEditSaveCaptured()` throws a descriptive Error (not a skip) if Save is absent or has a
  zero box — so the visual gate can no longer false-pass with the Save button below the fold.
- **GAP-12-E:** the `edit-modal-validation` surface now `assertValidationHintsRendered()` (≥1
  `.edit-field-notice--hint` after an invalid cwd + empty name) so the calm-hint claim has a machine check.
- `DESIGN-RUBRIC.md` §edit-modal gained a line requiring the `.modal-actions` row (incl. blue Save) to be
  in the captured frame.

## Verification (actual)
- `npm run test:unit` → **48 files / 420 passed** (exit 0)
- `npx tsc --noEmit` → exit 0 · `eslint` on touched files → clean
- `tokens-completeness` → 20/20 · **EXPECTED_API_KEYS stays 20** (renderer/test-only; no bridge/PTY touched; D-03a untouched)
- grep gates: no `context-menu-item` on Save; 2× `clickByTestId('edit-save')`; overlay guard present; Save captured + hint-assert present

## Deferred to 12-07 re-gate
The packaged `ui:shots:fresh` capture (now Save-button-in-frame) + the BLOCKING operator live-verify of
the blue Save / even spacing / overlay / hints are owned by plan 12-07, not asserted here.

## Self-Check: PASS
