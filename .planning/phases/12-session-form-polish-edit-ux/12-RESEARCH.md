# Phase 12: Session Form — Polish + Edit UX - Research

**Researched:** 2026-06-15
**Domain:** Renderer-only React modal restructure + pure-reducer test seams + ui-lab visual gate (Electron 42 / React 19 / Vitest / WDIO)
**Confidence:** HIGH (every claim cited to file:line in the live tree; no external-package research needed)

> **Scope discipline:** This is NOT a re-scout. CONTEXT.md (D-01..D-05 LOCKED) and UI-SPEC.md (6/6 dimensions verified) already did the visual + code scout. This research answers only the planner-facing question the upstream docs leave open: **the test/validation architecture and the cheapest reliable seams.** SESS-05 hydration and SESS-06 picker are already in code (Phase 6) — verified live below.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Phase 12 = UI-04 polish + verify-and-finish SESS-05/06, NOT greenfield. Picker + prefill hydration already exist (Phase 6). Treat SESS-05/06 as *verify live round-trip + close residual gaps*.
- **D-02:** Two semantic groups, single column — **Identity** (Name + Icon/color, applies LIVE) and **Launch / "Applies on restart"** (Working dir + Browse…, Shell, Startup command, persists to main). Boundary REUSES the existing `splitEdit` live-vs-restart reducer. Single column (small-laptop-friendly).
- **D-03:** Polish the EXISTING emoji + color picker (`IconPicker.tsx`, `SessionIconSpec = emoji | color`) into a designed grid/popover with token-driven hover/selected states. Do NOT build a real icon-glyph/SVG system (backlog). "Real picker" = real picker UI, not new glyphs.
- **D-04:** Lightweight inline validation; **main stays the validator of record; 0 new IPC.** Renderer-cheap checks (empty-name neutral hint, cwd absolute-path format hint, startup optional). On Save/Start, surface main's EXISTING "Working directory not found" (CR-01) **inline in the form**. NO `validatePath` probe IPC. `EXPECTED_API_KEYS` STAYS 20.
- **D-05:** Keep edit-only (instant-spawn-then-edit). The polished Edit modal IS the UI-04 form. No create-first variant.
- Visual direction LOCKED (Switchboard — DESIGN.md). Compose from `tokens.css` (tokens-first, guarded by `tokens-completeness.test.ts`). `EXPECTED_API_KEYS` stays 20 (no new bridge key). Terminal fidelity untouched (form is a modal). CR-01 cwd guard stays validator of record. **ui-lab harness MANDATORY** with a BLOCKING end-of-phase human-verify.

### Claude's Discretion
- Section-subhead styling, divider treatment, inter-field spacing rhythm (from `--space-*`) — tuned in ui-lab loop.
- Picker geometry (grid columns, inline vs popover, swatch size/shape) — tuned in ui-lab.
- Inline-validation visual treatment (red helper text vs disabled-Save vs both) — from the `--color-danger` ramp (Phase-10 D-15 precedent).
- Whether to extract form/modal CSS into its own `form.css` — planner's call, counts toward <800-line discipline.
- SESS-05 O-1: first edit-open of a brand-new session shows resolved-home cwd vs empty field — verify both live, pick the clearer.

### Deferred Ideas (OUT OF SCOPE)
- Real icon system (emoji → icon font/SVG) → backlog.
- Create-first form → its own phase (D-05 keeps edit-only).
- `validatePath` live cwd-existence probe IPC → rejected (D-04; CR-01 + Browse… already cover it; would grow budget past 20).
- Empty/loading/error-state design (UI-05) + app-wide hover/focus/active sweep (UI-06) → Phase 13.
- App-wide animation/motion system → Phase 13 / standalone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-04 | Create/edit session form reads as one cohesive designed surface (grouped fields, labels, icon/color picker, inline validation) | Restructure `SessionEditModal.tsx` into D-02 two-group layout; polish `IconPicker.tsx` (D-03); compose from `tokens.css`. Verification = ui-lab packaged capture scored vs DESIGN-RUBRIC `§edit-modal` (rubric must be updated, see §Validation Architecture) + new `edit-modal-validation` surface + BLOCKING human-verify. The inline-validation *logic* is unit-testable via a new pure `validateSessionForm` helper (§2 below). |
| SESS-05 | Edit modal pre-fills the actually-persisted cwd + startup command | ALREADY WIRED: `rehydrateProfiles()` (`SessionManager.tsx:388-405`) re-reads `listSessions()` and merges main's authoritative `cwd`/`shell`/`startupCommand` after spawn (`onAdd:452`) and after save (`handleSaveProfile:423`); modal seeds from the record (`SessionEditModal.tsx:68-75`). RED→GREEN target = extract a pure `mergeAuthoritativeProfiles` reducer so the merge is unit-testable in the Node/Vitest env; smoke asserts the live round-trip. |
| SESS-06 | Native Browse… folder picker fills the working-directory field | ALREADY WIRED: main handler (`src/main/index.ts:175-181`), `pickDirectory` bridge key (key 19; `EXPECTED_API_KEYS` line 119, total 20), Browse… button (`SessionEditModal.tsx:194-205`). Native OS dialog = **live-verify ONLY** (O-2 human-gate). No new key. |
</phase_requirements>

