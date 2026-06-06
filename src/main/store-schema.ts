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
 */
export const SCHEMA_VERSION = 1 as const;

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
  };
}

/**
 * D-01 / SC2 (T-05-02): every restored record loads DORMANT — persisted
 * `status`/`ptyPid` are NEVER trusted. coerceOnLoad forces `status: 'not_started'`
 * and clears `ptyPid`, leaving every OTHER field (logicalId, name, icon, cwd,
 * shell, startupCommand, order, lastActive) untouched.
 *
 * PURE — no I/O, no electron, unit-tested directly (store-schema.test.ts).
 */
export function coerceOnLoad(rec: SessionRecord): SessionRecord {
  return { ...rec, status: 'not_started', ptyPid: undefined };
}
