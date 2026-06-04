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

/** Convenience accessor for a status's human label. */
export function statusLabel(status: SessionStatus): string {
  return STATUS_STYLE[status].label;
}

/** Convenience accessor for a status's accent color (oklch string). */
export function statusAccent(status: SessionStatus): string {
  return STATUS_STYLE[status].accent;
}
