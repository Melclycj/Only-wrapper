// SC2/SC3 single-source-of-truth guard (Phase 9, Plan 09-02).
//
// Proves the design-token contract by STATIC TEXT ANALYSIS only — it reads
// tokens.css / terminal.css / status-colors.ts as text via readFileSync and never
// touches the DOM, so it runs in Vitest's Node env (mirrors status-colors.test.ts /
// icon-spec.test.ts). No jsdom, no new dependency.
//
// Three invariants:
//   1. REFERENCE COMPLETENESS (SC3): every var(--name) referenced in terminal.css +
//      status-colors.ts is DEFINED as a --name: custom property in tokens.css. A
//      referenced-but-undefined token would resolve to the CSS initial value silently
//      at runtime — this test fails loudly instead (RESEARCH Reliability lens).
//   2. LITERAL ABSENCE (SC2 migration proof): the global primitives that Plan 09-02
//      migrated no longer appear as raw literals in terminal.css — they live ONLY in
//      tokens.css (which this test does not scan for absence).
//   3. STATUS-COLORS REFERENCE SHAPE: status-colors.ts emits exactly the 5
//      var(--accent-*) references it must, and each is defined in tokens.css.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const tokensCss = readFileSync(
  resolve(__dirname, '../tokens.css'),
  'utf8',
);
const terminalCss = readFileSync(
  resolve(__dirname, '../terminal.css'),
  'utf8',
);
const sidebarCss = readFileSync(
  resolve(__dirname, '../sidebar.css'),
  'utf8',
);
const statusColorsTs = readFileSync(
  resolve(__dirname, '../status-colors.ts'),
  'utf8',
);

/** Collect every `--name` declared as a custom-property definition (`--name:`). */
function definedTokens(css: string): Set<string> {
  const defs = new Set<string>();
  const re = /(--[a-zA-Z0-9_-]+)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    defs.add(m[1]);
  }
  return defs;
}

// The `--accent` per-row inline custom property is NOT a tokens.css token — it is
// the runtime channel status-colors.ts writes into each row's inline style
// (presentation().accent), consumed by `.status-dot` / `.collapsed-status-dot`.
// It is defined per-row at runtime, never in :root, so it is allow-listed out of
// the tokens.css completeness check (PATTERNS.md §status-colors.ts).
const INLINE_RUNTIME_PROPS = new Set<string>(['--accent']);

/** Strip `//` line comments and `/* *​/` block comments so doc-glob artifacts like
 *  `var(--accent-*)` in prose never count as real token references. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Collect every `--name` referenced inside a `var(--name ...)` expression. */
function referencedTokens(source: string): Set<string> {
  const refs = new Set<string>();
  const re = /var\(\s*(--[a-zA-Z0-9_-]+)/g;
  let m: RegExpExecArray | null;
  const scannable = stripComments(source);
  while ((m = re.exec(scannable)) !== null) {
    if (INLINE_RUNTIME_PROPS.has(m[1])) continue;
    refs.add(m[1]);
  }
  return refs;
}

describe('tokens.css single source of truth (SC2/SC3)', () => {
  const defined = definedTokens(tokensCss);

  it('defines the migrated brand / accent / shadow / font / motion tokens', () => {
    // Sanity floor: the definition set is non-empty and carries the families
    // Plan 09-02 migrates onto (guards against a mis-parse silently passing).
    expect(defined.has('--color-accent')).toBe(true);
    expect(defined.has('--color-danger')).toBe(true);
    expect(defined.has('--shadow-pop')).toBe(true);
    expect(defined.has('--font-ui')).toBe(true);
    expect(defined.has('--duration-fast')).toBe(true);
  });

  it('every var(--token) in terminal.css is defined in tokens.css', () => {
    const referenced = referencedTokens(terminalCss);
    const undefinedRefs = [...referenced].filter((t) => !defined.has(t));
    expect(undefinedRefs).toEqual([]);
  });

  it('every var(--token) in sidebar.css is defined in tokens.css', () => {
    // The sidebar rules were extracted into sidebar.css (Plan 10-01); the completeness
    // guard must follow them so a moved/added var(--token) that resolves to nothing
    // still fails loudly (RESEARCH Pitfall 4 — keep the 3 touch-points honest).
    const referenced = referencedTokens(sidebarCss);
    const undefinedRefs = [...referenced].filter((t) => !defined.has(t));
    expect(undefinedRefs).toEqual([]);
  });

  it('every var(--token) in status-colors.ts is defined in tokens.css', () => {
    const referenced = referencedTokens(statusColorsTs);
    const undefinedRefs = [...referenced].filter((t) => !defined.has(t));
    expect(undefinedRefs).toEqual([]);
  });
});

describe('terminal.css literal absence (SC2 migration proof)', () => {
  // Helper: count non-overlapping occurrences of a literal substring.
  const count = (haystack: string, needle: string): number =>
    haystack.split(needle).length - 1;

  it('the migrated accent-blue literal is gone from terminal.css', () => {
    expect(count(terminalCss, 'oklch(0.62 0.14 248')).toBe(0);
  });

  it('the migrated danger-red literal is gone from terminal.css', () => {
    expect(count(terminalCss, 'oklch(0.58 0.16 25')).toBe(0);
  });

  it('the raw Nunito font stack is gone from terminal.css', () => {
    expect(count(terminalCss, "'Nunito'")).toBe(0);
  });

  it('the raw JetBrains Mono font stack is gone from terminal.css', () => {
    expect(count(terminalCss, "'JetBrains Mono'")).toBe(0);
  });
});

describe('sidebar.css literal absence (SC2 migration proof — extracted rules stay guarded)', () => {
  // The sidebar block moved into sidebar.css (Plan 10-01); the migrated primitives must
  // stay absent there too, so the value-preserving move cannot silently reintroduce a raw
  // literal that bypasses tokens.css (RESEARCH Pitfall 4).
  const count = (haystack: string, needle: string): number =>
    haystack.split(needle).length - 1;

  it('the migrated accent-blue literal is absent from sidebar.css', () => {
    expect(count(sidebarCss, 'oklch(0.62 0.14 248')).toBe(0);
  });

  it('the migrated danger-red literal is absent from sidebar.css', () => {
    expect(count(sidebarCss, 'oklch(0.58 0.16 25')).toBe(0);
  });

  it('the raw Nunito font stack is absent from sidebar.css', () => {
    expect(count(sidebarCss, "'Nunito'")).toBe(0);
  });

  it('the raw JetBrains Mono font stack is absent from sidebar.css', () => {
    expect(count(sidebarCss, "'JetBrains Mono'")).toBe(0);
  });
});

describe('status-colors.ts accent reference shape (D-03)', () => {
  const defined = definedTokens(tokensCss);
  const required = [
    '--accent-running',
    '--accent-finished',
    '--accent-idle',
    '--accent-error',
    '--accent-waiting',
  ];

  it('emits the 5 var(--accent-*) references it must', () => {
    for (const token of required) {
      expect(statusColorsTs.includes(`var(${token})`)).toBe(true);
    }
  });

  it('each emitted accent token is defined in tokens.css', () => {
    for (const token of required) {
      expect(defined.has(token)).toBe(true);
    }
  });
});
