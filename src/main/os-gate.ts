// Pure, electron-free OS gate for the ConPTY pre-window boot check (D-05 / SC4).
// Keeping this file free of any `electron` import lets Vitest (Node env) import
// it directly — the os-gate unit test runs standalone with no Electron process
// (mirrors the shell-resolver.ts convention). The wiring into the real boot
// sequence (dialog.showErrorBox + app.quit) lives in src/main/index.ts.
//
// node-pty parses os.release() with the SAME regex (/(\d+)\.(\d+)\.(\d+)/) and
// reads the BUILD component (group 3) — see node-pty lib/windowsPtyAgent.js.

/**
 * Windows 10 build 1809 (10.0.17763) — the floor at which ConPTY became
 * available (CLAUDE.md "ConPTY requires Windows 10 1809+"). This is the LOCKED
 * D-05 value.
 *
 * NOTE (surface for human confirmation — do NOT silently change): node-pty's OWN
 * `_useConpty` gate is `>= 18309` (build 1903-era). Between builds 17763 and
 * 18308 node-pty launches under THIS gate but falls back to winpty internally
 * (which CLAUDE.md "What NOT to Use" excludes). The CONTEXT/D-05 lock is 17763;
 * if a "ConPTY guaranteed" floor is later wanted, this becomes 18309 — but only
 * by an explicit decision, never a quiet edit (08-RESEARCH Open Q1 / A6).
 */
export const MIN_WINDOWS_BUILD = 17763;

/**
 * PURE — extract the build number (3rd dotted component) from an os.release()
 * string. Windows os.release() looks like "10.0.17763" — major.minor.BUILD.
 * Returns null when the string has no parseable major.minor.build triple.
 */
export function parseWindowsBuild(release: string): number | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(release);
  return m ? Number(m[3]) : null;
}

/**
 * PURE — should the app refuse to launch on this host? True ONLY when the
 * platform is win32 AND the os.release() build parses to a number strictly
 * below MIN_WINDOWS_BUILD.
 *
 * Fail-OPEN on an unparseable release (returns false): a parse quirk must never
 * brick a supported host — the cost of a false-block (a real user locked out)
 * outweighs the rare false-allow (a malformed-release host that node-pty would
 * itself error on). Non-win32 is never gated.
 */
export function isUnsupportedWindows(
  platform: NodeJS.Platform,
  release: string,
): boolean {
  if (platform !== 'win32') return false;
  const build = parseWindowsBuild(release);
  return build !== null && build < MIN_WINDOWS_BUILD;
}
