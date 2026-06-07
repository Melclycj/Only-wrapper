// RENDERER ONLY — the basic DESIGN.md session list (03-02, TERM-08 display).
//
// Basic tier (D-02): one row per session showing icon + name + a live status badge
// (color from STATUS_STYLE — the DESIGN.md §"Status system" language), click-to-
// switch, and an "add session" button. This is the IDE sidebar, BASIC version —
// NO create/edit form, NO rename, NO icon customization, NO collapse, NO keyboard
// shortcuts (all Phase 4). Style authority is DESIGN.md (Nunito, --surface/--line,
// rounded rows); tokens live in terminal.css.

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LogicalId, SessionIconSpec, SessionRecord } from '../shared/types';
import { STATUS_STYLE } from './status-colors';
import { COLOR_INITIAL } from './icon-spec';

/**
 * Render a SessionIconSpec across all three kinds — the SINGLE source of truth
 * (exported so IconPicker + IdentityHeader render icons identically, D-09). emoji/
 * preset render their glyph/token verbatim (Pitfall 6 — never split a grapheme); the
 * `color` branch renders a filled badge with the uppercased session-name initial
 * (COLOR_INITIAL) so a color icon stays identifiable in the collapsed rail.
 */
export function renderIcon(
  icon: SessionIconSpec,
  name: string,
): React.JSX.Element {
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
          className="row-icon row-icon-color"
          style={{ background: icon.value }}
        >
          {COLOR_INITIAL(icon, name)}
        </span>
      );
  }
}

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
  /**
   * Start a dormant (`not_started`) session (D-03/D-11) — promotes the restored
   * record to live via the existing ptyCreate/create({id}) path (Plan 05-02). The
   * row control flips ▶ Start (not_started) ↔ ↻ Restart (has run).
   */
  onStart: (id: LogicalId) => void;
  /**
   * Right-click a row (D-03): open the context menu at (x, y) for `id`. Wired at the
   * `.sidebar-row` level so it works in BOTH expanded and collapsed modes — the menu
   * is the only control surface when collapsed (Pitfall 5 / D-11).
   */
  onContextMenu: (id: LogicalId, x: number, y: number) => void;
  /** Open the edit form modal for `id` (D-04) — used by the context menu's Edit item. */
  onEdit: (id: LogicalId) => void;
  /**
   * Collapsed mode (D-10/D-11): when true the `.sidebar` folds to an icon-only rail
   * — `.row-name`/`.status-badge`/`.row-controls` hide; each row keeps its identifying
   * icon (emoji or the color-badge-with-initial), a small status-color dot (NAV-01),
   * and a hover tooltip with the name. The right-click context menu (wired at the
   * `.sidebar-row` level) is the ONLY control surface when collapsed (Pitfall 5).
   * State is component-local in SessionManager (persistence is Phase 5 — D-11).
   */
  collapsed: boolean;
  /** Toggle the collapsed/expanded rail (the pinned chevron control). */
  onToggleCollapse: () => void;
  /**
   * Drag-to-reorder (NAV-04/SC3/D-08): the user dragged the row `fromId` onto the
   * position of `toId`. SessionManager applies the pure `reorder()` reducer (optimistic
   * local dense-reindex) and persists the new order via `window.api.persistOrder` —
   * silently (no save UI, D-13). Only fired on a REAL move (fromId !== toId).
   */
  onReorder: (fromId: LogicalId, toId: LogicalId) => void;
}

// A session has a live PTY only while 'running'. The RESTART affordance is offered
// once it is no longer running (stopped/exited/error/not_started) so a self-exited
// session can be relaunched with its identity preserved (D-03a restart-identity half).
// The destructive Close is offered on every row regardless of status.
function isRunning(status: SessionRecord['status']): boolean {
  return status === 'running';
}

// Props for a single sortable row — the per-session subset of SidebarProps plus the
// row's own record + active flag. Split out so each row can call useSortable() (a hook
// must run at the top level of a component, not inside a .map() callback).
interface SortableRowProps {
  session: SessionRecord;
  isActive: boolean;
  onSelect: (id: LogicalId) => void;
  onClose: (id: LogicalId) => void;
  onRestart: (id: LogicalId) => void;
  onStart: (id: LogicalId) => void;
  onContextMenu: (id: LogicalId, x: number, y: number) => void;
  onEdit: (id: LogicalId) => void;
}

