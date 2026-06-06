// RENDERER ONLY — the dormant-session placeholder card (05-03, D-04).
//
// Rendered in the .terminal-area when the active session is `not_started` (a restored-
// but-not-yet-started session, or a session that has never run). It REPLACES the live
// xterm surface until the user clicks Start, so a dormant session reads as "present but
// asleep" rather than a confusing blank/dead terminal.
//
// TERM-05 BOUNDARY (D-04): the saved startupCommand is DISPLAYED read-only and is NEVER
// written to a PTY. There is no run/copy-as-command affordance — the helper line states
// it is "saved for reference, not run automatically". IdleCard has NO window.api.ptyWrite
// path (grep-enforced in the plan's acceptance criteria, T-05-07).
//
// Start (▶) fires `onStart(session.logicalId)` — SessionManager promotes the dormant id
// via the existing ptyCreate/create({id}) path (Plan 05-02). No new IPC.

import type { LogicalId, SessionRecord } from '../shared/types';
import { STATUS_STYLE } from './status-colors';
import { renderIcon } from './Sidebar';

export interface IdleCardProps {
  /** The dormant (`not_started`/`error`) session whose saved profile this card shows. */
  session: SessionRecord;
  /** Promote the dormant session to live (the Start ▶ path) — SessionManager owns the spawn. */
  onStart: (id: LogicalId) => void;
}

export function IdleCard({ session, onStart }: IdleCardProps): React.JSX.Element {
  const style = STATUS_STYLE[session.status];
  const startup = session.startupCommand ?? '';

  return (
    <div className="idle-card-stage">
      <div className="idle-card" data-testid="idle-card">
        {/* Identity region (reuses the shipped renderIcon + .status-badge chain so the
            dormant card reads consistently with the sidebar row + identity header). */}
        <div className="idle-card-identity">
          {renderIcon(session.icon, session.name)}
          <span className="idle-card-name">{session.name}</span>
          <span
            className="status-badge"
            style={{ '--accent': style.accent } as React.CSSProperties}
            title={style.label}
          >
            <span className="status-dot" />
            {style.label}
          </span>
        </div>

        {/* Config region — a recessed --bg-sunk block of read-only label+value pairs.
            Values render in JetBrains Mono so they read as literal paths/commands. */}
        <div className="idle-card-config">
          <div className="idle-card-row">
            <span className="idle-card-label">Working directory</span>
            <span className="idle-card-value">{session.cwd}</span>
          </div>
          <div className="idle-card-row">
            <span className="idle-card-label">Shell</span>
            <span className="idle-card-value">{session.shell}</span>
          </div>
          <div className="idle-card-row">
            <span className="idle-card-label">Startup command</span>
            {startup.length > 0 ? (
              <>
                {/* DISPLAYED, never executed (TERM-05 boundary cue): a leading "$ "
                    prompt glyph reads like a terminal line, but it is visually inert
                    — no run button, no copy-as-command. */}
                <span className="idle-card-value idle-card-startup">
                  <span className="idle-card-prompt" aria-hidden="true">
                    ${' '}
                  </span>
                  {startup}
                </span>
                <span className="idle-card-helper">
                  Saved for reference — not run automatically. Start the session,
                  then launch it yourself.
                </span>
              </>
            ) : (
              <span className="idle-card-value idle-card-empty">
                No startup command saved
              </span>
            )}
          </div>
        </div>

        {/* Error-after-start inline line (D-04 / UI-SPEC Copywriting): the card stays
            visible if a Start fails; the row status flips to 'error'. */}
        {session.status === 'error' && (
          <p className="idle-card-error" data-testid="idle-card-error">
            Couldn&apos;t start — check the shell and working directory, then try
            Start again.
          </p>
        )}

        {/* In-card launch point (second to the sidebar ▶). Fires the promote path. */}
        <button
          type="button"
          className="idle-start-button"
          data-testid="idle-start-session"
          onClick={() => onStart(session.logicalId)}
        >
          <span aria-hidden="true">▶</span> Start session
        </button>
      </div>
    </div>
  );
}
