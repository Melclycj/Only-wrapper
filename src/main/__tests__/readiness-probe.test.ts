// Wave 0 scaffold for TERM-05 startup-command auto-run (Plan 05.1-01).
//
// TWO test groups with DIFFERENT intended states:
//
//   1. PURE helper tests (buildPosixProbe / selectReadinessProbe) — GREEN NOW.
//      They exercise the seam delivered by Plan 05.1-01 Task 1: the ': <nonce>\r'
//      no-op marker, the send-vs-match matcher (Pitfall 1), the Windows-throwing
//      stub, and the macOS picker. No FakeChild, no PTY.
//
//   2. State-machine tests (the create() probe hook) — RED until Plans 02/03 land.
//      They drive the FakeChild node-pty mock harness (mirrors pty-lifecycle.test.ts:
//      _fireData/_fireExit, spawnMock, vi.mock('node-pty'/'electron'/'../shell-resolver'),
//      fakeWindow() with webContents.send: vi.fn(), vi.useFakeTimers() + advanceTimersByTime).
//      They reference symbols Plans 02/03 ADD and assert behavior the create() probe
//      hook MUST implement, so they fail RED now:
//        - `READINESS_TIMEOUT_MS` (new exported constant — Plan 02/03)
//        - `wireNormalOnData()` + the create() probe gate (withhold probe bytes,
//          inject-on-match with CR, flush-on-timeout no-inject) — Plan 02/03
//      When Plans 02/03 implement the create() probe hook these go GREEN; until then
//      they pin the EXACT contract (SC1/SC2/SC4/D-02/D-04) with zero interpretation
//      latitude. Delete this banner's "RED" note when they turn GREEN.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LogicalId, SessionRecord } from '../../shared/types';

import {
  buildPosixProbe,
  selectReadinessProbe,
  MacReadinessProbe,
} from '../readiness-probe';

