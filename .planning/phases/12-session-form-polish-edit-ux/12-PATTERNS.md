# Phase 12: Session Form — Polish + Edit UX - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/merge-profiles.ts` | utility (pure reducer) | transform | `src/renderer/session-edit.ts` + inline `rehydrateProfiles` (`SessionManager.tsx:388-405`) | exact |
| `src/renderer/validate-session-form.ts` | utility (pure reducer) | transform | `src/renderer/session-edit.ts` | exact |
| `src/renderer/__tests__/merge-profiles.test.ts` | test | — | `src/renderer/__tests__/session-edit.test.ts` | exact |
| `src/renderer/__tests__/validate-session-form.test.ts` | test | — | `src/renderer/__tests__/session-edit.test.ts` | exact |
| `src/renderer/SessionEditModal.tsx` (MODIFY) | component | request-response | `src/renderer/ConfirmModal.tsx` (overlay/scrim/a11y skeleton) | role-match |
| `src/renderer/IconPicker.tsx` (MODIFY) | component | event-driven | existing `IconPicker.tsx` CSS patterns in `terminal.css:281-360` | self-analog (CSS polish only) |
| `src/renderer/terminal.css` (MODIFY, candidate `form.css` extract) | config/style | — | existing form block `terminal.css:376-493` | self-analog |
| `tests/ui-lab/surfaces.ts` + `DESIGN-RUBRIC.md` (MODIFY) | test/config | — | existing `edit-modal` surface entry `surfaces.ts:400-417` | self-analog |

---

## Pattern Assignments

### `src/renderer/merge-profiles.ts` (new, pure reducer)

**Analog 1:** `src/renderer/session-edit.ts` (file header + module shape)
**Analog 2:** inline map inside `SessionManager.tsx:388-405` (the logic to extract)

**File header pattern** (`session-edit.ts:1-7`):
```typescript
// RENDERER ONLY — the pure edit-split reducer (04-01, D-02).
//
// Imports ONLY ../shared/types (type-only) — never React/xterm/electron — so the
// live-vs-restart field split unit-tests in the Node/Vitest env (mirrors
// session-close.ts). No side effects: the caller (SessionManager) performs the
// `setSessions` live-apply (name/icon) AND the `window.api.ptyUpdateProfile`
// restart-apply (cwd/shell/startupCommand) using the two halves this returns.

import type { SessionIconSpec } from '../shared/types';
```

**Core logic to extract** (`SessionManager.tsx:383-405`):
```typescript
// (from the rehydrateProfiles useCallback — extract this map into the pure module)
const rehydrateProfiles = useCallback(async () => {
  const authoritative = await window.api.listSessions();
  const byId = new Map(authoritative.map((r) => [r.logicalId, r]));
  setSessions((prev) =>
    prev.map((row) => {
      const truth = byId.get(row.logicalId);
      if (!truth) return row;
      return {
        ...row,
        cwd: truth.cwd,
        shell: truth.shell,
        startupCommand: truth.startupCommand,
        // Carry main's configured truth (D-02 — never downgrade a kept session).
        configured: truth.configured ?? row.configured,
        // status and errorMessage are NOT touched here (owned by onPtyStatus sub).
      };
    }),
  );
}, []);
```

**Required module shape** (from RESEARCH.md §Reducer 1):
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

**After extraction — `rehydrateProfiles` becomes** (`SessionManager.tsx:388-405` rewire):
```typescript
// Thin wrapper after extraction:
const rehydrateProfiles = useCallback(async () => {
  const authoritative = await window.api.listSessions();
  setSessions((prev) => mergeAuthoritativeProfiles(prev, authoritative));
}, []);
```

**Critical invariant:** `status` and `errorMessage` MUST NOT be spread from `authoritative` — those fields are exclusively owned by the `onPtyStatus` subscription. Only copy `cwd`, `shell`, `startupCommand`, `configured`.

---

### `src/renderer/validate-session-form.ts` (new, pure reducer)

