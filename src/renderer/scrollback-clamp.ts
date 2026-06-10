// RENDERER ONLY — a pure, electron-free mirror of the MAIN clampScrollback helper
// (src/main/store-schema.ts, 07-01 T-05-01). Used by the Preferences scrollback input
// to snap a typed value into the inclusive D-04 range before it is applied/persisted.
//
// DEFENSE IN DEPTH (T-07-01): this renderer clamp is a UX convenience (the input never
// commits an out-of-range value). The MAIN setUiState clamp remains the security
// boundary — a forged/out-of-range renderer payload is re-clamped or no-op'd in main
// before any disk write. Both must agree EXACTLY, so the bounds/default/round semantics
// below are copied verbatim from store-schema.ts (kept in sync intentionally — the
// renderer must not import the main module, which would pull electron into the bundle).
//
// PURE — no I/O, no electron, no React; unit-tested directly (scrollback-clamp.test.ts).

/** D-04 scrollback bounds + default (TERM-11) — must mirror main store-schema.ts. */
export const SCROLLBACK_MIN = 1000 as const;
export const SCROLLBACK_MAX = 50000 as const;
export const SCROLLBACK_DEFAULT = 5000 as const;

/**
 * Clamp an untrusted scrollback value into the inclusive D-04 range
 * [SCROLLBACK_MIN, SCROLLBACK_MAX], with SCROLLBACK_DEFAULT for any invalid input.
 *
 * - A non-number or non-finite value (undefined, null, NaN, ±Infinity, string, object)
 *   → SCROLLBACK_DEFAULT (5000, the midpoint default per D-04).
 * - Otherwise the value is rounded and clamped into [1000, 50000].
 *
 * Mirrors src/main/store-schema.ts clampScrollback EXACTLY (defense in depth).
 */
export function clampScrollback(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return SCROLLBACK_DEFAULT;
  return Math.max(SCROLLBACK_MIN, Math.min(SCROLLBACK_MAX, Math.round(n)));
}
