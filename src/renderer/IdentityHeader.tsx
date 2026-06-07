// RENDERER ONLY — the active-session identity bar + header control cluster
// (04-02 identity / 06-04 controls — D-05 / IDENT-03 / SC5 / TERM-12 / D-11..D-13).
//
// A thin strip above the active terminal showing the active session's icon + name +
// live status badge, PLUS a right-aligned control cluster (Phase 6 / TERM-12): Clear
// (always), Restart (when running), Start ▶ (when not running). It reuses the SAME
// renderIcon + .row-name + presentation()-driven badge markup as the Sidebar row, and
// the SAME .row-control button shape as the Sidebar .row-controls cluster (verbatim) so
// identity + controls read consistently everywhere; it never re-derives status colors.
// Mounted inside the flex-column .terminal-area above the .viewport-stack (RESEARCH
// Open Q2). The .row-name flex:1 pushes the badge + controls to the right edge.
//
// D-11 (contextual controls): Clear ALWAYS; Restart only when running; Start ▶ only when
// NOT running (not_started/stopped/exited/error). NO Stop button — the destructive Close
// stays in the right-click context menu (Phase-3 D-03a preserved).
// D-12 (Clear semantics): Clear → onClear(id) → SessionManager.handleClear →
// term.clear() on the kept-alive xterm (drops scrollback, preserves the prompt; NO PTY
// injection). D-13 (keyboard): all controls are native Tab-focusable <button>s with the
// consistent 2px blue :focus-visible outline; the global Clear chord (Cmd+K / Ctrl+Shift+K)
// is intercepted main-side and dispatched via onSwitchSession (no button here).

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
  /** Restart the active session under the same logicalId (shown only when running). */
  onRestart: (id: LogicalId) => void;
  /** Start the active session (shown only when NOT running). */
  onStart: (id: LogicalId) => void;
}

export function IdentityHeader({
  session,
  agentState,
  onClear,
  onRestart,
  onStart,
}: IdentityHeaderProps): React.JSX.Element | null {
  if (session === null) return null;
  const style = presentation(session.status, agentState);
  const id = session.logicalId;
  const running = session.status === 'running';
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
      {/* Right-aligned control cluster (D-11). margin-left:auto sits it at the far edge
          after the badge (the .row-name flex already consumes the middle). Buttons copy
          the Sidebar .row-control shape verbatim; Clear is a text-labelled button. */}
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
        {running ? (
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
        ) : (
          <button
            type="button"
            className="row-control row-control-start"
            data-testid="header-start"
            data-action="start"
            title="Start session"
            aria-label="Start session"
            onClick={(e) => {
              e.stopPropagation();
              onStart(id);
            }}
          >
            <span aria-hidden="true">▶</span>
          </button>
        )}
      </span>
    </div>
  );
}
