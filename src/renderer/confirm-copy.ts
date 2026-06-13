// RENDERER ONLY — the pure, electron-free confirm-body builder (Phase 11 D-04).
//
// Imports NOTHING from electron / React / xterm so the agent-aware escalation branch
// is unit-testable in the Node/Vitest env (mirrors session-status.ts / agent-state.ts).
// `AgentState` is a TYPE-ONLY import, so this module stays purely structural.
//
// D-04 (operator decision, 2026-06-13): the Remove/Delete ConfirmModal body escalates
// when the target row's agent overlay is mid-task. The escalation is a PREFIX sentence
// prepended to the shipped idle body so the consequence (Inactive vs permanent delete)
// is NEVER lost. The four idle bodies are reproduced byte-for-byte from the strings that
// currently live inline in SessionManager.tsx (~706-712); Plan 01 wires this builder in
// place of that inline ternary.
//
// SECURITY (T-11-01): the return value is a PLAIN STRING. The caller renders it as a React
// text node (the existing ConfirmModal `body` prop) — this module never reaches for the
// raw-HTML escape hatch, and neither does the render path. User-controlled `{name}`
// interpolation stays inside SessionManager's title template literal (auto-escaped),
// never in this body.
//
// AGENT-STATE NOTE: the live `AgentState` union is 'in-progress' | 'waiting' | 'free'
// (src/shared/agent-state.ts). The phase docs (11-PLAN / 11-UI-SPEC) say "working" as the
// human label for the mid-run state; the canonical type value is 'in-progress'. The
// escalation therefore fires on 'in-progress' (working) and 'waiting'; the working copy
// literal keeps the human word "still working" per the planner's contract default.

import type { AgentState } from '../shared/agent-state';

/** The mode the destructive confirm is operating in (mirrors SessionManager `removeMode`). */
export type RemoveMode = 'remove' | 'delete';

/** The inputs the body builder reads off the close target (renderer-visible only). */
export interface ConfirmBodyArgs {
  /** 'delete' = permanent recipe wipe; 'remove' = retire (configured) or drop (ephemeral). */
  removeMode: RemoveMode;
  /** True when the row is a configured recipe (Remove retires it to the Inactive List). */
  configured: boolean;
  /** True when the row currently has a live process (Remove ends it). */
  isRunning: boolean;
  /** The renderer-only agent overlay on the row; absent / 'free' → no escalation (D-06). */
  agentState?: AgentState;
}

// ── the four shipped idle bodies (byte-identical to SessionManager.tsx ~706-712) ──

const DELETE_BODY =
  'This permanently deletes the saved session — its recipe is gone for good.';
const CONFIGURED_REMOVE_BODY =
  'This ends its running process and moves the session to the Inactive List. You can start it again later.';
const EPHEMERAL_RUNNING_REMOVE_BODY =
  'This ends its running process and removes the session.';
const PLAIN_REMOVE_BODY = 'This removes the session from the sidebar.';

// ── the D-04 escalation prefixes (consequence-naming, not a generic "are you sure") ──

/** The mid-run (working) escalation — names the task that will be killed. */
const WORKING_ESCALATION =
  'Claude is still working in this session — closing it now will end the task mid-run. ';
/** The waiting escalation — names the discarded prompt input. */
const WAITING_ESCALATION =
  "This session is waiting for your input — closing it now will discard what it's asking for. ";

/**
 * Resolve the shipped idle body for a (mode, configured, running) combination.
 * Pure; the agent escalation is layered on top by `buildConfirmBody`.
 */
function resolveIdleBody(args: ConfirmBodyArgs): string {
  if (args.removeMode === 'delete') return DELETE_BODY;
  if (args.configured) return CONFIGURED_REMOVE_BODY;
  if (args.isRunning) return EPHEMERAL_RUNNING_REMOVE_BODY;
  return PLAIN_REMOVE_BODY;
}

/**
 * Resolve the escalation PREFIX for an agent overlay state. Only the mid-run
 * ('in-progress') and 'waiting' states escalate; 'free' / absent → no prefix.
 */
function resolveEscalation(agentState?: AgentState): string {
  if (agentState === 'in-progress') return WORKING_ESCALATION;
  if (agentState === 'waiting') return WAITING_ESCALATION;
  return '';
}

/**
 * Build the ConfirmModal body string (D-04). The escalation is a PREFIX so the
 * idle consequence sentence is always preserved at the tail.
 *
 *   buildConfirmBody({ removeMode: 'remove', configured: true, isRunning: true })
 *     === CONFIGURED_REMOVE_BODY                                  (idle, verbatim)
 *   buildConfirmBody({ ..., agentState: 'in-progress' })
 *     === WORKING_ESCALATION + CONFIGURED_REMOVE_BODY             (escalated prefix)
 *
 * Returns a plain string; the caller renders it as a React text node (no HTML).
 */
export function buildConfirmBody(args: ConfirmBodyArgs): string {
  return resolveEscalation(args.agentState) + resolveIdleBody(args);
}
