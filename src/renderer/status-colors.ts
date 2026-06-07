// RENDERER ONLY — status → DESIGN.md color/label map (TERM-08, SC4, D-04).
//
// A pure token-map (the structural precedent is the TERMINAL_THEME const in
// TerminalPane.tsx): each of the 5 SessionStatus states maps to a { label, accent }
// drawn from DESIGN.md §"Status system" oklch ramps. Electron's Chromium renders
// oklch() natively, so these go straight into inline styles / CSS custom props.
//
// Reconciliation (DESIGN.md §"Reconciliation notes"): the mockup's *agent* states
// (in-progress / finished / free) are the presentation layer over v1's *process*
// statuses. We keep the v1 5-state model as the source of truth and borrow the
// mockup's color/label LANGUAGE:
//   running     → blue  "Running"  (in-progress)
//   exited      → green "Finished" (clean exit, code 0)
//   stopped     → slate "Stopped"  (user-initiated stop; free/idle language)
//   not_started → slate "Idle"     (no PTY yet)
//   error       → DERIVED red ramp "Error" — no mockup state exists for a failed
//                 process; DESIGN.md explicitly delegates deriving a palette-
//                 consistent red (hue ~25, L/C in line with the other accents).

import type { SessionStatus } from '../shared/types';
import type { AgentState } from '../shared/agent-state';

export const STATUS_STYLE: Record<
  SessionStatus,
  { label: string; accent: string }
> = {
  running: { label: 'Running', accent: 'oklch(0.62 0.14 248)' }, // blue (in-progress)
  exited: { label: 'Finished', accent: 'oklch(0.60 0.13 150)' }, // green (finished)
  stopped: { label: 'Stopped', accent: 'oklch(0.64 0.02 260)' }, // slate (free/idle)
  not_started: { label: 'Idle', accent: 'oklch(0.64 0.02 260)' }, // slate
  error: { label: 'Error', accent: 'oklch(0.58 0.16 25)' }, // DERIVED red ramp (D-04, no mockup state)
};

// ─── Agent-state presentation overlay (TERM-09 / SC4 — D-06/D-07) ────────────
//
// AGENT_STYLE mirrors STATUS_STYLE's { label, accent } shape with the authoritative
// agent-state ramps from 06-UI-SPEC §Color (DESIGN.md §"Status system"). The agent-
// state is a PRESENTATION OVERLAY (D-06): NOT a 6th SessionStatus, never persisted,
// never an IPC field. It is layered on TOP of the 5 process statuses ONLY while the
// session is 'running' (D-07), via presentation() below.
//
// The amber accent is reserved EXCLUSIVELY for 'waiting' (the highest-attention
// signal, rank 0) and appears in exactly ONE place — the waiting ramp below.
export const AGENT_STYLE: Record<
  AgentState,
  { label: string; accent: string }
> = {
  'in-progress': { label: 'In progress', accent: 'oklch(0.62 0.14 248)' }, // blue
  waiting: { label: 'Waiting for you', accent: 'oklch(0.66 0.15 60)' }, // amber (TERM-09 — reserved)
  free: { label: 'Free', accent: 'oklch(0.64 0.02 260)' }, // slate
};

/**
 * Resolve the badge { label, accent } for a session, applying the agent-state
 * OVERLAY only while the process status is 'running' (D-07). For every other status
 * — and for a running session with no agent-state computed yet — the process-status
 * STATUS_STYLE entry is returned unchanged (the overlay never leaks past 'running').
 *
 *   presentation('running', 'in-progress') → blue  "In progress"
 *   presentation('running', 'waiting')     → amber "Waiting for you" (TERM-09)
 *   presentation('running', 'free')        → slate "Free"
 *   presentation('running', undefined)     → STATUS_STYLE.running (process default)
 *   presentation('exited',  'waiting')     → STATUS_STYLE.exited (overlay does NOT leak)
 *   presentation('error',   anything)      → STATUS_STYLE.error  (red, unchanged)
 */
export function presentation(
  status: SessionStatus,
  agent?: AgentState,
): { label: string; accent: string } {
  if (status === 'running' && agent) return AGENT_STYLE[agent];
  return STATUS_STYLE[status];
}

/** Convenience accessor for a status's human label. */
export function statusLabel(status: SessionStatus): string {
  return STATUS_STYLE[status].label;
}

/** Convenience accessor for a status's accent color (oklch string). */
export function statusAccent(status: SessionStatus): string {
  return STATUS_STYLE[status].accent;
}
