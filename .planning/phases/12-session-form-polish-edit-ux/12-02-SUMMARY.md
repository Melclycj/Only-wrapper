---
phase: 12-session-form-polish-edit-ux
plan: 02
subsystem: ui
tags: [react, renderer, css-tokens, electron, session-form, validation, ui-04, sess-05]

# Dependency graph
requires:
  - phase: 12-01
    provides: "mergeAuthoritativeProfiles (SESS-05 4-field merge) + validateSessionForm (D-04 hints) pure reducers + their types"
  - phase: 06-session-lifecycle
    provides: "pickDirectory bridge key (SESS-06) + onPtyStatus → row.errorMessage CR-01 path (both reused, no new IPC)"
  - phase: 09-design-tokens
    provides: "tokens.css --space-*/--color-accent/--color-danger/--radius-* design tokens consumed by form.css"
provides:
  - "form.css — the extracted modal/form/picker surface stylesheet (subheads, hairline divider, validation notice, constructive blue .modal-btn-save, designed picker states), tokens-first"
  - "SessionEditModal restructured into the D-02 two-group single-column layout (Identity / Launch · Applies on restart), 'Save changes' accent-blue button, inline D-04 validation under Name + cwd, new errorMessage prop"
  - "rehydrateProfiles delegates to mergeAuthoritativeProfiles (SESS-05 prefill flows through the tested reducer); editingSession.errorMessage threaded into the modal (CR-01 rejection inline)"
  - "tokens-completeness.test.ts extended to scan form.css (reference completeness + literal absence)"
