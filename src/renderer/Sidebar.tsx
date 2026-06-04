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
}: SidebarProps): React.JSX.Element {
  return (
    <nav className="sidebar" aria-label="Sessions">
      {sessions.map((s) => {
        const style = STATUS_STYLE[s.status];
        const isActive = s.logicalId === activeId;
        return (
          <button
            key={s.logicalId}
            type="button"
            className={isActive ? 'sidebar-row active' : 'sidebar-row'}
            data-session-id={s.logicalId}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect(s.logicalId)}
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
          </button>
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
