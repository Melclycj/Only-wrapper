// Pure, electron-free, OS-agnostic shell resolver.
// Keeping this file free of any `electron` import lets Vitest (Node env) import
// it directly — the shell-resolver unit test runs standalone with no Electron
// process (mirrors the window-config.ts convention; RESEARCH Pitfall 4 / D-07).
//
// SIGNATURE STUB ONLY — the real implementation lands in Plan 02-02.
// resolveShell() currently throws so its Wave 0 unit test fails RED.

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
 * Contract (implemented in 02-02, see 02-RESEARCH Pattern 3 / D-01):
 *   - shell = process.env.SHELL when set, else /bin/zsh fallback
 *   - args  = ['-l'] (login flag; interactive comes free from the PTY TTY)
 *
 * @throws Always, until 02-02 provides the implementation.
 */
export function resolveShell(): ResolvedShell {
  throw new Error('not implemented — 02-02');
}
