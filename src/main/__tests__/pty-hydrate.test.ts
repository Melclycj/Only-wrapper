// Plan 05-02 — PtyManager dormant-record hydration + promotion (PERS-02, Pattern 4
// option b) + store change-signal (D-13) + Pitfall 6 order.
//
//   - hydrate(records) populates a SEPARATE dormant map WITHOUT spawning a pty.
//   - listSessions() merges live + dormant, sorted by order.
//   - create({id}) for a dormant id PROMOTES it (spawns under the SAME logicalId,
//     drops it from dormant) reusing the stored cwd/shell/order.
//   - new-session order = max(existing live+dormant)+1, NOT this.sessions.size.
//   - every record mutation (create/close/setOrder) fires the store signal (D-13).
//
// Harness mirrors pty-lifecycle.test.ts: mock electron + node-pty + shell-resolver.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LogicalId, SessionRecord } from '../../shared/types';

vi.mock('node:os', () => ({
  default: { homedir: () => '/Users/fake-home' },
  homedir: () => '/Users/fake-home',
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

const spawnCalls: Array<{ shell: string; options: { cwd?: string } }> = [];
let nextPid = 2000;
function makeFakeChild(): unknown {
  return {
    pid: nextPid++,
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onData: vi.fn(),
    onExit: vi.fn(),
  };
}
const spawnMock = vi.fn(
  (shell: string, _args: string[], options: { cwd?: string }) => {
    spawnCalls.push({ shell, options });
    return makeFakeChild();
  },
);
vi.mock('node-pty', () => ({
  spawn: (...a: unknown[]) =>
    spawnMock(...(a as [string, string[], { cwd?: string }])),
}));

vi.mock('../shell-resolver', () => ({
  resolveShell: () => ({ shell: '/bin/zsh', args: ['-l'] }),
}));

import { PtyManager, type PtyCreateOptions } from '../pty-manager';

function fakeWindow(): never {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn(), isDestroyed: () => false },
  } as never;
}

function dormantRecord(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    logicalId: 'restored-1' as LogicalId,
    ptyPid: undefined,
    name: 'Restored',
    icon: { type: 'emoji', value: '🛋️' },
    cwd: '/Users/dev/proj',
    shell: '/bin/bash',
    startupCommand: undefined,
    status: 'not_started',
    order: 5,
    lastActive: 1_700_000_000_000,
    ...over,
  };
}

const baseOpts: PtyCreateOptions = { cols: 80, rows: 24 };

