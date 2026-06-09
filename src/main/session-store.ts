// MAIN-PROCESS ONLY — owns the lowdb-backed on-disk store for session profiles +
// UI preferences (PERS-01 / PERS-02 / D-13). This is the producer side of the
// persistence round-trip: PtyManager hands its live+dormant SessionRecord snapshot
// to setSessions(), index.ts hydrates the dormant records on whenReady, and the
// before-quit flush guarantees the trailing debounced write lands.
//
// Pitfall 1 (the load-bearing pattern): lowdb@7 is pure ESM; this main bundle is
// CJS. lowdb is marked `external` in vite.main.config.ts (alongside node-pty) so
// Rollup leaves the dynamic `import('lowdb')` below INTACT (not down-levelled to a
// `require()` that would throw ERR_REQUIRE_ESM at runtime). A static
// `import { Low } from 'lowdb'` would be rewritten to require() and crash the
// BUILT app — never write one. Vitest's ESM loader hides this regression, so the
// dynamic-import-resolves-at-runtime proof is the persistence smoke test's job
// (tests/smoke/persistence.smoke.test.ts), not a unit test.
//
// Pitfall 3 (getPath-before-ready): the store file path is resolved INSIDE load()
// (called from whenReady), NOT at module scope — app.getPath('userData') is only
// valid after the app is ready. A constructor `pathOverride` lets Vitest point the
// store at a temp file with no real Electron app.

import path from 'node:path';
import fs from 'node:fs';
import { coerceOnLoad, SCHEMA_VERSION, type StoreSchema } from './store-schema';

/** Default debounce window for scheduleSave() coalescing (D-13, RESEARCH Pattern 3). */
export const SAVE_DEBOUNCE_MS = 300;

/** The on-disk store filename under app.getPath('userData'). */
export const STORE_FILENAME = 'just-wrapper-store.json';

/**
 * Lazy-typed lowdb handle. We CANNOT statically `import { Low } from 'lowdb'`
 * (ERR_REQUIRE_ESM in the CJS bundle — Pitfall 1), so the static type cannot be
 * imported either. This local interface mirrors the slice of the lowdb `Low<T>`
 * API the store uses: `data` (the in-memory document) + async `read`/`write`.
 */
interface LowApi<T> {
  data: T;
  read(): Promise<void>;
  write(): Promise<void>;
}

/**
 * Owns a lowdb `Low<StoreSchema>` loaded via the load-bearing dynamic
 * `import('lowdb')` (Pitfall 1). Responsibilities:
 *   - load(): read/coerce the store (corrupt → back up + start fresh, NEVER throw).
 *   - setSessions()/setUi(): apply a snapshot + schedule a debounced write (D-13).
 *   - scheduleSave()/flush()/isDirty(): the debounce + quit-flush durability path.
 */
export class SessionStore {
  private db: LowApi<StoreSchema> | null = null;
  /** Resolved inside load() (Pitfall 3) unless a test injects a path override. */
  private readonly pathOverride?: string;
  private file = '';
  private saveTimer: NodeJS.Timeout | null = null;
  private dirty = false;
  private readonly debounceMs: number;

  /**
   * @param pathOverride  TEST SEAM — when provided, the store reads/writes this
   *   exact file instead of `app.getPath('userData')/just-wrapper-store.json`, so
   *   Vitest exercises the real lowdb round-trip against a temp file with no
   *   Electron app. Production (index.ts) constructs `new SessionStore()` with no
   *   args → the path is resolved inside load() (Pitfall 3).
   * @param debounceMs  the scheduleSave() coalescing window (default 300ms, D-13).
   */
  constructor(pathOverride?: string, debounceMs: number = SAVE_DEBOUNCE_MS) {
    this.pathOverride = pathOverride;
    this.debounceMs = debounceMs;
  }

