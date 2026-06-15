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
import { validateSessionForm } from './validate-session-form';

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
  /**
   * The active row's main-side rejection notice (from onPtyStatus → applyStatusEvent,
   * carried on row.errorMessage). When it matches the CR-01 cwd-rejection shape
   * ('Working directory not found…'), it renders INLINE under the cwd field in the
   * danger ramp (D-04). NOT a new IPC — it reuses the existing onPtyStatus path.
   */
  errorMessage?: string;
  onCancel: () => void;
}

export function SessionEditModal({
  open,
  session,
  onSaveLive,
  onSaveProfile,
  errorMessage,
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
    // When discovery has resolved, the <select>'s DOM value is authoritative — it
    // reflects either the matched saved shell or shells[0] if the saved shell is no
    // longer present in the discovered list. While discovery is in-flight
    // (shells === null), keep the saved shell unchanged so saving before discovery
    // lands does not overwrite the persisted shell with a placeholder label.
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

  // D-04 inline validation — renderer-cheap NEUTRAL hints from the pure reducer
  // (empty name → "keeps current name"; non-absolute cwd → format hint). Main's CR-01
  // stays the validator of record; these are convenience-only. The notices are
  // computed from the live React state (controlled inputs keep them in sync).
  const notices = validateSessionForm({ name, cwd, startupCommand });
  const nameNotice = notices.name;
  // The cwd row shows EITHER main's genuine rejection (error ramp) when it matches the
  // CR-01 'Working directory not found' shape, OR the neutral format hint — never both
  // (a real rejection outranks the local format guess). The error string is main's
  // already-sanitized notice; rendered as a React text node (auto-escaped), no HTML.
  const cwdRejected =
    typeof errorMessage === 'string' &&
    errorMessage.startsWith('Working directory not found');
  const cwdNotice = cwdRejected
    ? { tone: 'error' as const, message: 'Working directory not found' }
    : notices.cwd;

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

        {/* Group A — IDENTITY (applies LIVE: name/icon, no respawn — D-02). */}
        <div className="edit-group edit-group-identity">
          <p className="edit-group-subhead">Identity</p>

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
            {/* Empty name → neutral "keeps current name" hint (D-04 — a valid choice,
                never the danger ramp). */}
            {nameNotice && (
              <span
                className={`edit-field-notice edit-field-notice--${nameNotice.tone}`}
              >
                {nameNotice.message}
              </span>
            )}
          </div>

          <div className="edit-field">
            <span className="edit-label">Icon</span>
            <IconPicker value={icon} name={name} onChange={setIcon} />
          </div>
        </div>

        {/* Hairline divider between the Identity and Launch groups (D-02). */}
        <hr className="edit-group-divider" />

        {/* Group B — LAUNCH (persists to main, applies on the NEXT restart — D-02).
            The existing restart-hint testid/copy is REUSED as this group's subhead. */}
        <div className="edit-restart-group">
          <p className="applies-on-restart-hint" data-testid="applies-on-restart">
            Launch · Applies on restart
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
            {/* Inline validation under cwd (D-04): main's CR-01 'Working directory not
                found' rejection in the danger ramp, OR the neutral non-absolute format
                hint. Calm by default; red only on a genuine rejection. */}
            {cwdNotice && (
              <span
                className={`edit-field-notice edit-field-notice--${cwdNotice.tone}`}
              >
                {cwdNotice.message}
              </span>
            )}
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
          {/* Save is the CONSTRUCTIVE accent-blue primary (D-04 Pitfall 1: the blue
              save ramp, NOT the destructive red confirm ramp). It still carries the
              menu-item class so the WDIO driver's text-addressed menu click activates
              it. The save data-testid is UNCHANGED; only the visible label is promoted
              for a clearer constructive verb-noun. */}
          <button
            type="button"
            className="modal-btn modal-btn-save context-menu-item"
            data-testid="edit-save"
            onClick={handleSave}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
