// Covers D-01 / SC2 (T-05-02): coerceOnLoad forces every restored record dormant
// (status 'not_started', ptyPid cleared) while preserving every other field.
// GREEN as of Plan 05-01 (src/main/store-schema.ts implements coerceOnLoad).
//
// Pure-helper test (mirrors shell-resolver.test.ts): in/out assertions, no I/O.

import { describe, it, expect } from 'vitest';
import { coerceOnLoad, SCHEMA_VERSION } from '../store-schema';
import type { LogicalId, SessionRecord } from '../../shared/types';

function makeRecord(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    logicalId: 'sess-1' as LogicalId,
    name: 'Parlour Claude RC',
    icon: { type: 'emoji', value: '🛋️' },
    cwd: '/Users/jerry/proj',
    shell: '/bin/zsh',
    startupCommand: 'claude --rc',
    status: 'running',
    order: 3,
    lastActive: 1700000000000,
    ...over,
  };
}

describe('coerceOnLoad (D-01 / SC2 / T-05-02)', () => {
  it('forces status to not_started even when persisted running', () => {
    const out = coerceOnLoad(makeRecord({ status: 'running' }));
    expect(out.status).toBe('not_started');
  });

  it('clears ptyPid even when a persisted pid was present', () => {
    const out = coerceOnLoad(makeRecord({ ptyPid: 1234 }));
    expect(out.ptyPid).toBeUndefined();
  });

  it('preserves every OTHER field unchanged', () => {
    const rec = makeRecord({ status: 'error', ptyPid: 9999 });
    const out = coerceOnLoad(rec);
    expect(out.logicalId).toBe(rec.logicalId);
    expect(out.name).toBe(rec.name);
    expect(out.icon).toEqual(rec.icon);
    expect(out.cwd).toBe(rec.cwd);
    expect(out.shell).toBe(rec.shell);
    expect(out.startupCommand).toBe(rec.startupCommand);
    expect(out.order).toBe(rec.order);
    expect(out.lastActive).toBe(rec.lastActive);
  });

  it('does not mutate the input record', () => {
    const rec = makeRecord({ status: 'running', ptyPid: 1234 });
    coerceOnLoad(rec);
    expect(rec.status).toBe('running');
    expect(rec.ptyPid).toBe(1234);
  });

  it('SCHEMA_VERSION is the stable migration anchor', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
