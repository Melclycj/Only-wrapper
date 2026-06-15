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
  type LaunchFields,
} from '../session-restart-prompt';

const base: LaunchFields = {
  cwd: '/home/me/proj',
  shell: '/bin/zsh',
  startupCommand: 'npm run dev',
};

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
