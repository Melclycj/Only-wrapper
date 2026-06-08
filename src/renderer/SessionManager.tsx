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
import type { AgentState } from '../shared/agent-state';
import { SessionView } from './SessionView';
import { Sidebar } from './Sidebar';
import { ConfirmModal } from './ConfirmModal';
import { ContextMenu } from './ContextMenu';
import { SessionEditModal } from './SessionEditModal';
import { IdentityHeader } from './IdentityHeader';
import { IdleCard } from './IdleCard';
import { WelcomeEmptyState } from './WelcomeEmptyState';
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
// reorder is the PURE drag-to-reorder reducer (NAV-04/SC3/D-08) — moves a row then
// reindexes order densely 0..n-1. Kept React/dnd-kit-free so the invariant is unit-
// testable in the Node env (session-reorder.test.ts).
import { reorder } from './session-reorder';

/**
 * Renderer-only row shape: the authoritative SessionRecord (main's source of truth)
 * plus a transient `errorMessage` captured from the onPtyStatus `notice` when a spawn
 * fails (SC2/D-03). It is NEVER persisted and NEVER crosses the bridge — it exists only
 * to drive the error card + the sidebar tooltip, so no shared-type / bridge change is
 * needed (Research Open Q2).
 */
// The renderer-only row also carries the agent-state presentation OVERLAY (TERM-09 /
// SC4 — D-06): a transient `agentState` computed in SessionView off the onPtyData
// stream and lifted via onAgentState. Like `errorMessage` it is NEVER persisted and
// NEVER crosses the bridge (D-06 — not a 6th SessionStatus, not an IPC field); it
// drives presentation() on the badges/dots and is cleared when the session leaves
// 'running' (D-07/D-10).
type SessionRow = SessionRecord & {
  errorMessage?: string;
  agentState?: AgentState;
};

