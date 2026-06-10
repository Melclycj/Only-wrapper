// RED repro (06.1-04 gap-closure round 2, ITEM 4 — the "revert to Working Area
// after ~1s" defect).
//
// ROOT CAUSE (verified at src/main/pty-manager.ts):
//   A recipe session (non-empty startupCommand) spawns through create()'s TERM-05
//   readiness probe. The probe arms a READINESS_TIMEOUT_MS timer whose only escape
//   hatches are (a) a successful probe match (clears the timer) or (b) the timeout
//   firing with `settled === false`. There is NO escape hatch for "the child
//   self-EXITED before the probe ever settled".
//
//   So when a command-bearing session exits quickly (an agent that finishes, a
//   `claude --rc` that returns) BEFORE the probe matches:
//     1. onExit fires → status broadcast 'exited' → the record is MOVED to
//        dormantRecords (not_started) and DELETED from this.sessions (D-05).
//        The renderer correctly flips the row to the Inactive List (FIX 4a).
//     2. ~READINESS_TIMEOUT_MS later the still-armed timer fires. `settled` is
//        still false, so it proceeds and broadcasts a pty:status with
//        `status: this.sessions.get(id)?.status ?? 'running'`. The session was
//        ALREADY deleted from this.sessions, so the fallback `'running'` is sent.
//     3. That stale 'running' status (carried as a `notice` event) reaches the
//        renderer, whose handler passes a notice's status straight through →
//        the row REVERTS to 'running' → back to the Working Area.
//
// THE CONTRACT THIS TEST PINS: once a session has self-exited (left this.sessions),
// the readiness-timeout branch must NOT broadcast a stale 'running' status. The
// timer must be a no-op for an already-exited session.
//
// Harness mirrors pty-lifecycle.test.ts (mock electron + node-pty + shell-resolver),
// but CAPTURES every pty:status payload sent to the fake window so the test can
// assert no post-exit 'running' is broadcast.

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
let nextPid = 3000;

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
  READINESS_TIMEOUT_MS,
  type PtyCreateOptions,
} from '../pty-manager';
import type { LogicalId } from '../../shared/types';

/** Capture every webContents.send(channel, payload) for status-stream assertions. */
interface SentEvent {
  channel: string;
  payload: { id?: LogicalId; status?: string; notice?: string };
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

describe('readiness-timeout revert (ITEM 4): a self-exited recipe must NOT be re-broadcast as running', () => {
  beforeEach(() => {
    spawnedChildren.length = 0;
    nextPid = 3000;
    spawnMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a recipe that self-EXITS before the probe settles does not emit a stale running status when the readiness timer later fires', () => {
    vi.useFakeTimers();
    const sent: SentEvent[] = [];
    const mgr = new PtyManager();
    mgr.registerIpc(fakeWindow(sent));

    // A command-bearing dormant recipe (the canonical recipe-spawn path): hydrate a
    // record that carries a startupCommand, then Start it (create({id})) — create()
    // reads prior.startupCommand and arms the TERM-05 readiness probe + timeout timer.
    const id = 'recipe-1' as LogicalId;
    mgr.hydrate([
      {
        logicalId: id,
        ptyPid: undefined,
        name: 'Parlour Claude RC',
        icon: { type: 'emoji', value: '🛋️' },
        cwd: FAKE_HOME,
        shell: '/bin/zsh',
        startupCommand: 'claude --rc',
        status: 'not_started',
        order: 0,
        lastActive: 1_700_000_000_000,
      },
    ]);
    mgr.create({ ...baseOpts, id }); // Start ▶ — arms the readiness probe + timer.

    expect(spawnedChildren.length).toBeGreaterThanOrEqual(1);

    // The process exits on its OWN before the probe ever matches (settled stays false):
    // an agent/recipe that finished quickly. The LAST spawned child is the live one.
    const child = spawnedChildren[spawnedChildren.length - 1];
    sent.length = 0; // ignore spawn-time 'running'; focus on post-exit broadcasts.
    child._fireExit({ exitCode: 0 });

    // After the self-exit the renderer-facing truth is dormant: a status 'exited' was
    // broadcast and the record left the live map.
    const afterExit = mgr.listSessions().find((s) => s.logicalId === id);
    expect(afterExit?.status).toBe('not_started');

    // Now the still-armed readiness timer fires (the bug: it broadcasts a stale
    // 'running' status for an already-exited session).
    vi.advanceTimersByTime(READINESS_TIMEOUT_MS + 50);

    // CONTRACT: NO 'running' status may be broadcast for this id after it self-exited.
    const runningAfterExit = sent.filter(
      (e) =>
        e.channel === PTY_CHANNELS.status &&
        e.payload.id === id &&
        e.payload.status === 'running',
    );
    expect(runningAfterExit).toEqual([]);
  });
});
