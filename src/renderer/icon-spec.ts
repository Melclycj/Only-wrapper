// RENDERER ONLY — pure icon-spec builders (04-01, SESS-03, D-09).
//
// Imports ONLY ../shared/types (type-only) — never React/xterm/electron — so the
// builders unit-test in the Node/Vitest env (mirrors session-add.ts). The form
// (IconPicker) constructs specs through these; Sidebar/IdentityHeader render them.
//
// Pitfall 6: a free-text emoji may be a multi-codepoint grapheme cluster (flags,
// ZWJ sequences, variation selectors). We store the value VERBATIM — never split
// or index into it — so the icon round-trips intact.

import type { SessionIconSpec } from '../shared/types';

/** Build an emoji icon spec, storing the grapheme verbatim (no split — Pitfall 6). */
export function emojiSpec(value: string): SessionIconSpec {
  return { type: 'emoji', value };
}

/** Build a color icon spec (a warm swatch the color-badge renders behind an initial). */
export function colorSpec(value: string): SessionIconSpec {
  return { type: 'color', value };
}

/**
 * The badge letter for a COLOR icon: the uppercased first letter of the session
 * name. Falls back to a bullet (`•`) for an empty/whitespace name so the colored
 * tile stays identifiable in the collapsed rail. Returns '' for non-color specs
 * (emoji/preset render their own glyph, not an initial).
 */
export function COLOR_INITIAL(spec: SessionIconSpec, name: string): string {
  if (spec.type !== 'color') return '';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '•';
  // Use the spread iterator so the first *grapheme-ish* unit (a full code point,
  // not a lone surrogate half) is taken before uppercasing.
  return [...trimmed][0].toUpperCase();
}
