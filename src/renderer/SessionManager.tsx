// RENDERER ONLY — the multi-session container (03-02, TERM-06 / TERM-08 display).
//
// SessionManager owns the renderer-side session list (`sessions: SessionRecord[]`)
// and the `activeId`. It is the SOLE OWNER of the `window.api.ptyCreate` spawn call
// (T-03-09): every add issues EXACTLY ONE ptyCreate, then appends a SessionRecord
// keyed by the returned id. The SessionViews it renders are CONTROLLED views — they
// receive their resolved id as a prop and bind to the already-spawned PTY; they
// never spawn. This guarantees exactly one PTY per session (no orphan, no double-spawn).
//
// Layout (DESIGN.md §"IdeLayout", basic tier): a <Sidebar> (icon + name + live
// status badge, click-to-switch, add-session button) + a .viewport-stack that
// keeps ALL <SessionView>s mounted (so hidden sessions keep buffering — SC1/SC2)
// and toggles which one is active.
//
// Status (TERM-08, SC4): per-session window.api.onPtyStatus subscriptions push every
// transition into state so the badge stays live — never a stale one-time poll.
//
// HARD RULE (CLAUDE.md / D-06): renderer NEVER imports electron/node-pty; the only
// bridge to main is window.api.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogicalId, SessionIconSpec, SessionRecord } from '../shared/types';
import { SessionView } from './SessionView';
import { Sidebar } from './Sidebar';
import { ConfirmModal } from './ConfirmModal';
import { ContextMenu } from './ContextMenu';
import { SessionEditModal } from './SessionEditModal';
import { IdentityHeader } from './IdentityHeader';
// addSession is the SOLE spawn path (T-03-09) — kept in a React/xterm-free module
// so the no-double-spawn invariant is unit-testable in the Node env.
import { addSession } from './session-add';
// closeSession is the PURE close reducer (D-03a) — kept React/xterm-free so the
// "remove that row + reselect active" invariant is unit-testable in the Node env.
import { closeSession } from './session-close';
// resolveSwitch is the PURE switch reducer (04-01, NAV-05) — (sessions, activeId,
// intent) → next activeId. The keyboard chords are intercepted MAIN-side
// (before-input-event, 04-03 Task 1) and pushed over window.api.onSwitchSession.
import { resolveSwitch } from './session-switch';

// How often the renderer reconciles its rendered session list against main's
// authoritative listSessions() snapshot. Main is the source of truth, so a session
// created OUTSIDE onAdd (e.g. a future Phase-5 persisted-snapshot restore) gets a
// controlled pane shortly after it appears in main's record store.
const RECONCILE_MS = 100;

