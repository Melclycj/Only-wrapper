// Remove/Delete decision unit test (12-06, IN-02 extraction) — proves resolveRemoveAction
// reproduces confirmClose's isConfiguredLive branch byte-for-byte across the four cases:
// configured-live-remove (keep recipe), ephemeral-remove (permanent), delete-dormant
// (permanent), delete-live-impossible (permanent — Delete is always a permanent close).
//
// React/xterm-free helper → runs in the `node` Vitest env (mirrors session-close.test.ts).

import { describe, it, expect } from 'vitest';
import { resolveRemoveAction, flipToDormant } from '../session-lifecycle-actions';
import type { LogicalId, SessionRecord } from '../../shared/types';

function makeSession(
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    logicalId: 'a' as LogicalId,
    ptyPid: 1000,
    name: 'a',
    icon: { type: 'emoji', value: '🖥️' },
    cwd: '',
    shell: '',
    status: 'running',
    order: 0,
    lastActive: 0,
    configured: true,
    ...overrides,
  };
}

describe('resolveRemoveAction (IN-02 — confirmClose decision)', () => {
  it('REMOVE of a configured live session keeps the recipe (configured-remove)', () => {
    const row = makeSession({ configured: true, status: 'running' });
    expect(resolveRemoveAction(row, 'remove')).toEqual({
      kind: 'configured-remove',
    });
  });

  it('REMOVE of an ephemeral (unconfigured) live session is permanent', () => {
    const row = makeSession({ configured: undefined, status: 'running' });
    expect(resolveRemoveAction(row, 'remove')).toEqual({
      kind: 'permanent-close',
    });
  });

  it('REMOVE of a configured-but-dormant session is permanent (status not_started)', () => {
    const row = makeSession({ configured: true, status: 'not_started' });
    expect(resolveRemoveAction(row, 'remove')).toEqual({
      kind: 'permanent-close',
    });
  });

  it('DELETE of a dormant session is always permanent', () => {
    const row = makeSession({ configured: true, status: 'not_started' });
    expect(resolveRemoveAction(row, 'delete')).toEqual({
      kind: 'permanent-close',
    });
  });

  it('DELETE of a configured LIVE session is still permanent (Delete never keeps the recipe)', () => {
    const row = makeSession({ configured: true, status: 'running' });
    expect(resolveRemoveAction(row, 'delete')).toEqual({
      kind: 'permanent-close',
    });
  });

  it('a null row is permanent (defensive — confirmClose guards closingId before this)', () => {
    expect(resolveRemoveAction(null, 'remove')).toEqual({
      kind: 'permanent-close',
    });
  });
});

describe('flipToDormant (configured-remove transform)', () => {
  it('flips the target row to not_started, dropping pid + transient overlays', () => {
    const rows = [
      { ...makeSession({ logicalId: 'a' as LogicalId }), errorMessage: 'x', agentState: 'free' },
      makeSession({ logicalId: 'b' as LogicalId, status: 'running', ptyPid: 2000 }),
    ];
    const next = flipToDormant(rows, 'b' as LogicalId);
    const b = next.find((r) => r.logicalId === ('b' as LogicalId));
    expect(b?.status).toBe('not_started');
    expect(b?.ptyPid).toBeUndefined();
    expect((b as { agentState?: unknown }).agentState).toBeUndefined();
    expect((b as { errorMessage?: string }).errorMessage).toBeUndefined();
  });

  it('leaves OTHER rows (incl. their transient overlays) untouched', () => {
    const rows = [
      { ...makeSession({ logicalId: 'a' as LogicalId }), errorMessage: 'keep' },
      makeSession({ logicalId: 'b' as LogicalId }),
    ];
    const next = flipToDormant(rows, 'b' as LogicalId);
    const a = next.find((r) => r.logicalId === ('a' as LogicalId));
    expect((a as { errorMessage?: string }).errorMessage).toBe('keep');
    expect(a?.status).toBe('running');
  });
});