## Summary

Phase 12 is **polish + verification on a LOCKED chassis** — a renderer-only restructure of one modal (`SessionEditModal.tsx` + `IconPicker.tsx`) with no new IPC, no new bridge key, and no PTY/xterm path touched. The two SESS requirements are **already implemented in code** (Phase 6) and verified present at the exact line numbers CONTEXT cited. The planner's real job is (a) compose the UI-04 visual surface and prove it through the ui-lab capture loop + a BLOCKING human-verify, and (b) make the *logic* underneath the new behaviors unit-testable by extracting two pure reducers, mirroring the established `session-edit.ts` / `session-status.ts` / `start-affordances.ts` pattern.

The single most important architectural fact for the planner: **Vitest runs `environment: 'node'`** (`vitest.config.ts:7`) — there is NO jsdom. Every renderer-state unit test in this repo therefore tests a **pure, React/electron/xterm-free module** in `src/renderer/__tests__/`. You cannot unit-test `rehydrateProfiles` or `validateSessionForm` *inside* the React component; you must extract the pure logic into a module that imports only `../shared/types`. This is exactly how the repo already tests `splitEdit`, `applyStatusEvent`, `resolveRowStatus`, etc. The cheapest reliable test seam is the same one prior phases used.

**Primary recommendation:** Extract two pure reducers — `mergeAuthoritativeProfiles(rows, authoritative)` (SESS-05 merge, mirrors the inline `rehydrateProfiles` map at `SessionManager.tsx:391-403`) and `validateSessionForm(fields) → { field: { tone, message } }` (D-04 inline-validation rules) — each in its own `src/renderer/*.ts` importing only `../shared/types`, each with a Wave-0 RED test in `src/renderer/__tests__/`. Wire `SessionEditModal`/`SessionManager` to consume them. Everything native (Browse… dialog, packaged visual proof, first-open cwd display) is **live-verify only**, folded into the single BLOCKING end-of-phase human-verify. `EXPECTED_API_KEYS` stays 20; the security threat model is genuinely LIGHT (no new attack surface).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Form layout / grouping / picker (UI-04) | Renderer (React modal) | — | Pure presentation; `SessionEditModal.tsx` + `IconPicker.tsx` + form CSS. No main involvement. |
| Inline validation rules (D-04) | Renderer (pure reducer) | Main (validator of record) | Renderer does cheap format/empty hints for UX; **main's CR-01 (`pty-manager.ts:305-313`) remains the authoritative cwd validator** — renderer pre-checks never replace it. |
| Edit-prefill hydration (SESS-05) | Renderer (merge reducer) | Main (truth source via `listSessions()`) | Main owns the persisted/validated/trimmed `cwd`/`shell`/`startupCommand`; renderer re-reads + merges. Already wired (`rehydrateProfiles`). |
| Folder picker dialog (SESS-06) | Main (native dialog) | Renderer (Browse… button + fill) | `dialog.showOpenDialog` MUST run in main (Electron security model); renderer only invokes `pickDirectory` and fills the field. Already wired. |
| cwd existence enforcement | Main (CR-01 guard) | — | `isValidCwd` (absolute + `statSync().isDirectory()`) at `pty-manager.ts:305`. Renderer never enforces; only surfaces main's rejection inline. |

## Standard Stack

No new packages this phase. The stack is the already-installed, already-vetted Phase-9/10/11 chassis:

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React | 19.x | Modal component | Installed |
| TypeScript | 5.x | Types across the pure reducers | Installed |
| Vitest | (repo) | Unit tests for pure reducers — `environment: 'node'` [VERIFIED: `vitest.config.ts:7`] | Installed |
| WebdriverIO (WDIO) | (repo) | Smoke (`wdio.conf.ts`) + ui-lab capture (`wdio.uilab.conf.ts`) | Installed |
| `@fontsource` Nunito | (repo) | `--font-ui` form chrome | Installed |

**Installation:** none. Registry safety gate = **not applicable** (zero external packages — confirmed UI-SPEC §Registry Safety).

## Package Legitimacy Audit

Not applicable — **zero external packages added this phase.** This is a renderer-only CSS/JSX restructure + two pure-reducer extractions consuming already-installed dependencies. If the planner discovers a genuinely needed package mid-plan, it must gate behind `checkpoint:human-verify` and run the package-legitimacy gate first (per UI-SPEC §Registry Safety).

---

## Validation Architecture (Nyquist) — MANDATORY