**Analog:** `src/renderer/session-edit.ts` (module shape)

**File header pattern** (mirror `session-edit.ts:1-7`):
```typescript
// RENDERER ONLY — the pure inline-validation helper (12-01, D-04).
//
// Imports nothing external — no React/xterm/electron/shared/types needed — so the
// validation rules unit-test in the Node/Vitest env. Main's CR-01 guard remains
// the validator of record; these are convenience-only UX hints. 0 new IPC.
```

**Core module shape** (from RESEARCH.md §2):
```typescript
export type FieldTone = 'hint' | 'error'; // hint → --ink-faint; error → --color-danger
export interface FieldNotice { tone: FieldTone; message: string; }

export interface FormFieldValues {
  name: string;
  cwd: string;
  startupCommand: string;
}

/** Pure, renderer-cheap pre-checks. Main's CR-01 stays the validator of record;
 *  these are convenience-only UX hints (D-04). Empty name is a HINT (valid), not error. */
export function validateSessionForm(
  f: FormFieldValues,
): Partial<Record<keyof FormFieldValues, FieldNotice>> {
  const out: Partial<Record<keyof FormFieldValues, FieldNotice>> = {};
  if (f.name.trim().length === 0) {
    out.name = { tone: 'hint', message: 'Keeps the current name' };
  }
  if (f.cwd.trim().length > 0 && !isAbsolutePathish(f.cwd)) {
    out.cwd = { tone: 'hint', message: 'Enter an absolute path, or use Browse…' };
  }
  // startupCommand: optional — no validation; empty is valid (D-04).
  return out;
}
```

**`isAbsolutePathish` helper** — renderer-safe, no `path` module:
```typescript
/** Cross-platform absolute-path format check (renderer-safe — no `path` module).
 *  Accept POSIX /…, Windows C:\… or \\unc. Format hint only — not existence. */
function isAbsolutePathish(s: string): boolean {
  return /^\//.test(s) || /^[A-Za-z]:[/\\]/.test(s) || /^\\\\/.test(s);
}
```

**Copy is FROZEN** (UI-SPEC §Copywriting — do not alter these strings):
- Empty name hint: `'Keeps the current name'`
- cwd format hint: `'Enter an absolute path, or use Browse…'`
- cwd rejection (from main, thread as prop): `'Working directory not found'`

**How `errorMessage` (CR-01 rejection) reaches the form without new IPC** (RESEARCH.md §2):
```
main: pty-manager.ts:305-312 → status:'error' + notice:'Working directory not found: <cwd>'
  → PTY_CHANNELS.status broadcast
renderer: applyStatusEvent (apply-status-event.ts:61-66) → row.errorMessage = notice
  → SessionManager passes errorMessage to SessionEditModal as a new prop
  → modal renders it under the cwd field when tone='error'
```
No new IPC channel. Thread the existing `row.errorMessage` prop into `SessionEditModal`.

---

### `src/renderer/__tests__/merge-profiles.test.ts` (new, test)

**Analog:** `src/renderer/__tests__/session-edit.test.ts` (exact shape to copy)

**Wave-0 RED stub header pattern** (`session-edit.test.ts:1-6`):
```typescript
// Wave 0 RED stub (04-01 Task 1) — covers SESS-01/02/04 / D-02 the edit split.
//
// INTENTIONALLY FAILS RED until 04-01 Task 2 implements src/renderer/session-edit.ts
// (splitEdit). Targets the React/xterm/electron-free pure reducer (mirrors
// session-close.test.ts) so it runs in the Node/Vitest env.

import { describe, it, expect } from 'vitest';
import { splitEdit } from '../session-edit';
```

**Test body pattern** (`session-edit.test.ts:10-44`):
```typescript
describe('splitEdit live-vs-restart field reducer (D-02)', () => {
  it('splits a form payload into the live half (name/icon) and the restart half (...)', () => {
    const result = splitEdit({ ... });
    expect(result).toEqual({ ... });
  });

  it('keeps the live and restart halves disjoint (no field crossover)', () => {
    ...
    expect(Object.keys(result.live).sort()).toEqual([...]);
    expect(Object.keys(result.restart).sort()).toEqual([...]);
  });
});
```

