// RENDERER ONLY — the pure D-03 "what does a sidebar row's second line say?" deriver
// (Phase 10-01 Task 1). The single source of truth the Plan-02 Sidebar row JSX consumes
// for its `.row-secondary` text, so the line-2 composition lives here (unit-tested) instead
// of inside JSX.
//
// Imports NOTHING from React/xterm/electron so the rules are unit-testable in the Node/Vitest
// env (mirrors start-affordances.ts / scrollback-clamp.ts; the project forbids adding jsdom/
// test packages, so the line-2 decision is modeled as a pure string transform).
//
// SINGLE-SOURCE RULE: the caller supplies `label` from presentation(status, agent).label
// (status-colors.ts). This module NEVER re-derives the status→label mapping — it only
// composes the already-resolved label with the cwd tail / startup command per D-03.

import type { SessionStatus } from '../shared/types';
import type { AgentState } from '../shared/agent-state';

/**
 * WR-03 (GAP-10-B) — the running-gated data-agent seam. Returns the agent-state overlay
 * value the Sidebar row's `data-agent` attribute should carry, or `undefined` when no
 * attribute should be emitted.
 *
 * The amber "Waiting for you" treatment (and the other overlays) must surface ONLY on a
 * LIVE session: a finished/exited/stopped/not_started row that somehow still carried a
 * stale `agentState` could otherwise falsely render the amber edge bar, making a dead row
 * scream "I need you". Gating on `status === 'running'` here is belt-and-suspenders — the
 * store (SessionManager.handleAgentState) and the reducer (apply-status-event.ts) already
 * clear/withhold agentState off running rows; this final render-time gate guarantees it.
 *
 *   rowAgentAttr('running', 'waiting')      === 'waiting'
 *   rowAgentAttr('running', undefined)      === undefined
 *   rowAgentAttr('exited',  'waiting')      === undefined  (a finished row never carries amber)
 */
export function rowAgentAttr(
  status: SessionStatus,
  agentState: AgentState | undefined,
): AgentState | undefined {
  return status === 'running' && agentState ? agentState : undefined;
}

/**
 * Return only the last path segment of a cwd, tolerant of both `/` and `\` separators
 * and of a trailing-separator run.
 *
 * - cwdTail('/Users/jerry/Project/Marketing-parlour-room') === 'Marketing-parlour-room'
 * - cwdTail('C:\\Users\\jerry\\proj') === 'proj'
 * - cwdTail('/Users/jerry/proj/') === 'proj'  (trailing slash stripped before split)
 * - cwdTail('') === '' ; cwdTail('/') === ''
 */
export function cwdTail(cwd: string): string {
  return cwd.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? '';
}

/** The renderer fields the secondary-line decision keys on. */
export interface SecondaryRow {
  /** The row's current process status (drives the live-vs-recipe branch). */
  status: SessionStatus;
  /** The session's working directory, if known. */
  cwd?: string;
  /** The saved startup command, if any (a `not_started` recipe row prefers this). */
  startupCommand?: string;
}

/**
 * Compose a sidebar row's second line per D-03.
 *
 * LIVE row (status !== 'not_started'):
 *   - with a non-empty cwd  → `${label} · ${cwdTail(cwd)}`
 *   - without a cwd         → `${label}` (status word only)
 *
 * RECIPE row (status === 'not_started'):
 *   - trimmed startupCommand if non-empty
 *   - else cwdTail(cwd) if a non-empty cwd exists
 *   - else `${label}` (fallback)
 *
 * `label` is supplied by the caller from presentation(status, agent).label — NOT re-derived
 * here (single-source rule).
 */
export function secondaryText(row: SecondaryRow, label: string): string {
  const tail = row.cwd ? cwdTail(row.cwd) : '';

  if (row.status === 'not_started') {
    const cmd = row.startupCommand?.trim();
    if (cmd) return cmd;
    if (tail) return tail;
    return label;
  }

  // Live row.
  if (tail) return `${label} · ${tail}`;
  return label;
}