This section is the spine of VALIDATION.md. It distinguishes **AUTOMATED checks** (RED→GREEN, runnable in CI) from the **BLOCKING human-gate** (native OS + packaged visual proof that no headless harness can drive).

### Test Framework

| Property | Value |
|----------|-------|
| Unit framework | Vitest, `environment: 'node'` [VERIFIED: `vitest.config.ts:7`] — **no jsdom**; pure modules only |
| Unit test location | `src/renderer/__tests__/*.test.ts` [VERIFIED: 20+ existing, e.g. `session-edit.test.ts`, `apply-status-event.test.ts`] |
| Smoke framework | WebdriverIO (`wdio.conf.ts`) → `tests/smoke/*.smoke.test.ts` |
| ui-lab harness | WebdriverIO (`wdio.uilab.conf.ts`) → `tests/ui-lab/{surfaces,capture.uilab.test,DESIGN-RUBRIC,helpers}.ts` |
| Quick run command | `npm run test:unit` (Vitest, fast) |
| Full suite command | `npm run test` (`test:unit && test:smoke`) [VERIFIED: `package.json` scripts] |
| Visual capture | `npm run ui:shots` (injection preview) / `npm run ui:shots:fresh` (= `package && ui:shots`, packaged proof) [VERIFIED: `package.json`] |

### The cheapest reliable TEST SEAM (the load-bearing finding)

**You cannot unit-test renderer state logic in-place.** `rehydrateProfiles` (`SessionManager.tsx:388-405`) is a `useCallback` *inside* the React component, and Vitest runs in Node with no DOM. Every prior phase solved this by **extracting a pure module** that imports only `../shared/types` (never React/xterm/electron) and unit-testing it in `src/renderer/__tests__/`. Confirmed pattern:

- `session-edit.ts` (`splitEdit`) — pure live-vs-restart reducer, tested by `session-edit.test.ts` [VERIFIED: file header line 1-7 "unit-tests in the Node/Vitest env (mirrors session-close.ts)"].
- `apply-status-event.ts` (`applyStatusEvent`) — extracted "from the inline closure in SessionManager.tsx … so the FULL status-event handling … is unit-testable in the Node env" [VERIFIED: `apply-status-event.ts:1-6`].
- `session-status.ts`, `start-affordances.ts`, `session-close.ts`, `session-add.ts`, `row-secondary.ts` — same pattern (all in `src/renderer/*.ts` + `__tests__`).

**Recommendation: extract two pure reducers**, mirroring this exact pattern.

#### Reducer 1 — `mergeAuthoritativeProfiles(rows, authoritative)` (SESS-05)

The SESS-05 merge currently lives inline in `rehydrateProfiles` (`SessionManager.tsx:391-403`): map each row, look up main's truth by `logicalId`, overwrite `cwd`/`shell`/`startupCommand`, carry `configured`, and **NOT disturb `status`/`errorMessage`** (those are owned by the `onPtyStatus` subscription — `SessionManager.tsx:387` comment). Extract this map into:

```typescript
// src/renderer/merge-profiles.ts — RENDERER ONLY, imports only ../shared/types
import type { SessionRecord } from '../shared/types';

/** Merge main's authoritative restart-fields back into renderer rows by logicalId.
 *  cwd/shell/startupCommand + configured adopt main's truth; status/errorMessage
 *  are NEVER touched (owned by onPtyStatus). Pure — caller does setSessions. */
export function mergeAuthoritativeProfiles<T extends SessionRecord>(
  rows: readonly T[],
  authoritative: readonly SessionRecord[],
): T[] {
  const byId = new Map(authoritative.map((r) => [r.logicalId, r]));
  return rows.map((row) => {
    const truth = byId.get(row.logicalId);
    if (!truth) return row;
    return {
      ...row,
      cwd: truth.cwd,
      shell: truth.shell,
      startupCommand: truth.startupCommand,
      configured: truth.configured ?? row.configured,
    };
  });
}
```

`rehydrateProfiles` then becomes a thin wrapper: `setSessions((prev) => mergeAuthoritativeProfiles(prev, await window.api.listSessions()))`.

**RED→GREEN for SESS-05 (declarative TDD target):**
- **(RED)** `src/renderer/__tests__/merge-profiles.test.ts` (Wave-0 stub, intentionally failing until the module exists — mirror `session-edit.test.ts:1-6` header style). Assert:
  - **(a) freshly-spawned session:** a row minted with `cwd: ''` (the optimistic local guess) + an authoritative record carrying main's resolved cwd (e.g. `os.homedir()`) → merged row shows main's cwd, not `''`. This is the original todo's root cause (`2026-06-06-edit-modal-does-not-prefill-saved-cwd-and-startup-command.md`: "renderer record minted with `cwd: ''`, not refreshed after save").
  - **(b) edited-then-saved session:** a row with a stale submitted cwd + an authoritative record carrying a *trimmed/validated* cwd (main trims whitespace / ignores invalid per CR-01) → merged row shows main's persisted truth, not the optimistic submit.
  - **(c) status/errorMessage untouched:** a row with `status: 'running'`, `errorMessage: 'x'` → after merge those two fields are byte-identical (the `SessionManager.tsx:387` invariant).
  - **(d) unknown id:** a row whose `logicalId` is absent from `authoritative` → returned unchanged (the `if (!truth) return row` branch, line 394).
