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
import type { DiscoveredShell } from '../main/shell-discovery';
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
  const cwdRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLSelectElement>(null);
  const startupRef = useRef<HTMLInputElement>(null);

  // Local form state seeded from the session each time the modal opens for a target.
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<SessionIconSpec>({
    type: 'emoji',
    value: '🖥️',
  });
  const [cwd, setCwd] = useState('');
  const [shell, setShell] = useState('');
  const [startupCommand, setStartupCommand] = useState('');
  // Discovered shells for the dropdown (D-05/SC4). `null` while the discoverShells()
  // IPC is in flight → render a single disabled "Finding shells…" option; on resolve
  // the list populates. The resolved $SHELL is ALWAYS present (main guarantees it —
  // D-05 safety), so the selector is never empty. No free-text path exists (the
  // renderer can no longer submit an arbitrary executable path — security V5/T-05-03).
  const [shells, setShells] = useState<DiscoveredShell[] | null>(null);

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

  // Discover the platform shells when the modal opens (D-05/SC4). The list comes from
  // main (reads /etc/shells + always includes the resolved $SHELL, on-disk-filtered —
  // Plan 05-01); the renderer never recomputes it (D-06). We reset to `null` (in-flight)
  // on each open so the "Finding shells…" option shows until the IPC resolves.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setShells(null);
    void window.api.discoverShells().then((discovered) => {
      if (!cancelled) setShells(discovered);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
    // Read each text field from the live DOM at save time, falling back to React
    // state. Controlled inputs normally keep state and DOM in sync, but a programmatic
    // fill (`input.value = …; dispatchEvent('input')`) can set the DOM value WITHOUT
    // tripping React's onChange tracker — reading the ref captures it regardless, so
    // the form is robust to both real typing and automated fills (the E2E contract).
    const nameValue = nameRef.current?.value ?? name;
    const cwdValue = cwdRef.current?.value ?? cwd;
    // Only trust the <select>'s DOM value once discovery has resolved — while the
    // in-flight "Finding shells…" placeholder is shown the ref reads that label text,
    // so fall back to the seeded `shell` (keeps the saved shell unchanged if the user
    // saves before discovery lands).
    const shellValue =
      shells !== null ? (shellRef.current?.value ?? shell) : shell;
    const startupValue = startupRef.current?.value ?? startupCommand;
    // Empty name -> keep the existing name (D-02 discretion).
    const effectiveName =
      nameValue.trim().length > 0 ? nameValue : session.name;
    const { live, restart } = splitEdit({
      name: effectiveName,
      icon,
      cwd: cwdValue,
      shell: shellValue,
      startupCommand: startupValue,
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
            {/* cwd input + native folder picker (UI-SPEC §Interaction 4). The Browse…
                button opens the native open-directory dialog (main owns it — V12); on a
                chosen path it fills the field, on Cancel (null) the field is unchanged.
                CR-01 still gates the value at save time (main-side, unchanged). */}
            <div className="edit-cwd-row">
              <input
                id={`${titleId}-cwd`}
                ref={cwdRef}
                type="text"
                className="edit-input"
                data-testid="edit-cwd"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
              />
              <button
                type="button"
                className="edit-browse-button"
                data-testid="browse-cwd"
                onClick={() => {
                  void window.api.pickDirectory().then((p) => {
                    if (p) setCwd(p);
                  });
                }}
              >
                Browse…
              </button>
            </div>
          </div>

          <div className="edit-field">
            <label className="edit-label" htmlFor={`${titleId}-shell`}>
              Shell
            </label>
            {shells === null ? (
              // In-flight: a single disabled option until discoverShells() resolves
              // (D-05). The selector is NEVER a free-text field — no arbitrary path
              // can be submitted from the renderer (security V5/T-05-03).
              <select
                id={`${titleId}-shell`}
                ref={shellRef}
                className="edit-select"
                data-testid="edit-shell"
                disabled
              >
                <option>Finding shells…</option>
              </select>
            ) : (
              // Resolved: one <option> per DiscoveredShell. The current record.shell
              // is default-selected when present in the list, else the first entry
              // (the resolved $SHELL, which main always includes — D-05 safety).
              <select
                id={`${titleId}-shell`}
                ref={shellRef}
                className="edit-select"
                data-testid="edit-shell"
                value={
                  shells.some((s) => s.path === shell)
                    ? shell
                    : (shells[0]?.path ?? '')
                }
                onChange={(e) => setShell(e.target.value)}
              >
                {shells.map((s) => (
                  <option key={s.path} value={s.path}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="edit-field">
            <label className="edit-label" htmlFor={`${titleId}-startup`}>
              Startup command
            </label>
            <input
              id={`${titleId}-startup`}
              ref={startupRef}
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
