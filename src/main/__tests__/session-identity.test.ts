// FIX 4b unit guard (06.1-04 gap-closure) — the pure IDENTITY/RECIPE persist predicate.
//
// Persistence policy (user decision, supersedes the original edit-only D-02): a session
// persists if it is `configured` (explicitly edited) OR has IDENTITY — a non-empty
// startupCommand, a custom name, a custom icon, a non-default cwd, or a non-default
// shell. A bare blank `+ New` (all defaults, no command) stays ephemeral.

import { describe, it, expect } from 'vitest';
import {
  hasIdentity,
  shouldPersist,
  type SessionDefaults,
} from '../session-identity';
import type { LogicalId, SessionRecord } from '../../shared/types';

const DEFAULTS: SessionDefaults = {
  icon: { type: 'emoji', value: '🖥️' },
  cwd: '/Users/fake-home',
  shell: '/bin/zsh',
};

/** A bare `+ New` session: auto name, default icon/cwd/shell, no command, not configured. */
function bareSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    logicalId: 'sess-1' as LogicalId,
    name: 'Session 1',
    icon: { type: 'emoji', value: '🖥️' },
    cwd: '/Users/fake-home',
    shell: '/bin/zsh',
    status: 'running',
    order: 0,
    lastActive: 0,
    ...overrides,
  };
}

describe('hasIdentity (FIX 4b recipe predicate)', () => {
  it('a bare +New (all defaults, no command, not configured) has NO identity', () => {
    expect(hasIdentity(bareSession(), DEFAULTS)).toBe(false);
  });

  it('a non-empty startupCommand IS identity', () => {
    expect(
      hasIdentity(bareSession({ startupCommand: 'claude --rc' }), DEFAULTS),
    ).toBe(true);
  });

  it('a whitespace-only startupCommand is NOT identity (trimmed to empty)', () => {
    expect(hasIdentity(bareSession({ startupCommand: '   ' }), DEFAULTS)).toBe(
      false,
    );
  });

  it('a custom name (not the auto "Session N" pattern) IS identity', () => {
    expect(hasIdentity(bareSession({ name: 'Parlour Claude RC' }), DEFAULTS)).toBe(
      true,
    );
  });

  it('the auto "Session N" name and the bare "Session" fallback are NOT identity', () => {
    expect(hasIdentity(bareSession({ name: 'Session 7' }), DEFAULTS)).toBe(false);
    expect(hasIdentity(bareSession({ name: 'Session' }), DEFAULTS)).toBe(false);
  });

  it('a custom icon (differs from the default emoji) IS identity', () => {
    expect(
      hasIdentity(bareSession({ icon: { type: 'emoji', value: '🛋️' } }), DEFAULTS),
    ).toBe(true);
    expect(
      hasIdentity(
        bareSession({ icon: { type: 'color', value: '#ff0000' } }),
        DEFAULTS,
      ),
    ).toBe(true);
  });

  it('a non-default cwd IS identity; the default cwd is not', () => {
    expect(hasIdentity(bareSession({ cwd: '/tmp/project' }), DEFAULTS)).toBe(true);
    expect(hasIdentity(bareSession({ cwd: '/Users/fake-home' }), DEFAULTS)).toBe(
      false,
    );
  });

  it('a non-default shell IS identity; the default shell is not', () => {
    expect(hasIdentity(bareSession({ shell: '/bin/bash' }), DEFAULTS)).toBe(true);
    expect(hasIdentity(bareSession({ shell: '/bin/zsh' }), DEFAULTS)).toBe(false);
  });
});

describe('shouldPersist (configured OR hasIdentity)', () => {
  it('an explicitly-configured bare session persists even with no identity fields', () => {
    expect(shouldPersist(bareSession({ configured: true }), DEFAULTS)).toBe(true);
  });

  it('a recipe session (startupCommand) persists WITHOUT a manual edit (configured undefined)', () => {
    expect(
      shouldPersist(bareSession({ startupCommand: 'codex' }), DEFAULTS),
    ).toBe(true);
  });

  it('a bare ephemeral session does NOT persist', () => {
    expect(shouldPersist(bareSession(), DEFAULTS)).toBe(false);
  });
});