**Four REQUIRED test cases** (from RESEARCH.md §Reducer 1 RED→GREEN):
1. Freshly-spawned row with `cwd: ''` → merges main's resolved cwd (the Phase-6 todo root cause).
2. Stale submitted cwd → merges main's persisted (validated/trimmed) truth.
3. `status`/`errorMessage` on the row → byte-identical after merge (the `onPtyStatus` invariant).
4. Unknown `logicalId` → row returned unchanged (the `if (!truth) return row` branch).

---

### `src/renderer/__tests__/validate-session-form.test.ts` (new, test)

**Analog:** `src/renderer/__tests__/session-edit.test.ts` (same Wave-0 RED header shape)

**Required test cases** (from RESEARCH.md §2 RED→GREEN):
```typescript
// empty name → hint
expect(validateSessionForm({ name: '', cwd: '/abs', startupCommand: '' }))
  .toEqual({ name: { tone: 'hint', message: 'Keeps the current name' } });

// whitespace-only name → same hint
expect(validateSessionForm({ name: '   ', cwd: '/abs', startupCommand: '' }))
  .toEqual({ name: { tone: 'hint', message: 'Keeps the current name' } });

// non-absolute cwd → format hint
expect(validateSessionForm({ name: 'dev', cwd: 'relative/path', startupCommand: '' }))
  .toEqual({ cwd: { tone: 'hint', message: 'Enter an absolute path, or use Browse…' } });

// valid absolute cwd → no cwd notice
expect(validateSessionForm({ name: 'dev', cwd: '/Users/me/project', startupCommand: '' }))
  .toEqual({});

// empty startup → no notice
expect(validateSessionForm({ name: 'dev', cwd: '/abs', startupCommand: '' }))
  .toEqual({});
```

---

### `src/renderer/SessionEditModal.tsx` (MODIFY)

**Analog:** current `SessionEditModal.tsx` (restructure in-place)

**Current structure** (lines 138-291 — the JSX to restructure):
```tsx
// Current raw-stack flat layout:
<div className="modal-overlay" data-testid="session-edit-modal" onClick={onCancel}>
  <div className="modal-dialog modal-dialog-edit" role="dialog" ...>
    <h2 id={titleId} className="modal-title">Edit session</h2>

    {/* Group A fields (currently NOT grouped) */}
    <div className="edit-field">          {/* Name */}
    <div className="edit-field">          {/* Icon */}

    {/* Group B — already has container but no section subhead */}
    <div className="edit-restart-group">
      <p className="applies-on-restart-hint" data-testid="applies-on-restart">
        Applies on restart
      </p>
      <div className="edit-field">        {/* cwd + Browse… */}
      <div className="edit-field">        {/* Shell select */}
      <div className="edit-field">        {/* Startup command */}
    </div>

    <div className="modal-actions">
      <button className="modal-btn modal-btn-cancel" data-testid="edit-cancel">Cancel</button>
      {/* PITFALL: currently modal-btn-confirm = RED — MUST change to constructive blue */}
      <button className="modal-btn modal-btn-confirm context-menu-item" data-testid="edit-save">Save</button>
    </div>
  </div>
</div>
```

**D-02 restructure target** — two semantic groups:
```tsx
{/* Group A — IDENTITY (applies LIVE) */}
<div className="edit-group edit-group-identity">
  <p className="edit-group-subhead">Identity</p>
  <div className="edit-field">  {/* Name + inline hint from validateSessionForm */}
  <div className="edit-field">  {/* IconPicker */}
</div>

{/* Group B — LAUNCH (applies on restart) — reuse applies-on-restart testid */}
<div className="edit-restart-group">
  <p className="applies-on-restart-hint" data-testid="applies-on-restart">
    Launch · Applies on restart
  </p>
  <div className="edit-field">  {/* cwd + Browse… + inline hint/error */}
  <div className="edit-field">  {/* Shell */}
  <div className="edit-field">  {/* Startup command */}
</div>

{/* Save button: MUST use constructive-blue class, NOT modal-btn-confirm */}
<button className="modal-btn modal-btn-save context-menu-item" data-testid="edit-save">
  Save changes
</button>
```

