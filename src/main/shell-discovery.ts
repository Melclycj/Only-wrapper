// MAIN-PROCESS shell discovery — the platform-aware seam (D-07).
// The PURE parsing/building helpers (parseEtcShells, buildShellList) are
// electron-free and take an injected `existsFn`, so Vitest (Node env) imports
// them directly with a fixture `/etc/shells` string — no real filesystem, no
// Electron process (mirrors shell-resolver.ts's electron-free convention).
//
// Real implementation: macOS provider this phase (reads /etc/shells + always
// includes the resolved $SHELL, filters to on-disk entries, de-dupes — D-05/D-06).
// The Windows enumeration (PowerShell/CMD/Git Bash/WSL) is deferred to Phase 8
// behind this same seam (D-07); the WindowsShellProvider stub returns the resolved
// default so the dropdown is NEVER empty (D-05 safety holds cross-platform).

import fs from 'node:fs';
import { resolveShell } from './shell-resolver';

/** A single shell entry for the dropdown: full path + a basename label. */
export interface DiscoveredShell {
  path: string;
  label: string;
}

/** The platform-aware discovery seam (D-07). One provider per platform. */
export interface ShellDiscovery {
  discover(): DiscoveredShell[];
}

/**
 * PURE — parse /etc/shells contents into a list of shell paths.
 * Strips '#'-comments and blank lines, trims each line. Unit-tested with a
 * fixture string (no filesystem read). RESEARCH Pattern 2 verbatim.
 */
export function parseEtcShells(contents: string): string[] {
  return contents
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

/**
 * PURE — build the de-duped, on-disk-filtered shell list (RESEARCH Pattern 2).
 *   - `resolvedShell` is ALWAYS placed first (D-05 safety: the dropdown can never
 *     be empty/unusable even when /etc/shells is empty or unreadable).
 *   - entries are filtered to those that exist on disk (`existsFn` injected for
 *     testability — D-06).
 *   - duplicates (by path) are dropped, preserving first-seen order.
 *   - each entry's label is its basename.
 */
export function buildShellList(
  etcShellPaths: string[],
  resolvedShell: string,
  existsFn: (p: string) => boolean,
): DiscoveredShell[] {
  const merged = [resolvedShell, ...etcShellPaths]; // $SHELL ALWAYS first (D-05)
  const seen = new Set<string>();
  const out: DiscoveredShell[] = [];
  for (const p of merged) {
    if (!p || seen.has(p) || !existsFn(p)) continue; // de-dupe + on-disk filter (D-06)
    seen.add(p);
    out.push({ path: p, label: p.split('/').pop() ?? p });
  }
  return out;
}

/**
 * macOS provider (D-06): reads /etc/shells, merges the resolved $SHELL, filters
 * to on-disk, de-dupes. If /etc/shells is unreadable, falls back to $SHELL-only
 * (D-05 safety). resolveShell().shell is reused — NOT recomputed.
 */
export class MacShellProvider implements ShellDiscovery {
  discover(): DiscoveredShell[] {
    let etc = '';
    try {
      etc = fs.readFileSync('/etc/shells', 'utf8');
    } catch {
      // /etc/shells unreadable → fall back to the $SHELL-only list (D-05).
    }
    const resolved = resolveShell().shell; // the always-included fallback (D-05)
    return buildShellList(parseEtcShells(etc), resolved, (p) => fs.existsSync(p));
  }
}

/**
 * Windows provider — STUB (D-07). The real enumeration of PowerShell/CMD/Git
 * Bash/WSL lands in Phase 8 behind this seam. For now it returns the resolved
 * default so the dropdown is never empty (D-05 safety holds cross-platform).
 */
export class WindowsShellProvider implements ShellDiscovery {
  discover(): DiscoveredShell[] {
    const resolved = resolveShell().shell;
    return resolved
      ? [{ path: resolved, label: resolved.split(/[\\/]/).pop() ?? resolved }]
      : [];
  }
}

/** Pick the discovery provider for `platform` (D-07). win32 → Windows stub; else macOS. */
export function selectShellProvider(platform: NodeJS.Platform): ShellDiscovery {
  return platform === 'win32' ? new WindowsShellProvider() : new MacShellProvider();
}