describe('PtyManager hydrate + promotion (PERS-02 / Pattern 4 / D-13)', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    nextPid = 2000;
    spawnMock.mockClear();
  });

  it('hydrate() stores dormant records WITHOUT spawning a pty (Pitfall 4)', () => {
    const mgr = new PtyManager();
    mgr.hydrate([dormantRecord(), dormantRecord({ logicalId: 'restored-2' as LogicalId, order: 2 })]);
    // No pty was spawned just by hydrating.
    expect(spawnMock).not.toHaveBeenCalled();
    // Both restored rows are visible via listSessions, sorted by order.
    const list = mgr.listSessions();
    expect(list.map((r) => r.logicalId)).toEqual(['restored-2', 'restored-1']);
    expect(list.every((r) => r.status === 'not_started')).toBe(true);
  });

  it('listSessions() merges live + dormant sorted by order', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    mgr.hydrate([dormantRecord({ order: 5 })]);
    // A live session at order 1 should sort BEFORE the dormant order-5 record.
    mgr.create({ ...baseOpts, order: 1 });
    const orders = mgr.listSessions().map((r) => r.order);
    expect(orders).toEqual([1, 5]);
  });

  it('create({id}) promotes a dormant record: spawns under the SAME id, reuses stored cwd/shell', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    mgr.hydrate([dormantRecord({ logicalId: 'restored-1' as LogicalId, cwd: '/stored/cwd', shell: '/bin/bash' })]);

    const result = mgr.create({ ...baseOpts, id: 'restored-1' as LogicalId });
    // Promoted under the SAME logicalId.
    expect(result.id).toBe('restored-1');
    // Spawned with the stored shell + cwd (Start ▶ honors the saved profile).
    expect(spawnCalls[0].shell).toBe('/bin/bash');
    expect(spawnCalls[0].options.cwd).toBe('/stored/cwd');

    // The record is now LIVE (running) and no longer duplicated as dormant.
    const list = mgr.listSessions();
    const ids = list.map((r) => r.logicalId);
    expect(ids.filter((x) => x === 'restored-1')).toHaveLength(1);
    expect(list.find((r) => r.logicalId === 'restored-1')?.status).toBe('running');
  });

  it('new-session order = max(existing)+1, never this.sessions.size (Pitfall 6)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    // A dormant record already sits at order 5; size-based ordering would collide.
    mgr.hydrate([dormantRecord({ order: 5 })]);
    const r = mgr.create({ ...baseOpts }); // no opts.order → must be 5+1 = 6
    const created = mgr.listSessions().find((x) => x.logicalId === r.id);
    expect(created?.order).toBe(6);
  });

  it('fires the store signal on create/setOrder/close (D-13)', () => {
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow());
    const signal = vi.fn();
    mgr.setStoreSignal(signal);

    const r = mgr.create({ ...baseOpts });
    expect(signal).toHaveBeenCalled();

    signal.mockClear();
    mgr.setOrder([{ id: r.id, order: 9 }]);
    expect(signal).toHaveBeenCalledTimes(1);
    expect(mgr.listSessions().find((x) => x.logicalId === r.id)?.order).toBe(9);

    signal.mockClear();
    mgr.close(r.id);
    expect(signal).toHaveBeenCalledTimes(1);
    expect(mgr.listSessions()).toHaveLength(0);
  });

  it('setOrder() reorders a DORMANT (not-yet-started) record (NAV-04)', () => {
    const mgr = new PtyManager();
    mgr.hydrate([dormantRecord({ logicalId: 'restored-1' as LogicalId, order: 5 })]);
    mgr.setOrder([{ id: 'restored-1', order: 0 }]);
    expect(mgr.listSessions()[0].order).toBe(0);
  });

  it('close() discards a dormant record without a pty + signals the store', () => {
    const mgr = new PtyManager();
    const signal = vi.fn();
    mgr.setStoreSignal(signal);
    mgr.hydrate([dormantRecord({ logicalId: 'restored-1' as LogicalId })]);
    mgr.close('restored-1' as LogicalId);
    expect(mgr.listSessions()).toHaveLength(0);
    expect(signal).toHaveBeenCalledTimes(1);
  });

  // SC5 (TERM-05 / D-06) — a dormant restore-on-launch spawns NO pty, so there is
  // nothing to inject a startupCommand into: auto-run is satisfied STRUCTURALLY by
  // the dormant model. This stays GREEN (it asserts the EXISTING hydrate behavior),
  // pinning the SC5 invariant so a future create()-probe hook can never auto-run a
  // merely-restored (never-Started) session.
  it('SC5: hydrate of a startupCommand-bearing record spawns no pty → never auto-runs (D-06)', () => {
    const mgr = new PtyManager();
    mgr.hydrate([
      dormantRecord({
        logicalId: 'restored-auto' as LogicalId,
        startupCommand: 'echo NOPE',
      }),
    ]);
    // Restore-on-launch does NOT spawn — so no PTY exists to write the command into.
    expect(spawnMock).not.toHaveBeenCalled();
    // The dormant record is present (visible, restartable) but stays not_started.
    const rec = mgr.listSessions().find((r) => r.logicalId === 'restored-auto');
    expect(rec?.status).toBe('not_started');
    expect(rec?.startupCommand).toBe('echo NOPE'); // carried, but never injected on hydrate
  });
});
