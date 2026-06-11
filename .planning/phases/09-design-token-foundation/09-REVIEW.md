---
phase: 09-design-token-foundation
reviewed: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - scripts/assert-fonts-bundled.cjs
  - src/renderer/__tests__/status-colors.test.ts
  - src/renderer/__tests__/tokens-completeness.test.ts
  - src/renderer/index.tsx
  - src/renderer/status-colors.ts
  - src/renderer/terminal.css
  - src/renderer/tokens.css
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-06-11
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 09 delivers a value-preserving design-token migration: `tokens.css` as the new `:root` layer, `terminal.css` and `status-colors.ts` migrated from literals to `var()`/`color-mix()`, two guard tests, and a packaged-font build-output assertion script.

The structural work is sound. All `var(--token)` references in `terminal.css` and `status-colors.ts` resolve to defined tokens (the SC3 check passes). The `status-colors.ts` migration to `var(--accent-*)` is clean. Import ordering in `index.tsx` is correct per D-02/D-05. `color-mix(in oklch, color 8%, transparent)` is semantically equivalent to `color / 0.08` alpha under CSS Color 4 (transparent contributes "missing" channels, so the non-alpha channel values are taken from the first argument only) — this is not a fidelity bug.

Three issues require attention before the migration contract ("rendered output IDENTICAL to before") can be considered complete: two un-migrated literal `oklch(0.255 0.018 264 / alpha)` values in `terminal.css` that have no SC2 test coverage, and two guard-test fragilities that would silently pass even with the migration incomplete in edge cases.

---

## Warnings

### WR-01: Two `oklch(0.255 0.018 264 / alpha)` literals remain in `terminal.css`, uncovered by SC2 tests

**File:** `src/renderer/terminal.css:572` and `src/renderer/terminal.css:656`

**Issue:** The migration covers the accent-blue (`oklch(0.62 0.14 248)`) and danger-red (`oklch(0.58 0.16 25)`) families, but two literal uses of the dark-ink color (`oklch(0.255 0.018 264)`) were not migrated and are not tested by the SC2 literal-absence suite:

- Line 572: `.modal-overlay { background: oklch(0.255 0.018 264 / 0.45); }` — the modal scrim
- Line 656: `.row-icon-color { text-shadow: 0 1px 1px oklch(0.255 0.018 264 / 0.35); }` — color-badge text shadow

`tokens.css` already has the equivalent value documented as `--term-bg: #1e232c; /* = oklch(0.255 0.018 264) */` and uses the same `oklch` literal inside the shadow tokens (`--shadow-dialog`, `--shadow-menu`). An appropriate token (e.g. `--color-ink-deep`) or a `color-mix(in oklch, var(--term-bg) ...)` expression would close the gap. As-is, if the dark-ink base color changes in a future phase, these two values will silently diverge.

**Fix:**

Option A — add a token and migrate the two call sites:

In `tokens.css` `:root`:
```css
--color-ink-deep: oklch(0.255 0.018 264); /* dark ink — scrim, icon shadow */
```

In `terminal.css` line 572:
```css
background: color-mix(in oklch, var(--color-ink-deep) 45%, transparent);
```

In `terminal.css` line 656:
```css
text-shadow: 0 1px 1px color-mix(in oklch, var(--color-ink-deep) 35%, transparent);
```

Option B (minimal, no new token) — leave the literals but add SC2 absence tests so future regressions are caught:

```ts
// In tokens-completeness.test.ts, add to the "terminal.css literal absence" describe:
it('the dark-ink literal is gone from terminal.css (scrim + icon shadow)', () => {
  expect(count(terminalCss, 'oklch(0.255 0.018 264')).toBe(0);
});
```

Option B still leaves the divergence risk; Option A is the migration-complete solution.

---

### WR-02: `definedTokens()` regex in tokens-completeness test scans raw text including comments — would count a commented-out `--name:` as a real definition

**File:** `src/renderer/__tests__/tokens-completeness.test.ts:37-45`

**Issue:** `definedTokens()` uses `/(--[a-zA-Z0-9_-]+)\s*:/g` applied to the raw `tokensCss` string *without* stripping comments first. If `tokens.css` ever contains a comment such as:

```css
/* formerly --old-token: #fff -- removed in phase 10 */
```

`definedTokens()` would count `--old-token` as defined. A referencing file would then pass the SC3 completeness check for a token that does not actually exist in the stylesheet. Currently no such comment exists in `tokens.css`, so no false-positive is firing — but the guard is one documentation comment away from silently misfiring.

**Fix:**

