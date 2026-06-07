// Pure, electron-free, xterm-free, node-pty-free agent-state classifier (TERM-09,
// Axis 2 — D-09/D-10). Mirrors flow-control.ts's purity header + named-constant +
// documented-contract convention so the renderer can import it AND Vitest can
// exercise it in a plain Node env.
//
// AgentState is a PRESENTATION OVERLAY (D-12): it is NEVER a 6th SessionStatus,
// never persisted, never written to a PTY. The renderer (SessionView) layers it on
// TOP of the process statuses while a session is 'running'.
//
// DETECTION MODEL (D-09, spikes 001/002) — FRAME STABILITY, not output silence:
// the renderer ticks the live xterm `term.buffer.active` viewport every TICK_MS,
// FNV-1a-hashes the visible text; while the hash CHANGES the session is reported
// 'in-progress' (the animated "Thinking…" line churns the viewport — the property
// the old output-silence model lacked). Once the hash is unchanged for SETTLE_MS
// the frame is SETTLED and classify() inspects the settled cursor region.
//
// CLASSIFY (D-10, the 002 kill-finding): WAITING signals are a confirmation footer
// ("Esc to cancel · Tab to amend · ctrl+e"), a numbered menu (>=2 "N." lines),
// [y/n]/(y/n)/(yes/no), a trailing '?', or a password prompt. A shell prompt on the
// ACTIVE line is authoritative FREE. The standalone arrow caret (U+276F) is
// DELIBERATELY NOT a waiting signal — real Claude Code shows it persistently in its
// input caret, where it false-fired 10 of 11 settles in the 002 capture. (It is
// still permitted ONLY as an optional, non-decisive leading marker on a numbered
// menu ITEM, encoded below as \u276F so the literal glyph never appears here.)
//
// SECURITY V5 (T-06.1-01 ReDoS): every regex below is LINEAR and ANCHORED — no
// nested quantifiers, no catastrophic backtracking — because they run on
// attacker-influenceable PTY-rendered output. The input is a `rows×cols`-bounded
// viewport line array, never a growing byte stream, so runtime is bounded.

/** Presentation overlay state (D-12) — NOT a SessionStatus, never persisted. */
export type AgentState = 'in-progress' | 'waiting' | 'free';

/**
 * Frame-stability tick interval (ms). The renderer hashes the live xterm viewport
 * this often. Claude's discretion (D-09): ~100–250ms — do NOT exceed ~250ms or
 * short agent pauses are missed (Nyquist bound from spike 002).
 */
export const TICK_MS = 100;

/**
 * Frame-stability settle window (ms). When the viewport hash is unchanged for this
 * long the frame is SETTLED and classify() runs. Claude's discretion (D-09):
 * 400–600ms. Shared by the renderer detector and the offline replay oracle.
 */
export const SETTLE_MS = 500;

/**
 * Classify a SETTLED viewport (the array of visible lines as produced by
 * xterm's `ILine.translateToString(true)`). Returns:
 *   - 'waiting' — the settled cursor region shows an interactive confirmation
 *                 prompt (footer / numbered menu / [y/n] / trailing '?' / password).
 *   - 'free'    — a shell prompt on the active line, OR no waiting signal at all.
 *
 * Never returns 'in-progress' — that state is reported by the caller while the
 * viewport hash is still changing, before the frame settles.
 *
 * Ported from .planning/spikes/001-frame-stability-mechanism/record.cjs classify()
 * in its 002-corrected form (arrow_marker (U+276F) dropped from the decision — D-10).
 *
 *   classify(['... Esc to cancel · Tab to amend ...']) === 'waiting'  (claude footer)
 *   classify(['Continue? [y/N] '])                     === 'waiting'  (y/n bracket)
 *   classify(['user@host project %'])                  === 'free'     (shell prompt)
 *   classify(['  \u276F '])                                 === 'free'     (caret only)
 *   classify([])                                       === 'free'
 */
export function classify(lines: string[]): AgentState {
  // Window the active region to the last non-empty lines — NOT the raw bottom rows,
  // which are blank padding for normal-buffer output (001 finding #1).
  const nonEmpty = lines.filter((l) => l.trim() !== '');
  const last = nonEmpty.length > 0 ? nonEmpty[nonEmpty.length - 1] : '';
  // Tight cursor-region window (last 4 non-empty lines) — a broad scan false-
  // positives on stale menus still scrolled in the viewport (001 finding #2).
  const region = nonEmpty.slice(-4).join('\n');

  const shellPrompt = /[$%#]\s*$/.test(last) || /\w[^>]>\s*$/.test(last);
  const trailingQuestion = /\?\s*$/.test(last);
  const ynBracket = /\[y\/n\]|\(y\/n\)|\(yes\/no\)/i.test(region);
  const numberedMenu = (region.match(/^\s*[\u276F>]?\s*\d+\.\s+\S/gm) || []).length >= 2;
  const claudeFooter =
    /(esc to (cancel|interrupt)|tab to amend|ctrl\+e to|↑↓ to|enter to)/i.test(region);
  const passwordPrompt = /(password|passphrase).*:\s*$/i.test(last);
  // The caret (U+276F) is DELIBERATELY ABSENT from the decision (002 kill-finding, D-10).

  // A shell prompt on the ACTIVE line is authoritative FREE — a scrolled-up menu
  // above it does not mean the session is waiting.
  if (shellPrompt && !trailingQuestion) return 'free';
  if (
    numberedMenu ||
    ynBracket ||
    trailingQuestion ||
    passwordPrompt ||
    claudeFooter
  )
    return 'waiting';
  return 'free';
}