**Props to add for D-04 inline validation** (new prop threading):
```tsx
export interface SessionEditModalProps {
  // ... existing props ...
  /** The active session's errorMessage (from onPtyStatus → applyStatusEvent).
   *  When it matches the CR-01 cwd-rejection pattern, rendered inline under cwd. */
  errorMessage?: string;
}
```

**Validation display pattern** (under cwd field, mirrors Phase-10 D-15 danger ramp):
```tsx
{/* Inline validation under cwd field */}
{cwdNotice && (
  <span className={`edit-field-notice edit-field-notice--${cwdNotice.tone}`}>
    {cwdNotice.message}
  </span>
)}
```

**Seed effect** (lines 68-75, already correct — preserve unchanged):
```tsx
useEffect(() => {
  if (!open || session === null) return;
  setName(session.name);
  setIcon(session.icon);
  setCwd(session.cwd);
  setShell(session.shell);
  setStartupCommand(session.startupCommand ?? '');
}, [open, session]);
```

**Frozen testids** — must ALL survive the restructure unchanged:
`session-edit-modal`, `edit-name`, `edit-cwd`, `browse-cwd`, `edit-shell`,
`edit-startup`, `applies-on-restart`, `edit-save`, `edit-cancel`,
`icon-picker`, `edit-emoji-text`

The `.context-menu-item` class on Save MUST stay (smoke uses `clickMenuItem('Save')`).
The `edit-save` testid MUST stay even though visible label changes to `Save changes`.

---

### `src/renderer/IconPicker.tsx` (MODIFY — CSS polish)

**Analog:** existing `IconPicker.tsx` (self-analog) + CSS block `terminal.css:281-360`

**Current JSX structure** (lines 39-92 — preserve, polish CSS only):
```tsx
<div className="icon-picker" data-testid="icon-picker">
  <div className="icon-picker-preview" aria-label="Selected icon preview">
    {renderIcon(value, name)}
  </div>
  <div className="emoji-grid" role="group" aria-label="Curated emoji">
    {CURATED_EMOJI.map((glyph) => (
      <button key={glyph} type="button"
        className={value.type === 'emoji' && value.value === glyph ? 'emoji-cell selected' : 'emoji-cell'}
        aria-pressed={value.type === 'emoji' && value.value === glyph}
        onClick={() => onChange(emojiSpec(glyph))}
      >{glyph}</button>
    ))}
  </div>
  <input type="text" className="emoji-input" data-testid="edit-emoji-text" ... />
  <div className="color-swatches" role="group" aria-label="Color icon">
    {COLOR_SWATCHES.map((color) => (
      <button key={color} type="button"
        className={value.type === 'color' && value.value === color ? 'color-swatch selected' : 'color-swatch'}
        style={{ background: color }}
        aria-pressed={value.type === 'color' && value.value === color}
        onClick={() => onChange(colorSpec(color))}
      />
    ))}
  </div>
</div>
```

**Current CSS classes to polish** (`terminal.css:281-360`):
```css
/* emoji-cell — currently: border: 1px solid transparent; border-radius: 8px; */
.emoji-cell.selected { border-color: var(--line); background: var(--bg-sunk); }

/* Target polish: hover/selected states use tokens; focus-visible ring */
.emoji-cell:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }

/* color-swatch — currently: border: 2px solid transparent; border-radius: 8px; */
.color-swatch.selected { border-color: var(--ink); }

/* Target: snap swatch gap (currently 6px=non-canonical) to --space-2 (8px) */
.color-swatches { gap: var(--space-2); }  /* was: gap: 6px */

/* emoji-input — currently: padding: 7px 10px (non-canonical); snap to tokens */
.emoji-input { padding: var(--space-3) var(--space-4); }  /* 12px 16px → tune in ui-lab */
```

