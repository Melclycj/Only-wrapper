// No-double-spawn unit test (T-03-09, the Warning fix) — proves SessionManager's
// SOLE spawn path issues EXACTLY ONE ptyCreate per add and that the session list
// tracks adds 1:1 (no orphan PTY, no double-spawn).
//
// Why this targets `addSession` (the exported helper in session-add.ts) rather
// than rendering the component: the Vitest environment here is `node`
// (vitest.config.ts) with no jsdom/testing-library installed, and Phase 3's
// scope/package audit forbids adding test packages. `addSession` is the SINGLE
// spawn path SessionManager.onAdd calls (kept in a React/xterm-free module so it
// imports cleanly in node) — so driving it directly with a ptyCreate spy proves
// the invariant at its source:
//   - the spy is called exactly N times for N adds (one spawn per add)
//   - each add yields exactly one SessionRecord (sessions.length tracks adds)
//   - the returned id/pid flow from the spawn result (the controlled SessionView
//     binds to THIS id and never spawns).

import { describe, it, expect, vi } from 'vitest';
import { addSession } from '../session-add';
import type { LogicalId, SessionRecord } from '../../shared/types';

// A ptyCreate spy returning incrementing { id, pid } — mirrors what main returns.
function makeSpawnSpy(): {
  spy: ReturnType<typeof vi.fn>;
  spawn: (opts: {
    cols: number;
    rows: number;
    cwd?: string;
  }) => Promise<{ id: LogicalId; pid: number }>;
} {
  let n = 0;
  const spy = vi.fn(async () => {
    n += 1;
    return { id: `session-${n}` as LogicalId, pid: 1000 + n };
  });
  return { spy, spawn: spy as never };
}

describe('SessionManager spawn ownership (T-03-09, no double-spawn)', () => {
  it('issues exactly one ptyCreate per add and tracks the list 1:1', async () => {
    const { spy, spawn } = makeSpawnSpy();
    const sessions: SessionRecord[] = [];

    // Three "add session" actions through the SOLE spawn path.
    for (let i = 0; i < 3; i++) {
      const record = await addSession(sessions.length, spawn);
      sessions.push(record);
    }

    // EXACTLY one spawn per add — no double-spawn, no orphan PTY.
    expect(spy).toHaveBeenCalledTimes(3);
    // The list tracks adds 1:1.
    expect(sessions).toHaveLength(3);
    // Each record carries a distinct logical id from its single spawn result.
    const ids = new Set(sessions.map((s) => s.logicalId));
    expect(ids.size).toBe(3);
  });

  it('passes cwd:undefined so MAIN resolves os.homedir() (renderer never computes home)', async () => {
    const { spy, spawn } = makeSpawnSpy();
    await addSession(0, spawn);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ cwd: undefined });
  });

  it('names sessions "Session N" and marks them running on spawn', async () => {
    const { spawn } = makeSpawnSpy();
    const first = await addSession(0, spawn);
    const second = await addSession(1, spawn);
    expect(first.name).toBe('Session 1');
    expect(second.name).toBe('Session 2');
    expect(first.status).toBe('running');
    expect(first.icon).toEqual({ type: 'emoji', value: '🖥️' });
  });
});