- **(GREEN)** the extracted reducer + the `rehydrateProfiles` rewire.

#### Reducer 2 — `validateSessionForm(fields) → ...` (D-04, see §2 below)

#### Smoke assertion (the live round-trip — what CI proves end-to-end)

`tests/smoke/session-edit.smoke.test.ts` currently asserts only the name-edit live-apply (`expect(await rowName(id)).toBe(newName)` at line 74) and logicalId stability (line 76). **Add a prefill round-trip assertion:** open edit → set `edit-cwd` (or pick a known dir) + `edit-startup` → Save → reopen edit on the same row → assert `edit-cwd` / `edit-startup` DOM values equal what was saved (i.e. `rehydrateProfiles` + the seed effect round-tripped). The harness already has `setInputByTestId` and `openEditModal` helpers (in `tests/ui-lab/surfaces.ts:105,118`; the smoke driver has `clickMenuItem` in `tests/smoke/helpers/xterm-driver.ts:266`, and Save carries `.context-menu-item` so `clickMenuItem('Save')` activates it — `SessionEditModal.tsx:276-286`). This is the automated half of SC2; the *first-open* default-cwd display (O-1) stays human-verify.

### SESS-06 (Browse…) — LIVE-VERIFY ONLY

The native OS open-directory dialog **cannot be driven in unit or smoke** (it's an OS modal, not DOM). This is the **O-2 human-verify item**. Facts the planner must record (no automated coverage to add):
- Handler: `ipcMain.handle('dialog:pick-directory', …)` → `dialog.showOpenDialog({ properties: ['openDirectory'] })` [VERIFIED: CONTEXT cites `src/main/index.ts:175-181`].
- Bridge key: `pickDirectory` already present (`window-config.ts:119`; **key 19 of 20** — `EXPECTED_API_KEYS` total = 20, counted lines 101-120). **No new key.**
- Button: `browse-cwd` testid, `onClick → window.api.pickDirectory().then((p) => p && setCwd(p))` [VERIFIED: `SessionEditModal.tsx:194-205`].
- O-2 gate (human): on the **packaged** app, Browse… opens the native dialog → chosen path fills `edit-cwd` → CR-01 still gates at Start.

### UI-04 visual SC — ui-lab packaged capture + BLOCKING human-verify

The `edit-modal` surface ALREADY exists (`tests/ui-lab/surfaces.ts:400-417`): `prepare` calls `openEditModal(ctx.ids[0])`, `cleanup` clicks `edit-cancel`. Its rubric section is `DESIGN-RUBRIC.md §edit-modal` (lines 108-115). **Two concrete planner tasks:**

1. **Add a `edit-modal-validation` surface** to `surfaces.ts` (O-3). Model it on the existing `edit-modal` entry (lines 400-417): `prepare` = `openEditModal(ctx.ids[0])` → `setInputByTestId('edit-cwd', '/no/such/dir')` (a non-absolute or non-existent path) → drive the inline-validation/danger state → `pause`. `cleanup` = `clickByTestId('edit-cancel')`. This gives the D-04 inline-validation claim a capture to score.
2. **Update the `edit-modal` rubric lines** (`DESIGN-RUBRIC.md:108-115`). Today they assert dialog/fields/buttons/picker/rhythm but do NOT assert (a) the **two-group structure** (Identity / Launch with subheads + divider), nor (b) the **blue accent Save** (the rubric line 113 says "Save = accent fill" but the shipped button is red `.modal-btn-confirm` — see §Pitfall 1). Add explicit rubric lines for the D-02 grouping and the constructive-blue Save so the capture is scored against the new contract, plus a rubric section for the new validation surface.

**Run mechanics for the planner:** Because this is a **structural TSX change** (the two-group regroup), live-CSS injection (`UI_LAB_LIVE_CSS=1`) previews OLD markup — you MUST use `npm run ui:shots:fresh` (= `npm run package && npm run ui:shots`) for the proof capture. CSS-only value tweaks during the look→edit→re-look loop may use `UI_LAB_LIVE_CSS=1`. The final phase gate is a **packaged no-injection** capture scored vs the updated `DESIGN-RUBRIC.md §edit-modal` + the new validation variant, then a **BLOCKING end-of-phase human-verify** for SC1 ("one cohesive designed surface") that also covers O-1 (first-open cwd) and O-2 (Browse… packaged). The Nyquist gate flips ONLY on an explicit unqualified operator "approved."

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | Seam |
|-----|----------|-----------|-------------------|------|
| SESS-05 | Authoritative merge keeps main's truth, leaves status/error untouched | unit | `npm run test:unit` (`merge-profiles.test.ts`) | NEW pure `mergeAuthoritativeProfiles` |
| SESS-05 | Edit→Save→reopen round-trips cwd+startup | smoke | `npm run test:smoke` (`session-edit.smoke.test.ts` extension) | existing modal + `rehydrateProfiles` |
| SESS-05 | First edit-open of a brand-new session shows clear cwd (O-1) | **human-verify** | — (live) | BLOCKING gate |
| SESS-06 | Browse… → native dialog → fills field → CR-01 gates at Start (O-2) | **human-verify** | — (native OS dialog, packaged) | BLOCKING gate |
| D-04 | Empty-name → neutral hint; non-absolute cwd → neutral format hint; startup optional; main rejection mapped to inline error | unit | `npm run test:unit` (`validate-session-form.test.ts`) | NEW pure `validateSessionForm` |
| UI-04 | Two-group designed surface + polished picker + blue Save | visual + **human-verify** | `npm run ui:shots:fresh` → score vs rubric | ui-lab `edit-modal` + `edit-modal-validation` |
| (invariant) | `EXPECTED_API_KEYS === 20`, no new key | unit | `npm run test:unit` (`security.guard.test.ts`) | frozen |
| (invariant) | Every `var(--token)` resolves, no literals | unit | `npm run test:unit` (`tokens-completeness.test.ts`) | tokens-first |

### Sampling Rate
- **Per task commit:** `npm run test:unit` (fast Vitest; covers the new reducers + guards).
- **Per wave merge:** `npm run test` (unit + smoke; covers the live round-trip).
- **Phase gate:** full `npm run test` GREEN + `npm run ui:shots:fresh` packaged capture scored vs rubric + BLOCKING human-verify (SC1 + O-1 + O-2).

### Wave 0 Gaps
- [ ] `src/renderer/merge-profiles.ts` + `src/renderer/__tests__/merge-profiles.test.ts` (RED stub) — covers SESS-05 merge.
- [ ] `src/renderer/validate-session-form.ts` + `src/renderer/__tests__/validate-session-form.test.ts` (RED stub) — covers D-04 validation rules.
- [ ] `session-edit.smoke.test.ts` prefill round-trip assertion — covers SESS-05 live.
- [ ] `tests/ui-lab/surfaces.ts` `edit-modal-validation` surface + `DESIGN-RUBRIC.md` rubric update (grouping + blue Save + validation section) — covers UI-04 visual SC.
- [ ] Framework install: **none** (Vitest + WDIO + ui-lab already present).

---

## 2. The Inline-Validation Logic (D-04) — extractable pure helper

D-04 wants renderer-cheap, calm validation with **main as validator of record** and **0 new IPC**. Recommend a pure helper mirroring `session-edit.ts`:

```typescript
// src/renderer/validate-session-form.ts — RENDERER ONLY, imports only ../shared/types (or nothing)
export type FieldTone = 'hint' | 'error'; // hint = neutral --ink-faint; error = --color-danger
export interface FieldNotice { tone: FieldTone; message: string; }

export interface FormFieldValues {
  name: string;
  cwd: string;
  startupCommand: string;
}

/** Pure, renderer-cheap pre-checks. Main's CR-01 stays the validator of record;
 *  these are convenience-only UX hints (D-04). Returns one notice per field that
 *  has something to say. Empty name is a HINT (valid choice), not an error. */
export function validateSessionForm(f: FormFieldValues): Partial<Record<keyof FormFieldValues, FieldNotice>> {
  const out: Partial<Record<keyof FormFieldValues, FieldNotice>> = {};
  if (f.name.trim().length === 0) {
    out.name = { tone: 'hint', message: 'Keeps the current name' };            // neutral — Phase-4 discretion
  }
  if (f.cwd.trim().length > 0 && !isAbsolutePathish(f.cwd)) {
    out.cwd = { tone: 'hint', message: 'Enter an absolute path, or use Browse…' }; // neutral format hint
  }
  // startupCommand: optional — no validation; empty is valid (D-04).
  return out;
}
```

**Copy strings are FROZEN by UI-SPEC §Copywriting** — use the exact literals: empty-name hint = `Keeps the current name` (NEUTRAL `--ink-faint`), cwd format hint = `Enter an absolute path, or use Browse…` (NEUTRAL), cwd rejected error = `Working directory not found` (`--color-danger`). Do not echo the raw rejected path (UI-SPEC §Copy discipline).

**`isAbsolutePathish`** must be a renderer-cheap, cross-platform string check (the renderer has no `path` access under sandbox). Accept POSIX `/…` and Windows `C:\…` / `\\unc`. This is a **format** hint, not an existence check — keep it neutral-tone (an absolute-but-nonexistent path is main's job to reject, not the renderer's).

### How main's CR-01 rejection reaches the form WITHOUT a new IPC

The "Working directory not found" rejection is ALREADY produced by main and ALREADY carried over the existing `onPtyStatus` notice channel — no new channel needed:

1. Main: on an invalid cwd, `pty-manager.ts:305-312` flips status to `'error'` and sends `notice: 'Working directory not found: <cwd>'` over `PTY_CHANNELS.status` (no live PTY spawned, pid -1). [VERIFIED: `pty-manager.ts:305-313`]
2. Renderer: `applyStatusEvent` (`apply-status-event.ts:61-66`) captures an `error` notice into `row.errorMessage` WITHOUT changing lifecycle status. [VERIFIED]
3. **Current display location:** `errorMessage` is currently rendered on the **`IdleCard`** (the post-Start error card) — `SessionManager.tsx:699` passes `errorMessage={activeRecord.errorMessage}` to `IdleCard`, which shows it at `IdleCard.tsx:117`. [VERIFIED]

**The D-04 change (the actual work):** surface that SAME `errorMessage` **inline in the form under the cwd field** (in the `--color-danger` ramp) when it's a cwd rejection, *in addition to / instead of* only the IdleCard. The cleanest path: pass the active row's `errorMessage` (already on the row) into `SessionEditModal` as a prop, and when it matches the cwd-rejection shape, render it as the cwd field's error notice. **No new IPC, no new bridge key** — it reuses the existing `errorMessage` already flowing on the row. The planner decides whether to also keep the IdleCard card (likely yes — they're different surfaces). This keeps the data-flow FROZEN (UI-SPEC §Interaction "the data-flow behavior … is FROZEN").

