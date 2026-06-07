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
  /**
   * SC2 (D-05): the specific spawn-error message captured from the onPtyStatus notice
   * ('Working directory not found: <path>' or 'Couldn't start session: <reason>').
   * Rendered in the JetBrains-Mono `.idle-card-value` role for the `error` branch so
   * the failing path reads as a literal. Undefined for the dormant (not_started) branch.
   */
  errorMessage?: string;
  /** Error-card Edit (D-04): open the edit modal to fix cwd/shell. */
  onEdit?: (id: LogicalId) => void;
  /** Error-card Retry (D-04): re-attempt the spawn via the existing Start path. */
  onRetry?: (id: LogicalId) => void;
}

export function IdleCard({
  session,
  onStart,
  errorMessage,
  onEdit,
  onRetry,
}: IdleCardProps): React.JSX.Element {
  const style = STATUS_STYLE[session.status];
  const startup = session.startupCommand ?? '';
  const isError = session.status === 'error';

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

        {/* SC2 error card (D-03/D-04 / UI-SPEC §Interaction 2): when a Start fails the
            row flips to 'error' and the card stays visible (not a blank/dead terminal).
            The specific message renders in the JetBrains-Mono .idle-card-value role so
            the failing path reads as a literal; below it a helper line names the fix,
            then a two-button recovery row (Edit → fix cwd/shell, Retry → re-spawn). */}
        {isError && (
          <>
            <p
              className="idle-card-value idle-card-error"
              data-testid="idle-card-error"
            >
              {errorMessage ??
                "Couldn't start session — check the working directory and shell."}
            </p>
            <p className="idle-card-helper">
              Check the working directory and shell, then fix them or try again.
            </p>
          </>
        )}

        {/* Action row. For the error branch: Edit (neutral) + Retry (primary blue).
            For the dormant branch: the single Start button. */}
        {isError ? (
          <div className="idle-card-actions">
            <button
              type="button"
              className="idle-card-edit-button"
              data-testid="error-card-edit"
              onClick={() => onEdit?.(session.logicalId)}
            >
              Edit
            </button>
            <button
              type="button"
              className="idle-start-button"
              data-testid="error-card-retry"
              onClick={() => onRetry?.(session.logicalId)}
            >
              Retry
            </button>
          </div>
        ) : (
          /* In-card launch point (second to the sidebar ▶). Fires the promote path. */
          <button
            type="button"
            className="idle-start-button"
            data-testid="idle-start-session"
            onClick={() => onStart(session.logicalId)}
          >
            <span aria-hidden="true">▶</span> Start session
          </button>
        )}
      </div>
    </div>
  );
}
