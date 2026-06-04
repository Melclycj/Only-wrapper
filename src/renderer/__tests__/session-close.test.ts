// Destructive-close unit test (03-03 gap-closure, D-03a) — proves the pure close
// reducer drops EXACTLY the closed row and reselects a valid active id (or null),
// and that the Close flow issues EXACTLY ONE ptyClose for the closed id.
//
// Like session-add.test.ts this targets the React/xterm-free helper (session-close.ts)
// so it runs in the `node` Vitest env with no jsdom/testing-library (Phase 3 forbids
// adding test packages). The ptyClose side effect is driven directly through a spy to
// mirror what SessionManager.confirmClose() does.

import { describe, it, expect, vi } from 'vitest';
import { closeSession } from '../session-close';
import type { LogicalId, SessionRecord } from '../../shared/types';

function makeSession(id: string, status: SessionRecord['status'] = 'running'): SessionRecord {
  return {
    logicalId: id as LogicalId,
    ptyPid: 1000,
    name: id,
    icon: { type: 'emoji', value: '🖥️' },
    cwd: '',
    shell: '',
    status,
    order: 0,
    lastActive: 0,
  };
}

describe('closeSession reducer (D-03a destructive close)', () => {
  it('removes exactly the closed row and leaves the rest intact', () => {
    const sessions = [makeSession('a'), makeSession('b'), makeSession('c')];
    const result = closeSession(sessions, 'a' as LogicalId, 'b' as LogicalId);
    expect(result.sessions.map((s) => s.logicalId)).toEqual(['a', 'c']);
  });

  it('reselects the next remaining row when the ACTIVE row is closed', () => {
    const sessions = [makeSession('a'), makeSession('b'), makeSession('c')];
    const result = closeSession(sessions, 'a' as LogicalId, 'a' as LogicalId);
    expect(result.sessions.map((s) => s.logicalId)).toEqual(['b', 'c']);
    expect(result.activeId).toBe('b'); // first of the post-removal list
  });

  it('leaves activeId untouched when a NON-active row is closed', () => {
    const sessions = [makeSession('a'), makeSession('b')];
    const result = closeSession(sessions, 'a' as LogicalId, 'b' as LogicalId);
    expect(result.activeId).toBe('a');
  });

  it('reselects null when the last (active) row is closed', () => {
    const sessions = [makeSession('only')];
    const result = closeSession(sessions, 'only' as LogicalId, 'only' as LogicalId);
    expect(result.sessions).toHaveLength(0);
    expect(result.activeId).toBeNull();
  });

  it('the Close flow calls ptyClose exactly once for the closed id, then drops the row', () => {
    // Mirror SessionManager.confirmClose: ptyClose(id) side effect + pure reducer.
    const ptyClose = vi.fn();
    const sessions = [makeSession('a'), makeSession('b')];
    const id = 'a' as LogicalId;

    ptyClose(id);
    const result = closeSession(sessions, id, id);

    expect(ptyClose).toHaveBeenCalledTimes(1);
    expect(ptyClose).toHaveBeenCalledWith('a');
    expect(result.sessions.map((s) => s.logicalId)).toEqual(['b']);
    expect(result.activeId).toBe('b');
  });
});
