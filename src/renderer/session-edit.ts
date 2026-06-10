// RENDERER ONLY — the pure edit-split reducer (04-01, D-02).
//
// Imports ONLY ../shared/types (type-only) — never React/xterm/electron — so the
// live-vs-restart field split unit-tests in the Node/Vitest env (mirrors
// session-close.ts). No side effects: the caller (SessionManager) performs the
// `setSessions` live-apply (name/icon) AND the `window.api.ptyUpdateProfile`
// restart-apply (cwd/shell/startupCommand) using the two halves this returns.

import type { SessionIconSpec } from '../shared/types';

/** The flat form payload the SessionEditModal collects (D-02). */
export interface EditPayload {
  name: string;
  icon: SessionIconSpec;
  cwd: string;
  shell: string;
  startupCommand: string;
}

/** The split result: the LIVE half (applies immediately) + the RESTART half. */
export interface EditSplit {
  /** Applies live to the rendered record — no respawn (D-02). */
  live: { name: string; icon: SessionIconSpec };
  /** Persisted into main's record; takes effect on the NEXT restart (D-02). */
  restart: { cwd: string; shell: string; startupCommand: string };
}

/**
 * Split a form payload into its live (name/icon) and restart (cwd/shell/
 * startupCommand) halves. Pure — the caller wires the two side effects.
 */
export function splitEdit(payload: EditPayload): EditSplit {
  return {
    live: { name: payload.name, icon: payload.icon },
    restart: {
      cwd: payload.cwd,
      shell: payload.shell,
      startupCommand: payload.startupCommand,
    },
  };
}
