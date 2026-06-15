---
phase: 12-session-form-polish-edit-ux
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/renderer/merge-profiles.ts
  - src/renderer/validate-session-form.ts
  - src/renderer/SessionEditModal.tsx
  - src/renderer/SessionManager.tsx
  - src/renderer/form.css
  - src/renderer/terminal.css
  - src/renderer/index.tsx
  - src/renderer/__tests__/merge-profiles.test.ts
  - src/renderer/__tests__/validate-session-form.test.ts
  - src/renderer/__tests__/tokens-completeness.test.ts
  - tests/smoke/helpers/xterm-driver.ts
  - tests/smoke/session-edit.smoke.test.ts
  - tests/smoke/startup-command.smoke.test.ts
  - tests/ui-lab/surfaces.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
  fixed: 5
  deferred: 3
status: resolved
resolution: "5 fixed in-phase (WR-01/WR-02/WR-03/IN-01/IN-03); 3 deferred (WR-04→Phase14/DEBT-02 lifecycle, WR-05→harness debt, IN-02→Phase13). See deferred-items.md."
---

# Phase 12: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 12 delivers three artifacts: the `mergeAuthoritativeProfiles` pure reducer (SESS-05 edit-prefill), the `validateSessionForm` inline-validation helper (D-04), and the `SessionEditModal` form with Browse… folder-picker wiring. The CSS was extracted from `terminal.css` into `form.css` (Plan 12-02). No new IPC bridge keys were introduced — `pickDirectory` was already key 19; `listSessions` is reused for rehydration; EXPECTED_API_KEYS stays at 20.

The two new pure reducers are logically correct and well-immutability-disciplined. The security boundary holds: no `innerHTML`/`dangerouslySetInnerHTML`, no `eval`, no new bridge keys, and the cwd error notice is rendered as a React text node (auto-escaped). The 800-line hard rule is obeyed by all new source files. No hardcoded secrets or debug artifacts were found.

Five warnings and three info items were found. No blockers exist.

## Resolution (orchestrator, 2026-06-15)

| Finding | Disposition | Commit / Route |
|---------|-------------|----------------|
| WR-01 (terminal-area.css token scan) | **FIXED** | `ef52d53` — added to tokens-completeness (no latent drift found) |
| WR-02 (form.css scrim literal) | **FIXED** | `a8df866` — tokenized as `--scrim` |
| WR-03 (smoke field-setter) | **FIXED** | `9c75193` — native-setter; session-edit smoke 2/2 GREEN |
| IN-01 (merge undefined contract) | **FIXED** | `07d9fa7` — test locks "main truth wins" |
| IN-03 (handleSave comment) | **FIXED** | `fd0e8a2` — comment corrected |
| WR-04 (confirmClose stale snapshot) | **DEFERRED → Phase 14 / DEBT-02** | benign (no data loss); lifecycle code requires Phase-14 human re-verify |
| WR-05 (idle-card "Stop" surface) | **DEFERRED → harness debt** | pre-existing (Phase 11); unrelated to session form |
| IN-02 (SessionManager 795 lines) | **DEFERRED → Phase 13** | proactive split before Phase 13 form work |

Post-fix gate: `npm run test:unit` 420/420, `tsc` 0, lint clean, `security.guard` GREEN (EXPECTED_API_KEYS=20), session-edit smoke 2/2. See `deferred-items.md` for the deferred-finding detail + the corrected `pty-resize.smoke` flake classification.

## Warnings

### WR-01: `terminal-area.css` is absent from `tokens-completeness.test.ts` — token drift goes undetected

**File:** `src/renderer/__tests__/tokens-completeness.test.ts:35-38`
**Issue:** The completeness guard reads `tokens.css`, `terminal.css`, `sidebar.css`, `form.css`, and `status-colors.ts`. `terminal-area.css` (added in Phase 11, imported in `index.tsx:25`) is NOT in the scanned set. That file contains 77 `var(--token)` references. A future token rename or removal in `tokens.css` would silently break `terminal-area.css` at runtime without any test failure — exactly the "fails loudly" contract the test was designed to enforce (see test comment: "A referenced-but-undefined token would resolve to the CSS initial value silently at runtime — this test fails loudly instead").

