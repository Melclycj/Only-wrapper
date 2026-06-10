// RENDERER ONLY — the no-sessions welcome / empty state (05-03, D-10).
//
// Shown when `sessions.length === 0` — first-ever launch OR after closing every
// session OR after a corrupt store was recovered to empty (D-10: "surface nothing
// scarier than the empty state"). This REPLACES the old auto-add-a-default-session
// boot behavior: nothing auto-spawns; the user explicitly creates the first session.
//
// The CTA runs the existing quick-add live-spawn path (D-11: new = live) via `onCreate`.

export interface WelcomeEmptyStateProps {
  /** Create the first session — the existing quick-add live-spawn path (D-11). */
  onCreate: () => void;
}

export function WelcomeEmptyState({
  onCreate,
}: WelcomeEmptyStateProps): React.JSX.Element {
  return (
    <div className="welcome-state" data-testid="welcome-empty-state">
      <span className="welcome-glyph" aria-hidden="true">
        🛋️
      </span>
      <h2 className="welcome-heading">Your parlour is quiet</h2>
      <p className="welcome-body">
        No sessions yet. Create one to open a terminal in the folder you choose —
        it&apos;ll be waiting here next time you&apos;re back.
      </p>
      <button
        type="button"
        className="welcome-cta"
        data-testid="welcome-create-session"
        onClick={onCreate}
      >
        Create a session
      </button>
    </div>
  );
}