**RED→GREEN for D-04:** `validate-session-form.test.ts` (Wave-0 stub) asserts: empty name → `{name:{tone:'hint', message:'Keeps the current name'}}`; non-absolute cwd → `{cwd:{tone:'hint', …}}`; absolute cwd → no cwd notice; empty startup → no notice; whitespace-only name → hint (trim). The CR-01 inline-surfacing is presentation (prop threading), proven by the `edit-modal-validation` ui-lab capture + the BLOCKING human-verify, not a unit test.

---

## 3. EXPECTED_API_KEYS = 20 + LIGHT threat model — CONFIRMED

**`EXPECTED_API_KEYS` = 20, and it STAYS 20.** [VERIFIED: `window-config.ts:100-121` — the array has exactly 20 entries; `pickDirectory` is line 119, `listSessions` line 113, `ptyUpdateProfile` line 114 — all the keys this phase needs are already present.] The `security.guard.test.ts` asserts the REAL preload registers exactly `EXPECTED_API_KEYS` (`security.guard.test.ts:48-52`) — adding any key fails it.

**Threat model is genuinely LIGHT — the `<threat_model>` blocks in the plans should be minimal (ASVS L1, block-on-high):**
- **No new bridge key** → no new IPC attack surface. (`pickDirectory` / `listSessions` / `ptyUpdateProfile` all reused.) [VERIFIED: D-04 + key list]
- **No new channel** → the CR-01 rejection rides the EXISTING `onPtyStatus` notice path (`apply-status-event.ts:61`). No new data crosses the bridge.
- **Folder-picker → cwd path is already guarded by CR-01** (`pty-manager.ts:305`, absolute + `statSync().isDirectory()`), the validator of record. Browse… returns only existing dirs (native dialog). The renderer pre-check is convenience-only and never the gate.
- **Notice sanitization** already in place: main sends `sanitizeNotice(...)` (`pty-manager.ts:310`); the renderer renders all user strings as React text nodes (auto-escaped) — UI-SPEC §Copy discipline ("No `dangerouslySetInnerHTML`"). The validation strings are fixed literals.
- **No PTY/xterm/fit path touched** (the form is a modal) → terminal fidelity safe by construction; no new spawn/exec surface.

