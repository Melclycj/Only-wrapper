// MAIN-PROCESS shell discovery — the platform-aware seam (D-07).
// The PURE parsing/building helpers (parseEtcShells, buildShellList) are
// electron-free and take an injected `existsFn`, so Vitest (Node env) imports
// them directly with a fixture `/etc/shells` string — no real filesystem, no
// Electron process (mirrors shell-resolver.ts's electron-free convention).
//
// Real implementation: macOS provider this phase (reads /etc/shells + always
// includes the resolved $SHELL, filters to on-disk entries, de-dupes — D-05/D-06).
// The Windows enumeration (PowerShell/CMD/Git Bash/WSL) is FILLED in Phase 8
// behind this same seam (D-02): buildWindowsShellList mirrors buildShellList — a
// Windows-aware default FIRST so the dropdown is NEVER empty (D-05 safety holds
// cross-platform), on-disk filtered via an injected existsFn, de-duped by path.

import fs from 'node:fs';
import path from 'node:path';
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
 * PURE — build the de-duped, on-disk-filtered Windows shell list (D-02), mirroring
 * buildShellList for the POSIX case:
 *   - `windowsDefault` is ALWAYS placed first (D-05 never-empty: even if every
 *     well-known shell path is missing on disk, the default keeps the dropdown
 *     usable). The Windows default is computed independently of resolveShell()
 *     (Pitfall 3: resolveShell() yields /bin/zsh on Windows) — see discover().
 *   - entries are filtered to those that exist on disk (`existsFn` injected for
 *     testability, mirrors buildShellList).
 *   - duplicates (by path) are dropped, preserving first-seen order.
 *   - labels come from a friendly basename→label map, falling back to the raw
 *     basename (split on BOTH separators since Windows paths use backslashes).
 */
export function buildWindowsShellList(
  candidates: string[],
  windowsDefault: string,
  existsFn: (p: string) => boolean,
): DiscoveredShell[] {
  // Friendly labels keyed by basename (lowercased); unmapped → raw basename (D-02).
  const labelMap: Record<string, string> = {
    'powershell.exe': 'PowerShell',
    'pwsh.exe': 'PowerShell 7',
    'cmd.exe': 'CMD',
    'bash.exe': 'Git Bash',
    'wsl.exe': 'WSL',
  };
  const labelFor = (p: string): string => {
    const base = p.split(/[\\/]/).pop() ?? p; // Windows paths use backslashes
    return labelMap[base.toLowerCase()] ?? base;
  };
  const seen = new Set<string>();
  const out: DiscoveredShell[] = [];
  // The default is UNCONDITIONALLY first and is NOT existsFn-filtered — this is the
  // hard D-05 never-empty guarantee: even when every well-known shell is missing on
  // disk (e.g. running the Windows provider on the macOS dev box), the dropdown still
  // carries one usable entry. Only the ADDITIONAL candidates are on-disk filtered.
  if (windowsDefault) {
    seen.add(windowsDefault);
    out.push({ path: windowsDefault, label: labelFor(windowsDefault) });
  }
  for (const p of candidates) {
    if (!p || seen.has(p) || !existsFn(p)) continue; // de-dupe + on-disk filter
    seen.add(p);
    out.push({ path: p, label: labelFor(p) });
  }
  return out;
}

/**
 * Windows provider — FILLED in Phase 8 (D-02). Enumerates PowerShell / CMD / Git
 * Bash / WSL from ENV-EXPANDED well-known paths (process.env.SystemRoot /
 * ProgramFiles, NOT hardcoded C:\), filters to on-disk via real fs.existsSync, and
 * places a Windows-aware default FIRST so the dropdown is never empty (D-05).
 *
 * The default is derived from process.env.ComSpec (cmd.exe) — NOT resolveShell(),
 * which returns /bin/zsh on Windows ($SHELL is unset there — Pitfall 3 latent bug).
 *
 * [ASSUMED] candidate paths below are byte-validated on real Windows in Plan 03's
 * CI smoke + human-verify (Assumptions A1-A3); CITED ones come from CLAUDE.md.
 */
export class WindowsShellProvider implements ShellDiscovery {
  discover(): DiscoveredShell[] {
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';

    const candidates = [
      // PowerShell (Windows PowerShell 5.x) — CITED: CLAUDE.md.
      path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      // PowerShell 7 (pwsh, optional) — [ASSUMED] A1 (Plan 03 human-verify).
      path.join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
      // CMD — [ASSUMED] A2 (Plan 03 human-verify).
      path.join(systemRoot, 'System32', 'cmd.exe'),
      // Git Bash — [ASSUMED] A3 (Plan 03 human-verify); try both bin/ and usr/bin/.
      path.join(programFiles, 'Git', 'bin', 'bash.exe'),
      path.join(programFiles, 'Git', 'usr', 'bin', 'bash.exe'),
      // WSL — CITED: CLAUDE.md.
      path.join(systemRoot, 'System32', 'wsl.exe'),
    ];

    // Windows-aware default, independent of resolveShell() (Pitfall 3): prefer
    // ComSpec (cmd.exe), else the well-known CMD path, else the first candidate —
    // so the dropdown is never empty even if every well-known path is missing.
    const windowsDefault =
      process.env.ComSpec ||
      path.join(systemRoot, 'System32', 'cmd.exe') ||
      candidates[0];

    return buildWindowsShellList(candidates, windowsDefault, (p) => fs.existsSync(p));
  }
}

/** Pick the discovery provider for `platform` (D-07). win32 → Windows stub; else macOS. */
export function selectShellProvider(platform: NodeJS.Platform): ShellDiscovery {
  return platform === 'win32' ? new WindowsShellProvider() : new MacShellProvider();
}
