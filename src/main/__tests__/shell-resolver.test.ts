// Covers TERM-03 and TERM-04 (D-01). GREEN as of Plan 02-02
// (src/main/shell-resolver.ts implements resolveShell).
//
// Contract under test (02-RESEARCH Pattern 3 / D-01):
//   - args === ['-l']                       (login flag → Terminal.app-parity PATH)
//   - shell === process.env.SHELL when set  (honor the user's shell)
//   - shell === '/bin/zsh' when SHELL unset (macOS fallback)

import { describe, it, expect, afterEach } from 'vitest';
import { resolveShell } from '../shell-resolver';

describe('resolveShell (TERM-03, TERM-04, D-01)', () => {
  const originalShell = process.env.SHELL;

  afterEach(() => {
    // Restore the real SHELL after each mutate-and-restore case.
    if (originalShell === undefined) {
      delete process.env.SHELL;
    } else {
      process.env.SHELL = originalShell;
    }
  });

  it('launches with exactly the login flag: args === ["-l"]', () => {
    const { args } = resolveShell();
    expect(args).toEqual(['-l']);
    expect(args).toHaveLength(1);
    expect(args[0]).toBe('-l');
  });

  it('uses process.env.SHELL when it is set', () => {
    process.env.SHELL = '/usr/local/bin/fish';
    const { shell } = resolveShell();
    expect(shell).toBe('/usr/local/bin/fish');
  });

  it('falls back to /bin/zsh when SHELL is unset', () => {
    delete process.env.SHELL;
    const { shell } = resolveShell();
    expect(shell).toBe('/bin/zsh');
  });
});
