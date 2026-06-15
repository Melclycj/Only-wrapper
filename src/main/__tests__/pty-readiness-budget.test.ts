// GAP-12-B dual-deadline readiness budget — unit regression (fake timers, mocked
// node-pty). Pins the new create() probe budget that REPLACED the single fixed
// 4000ms wall:
//
//   - IDLE window (READINESS_IDLE_TIMEOUT_MS): re-armed on every produced byte while
//     the probe is unsettled, so a heavy-but-PROGRESSING rc init is NOT guillotined.
//     A match still injects `cmd + '\r'` exactly once.
//   - HARD ceiling (READINESS_HARD_TIMEOUT_MS): the absolute wall-clock cap measured
//     from probe-arm, NEVER reset by the idle-extend logic. A chatty-but-never-ready
//     shell that streams a byte per idle window forever still hits it and the D-04
//     fallback fires (no inject, READINESS_FAIL_NOTICE emitted, buffer flushed once).
//   - SILENT shell (no bytes): the idle timer expires once at READINESS_IDLE_TIMEOUT_MS.
//   - STALE child: a session whose pty was replaced before a timer fires → NO-OP.
//
// Harness mirrors pty-readiness-revert.test.ts (mock electron + node-pty +
// shell-resolver) but drives onData chunks directly and asserts against the REAL
// exported constants (never hardcoded numbers).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const FAKE_HOME = '/Users/fake-home';
vi.mock('node:os', () => ({
  default: { homedir: () => FAKE_HOME },
  homedir: () => FAKE_HOME,
}));

