// GREEN as of Plan 05-02 — exercises src/main/session-store.ts (SessionStore).
//
// This is the SessionStore CONTRACT (PERS-01 / PERS-02 / D-13):
//   - round-trip: write records → read back → all 8 SessionRecord fields intact,
//     every restored record coerced dormant (coerceOnLoad: status not_started,
//     ptyPid cleared — D-01/SC2).
//   - corrupt-file recovery: a malformed store JSON is backed up to `.corrupt-*`
//     and a fresh store is started — load() NEVER throws (D-13 / discretion).
//   - debounce + quit flush (D-13): scheduleSave() coalesces burst writes on a
//     ~300ms trailing timer; flush() writes the pending change; the trailing
//     write is never lost on quit.
//
// The store is pointed at a TEMP file via the constructor `pathOverride` seam, so
// these tests exercise the REAL lowdb round-trip with no Electron app.
//
// NOTE (Pitfall 1): Vitest's ESM loader makes `import('lowdb')` ALWAYS succeed
// here, so this unit test CANNOT catch the BUILT-app require-rewrite regression.
// That regression is caught by tests/smoke/persistence.smoke.test.ts, which boots
// the packaged app and asserts the store file is actually created.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SessionStore } from '../session-store';
import type { StoreSchema } from '../store-schema';
import type { LogicalId, SessionRecord } from '../../shared/types';

/** Build a fully-populated SessionRecord (all 8 PERS-01 fields + status/ptyPid). */
function makeRecord(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    logicalId: 'session-abc' as LogicalId,
    ptyPid: 4242,
    name: '🛋️ Parlour Claude RC',
    icon: { type: 'emoji', value: '🛋️' },
    cwd: '/Users/dev/project',
    shell: '/bin/zsh',
    startupCommand: 'claude --rc',
    status: 'running',
    order: 3,
    lastActive: 1_700_000_000_000,
    ...over,
  };
}

let tmpDir: string;
let storeFile: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jw-store-'));
  storeFile = path.join(tmpDir, 'just-wrapper-store.json');
});

afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('SessionStore (PERS-01 / PERS-02 / D-13)', () => {
  it('round-trips all 8 SessionRecord fields through write → read', async () => {
    const rec = makeRecord();

    // First store: write the record, flush to disk.
    const writer = new SessionStore(storeFile);
    await writer.load();
    writer.setSessions([rec]);
    await writer.flush();

    // Second store reading the same file: all fields survive the JSON round-trip.
    const reader = new SessionStore(storeFile);
    const data = await reader.load();
    expect(data.sessions).toHaveLength(1);
    const got = data.sessions[0];

    // All 8 PERS-01 fields intact (logicalId, name, icon, cwd, shell,
    // startupCommand, order, lastActive).
    expect(got.logicalId).toBe(rec.logicalId);
    expect(got.name).toBe(rec.name);
    expect(got.icon).toEqual(rec.icon);
    expect(got.cwd).toBe(rec.cwd);
    expect(got.shell).toBe(rec.shell);
    expect(got.startupCommand).toBe(rec.startupCommand);
    expect(got.order).toBe(rec.order);
    expect(got.lastActive).toBe(rec.lastActive);
  });

  it('coerces every restored record dormant on load (not_started, ptyPid cleared)', async () => {
    // Persist a RUNNING record with a live PID; the next load must coerce it.
    const writer = new SessionStore(storeFile);
    await writer.load();
    writer.setSessions([makeRecord({ status: 'running', ptyPid: 9999 })]);
    await writer.flush();

    const reader = new SessionStore(storeFile);
    const data = await reader.load();
    const got = data.sessions[0];
    expect(got.status).toBe('not_started'); // D-01/SC2: never honor a persisted running
    expect(got.ptyPid).toBeUndefined(); // a stale/foreign PID is never re-attached
  });

  it('round-trips an empty store (first run → defaultData)', async () => {
    const store = new SessionStore(storeFile);
    const data = await store.load();
    expect(data.sessions).toEqual([]);
    expect(data.ui).toEqual({});
    expect(data.version).toBeGreaterThanOrEqual(1);
  });

  it('persists + restores the UI slot (collapsed + bounds, D-12)', async () => {
    const ui: StoreSchema['ui'] = {
      collapsed: true,
      bounds: { x: 100, y: 120, width: 1280, height: 820 },
    };
    const writer = new SessionStore(storeFile);
    await writer.load();
    writer.setUi(ui);
    await writer.flush();

    const reader = new SessionStore(storeFile);
    const data = await reader.load();
    expect(data.ui).toEqual(ui);
  });

  it('round-trips a valid ui.scrollback through write → read (TERM-11, D-04)', async () => {
    const ui: StoreSchema['ui'] = {
      collapsed: false,
      bounds: { x: 0, y: 0, width: 1024, height: 768 },
      scrollback: 12000,
    };
    const writer = new SessionStore(storeFile);
    await writer.load();
    writer.setUi(ui);
    await writer.flush();

    const reader = new SessionStore(storeFile);
    const data = await reader.load();
    expect(data.ui.scrollback).toBe(12000);
    expect(data.ui).toEqual(ui);
  });

  it('tolerates a loaded ui slot with an absent scrollback (read-time default applies, no throw)', async () => {
    // A ui slot persisted WITHOUT scrollback (a pre-Phase-7 store) must load cleanly:
    // coerceOnLoad is untouched for the ui slot, and the read-time default (5000) is
    // applied by the renderer/clampScrollback — load() itself never throws or invents one.
    const ui: StoreSchema['ui'] = {
      collapsed: true,
      bounds: { x: 10, y: 10, width: 800, height: 600 },
    };
    const writer = new SessionStore(storeFile);
    await writer.load();
    writer.setUi(ui);
    await writer.flush();

    const reader = new SessionStore(storeFile);
    const data = await reader.load();
    expect(data.ui.scrollback).toBeUndefined();
    // The rest of the ui slot is intact — an absent scrollback is NOT corruption.
    expect(data.ui.collapsed).toBe(true);
    expect(data.ui.bounds).toEqual(ui.bounds);
  });

  it('backs up a corrupt store to .corrupt-* and starts fresh without throwing', async () => {
    // Write a malformed JSON file at the store path.
    fs.writeFileSync(storeFile, '{ this is not valid json ]', 'utf8');

    const store = new SessionStore(storeFile);
    // load() must NEVER throw on a corrupt file (D-13 / discretion).
    const data = await store.load();

    // Fresh empty store.
    expect(data.sessions).toEqual([]);

    // A `.corrupt-*` backup was created alongside the (now-fresh) store file.
    const backups = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith('just-wrapper-store.json.corrupt-'));
    expect(backups.length).toBe(1);

    // The fresh store file is now valid JSON.
    const fresh = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    expect(Array.isArray(fresh.sessions)).toBe(true);
    expect(fresh.sessions).toHaveLength(0);
  });

  it('treats a non-array sessions field as corrupt (forged store)', async () => {
    fs.writeFileSync(
      storeFile,
      JSON.stringify({ version: 1, sessions: 'oops', ui: {} }),
      'utf8',
    );
    const store = new SessionStore(storeFile);
    const data = await store.load();
    expect(data.sessions).toEqual([]);
    const backups = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith('just-wrapper-store.json.corrupt-'));
    expect(backups.length).toBe(1);
  });

  it('debounces scheduleSave() bursts on a ~300ms trailing timer (D-13)', async () => {
    vi.useFakeTimers();
    const store = new SessionStore(storeFile);
    await store.load();

    // Spy on flush so we count actual write-attempts independent of steno's async
    // fs timing (which fake timers cannot deterministically settle on disk).
    const flushSpy = vi.spyOn(store, 'flush');

    store.setSessions([makeRecord()]); // setSessions itself calls scheduleSave (1)
    store.scheduleSave(); // 2
    store.scheduleSave(); // 3
    store.scheduleSave(); // 4 — all within the same 300ms window

    // Before the trailing timer fires, the store is dirty and flush has not run.
    expect(store.isDirty()).toBe(true);
    expect(flushSpy).not.toHaveBeenCalled();

    // Advance HALFWAY — still within the window → still no flush (re-armed each call).
    await vi.advanceTimersByTimeAsync(150);
    expect(flushSpy).not.toHaveBeenCalled();

    // Advance past the debounce window → exactly ONE trailing flush/write fires
    // (the 4 bursts coalesced into a single write — D-13).
    await vi.advanceTimersByTimeAsync(200);
    expect(flushSpy).toHaveBeenCalledTimes(1);
    expect(store.isDirty()).toBe(false);
  });

  it('flush() writes the pending change so the trailing write is never lost on quit', async () => {
    vi.useFakeTimers();
    const store = new SessionStore(storeFile);
    await store.load();

    store.setSessions([makeRecord({ name: 'flush-me' })]);
    expect(store.isDirty()).toBe(true);

    // Quit path: flush BEFORE the debounce timer would have fired.
    await store.flush();

    expect(store.isDirty()).toBe(false);
    const onDisk = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    expect(onDisk.sessions[0].name).toBe('flush-me');
  });

  // ── R2 regression guard (2026-06-09) — DURABILITY contract for the RESTORED,
  //    user-approved-good flush(). A reverted code-review "coalesce" optimization
  //    cleared the dirty flag and dropped a mutation that arrived WHILE a write was
  //    in flight, so the on-disk data could end up STALE (mutation B lost). This test
  //    locks the contract against the restored flush(): mutate A → begin a flush whose
  //    underlying write is HELD open → mutate B mid-write → release → the on-disk data
  //    MUST be B and the store MUST have issued TWO writes (every dirty flush writes;
  //    no mid-write mutation is ever silently dropped). A future "coalesce" optimization
  //    that drops B will fail here. ──
  it('R2: a mutation arriving WHILE a write is in flight is NOT dropped (final on-disk === B, writeCount === 2)', async () => {
    const store = new SessionStore(storeFile);
    await store.load();

    // Wrap the REAL lowdb write so we can (a) count writes and (b) hold the FIRST one
    // open until we have applied mutation B mid-write — reproducing the in-flight race.
    const db = (store as unknown as { db: { write(): Promise<void> } }).db;
    const realWrite = db.write.bind(db);
    let writeCount = 0;
    let releaseFirstWrite!: () => void;
    const firstWriteHeld = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const writeSpy = vi
      .spyOn(db, 'write')
      .mockImplementation(async () => {
        writeCount += 1;
        // Hold ONLY the first write open until the test releases it (after mutating B).
        if (writeCount === 1) await firstWriteHeld;
        await realWrite();
      });

    // Mutation A → begin the flush (do NOT await yet — its write is now held open).
    store.setSessions([makeRecord({ name: 'A' })]);
    const firstFlush = store.flush();

    // While the first write is in flight, mutation B lands. The restored flush() set
    // dirty=false at the START of the in-flight write, so B re-marks the store dirty
    // and arms the trailing debounce — B must NOT be lost.
    store.setSessions([makeRecord({ name: 'B' })]);
    expect(store.isDirty()).toBe(true); // B re-dirtied the store mid-write

    // Release the held first write and let it settle (A lands on disk first).
    releaseFirstWrite();
    await firstFlush;

    // Now drive B's pending write to completion (the trailing flush for B).
    await store.flush();

    // The store issued TWO writes (A, then B) — B was not coalesced away.
    expect(writeCount).toBe(2);
    expect(store.isDirty()).toBe(false);

    // The FINAL on-disk state is B — the in-flight mutation won, nothing was dropped.
    const onDisk = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    expect(onDisk.sessions).toHaveLength(1);
    expect(onDisk.sessions[0].name).toBe('B');

    writeSpy.mockRestore();
  });

  it('flush() is a no-op when not dirty', async () => {
    const store = new SessionStore(storeFile);
    await store.load();
    // No mutation → not dirty. flush() must not write a file or throw.
    expect(store.isDirty()).toBe(false);
    await store.flush();
    // load() of an empty store with no mutation leaves no file on disk.
    expect(fs.existsSync(storeFile)).toBe(false);
  });
});
