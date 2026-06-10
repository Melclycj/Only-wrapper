// Pure, electron-free, OS-agnostic shell resolver.
// Keeping this file free of any `electron` import lets Vitest (Node env) import
// it directly — the shell-resolver unit test runs standalone with no Electron
// process (mirrors the window-config.ts convention; RESEARCH Pitfall 4 / D-07).
//
// Real implementation (Plan 02-02): resolves the login shell for a PTY spawn.

/** The resolved shell invocation: the shell binary and its launch arguments. */
export interface ResolvedShell {
  /** Absolute path to the shell binary (e.g. process.env.SHELL or /bin/zsh). */
  shell: string;
  /** Launch arguments — login flag `-l` so PATH matches Terminal.app (D-01). */
  args: string[];
}

/**
 * Resolve the shell to spawn for a PTY session.
 *
 * Contract (02-RESEARCH Pattern 3 / D-01):
 *   - shell = process.env.SHELL when set (non-empty), else /bin/zsh fallback
 *   - args  = ['-l'] (login flag → sources .zprofile/.zlogin/.zshrc, so
 *     Homebrew/nvm/asdf-installed `claude`/`codex` resolve on PATH — TERM-03).
 *     Interactive comes free from the PTY's real TTY, so we do NOT add '-i'
 *     (RESEARCH anti-pattern: '-i' can cause double-sourcing/job-control noise).
 *
 * Platform-aware (Phase 8, Open Q2): on win32 the POSIX `$SHELL || /bin/zsh`
 * fallback spawns a NON-EXISTENT binary (Windows sets no $SHELL and has no
 * /bin/zsh), so the PTY never produces output — the defect the Phase-8 Windows
 * CI smoke leg surfaced. The win32 arm defaults to ComSpec (cmd.exe, always set
 * on Windows) with NO POSIX login flag (interactivity comes from the ConPTY TTY).
 * A user-picked shell from the D-02 dropdown still overrides this in
 * PtyManager.create(); this is only the no-shell-stored fallback.
 *
 * `platform` is injected (defaults to process.platform) so both arms unit-test
 * deterministically regardless of the test runner's OS.
 */
export function resolveShell(platform: NodeJS.Platform = process.platform): ResolvedShell {
  if (platform === 'win32') {
    // cmd.exe via ComSpec (always present on Windows), else the well-known path.
    // No login flag — cmd.exe has no POSIX `-l`; the ConPTY TTY makes it interactive.
    const shell = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
    return { shell, args: [] };
  }
  // POSIX (macOS): fallback to /bin/zsh when SHELL is unset OR empty (D-01).
  const shell = process.env.SHELL || '/bin/zsh';
  // Login flag only — interactive is implied by the PTY TTY.
  const args = ['-l'];
  return { shell, args };
}
