// Covers SC4 / D-05 / D-06 / D-07: parseEtcShells strips comments/blanks;
// buildShellList always includes the resolved $SHELL first, filters to on-disk,
// de-dupes by path, labels by basename; selectShellProvider picks per platform.
// GREEN as of Plan 05-01 (src/main/shell-discovery.ts).
//
// Pure-helper test (mirrors shell-resolver.test.ts): fixture /etc/shells string +
// an injected existsFn — no real filesystem read.

import { describe, it, expect } from 'vitest';
import {
  parseEtcShells,
  buildShellList,
  buildWindowsShellList,
  selectShellProvider,
  MacShellProvider,
  WindowsShellProvider,
} from '../shell-discovery';

describe('parseEtcShells (D-06)', () => {
  it('strips #-comments and blank lines, trims each entry', () => {
    const fixture = [
      '# List of acceptable shells',
      '',
      '/bin/bash',
      '  /bin/zsh  ',
      '# /bin/false',
      '/bin/sh',
      '',
    ].join('\n');
    expect(parseEtcShells(fixture)).toEqual([
      '/bin/bash',
      '/bin/zsh',
      '/bin/sh',
    ]);
  });

  it('returns an empty list for empty contents', () => {
    expect(parseEtcShells('')).toEqual([]);
  });
});

describe('buildShellList (D-05 / D-06)', () => {
  const exists = (paths: string[]) => (p: string) => paths.includes(p);

  it('places the resolved $SHELL FIRST', () => {
    const out = buildShellList(
      ['/bin/bash'],
      '/bin/zsh',
      exists(['/bin/bash', '/bin/zsh']),
    );
    expect(out[0]).toEqual({ path: '/bin/zsh', label: 'zsh' });
  });

  it('always includes the resolved $SHELL even when /etc/shells is empty (D-05 safety)', () => {
    const out = buildShellList([], '/opt/homebrew/bin/fish', exists(['/opt/homebrew/bin/fish']));
    expect(out).toEqual([
      { path: '/opt/homebrew/bin/fish', label: 'fish' },
    ]);
  });

  it('filters to entries that exist on disk (D-06)', () => {
    const out = buildShellList(
      ['/bin/bash', '/nonexistent/shell'],
      '/bin/zsh',
      exists(['/bin/zsh', '/bin/bash']),
    );
    expect(out.map((s) => s.path)).toEqual(['/bin/zsh', '/bin/bash']);
  });

  it('de-dupes by path (resolved $SHELL also present in /etc/shells)', () => {
    const out = buildShellList(
      ['/bin/zsh', '/bin/bash'],
      '/bin/zsh',
      exists(['/bin/zsh', '/bin/bash']),
    );
    expect(out.map((s) => s.path)).toEqual(['/bin/zsh', '/bin/bash']);
    expect(out).toHaveLength(2);
  });

  it('labels each entry by basename', () => {
    const out = buildShellList(['/bin/bash'], '/bin/zsh', exists(['/bin/zsh', '/bin/bash']));
    expect(out.map((s) => s.label)).toEqual(['zsh', 'bash']);
  });
});

describe('buildWindowsShellList (D-02 / D-05)', () => {
  const exists = (paths: string[]) => (p: string) => paths.includes(p);

  // Windows-style backslash fixture paths (mirror the real candidate set).
  const POWERSHELL = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  const PWSH7 = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
  const CMD = 'C:\\Windows\\System32\\cmd.exe';
  const GITBASH = 'C:\\Program Files\\Git\\bin\\bash.exe';
  const WSL = 'C:\\Windows\\System32\\wsl.exe';

  it('places the Windows-aware default FIRST (D-05 default-first)', () => {
    const out = buildWindowsShellList(
      [POWERSHELL, CMD, GITBASH, WSL],
      CMD,
      exists([POWERSHELL, CMD, GITBASH, WSL]),
    );
    expect(out[0]).toEqual({ path: CMD, label: 'CMD' });
  });

  it('enumerates all on-disk candidates with friendly labels (D-02)', () => {
    const out = buildWindowsShellList(
      [POWERSHELL, PWSH7, CMD, GITBASH, WSL],
      CMD,
      exists([POWERSHELL, PWSH7, CMD, GITBASH, WSL]),
    );
    expect(out).toEqual([
      { path: CMD, label: 'CMD' },
      { path: POWERSHELL, label: 'PowerShell' },
      { path: PWSH7, label: 'PowerShell 7' },
      { path: GITBASH, label: 'Git Bash' },
      { path: WSL, label: 'WSL' },
    ]);
  });

  it('never returns empty: only the default on disk → exactly [{default}] (D-05)', () => {
    const out = buildWindowsShellList([POWERSHELL, GITBASH, WSL], CMD, exists([CMD]));
    expect(out).toEqual([{ path: CMD, label: 'CMD' }]);
  });

  it('hard D-05: default is included even when NOTHING is on disk (existsFn all-false)', () => {
    // Running the Windows provider on the macOS dev box: no candidate exists on disk,
    // yet the dropdown must still carry the default (never-empty invariant).
    const out = buildWindowsShellList([POWERSHELL, GITBASH, WSL], CMD, exists([]));
    expect(out).toEqual([{ path: CMD, label: 'CMD' }]);
  });

  it('de-dupes when the default is ALSO present in candidates', () => {
    const out = buildWindowsShellList([CMD, POWERSHELL], CMD, exists([CMD, POWERSHELL]));
    expect(out.map((s) => s.path)).toEqual([CMD, POWERSHELL]);
    expect(out).toHaveLength(2);
  });

  it('filters out candidates that are not on disk', () => {
    const out = buildWindowsShellList(
      [POWERSHELL, GITBASH, WSL],
      CMD,
      exists([CMD, GITBASH]),
    );
    expect(out.map((s) => s.path)).toEqual([CMD, GITBASH]);
  });

  it('falls back to the raw basename for an unmapped shell (backslash split)', () => {
    const CUSTOM = 'C:\\tools\\nu.exe';
    const out = buildWindowsShellList([CUSTOM], CUSTOM, exists([CUSTOM]));
    expect(out).toEqual([{ path: CUSTOM, label: 'nu.exe' }]);
  });
});

describe('selectShellProvider (D-07 seam)', () => {
  it('win32 → a WindowsShellProvider that is non-empty and never throws', () => {
    const provider = selectShellProvider('win32');
    expect(provider).toBeInstanceOf(WindowsShellProvider);
    expect(() => provider.discover()).not.toThrow();
    // D-05 safety holds cross-platform: the stub returns the resolved default.
    expect(provider.discover().length).toBeGreaterThanOrEqual(1);
  });

  it('darwin → a MacShellProvider', () => {
    const provider = selectShellProvider('darwin');
    expect(provider).toBeInstanceOf(MacShellProvider);
  });
});
