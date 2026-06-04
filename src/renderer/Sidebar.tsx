// RENDERER ONLY — the basic DESIGN.md session list (03-02, TERM-08 display).
//
// Basic tier (D-02): one row per session showing icon + name + a live status badge
// (color from STATUS_STYLE — the DESIGN.md §"Status system" language), click-to-
// switch, and an "add session" button. This is the IDE sidebar, BASIC version —
// NO create/edit form, NO rename, NO icon customization, NO collapse, NO keyboard
// shortcuts (all Phase 4). Style authority is DESIGN.md (Nunito, --surface/--line,
// rounded rows); tokens live in terminal.css.

import type { LogicalId, SessionIconSpec, SessionRecord } from '../shared/types';
import { STATUS_STYLE } from './status-colors';

export interface SidebarProps {
  sessions: SessionRecord[];
  activeId: LogicalId | null;
  onSelect: (id: LogicalId) => void;
  onAdd: () => void;
  /**
   * Destructively CLOSE a session (D-03a) — opens the confirm modal; on confirm main
   * kills the PTY and REMOVES the SessionRecord (the row vanishes). Offered on EVERY
   * row (running or finished/errored) so any session can be removed.
   */
  onClose: (id: LogicalId) => void;
  /** Restart a session (TERM-07 / IDENT-02) — same identity, new ptyPid. */
  onRestart: (id: LogicalId) => void;
}

// A session has a live PTY only while 'running'. The RESTART affordance is offered
// once it is no longer running (stopped/exited/error/not_started) so a self-exited
// session can be relaunched with its identity preserved (D-03a restart-identity half).
// The destructive Close is offered on every row regardless of status.
function isRunning(status: SessionRecord['status']): boolean {
  return status === 'running';
}

// Render a SessionIconSpec across ALL three kinds (DESIGN.md §"Reconciliation":
// the row must render emoji | preset | color, not just emoji). emoji/preset render
// their glyph/token; color renders a filled swatch.
function renderIcon(icon: SessionIconSpec): React.JSX.Element {
  switch (icon.type) {
    case 'emoji':
      return <span className="row-icon">{icon.value}</span>;
    case 'preset':
      return (
        <span className="row-icon" data-preset={icon.value}>
          {icon.value}
        </span>
      );
    case 'color':
      return (
        <span
          className="row-icon"
          style={{ background: icon.value }}
          aria-hidden="true"
        />
      );
  }
}

export function Sidebar({
  sessions,
  activeId,
  onSelect,
  onAdd,
  onClose,
  onRestart,
}: SidebarProps): React.JSX.Element {
  return (
    <nav className="sidebar" aria-label="Sessions">
      {sessions.map((s) => {
        const style = STATUS_STYLE[s.status];
        const isActive = s.logicalId === activeId;
        const running = isRunning(s.status);
        // The row is a clickable container (switch on click). The close/restart
        // controls are nested buttons — a row cannot itself be a <button> or the
        // controls would be invalid nested interactives. clickSidebarRow() in the
        // E2E driver calls .click() on `.sidebar-row[data-session-id]`, which still
        // fires this onClick; the control buttons stopPropagation so a close/restart
        // never doubles as a switch.
        return (
          <div
            key={s.logicalId}
            role="button"
            tabIndex={0}
            className={isActive ? 'sidebar-row active' : 'sidebar-row'}
            data-session-id={s.logicalId}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect(s.logicalId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(s.logicalId);
              }
            }}
          >
            {renderIcon(s.icon)}
            <span className="row-name">{s.name}</span>
            <span
              className="status-badge"
              style={{ '--accent': style.accent } as React.CSSProperties}
              title={style.label}
            >
              <span className="status-dot" />
              {style.label}
            </span>
            <span className="row-controls">
              {/* Non-running rows get a Restart affordance (relaunch a self-exited
                  session, identity preserved — D-03a). Running rows do not. */}
              {!running && (
                <button
                  type="button"
                  className="row-control"
                  data-testid="restart-session"
                  data-action="restart"
                  title="Restart session"
                  aria-label={`Restart ${s.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestart(s.logicalId);
                  }}
                >
                  Restart
                </button>
              )}
              {/* Destructive Close on EVERY row (D-03a): kill + remove, behind the
                  confirm modal. Replaces the old keep-as-stopped Stop button. */}
              <button
                type="button"
                className="row-control row-control-close"
                data-testid="close-session"
                data-action="close"
                title="Close session"
                aria-label={`Close ${s.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(s.logicalId);
                }}
              >
                Close
              </button>
            </span>
          </div>
        );
      })}
      <button
        type="button"
        className="add-session"
        data-testid="add-session"
        onClick={onAdd}
      >
        + Add session
      </button>
    </nav>
  );
}