**Fix:** Add a `terminal-area.css` read and a corresponding test case in the same pattern as `form.css` (lines 35-38 and 111-120):
```typescript
const terminalAreaCss = readFileSync(
  resolve(__dirname, '../terminal-area.css'),
  'utf8',
);
// ... inside describe('tokens.css single source of truth'):
it('every var(--token) in terminal-area.css is defined in tokens.css', () => {
  const referenced = referencedTokens(terminalAreaCss);
  const undefinedRefs = [...referenced].filter((t) => !defined.has(t));
  expect(undefinedRefs).toEqual([]);
});
```

---

### WR-02: `form.css` hardcodes the scrim `oklch(0.255 0.018 264 / 0.45)` as a raw literal, bypassing tokens.css

**File:** `src/renderer/form.css:26`
**Issue:** The `.modal-overlay` background is `oklch(0.255 0.018 264 / 0.45)` — a raw literal. Tokens.css defines `--term-bg: #1e232c /* = oklch(0.255 0.018 264) */`, `--shadow-dialog`, and `--shadow-menu` using the same base chroma, but there is no `--scrim` or `--modal-overlay-bg` token. The `tokens-completeness.test.ts` literal-absence suite does NOT scan for this specific value (it only checks the migrated accent-blue and danger-red literals, per lines 183-198), so this literal passes both the test and the linter silently.

Per the file's own stated policy (line 12-13): "The only permitted literals are element dimensions (dialog width, tile sizes) and the single #ffffff button text." A scrim alpha-blend of the base chroma is not a dimension, so this violates the stated policy. If the dark palette ever changes, the scrim will diverge from every other dark surface.

**Fix:** Add a `--scrim` token to `tokens.css`:
```css
--scrim: oklch(0.255 0.018 264 / 0.45); /* modal overlay */
```
Then in `form.css:26`:
```css
background: var(--scrim);
```

---

### WR-03: `SESS-05` smoke test uses `setEditFieldByTestId` (bare `input.value` + `dispatchEvent('input')`) — React state does NOT update, so `readEditFieldByTestId` asserts DOM value while React state (`cwd`) stays at the seeded value

**File:** `tests/smoke/session-edit.smoke.test.ts:114-115` and `tests/smoke/helpers/xterm-driver.ts:291-303`
**Issue:** `setEditFieldByTestId` sets `input.value = v` then dispatches a synthetic `input` event. React 19's controlled-input tracker does NOT recognise a bare `dispatchEvent(new Event('input'))` as a legitimate change — it only does so when dispatched via the native `HTMLInputElement.prototype.value` setter (the "tracker-bypass" idiom documented in `surfaces.ts:132-152`). As a result, React's `onChange` handler is NOT invoked, so the controlled-state variable (`cwd`) stays at the session's seeded value from the `useEffect`.

`handleSave` in `SessionEditModal.tsx:124-132` reads the live DOM via refs as a fallback, so the save path picks up the programmatically-written value correctly — **the round-trip test will pass**. However, the inline validation notices (line 151: `validateSessionForm({ name, cwd, startupCommand })`) are computed from **React state**, not DOM. This means:
- After `setEditFieldByTestId('edit-cwd', 'relative/path')` the cwd state remains at the seeded absolute path — no validation hint renders. The `edit-modal-validation` ui-lab surface uses `setInputByTestId` (the correct native-setter path), but the xterm-driver helper used by the SESS-05 smoke does not. The validation rendering goes untested by the smoke path.

This is not a data-loss bug (the save round-trip is correct), but the smoke test's implicit claim that it exercises the validation rendering path is false.