// ───────────────────────────────────────────────────────────────────────────
// Group 1 — PURE helper tests (GREEN now; no harness required).
// ───────────────────────────────────────────────────────────────────────────
describe('readiness-probe pure helpers (Plan 05.1-01 Task 1)', () => {
  it("buildPosixProbe(nonce).marker is exactly ': <nonce>\\r' (':' no-op + CR, Pitfall 4)", () => {
    expect(buildPosixProbe('NONCE').marker).toBe(': NONCE\r');
  });

  it('matches() is FALSE on the bare echoed-input line only (send-vs-match split, Pitfall 1)', () => {
    // The shell echoed the input but has not produced a following output/prompt line.
    expect(buildPosixProbe('NONCE').matches('NONCE\r')).toBe(false);
  });

  it('matches() is TRUE once the nonce is followed by a newline + re-prompt (processed)', () => {
    expect(buildPosixProbe('NONCE').matches('NONCE\nuser@host% ')).toBe(true);
  });

  it("selectReadinessProbe('win32').forShell() THROWS (Phase-8 stub, D-03)", () => {
    const provider = selectReadinessProbe('win32');
    expect(() => provider.forShell('/x')).toThrow(/Phase 8/);
  });

  it("selectReadinessProbe('darwin') is a MacReadinessProbe with a __JW_READY_-sentinel CR marker", () => {
    const provider = selectReadinessProbe('darwin');
    expect(provider).toBeInstanceOf(MacReadinessProbe);
    const probe = provider.forShell('/bin/zsh');
    expect(probe.marker.startsWith(': __JW_READY_')).toBe(true);
    expect(probe.marker.endsWith('\r')).toBe(true);
  });

  it('exposes the bare `nonce` token (no `: ` prefix / CR) for D-02 scrubbing (RESEARCH Open Q3)', () => {
    expect(buildPosixProbe('NONCE').nonce).toBe('NONCE');
    const probe = selectReadinessProbe('darwin').forShell('/bin/zsh');
    expect(probe.nonce.startsWith('__JW_READY_')).toBe(true);
    // The bare nonce carries neither the `: ` no-op prefix nor the CR terminator.
    expect(probe.nonce.includes(': ')).toBe(false);
    expect(probe.nonce.includes('\r')).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Group 2 — FakeChild state-machine tests (RED until Plans 02/03 implement the
// create() probe hook). Harness mirrors pty-lifecycle.test.ts.
// ───────────────────────────────────────────────────────────────────────────

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

type ExitCb = (e: { exitCode: number; signal?: number }) => void;
type DataCb = (d: string) => void;

interface FakeChild {
  pid: number;
  kill: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  onData: (cb: DataCb) => void;
  onExit: (cb: ExitCb) => void;
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
    // node-pty's onData/onExit return an IDisposable; mirror that so the probe
    // hook's `onProbeData.dispose()` does not crash when Plan 02 lands.
    onData: (cb: DataCb) => {
      dataCbs.push(cb);
      return { dispose: () => void 0 };
    },
    onExit: (cb: ExitCb) => {
      exitCbs.push(cb);
      return { dispose: () => void 0 };
    },
    _fireExit: (e) => exitCbs.forEach((cb) => cb(e)),
    _fireData: (d) => dataCbs.forEach((cb) => cb(d)),
  };
}

const spawnMock = vi.fn((): FakeChild => {
  const child = makeFakeChild();
  spawnedChildren.push(child);
  return child;
});

vi.mock('node-pty', () => ({
  spawn: (...a: unknown[]) =>
    spawnMock(...(a as [string, string[], { cwd?: string }])),
}));

vi.mock('../shell-resolver', () => ({
  resolveShell: () => ({ shell: '/bin/zsh', args: ['-l'] }),
}));

import {
  PtyManager,
  PTY_CHANNELS,
  READINESS_TIMEOUT_MS,
  stripProbeEcho,
  type PtyCreateOptions,
} from '../pty-manager';

// ───────────────────────────────────────────────────────────────────────────
// D-02 scrub helper — pure, no harness (RESEARCH Open Q3 hardening).
// ───────────────────────────────────────────────────────────────────────────
describe('stripProbeEcho (D-02 invisibility hardening)', () => {
  it('removes the `: <nonce>` marker echo wherever it races past the settle', () => {
    const out = stripProbeEcho('user@host % : __JW_READY_ab12__ ', '__JW_READY_ab12__');
    expect(out).not.toContain('__JW_READY_ab12__');
    expect(out).not.toContain(': __JW_READY_');
  });

  it('removes a bare nonce occurrence (no `: ` prefix) too', () => {
    expect(stripProbeEcho('xx __JW_READY_ab12__ yy', '__JW_READY_ab12__')).toBe('xx  yy');
  });

  it('leaves nonce-free real shell output untouched', () => {
    expect(stripProbeEcho('totally normal output\n', '__JW_READY_ab12__')).toBe(
      'totally normal output\n',
    );
  });
});

function fakeWindow(): never {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn(), isDestroyed: () => false },
  } as never;
}

const ORIGINAL_PLATFORM = process.platform;
function setPlatform(p: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: p, configurable: true });
}

function dormantWithCommand(
  startupCommand: string | undefined,
  over: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    logicalId: 'auto-run-1' as LogicalId,
    ptyPid: undefined,
    name: 'AutoRun',
    icon: { type: 'emoji', value: '🛋️' },
    cwd: '/Users/fake-home',
    shell: '/bin/zsh',
    startupCommand,
    status: 'not_started',
    order: 1,
    lastActive: 1_700_000_000_000,
    ...over,
  };
}

const baseOpts: PtyCreateOptions = { cols: 80, rows: 24 };

/** The probe nonce embedded in the marker the create() hook writes to the PTY. */
function probeNonce(child: FakeChild): string {
  // The hook's FIRST write to the child is the probe marker `: <nonce>\r`.
  const firstWrite = child.write.mock.calls[0]?.[0] as string | undefined;
  const m = firstWrite?.match(/__JW_READY_[0-9a-f]+__/);
  return m?.[0] ?? '__JW_READY_unknown__';
}

