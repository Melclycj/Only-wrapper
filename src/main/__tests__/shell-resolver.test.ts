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
  const originalComSpec = process.env.ComSpec;

  afterEach(() => {
    // Restore the real env after each mutate-and-restore case.
    const restore = (key: 'SHELL' | 'ComSpec', val: string | undefined) => {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    };
    restore('SHELL', originalShell);
    restore('ComSpec', originalComSpec);
  });

  // POSIX arm — pass 'darwin' explicitly so the case is deterministic even when
  // the test runner is Windows (the Phase-8 CI matrix).
  it('POSIX: launches with exactly the login flag: args === ["-l"]', () => {
    const { args } = resolveShell('darwin');
    expect(args).toEqual(['-l']);
  });

  it('POSIX: uses process.env.SHELL when it is set', () => {
    process.env.SHELL = '/usr/local/bin/fish';
    expect(resolveShell('darwin').shell).toBe('/usr/local/bin/fish');
  });

  it('POSIX: falls back to /bin/zsh when SHELL is unset', () => {
    delete process.env.SHELL;
    expect(resolveShell('darwin').shell).toBe('/bin/zsh');
  });

  // win32 arm (Phase 8, Open Q2): MUST NOT return /bin/zsh — that non-existent
  // binary was why the packaged Windows terminal produced no output.
  it('win32: defaults to ComSpec (cmd.exe) with NO login flag, never /bin/zsh', () => {
    process.env.ComSpec = 'C:\\Windows\\System32\\cmd.exe';
    delete process.env.SHELL;
    const { shell, args } = resolveShell('win32');
    expect(shell).toBe('C:\\Windows\\System32\\cmd.exe');
    expect(shell).not.toBe('/bin/zsh');
    expect(args).toEqual([]); // cmd.exe takes no POSIX `-l`
  });

  it('win32: falls back to the well-known cmd path when ComSpec is unset', () => {
    delete process.env.ComSpec;
    delete process.env.SHELL;
    expect(resolveShell('win32').shell).toBe('C:\\Windows\\System32\\cmd.exe');
  });
});