**Net:** the only "input" this phase adds is renderer-local string validation that produces UX hints — it grants no new capability and crosses no trust boundary. ASVS V5 (input validation) applies trivially (escaped text nodes + fixed literals); V1/V2/V3/V4/V6 do not apply (no auth/session/access-control/crypto change). Block-on-high is satisfied by the unchanged `security.guard` + `tokens-completeness` invariants staying GREEN.

---

## 4. Selector-contract + tokens-first mechanics the planner MUST respect

### data-testid freeze (Rule-1: survive the restructure OR rename WITH tests in the same plan)
[VERIFIED present in `SessionEditModal.tsx`]: `session-edit-modal` (139), `edit-name` (160), `edit-cwd` (190), `browse-cwd` (197), `edit-shell` (221/233), `edit-startup` (260), `applies-on-restart` (172), `edit-cancel` (271), `edit-save` (282). Plus picker testids `icon-picker` / `edit-emoji-text` (UI-SPEC). **Consumers that ripple on any rename (same plan):**
- `tests/smoke/session-edit.smoke.test.ts` (the smoke).
- `tests/ui-lab/surfaces.ts` — the `edit-modal` surface (400-417) + the `setInputByTestId`/`openEditModal`/`clickByTestId` helpers (105-132) that address these testids.
- Note the D-02 group-B subhead **REUSES** the existing `applies-on-restart` testid + copy as the group header (UI-SPEC §Form Structure) — don't mint a new one.
- The `Save` → `Save changes` copy change touches the visible label ONLY; `edit-save` testid is UNCHANGED (UI-SPEC §Copywriting). The `.context-menu-item` class on Save (`SessionEditModal.tsx:281`) MUST survive — the smoke's `clickMenuItem('Save')` (`xterm-driver.ts:266`) depends on it.

