// Remove/Delete decision unit test (12-06, IN-02 extraction) — proves resolveRemoveAction
// reproduces confirmClose's isConfiguredLive branch byte-for-byte across the four cases:
// configured-live-remove (keep recipe), ephemeral-remove (permanent), delete-dormant
// (permanent), delete-live-impossible (permanent — Delete is always a permanent close).
//
// React/xterm-free helper → runs in the `node` Vitest env (mirrors session-close.test.ts).

import { describe, it, expect } from 'vitest';
import { resolveRemoveAction } from '../session-lifecycle-actions';
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