**Fix:** In `tests/smoke/helpers/xterm-driver.ts`, update `setEditFieldByTestId` to use the native setter pattern (same as `setInputByTestId` in `surfaces.ts:138-147`):
```typescript
// In setEditFieldByTestId browser.execute callback:
const setter = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(input) as object,
  'value',
)?.set;
if (setter) setter.call(input, v);
else input.value = v;
input.dispatchEvent(new Event('input', { bubbles: true }));
```
This ensures validation state and save state use the same mechanism.

---

### WR-04: `confirmClose` closes over the `sessions` render-time snapshot for the `isConfiguredLive` check — can read a stale row between a rapid status update and the confirm click

**File:** `src/renderer/SessionManager.tsx:185-229`
**Issue:** `confirmClose` (line 185) is a `useCallback` with deps `[closingId, activeId, sessions, removeMode]`. The `row` lookup on line 188 reads from the closed-over `sessions` value at the time the callback was last recreated. If a `onPtyStatus` event fires between the user right-clicking "Remove" and clicking "Remove" in the confirm modal (a plausible race — the modal takes a human interaction to confirm), `sessions` in the closure will be stale relative to the functional updates applied by the `onPtyStatus` effect. Specifically, if a session's `status` transitions from `'running'` to `'exited'` during this window, `isConfiguredLive` would evaluate against the OLD status (`'running'`), triggering the `ptyStop` path when the PTY is already gone. `ptyStop` on a dead PID is a no-op in Electron (fire-and-forget), so this does not cause data loss, but the optimistic `not_started` flip could race the `applyStatusEvent` that correctly handles the exit.

**Fix:** Read the `row` inside the functional `setSessions` updater so it sees the up-to-date list:
```typescript
const confirmClose = useCallback(() => {
  if (closingId === null) return;
  const id = closingId;
  setSessions((prev) => {
    const row = prev.find((s) => s.logicalId === id) ?? null;
    const isConfiguredLive =
      removeMode === 'remove' &&
      row !== null &&
      row.configured === true &&
      row.status !== 'not_started';
    if (isConfiguredLive) {
      window.api.ptyStop(id);
      return prev.map((r) =>
        r.logicalId === id
          ? { ...r, status: 'not_started', ptyPid: undefined, agentState: undefined, errorMessage: undefined }
          : r,
      );
    }
    window.api.ptyClose(id);
    const result = closeSession(prev, activeId, id);
    setActiveId(result.activeId);
    return result.sessions;
  });
  setClosingId(null);
}, [closingId, activeId, removeMode]);
```
Note: `activeId` is still needed for `closeSession`. The `sessions` dep can be dropped.

---

### WR-05: `ui-lab/surfaces.ts` `idle-card` surface clicks a "Stop" context-menu item that no longer exists in Phase 12's menu

**File:** `tests/ui-lab/surfaces.ts:384-402`
**Issue:** The `idle-card` surface's `prepare` function opens the context menu for `ctx.ids[1]` and checks `labels.includes('Stop')` (line 387), clicking it if present and throwing `SkipSurface` if absent. After Phase 11 (SESS-07 / D-01), the context menu no longer has a "Stop" item — the only items for a running session are `Edit`, optionally `Start without command`, and `Remove` (see `SessionManager.tsx:730-763`). The menu has never had a "Stop" label in Phase 12.

The surface is therefore always `SkipSurface`-thrown in this phase. It will never be exercised. The dormant `IdleCard` state goes un-captured by the ui-lab run.

**Fix:** Replace the "Stop" path with "Remove" to reach the dormant state correctly, mirroring what the smoke tests and other ui-lab surfaces do (e.g. `inactive-recipes` surface at lines 596-619):
```typescript
// Replace Stop check with Remove
const labels = await contextMenuLabels();
if (!labels.includes('Remove')) {
  await pressEscape();
  await waitForTestIdGone('context-menu');
  throw new SkipSurface(`context menu has no "Remove" item (items: ${labels.join(', ')})`);
}
await clickMenuItem('Remove');
await waitForTestId('confirm-modal');
await clickByTestId('confirm-close');  // confirm the Remove
await waitForTestIdGone('confirm-modal');
await clickSidebarRow(idB);
```
This will land the row in the Inactive List in the `not_started` state, at which point `waitForTestId('idle-card', 10000)` will work as before.