vi.mock('node:fs', () => {
  const OK = new Set(['/Users/fake-home']);
  const statSync = (p: string): { isDirectory: () => boolean } => {
    if (OK.has(p)) return { isDirectory: () => true };
    throw new Error('ENOENT');
  };
  return { default: { statSync }, statSync };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

type ExitCb = (e: { exitCode: number; signal?: number }) => void;
type DataCb = (d: string) => void;

interface FakeChild {
  pid: number;
  kill: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  onData: (cb: DataCb) => { dispose: () => void };
  onExit: (cb: ExitCb) => { dispose: () => void };
  _fireExit: (e: { exitCode: number; signal?: number }) => void;
  _fireData: (d: string) => void;
}

const spawnedChildren: FakeChild[] = [];
let nextPid = 4000;

function makeFakeChild(): FakeChild {
  const dataCbs: DataCb[] = [];
  const exitCbs: ExitCb[] = [];
  return {
    pid: nextPid++,
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onData: (cb: DataCb) => {
      dataCbs.push(cb);
      return {
        dispose: () => {
          const i = dataCbs.indexOf(cb);
          if (i >= 0) dataCbs.splice(i, 1);
        },
      };
    },
    onExit: (cb: ExitCb) => {
      exitCbs.push(cb);
      return {
        dispose: () => {
          const i = exitCbs.indexOf(cb);
          if (i >= 0) exitCbs.splice(i, 1);
        },
      };
    },
    _fireExit: (e) => [...exitCbs].forEach((cb) => cb(e)),
    _fireData: (d) => [...dataCbs].forEach((cb) => cb(d)),
  };
}

const spawnMock = vi.fn(() => {
  const child = makeFakeChild();
  spawnedChildren.push(child);
  return child;
});

vi.mock('node-pty', () => ({
  spawn: () => spawnMock(),
}));

vi.mock('../shell-resolver', () => ({
  resolveShell: () => ({ shell: '/bin/zsh', args: ['-l'] }),
}));

import {
  PtyManager,
  PTY_CHANNELS,
  READINESS_IDLE_TIMEOUT_MS,
  READINESS_HARD_TIMEOUT_MS,
  READINESS_FAIL_NOTICE,
  type PtyCreateOptions,
} from '../pty-manager';
import type { LogicalId, SessionRecord } from '../../shared/types';

interface SentEvent {
  channel: string;
  payload: { id?: LogicalId; status?: string; notice?: string; data?: string };
}

function fakeWindow(sink: SentEvent[]): never {
  return {
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      send: (channel: string, payload: unknown) =>
        sink.push({ channel, payload: payload as SentEvent['payload'] }),
    },
  } as never;
}

const baseOpts: PtyCreateOptions = { cols: 80, rows: 24 };
const CMD = 'claude --rc';

function dormantRecipe(id: string): SessionRecord {
  return {
    logicalId: id as LogicalId,
    ptyPid: undefined,
    name: 'Parlour Claude RC',
    icon: { type: 'emoji', value: '🛋️' },
    cwd: FAKE_HOME,
    shell: '/bin/zsh',
    startupCommand: CMD,
    status: 'not_started',
    order: 0,
    lastActive: 1_700_000_000_000,
  };
}

/** The probe nonce embedded in the marker the create() hook FIRST writes to the PTY. */
function probeNonce(child: FakeChild): string {
  const firstWrite = child.write.mock.calls[0]?.[0] as string | undefined;
  const m = firstWrite?.match(/__JW_READY_[0-9a-f]+__/);
  return m?.[0] ?? '__JW_READY_unknown__';
}

/** Build a chunk that matches the probe (nonce AFTER a newline boundary — WR-02). */
function matchingLine(nonce: string): string {
  return `: ${nonce}\r\n${nonce}\nuser@host% `;
}

/** Start a fresh recipe session and return its live FakeChild. */
function startRecipe(mgr: PtyManager, id: string): FakeChild {
  mgr.hydrate([dormantRecipe(id)]);
  mgr.create({ ...baseOpts, id: id as LogicalId });
  return spawnedChildren[spawnedChildren.length - 1];
}

describe('GAP-12-B dual-deadline readiness budget (create() probe)', () => {
  beforeEach(() => {
    spawnedChildren.length = 0;
    nextPid = 4000;
    spawnMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('idle-extend: a heavy-but-progressing rc (a byte every < idle window) never fires the fallback, then a match injects cmd + CR exactly once', () => {
    const sent: SentEvent[] = [];
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow(sent));
    const child = startRecipe(mgr, 'recipe-idle-extend');
    const nonce = probeNonce(child);
    sent.length = 0; // drop the spawn-time 'running'

    // Feed a byte at sub-idle-window intervals whose CUMULATIVE elapsed exceeds a
    // single idle window (proving extend-on-progress) while staying UNDER the hard
    // ceiling (so the heavy-but-progressing rc is not capped before it can match).
    // step·count must satisfy: step < idle, step·count > idle, step·count < hard.
    const step = Math.floor(READINESS_IDLE_TIMEOUT_MS / 2) - 1; // ~3999ms < idle
    const count = 3; // ~11997ms total: > idle (8000), < hard (15000)
    for (let i = 0; i < count; i++) {
      child._fireData(`rc-init-progress-chunk-${i}\n`);
      vi.advanceTimersByTime(step);
    }
    // Sanity: the cumulative elapsed crossed one idle window but not the hard ceiling.
    expect(step * count).toBeGreaterThan(READINESS_IDLE_TIMEOUT_MS);
    expect(step * count).toBeLessThan(READINESS_HARD_TIMEOUT_MS);

    // No ready-fail notice yet, and the command was NOT injected (still probing).
    expect(sent.find((e) => e.payload.notice === READINESS_FAIL_NOTICE)).toBeUndefined();
    expect(child.write).not.toHaveBeenCalledWith(CMD + '\r');

    // The shell finally re-prompts the nonce on a produced line → match → inject once.
    child._fireData(matchingLine(nonce));
    expect(child.write).toHaveBeenCalledWith(CMD + '\r');
    const injects = child.write.mock.calls.filter((c) => c[0] === CMD + '\r');
    expect(injects).toHaveLength(1);

    // Even after the would-be deadlines elapse, no fallback fires post-match (timers
    // were cleared on match — D-04).
    vi.advanceTimersByTime(READINESS_HARD_TIMEOUT_MS + 100);
    expect(sent.find((e) => e.payload.notice === READINESS_FAIL_NOTICE)).toBeUndefined();
  });

  it('hard ceiling: a chatty-but-never-ready shell (a byte every idle window − 1ms forever) still fires the D-04 fallback at the hard ceiling — notice emitted, command NEVER injected', () => {
    const sent: SentEvent[] = [];
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow(sent));
    const child = startRecipe(mgr, 'recipe-chatty');
    sent.length = 0;

    // Stream a non-matching byte every (idle - 1ms) so the idle timer is perpetually
    // re-armed and NEVER expires; cumulatively blow past the hard ceiling.
    const step = READINESS_IDLE_TIMEOUT_MS - 1;
    let elapsed = 0;
    while (elapsed < READINESS_HARD_TIMEOUT_MS + step) {
      child._fireData('chatty-never-ready% ');
      vi.advanceTimersByTime(step);
      elapsed += step;
    }

    // The HARD ceiling fired the SAME flush-and-notice give-up path.
    const notice = sent.find(
      (e) => e.channel === PTY_CHANNELS.status && e.payload.notice === READINESS_FAIL_NOTICE,
    );
    expect(notice).toBeDefined();
    // The command was NEVER best-effort injected (D-04).
    expect(child.write).not.toHaveBeenCalledWith(CMD + '\r');
  });

  it('silent shell: no bytes at all fires the fallback once at the idle window (raised to READINESS_IDLE_TIMEOUT_MS)', () => {
    const sent: SentEvent[] = [];
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow(sent));
    const child = startRecipe(mgr, 'recipe-silent');
    sent.length = 0;

    // No data ever arrives. Just before the idle window, no fallback.
    vi.advanceTimersByTime(READINESS_IDLE_TIMEOUT_MS - 1);
    expect(sent.find((e) => e.payload.notice === READINESS_FAIL_NOTICE)).toBeUndefined();

    // Cross the idle window → the fallback fires exactly once.
    vi.advanceTimersByTime(2);
    const notices = sent.filter((e) => e.payload.notice === READINESS_FAIL_NOTICE);
    expect(notices).toHaveLength(1);
    expect(child.write).not.toHaveBeenCalledWith(CMD + '\r');

    // Advancing past the hard ceiling does not double-fire (settled guard).
    vi.advanceTimersByTime(READINESS_HARD_TIMEOUT_MS);
    expect(sent.filter((e) => e.payload.notice === READINESS_FAIL_NOTICE)).toHaveLength(1);
  });

  it('stale child: if the session pty is replaced before a timer fires, the timer is a NO-OP (no status broadcast)', () => {
    const sent: SentEvent[] = [];
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow(sent));
    const id = 'recipe-stale';
    const child = startRecipe(mgr, id);
    sent.length = 0;

    // The original child self-exits before the probe ever settles → onExit routes the
    // record to dormant and removes it from the live map. The original child's idle +
    // hard timers are still armed.
    child._fireExit({ exitCode: 0 });
    sent.length = 0; // ignore the exit-driven broadcasts; focus on the stale timer

    // Fire the original child's still-armed timers (past the hard ceiling so both run).
    vi.advanceTimersByTime(READINESS_HARD_TIMEOUT_MS + 100);

    // CONTRACT: no stale 'running' / no stale READINESS_FAIL_NOTICE for the gone session.
    const stale = sent.filter(
      (e) =>
        e.channel === PTY_CHANNELS.status &&
        e.payload.id === (id as LogicalId) &&
        (e.payload.status === 'running' || e.payload.notice === READINESS_FAIL_NOTICE),
    );
    expect(stale).toEqual([]);
  });
});
