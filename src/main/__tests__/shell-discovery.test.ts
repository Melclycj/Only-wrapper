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