Apply the same `stripComments()` helper (already defined in the same file) to `tokensCss` before scanning for definitions:

```ts
function definedTokens(css: string): Set<string> {
  const defs = new Set<string>();
  const scannable = stripComments(css);   // <-- add this
  const re = /(--[a-zA-Z0-9_-]+)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scannable)) !== null) {  // <-- use scannable
    defs.add(m[1]);
  }
  return defs;
}
```

---

### WR-03: `stripComments()` does not strip inline `//` comments — a `var(--token)` in an inline comment inside a `.ts` file would be counted as a real reference

**File:** `src/renderer/__tests__/tokens-completeness.test.ts:55-61`

**Issue:** The `stripComments()` helper strips only line-*initial* `//` comments (the regex `^\s*\/\/.*$` with the `m` flag requires the `//` to follow optional leading whitespace at the start of a line). An inline `//` comment on a line that also contains real code is not stripped:

```ts
running: { label: 'Running', accent: 'var(--accent-running)' }, // blue (in-progress)
```

If a future author adds a comment like:

```ts
free: { label: 'Free', accent: 'var(--accent-idle)' }, // was var(--accent-some-removed-token)
```

the `referencedTokens()` call on `statusColorsTs` would count `--accent-some-removed-token` as a live reference and the SC3 test would incorrectly require it to be defined in `tokens.css` (causing a false failure). Conversely, if the removed token *were* kept around in `tokens.css`, the guard would not catch the dead reference. Currently `status-colors.ts` has no inline-comment `var(--...)` patterns so no test is broken, but the guard's precision is lower than it appears.

**Fix:** Replace the line-comment strip regex with one that matches `//` anywhere on a line that is followed only by the end of the line (i.e. also handles inline comments):

```ts
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');   // strip from // to end-of-line, wherever it appears
}
```

---

## Info

### IN-01: `assert-fonts-bundled.cjs` — `fontUrlRe` declared outside the `for` loop; safe today, but fragile if loop ever uses `break` or `throw`

**File:** `scripts/assert-fonts-bundled.cjs:99`

**Issue:** The stateful `/gi` regex `fontUrlRe` is declared at function scope (outside the `for (const cssFile of cssFiles)` loop) but consumed inside a `while (fontUrlRe.exec(css))` loop per file. After `exec()` returns `null` (loop exhausted), `lastIndex` resets to `0` automatically — so repeated iterations across multiple CSS files work correctly in the current code where the `while` loop always runs to completion.

However, if a future edit ever adds an early `break` or `throw` inside the `while` loop before `exec()` returns `null`, the `lastIndex` will be left non-zero, and the next CSS file's scan would start mid-string — silently skipping its first portion. The bug would be invisible in passing runs.

**Fix:** Move the regex declaration inside the `for` loop so a fresh `lastIndex = 0` is guaranteed per file regardless of how the inner loop terminates:

```js
for (const cssFile of cssFiles) {
  const cssPath = path.join(assetsDir, cssFile);
  const css = fs.readFileSync(cssPath, 'utf8');
  const fontUrlRe = /url\(\s*(['"]?)([^)'"]+\.(?:woff2?|ttf|otf|eot))\1\s*\)/gi;  // moved here
  let m;
  while ((m = fontUrlRe.exec(css)) !== null) {
    ...
  }
}
```

---

### IN-02: `assert-fonts-bundled.cjs` — only checks `assets/` flat directory; nested emit paths would be silently missed

**File:** `scripts/assert-fonts-bundled.cjs:66`

**Issue:** `fs.readdirSync(assetsDir)` reads only the immediate children of `.vite/renderer/main_window/assets/`. If a Vite/Forge upgrade ever emits fonts into a subdirectory (e.g. `assets/fonts/`), both the woff2 presence check and the CSS scan would silently pass against zero woff2 files and zero CSS files — or miss the subdirectory's CSS — producing a false PASS.

This is a low-probability scenario given current Vite defaults, but the script's stated goal is to be a regression guard across future upgrades.

**Fix:** Use a recursive read or at minimum assert that `woff2.length` is above a reasonable floor (e.g. `>= 5` for the 2 weights × 2 fonts × latin variants):

```js
// Minimal hardening: assert at least 5 woff2 files (Nunito 400/600/700 + JetBrains 400/700)
if (woff2.length < 5) {
  fail(
    `only ${woff2.length} woff2 emitted (expected ≥ 5 for Nunito 400/600/700 + JetBrains 400/700). ` +
      'Fonts may have been emitted under a subdirectory or not bundled.',
    1
  );
}
```

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