affects: [12-03 (visual gate scores the restructured surface against the rubric; packaged human-verify of SC1/SESS-05 O-1/SESS-06 O-2), 13 (UI-06 hover/focus sweep builds on form.css)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS surface extraction: move a cohesive style block into its own file + extend the tokens-completeness guard to cover it (mirrors the Phase-10 sidebar.css / Phase-11 terminal-area.css splits)"
    - "Consume Wave-0 pure reducers in the composition wave: thin React wrapper over mergeAuthoritativeProfiles; validateSessionForm notices computed from live state"
    - "Tokens-first form chrome: every CSS value resolves via var() except element dimensions + the single #ffffff button text"

key-files:
  created:
    - src/renderer/form.css
  modified:
    - src/renderer/SessionEditModal.tsx
    - src/renderer/SessionManager.tsx
    - src/renderer/terminal.css
    - src/renderer/index.tsx
    - src/renderer/__tests__/tokens-completeness.test.ts
    - tests/smoke/session-edit.smoke.test.ts
    - tests/smoke/startup-command.smoke.test.ts

key-decisions:
  - "Extracted the form/modal/picker CSS into form.css (D-01 file-organization discretion): terminal.css fell 493→152 lines, preserving Phase-13 headroom under the 800-line discipline"
  - "Save button moved from the destructive red .modal-btn-confirm to the constructive accent-blue .modal-btn-save (D-04 Pitfall 1 — required, not discretion); label promoted Save → 'Save changes', edit-save testid + .context-menu-item preserved"
  - "cwd notice: main's CR-01 'Working directory not found' rejection (error ramp) OUTRANKS the local non-absolute format hint — never both shown at once (a real rejection beats the local format guess)"
  - "Lockstep smoke update: clickMenuItem('Save') → clickMenuItem('Save changes') in session-edit + startup-command smokes (the WDIO driver matches by EXACT visible text, so the label change ripples — UI-SPEC §Selector contract)"

patterns-established:
  - "Composition-wave wiring: a Wave-0 extracted pure reducer becomes a thin useCallback wrapper (rehydrateProfiles); the inline logic is deleted so the tested reducer is the single source"

requirements-completed: [UI-04, SESS-05, SESS-06]

# Metrics
duration: 10 min
completed: 2026-06-15
---

# Phase 12 Plan 02: Session Form Polish + Edit UX (UI-04 headline) Summary

**The Edit Session modal restructured into the D-02 two-group designed surface (Identity / Launch · Applies on restart) on the locked Switchboard chassis — extracted form.css with a constructive accent-blue 'Save changes' button + hairline divider + section subheads + inline D-04 validation, a designed token-driven IconPicker, SESS-05 prefill rewired through the tested mergeAuthoritativeProfiles reducer, and main's CR-01 cwd rejection threaded inline — all renderer-only, EXPECTED_API_KEYS unchanged at 20.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-15T01:22:39Z
- **Completed:** 2026-06-15T01:32:35Z
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments
- **form.css extracted** — the modal/context-menu/icon-picker/prefs/edit-form block moved out of terminal.css (493→152 lines) into a tokens-first form.css, imported after terminal.css with cascade order preserved. Added `.edit-group-subhead`, `.edit-group-divider` (hairline), `.edit-field-notice--hint/--error`, and the constructive accent-blue `.modal-btn-save`. Snapped the legacy 6px/10px/22px/2px literals to clean `--space-*` steps. Polished the picker: emoji-cell + color-swatch hover (`--bg-sunk`) / selected (`--color-accent` ring) / focus-visible (`--color-accent`) states.
- **SessionEditModal D-02 restructure** — Name + Icon wrapped in an "Identity" group with a section subhead; a hairline divider; the restart group reframed to "Launch · Applies on restart" (reusing the `applies-on-restart` testid). Save is now constructive accent-blue "Save changes" (not danger-red). Inline D-04 validation: empty-name neutral hint + non-absolute-cwd format hint via `validateSessionForm`, and main's CR-01 'Working directory not found' rejection rendered inline under cwd in the danger ramp via the new `errorMessage` prop. Seed effect / Esc+focus a11y / handleSave DOM-read logic preserved verbatim.
- **SESS-05 rewire** — `rehydrateProfiles` is now a thin wrapper delegating the 4-field merge to the pure tested `mergeAuthoritativeProfiles`; the inline `new Map(authoritative…)` block deleted. `status`/`errorMessage` untouched (owned by onPtyStatus). `editingSession.errorMessage` threaded into the modal. **No new bridge key / IPC.**
- **Guards GREEN** — 418 unit tests (413 baseline + 5 new tokens-completeness cases covering form.css), `npx tsc --noEmit` exit 0, `tokens-completeness` + `security.guard` GREEN (EXPECTED_API_KEYS === 20), session-edit + boot/security smokes PASSED on a freshly-packaged binary.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract form.css + subheads/divider/validation/blue-Save/picker (tokens-first)** — `d4ed54c` (feat)
2. **Task 2: SessionEditModal D-02 two-group restructure + blue Save + inline validation** — `3b37374` (feat)
3. **Task 3: rehydrateProfiles via mergeAuthoritativeProfiles (SESS-05) + thread errorMessage** — `318d5d0` (feat)

**Plan metadata:** `<this commit>` (docs: complete plan)

## Files Created/Modified
- `src/renderer/form.css` — NEW. Extracted modal/form/picker surface; subhead/divider/validation/blue-Save rules; designed picker states; tokens-first.
- `src/renderer/SessionEditModal.tsx` — Two-group D-02 JSX; `errorMessage` prop; `validateSessionForm` notices under Name + cwd; `.modal-btn-save` "Save changes".
- `src/renderer/SessionManager.tsx` — `rehydrateProfiles` thin wrapper over `mergeAuthoritativeProfiles`; `editingSession?.errorMessage` threaded into the modal.
- `src/renderer/terminal.css` — form/modal/picker block removed (493→152 lines); extraction-note comment.
- `src/renderer/index.tsx` — `import './form.css'` after terminal.css.
- `src/renderer/__tests__/tokens-completeness.test.ts` — scans form.css (reference completeness + literal absence).
- `tests/smoke/session-edit.smoke.test.ts` / `tests/smoke/startup-command.smoke.test.ts` — lockstep `clickMenuItem('Save')` → `'Save changes'`.

## Decisions Made
- Form CSS extracted to `form.css` (D-01 discretion) to keep terminal.css well under the 800-line limit with Phase-13 headroom.
- The cwd error ramp (CR-01 rejection) outranks the neutral format hint — they never co-render.
- Smoke `clickMenuItem` matches by exact visible text, so the "Save changes" relabel required updating both smoke files in lockstep (UI-SPEC §Selector contract).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lockstep smoke label update for the 'Save changes' relabel**
- **Found during:** Task 2 (the Save → 'Save changes' label change)
- **Issue:** The WDIO smoke helper `clickMenuItem(label)` matches a `.context-menu-item` by EXACT visible text (`textContent.trim() === label`). The Save button (which carries `.context-menu-item`) had its visible text changed from `Save` to `Save changes`, so the three existing `clickMenuItem('Save')` calls (1 in session-edit.smoke, 2 in startup-command.smoke) would no longer match the button — a real break caused directly by this task's relabel (the testid is frozen, but the smoke addresses by text, not testid).
- **Fix:** Updated all three calls to `clickMenuItem('Save changes')`. This is the lockstep the UI-SPEC §Selector contract mandates ("any rename ripples to all consumers in the same plan").
- **Files modified:** tests/smoke/session-edit.smoke.test.ts, tests/smoke/startup-command.smoke.test.ts
- **Verification:** session-edit smoke PASSED under parallel load; the startup-command R1 dormant test (which uses the relabeled call) PASSED; startup-command isolated re-run 5/5 GREEN.
- **Committed in:** 3b37374 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — required selector-contract lockstep).
**Impact on plan:** Necessary for correctness (the smokes would otherwise fail to drive Save). No scope creep — confined to the two smoke files the relabel touches.

