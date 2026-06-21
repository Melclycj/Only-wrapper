// RENDERER ONLY — the "Restart to apply?" prompt (12-06, GAP-12-B).
//
// A dedicated, dumb controlled modal that COPIES the ConfirmModal skeleton (overlay/scrim/
// Esc/focus-on-open a11y) WITHOUT generalizing ConfirmModal — the copy + ramp differ: this
// is a CONSTRUCTIVE action (Restart now → accent-blue .modal-btn-save), not a destructive
// red confirm. It appears after a Save that changed a LIVE session's launch fields
// (cwd/shell/startupCommand); "Restart now" applies them via the retained ptyRestart,
// "Later" dismisses (the values still persist for the next Start).
//
// Accessibility: role="dialog" + aria-modal + aria-labelledby; Esc and a real backdrop
// click both = Later (dismiss); the primary "Restart now" button auto-focuses on open.

import { useEffect, useId, useRef } from 'react';
import { useFocusTrap } from './use-focus-trap';

export interface RestartApplyPromptProps {
  open: boolean;
  /** The live session's name, woven into the body copy. */
  sessionName: string;
  /** data-testid for the constructive "Restart now" primary (caller owns the literal). */
  confirmTestId: string;
  /** data-testid for the quiet "Later" dismiss. */
  cancelTestId: string;
  /** Restart now — apply the saved launch fields via ptyRestart. */
  onConfirm: () => void;
  /** Later — dismiss without restarting (values persist for the next Start). */
  onCancel: () => void;
}

export function RestartApplyPrompt({
  open,
  sessionName,
  confirmTestId,
  cancelTestId,
  onConfirm,
  onCancel,
}: RestartApplyPromptProps): React.JSX.Element | null {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  // P0-D: trap Tab inside the dialog + restore focus to the opener on close. Declared
  // BEFORE the focus effect below so the modal's deliberate "Restart now" focus wins.
  const dialogRef = useFocusTrap(open);
  // DESIGN-AUDIT wave-2 #7: only a genuine backdrop click (mousedown AND click both on the
  // overlay) = Later, so a selection-drag overshoot ending on the scrim does not dismiss.
  const overlayMouseDownRef = useRef(false);

  // Focus the constructive primary on open + wire Esc = Later (dismiss).
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      data-testid="restart-apply-prompt"
      // Backdrop (scrim) click = Later, guarded by the mousedown-origin check so a
      // selection-drag overshoot ending on the scrim does not dismiss (DESIGN-AUDIT #7).
      onMouseDown={(e) => {
        overlayMouseDownRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (overlayMouseDownRef.current && e.target === e.currentTarget)
          onCancel();
        overlayMouseDownRef.current = false;
      }}
    >
      <div
        ref={dialogRef}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="modal-title">
          Restart to apply?
        </h2>
        <p className="modal-body">
          “{sessionName}” is running. Restart it now to apply the new working
          directory, shell, and startup command? Your scrollback is kept.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn-cancel"
            data-testid={cancelTestId}
            onClick={onCancel}
          >
            Later
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="modal-btn modal-btn-save"
            data-testid={confirmTestId}
            onClick={onConfirm}
          >
            Restart now
          </button>
        </div>
      </div>
    </div>
  );
}