**The picker stays inline (not a popover)** unless the dialog overflows `max-height: calc(100vh - 64px)` during the ui-lab loop — in that case switch to popover (Discretion, D-03).

---

### `src/renderer/terminal.css` (MODIFY — form block) / candidate `src/renderer/form.css`

**Analog:** existing form block `terminal.css:376-493` (self-analog)

**Current form CSS location:** `terminal.css` lines 376-493 (118 lines of form CSS).
**Current `terminal.css` total:** 493 lines — already at 61% of the 800-line limit.
**Planner's decision guidance:** Phase 12 adds new CSS (section subheads, validation-notice rules, picker polish, Save constructive-blue). Estimate +40-60 lines. Terminal.css would reach ~550 lines — within the 800-line budget but tight. Extract to `form.css` now to preserve headroom for Phase 13 (UI-06 hover/focus sweep will add more). If extracted, `terminal.css` line 376-493 moves to `form.css` and `terminal.css` imports it (or the HTML `<link>` references it alongside).

**Pre-token literals to snap during ui-lab** (RESEARCH.md §4):
```css
/* These one-offs snap to the nearest clean --space-* step: */
22px dialog top-pad      → var(--space-6) = 24px  (or keep 22 if 24 reads too loose)
2px restart-group pad    → var(--space-1) = 4px
6px swatch gap           → var(--space-2) = 8px
10px input vertical pad  → var(--space-3) = 12px  (or keep 8px → var(--space-2))
```

**New CSS rules to add** (tokens-first, no literals):

```css
/* Section subhead — shared by Group A "Identity" and Group B (existing applies-on-restart-hint).
   Currently applies-on-restart-hint is font-size:11px/uppercase/ink-faint; align it: */
.edit-group-subhead,
.applies-on-restart-hint {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin: 0 0 var(--space-3);  /* 12px */
}

/* Hairline divider between Identity and Launch groups */
.edit-group-divider {
  border: none;
  border-top: 1px solid var(--line-soft);
  margin: var(--space-5) 0;  /* 20px */
}

/* Inline validation notice (D-04) */
.edit-field-notice {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.3;
  margin-top: var(--space-1);  /* 4px */
}
.edit-field-notice--hint { color: var(--ink-faint); }
.edit-field-notice--error { color: var(--color-danger); }

/* Save button — constructive blue (replaces modal-btn-confirm red for this surface) */
.modal-btn-save {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #ffffff;
}
.modal-btn-save:hover {
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}
.modal-btn-save:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

**Tokens-first guard:** every new `var()` reference must resolve via `tokens.css`. Banned literals: raw px values not from the `--space-*` scale, raw color hex (except `#ffffff` on colored backgrounds where contrast requires it), any hardcoded border-radius not using `var(--radius-*)`.

---

### `tests/ui-lab/surfaces.ts` + `tests/ui-lab/DESIGN-RUBRIC.md` (MODIFY)

**Analog:** existing `edit-modal` surface entry `surfaces.ts:400-417` (exact shape to copy)

**Existing surface shape to copy** (`surfaces.ts:400-417`):
```typescript
{
  id: 'edit-modal',
  title: 'Session create/edit form',
  designRefs: [
    'DESIGN.md §v1 component inventory (create/edit form)',
    'DESIGN.md §Design tokens (radius: cards 18px, inputs ≈8px)',
  ],
  expects:
    '18px dialog card + dialog shadow; labeled fields; ~8px inputs; pill buttons; Nunito.',
  prepare: async (ctx) => {
    await openEditModal(ctx.ids[0]);
    await browser.pause(300);
  },
  cleanup: async () => {
    await clickByTestId('edit-cancel');
    await waitForTestIdGone('session-edit-modal');
  },
},
```