export function SessionManager(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeId, setActiveId] = useState<LogicalId | null>(null);
  // The session pending a destructive Close (D-03a). Non-null → the confirm modal
  // is open for that id; null → no modal. Set by handleCloseRequest, cleared by
  // confirmClose/cancelClose.
  const [closingId, setClosingId] = useState<LogicalId | null>(null);
  // The session whose EDIT form modal is open (D-04). Non-null → SessionEditModal is
  // open for that id; null → closed. Hosted exactly like `closingId`.
  const [editingId, setEditingId] = useState<LogicalId | null>(null);
  // The open right-click context menu (D-03): the target id + viewport coords, or null.
  const [menuState, setMenuState] = useState<{
    id: LogicalId;
    x: number;
    y: number;
  } | null>(null);
  // Sidebar collapsed/expanded (D-10/D-11): a pinned chevron folds the rail to icon-only
  // and back. Component-local — the state stays where the user leaves it; PERSISTENCE
  // across app restarts is Phase 5 (D-11), so this is intentionally NOT mirrored to main.
  const [collapsed, setCollapsed] = useState(false);

  // Guards the boot effect so a fast double-mount (React StrictMode dev) does not
  // auto-add two default sessions.
  const bootedRef = useRef(false);

  // Live mirror of the current sessions list for the keyboard-switch subscription.
  // The onSwitchSession effect subscribes ONCE (it must not re-bind on every sessions
  // change, or a chord could race a listener teardown), so it reads the up-to-date
  // list through this ref instead of closing over the render-time `sessions` value.
  const sessionsRef = useRef<SessionRecord[]>(sessions);
  sessionsRef.current = sessions;

  // ── Close control (D-03a, supersedes the old keep-as-stopped Stop): a destructive
  //    close behind a confirm modal. NOTE: window.api.ptyStop + PtyManager.stop are
  //    RETAINED per D-03a ("keep the function, disable the button") and stay unit-
  //    tested, but are intentionally NOT surfaced as a UI control here. The Close flow
  //    instead calls window.api.ptyClose (kill PTY + remove the SessionRecord).
  //
  //    handleCloseRequest opens the modal; confirmClose performs the close; cancelClose
  //    dismisses it. ──
  const handleCloseRequest = useCallback((id: LogicalId) => {
    setClosingId(id);
  }, []);

  const cancelClose = useCallback(() => {
    setClosingId(null);
  }, []);

  const confirmClose = useCallback(() => {
    if (closingId === null) return;
    const id = closingId;
    // Side effect: main kills the PTY AND deletes the record (close+remove). Because
    // the record is gone from main, the reconcile poll (which only ADDS ids present in
    // listSessions() but missing from state) will NOT re-add this row.
    window.api.ptyClose(id);
    // Pure reducer: drop the row + reselect a valid active id (or null when empty).
    setSessions((prev) => {
      const result = closeSession(prev, activeId, id);
      setActiveId(result.activeId);
      return result.sessions;
    });
    setClosingId(null);
  }, [closingId, activeId]);

  // ── Restart control (TERM-07 / SC3, IDENT-02): request-response. Main orchestrates
  //    stop → await-exit → respawn under the SAME logicalId, returning the NEW
  //    {id, pid} (same logicalId, new ptyPid). The kept SessionView for that id keeps
  //    its xterm instance (scrollback preserved) and writes the '— restarted HH:MM —'
  //    separator on the resulting fresh 'running' status (hasRunBefore seam). We thread
  //    the new ptyPid into the row so the record mirrors main's source of truth. ──
  const handleRestart = useCallback((id: LogicalId) => {
    void (async () => {
      const { pid } = await window.api.ptyRestart(id);
      setSessions((prev) =>
        prev.map((row) =>
          row.logicalId === id
            ? { ...row, ptyPid: pid, status: 'running' }
            : row,
        ),
      );
    })();
  }, []);

  // ── Context menu (D-03): right-click a row → open the menu at the cursor. ──
  const handleContextMenu = useCallback(
    (id: LogicalId, x: number, y: number) => {
      setMenuState({ id, x, y });
    },
    [],
  );

  const closeMenu = useCallback(() => setMenuState(null), []);

  // ── Edit (D-04): open the create/edit form modal for a session. ──
  const handleEdit = useCallback((id: LogicalId) => {
    setEditingId(id);
  }, []);

  const cancelEdit = useCallback(() => setEditingId(null), []);

  // ── Live edit half (D-02): name/icon apply IMMEDIATELY without a respawn. We map
  //    the row in place (NEVER mint a new logicalId — SESS-04/IDENT-02) AND mirror the
  //    name/icon to main via ptyUpdateProfile so a later restart/reconcile that
  //    rebuilds the record from main's fields does NOT revert the live edit (Pitfall 4). ──
  const handleSaveLive = useCallback(
    (id: LogicalId, name: string, icon: SessionIconSpec) => {
      setSessions((prev) =>
        prev.map((row) =>
          row.logicalId === id ? { ...row, name, icon } : row,
        ),
      );
      window.api.ptyUpdateProfile(id, { name, icon });
    },
    [],
  );

  // ── Restart edit half (D-02): cwd/shell/startupCommand persist to main and take
  //    effect on the NEXT restart (no live respawn here). ──
  const handleSaveProfile = useCallback(
    (
      id: LogicalId,
      fields: { cwd: string; shell: string; startupCommand: string },
    ) => {
      window.api.ptyUpdateProfile(id, fields);
    },
    [],
  );

  // ── Add: the SOLE ptyCreate spawn path (T-03-09). One spawn per add. ──
  const onAdd = useCallback(() => {
    void (async () => {
      // existingCount is read from state at call time via the functional update
      // below so concurrent adds index correctly; addSession spawns exactly once.
      let count = 0;
      setSessions((prev) => {
        count = prev.length;
        return prev;
      });
      const record = await addSession(count, (opts) =>
        window.api.ptyCreate(opts),
      );
      setSessions((prev) => [...prev, record]);
      setActiveId(record.logicalId);
    })();
  }, []);

  // ── Boot: hydrate from main (source of truth — RESEARCH Open Q2); if empty,
  //    auto-add one default session so the app boots into a live terminal. ──
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    void (async () => {
      const existing = await window.api.listSessions();
      if (existing.length > 0) {
        setSessions(existing);
        setActiveId(existing[0].logicalId);
      } else {
        onAdd();
      }
    })();
  }, [onAdd]);

  // ── Live status badges (TERM-08, SC4): subscribe per session; update that
  //    session's status on every transition; clean up all subs on change. ──
  useEffect(() => {
    const offs = sessions.map((s) =>
      window.api.onPtyStatus(s.logicalId, (p) => {
        setSessions((prev) =>
          prev.map((row) =>
            row.logicalId === p.id
              ? { ...row, status: p.status, ptyPid: p.ptyPid ?? row.ptyPid }
              : row,
          ),
        );
      }),
    );
    return () => {
      for (const off of offs) off();
    };
  }, [sessions]);

  // ── Keyboard session switching (NAV-05, D-12/D-13): main intercepts the chords
  //    (before-input-event, 04-03 Task 1) and pushes a SwitchIntent over
  //    window.api.onSwitchSession. We subscribe ONCE (empty deps — no re-bind per
  //    sessions change, mirroring the onPtyStatus sub's cleanup discipline) and read
  //    the current list via sessionsRef inside the functional setActiveId update so the
  //    callback is stable yet never stale. Applying resolveSwitch → setActiveId drives
  //    the SAME non-destructive switch path as a click (TERM-06 / NAV-03): the
  //    SessionView activate effect hands WebGL+focus to the new pane, the previously
  //    active session keeps running, and the identity header (which reads the active
  //    record by activeId) updates immediately. D-14: SWITCH intents only — no new/close. ──
  useEffect(() => {
    const off = window.api.onSwitchSession((intent) => {
      setActiveId((cur) => resolveSwitch(sessionsRef.current, cur, intent));
    });
    return off;
  }, []);

  // ── Reconcile with main (source of truth — RESEARCH Open Q2 / Pitfall 5). ──
  // The renderer's onAdd is the normal spawn path, but a session can also be created
  // OUTSIDE it — main owns the authoritative record store (e.g. a future Phase-5
  // persisted-snapshot restore populates listSessions() without going through onAdd).
  // Such a session lands in main's listSessions() but has no rendered SessionView. We
  // mirror main here: poll listSessions() and merge any id we don't yet render, so the
  // session gets a controlled pane. Existing rows are NOT clobbered — live status comes
  // from the onPtyStatus subscription; we only ADD ids we're missing (and adopt the
  // first as active if we have none yet). Phase 5 replaces this poll with the persisted
  // snapshot.
  useEffect(() => {
    let cancelled = false;
    const reconcile = async (): Promise<void> => {
      const snapshot = await window.api.listSessions();
      if (cancelled) return;
      setSessions((prev) => {
        const known = new Set(prev.map((s) => s.logicalId));
        const additions = snapshot.filter((s) => !known.has(s.logicalId));
        if (additions.length === 0) return prev;
        const next = [...prev, ...additions];
        if (activeId === null && next.length > 0) {
          setActiveId(next[0].logicalId);
        }
        return next;
      });
    };
    const timer = setInterval(() => void reconcile(), RECONCILE_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeId]);

  const onSelect = useCallback((id: LogicalId) => {
    // Switching is renderer-only visibility — the PTY is untouched (TERM-06). The
    // SessionView activate effect hands WebGL + focus to the newly-active view.
    setActiveId(id);
  }, []);

  // The session targeted by the open confirm modal (if any) — drives the modal copy.
  const closingSession =
    closingId !== null
      ? (sessions.find((s) => s.logicalId === closingId) ?? null)
      : null;
  const closingIsRunning = closingSession?.status === 'running';

  // The active session record (drives the identity header — D-05).
  const activeRecord =
    activeId !== null
      ? (sessions.find((s) => s.logicalId === activeId) ?? null)
      : null;

  // The session targeted by the open edit modal (if any) — seeds the form fields.
  const editingSession =
    editingId !== null
      ? (sessions.find((s) => s.logicalId === editingId) ?? null)
      : null;

  return (
    <div className="ide-layout">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={onSelect}
        onAdd={onAdd}
        onClose={handleCloseRequest}
        onRestart={handleRestart}
        onContextMenu={handleContextMenu}
        onEdit={handleEdit}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      {/* Flex-column terminal area (RESEARCH Open Q2): the identity header sits above
          the .viewport-stack; SessionView panes keep inset:0 inside the stack. */}
      <div className="terminal-area">
        <IdentityHeader session={activeRecord} />
        <div className="viewport-stack">
          {sessions.map((s) => (
            <SessionView
              key={s.logicalId}
              id={s.logicalId}
              active={s.logicalId === activeId}
            />
          ))}
        </div>
      </div>
      <ConfirmModal
        open={closingSession !== null}
        title={`Close “${closingSession?.name ?? ''}”?`}
        body={
          closingIsRunning
            ? 'This ends its running process and removes the session.'
            : 'This removes the session from the sidebar.'
        }
        confirmLabel="Close"
        onConfirm={confirmClose}
        onCancel={cancelClose}
      />
      {menuState !== null && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          onClose={closeMenu}
          items={[
            { label: 'Edit', onSelect: () => setEditingId(menuState.id) },
            { label: 'Restart', onSelect: () => handleRestart(menuState.id) },
            {
              label: 'Close',
              onSelect: () => handleCloseRequest(menuState.id),
            },
          ]}
        />
      )}
      <SessionEditModal
        open={editingSession !== null}
        session={editingSession}
        onSaveLive={(name, icon) => {
          if (editingId !== null) handleSaveLive(editingId, name, icon);
        }}
        onSaveProfile={(fields) => {
          if (editingId !== null) handleSaveProfile(editingId, fields);
          cancelEdit();
        }}
        onCancel={cancelEdit}
      />
    </div>
  );
}
