// RENDERER ONLY — the active-session identity bar + header control cluster
// (04-02 identity / 06.1-04 controls — D-05 / IDENT-03 / SC5 / TERM-12 / D-06).
//
// A thin strip above the active terminal showing the active session's icon + name +
// live status badge, PLUS a right-aligned control cluster (TERM-12 / D-06): Clear +
// Restart + Remove. It reuses the SAME renderIcon + .row-name + presentation()-driven
// badge markup as the Sidebar row, and the SAME .row-control button shape as the
// Sidebar .row-controls cluster (verbatim) so identity + controls read consistently
// everywhere; it never re-derives status colors. Mounted inside the flex-column
// .terminal-area above the .viewport-stack (RESEARCH Open Q2). The .row-name flex:1
// pushes the badge + controls to the right edge.
//
// D-06 (two-bucket header — supersedes Phase-6 D-11): the header is LIVE-ONLY. It shows
// Clear (always) + Restart + a Remove affordance. There is NO header Start (Start now
// lives on every Inactive-List entry — D-01/D-06) and NO Stop verb. A dormant/errored
// active session renders the IdleCard instead, so the header simply returns null when
// the active session is not running.
// D-03 (Remove vs Delete): Remove (this header) kills the PTY but KEEPS the recipe for a
// configured session → it lands in the Inactive List; for an ephemeral session it is
// gone. Permanent Delete lives on the Inactive-List entry (the sidebar), behind a confirm.
// D-12 (Clear semantics): Clear → onClear(id) → SessionManager.handleClear →
// term.clear() on the kept-alive xterm (drops scrollback, preserves the prompt; NO PTY
// injection). Keyboard: all controls are native Tab-focusable <button>s with the
// consistent 2px blue :focus-visible outline (the terminal no longer swallows Tab/Space
// when a control is focused — fixed in SessionView's attachCustomKeyEventHandler); the
// global Clear chord (Cmd+K / Ctrl+Shift+K) is intercepted main-side and dispatched via
// onSwitchSession (no button here).

import type { LogicalId, SessionRecord } from '../shared/types';
import type { AgentState } from '../shared/agent-state';
import { presentation } from './status-colors';
import { renderIcon } from './Sidebar';

export interface IdentityHeaderProps {
  /** The active session record (null when there is no active session). */
  session: SessionRecord | null;
  /**
   * The active session's renderer-only agent-state overlay (TERM-09 / SC4 — D-06/D-07),
   * threaded from SessionManager. The header badge reflects it for a running session;
   * for every other status it is inert (presentation returns the process style).
   */
  agentState?: AgentState;
  /**
   * Clear the active session's visible buffer (D-12, client-side term.clear()). Always
   * shown. SessionManager.handleClear reaches window.__sessionTerms[id] — NO PTY write.
   */
  onClear: (id: LogicalId) => void;
  /** Restart the active session under the same logicalId (live-only — D-06). */
  onRestart: (id: LogicalId) => void;
  /**
   * Remove the active LIVE session (D-03/D-06): kill the PTY but KEEP the recipe — a
   * configured session lands in the Inactive List (restartable), an ephemeral session is
   * gone. This is the live header's destructive action; permanent Delete lives on the
   * Inactive-List entry. SessionManager.handleRemoveRequest opens the confirm flow.
   */
  onRemove: (id: LogicalId) => void;
}

export function IdentityHeader({
  session,
  agentState,
  onClear,
  onRestart,
  onRemove,
}: IdentityHeaderProps): React.JSX.Element | null {
  // D-06: the header is LIVE-ONLY. A null active session OR a non-running one (dormant /
  // errored — which renders the IdleCard instead) shows no header. This is what drops the
  // contextual header Start entirely (it now lives on every Inactive-List entry).
  if (session === null || session.status !== 'running') return null;
  const style = presentation(session.status, agentState);
  const id = session.logicalId;
  return (
    <div className="identity-header" data-testid="identity-header">
      {renderIcon(session.icon, session.name)}
      <span className="row-name">{session.name}</span>
      <span
        className="status-badge"
        style={{ '--accent': style.accent } as React.CSSProperties}
        title={style.label}
      >
        <span className="status-dot" />
        {style.label}
      </span>
      {/* Right-aligned control cluster (D-06): Clear + Restart + Remove — live-only, NO
          Start, NO Stop. margin-left:auto sits it at the far edge after the badge (the
          .row-name flex already consumes the middle). Buttons copy the Sidebar
          .row-control shape verbatim; Clear is a text-labelled button. All are native
          Tab-focusable <button>s (keyboard-focus fix lives in SessionView). */}
      <span className="header-controls">
        <button
          type="button"
          className="header-control-clear"
          data-testid="clear-terminal"
          data-action="clear"
          title="Clear terminal"
          aria-label="Clear terminal"
          onClick={(e) => {
            e.stopPropagation();
            onClear(id);
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className="row-control"
          data-testid="header-restart"
          data-action="restart"
          title="Restart session"
          aria-label="Restart session"
          onClick={(e) => {
            e.stopPropagation();
            onRestart(id);
          }}
        >
          <span aria-hidden="true">↻</span>
        </button>
        <button
          type="button"
          className="row-control row-control-close"
          data-testid="header-remove"
          data-action="remove"
          title="Remove session"
          aria-label="Remove session"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </span>
    </div>
  );
}