### tokens-first (guarded by `tokens-completeness.test.ts`)
Every `var(--token)` must resolve; literals are banned. New form CSS uses `var()` only. The form CSS currently lives in `terminal.css` L160-489 (per UI-SPEC) with several pre-token one-off literals (4/8/10/12/16px, 22px dialog top-pad, 2px restart-group pad) that the polish loop should snap to the formal `--space-*` scale. **Discretion (CONTEXT):** extract form/modal CSS into its own `form.css` if `terminal.css` nears the 800-line limit — planner's call. The `--space-1_5` (6px) / `--space-2_5` (10px) aliases are migration carry-overs, NOT canonical steps for this surface — snap to the nearest clean step (8/12) per UI-SPEC §Spacing.

### Guard tests that MUST stay GREEN in lockstep
`tokens-completeness.test.ts`, `security.guard.test.ts` (=== 20), `status-colors.test.ts`, the `session-edit` smoke, and the fidelity smokes (`multi-session-keepalive`, `pty-roundtrip`, `pty-throughput`, etc.) — the form change is fidelity-safe by construction but the suite proves it.

## Common Pitfalls

### Pitfall 1: Save button inherits the destructive-red `.modal-btn-confirm` styling
**What goes wrong:** the shipped Save button carries `modal-btn modal-btn-confirm` (`SessionEditModal.tsx:281`) — `.modal-btn-confirm` is RED because it was reused as a destructive-confirm button. UI-SPEC §Color makes the blue accent Save a **required change, not discretion**: Save is constructive → must be `--color-accent`, not the inherited danger red.
**How to avoid:** give Save a constructive-blue class; keep the `.context-menu-item` class (smoke depends on it) and the `edit-save` testid. Update the rubric line so the capture scores the blue.

### Pitfall 2: Trying to unit-test renderer state in jsdom
**What goes wrong:** Vitest is `environment: 'node'` (no jsdom). Writing a test that mounts `SessionEditModal` or calls `rehydrateProfiles` directly will not run.
**How to avoid:** extract pure reducers (`mergeAuthoritativeProfiles`, `validateSessionForm`) importing only `../shared/types`; test those. This is the established repo pattern (`session-edit.ts`, `apply-status-event.ts`).

### Pitfall 3: live-CSS injection previewing old markup for a structural change
**What goes wrong:** the D-02 two-group regroup is a TSX structural change; `UI_LAB_LIVE_CSS=1` injects CSS onto the OLD markup → the preview lies.
**How to avoid:** use `npm run ui:shots:fresh` (packaged) for the proof capture of any structural change. Live-CSS is only valid for pure CSS-value tweaks.

### Pitfall 4: minting a new IPC for "Working directory not found"
**What goes wrong:** instinct is to add a `validatePath` probe IPC to show the rejection inline → grows `EXPECTED_API_KEYS` past 20, fails `security.guard`, duplicates CR-01.
**How to avoid:** the rejection ALREADY flows as `row.errorMessage` (via the `onPtyStatus` notice → `applyStatusEvent`). Thread that existing value into the form. Zero new IPC (D-04).

### Pitfall 5: status/errorMessage corruption in the merge
**What goes wrong:** a careless `mergeAuthoritativeProfiles` that spreads main's full record would clobber the renderer-owned `status`/`errorMessage`/`agentState` (owned by `onPtyStatus`, not `listSessions`).
**How to avoid:** the reducer copies ONLY `cwd`/`shell`/`startupCommand`/`configured` (mirroring `SessionManager.tsx:395-402`). Unit-test (c) asserts status/errorMessage are untouched.

## Open Questions

1. **O-1 — first edit-open default cwd display (SESS-05).** After `onAdd`, main resolves an unspecified cwd to `os.homedir()` (`pty-manager.ts:314`); `rehydrateProfiles` then pulls that into the row (`onAdd:452`). So the first edit-open likely shows the resolved home path, not empty.
   - Recommendation: verify live which renders, and pick the clearer behavior (resolved-home is probably clearer than a blank field). This is a **human-verify** decision, part of the BLOCKING gate — not an automated test.
