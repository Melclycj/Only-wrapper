# Phase 9: Design Token Foundation - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 7 (1 new src + 1 new test + 5 modified)
**Analogs found:** 7 / 7 (this is a refactor-in-place phase — most analogs are the file's OWN current code)

> **Scope guard (D-01):** this is a value-preserving refactor. Migrate the global primitives (accent/danger colors, 5 status accents, shadow, radius, motion, font stacks) + load the fonts. The `--space-*` scale is DEFINED in `tokens.css` but existing `padding`/`gap`/`margin` are NOT migrated. Do NOT touch `forge.config.ts`, the Vite renderer config, `TERMINAL_THEME` hex values, or the PTY/ANSI path.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/tokens.css` (NEW) | config (design tokens) | transform (literal→token) | existing `:root{}` block in `terminal.css` lines 6–17 | exact (structural precedent) |
| `src/renderer/terminal.css` (MODIFY) | config (stylesheet) | transform | its OWN current literal sites | self (migration target) |
| `src/renderer/status-colors.ts` (MODIFY) | utility (color map) | transform | its OWN current `STATUS_STYLE`/`AGENT_STYLE` | self (migration target) |
| `src/renderer/index.tsx` (MODIFY) | config (renderer entry) | request-response (import order) | its OWN current `import './terminal.css'` | self |
| `src/renderer/SessionView.tsx` (MODIFY) | component (xterm host) | streaming (terminal) | its OWN current `new Terminal({ fontFamily })` | self |
| `src/renderer/__tests__/tokens-completeness.test.ts` (NEW) | test | batch (static text analysis) | `src/renderer/__tests__/status-colors.test.ts` (vitest node-env pure test) | role+flow match |
| `src/renderer/__tests__/status-colors.test.ts` (MODIFY) | test | batch | its OWN current literal assertions | self (lockstep guard update) |
| `package.json` (MODIFY) | config | — | its OWN `dependencies` block | self |

## Pattern Assignments

### `src/renderer/tokens.css` (NEW — config, transform)

**Analog:** the existing `:root {}` block at the **top of `terminal.css` (lines 6–17)** — this is the structural starting point. These 9 tokens move into `tokens.css` AS-IS, then the new families are added beside them. Carry the comment style (DESIGN.md §-references).

**Current `:root` to lift verbatim** (`terminal.css:6-17`):
```css
:root {
  /* DESIGN.md §"Design tokens" — the subset the basic sidebar consumes. */
  --surface: #ffffff;
  --bg-sunk: oklch(0.955 0.01 85);
  --ink: oklch(0.32 0.012 70);
  --ink-soft: oklch(0.5 0.012 70);
  --ink-faint: oklch(0.66 0.01 75);
  --line: oklch(0.91 0.008 80);
  --line-soft: oklch(0.94 0.006 80);
  --radius: 18px;
  --term-bg: #1e232c;
}
```

**New token families to add** (values carried verbatim from terminal.css/status-colors.ts/DESIGN.md — full skeleton in RESEARCH.md §"Code Examples > tokens.css skeleton", lines 278–352). Notable derived members:
- Brand: `--color-accent: oklch(0.62 0.14 248)` (the 28× blue), `--color-accent-strong: oklch(0.58 0.14 248)`, `--color-danger: oklch(0.58 0.16 25)`, `--color-danger-strong: oklch(0.54 0.16 25)`.
- Status accents (consumed by `status-colors.ts`): `--accent-running: var(--color-accent)`, `--accent-finished: oklch(0.60 0.13 150)`, `--accent-idle: oklch(0.64 0.02 260)`, `--accent-error: var(--color-danger)`, `--accent-waiting: oklch(0.66 0.15 60)` (reserved).
- Terminal palette: keep `--term-bg: #1e232c`; **ADD** `--term-text: oklch(0.90 0.012 250)` + `--term-faint: oklch(0.66 0.02 255)` (D-03, CSS gutter only — NOT routed into the xterm JS theme).
- Shadow: `--shadow-pop: 0 6px 18px oklch(0.32 0.012 70 / 0.14)`, `--shadow-dialog: 0 18px 48px oklch(0.255 0.018 264 / 0.28)`, `--shadow-menu: 0 10px 30px oklch(0.255 0.018 264 / 0.22)`.
- Radius: `--radius-xs:6px … --radius-xl:12px`; keep `--radius:18px` (Discretion: alias `--radius: var(--radius-xl)` vs rename in lockstep — recommend alias to minimize churn).
- Motion: `--duration-fast: 120ms`, `--ease-standard: ease` (matches existing `0.12s ease`).
- Fonts: `--font-ui: 'Nunito', system-ui, sans-serif`, `--font-mono: 'JetBrains Mono', monospace`.
- Spacing: `--space-0_5:2px … --space-12:48px` — DEFINED ONLY, not applied this phase.

---

### `src/renderer/terminal.css` (MODIFY — config, transform)

**Analog:** its own current literal sites. The migration pattern, per the RESEARCH `color-mix` recommendation, has **two cases** — solid → bare token; alpha-wash (`/ 0.08`) → `color-mix`.

**Pattern A — solid blue focus-ring** (`terminal.css:507-510`, repeats at lines 209, 258, 336, 556, 565, 849, 879, 892, 944, …):
```css
/* BEFORE */
.search-input:focus-visible {
  outline: 2px solid oklch(0.62 0.14 248);
}
/* AFTER */
.search-input:focus-visible {
  outline: 2px solid var(--color-accent);
}
```

**Pattern B — alpha hover-wash → `color-mix`** (`terminal.css:203-205`, `565-567`, `886-888`):
```css
/* BEFORE — .sidebar-row .row-control-start:hover */
border-color: oklch(0.62 0.14 248);
background: oklch(0.62 0.14 248 / 0.08);
color: oklch(0.62 0.14 248);
/* AFTER — value-preserving (color-mix in oklch, Chromium 136) */
border-color: var(--color-accent);
background: color-mix(in oklch, var(--color-accent) 8%, transparent);
color: var(--color-accent);
```
Red wash equivalent (`terminal.css:194-196`): `oklch(0.58 0.16 25 / 0.08)` → `color-mix(in oklch, var(--color-danger) 8%, transparent)`; solid red sites (`640-641`, `651`) → `var(--color-danger)`.

**Pattern C — box-shadow** (`terminal.css:260`, `409`, `487` pop; `592` dialog; `683` menu):
```css
/* BEFORE */ box-shadow: 0 6px 18px oklch(0.32 0.012 70 / 0.14);
/* AFTER  */ box-shadow: var(--shadow-pop);
```
> NOTE: `box-shadow: 0 0 0 2px var(--surface)` at line 388 is a **ring, not elevation** — leave literal (or name `--ring-dot` per Discretion). 999px pills stay literal.

**Pattern D — raw Nunito font stack** (`terminal.css:51`, `407`, `488`, `593`, `684`, `801`, … 14× total):
```css
/* BEFORE */ font-family: 'Nunito', system-ui, sans-serif;
/* AFTER  */ font-family: var(--font-ui);
```
**Pattern D′ — JetBrains Mono** (`terminal.css:496`, 3×): `font-family: 'JetBrains Mono', monospace;` → `font-family: var(--font-mono);`

**Pattern E — motion** (`terminal.css:158`, `238`): `transition: opacity 0.12s ease;` → `transition: opacity var(--duration-fast) var(--ease-standard);` (compositor-friendly only — do not add new layout-animating transitions).

> Acceptance after migration: `oklch(0.62 0.14 248)` count drops 28→0, `oklch(0.58 0.16 25)` 10→0 (RESEARCH says 8 visible), `'Nunito'` 14→0, `'JetBrains Mono'` 3→0 — all only allowed in `tokens.css`. `terminal.css` stays >800 lines = accepted tracked debt (D-02).

---

### `src/renderer/status-colors.ts` (MODIFY — utility, transform)

**Analog:** its OWN current `STATUS_STYLE` / `AGENT_STYLE` literal-oklch objects (D-03 migration target).

**Current** (`status-colors.ts:23-32` + `44-51`):
```ts
export const STATUS_STYLE: Record<SessionStatus, { label: string; accent: string }> = {
  running: { label: 'Running', accent: 'oklch(0.62 0.14 248)' },
  exited: { label: 'Finished', accent: 'oklch(0.60 0.13 150)' },
  stopped: { label: 'Stopped', accent: 'oklch(0.64 0.02 260)' },
  not_started: { label: 'Idle', accent: 'oklch(0.64 0.02 260)' },
  error: { label: 'Error', accent: 'oklch(0.58 0.16 25)' },
};
```

**After D-03** — labels unchanged (they are not colors); `accent` literals → `var(--accent-*)` references:
```ts
export const STATUS_STYLE: Record<SessionStatus, { label: string; accent: string }> = {
  running:     { label: 'Running',  accent: 'var(--accent-running)' },
  exited:      { label: 'Finished', accent: 'var(--accent-finished)' },
  stopped:     { label: 'Stopped',  accent: 'var(--accent-idle)' },
  not_started: { label: 'Idle',     accent: 'var(--accent-idle)' },
  error:       { label: 'Error',    accent: 'var(--accent-error)' },
};
export const AGENT_STYLE: Record<AgentState, { label: string; accent: string }> = {
  'in-progress': { label: 'In progress',     accent: 'var(--accent-running)' },
  waiting:       { label: 'Waiting for you', accent: 'var(--accent-waiting)' },
  free:          { label: 'Free',            accent: 'var(--accent-idle)' },
};
```
`presentation()` / `statusLabel()` / `statusAccent()` keep their shape (unchanged). The accent value flows out as the per-row inline `--accent` custom property already consumed by `.status-dot` / `.collapsed-status-dot` — Chromium resolves the nested `var()` against `:root` (RESEARCH Pattern 3, confirmed safe).

---

### `src/renderer/index.tsx` (MODIFY — config, request-response)

**Analog:** its OWN current single import line.

**Current** (`index.tsx:1-4`):
```tsx
import ReactDOM from 'react-dom/client';
import '../shared/api-types';
import { SessionManager } from './SessionManager';
import './terminal.css';
```

**After D-02/D-05** — fonts FIRST, then tokens BEFORE component styles (RESEARCH Pattern 1):
```tsx
import ReactDOM from 'react-dom/client';
import '../shared/api-types';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './tokens.css';
import './terminal.css';
import { SessionManager } from './SessionManager';
```
> Use per-weight `@fontsource/<font>/<weight>.css` (latin default, `font-display:swap` baked in). Do NOT use `@fontsource-variable/*`.

---

### `src/renderer/SessionView.tsx` (MODIFY — component, streaming)

**Analog:** its OWN current `new Terminal({ ... })` + `TERMINAL_THEME` const.

**Current** (`SessionView.tsx:223-231`):
```tsx
const term = new Terminal({
  scrollback,
  allowProposedApi: true,
  cursorStyle: 'block',
  cursorBlink: true,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 14,
  theme: TERMINAL_THEME,
});
```
**D-05:** `fontFamily` already names `'JetBrains Mono', monospace` — after the `@fontsource` import lands it renders for real (no string change strictly required; planner may keep it verbatim). **CRITICAL SC4 guard (RESEARCH Pitfall 5):** the `TERMINAL_THEME` JS hex const (`SessionView.tsx:52-56`, `background:'#1e232c'` etc.) is xterm's literal-color theme — do **NOT** feed CSS `var(--term-*)` into it (xterm rejects `var()`). The CSS `--term-*` tokens serve the CSS gutter only. Leave `TERMINAL_THEME` hex byte-for-byte unchanged. Leave `sanitizeNotice` + the fixed-literal ANSI writes (lines ~60-69) untouched (ASVS V5).

---

### `src/renderer/__tests__/tokens-completeness.test.ts` (NEW — test, batch)

**Analog:** `src/renderer/__tests__/status-colors.test.ts` — the existing vitest **pure node-env** test pattern (no DOM, no jsdom).

**Imports/structure pattern to copy** (`status-colors.test.ts:10-17`):
```ts
import { describe, it, expect } from 'vitest';
// ... but instead of importing the module, read CSS/TS files as TEXT:
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
```
**Assertions to implement (RESEARCH Wave 0 / SC2):** parse `--name:` definitions in `tokens.css` and every `var(--name)` reference in `terminal.css` + `status-colors.ts`; assert every referenced token is defined; assert migrated literals (`oklch(0.62 0.14 248)`, `oklch(0.58 0.16 25)`, `'Nunito'`, `'JetBrains Mono'`) no longer appear in `terminal.css` (allowed only in `tokens.css`). No new dependency.

---

### `src/renderer/__tests__/status-colors.test.ts` (MODIFY — test, batch)

**Analog:** its OWN current literal-oklch assertions (lockstep guard update, RESEARCH Pitfall 4).

**Current literal assertions to swap** (`status-colors.test.ts:18-23`, `77`, `84-86`):
```ts
expect(presentation('running', 'in-progress')).toEqual({ label: 'In progress', accent: 'oklch(0.62 0.14 248)' });
// ...
expect(AGENT_STYLE.waiting.accent).toBe('oklch(0.66 0.15 60)');
expect(STATUS_STYLE.running.accent).toBe('oklch(0.62 0.14 248)');
```
**After:** assert the `var(--accent-*)` reference strings instead (e.g. `accent: 'var(--accent-running)'`, `AGENT_STYLE.waiting.accent` → `'var(--accent-waiting)'`). **Keep intact** the overlay-only-when-running contract assertions (lines 39-72) — those test `presentation()` behavior, not color literals, and must stay GREEN.

---

### `package.json` (MODIFY — config)

**Analog:** its OWN `dependencies` block (alphabetical, exact-pinned, no caret).

**Add** (after the `@xterm/*` entries, keeping alpha order):
```json
"@fontsource/jetbrains-mono": "5.2.8",
"@fontsource/nunito": "5.2.7",
```
Pin EXACT per project convention. `npm install @fontsource/nunito@5.2.7 @fontsource/jetbrains-mono@5.2.8`. RESEARCH flags one precautionary `checkpoint:human-verify` before install (slopcheck was unavailable; manual registry signals strong).

## Shared Patterns

### Value-preserving token migration (the core cross-cutting rule)
**Source:** RESEARCH Pattern 2.
**Apply to:** every migrated declaration in `terminal.css` + `status-colors.ts`.
- Solid usage → bare `var(--token)`.
- Alpha wash (`color / 0.08`) → `color-mix(in oklch, var(--token) 8%, transparent)`.
- Rendered output MUST be identical to today except fonts. Any other visible change is a regression (human-verify gate).

### Pure node-env vitest test (no DOM)
**Source:** `status-colors.test.ts` (mirrors `icon-spec.test.ts` / `session-close.test.ts`).
**Apply to:** the new `tokens-completeness.test.ts`. `environment: 'node'`; either import the module or read files as text — never add jsdom.

### Guard-test lockstep discipline
**Source:** project convention noted in `status-colors.ts` comment + CONTEXT §code_context.
**Apply to:** `status-colors.ts` ↔ `status-colors.test.ts` — update both in the same change; never let the guard test go stale.

### Import-order dependency
**Source:** RESEARCH Pattern 1.
**Apply to:** `index.tsx` — fonts + `tokens.css` MUST be imported before `terminal.css` so `@font-face` and `:root` vars exist when the consuming stylesheet parses.

## No Analog Found

None. Every file has either an exact in-repo analog or is a self-migration of its own current code.

## Untouched (explicit do-NOT-edit guard)

| File | Reason |
|------|--------|
| `forge.config.ts` | RESEARCH: fonts are renderer assets (relative base), not native modules — no ASAR/packaging change. |
| `vite.renderer.config.ts` | Do not lower `assetsInlineLimit`; relative base already correct (RESEARCH Pitfall 2/3). |
| `SessionView.tsx` `TERMINAL_THEME` hex + ANSI/`sanitizeNotice` path | SC4 + ASVS V5 — chrome-only phase, terminal fidelity untouched. |
| existing `padding`/`gap`/`margin` in `terminal.css` | D-01 — `--space-*` is defined but not applied this phase (Phases 10–13 own it). |

## Metadata

**Analog search scope:** `src/renderer/` (CSS, TSX, status map, tests), `package.json`.
**Files scanned:** terminal.css (literal-site grep), status-colors.ts, status-colors.test.ts, index.tsx, SessionView.tsx, package.json.
**Pattern extraction date:** 2026-06-10