## Issues Encountered
- **startup-command smoke: 3 failures under PARALLEL load, 5/5 GREEN in isolation** — the documented known parallel-load timing flake (STATE.md history flags it for the heavy edit-driven smokes under 14 concurrent Electron instances). The session-edit smoke (the plan-named spec) PASSED even under parallel load, and the startup-command R1 test using the relabeled `clickMenuItem('Save changes')` ALSO passed in parallel — confirming the label-lockstep is correct and the failures are timing, not a regression. Verified by re-running `startup-command.smoke.test.ts` in isolation: all 5 specs pass (`JW_STARTUP_OK` auto-runs, ArrowUp recalls, recycle round-trips). NOT a real regression.
- Pre-existing out-of-scope `.planning/spikes/*.cjs` ESLint errors remain (tracked in prior phases' deferred-items). `npx eslint` over the files this plan touched exits clean.

## Known Stubs
None — no stubbed data paths introduced. The form composes live state + the existing IPC; the only "placeholder" string is the pre-existing disabled "Finding shells…" `<option>` (an in-flight UI state, not a stub).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The restructured surface + extended rubric give Plan 12-03 its visual-gate target. Plan 03 owns the **packaged no-injection ui-lab capture** scored against `DESIGN-RUBRIC.md §edit-modal` (+ `§edit-modal-validation`) and the **BLOCKING human-verify** for SC1 (one cohesive designed surface), SESS-05 O-1 (first-open default-cwd display), and SESS-06 O-2 (Browse… end-to-end on the packaged app). The fresh package built this plan is available for that capture.
- No blockers. Main process + bridge untouched (no pty-manager/window-config/api-types/preload diff vs main); EXPECTED_API_KEYS stays 20; terminal fidelity safe by construction (renderer-only modal, no xterm/PTY/fit path touched; D-03a viewport guardrail respected).

## Self-Check: PASSED

- Created file exists on disk: `src/renderer/form.css` — FOUND.
- Commits exist: `d4ed54c`, `3b37374`, `318d5d0` — all in `git log 41505e3..HEAD`.
- Plan-level verification re-run: `npm run test:unit` → 418 passed (48 files); `npx tsc --noEmit` → exit 0; `tokens-completeness` (19) + `security.guard` GREEN (EXPECTED_API_KEYS === 20); session-edit + boot/security smokes PASSED on a freshly-packaged binary; startup-command flake confirmed isolated-GREEN (5/5).
- All acceptance criteria across the 3 tasks verified by command (modal-btn-save==1, modal-btn-confirm==0, 'Save changes'==1, all frozen testids present, mergeAuthoritativeProfiles wired + inline map removed, errorMessage threaded).

---
*Phase: 12-session-form-polish-edit-ux*
*Completed: 2026-06-15*
