// RENDERER ONLY — the active-session identity bar + header control cluster
// (04-02 identity / 06.1-04 controls — D-05 / IDENT-03 / SC5 / TERM-12 / D-06).
//
// A thin strip above the active terminal showing the active session's icon + name +
// live status badge, PLUS a right-aligned control cluster (TERM-12 / D-06): Clear +
// Remove. It reuses the SAME renderIcon + .row-name + presentation()-driven badge
// markup as the Sidebar row, and the SAME .row-control button shape as the Sidebar
// .row-controls cluster (verbatim) so identity + controls read consistently
// everywhere; it never re-derives status colors. Mounted inside the flex-column
// .terminal-area above the .viewport-stack (RESEARCH Open Q2). The .row-name flex:1
// pushes the badge + controls to the right edge.
//
// D-06 / D-01 (Phase 11 — the unified card cap): the header is LIVE-ONLY and carries
// exactly two controls — Clear (always) + a Remove affordance. The lifecycle verb set is
// Clear / Remove only; the recycle model is Remove → Inactive List → the dormant ▶ go
// glyph (a fresh process per D-04), so no recycle verb lives in this cap. A dormant or
// errored active session renders the IdleCard instead, so the header simply returns null
// when the active session is not running.
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
  /**
   * Remove the active LIVE session (D-03/D-06): kill the PTY but KEEP the recipe — a
   * configured session lands in the Inactive List (recyclable via the dormant ▶ go glyph),
   * an ephemeral session is gone. This is the live header's destructive action; permanent
   * Delete lives on the Inactive-List entry. SessionManager.handleRemoveRequest opens the
   * confirm flow.
   */
  onRemove: (id: LogicalId) => void;
}

export function IdentityHeader({
  session,
  agentState,
  onClear,
  onRemove,
}: IdentityHeaderProps): React.JSX.Element | null {
  // D-06: the header is LIVE-ONLY. A null active session OR a non-running one (dormant /
  // errored — which renders the IdleCard instead) shows no header. This is what drops any
  // contextual go-verb from the cap (the dormant ▶ go glyph lives on the Inactive-List entry).
  if (session === null || session.status !== 'running') return null;
  const style = presentation(session.status, agentState);
  const id = session.logicalId;
  // GAP-11-A breadcrumb path line (mockup switchboard-ide-view.png): "local · {name} ·
  // {cwdTail}". cwdTail keeps only the trailing 2 path segments (e.g. ~/apps/orchard →
  // apps/orchard) so a long absolute cwd does not blow out the line; the .identity-breadcrumb
  // ellipsis is the final guard. Pure presentation off the existing record fields — no new
  // bridge key, no IPC. The "local" segment reflects the local-only nature of every session
  // (the app is local-only by CLAUDE.md constraint).
  const cwdTail = formatCwdTail(session.cwd);
  return (
    <div className="identity-header" data-testid="identity-header">
      {renderIcon(session.icon, session.name)}
      <span className="row-name">{session.name}</span>
      {/* Right-aligned cluster: status badge + the Clear/Remove control cluster (D-06 /
          D-01). Grid column 3 (auto) hugs the right edge; the .row-name 1fr column consumes
          the middle. Live-only — no go-verb, no stop-verb (recycle is Remove → Inactive
          List → the dormant ▶). Buttons copy the Sidebar .row-control shape verbatim; Clear
          is a text-labelled button. All native Tab-focusable <button>s. */}
      <span className="header-right">
        <span
          className="status-badge"
          style={{ '--accent': style.accent } as React.CSSProperties}
          title={style.label}
        >
          <span className="status-dot" />
          {style.label}
        </span>
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
      </span>
      {/* GAP-11-A breadcrumb path line (mockup): local · {name} · {cwdTail}. Spans cols
          1–2 below the tab. Mirrors the mockup's "local · test-suite · ~/apps/orchard". */}
      <span className="identity-breadcrumb" data-testid="identity-breadcrumb">
        <span className="breadcrumb-seg">local</span>
        <span className="breadcrumb-sep" aria-hidden="true">·</span>
        <span className="breadcrumb-seg">{session.name}</span>
        {cwdTail !== '' && (
          <>
            <span className="breadcrumb-sep" aria-hidden="true">·</span>
            {/* The cwd is the session's CONFIGURED working directory (from the saved record),
                NOT the shell's live pwd — which drifts as the user cd's around. Mark it as a
                hint (faint dotted underline + help cursor + title tooltip) so it never reads as
                a live location. Making it track the real pwd is a separate OSC-7 shell-
                integration feature, parked as a v2 idea. */}
            <span
              className="breadcrumb-seg breadcrumb-cwd"
              title="Configured working directory — where this session starts, not the shell's live location"
            >
              {cwdTail}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

/**
 * Format a session cwd into the breadcrumb tail — the trailing 1–2 path segments with a
 * leading "~/" hint when the path lives under HOME-like roots, so a long absolute cwd does
 * not blow out the breadcrumb (the .identity-breadcrumb ellipsis is the final guard). Pure
 * string formatting — no fs, no IPC. Exported for the unit test.
 *
 *   /Users/jerry/apps/orchard → ~/apps/orchard (tail kept short)
 *   /apps/orchard             → apps/orchard
 *   ""                        → "" (omit the segment)
 */
export function formatCwdTail(cwd: string | undefined): string {
  if (!cwd) return '';
  const trimmed = cwd.replace(/[/\\]+$/, '');
  if (trimmed === '') return '';
  const segments = trimmed.split(/[/\\]+/).filter((s) => s.length > 0);
  if (segments.length === 0) return '';
  const tail = segments.slice(-2);
  // A path with more than 2 segments gets a "~/" depth hint (it lives deeper than root).
  const prefix = segments.length > 2 ? '~/' : '';
  return prefix + tail.join('/');
}
