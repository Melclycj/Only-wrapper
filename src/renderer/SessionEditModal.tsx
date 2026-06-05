// RENDERER ONLY — the session create/EDIT form modal (04-02, D-04 / D-02).
//
// D-01: there is NO create-first path — "+ Add session" still instant-spawns a live
// session (session-add.ts). This is an EDIT form that customizes an already-spawned
// session. D-04: it is a MODAL dialog that REUSES the ConfirmModal overlay/scrim/Esc/
// focus-on-open a11y skeleton (we copy the skeleton; we do NOT generalize ConfirmModal).
//
// Field split (D-02), computed by the pure splitEdit reducer:
//   - name + icon apply LIVE (onSaveLive) — no respawn, logicalId preserved (SESS-04).
//   - cwd / shell / startupCommand persist to main (onSaveProfile) under a visible
//     "Applies on restart" hint; they take effect on the NEXT restart.
// The shell field is PRE-FILLED from the session record's resolved shell (D-06 — the
// value comes from main; the renderer never recomputes it). Empty name keeps the
// existing name (Claude's-discretion empty-state).

import { useEffect, useId, useRef, useState } from 'react';
import type { SessionIconSpec, SessionRecord } from '../shared/types';
import { IconPicker } from './IconPicker';
import { splitEdit } from './session-edit';

export interface SessionEditModalProps {
  open: boolean;
  /** The session being edited (its current fields seed the form). */
  session: SessionRecord | null;
  /** Apply name/icon LIVE (no respawn, same logicalId). */
  onSaveLive: (name: string, icon: SessionIconSpec) => void;
  /** Persist restart-applied fields to main (applies on the next restart). */
  onSaveProfile: (fields: {
    cwd: string;
    shell: string;
    startupCommand: string;
  }) => void;
  onCancel: () => void;
}

export function SessionEditModal({
  open,
  session,
  onSaveLive,
  onSaveProfile,
  onCancel,
}: SessionEditModalProps): React.JSX.Element | null {
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  // Local form state seeded from the session each time the modal opens for a target.
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<SessionIconSpec>({
    type: 'emoji',
    value: '🖥️',
  });
  const [cwd, setCwd] = useState('');
  const [shell, setShell] = useState('');
  const [startupCommand, setStartupCommand] = useState('');

  // Re-seed the form whenever a (new) target session opens — mirrors how the value
  // comes from main's record (D-06: shell is pre-filled, never recomputed here).
  useEffect(() => {
    if (!open || session === null) return;
    setName(session.name);
    setIcon(session.icon);
    setCwd(session.cwd);
    setShell(session.shell);
    setStartupCommand(session.startupCommand ?? '');
  }, [open, session]);

  // Focus the first field on open + wire Esc=cancel (ConfirmModal skeleton).
  useEffect(() => {
    if (!open) return;
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || session === null) return null;

  const handleSave = (): void => {
    // Empty name -> keep the existing name (D-02 discretion).
    const effectiveName = name.trim().length > 0 ? name : session.name;
    const { live, restart } = splitEdit({
      name: effectiveName,
      icon,
      cwd,
      shell,
      startupCommand,
    });
    onSaveLive(live.name, live.icon);
    onSaveProfile(restart);
  };

  return (
    <div className="modal-overlay" data-testid="session-edit-modal" onClick={onCancel}>
      <div
        className="modal-dialog modal-dialog-edit"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="modal-title">
          Edit session
        </h2>

        <div className="edit-field">
          <label className="edit-label" htmlFor={`${titleId}-name`}>
            Name
          </label>
          <input
            id={`${titleId}-name`}
            ref={nameRef}
            type="text"
            className="edit-input"
            data-testid="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="edit-field">
          <span className="edit-label">Icon</span>
          <IconPicker value={icon} name={name} onChange={setIcon} />
        </div>

        <div className="edit-restart-group">
          <p className="applies-on-restart-hint" data-testid="applies-on-restart">
            Applies on restart
          </p>

          <div className="edit-field">
            <label className="edit-label" htmlFor={`${titleId}-cwd`}>
              Working directory
            </label>
            <input
              id={`${titleId}-cwd`}
              type="text"
              className="edit-input"
              data-testid="edit-cwd"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
            />
          </div>

          <div className="edit-field">
            <label className="edit-label" htmlFor={`${titleId}-shell`}>
              Shell
            </label>
            <input
              id={`${titleId}-shell`}
              type="text"
              className="edit-input"
              data-testid="edit-shell"
              value={shell}
              onChange={(e) => setShell(e.target.value)}
            />
          </div>

          <div className="edit-field">
            <label className="edit-label" htmlFor={`${titleId}-startup`}>
              Startup command
            </label>
            <input
              id={`${titleId}-startup`}
              type="text"
              className="edit-input"
              data-testid="edit-startup"
              value={startupCommand}
              onChange={(e) => setStartupCommand(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn-cancel"
            data-testid="edit-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          {/* The Save button also carries `.context-menu-item` so the WDIO driver's
              clickMenuItem('Save') (which addresses `.context-menu-item` by text)
              activates it — the smoke test reuses that single click contract. */}
          <button
            type="button"
            className="modal-btn modal-btn-confirm context-menu-item"
            data-testid="edit-save"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
