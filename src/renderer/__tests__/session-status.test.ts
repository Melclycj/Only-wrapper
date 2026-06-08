// FIX 4a unit guard (06.1-04 gap-closure) — the pure status-transition reducer that
// lands a configured/recipe SELF-EXIT in the Inactive-List partition.
//
// Defect: when a configured session self-exits, main moves it to dormant and broadcasts
// pty:status 'exited', but the renderer only set the row to 'exited' (which the Sidebar
// partition keeps in the WORKING AREA) — so it never visibly entered the Inactive List
// mid-session. The reducer must instead present an IDENTITY row's self-exit as
// 'not_started' so the partition (status==='not_started' → Inactive List) shows it.

import { describe, it, expect } from 'vitest';
import {
  resolveRowStatus,
  hasRendererIdentity,
  type RowIdentity,
} from '../session-status';

function row(overrides: Partial<RowIdentity> = {}): RowIdentity {
  return {
    status: 'running',
    name: 'Session 1',
    icon: { type: 'emoji', value: '🖥️' },
    ...overrides,
  };
}

describe('hasRendererIdentity (FIX 4a renderer-visible identity)', () => {
  it('a bare +New row (auto name, default icon, no command, not configured) has no identity', () => {
    expect(hasRendererIdentity(row())).toBe(false);
  });

  it('configured === true is identity', () => {
    expect(hasRendererIdentity(row({ configured: true }))).toBe(true);
  });

  it('a non-empty startupCommand is identity', () => {
    expect(hasRendererIdentity(row({ startupCommand: 'claude --rc' }))).toBe(true);
  });

  it('a custom (non-auto) name is identity; "Session N" / "Session" are not', () => {
    expect(hasRendererIdentity(row({ name: 'Parlour Claude RC' }))).toBe(true);
    expect(hasRendererIdentity(row({ name: 'Session 9' }))).toBe(false);
    expect(hasRendererIdentity(row({ name: 'Session' }))).toBe(false);
  });

  it('a custom icon is identity', () => {
    expect(
      hasRendererIdentity(row({ icon: { type: 'emoji', value: '🛋️' } })),
    ).toBe(true);
  });
});

describe('resolveRowStatus (FIX 4a self-exit → Inactive List)', () => {
  it('a CONFIGURED row self-exit (exited) is presented as not_started → Inactive List', () => {
    expect(resolveRowStatus(row({ configured: true }), 'exited')).toBe(
      'not_started',
    );
  });

  it('a CONFIGURED row self-exit (error) is also presented as not_started', () => {
    expect(resolveRowStatus(row({ configured: true }), 'error')).toBe(
      'not_started',
    );
  });

  it('a RECIPE row (startupCommand, not configured) self-exit → not_started (FIX 4b parity)', () => {
    expect(resolveRowStatus(row({ startupCommand: 'codex' }), 'exited')).toBe(
      'not_started',
    );
  });

  it('a BARE ephemeral row self-exit passes through as the raw status (stays/leaves Working Area)', () => {
    expect(resolveRowStatus(row(), 'exited')).toBe('exited');
    expect(resolveRowStatus(row(), 'error')).toBe('error');
  });

  it('non-exit transitions pass through unchanged even for a configured row', () => {
    expect(resolveRowStatus(row({ configured: true }), 'running')).toBe('running');
    expect(resolveRowStatus(row({ configured: true }), 'stopped')).toBe('stopped');
    expect(resolveRowStatus(row({ configured: true }), 'not_started')).toBe(
      'not_started',
    );
  });
});