  /**
   * Load the store from disk and return the (coerced) StoreSchema.
   *
   *   - file absent → defaultData ({ version, sessions: [], ui: {} }) (lowdb merges).
   *   - file valid → parsed.
   *   - file corrupt (bad JSON) → backed up to `${file}.corrupt-<ts>`, fresh start,
   *     NEVER throws (D-13 / discretion).
   *   - every loaded record passes through coerceOnLoad (D-01/SC2: status
   *     not_started, ptyPid cleared — a persisted running/PID is never honored).
   */
  async load(): Promise<StoreSchema> {
    // Pitfall 3: resolve the path HERE (whenReady-time), not at module scope.
    // When no test override is supplied, dynamically import electron's `app` so
    // this module stays importable in a Node/Vitest env (where a path override is
    // always supplied) without a static electron import. The import() only runs in
    // the real main process, after whenReady, where app.getPath is valid.
    if (this.pathOverride) {
      this.file = this.pathOverride;
    } else {
      const { app } = await import('electron');
      this.file = path.join(app.getPath('userData'), STORE_FILENAME);
    }

    // Pitfall 1: dynamic import — Vite/Rollup MUST keep these as import(), not
    // down-level to require(). lowdb is `external` so they resolve the real ESM
    // package at runtime.
    const { Low } = await import('lowdb');
    const { JSONFile } = await import('lowdb/node');

    const defaultData: StoreSchema = {
      version: SCHEMA_VERSION,
      sessions: [],
      ui: {},
    };
    this.db = new Low<StoreSchema>(
      new JSONFile<StoreSchema>(this.file),
      defaultData,
    ) as unknown as LowApi<StoreSchema>;

    try {
      await this.db.read(); // sets db.data (or leaves defaultData when file absent)
    } catch {
      // Bad JSON / unreadable → back up + start fresh; NEVER crash (D-13, T-05-04).
      this.backupCorrupt();
      this.db.data = defaultData;
      await this.db.write();
    }

    // Defensive: a forged store could carry a non-array `sessions` (the read
    // above won't throw on `{ "sessions": "oops" }`). Treat that as corrupt too.
    if (!Array.isArray(this.db.data?.sessions)) {
      this.backupCorrupt();
      this.db.data = defaultData;
      await this.db.write();
    }

    // D-01 / SC2 (T-05-02): never trust persisted status/PID — coerce on the way in.
    this.db.data.sessions = this.db.data.sessions.map(coerceOnLoad);
    if (!this.db.data.ui || typeof this.db.data.ui !== 'object') {
      this.db.data.ui = {};
    }
    // DEFECT B (round 3) hygiene: lowdb's read() replaces db.data wholesale with the file
    // content, so a v1 file leaves db.data.version === 1 and every subsequent write would
    // re-persist the STALE version (the on-disk file was observed stuck at version:1 while
    // SCHEMA_VERSION is 2). Bump it here, post-coercion, so the next write records the
    // current schema version — coerceOnLoad already applied the v1→v2 record migration.
    this.db.data.version = SCHEMA_VERSION;
    // TEMP STORE-DEBUG (2026-06-09, remove after R2 diagnosis):
    // eslint-disable-next-line no-console
    console.error(
      '[STORE-DEBUG] load: file=%s loadedSessions=%d names=%o',
      this.file,
      this.db.data.sessions.length,
      this.db.data.sessions.map((s) => s.name),
    );
    return this.db.data;
  }

  /**
   * Rename a corrupt store file out of the way so the next load starts fresh.
   * Itself try/catch-wrapped: a backup failure (e.g. read-only dir) must NEVER
   * crash load() — the worst case is the bad file is overwritten by the fresh
   * write, which is still recovery, not a crash (D-13).
   */
  private backupCorrupt(): void {
    try {
      if (fs.existsSync(this.file)) {
        fs.renameSync(this.file, `${this.file}.corrupt-${Date.now()}`);
      }
    } catch {
      /* never crash on backup failure */
    }
  }

  /**
   * Replace the persisted session array (the live+dormant snapshot from
   * PtyManager) and schedule a debounced write. The caller passes records already
   * shaped for persistence; this store does not re-coerce on write (coercion is a
   * LOAD-time invariant — D-01).
   */
  setSessions(sessions: StoreSchema['sessions']): void {
    if (!this.db) return; // setter called before load() → no-op (defensive)
    this.db.data.sessions = sessions;
    this.scheduleSave();
  }

  /**
   * Replace the persisted UI slot (sidebar collapse + window bounds) and schedule
   * a debounced write (D-12). The caller (PtyManager.setUiState / index bounds
   * persistence) supplies an already-validated payload.
   */
  setUi(ui: StoreSchema['ui']): void {
    if (!this.db) return;
    this.db.data.ui = ui;
    this.scheduleSave();
  }

  /**
   * Read-only accessor for the current in-memory document (index.ts reads
   * `data.ui.bounds` for window restore + `data.sessions` for hydrate). Returns
   * null before load().
   */
  get data(): StoreSchema | null {
    return this.db?.data ?? null;
  }

  /**
   * Mark the store dirty and (re)arm the trailing debounce timer (D-13, Pattern 3).
   * N rapid calls within the window → ONE write after the trailing `debounceMs`.
   */
  scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      // Fire-and-forget the trailing write; flush() owns the await-able path.
      void this.flush();
    }, this.debounceMs);
  }

  /** True between a scheduleSave() and its write — the before-quit flush gate. */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Write the pending change immediately, clear the timer, and mark clean.
   * A no-op when not dirty (so the before-quit guard never double-writes). This
   * is the quit-flush path: index.ts before-quit awaits flush() so the trailing
   * debounced write is never lost (D-13).
   */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    // TEMP STORE-DEBUG (2026-06-09, remove after R2 diagnosis): log EVERY flush incl. no-ops.
    // eslint-disable-next-line no-console
    console.error(
      '[STORE-DEBUG] flush: dirty=%s file=%s inMemSessions=%d',
      this.dirty,
      this.file,
      this.db?.data?.sessions?.length ?? -1,
    );
    if (!this.dirty || !this.db) return; // nothing pending → no-op
    this.dirty = false;
    await this.db.write(); // steno atomic write
  }
}
