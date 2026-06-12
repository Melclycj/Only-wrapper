// GAP-10-K (locale) — pure, node-pty/electron-free spawn-env locale resolver (10-14).
//
// THE DEFECT: a Finder-launched Electron app inherits NO UTF-8 locale (macOS does not
// run the user's login shell rc when launching from Finder), so pty.spawn's child falls
// back to the C/POSIX (ASCII) locale and CLI tools — including the agent tools this app
// wraps — won't emit CJK (Chinese/Japanese/Korean) output. Encoding is NOT the fault:
// node-pty forwards UTF-8 and xterm.js + @xterm/addon-unicode11 decode it with the
// correct 2-cell width. The missing piece is a UTF-8 LOCALE in the child's env.
//
// THE FIX: resolvePtyLocale returns the { LANG?, LC_ALL? } additions to MERGE into the
// spawn env. It is spread AFTER `...process.env` in pty-manager, so:
//   - an inherited UTF-8 LANG/LC_ALL is HONORED (we return {}, overriding nothing) —
//     a user's intentional zh_CN.UTF-8 / ja_JP.UTF-8 is never clobbered;
//   - a UTF-8 default is applied ONLY when the inherited env has no UTF-8 locale (the
//     Finder-launch case, or a bare C/POSIX locale);
//   - win32 returns {} — the ConPTY child uses the Windows code-page model, not a POSIX
//     LANG, so injecting one could break a Windows CLI tool. The Windows path is
//     byte-for-byte unchanged.
//
// Main-process-only (it reads the OS/env shape), placed under src/main/ alongside the
// other spawn helpers (shell-resolver, readiness-probe). NO new IPC, no bridge key.

/**
 * True when `v` names a UTF-8 locale (case-insensitive `.utf-8` / `utf8` substring).
 * Matches the common spellings: `en_US.UTF-8`, `en_GB.utf8`, `de_DE.UTF8`.
 */
function isUtf8Locale(v?: string): boolean {
  if (!v) return false;
  const lower = v.toLowerCase();
  return lower.includes('.utf-8') || lower.includes('utf8');
}

/**
 * The SAFE UTF-8 fallback locale, applied ONLY when no UTF-8 locale is inherited.
 * `en_US.UTF-8` is present on every modern macOS by default; it never overrides a
 * user's own UTF-8 locale (we return {} in that case), so a `zh_CN.UTF-8` user keeps it.
 */
const DEFAULT_UTF8_LOCALE = 'en_US.UTF-8';

/**
 * Resolve the locale additions to merge into a PTY spawn env so a Finder-launched app
 * still emits CJK (GAP-10-K). Pure: no node-pty / electron import, no side effects.
 *
 * @param env      the inherited env to inspect (typically `process.env`)
 * @param platform the target platform (defaults to `process.platform`; overridable so
 *                 both the POSIX and win32 branches are unit-testable without spawning)
 * @returns `{}` when an existing UTF-8 locale is honored or on win32; otherwise
 *          `{ LANG, LC_ALL }` with the UTF-8 default
 */
export function resolvePtyLocale(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): { LANG?: string; LC_ALL?: string } {
  // win32: the ConPTY child uses the Windows code-page model, not a POSIX LANG —
  // injecting one could break a tool. Leave the env untouched.
  if (platform === 'win32') return {};

  // Honor any inherited UTF-8 locale (LC_ALL takes precedence over LANG in POSIX).
  if (isUtf8Locale(env.LC_ALL) || isUtf8Locale(env.LANG)) return {};

  // No UTF-8 locale inherited (Finder-launch, or a bare C/POSIX) → default to UTF-8.
  return { LANG: DEFAULT_UTF8_LOCALE, LC_ALL: DEFAULT_UTF8_LOCALE };
}
