// Pure, electron-free, OS-agnostic store schema + load-coercion helper.
// Keeping this file free of any `electron` import lets Vitest (Node env) import
// it directly — the store-schema unit test runs standalone with no Electron
// process (mirrors the window-config.ts / shell-resolver.ts convention).
//
// Real implementation (Plan 05-02): SessionStore owns the lowdb Low<StoreSchema>
// and calls coerceOnLoad() on every restored record before handing them to
// PtyManager.hydrate(). The schema/coerce CONTRACT is defined here (RESEARCH
// Pattern 1, verbatim target; D-01/SC2).

import type { SessionRecord } from '../shared/types';

/**
 * Store schema version. Bump when the on-disk shape changes; Plan 05-02's
 * SessionStore reads this to decide whether a migration is required.
 *
 * v1 → v2 (Plan 06.1-01, D-02): adds the one-way `configured?` field on
 * SessionRecord. A v1 record has no `configured` flag, but it was persisted under
 * v1 — which only ever persisted sessions on purpose — so coerceOnLoad migrates an
 * absent `configured` to `true` (see below).
 */
export const SCHEMA_VERSION = 2 as const;

/**
 * The on-disk store shape (RESEARCH Pattern 1).
 *   - `version`  — SCHEMA_VERSION at write time (migration anchor).
 *   - `sessions` — the persisted SessionRecord array (PERS-01: all 8 fields).
 *   - `ui`       — persisted UI preferences (D-12): sidebar collapse + window bounds.
 */
export interface StoreSchema {
  version: number;
  sessions: SessionRecord[];
  ui: {
    collapsed?: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
    // 07-01 (TERM-11, D-04): persisted xterm scrollback line cap. ADDITIVE and
    // migration-safe — an absent value loads as the read-time default (5000 via
    // clampScrollback at the read site). Does NOT require a SCHEMA_VERSION bump
    // (the ui slot already tolerates {} — same precedent as collapsed/bounds).
    scrollback?: number;
  };
}

/** D-04 scrollback bounds + default (TERM-11). */
export const SCROLLBACK_MIN = 1000 as const;
export const SCROLLBACK_MAX = 50000 as const;
export const SCROLLBACK_DEFAULT = 5000 as const;

/**
 * Clamp an untrusted scrollback value into the inclusive D-04 range
 * [SCROLLBACK_MIN, SCROLLBACK_MAX] with SCROLLBACK_DEFAULT for any invalid input.
 *
 * - A non-number or non-finite value (undefined, null, NaN, ±Infinity, string,
 *   object) → SCROLLBACK_DEFAULT (5000, the midpoint default per D-04).
 * - Otherwise the value is rounded and clamped into [1000, 50000].
 *
 * PURE — no I/O, no electron, unit-tested directly (scrollback-clamp.test.ts).
 * Used both renderer-side (input clamp) and main-side (setUiState validate, T-07-01).
 */
export function clampScrollback(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return SCROLLBACK_DEFAULT;
  return Math.max(SCROLLBACK_MIN, Math.min(SCROLLBACK_MAX, Math.round(n)));
}

/**
 * D-01 / SC2 (T-05-02): every restored record loads DORMANT — persisted
 * `status`/`ptyPid` are NEVER trusted. coerceOnLoad forces `status: 'not_started'`
 * and clears `ptyPid`, leaving every OTHER field (logicalId, name, icon, cwd,
 * shell, startupCommand, order, lastActive) untouched.
 *
 * v1 → v2 migration (D-02): a loaded record with an absent `configured` flag
 * migrates to `configured: true` — anything persisted under v1 was kept on purpose,
 * so it is a configured session by definition. An explicit `configured` value
 * (true OR false) is preserved as-is. The migration cannot widen the runtime
 * surface: `configured` is a persistence gate only, never a process status.
 *
 * PURE — no I/O, no electron, unit-tested directly (store-schema.test.ts).
 */
export function coerceOnLoad(rec: SessionRecord): SessionRecord {
  return {
    ...rec,
    status: 'not_started',
    ptyPid: undefined,
    configured: rec.configured ?? true,
  };
}
