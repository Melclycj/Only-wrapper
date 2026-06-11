// Pure coverage for the RENDERER row-secondary helpers (10-01 Task 1, D-03).
//
// secondaryText composes a sidebar row's line-2 from an ALREADY-RESOLVED status label
// (status-colors.ts presentation().label) plus the cwd tail / startup command. This file
// does NOT exercise the status→label mapping (that is status-colors.test.ts's job) — it
// covers the line-2 branch table and the cwdTail separator/edge cases.

import { describe, it, expect } from 'vitest';
import { cwdTail, secondaryText } from '../row-secondary';

describe('cwdTail — last path segment, separator-tolerant (D-03)', () => {
  it('returns the last segment of a POSIX path', () => {
    expect(cwdTail('/Users/jerry/Project/Marketing-parlour-room')).toBe('Marketing-parlour-room');
  });

  it('returns the last segment of a Windows backslash path', () => {
    expect(cwdTail('C:\\Users\\jerry\\proj')).toBe('proj');
  });

  it('strips a trailing slash before splitting', () => {
    expect(cwdTail('/Users/jerry/proj/')).toBe('proj');
  });

  it('strips a trailing backslash before splitting', () => {
    expect(cwdTail('C:\\Users\\jerry\\proj\\')).toBe('proj');
  });

  it('collapses a trailing-separator run', () => {
    expect(cwdTail('/Users/jerry/proj///')).toBe('proj');
  });

  it('returns empty string for empty input', () => {
    expect(cwdTail('')).toBe('');
  });

  it('returns empty string for the root separator alone', () => {
    expect(cwdTail('/')).toBe('');
    expect(cwdTail('\\')).toBe('');
  });

  it('returns the segment for a single bare name (no separators)', () => {
    expect(cwdTail('proj')).toBe('proj');
  });
});

describe('secondaryText — live rows (status !== not_started, D-03)', () => {
  it('composes `label · cwdTail` when a cwd is present', () => {
    expect(
      secondaryText({ status: 'running', cwd: '/Users/jerry/Project/app' }, 'Running'),
    ).toBe('Running · app');
  });

  it('falls back to the label alone when cwd is undefined', () => {
    expect(secondaryText({ status: 'running' }, 'Running')).toBe('Running');
  });

  it('falls back to the label alone when cwd is empty string', () => {
    expect(secondaryText({ status: 'stopped', cwd: '' }, 'Stopped')).toBe('Stopped');
  });

  it('uses the label for a non-running live status (exited)', () => {
    expect(
      secondaryText({ status: 'exited', cwd: '/Users/jerry/work/svc' }, 'Exited'),
    ).toBe('Exited · svc');
  });

  it('ignores startupCommand for a live row', () => {
    expect(
      secondaryText(
        { status: 'running', cwd: '/Users/jerry/work/svc', startupCommand: 'npm run dev' },
        'Running',
      ),
    ).toBe('Running · svc');
  });
});

describe('secondaryText — recipe rows (status === not_started, D-03 fallback chain)', () => {
  it('prefers a non-empty trimmed startupCommand', () => {
    expect(
      secondaryText({ status: 'not_started', startupCommand: '  claude --rc  ' }, 'Not started'),
    ).toBe('claude --rc');
  });

  it('falls back to cwdTail when startupCommand is empty/whitespace', () => {
    expect(
      secondaryText(
        { status: 'not_started', startupCommand: '   ', cwd: '/Users/jerry/Project/Marketing' },
        'Not started',
      ),
    ).toBe('Marketing');
  });

  it('falls back to cwdTail when startupCommand is absent', () => {
    expect(
      secondaryText({ status: 'not_started', cwd: '/Users/jerry/Project/Marketing' }, 'Not started'),
    ).toBe('Marketing');
  });

  it('falls back to the label when neither startupCommand nor cwd is present', () => {
    expect(secondaryText({ status: 'not_started' }, 'Not started')).toBe('Not started');
  });

  it('falls back to the label when cwd is empty and no startupCommand', () => {
    expect(
      secondaryText({ status: 'not_started', cwd: '', startupCommand: '' }, 'Not started'),
    ).toBe('Not started');
  });
});