**New `edit-modal-validation` surface to ADD** (O-3, insert after `edit-modal`):
```typescript
{
  id: 'edit-modal-validation',
  title: 'Session edit form — inline validation (cwd error state)',
  designRefs: [
    '12-UI-SPEC.md §Color (danger reserved for genuine validation error)',
    '12-CONTEXT.md D-04 inline validation',
  ],
  expects:
    'Danger-ramp helper text under the cwd field; name hint in ink-faint; calm overall.',
  prepare: async (ctx) => {
    await openEditModal(ctx.ids[0]);
    // Drive an invalid (non-absolute) cwd to trigger the renderer hint:
    await setInputByTestId('edit-cwd', 'not-absolute');
    // Clear the name to trigger the neutral empty-name hint:
    await setInputByTestId('edit-name', '');
    await browser.pause(300);
  },
  cleanup: async () => {
    await clickByTestId('edit-cancel');
    await waitForTestIdGone('session-edit-modal');
  },
},
```

**Helper functions already available** (`surfaces.ts:104-132`):
```typescript
// openEditModal(id)       — dblclick the row, waitForTestId('session-edit-modal')
// setInputByTestId(id, v) — dispatches 'input' event through React's onChange path
// clickByTestId(id)       — click by data-testid
// waitForTestId(id)       — WDIO waitForExist
// waitForTestIdGone(id)   — WDIO waitForExist({ reverse: true })
```

**DESIGN-RUBRIC.md `§edit-modal` update** (current lines 108-115 — REPLACE with):
```markdown
## edit-modal

- [ ] Dialog: 18px card, `--shadow-dialog` elevation, on a dimmed/screened backdrop.
- [ ] Two-group structure: "Identity" group (Name + Icon/color) and "Launch · Applies
      on restart" group (cwd + Shell + Startup), each with a section subhead + hairline
      divider. Single column — no two-column layout.
- [ ] Fields: labeled clearly in soft ink; inputs ~8px radius with visible but soft
      borders; focus shows the blue accent ring.
- [ ] Save = **accent-blue fill** (constructive, NOT danger-red); label "Save changes";
      Cancel = quiet neutral. Pill shapes (`--radius-lg`).
- [ ] Icon/emoji picker: tidy grid with hover (`--bg-sunk`) + selected ring; swatch row
      aligned; feels playful-but-tidy (parlour, not toolbox).
- [ ] Vertical rhythm between fields is even; inter-group spacing reads as a clear break.

## edit-modal-validation

- [ ] cwd format hint (non-absolute path) renders in `--ink-faint` below the cwd field.
- [ ] Empty name hint "Keeps the current name" renders in `--ink-faint` below the name field.
- [ ] Hint text is CALM — does not read as an alarm; the danger red (`--color-danger`)
      is NOT present unless main actively rejects (an explicit error state).
- [ ] The rest of the form is undisturbed; validation is per-field, not a modal-wide state.
```

---

## Shared Patterns

### Tokens-first (guarded by `tokens-completeness.test.ts`)
**Source:** `src/renderer/tokens.css` + existing form CSS `terminal.css:376-493`
**Apply to:** All new/modified CSS (form.css or the form block in terminal.css)
```css
/* Pattern: every value is a var(); no literals except element dimensions */
color: var(--ink-faint);          /* neutral/hint tone */
color: var(--color-danger);       /* error tone only */
background: var(--bg-sunk);       /* hover/recessed wash */
border-color: var(--line);        /* soft border */
outline: 2px solid var(--color-accent);  /* focus ring */
gap: var(--space-2);              /* 8px — snap all 6px non-canonical gaps */
margin-bottom: var(--space-3);    /* 12px — inter-field rhythm */
margin-top: var(--space-5);       /* 20px — inter-group spacing */
```

### Pure-reducer module pattern
**Source:** `src/renderer/session-edit.ts` (header, import pattern, export shape)
**Apply to:** `merge-profiles.ts`, `validate-session-form.ts`
```typescript
// RENDERER ONLY — [description].
// Imports ONLY ../shared/types (type-only) — never React/xterm/electron — so the
// [reducer name] unit-tests in the Node/Vitest env (mirrors session-close.ts).
import type { ... } from '../shared/types';
export interface ... { ... }
export function ...(args): ReturnType { ... }
```

