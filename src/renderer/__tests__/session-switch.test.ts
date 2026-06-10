// Wave 0 RED stub (04-01 Task 1) — covers NAV-05 / D-12 the switch reducer.
//
// INTENTIONALLY FAILS RED until 04-01 Task 2 implements src/renderer/session-switch.ts
// (resolveSwitch). Targets the React/xterm/electron-free pure reducer (mirrors
// session-close.test.ts) so it runs in the Node/Vitest env.

import { describe, it, expect } from 'vitest';
import { resolveSwitch } from '../session-switch';
import type { LogicalId, SessionRecord } from '../../shared/types';
import type { SwitchIntent } from '../../main/switch-keys';

function makeSession(id: string): SessionRecord {
  return {
    logicalId: id as LogicalId,
    ptyPid: 1000,
    name: id,
    icon: { type: 'emoji', value: '🖥️' },
    cwd: '',
    shell: '',
    status: 'running',
    order: 0,
    lastActive: 0,
  };
}

const pos = (index: number): SwitchIntent => ({ kind: 'position', index });
const next: SwitchIntent = { kind: 'next' };
const prev: SwitchIntent = { kind: 'prev' };

describe('resolveSwitch reducer (NAV-05, D-12)', () => {
  const sessions = [makeSession('a'), makeSession('b'), makeSession('c')];

  it('maps an in-range position intent to that session id', () => {
    expect(resolveSwitch(sessions, 'a' as LogicalId, pos(0))).toBe('a');
    expect(resolveSwitch(sessions, 'a' as LogicalId, pos(2))).toBe('c');
  });

  it('leaves activeId unchanged for an out-of-range position intent', () => {
    expect(resolveSwitch(sessions, 'a' as LogicalId, pos(9))).toBe('a');
  });

  it('next wraps from the last session back to the first', () => {
    expect(resolveSwitch(sessions, 'c' as LogicalId, next)).toBe('a');
    expect(resolveSwitch(sessions, 'a' as LogicalId, next)).toBe('b');
  });

  it('prev wraps from the first session back to the last', () => {
    expect(resolveSwitch(sessions, 'a' as LogicalId, prev)).toBe('c');
    expect(resolveSwitch(sessions, 'b' as LogicalId, prev)).toBe('a');
  });

  it('treats an unknown activeId as index 0 for next/prev', () => {
    expect(resolveSwitch(sessions, 'zzz' as LogicalId, next)).toBe('b');
    expect(resolveSwitch(sessions, 'zzz' as LogicalId, prev)).toBe('c');
  });

  it('returns activeId unchanged for an empty session list', () => {
    expect(resolveSwitch([], 'a' as LogicalId, next)).toBe('a');
    expect(resolveSwitch([], null, pos(0))).toBeNull();
  });
});
