// Covers NAV-04 / SC3 / D-08 / Pitfall 6: reorder moves a row (arrayMove semantics)
// and reindexes EVERY record's order densely 0..n-1 — no gaps, no duplicate order
// values after a middle move. GREEN as of Plan 05-01 (src/renderer/session-reorder.ts).
//
// Pure-reducer test (mirrors session-close.test.ts): in/out assertions, no React/dnd-kit.

import { describe, it, expect } from 'vitest';
import { reorder } from '../session-reorder';
import type { LogicalId, SessionRecord } from '../../shared/types';

function makeRecord(id: string, order: number): SessionRecord {
  return {
    logicalId: id as LogicalId,
    name: `Session ${id}`,
    icon: { type: 'emoji', value: '🛋️' },
    cwd: '/tmp',
    shell: '/bin/zsh',
    status: 'not_started',
    order,
    lastActive: 0,
  };
}

const a = makeRecord('a', 0);
const b = makeRecord('b', 1);
const c = makeRecord('c', 2);
const d = makeRecord('d', 3);

describe('reorder (NAV-04 / SC3 / Pitfall 6)', () => {
  it('moves a row from its index to the target index (arrayMove)', () => {
    // Move 'a' (index 0) to where 'c' (index 2) sits.
    const out = reorder([a, b, c, d], 'a' as LogicalId, 'c' as LogicalId);
    expect(out.map((s) => s.logicalId)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a row upward (toId earlier than fromId)', () => {
    const out = reorder([a, b, c, d], 'd' as LogicalId, 'b' as LogicalId);
    expect(out.map((s) => s.logicalId)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('reindexes order densely 0..n-1 with no gaps after a middle move', () => {
    const out = reorder([a, b, c, d], 'a' as LogicalId, 'c' as LogicalId);
    expect(out.map((s) => s.order)).toEqual([0, 1, 2, 3]);
  });

  it('produces no duplicate order values', () => {
    const out = reorder([a, b, c, d], 'b' as LogicalId, 'd' as LogicalId);
    const orders = out.map((s) => s.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('returns a new array of new record objects (immutable update)', () => {
    const input = [a, b, c, d];
    const out = reorder(input, 'a' as LogicalId, 'b' as LogicalId);
    expect(out).not.toBe(input);
    expect(out[0]).not.toBe(input[0]);
    // input untouched
    expect(input.map((s) => s.logicalId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('normalizes order densely even for an unknown id (defensive no-move)', () => {
    const sparse = [makeRecord('x', 5), makeRecord('y', 9)];
    const out = reorder(sparse, 'unknown' as LogicalId, 'x' as LogicalId);
    expect(out.map((s) => s.logicalId)).toEqual(['x', 'y']);
    expect(out.map((s) => s.order)).toEqual([0, 1]);
  });
});