// One sortable sidebar row. The WHOLE row is the drag surface (dnd-kit listeners spread
// onto the row container) but a PointerSensor activation distance (configured on the
// parent DndContext) means a plain click still fires onSelect and the nested control
// buttons' stopPropagation still works — a drag only begins after the pointer travels
// past the activation distance (UI-SPEC §5). A dedicated ⠿ drag-handle glyph telegraphs
// draggability on hover; it shares the same row-level drag surface (no separate handle
// listeners needed — the activation distance keeps clicks intact).
function SortableSidebarRow({
  session: s,
  isActive,
  onSelect,
  onClose,
  onRestart,
  onStart,
  onContextMenu,
  onEdit,
}: SortableRowProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: s.logicalId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const stat = STATUS_STYLE[s.status];
  const running = isRunning(s.status);
  // SC2 (D-03): a renderer-only spawn-error message rides the SessionRow (not the
  // shared SessionRecord). When the row is in 'error' with a captured message, surface
  // it as the row's title= tooltip so the failure is visible in the sidebar too — the
  // SAME message shown in the error card. Read defensively (the field is optional).
  const errorMessage = (s as { errorMessage?: string }).errorMessage;
  const rowTitle =
    s.status === 'error' && errorMessage ? errorMessage : undefined;
  // A dormant (never-run) session shows Start ▶; a has-run non-running session
  // (stopped/exited/error) shows Restart ↻ (D-03). Dormant rows also dim slightly.
  const dormant = s.status === 'not_started';

  return (
    <div
      ref={setNodeRef}
      // dnd-kit `attributes` provides role="button" + tabIndex + aria-roledescription
      // for keyboard drag a11y; spread FIRST so our explicit handlers below win and there
      // is no duplicate-prop overwrite. We re-affirm role/tabIndex anyway for clarity.
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      className={
        (isActive ? 'sidebar-row active' : 'sidebar-row') +
        (isDragging ? ' dragging' : '')
      }
      style={style}
      data-session-id={s.logicalId}
      {...(rowTitle ? { title: rowTitle } : {})}
      {...(dormant ? { 'data-dormant': '' } : {})}
      {...(isDragging ? { 'data-dragging': '' } : {})}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => onSelect(s.logicalId)}
      onDoubleClick={() => onEdit(s.logicalId)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(s.logicalId, e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        // Compose with dnd-kit's keyboard sensor listener (spread above, then overridden
        // here): first let dnd-kit handle the key (Space starts/ends a keyboard drag,
        // arrows move it). If dnd-kit did NOT consume it (not in a drag) AND it is Enter,
        // fall through to the legacy Enter-to-switch. Space is reserved for dnd-kit's
        // keyboard reorder (a11y) so we no longer switch on Space.
        listeners?.onKeyDown?.(e);
        if (!e.defaultPrevented && e.key === 'Enter') {
          e.preventDefault();
          onSelect(s.logicalId);
        }
      }}
    >
      {/* Drag handle (⠿) — shown on hover, --ink-faint, cursor: grab→grabbing. The whole
          row is the drag surface (listeners are on the container), so the handle is a
          visual telegraph rather than the only grab point (UI-SPEC §5). aria-hidden — the
          a11y reorder is driven by dnd-kit's keyboard sensor on the row itself. */}
      <span className="row-drag-handle" aria-hidden="true">
        ⠿
      </span>
      {renderIcon(s.icon, s.name)}
      <span
        className="collapsed-status-dot status-dot"
        style={{ '--accent': stat.accent } as React.CSSProperties}
        aria-hidden="true"
      />
      <span className="row-name">{s.name}</span>
      <span
        className="status-badge"
        style={{ '--accent': stat.accent } as React.CSSProperties}
        title={stat.label}
      >
        <span className="status-dot" />
        {stat.label}
      </span>
      <span className="row-controls">
        {!running &&
          (dormant ? (
            <button
              type="button"
              className="row-control row-control-start"
              data-testid="start-session"
              data-action="start"
              title="Start session"
              aria-label={`Start ${s.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onStart(s.logicalId);
              }}
            >
              <span aria-hidden="true">▶</span>
            </button>
          ) : (
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
              <span aria-hidden="true">↻</span>
            </button>
          ))}
        <button
          type="button"
          className="row-control"
          data-testid="edit-session"
          data-action="edit"
          title="Edit session"
          aria-label={`Edit ${s.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(s.logicalId);
          }}
        >
          <span aria-hidden="true">✎</span>
        </button>
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
          <span aria-hidden="true">✕</span>
        </button>
      </span>
      <span className="rail-tooltip" role="tooltip">
        {s.name} · {stat.label}
      </span>
    </div>
  );
}

export function Sidebar({
  sessions,
  activeId,
  onSelect,
  onAdd,
  onClose,
  onRestart,
  onStart,
  onContextMenu,
  onEdit,
  collapsed,
  onToggleCollapse,
  onReorder,
}: SidebarProps): React.JSX.Element {
  // Pointer sensor with an activation DISTANCE so a plain click still switches the
  // session and a click on a nested control still fires (a drag only starts after the
  // pointer travels ~5px — UI-SPEC §5). A keyboard sensor provides a11y reorder.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // On drop: if the row moved onto a different row, hand (fromId, toId) up to
  // SessionManager, which applies the pure reorder() reducer + persistOrder (D-13 silent).
  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id as LogicalId, over.id as LogicalId);
    }
  };

  return (
    <nav
      className={collapsed ? 'sidebar collapsed' : 'sidebar'}
      aria-label="Sessions"
    >
      {/* Pinned chevron toggle (D-10): folds the rail to icon-only and back. The state
          stays where the user leaves it (component-local — persistence is Phase 5). */}
      <button
        type="button"
        className="sidebar-collapse"
        data-testid="sidebar-collapse"
        aria-pressed={collapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggleCollapse}
      >
        <span className="sidebar-collapse-chevron" aria-hidden="true">
          {collapsed ? '»' : '«'}
        </span>
      </button>
      {/* Drag-to-reorder (NAV-04/SC3/D-08): DndContext owns the pointer/keyboard sensors;
          SortableContext holds the ordered list of session ids (vertical strategy). The
          collapsed rail renders the SAME ordered rows (D-08 — render order = saved order;
          SessionManager hands `sessions` pre-sorted by `order`), so the collapsed rail
          reflects the persisted order; full collapsed-rail DnD is optional (D-08). */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sessions.map((s) => s.logicalId)}
          strategy={verticalListSortingStrategy}
        >
          {sessions.map((s) => (
            <SortableSidebarRow
              key={s.logicalId}
              session={s}
              isActive={s.logicalId === activeId}
              onSelect={onSelect}
              onClose={onClose}
              onRestart={onRestart}
              onStart={onStart}
              onContextMenu={onContextMenu}
              onEdit={onEdit}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        className="add-session"
        data-testid="add-session"
        aria-label="Add session"
        onClick={onAdd}
      >
        <span>{collapsed ? '+' : '+ Add session'}</span>
      </button>
    </nav>
  );
}
