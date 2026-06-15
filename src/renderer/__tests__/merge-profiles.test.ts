// Wave 0 RED stub (12-01 Task 1) — covers SESS-05 the edit-prefill merge.
//
// INTENTIONALLY FAILS RED until 12-01 Task 1 implements src/renderer/merge-profiles.ts
// (mergeAuthoritativeProfiles). Targets the React/xterm/electron-free pure reducer
// (mirrors session-close.ts) so it runs in the Node/Vitest env. The reducer extracts
// the inline rehydrateProfiles map at SessionManager.tsx:388-405: merge main's
// authoritative cwd/shell/startupCommand/configured back into rows by logicalId while
// NEVER disturbing status/errorMessage (owned by the onPtyStatus subscription).

import { describe, it, expect } from 'vitest';
import { mergeAuthoritativeProfiles } from '../merge-profiles';
import type { LogicalId, SessionRecord } from '../../shared/types';

function makeRow(
  id: string,
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    logicalId: id as LogicalId,
    ptyPid: 1000,
    name: id,
    icon: { type: 'emoji', value: '🖥️' },
    cwd: '',
    shell: '/bin/zsh',
    startupCommand: '',
    status: 'not_started',
    order: 0,
    lastActive: 0,
    ...overrides,
  };
}

describe('mergeAuthoritativeProfiles (SESS-05 edit-prefill merge)', () => {
  it('(a) freshly-spawned row (cwd:"") adopts main\'s resolved cwd', () => {
    const rows = [makeRow('a', { cwd: '' })];
    const authoritative = [makeRow('a', { cwd: '/Users/me' })];
    const result = mergeAuthoritativeProfiles(rows, authoritative);
    expect(result[0].cwd).toBe('/Users/me');
  });

  it('(b) edited-then-saved row adopts main\'s trimmed/validated truth', () => {
    const rows = [
      makeRow('a', { cwd: '  /stale/submit  ', startupCommand: 'old' }),
    ];
    const authoritative = [
      makeRow('a', { cwd: '/Users/me/project', startupCommand: 'npm run dev' }),
    ];
    const result = mergeAuthoritativeProfiles(rows, authoritative);
    expect(result[0].cwd).toBe('/Users/me/project');
    expect(result[0].startupCommand).toBe('npm run dev');
  });

  it('(c) status/errorMessage are NEVER touched by the merge', () => {
    const errorMessage = 'Working directory not found: /no/such/dir';
    const rows = [
      makeRow('a', { status: 'running', errorMessage } as Partial<SessionRecord>),
    ];
    const authoritative = [
      makeRow('a', { cwd: '/Users/me', status: 'exited' } as Partial<SessionRecord>),
    ];
    const result = mergeAuthoritativeProfiles(rows, authoritative);
    // cwd adopted main's truth...
    expect(result[0].cwd).toBe('/Users/me');
    // ...but status + errorMessage stay byte-identical to the renderer row.
    expect(result[0].status).toBe('running');
    expect((result[0] as SessionRecord & { errorMessage?: string }).errorMessage).toBe(
      errorMessage,
    );
  });

  it('(d) unknown id is returned unchanged (object-identical)', () => {
    const rows = [makeRow('a', { cwd: '/local/guess' })];
    const authoritative = [makeRow('b', { cwd: '/Users/me' })];
    const result = mergeAuthoritativeProfiles(rows, authoritative);
    // no truth for "a" → same reference, no clone
    expect(result[0]).toBe(rows[0]);
  });

  it('configured falls back to row.configured when truth.configured is undefined', () => {
    const rows = [makeRow('a', { configured: true })];
    const authoritative = [makeRow('a', { cwd: '/Users/me', configured: undefined })];
    const result = mergeAuthoritativeProfiles(rows, authoritative);
    expect(result[0].configured).toBe(true);
  });
});