---

## Info

### IN-01: `mergeAuthoritativeProfiles` spreads `truth.startupCommand` (optional field) which may be `undefined`, converting the receiver's non-optional or existing value

**File:** `src/renderer/merge-profiles.ts:37`
**Issue:** `SessionRecord.startupCommand` is typed as `string | undefined` (optional). The spread `...row, startupCommand: truth.startupCommand` will set `startupCommand: undefined` on the merged row if main returned a record with `startupCommand` absent. This is defensively intentional (main's truth wins), but the test suite does not include a case where `truth.startupCommand` is `undefined` and the row has a non-empty `startupCommand`. If main ever omits the field for an existing session (e.g. during a schema migration), the renderer would silently blank the startup command displayed in the form. The companion test case at `merge-profiles.test.ts:79-84` checks `configured: undefined` fallback but not `startupCommand: undefined`.

**Suggestion:** Add a test case for `truth.startupCommand === undefined` to make the "main wins even on undefined" contract explicit:
```typescript
it('truth.startupCommand=undefined overwrites row.startupCommand (main truth wins)', () => {
  const rows = [makeRow('a', { startupCommand: 'existing-cmd' })];
  const authoritative = [makeRow('a', { startupCommand: undefined })];
  const result = mergeAuthoritativeProfiles(rows, authoritative);
  expect(result[0].startupCommand).toBeUndefined();
});
```
If the intended contract is "undefined in truth means preserve row value", then the implementation needs a `?? row.startupCommand` guard analogous to the `configured` field on line 39.

---

### IN-02: `SessionManager.tsx` is at 795 lines — one line under the 800-line hard rule

**File:** `src/renderer/SessionManager.tsx`
**Issue:** The file is currently 795 lines (`wc -l` confirmed). The CLAUDE.md / coding-style hard rule is 800 lines maximum. Phase 13 adds more form-adjacent code. Even one new helper or comment block pushes past the limit. The file is already close enough that any substantive addition in Phase 13 will require an immediate reactive split, which is more disruptive than a proactive split now.

**Suggestion:** Consider extracting the `confirmClose` / `handleCloseRequest` / `handleDeleteRequest` / `cancelClose` group (lines 171-229, ~59 lines) into a `session-lifecycle-actions.ts` helper before Phase 13 begins, in the same pattern as `session-add.ts` / `session-close.ts`.

---

### IN-03: The `handleSave` function in `SessionEditModal.tsx` reads shell from `shellRef.current?.value` but the `<select>` `value` prop is controlled via a derived expression — the ref could transiently differ from intended value during discovery

**File:** `src/renderer/SessionEditModal.tsx:130-131`
**Issue:** The `<select>` renders a `value` prop of `shells.some((s) => s.path === shell) ? shell : (shells[0]?.path ?? '')` (line 291-293), but the `shell` state is only updated by `onChange` on the `<select>` (line 295). If the user opens the form, discovery lands, the pre-seeded `shell` is not in the discovered list (so the select shows `shells[0]`), and the user immediately hits Save without touching the select, then `shellRef.current?.value` will read `shells[0].path` (the DOM value React rendered via the derived expression), which differs from the `shell` state variable. This is the correct behavior — the code intends to use the DOM value when shells have resolved (`shells !== null`) — but the comment on line 130-131 says "fall back to the seeded `shell`" while the actual semantic is "use the DOM value (which may be `shells[0]` if the saved shell was removed from the discovered list)". The logic is safe in practice but the comment is misleading.

**Suggestion:** Clarify the comment at line 130:
```typescript
// When discovery has resolved, the <select>'s DOM value is authoritative — it
// reflects either the matched saved shell or shells[0] if the saved shell is no
// longer present. While in-flight (shells === null), keep the saved shell unchanged.
const shellValue = shells !== null ? (shellRef.current?.value ?? shell) : shell;
```

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