### Wave-0 RED test stub pattern
**Source:** `src/renderer/__tests__/session-edit.test.ts:1-8` (header + import)
**Apply to:** `merge-profiles.test.ts`, `validate-session-form.test.ts`
```typescript
// Wave 0 RED stub ([plan task ref]) — covers [requirement].
//
// INTENTIONALLY FAILS RED until [task N] implements src/renderer/[module].ts.
// Targets the React/xterm/electron-free pure reducer so it runs in the Node/Vitest env.

import { describe, it, expect } from 'vitest';
import { [exportedFn] } from '../[module]';
```

### Modal overlay / Esc / focus-on-open a11y pattern
**Source:** `src/renderer/SessionEditModal.tsx:93-105` (Esc key handler + nameRef.focus)
**Apply to:** `SessionEditModal.tsx` restructure (preserve, do not alter)
```typescript
useEffect(() => {
  if (!open) return;
  nameRef.current?.focus();
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [open, onCancel]);
```

### Danger ramp — spend red only on genuine error
**Source:** `terminal.css:271-279` (`.context-menu-item-danger` — the Phase-10 D-15 precedent)
**Apply to:** `edit-field-notice--error` new rule, `errorMessage` inline in cwd field
```css
/* Phase-10 D-15 precedent: color-mix idiom for the danger wash */
.context-menu-item-danger { color: var(--color-danger); }
.context-menu-item-danger:hover,
.context-menu-item-danger:focus-visible {
  background: color-mix(in oklch, var(--color-danger) 8%, transparent);
}
/* Phase-12 adaptation: the validation error notice is text-only (no wash) */
.edit-field-notice--error { color: var(--color-danger); }
```

### ui-lab surface entry shape
**Source:** `tests/ui-lab/surfaces.ts:400-417` (the existing `edit-modal` entry)
**Apply to:** new `edit-modal-validation` entry
```typescript
{
  id: '[surface-id]',
  title: '[human title]',
  designRefs: ['[ref to DESIGN.md or spec doc]'],
  expects: '[single-sentence rubric preview]',
  prepare: async (ctx) => { /* open the surface state */ },
  cleanup: async () => { /* restore — always click cancel or close */ },
},
```

---

## No Analog Found

None. All 8 files have close matches in the codebase.

---

## Critical Pitfalls (from RESEARCH.md — planner must reference in PLAN.md)

| Pitfall | Impact | Avoidance |
|---------|--------|-----------|
| Save button inherits destructive red `.modal-btn-confirm` | Visual SC1 fails (blue Save is required, not discretion) | Give Save a new `.modal-btn-save` constructive-blue class; keep `.context-menu-item` + `edit-save` testid |
| Unit-testing renderer state in jsdom | Tests won't run (Vitest is `environment: 'node'`, no DOM) | Extract pure reducers importing only `../shared/types`; test those modules, not the React components |
| Live-CSS injection previewing old markup for a structural change | ui-lab preview lies — validates wrong markup | Use `npm run ui:shots:fresh` (packaged) for any proof capture after a TSX structural change |
| Adding a `validatePath` IPC probe | Fails `security.guard.test.ts` (`EXPECTED_API_KEYS` would exceed 20) | The CR-01 rejection ALREADY flows as `row.errorMessage` — thread it as a prop, zero new IPC |
| Spreading main's full record in `mergeAuthoritativeProfiles` | Clobbers renderer-owned `status`/`errorMessage`/`agentState` | Copy ONLY `cwd`, `shell`, `startupCommand`, `configured` — exactly 4 fields |

---

## Metadata

**Analog search scope:** `src/renderer/`, `src/renderer/__tests__/`, `tests/ui-lab/`, `src/renderer/terminal.css`
**Files scanned:** 12
**Pattern extraction date:** 2026-06-15