/** True if the fake window received ANY `pty:data` send carrying `needle`. */
function sentDataContains(win: ReturnType<typeof fakeWindow>, needle: string): boolean {
  const send = (win as unknown as { webContents: { send: ReturnType<typeof vi.fn> } })
    .webContents.send;
  return send.mock.calls.some(
    ([channel, payload]: [string, { data?: string }]) =>
      channel === PTY_CHANNELS.data && typeof payload?.data === 'string' && payload.data.includes(needle),
  );
}

describe('create() readiness-probe hook (SC1/SC2/SC4/D-02 — GREEN as of Plan 03)', () => {
  beforeEach(() => {
    spawnedChildren.length = 0;
    nextPid = 3000;
    spawnMock.mockClear();
    setPlatform('darwin');
  });

  afterEach(() => {
    setPlatform(ORIGINAL_PLATFORM);
    vi.useRealTimers();
  });

  it('withholds probe bytes from the renderer BEFORE the marker round-trips (D-02 invisibility)', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);
    mgr.hydrate([dormantWithCommand('echo HI')]);
    mgr.create({ ...baseOpts, id: 'auto-run-1' as LogicalId });
    const child = spawnedChildren[0];

    // Pre-match bytes (the marker echo + rc noise) must NOT reach the renderer.
    child._fireData('some-rc-noise-and-: __JW_READY_x__ echoed');
    expect(sentDataContains(win, 'some-rc-noise')).toBe(false);
  });

  it('on marker match, injects `startupCommand + "\\r"` (SC1 injection, CR terminator)', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);
    mgr.hydrate([dormantWithCommand('echo HI')]);
    mgr.create({ ...baseOpts, id: 'auto-run-1' as LogicalId });
    const child = spawnedChildren[0];

    const nonce = probeNonce(child);
    // Fire a produced output line that carries the nonce + a fresh prompt → matches.
    child._fireData(`${nonce}\nuser@host% `);

    expect(child.write).toHaveBeenCalledWith('echo HI\r');
  });

  it('on timeout (no match), FLUSHES buffered bytes + does NOT inject the command (D-04/SC4)', () => {
    vi.useFakeTimers();
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);
    mgr.hydrate([dormantWithCommand('echo HI')]);
    mgr.create({ ...baseOpts, id: 'auto-run-1' as LogicalId });
    const child = spawnedChildren[0];

    // Buffer real output but NEVER fire a nonce-matching line.
    child._fireData('PROMPT_NEVER_SETTLES% ');
    vi.advanceTimersByTime(READINESS_TIMEOUT_MS);

    // Timeout path: the buffered bytes are flushed (bare prompt usable — SC4) ...
    expect(sentDataContains(win, 'PROMPT_NEVER_SETTLES')).toBe(true);
    // ... and the command is NEVER injected (D-04: never best-effort inject).
    expect(child.write).not.toHaveBeenCalledWith('echo HI\r');
  });

  it('empty/whitespace startupCommand → no injection + normal forwarding (SC2/TERM-03)', () => {
    const mgr = new PtyManager();
    const win = fakeWindow();
    mgr.registerIpc(win);
    mgr.hydrate([dormantWithCommand('   ')]);
    mgr.create({ ...baseOpts, id: 'auto-run-1' as LogicalId });
    const child = spawnedChildren[0];

    // No probe gate for an empty command → onData forwards bytes straight through.
    child._fireData('normal output');
    expect(sentDataContains(win, 'normal output')).toBe(true);
    // No command is ever written (whitespace trims to empty — SC2).
    expect(child.write).not.toHaveBeenCalledWith('   \r');
    expect(child.write).not.toHaveBeenCalledWith('\r');
  });
});