export function SessionManager(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
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
  // and back. The toggle now MIRRORS the new value to main via persistUiState (D-12) so
  // collapse survives a restart. Boot defaults to expanded — listSessions() does not
  // carry the ui slot, so we do not over-engineer a boot read here (the persisted
  // collapse + window bounds restore on the MAIN side; D-12 collapse round-trips through
  // the store's debounced write and is honored by the window/lifecycle, not re-read into
  // this renderer-local state).
  const [collapsed, setCollapsed] = useState(false);

  // Toggle the rail AND persist the new collapsed value (D-12). Functional update so the
  // persisted value always matches the next render state.
  const handleToggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      window.api.persistUiState({ collapsed: next });
      return next;
    });
  }, []);

  // Guards the boot effect so a fast double-mount (React StrictMode dev) does not
  // auto-add two default sessions.
  const bootedRef = useRef(false);

  // Live mirror of the current sessions list for the keyboard-switch subscription.
  // The onSwitchSession effect subscribes ONCE (it must not re-bind on every sessions
  // change, or a chord could race a listener teardown), so it reads the up-to-date
  // list through this ref instead of closing over the render-time `sessions` value.
  const sessionsRef = useRef<SessionRow[]>(sessions);
  sessionsRef.current = sessions;

  // ── Remove vs Delete (D-03/D-06, two-bucket lifecycle — supersedes the single
  //    destructive Close). BOTH go behind the SAME confirm modal (T-06.1-14); the verb
  //    differs by where the row lives:
  //
  //      • REMOVE (a live, Working-Area session) → kill the PTY but KEEP the recipe.
  //        - CONFIGURED (the user gave it metadata — D-02): window.api.ptyStop kills the
  //          process; main keeps the configured record (persisted via
  //          listConfiguredSessions) so it restores dormant on the next boot, and we
  //          OPTIMISTICALLY flip the renderer row to `not_started` so it moves to the
  //          Inactive List in THIS session too (the renderer is the presentation
  //          authority between boots; the old reconcile poll is gone). No new bridge key.
  //        - EPHEMERAL (a throwaway +New, never edited): window.api.ptyClose kills + drops
  //          the record entirely — it is gone (never persisted, no Inactive entry).
  //      • DELETE (an Inactive-List, dormant session) → permanent: window.api.ptyClose
  //        removes the record for good (no live PTY to kill — close() drops the dormant
  //        entry and persists the shrink).
  //
  //    `removeMode` distinguishes the two so confirm-time copy + the side effect match.
  //    handleRemoveRequest / handleDeleteRequest open the modal; confirmRemove performs
  //    it; cancelClose dismisses. ──
  const [removeMode, setRemoveMode] = useState<'remove' | 'delete'>('remove');

  const handleCloseRequest = useCallback((id: LogicalId) => {
    setRemoveMode('remove');
    setClosingId(id);
  }, []);

  const handleDeleteRequest = useCallback((id: LogicalId) => {
    setRemoveMode('delete');
    setClosingId(id);
  }, []);

  const cancelClose = useCallback(() => {
    setClosingId(null);
  }, []);

  const confirmClose = useCallback(() => {
    if (closingId === null) return;
    const id = closingId;
    const row = sessions.find((s) => s.logicalId === id) ?? null;
    // DELETE (Inactive-List) OR REMOVE of an ephemeral live session → permanent: main
    // kills any PTY AND drops the record (close+remove). The row vanishes.
    const isConfiguredLive =
      removeMode === 'remove' &&
      row !== null &&
      row.configured === true &&
      row.status !== 'not_started';
    if (isConfiguredLive) {
      // REMOVE a configured live session → kill the PTY (recipe kept). Flip the row to
      // dormant so it lands in the Inactive List immediately (main persists it as a
      // configured record; on the next boot coerceOnLoad restores it not_started).
      window.api.ptyStop(id);
      setSessions((prev) =>
        prev.map((r) =>
          r.logicalId === id
            ? {
                ...r,
                status: 'not_started',
                ptyPid: undefined,
                agentState: undefined,
                errorMessage: undefined,
              }
            : r,
        ),
      );
      // The active session just left the Working Area → its SessionView unmounts and the
      // IdleCard takes over; keep it active so the user sees where it went.
      setClosingId(null);
      return;
    }
    // Permanent removal (Delete, or Remove of an ephemeral/ueditable session): main kills
    // the PTY AND deletes the record. Because the record is gone from main, no reconcile
    // re-adds this row.
    window.api.ptyClose(id);
    setSessions((prev) => {
      const result = closeSession(prev, activeId, id);
      setActiveId(result.activeId);
      return result.sessions;
    });
    setClosingId(null);
  }, [closingId, activeId, sessions, removeMode]);

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

  // ── Clear control (SC5/TERM-12 — D-12): clear the active session's kept-alive
  //    xterm via the handle SessionView registers at window.__sessionTerms[id], calling
  //    term.clear() — drops scrollback, PRESERVES the current prompt line (iTerm/VSCode
  //    Cmd+K semantics). This is a PURE client-side xterm op: it NEVER injects
  //    `clear`/Ctrl+L/\x0c into the PTY (no shell-history pollution, consistent across
  //    shells — D-12 anti-pattern avoided). No-op when the id has no live term (a
  //    dormant/errored session whose SessionView is unmounted has no registered term). ──
  const handleClear = useCallback((id: LogicalId) => {
    const w = window as unknown as {
      __sessionTerms?: Record<string, { clear: () => void }>;
    };
    w.__sessionTerms?.[id]?.clear();
  }, []);

  // ── Start control (D-03/D-11, PERS-02): promote a DORMANT (not_started) restored
  //    session to live. We issue window.api.ptyCreate({ id }) for the dormant id —
  //    main promotes it from the dormantRecords map (Plan 05-02 create({id})), spawning
  //    a fresh PTY under the SAME logicalId reusing the stored cwd/shell (never
  //    re-attaching to a persisted PID — D-01). We optimistically flip the row to
  //    'running' with the returned pid; the onPtyStatus subscription then keeps it live.
  //    Unlike a brand-new session (onAdd), Start does NOT mint a new id or append a row. ──
  const handleStart = useCallback((id: LogicalId) => {
    void (async () => {
      // cols/rows are a sane initial PTY size; SessionView re-fits + ptyResizes on mount.
      const { pid } = await window.api.ptyCreate({ id, cols: 80, rows: 24 });
      // A failed spawn returns pid -1 (SC2): main has ALREADY broadcast status 'error'
      // + the notice over onPtyStatus (captured by the subscription), so do NOT
      // optimistically flip to 'running' — that would clobber the error card. Only a
      // real pty (pid > 0) gets the optimistic running flip; the subscription then
      // keeps it live. On the error path we also clear any stale ptyPid.
      if (pid > 0) {
        setSessions((prev) =>
          prev.map((row) =>
            row.logicalId === id
              ? { ...row, ptyPid: pid, status: 'running', errorMessage: undefined }
              : row,
          ),
        );
      }
    })();
  }, []);

  // ── Start without command (D-14): the same promote/spawn path as handleStart, but
  //    threads skipStartupCommand:true so main spawns a bare shell skipping the TERM-05
  //    auto-run for THIS launch even when a startupCommand is stored. The stored command
  //    is untouched (it runs on the next normal Start). Flows through the existing
  //    ptyCreate bridge shape — no new bridge key (Task 1 made main honor the flag). ──
  const handleStartNoCmd = useCallback((id: LogicalId) => {
    void (async () => {
      const { pid } = await window.api.ptyCreate({
        id,
        cols: 80,
        rows: 24,
        skipStartupCommand: true,
      });
      if (pid > 0) {
        setSessions((prev) =>
          prev.map((row) =>
            row.logicalId === id
              ? { ...row, ptyPid: pid, status: 'running', errorMessage: undefined }
              : row,
          ),
        );
      }
    })();
  }, []);

  // ── Drag-to-reorder (NAV-04/SC3/D-08): the user dropped row `fromId` onto `toId`.
  //    Apply the PURE reorder() reducer for the optimistic local update (move + dense
  //    reindex 0..n-1, Pitfall 6), then persist the new dense order via
  //    window.api.persistOrder([{ id, order }]) — main VALIDATES each entry before any
  //    write (T-05-01) and the write is debounced + SILENT (D-13: no save button, no
  //    spinner, no toast). The next boot's listSessions() snapshot sorts by this order. ──
  const handleReorder = useCallback((fromId: LogicalId, toId: LogicalId) => {
    setSessions((prev) => {
      const next = reorder(prev, fromId, toId);
      window.api.persistOrder(
        next.map((s) => ({ id: s.logicalId, order: s.order })),
      );
      return next;
    });
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
      // D-02: any metadata edit auto-promotes the session to CONFIGURED (main sets
      // configured=true in updateProfile). Mirror that on the renderer row so a later
      // Remove keeps the recipe (→ Inactive List) rather than treating it as ephemeral.
      setSessions((prev) =>
        prev.map((row) =>
          row.logicalId === id ? { ...row, name, icon, configured: true } : row,
        ),
      );
      window.api.ptyUpdateProfile(id, { name, icon });
    },
    [],
  );

  // ── Restart edit half (D-02): cwd/shell/startupCommand persist to main and take
  //    effect on the NEXT restart (no live respawn here). ──
  // Edit-prefill hydration (Research Open Q3): main is the source of truth for the
  // restart-applied fields (cwd/shell/startupCommand) — it VALIDATES/trims them (CR-01
  // + WR-05), so a submitted value may differ from what is actually persisted (an
  // invalid cwd is ignored, whitespace is trimmed). Re-read listSessions() (no new
  // bridge key) and merge the authoritative values back into the matching rows so the
  // next edit-modal open prefills main's truth, not the optimistic local guess. Status
  // and errorMessage are NOT disturbed (those are owned by the onPtyStatus subscription).
  const rehydrateProfiles = useCallback(async () => {
    const authoritative = await window.api.listSessions();
    const byId = new Map(authoritative.map((r) => [r.logicalId, r]));
    setSessions((prev) =>
      prev.map((row) => {
        const truth = byId.get(row.logicalId);
        if (!truth) return row;
        return {
          ...row,
          cwd: truth.cwd,
          shell: truth.shell,
          startupCommand: truth.startupCommand,
          // Carry main's configured truth (D-02 — never downgrade a kept session).
          configured: truth.configured ?? row.configured,
        };
      }),
    );
  }, []);

  const handleSaveProfile = useCallback(
    (
      id: LogicalId,
      fields: { cwd: string; shell: string; startupCommand: string },
    ) => {
      window.api.ptyUpdateProfile(id, fields);
      // D-02: mirror the configured auto-promotion on the renderer row (any edit keeps
      // the session). The cwd/shell/startupCommand values are re-read from main's truth
      // below; here we only need to mark it configured.
      setSessions((prev) =>
        prev.map((row) =>
          row.logicalId === id ? { ...row, configured: true } : row,
        ),
      );
      // Re-read main's truth so the next edit prefills the persisted (validated/trimmed)
      // values rather than the just-submitted optimistic ones (edit-prefill, Open Q3).
      void rehydrateProfiles();
    },
    [rehydrateProfiles],
  );

  // ── Add: the SOLE ptyCreate spawn path (T-03-09). One spawn per add. ──
  //
  // RACE-SAFE naming/order (05-03 Rule 1 fix): two rapid adds must NOT collide on the
  // same `Session N` / order. We spawn EXACTLY ONCE (T-03-09) with a provisional index,
  // then derive the FINAL name + order from `prev.length` inside the functional append
  // so concurrent adds index off the up-to-date list (the old pre-read-then-await
  // captured a stale count — both adds saw length 0 and both became "Session 1" once the
  // auto-spawn boot that masked it was removed).
  const onAdd = useCallback(() => {
    void (async () => {
      const record = await addSession(0, (opts) => window.api.ptyCreate(opts));
      setSessions((prev) => {
        const index = prev.length;
        const placed: SessionRow = {
          ...record,
          name: `Session ${index + 1}`,
          order: index,
        };
        return [...prev, placed];
      });
      setActiveId(record.logicalId);
      // Edit-prefill hydration (Open Q3): pull main's authoritative cwd/shell/
      // startupCommand for the freshly-spawned row so an immediate edit prefills the
      // real resolved values (e.g. the home cwd / resolved shell main computed).
      void rehydrateProfiles();
    })();
  }, [rehydrateProfiles]);

  // ── Boot: one-shot hydrate from main (source of truth). Take a single listSessions()
  //    snapshot, sort by `order`, and focus the FIRST session (D-09). If there are ZERO
  //    sessions we render WelcomeEmptyState (D-10) — we DO NOT auto-spawn a default
  //    session (the old auto-add-on-empty boot is gone; a corrupt-recovered empty store
  //    also lands here, surfacing nothing scarier than the welcome state). The persisted
  //    snapshot replaces the old reconcile poll — restored rows are dormant (not_started)
  //    and become live only via the explicit Start ▶ (handleStart). ──
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    void (async () => {
      const existing = await window.api.listSessions();
      const sorted = [...existing].sort((a, b) => a.order - b.order);
      setSessions(sorted);
      setActiveId(sorted.length > 0 ? sorted[0].logicalId : null);
    })();
  }, []);

  // ── Live status badges (TERM-08, SC4): subscribe per session; update that
  //    session's status on every transition; clean up all subs on change. ──
  useEffect(() => {
    const offs = sessions.map((s) =>
      window.api.onPtyStatus(s.logicalId, (p) => {
        setSessions((prev) =>
          prev.map((row) => {
            if (row.logicalId !== p.id) return row;
            // SC2 (D-03/D-05): capture the spawn-error message from the notice when
            // the transition is to 'error'; clear it on any transition AWAY from
            // 'error' (a successful Retry → 'running' must not leave a stale message).
            const errorMessage =
              p.status === 'error'
                ? (p.notice ?? row.errorMessage)
                : undefined;
            // A notice event carries the CURRENT live status (typically 'running')
            // without being a lifecycle transition — leave agentState alone for it.
            // Otherwise: clear the agent-state overlay on any transition AWAY from
            // 'running' (D-07/D-10) so amber/blue/slate never lingers on a stopped/
            // exited/errored session (SessionView also closes its detector gate).
            const agentState =
              p.notice || p.status === 'running' ? row.agentState : undefined;
            return {
              ...row,
              status: p.status,
              ptyPid: p.ptyPid ?? row.ptyPid,
              errorMessage,
              agentState,
            };
          }),
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
  // The Clear chord (Cmd+K mac / Ctrl+Shift+K win — D-13) rides this SAME channel as a
  // { kind: 'clear' } SwitchIntent variant (Plan 01 — no new bridge key, EXPECTED_API_KEYS
  // stays 19). Branch clear-vs-switch here: a 'clear' intent clears the LIVE active
  // session (read via the setActiveId functional updater so the effect stays bound once
  // and never reads a stale activeId) and does NOT change the active id; every other
  // intent resolves the switch as before.
  useEffect(() => {
    const off = window.api.onSwitchSession((intent) => {
      if (intent.kind === 'clear') {
        setActiveId((cur) => {
          if (cur !== null) handleClear(cur);
          return cur; // Clear never switches the active session.
        });
        return;
      }
      setActiveId((cur) => resolveSwitch(sessionsRef.current, cur, intent));
    });
    return off;
  }, [handleClear]);

  // NOTE (05-03): the old reconcile poll is GONE. Main's persisted snapshot is taken
  // once on boot (above); a restored session lands as a dormant row that the user
  // explicitly Starts (handleStart) — there is no background list-merge to drive.

  const onSelect = useCallback((id: LogicalId) => {
    // Switching is renderer-only visibility — the PTY is untouched (TERM-06). The
    // SessionView activate effect hands WebGL + focus to the newly-active view.
    setActiveId(id);
  }, []);

  // ── Agent-state lift (TERM-09 / SC4 — D-06/D-10): SessionView computes the overlay
  //    state (in-progress / waiting / free) off its onPtyData stream and calls this
  //    on every CHANGE. We store it on the matching row (functional update, mirroring
  //    the onPtyStatus pattern). We accept the value only while the row is 'running'
  //    (D-07) so a late-arriving classification can never resurrect an overlay on a
  //    session that has since stopped/exited. Computed for ALL running sessions (D-10),
  //    so a backgrounded session's amber dot shows in the rail while you work elsewhere. ──
  const handleAgentState = useCallback((id: LogicalId, state: AgentState) => {
    setSessions((prev) =>
      prev.map((row) =>
        row.logicalId === id && row.status === 'running'
          ? { ...row, agentState: state }
          : row,
      ),
    );
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

  // The session targeted by the open context menu — drives the Start/Restart label flip.
  const menuSession =
    menuState !== null
      ? (sessions.find((s) => s.logicalId === menuState.id) ?? null)
      : null;
  const menuIsDormant = menuSession?.status === 'not_started';
  // D-14: "Start without command" is offered on a STARTABLE row (not currently running)
  // that has a saved startupCommand — the primary Start runs the command; this item
  // spawns a bare shell skipping the TERM-05 auto-run for that one launch.
  const menuCanStartNoCmd =
    menuSession !== null &&
    menuSession.status !== 'running' &&
    (menuSession.startupCommand ?? '').trim().length > 0;

  // Whether the active session is dormant (not_started) — render its IdleCard in place
  // of a live xterm (D-04). SessionView is mounted ONLY for sessions that have started
  // (have a live or once-live PTY); a never-started session must NEVER mount SessionView
  // (its mount effect calls ptyResize on a non-existent PTY — Pitfall 4).
  // SC2 (D-03): an 'error' session (a FAILED spawn — pid -1, no live PTY) renders the
  // IdleCard error branch IN PLACE OF a SessionView, exactly like a dormant session
  // (mounting SessionView would bind to a non-existent PTY — Pitfall 4). So both
  // not_started AND error use the card; only genuinely-started sessions get a SessionView.
  const activeIsCard =
    activeRecord?.status === 'not_started' || activeRecord?.status === 'error';
  const startedSessions = sessions.filter(
    (s) => s.status !== 'not_started' && s.status !== 'error',
  );

  // Zero sessions → the welcome / empty state (D-10). Per UI-SPEC §4 the sidebar chrome
  // + collapse toggle MAY remain (it keeps the "+ Add session" affordance live), so we
  // keep the standard layout and render WelcomeEmptyState in the terminal area in place
  // of the viewport-stack. Nothing auto-spawns; the CTA runs the same onAdd live-spawn.
  const isEmpty = sessions.length === 0;

  return (
    <div className="ide-layout">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={onSelect}
        onAdd={onAdd}
        onClose={handleCloseRequest}
        onDelete={handleDeleteRequest}
        onRestart={handleRestart}
        onStart={handleStart}
        onStartNoCmd={handleStartNoCmd}
        onContextMenu={handleContextMenu}
        onEdit={handleEdit}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        onReorder={handleReorder}
      />
      {/* Flex-column terminal area (RESEARCH Open Q2): the identity header sits above
          the .viewport-stack; SessionView panes keep inset:0 inside the stack. When the
          active session is dormant (not_started) we render its IdleCard IN PLACE OF a
          live xterm (D-04) — only started sessions get a SessionView (Pitfall 4). When
          there are zero sessions, WelcomeEmptyState fills the area (D-10). */}
      <div className="terminal-area">
        {isEmpty ? (
          <WelcomeEmptyState onCreate={onAdd} />
        ) : (
          <>
            <IdentityHeader
              session={activeRecord}
              agentState={activeRecord?.agentState}
              onClear={handleClear}
              onRemove={handleCloseRequest}
            />
            <div className="viewport-stack">
              {startedSessions.map((s) => (
                <SessionView
                  key={s.logicalId}
                  id={s.logicalId}
                  active={s.logicalId === activeId && !activeIsCard}
                  onAgentState={handleAgentState}
                />
              ))}
              {activeIsCard && activeRecord !== null && (
                <IdleCard
                  session={activeRecord}
                  onStart={handleStart}
                  errorMessage={activeRecord.errorMessage}
                  onEdit={handleEdit}
                  onRetry={handleStart}
                />
              )}
            </div>
          </>
        )}
      </div>
      <ConfirmModal
        open={closingSession !== null}
        title={
          removeMode === 'delete'
            ? `Delete “${closingSession?.name ?? ''}” permanently?`
            : `Remove “${closingSession?.name ?? ''}”?`
        }
        body={
          removeMode === 'delete'
            ? 'This permanently deletes the saved session — its recipe is gone for good.'
            : closingSession?.configured === true
              ? 'This ends its running process and moves the session to the Inactive List. You can start it again later.'
              : closingIsRunning
                ? 'This ends its running process and removes the session.'
                : 'This removes the session from the sidebar.'
        }
        confirmLabel={removeMode === 'delete' ? 'Delete' : 'Remove'}
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
            // D-03 parity: a dormant (not_started) target offers "Start" (promote);
            // a has-run target offers "Restart". This is the collapsed-rail control
            // surface where the per-row ▶/↻ buttons are hidden.
            menuIsDormant
              ? { label: 'Start', onSelect: () => handleStart(menuState.id) }
              : { label: 'Restart', onSelect: () => handleRestart(menuState.id) },
            // D-14: "Start without command" — only for a startable row with a saved
            // startupCommand. Spawns a bare shell skipping the TERM-05 auto-run for this
            // launch (the primary Start above runs the command).
            ...(menuCanStartNoCmd
              ? [
                  {
                    label: 'Start without command',
                    onSelect: () => handleStartNoCmd(menuState.id),
                  },
                ]
              : []),
            // D-03/D-06: a dormant (Inactive-List) target offers permanent Delete; a
            // live (Working-Area) target offers Remove (kill PTY, keep recipe).
            menuIsDormant
              ? { label: 'Delete', onSelect: () => handleDeleteRequest(menuState.id) }
              : { label: 'Remove', onSelect: () => handleCloseRequest(menuState.id) },
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
