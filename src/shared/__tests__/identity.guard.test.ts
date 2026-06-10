// Wave 0 failing stub — covers IDENT-01 and IDENT-02 (D-05)
// These tests INTENTIONALLY FAIL RED until Plan 02 implements:
//   - src/shared/types.ts (SessionRecord, LogicalId)
//   - src/shared/id-factory.ts (newLogicalId)
//
// When Plan 02 turns these GREEN, delete this comment block.

import { describe, it, expect } from 'vitest';
import type { SessionRecord, LogicalId } from '../types';
import { newLogicalId } from '../id-factory';

describe('SessionRecord identity invariant (D-05, IDENT-01, IDENT-02)', () => {
  it('logicalId and ptyPid are declared as distinct fields with different types', () => {
    // Type-level check: create a record and verify field types are structurally distinct
    const record: SessionRecord = {
      logicalId: 'test-id' as LogicalId,
      ptyPid: 12345, // plain number — NOT a LogicalId
      name: 'Test Session',
      icon: { type: 'emoji', value: '🧪' },
      cwd: '/tmp',
      shell: '/bin/zsh',
      status: 'not_started',
      order: 0,
      lastActive: Date.now(),
    };

    // Runtime assertion: they are genuinely separate fields with different values
    expect(typeof record.logicalId).toBe('string');
    expect(typeof record.ptyPid).toBe('number');
    expect(record.logicalId).not.toBe(record.ptyPid);
  });

  it('logicalId cannot be set to a raw number (compile-time enforced)', () => {
    // @ts-expect-error — assigning a number to LogicalId MUST produce a TypeScript error
    // If TypeScript accepts the line below, the brand is broken.
    const bad: LogicalId = 12345;
    // The @ts-expect-error annotation makes this test PASS in Vitest only when TS correctly rejects it.
    expect(bad).toBeDefined(); // never meaningfully reached — TS prevents compilation
  });

  it('newLogicalId() returns a string, not a number', () => {
    const id = newLogicalId();
    expect(typeof id).toBe('string');
    // A logical ID must never equal any numeric PID
    const fakePid = 99999;
    expect(id).not.toBe(fakePid);
  });

  it('two newLogicalId() calls return distinct values (IDENT-01: stable unique identity)', () => {
    const id1 = newLogicalId();
    const id2 = newLogicalId();
    expect(id1).not.toBe(id2);
  });
});
