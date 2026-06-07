// Pure, electron-free, xterm-free, node-pty-free agent-state classifier (TERM-09,
// SC4 — D-06/D-08/D-09). Mirrors flow-control.ts's purity header + named-constant +
// documented-contract convention so the renderer can import it AND Vitest can
// exercise it in a plain Node env.
//
// AgentState is a PRESENTATION OVERLAY (D-06): it is NEVER a 6th SessionStatus,
// never persisted, never written to a PTY. The renderer (SessionView) layers it on
// TOP of the 5 process statuses while a session is 'running' — when the PTY output
// goes idle for IDLE_MS, classifyIdle() decides whether the last produced line looks
// like an interactive prompt ('waiting') or not ('free'). While bytes are still
// flowing the renderer reports 'in-progress' directly (no classification needed).
//
// SECURITY V7 (T-06-03 ReDoS): both ANSI_RE and PROMPT_RE are LINEAR and ANCHORED —
// no nested quantifiers, no catastrophic backtracking — because they run on
// attacker-controlled PTY output. PROMPT_RE is anchored to end-of-line (`\s*$`) and
// the detector (Plan 03) only ever feeds it a bounded ~4 KB tail.

/** Presentation overlay state (D-06) — NOT a SessionStatus, never persisted. */
export type AgentState = 'in-progress' | 'waiting' | 'free';

/**
 * Idle debounce before classifying (D-08, Claude's discretion): after this many
 * milliseconds with no new PTY output the detector classifies the trailing line.
 * Exported so the renderer's debounce and the tests share one source of truth.
 */
export const IDLE_MS = 800;

/**
 * Strip CSI / SGR / OSC escape sequences. LINEAR (single pass, no backtracking) so
 * it is ReDoS-safe on attacker-controlled output (V7). Synthesized from
 * 06-RESEARCH §Code Examples "pure agent-state classifier".
 */
const ANSI_RE =
  /[\x1b\x9b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PR-TZcf-ntqry=><~]/g;

/**
 * Conservative, ANCHORED interactive-prompt set (D-09). Matches ONLY at end-of-line
 * (`\s*$`) so a mid-sentence '?' never trips it. The curated set:
 *   - a trailing `?`                         → "Continue? ", "Are you sure? "
 *   - `[y/n]` / `[y/N]` / `[Y/n]`            (case-insensitive)
 *   - `(y/n)` / `(yes/no)`
 *   - the arrow-menu marker `❯`              → "Selection ❯ "
 *
 * Deliberately EXCLUDED (D-09): a naked shell prompt char `$` / `%` / `#` — those are
 * 'free', not 'waiting'. A trailing `:` is NOT in the set either (a bare "Proceed
 * (yes/no): " still matches via the `(yes/no)` token, not the colon). LINEAR +
 * anchored — ReDoS-safe (V7, T-06-03).
 */
export const PROMPT_RE = /(?:\?|\[y\/n\]|\(y\/n\)|\(yes\/no\)|❯)\s*$/i;

/**
 * Return the last line of `tail` that has non-whitespace content, ANSI-stripped and
 * right-trimmed. Trailing blank lines are skipped. Returns '' when `tail` is empty or
 * all-whitespace.
 *
 *   lastNonEmptyLine("...\x1b[32mok\x1b[0m\n\n") === "ok"
 */
export function lastNonEmptyLine(tail: string): string {
  const clean = tail.replace(ANSI_RE, '');
  const lines = clean.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trimEnd();
    if (t.trim().length > 0) return t;
  }
  return '';
}

/**
 * Classify the idle tail (called after IDLE_MS of silence): 'waiting' when the last
 * non-empty line looks like a conservative interactive prompt (PROMPT_RE), else
 * 'free'. Never returns 'in-progress' — that state is reported by the caller while
 * bytes are actively flowing, before this classifier runs.
 *
 *   classifyIdle("Continue? [y/N] ")                 === 'waiting'
 *   classifyIdle("user@host project %")              === 'free'  (naked prompt)
 *   classifyIdle("Why did this fail? Let me check.") === 'free'  (mid-sentence '?')
 *   classifyIdle("")                                 === 'free'
 */
export function classifyIdle(tail: string): AgentState {
  return PROMPT_RE.test(lastNonEmptyLine(tail)) ? 'waiting' : 'free';
}