2. **Keep IdleCard error card AND inline form error, or move it?** D-04 says surface CR-01 inline "instead of only as the post-Start error card."
   - Recommendation: keep both surfaces (they fire at different moments — IdleCard post-Start, inline form on Save/Start from the modal). Planner's call; low risk either way.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | unit tests | ✓ | repo-pinned | — |
| WebdriverIO | smoke + ui-lab | ✓ | repo-pinned | — |
| Electron Forge `package` | `ui:shots:fresh` packaged proof | ✓ | repo-pinned | — |
| Native OS folder dialog | SESS-06 live-verify | ✓ (macOS now; Windows = carried UAT tail) | OS | — |

**Missing dependencies:** none blocking. (Per project memory, Windows real-hardware UAT is the carried tail across the v1.x milestone — SESS-06 packaged Browse… on Windows is part of that tail, not a Phase-12 blocker on macOS.)

## Security Domain

`security_enforcement` applies but the surface is trivial (see §3). 

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (trivially) | React auto-escaped text nodes + fixed literal validation strings; renderer pre-checks are convenience-only, main's CR-01 is the validator of record |
| V1/V2/V3/V4/V6 | no | No auth/session/access-control/crypto change; no new bridge key; no new channel |

| Threat Pattern | STRIDE | Mitigation |
|----------------|--------|------------|
| Arbitrary path → cwd | Tampering | CR-01 guard (`pty-manager.ts:305`, absolute + `statSync().isDirectory()`) — unchanged, the validator of record |
| Notice-string injection in inline error | Tampering/XSS | `sanitizeNotice()` in main (`pty-manager.ts:310`) + React text-node escaping; fixed literals only |
| New IPC surface | Elevation | NONE — `EXPECTED_API_KEYS` stays 20, asserted by `security.guard.test.ts` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `isAbsolutePathish` can be a pure cross-platform string check sufficient for a neutral *format* hint (not existence) | §2 | LOW — it's a hint only; CR-01 is the real gate. A weak check just shows/hides a calm hint. |
| A2 | Keeping both the IdleCard error card and the inline-form error is acceptable (vs moving) | Open Q2 | LOW — cosmetic; planner/operator decides at human-verify. |
| A3 | First edit-open shows resolved-home cwd (not empty) for a fresh session | O-1 | LOW — explicitly a live-verify item; the gate confirms. |

**Everything else in this research is `[VERIFIED]` against the live tree at the cited file:line.**

## Sources

### Primary (HIGH confidence — all verified in-repo)
- `src/renderer/SessionEditModal.tsx` — form structure, Browse… (194-205), testids, Save class (281), seed effect (68-75)
- `src/renderer/SessionManager.tsx` — `rehydrateProfiles` (388-405), `handleSaveProfile` (407-426), `onAdd` (436-454), errorMessage→IdleCard (699)
- `src/renderer/session-edit.ts` + `__tests__/session-edit.test.ts` — the pure-reducer + Wave-0 RED pattern to mirror
- `src/renderer/apply-status-event.ts` (61-66) — how an error `notice` becomes `row.errorMessage`
- `src/main/pty-manager.ts` (305-314) — CR-01 cwd guard + the `Working directory not found` notice (validator of record)
- `src/main/window-config.ts` (100-121) — `EXPECTED_API_KEYS` = 20, `pickDirectory` present
- `src/shared/__tests__/security.guard.test.ts` (48-52) — the === EXPECTED_API_KEYS assertion
- `vitest.config.ts` (7) — `environment: 'node'` (no jsdom)
- `tests/ui-lab/surfaces.ts` (105-132, 400-417) — `edit-modal` surface + helpers
- `tests/ui-lab/DESIGN-RUBRIC.md` (108-115) — `§edit-modal` rubric to update
- `tests/smoke/session-edit.smoke.test.ts` + `tests/smoke/helpers/xterm-driver.ts` (266) — smoke + `clickMenuItem`
- `package.json` scripts — `test:unit` / `test` / `ui:shots` / `ui:shots:fresh`
- `12-CONTEXT.md`, `12-UI-SPEC.md` — locked decisions + visual contract

## Metadata

**Confidence breakdown:**
- Test architecture / seams: HIGH — the pure-reducer pattern is established and verified across 6+ existing modules; Vitest env confirmed.
- SESS-05/06 already-wired: HIGH — every cited line verified present in the live tree.
- Threat model LIGHT / keys=20: HIGH — counted the array, verified the guard test.
- Visual SC mechanics: HIGH — surfaces + rubric + run scripts verified.

**Research date:** 2026-06-15
**Valid until:** 30 days (stable locked chassis; no fast-moving external deps)
