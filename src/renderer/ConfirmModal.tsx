// RENDERER ONLY — a DESIGN.md-styled confirm modal (03-03 gap-closure, D-03a).
//
// Used by the destructive Close flow: closing a session kills its PTY and removes
// it permanently, so the user confirms first. Styled ENTIRELY from DESIGN.md tokens
// (warm --surface card, --radius 18px, --line border, Nunito UI font); the confirm
// button uses the derived red accent oklch(0.58 0.16 25) — consistent with the
// status-colors error ramp — while Cancel stays neutral.
//
// Accessibility: role="dialog" + aria-modal, aria-labelledby the title; Esc and an
// overlay (scrim) click both cancel; the confirm button auto-focuses on open. No
// React state of its own — it is a controlled component (open + callbacks as props).

import { useEffect, useId, useRef } from 'react';
import { useFocusTrap } from './use-focus-trap';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  /** DESIGN-AUDIT wave-4 (P1 #6): 'danger-strong' makes the PERMANENT Delete one notch
   * heavier than the reversible Remove (default 'danger'). Purely presentational. */
  confirmVariant?: 'danger' | 'danger-strong';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps): React.JSX.Element | null {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  // P0-D: trap Tab inside the dialog + restore focus to the opener on close. Declared
  // BEFORE the focus effect below so the hook's first-focusable focus runs first and the
  // modal's deliberate confirm-button focus (a destructive-action safety choice) wins.
  const dialogRef = useFocusTrap(open);
  // GAP-12-D parity (DESIGN-AUDIT wave-2 #7): only a genuine backdrop click — mousedown
  // AND click both on the overlay itself — cancels, so a text-selection drag that starts
  // inside the dialog and ends on the scrim no longer dismisses (matches SessionEditModal).
  const overlayMouseDownRef = useRef(false);

  // Focus the (destructive) confirm button when the modal opens, and wire Esc=cancel.
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
      data-testid="confirm-modal"
      // Overlay (scrim) click = cancel, guarded by the mousedown-origin check below so a
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
          {title}
        </h2>
        <p className="modal-body">{body}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn-cancel"
            data-testid="confirm-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={
              'modal-btn modal-btn-confirm' +
              (confirmVariant === 'danger-strong'
                ? ' modal-btn-confirm-strong'
                : '')
            }
            data-testid="confirm-close"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
