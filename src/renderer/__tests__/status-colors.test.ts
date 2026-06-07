// Unit coverage of the agent-state presentation resolver (TERM-09 / SC4 — D-06/D-07).
//
// The presentation() resolver layers the agent-state OVERLAY on top of the 5 process
// statuses ONLY while status==='running' (D-07). These tests assert the EXACT label +
// accent strings from 06-UI-SPEC §Color AND the overlay-only-when-running contract:
// the overlay must NOT leak past 'running' (exited/error/not_started/stopped are
// presented exactly as their STATUS_STYLE entries). Pure module → runs in Vitest's
// Node env (mirrors icon-spec.test.ts / session-close.test.ts).

import { describe, it, expect } from 'vitest';
import {
  AGENT_STYLE,
  STATUS_STYLE,
  presentation,
} from '../status-colors';

describe('presentation() agent-state overlay (D-06/D-07)', () => {
  it('running + in-progress → blue "In progress"', () => {
    expect(presentation('running', 'in-progress')).toEqual({
      label: 'In progress',
      accent: 'oklch(0.62 0.14 248)',
    });
  });

  it('running + waiting → amber "Waiting for you" (TERM-09)', () => {
    expect(presentation('running', 'waiting')).toEqual({
      label: 'Waiting for you',
      accent: 'oklch(0.66 0.15 60)',
    });
  });

  it('running + free → slate "Free"', () => {
    expect(presentation('running', 'free')).toEqual({
      label: 'Free',
      accent: 'oklch(0.64 0.02 260)',
    });
  });

  it('running + undefined → process default (no agent-state yet)', () => {
    expect(presentation('running', undefined)).toEqual(STATUS_STYLE.running);
    expect(presentation('running')).toEqual(STATUS_STYLE.running);
  });

  it('exited + waiting → STATUS_STYLE.exited (overlay does NOT leak past running)', () => {
    expect(presentation('exited', 'waiting')).toEqual(STATUS_STYLE.exited);
    expect(presentation('exited', 'waiting')).toEqual({
      label: 'Finished',
      accent: 'oklch(0.60 0.13 150)',
    });
  });

  it('error + any agent-state → STATUS_STYLE.error (red, unchanged)', () => {
    expect(presentation('error', 'in-progress')).toEqual(STATUS_STYLE.error);
    expect(presentation('error', 'waiting')).toEqual(STATUS_STYLE.error);
    expect(presentation('error', 'free')).toEqual(STATUS_STYLE.error);
    expect(presentation('error')).toEqual(STATUS_STYLE.error);
  });

  it('not_started / stopped → their STATUS_STYLE entries unchanged', () => {
    expect(presentation('not_started', undefined)).toEqual(
      STATUS_STYLE.not_started,
    );
    expect(presentation('stopped', undefined)).toEqual(STATUS_STYLE.stopped);
    // The overlay is also inert when an agent-state is (incorrectly) supplied for a
    // non-running status — the process style still wins (D-07).
    expect(presentation('not_started', 'waiting')).toEqual(
      STATUS_STYLE.not_started,
    );
    expect(presentation('stopped', 'in-progress')).toEqual(
      STATUS_STYLE.stopped,
    );
  });
});

describe('AGENT_STYLE ramp (06-UI-SPEC §Color authoritative oklch)', () => {
  it('amber oklch(0.66 0.15 60) is reserved exclusively for waiting', () => {
    expect(AGENT_STYLE.waiting.accent).toBe('oklch(0.66 0.15 60)');
    // No other agent-state ramp carries the reserved amber accent.
    expect(AGENT_STYLE['in-progress'].accent).not.toBe('oklch(0.66 0.15 60)');
    expect(AGENT_STYLE.free.accent).not.toBe('oklch(0.66 0.15 60)');
  });

  it('STATUS_STYLE process accents are unchanged in shape', () => {
    expect(STATUS_STYLE.running.accent).toBe('oklch(0.62 0.14 248)');
    expect(STATUS_STYLE.exited.accent).toBe('oklch(0.60 0.13 150)');
    expect(STATUS_STYLE.error.accent).toBe('oklch(0.58 0.16 25)');
  });
});
