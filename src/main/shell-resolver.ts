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
 * OS-agnostic: the Windows shell mapping (powershell.exe / wsl.exe and its
 * non-POSIX login-flag semantics) is deferred to Phase 8. We intentionally do
 * NOT hard-code a non-macOS path here so the macOS-first case stays correct;
 * the $SHELL/zsh fallback is already platform-neutral for the current targets.
 */
export function resolveShell(): ResolvedShell {
  // Fallback to /bin/zsh when SHELL is unset OR empty (D-01).
  const shell = process.env.SHELL || '/bin/zsh';
  // Login flag only — interactive is implied by the PTY TTY.
  const args = ['-l'];
  return { shell, args };
}
