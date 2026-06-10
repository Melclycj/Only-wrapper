// RENDERER ONLY — the gear-launched Preferences shell (07-03, TERM-11 / SC2 / D-08).
//
// Cloned from ConfirmModal's overlay/dialog/Esc/focus-on-open a11y skeleton (NOT a
// generalization of ConfirmModal — the two stay separate per 07-PATTERNS §Modal Idiom).
// It is an EXTENSIBLE shell: the body is a `.prefs-body` vertical stack of `.edit-field`
// groups, one per setting (D-08). Today it hosts a single setting — scrollback — but a
// future setting drops in by appending another `.edit-field` group, no rewrite (D-08).
//
// Apply model (07-UI-SPEC §2, default — Claude's Discretion): LIVE-APPLY-ON-COMMIT. The
// scrollback input commits on change (snapped through the pure renderer clampScrollback)
// so the value fans out to open terminals immediately (SC2 / D-05) and persists via the
// validated persistUiState path — there is no Save/Cancel split, just a single "Done"
// dismiss. Saving a preference is constructive, so there is NO destructive (red) styling
// anywhere on this surface (07-UI-SPEC §Color).
//
// HARD RULE (CLAUDE.md): renderer never touches disk — the value goes to main through
// onScrollbackChange → SessionManager.handleSetScrollback → window.api.persistUiState
// (validated/clamped in main). This component only reads the prop + reports a clamped change.

import { useEffect, useId, useRef } from 'react';
import { clampScrollback, SCROLLBACK_DEFAULT } from './scrollback-clamp';

export interface PreferencesModalProps {
  /** Whether the Preferences modal is open (controlled by SessionManager). */
  open: boolean;
  /** Dismiss the modal (overlay/scrim click, Esc, or the "Done" button). */
  onClose: () => void;
  /** The current global scrollback value (D-04 default 5000), shown in the input. */
  scrollback: number;
  /**
   * Commit a new scrollback value. The caller (SessionManager.handleSetScrollback) clamps
   * again, fans the value out to every live term (D-05), and persists it (persistUiState).
   * We pass an already-clamped value so the input never commits out of range.
   */
  onScrollbackChange: (n: number) => void;
}

export function PreferencesModal({
  open,
  onClose,
  scrollback,
  onScrollbackChange,
}: PreferencesModalProps): React.JSX.Element | null {
  const titleId = useId();
  const helpId = useId();
  // Focus the scrollback input when the modal opens (mirrors SessionEditModal's
  // focus-on-open). The field is the primary affordance, so it takes initial focus.
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Live-apply-on-commit: snap the raw typed value through the pure renderer clamp before
  // reporting it up (the input is never left invalid — an out-of-range value snaps to the
  // nearest bound). The displayed value falls back to the D-04 default if the prop is unset.
  const commit = (raw: string): void => {
    onScrollbackChange(clampScrollback(Number(raw)));
  };

  return (
    <div className="modal-overlay" data-testid="preferences-modal" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="modal-title">
          Preferences
        </h2>
        {/* Extensible settings stack (D-08): one .edit-field group per setting. Append
            another group here to add a future preference — no layout rewrite needed. */}
        <div className="prefs-body">
          <div className="edit-field">
            <label className="edit-label" htmlFor="pref-scrollback-input">
              Scrollback lines
            </label>
            <input
              ref={inputRef}
              id="pref-scrollback-input"
              className="edit-input"
              data-testid="pref-scrollback"
              type="number"
              min={1000}
              max={50000}
              step={1000}
              aria-describedby={helpId}
              defaultValue={
                typeof scrollback === 'number' ? scrollback : SCROLLBACK_DEFAULT
              }
              // Live-apply on commit (change), so open terminals update right away (D-05).
              onChange={(e) => commit(e.target.value)}
              // Re-snap on blur so a partial/out-of-range entry resolves to the clamped
              // bound and the displayed value reflects what was applied.
              onBlur={(e) => {
                const clamped = clampScrollback(Number(e.target.value));
                e.target.value = String(clamped);
                onScrollbackChange(clamped);
              }}
            />
            <p id={helpId} className="idle-card-helper">
              How many lines of history each terminal keeps. Between 1,000 and 50,000.
              <br />
              Changes apply right away — to open terminals and new ones.
            </p>
          </div>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn-cancel"
            data-testid="preferences-done"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
