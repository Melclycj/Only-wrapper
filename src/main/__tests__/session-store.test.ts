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

  // ── CR-03: dirty must only be cleared AFTER a successful write. The OLD flush()
  //    set `dirty = false` BEFORE awaiting db.write(); a write rejection (e.g. disk
  //    full) then left the store CLEAN with the pending mutation unwritten → silent
  //    data loss, and isDirty() never re-armed the before-quit flush guard. ──
  it('re-arms dirty when the underlying write fails (CR-03 — no silent data loss)', async () => {
    const store = new SessionStore(storeFile);
    await store.load();
    store.setSessions([makeRecord({ name: 'must-survive-a-failed-write' })]);
    expect(store.isDirty()).toBe(true);

    // Force the next db.write() to reject (simulated disk-full / EACCES). Reach the
    // private lowdb handle through an unknown cast — the test seam is the write fn.
    const db = (store as unknown as { db: { write: () => Promise<void> } }).db;
    const writeSpy = vi
      .spyOn(db, 'write')
      .mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

    await expect(store.flush()).rejects.toThrow(/ENOSPC/);

    // The defect: a failed write must NOT leave the store clean — the pending change
    // is still dirty so the next flush retries it.
    expect(store.isDirty()).toBe(true);

    // Recovery: the real write now succeeds and the change lands on disk.
    writeSpy.mockRestore();
    await store.flush();
    expect(store.isDirty()).toBe(false);
    const onDisk = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    expect(onDisk.sessions[0].name).toBe('must-survive-a-failed-write');
  });

  // ── CR-03: two concurrent flush() calls (the scheduleSave timer racing the
  //    before-quit flush) must coalesce onto ONE in-flight write — the second caller
  //    must NOT see `dirty === false` and return a no-op while the first write is
  //    still in flight (which would drop the write if the first then failed). Both
  //    callers await the same durable write. ──
  it('coalesces concurrent flush() calls onto one in-flight write (CR-03)', async () => {
    const store = new SessionStore(storeFile);
    await store.load();
    store.setSessions([makeRecord({ name: 'coalesce-me' })]);

    const db = (store as unknown as { db: { write: () => Promise<void> } }).db;
    let resolveWrite: (() => void) | null = null;
    let writeCount = 0;
    const realWrite = db.write.bind(db);
    vi.spyOn(db, 'write').mockImplementation(() => {
      writeCount += 1;
      return new Promise<void>((res) => {
        resolveWrite = () => void realWrite().then(res);
      });
    });

    // Fire two flushes before the first write resolves.
    const f1 = store.flush();
    const f2 = store.flush();

    // Release the single in-flight write; both flushes resolve against it.
    expect(resolveWrite).not.toBeNull();
    resolveWrite!();
    await Promise.all([f1, f2]);

    // The mutation was written exactly once (no dropped write, no double write race).
    expect(writeCount).toBe(1);
    expect(store.isDirty()).toBe(false);
    const onDisk = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    expect(onDisk.sessions[0].name).toBe('coalesce-me');
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
