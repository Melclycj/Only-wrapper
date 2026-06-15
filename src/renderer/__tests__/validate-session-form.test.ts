// Wave 0 RED stub (12-01 Task 2) — covers D-04 the inline-validation rules.
//
// INTENTIONALLY FAILS RED until 12-01 Task 2 implements
// src/renderer/validate-session-form.ts (validateSessionForm). Targets the
// React/xterm/electron-free pure reducer (mirrors session-edit.ts) so it runs in the
// Node/Vitest env. Main's CR-01 guard stays the validator of record; these are
// convenience-only UX hints. The copy strings are FROZEN by 12-UI-SPEC §Copywriting.

import { describe, it, expect } from 'vitest';
import { validateSessionForm } from '../validate-session-form';

describe('validateSessionForm inline-validation rules (D-04)', () => {
  it('empty name → neutral "Keeps the current name" hint', () => {
    expect(
      validateSessionForm({ name: '', cwd: '/abs', startupCommand: '' }),
    ).toEqual({ name: { tone: 'hint', message: 'Keeps the current name' } });
  });

  it('whitespace-only name → same hint (trim before checking length)', () => {
    expect(
      validateSessionForm({ name: '   ', cwd: '/abs', startupCommand: '' }),
    ).toEqual({ name: { tone: 'hint', message: 'Keeps the current name' } });
  });

  it('non-absolute cwd → neutral format hint', () => {
    expect(
      validateSessionForm({ name: 'dev', cwd: 'relative/path', startupCommand: '' }),
    ).toEqual({
      cwd: { tone: 'hint', message: 'Enter an absolute path, or use Browse…' },
    });
  });

  it('POSIX absolute cwd → no cwd notice', () => {
    expect(
      validateSessionForm({
        name: 'dev',
        cwd: '/Users/me/project',
        startupCommand: '',
      }),
    ).toEqual({});
  });

  it('Windows absolute cwd → no cwd notice', () => {
    expect(
      validateSessionForm({ name: 'dev', cwd: 'C:\\Users\\me', startupCommand: '' }),
    ).toEqual({});
  });

  it('empty cwd → no cwd notice (only checked when non-empty)', () => {
    expect(
      validateSessionForm({ name: 'dev', cwd: '', startupCommand: '' }),
    ).toEqual({});
  });

  it('empty startupCommand → no notice (startup is optional, never validated)', () => {
    expect(
      validateSessionForm({ name: 'dev', cwd: '/abs', startupCommand: '' }),
    ).toEqual({});
  });
});
