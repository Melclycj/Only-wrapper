// RENDERER ONLY — the slim active-session identity bar (04-02, D-05 / IDENT-03).
//
// A thin strip above the active terminal showing the active session's icon + name +
// live status badge. IDENTITY ONLY — NO controls (no clear/restart; those are
// Phase 6 / TERM-12). It reuses the SAME renderIcon + .row-name + STATUS_STYLE badge
// markup as the Sidebar row (verbatim) so identity reads consistently everywhere; it
// never re-derives status colors. Mounted inside the flex-column .terminal-area above
// the .viewport-stack (RESEARCH Open Q2) — that restructure happens in SessionManager.

import type { SessionRecord } from '../shared/types';
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
}

export function IdentityHeader({
  session,
  agentState,
}: IdentityHeaderProps): React.JSX.Element | null {
  if (session === null) return null;
  const style = presentation(session.status, agentState);
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
    </div>
  );
}
