// Restart-to-apply decision unit test (12-06, GAP-12-B) — proves the pure reducer only
// prompts when a LIVE session's launch fields actually changed, honoring the WR-05
// startupCommand trim semantics (a whitespace-only delta is a no-op).
//
// Like session-close.test.ts this targets the React/xterm-free helper
// (session-restart-prompt.ts) so it runs in the `node` Vitest env with no jsdom.

import { describe, it, expect } from 'vitest';
import {
  launchFieldsChanged,
  needsRestartPrompt,
  restartPromptIdFor,
  type LaunchFields,
} from '../session-restart-prompt';
import type { LogicalId, SessionRecord } from '../../shared/types';

const base: LaunchFields = {
  cwd: '/home/me/proj',
  shell: '/bin/zsh',
  startupCommand: 'npm run dev',
};

function makeRow(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    logicalId: 'r1' as LogicalId,
    ptyPid: 1000,
    name: 'r1',
    icon: { type: 'emoji', value: '🖥️' },
    cwd: base.cwd,
    shell: base.shell,
    startupCommand: base.startupCommand,
    status: 'running',
    order: 0,
    lastActive: 0,
    ...overrides,
  };
}

describe('launchFieldsChanged', () => {
  it('returns false when nothing changed', () => {
    expect(launchFieldsChanged(base, { ...base })).toBe(false);
  });

  it('detects a cwd change', () => {
    expect(launchFieldsChanged(base, { ...base, cwd: '/other' })).toBe(true);
  });

  it('detects a shell change', () => {
    expect(launchFieldsChanged(base, { ...base, shell: '/bin/bash' })).toBe(
      true,
    );
  });

  it('detects a startupCommand change', () => {
    expect(
      launchFieldsChanged(base, { ...base, startupCommand: 'npm start' }),
    ).toBe(true);
  });

  it('treats a whitespace-only startupCommand delta as no change (WR-05 trim)', () => {
    expect(
      launchFieldsChanged(base, { ...base, startupCommand: '  npm run dev  ' }),
    ).toBe(false);
  });
});

describe('needsRestartPrompt', () => {
  it('prompts when running + cwd changed', () => {
    expect(
      needsRestartPrompt({
        status: 'running',
        before: base,
        after: { ...base, cwd: '/elsewhere' },
      }),
    ).toBe(true);
  });

  it('does NOT prompt when running but only name/icon changed (no launch delta)', () => {
    // name/icon are not part of LaunchFields — an identical launch payload → no prompt.
    expect(
      needsRestartPrompt({
        status: 'running',
        before: base,
        after: { ...base },
      }),
    ).toBe(false);
  });

  it('does NOT prompt for a dormant (not_started) session even when cwd changed', () => {
    expect(
      needsRestartPrompt({
        status: 'not_started',
        before: base,
        after: { ...base, cwd: '/elsewhere' },
      }),
    ).toBe(false);
  });

  it('does NOT prompt when running + startupCommand changed by whitespace only', () => {
    expect(
      needsRestartPrompt({
        status: 'running',
        before: base,
        after: { ...base, startupCommand: '  npm run dev  ' },
      }),
    ).toBe(false);
  });

  it('does NOT prompt for a stopped/exited/error session with a launch change', () => {
    for (const status of ['stopped', 'exited', 'error'] as const) {
      expect(
        needsRestartPrompt({
          status,
          before: base,
          after: { ...base, shell: '/bin/bash' },
        }),
      ).toBe(false);
    }
  });
});

describe('restartPromptIdFor (save call-site convenience)', () => {
  it('returns the row id when a running row had a launch change', () => {
    const row = makeRow();
    expect(restartPromptIdFor(row, { ...base, cwd: '/new' })).toBe('r1');
  });

  it('returns null when nothing changed', () => {
    expect(restartPromptIdFor(makeRow(), { ...base })).toBeNull();
  });

  it('returns null for a dormant row even with a launch change', () => {
    const row = makeRow({ status: 'not_started' });
    expect(restartPromptIdFor(row, { ...base, cwd: '/new' })).toBeNull();
  });

  it('returns null for a null row (defensive)', () => {
    expect(restartPromptIdFor(null, base)).toBeNull();
  });

  it('treats an undefined row.startupCommand as empty (whitespace after → no change → null)', () => {
    const row = makeRow({ startupCommand: undefined });
    // before '' vs after '   '.trim()='' → no launch change → null.
    expect(
      restartPromptIdFor(row, { ...base, startupCommand: '   ' }),
    ).toBeNull();
  });

  it('treats an undefined row.startupCommand as empty (real after value → change → id)', () => {
    const row = makeRow({ startupCommand: undefined });
    // before '' vs after 'npm start' → change → prompt.
    expect(
      restartPromptIdFor(row, { ...base, startupCommand: 'npm start' }),
    ).toBe('r1');
  });
});
