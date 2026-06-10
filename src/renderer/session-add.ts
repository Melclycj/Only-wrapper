// RENDERER ONLY — the pure spawn-ownership path (03-02, T-03-09).
//
// This module deliberately imports NOTHING from React or xterm so the
// no-double-spawn invariant is unit-testable in the Node/Vitest env without
// pulling in browser-only globals (xterm addons reference `self` at load). It is
// the SINGLE place a renderer-side SessionRecord is minted from a spawn result —
// SessionManager.onAdd is the only caller in production.

import type { LogicalId, SessionRecord } from '../shared/types';

// Default add-session scheme (RESEARCH Open Q3): name `Session N`, default emoji
// icon, cwd undefined → MAIN resolves os.homedir() (03-01; renderer never computes
// home). order/lastActive fill the SessionRecord contract.
export const DEFAULT_ICON = { type: 'emoji' as const, value: '🖥️' };

// Initial geometry handed to ptyCreate before the SessionView fits its container;
// the view re-fits + ptyResizes on mount/activate (Pattern 8).
export const DEFAULT_COLS = 80;
export const DEFAULT_ROWS = 24;

/**
 * Spawn ONE PTY and build its SessionRecord — the single spawn path (T-03-09).
 *
 * `spawn` is dependency-injected (production passes `window.api.ptyCreate`) so the
 * invariant is directly unit-testable with a spy: each call performs EXACTLY ONE
 * spawn and yields exactly one record. `existingCount` indexes the new row at the
 * end of the current list and drives the `Session N` name.
 */
export async function addSession(
  existingCount: number,
  spawn: (opts: {
    cols: number;
    rows: number;
    cwd?: string;
  }) => Promise<{ id: LogicalId; pid: number }>,
): Promise<SessionRecord> {
  // cwd: undefined → main defaults to os.homedir() (03-01). EXACTLY ONE spawn.
  const { id, pid } = await spawn({
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
    cwd: undefined,
  });
  return {
    logicalId: id,
    ptyPid: pid,
    name: `Session ${existingCount + 1}`,
    icon: DEFAULT_ICON,
    cwd: '', // main resolved the real cwd; renderer carries the contract field
    shell: '',
    status: 'running',
    order: existingCount,
    lastActive: Date.now(),
  };
}
