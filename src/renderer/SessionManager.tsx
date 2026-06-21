// RENDERER ONLY — the multi-session container (03-02, TERM-06 / TERM-08 display).
//
// SessionManager owns the renderer-side session list + `activeId` and is the SOLE OWNER of
// the `window.api.ptyCreate` spawn (T-03-09): one ptyCreate per add, then a SessionRecord
// keyed by the returned id. SessionViews are CONTROLLED views bound to a prop id (they never
// spawn). Layout: a <Sidebar> + a .viewport-stack keeping ALL SessionViews mounted (hidden
// sessions keep buffering — SC1/SC2). Per-session onPtyStatus subs keep badges live (SC4).
// HARD RULE (CLAUDE.md / D-06): renderer NEVER imports electron/node-pty — only window.api.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogicalId, SessionIconSpec, SessionRecord } from '../shared/types';
import type { AgentState } from '../shared/agent-state';
import { SessionView } from './SessionView';
import { Sidebar } from './Sidebar';
import { ConfirmModal } from './ConfirmModal';
import { RestartApplyPrompt } from './RestartApplyPrompt';
import { buildConfirmBody } from './confirm-copy';
import { ContextMenu } from './ContextMenu';
import { SessionEditModal } from './SessionEditModal';
import { mergeAuthoritativeProfiles } from './merge-profiles';
import { PreferencesModal } from './PreferencesModal';
// clampScrollback is the PURE renderer-side scrollback clamp (07-03, D-04) — used to
// snap the boot-read + any committed value before it drives the SessionView prop /
// persistUiState. The MAIN setUiState clamp remains the persistence security boundary.
import { clampScrollback, SCROLLBACK_DEFAULT } from './scrollback-clamp';
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
// applyStatusEvent is the PURE per-row onPtyStatus reducer (06.1-04 FIX 4a + the ITEM-4
// stale-notice guard) — kept React/xterm-free so the full status-event handling is
// unit-testable in the Node env (apply-status-event.test.ts). It internally applies
// resolveRowStatus (session-status.ts) for the self-exit → Inactive List flip.
import { applyStatusEvent } from './apply-status-event';
// resolveRemoveAction is the PURE Remove/Delete decision reducer (12-06 IN-02) — extracted
// from confirmClose's inline isConfiguredLive predicate so the file stays < 800 lines once
// 12-06 adds the restart-to-apply prompt state/handlers. confirmClose keeps the IPC + setState.
import {
  resolveRemoveAction,
  flipToDormant,
  resolveSpawnResult,
} from './session-lifecycle-actions';
// restartPromptIdFor is the PURE restart-to-apply decision reducer (12-06 GAP-12-B) —
// running session + a changed launch field → the id to prompt for (else null).
import { restartPromptIdFor } from './session-restart-prompt';
// cwdWasDropped is the PURE save-time cwd-drop reducer (12-09 GAP-12-E) — given the
// submitted cwd and main's authoritative persisted cwd, decide whether main DROPPED the
// submission (kept the prior dir). CWD_DROPPED_NOTICE is the frozen inline copy.
import { cwdDropNoticeFor } from './cwd-save-outcome';

/**
 * Renderer-only row shape: the authoritative SessionRecord plus two TRANSIENT overlays
 * that are NEVER persisted and NEVER cross the bridge (no shared-type/bridge change —
 * Research Open Q2): `errorMessage` (from the onPtyStatus `notice` on a failed spawn —
 * SC2/D-03, drives the error card + tooltip) and `agentState` (TERM-09/SC4/D-06 —
 * computed in SessionView off onPtyData, lifted via onAgentState, cleared when the
 * session leaves 'running').
 */
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
  // GAP-12-B (12-06): the session pending a "Restart to apply?" prompt (its launch fields
  // changed on Save while LIVE), or null. Hosted like editingId. Set by handleSaveProfile
  // (via needsRestartPrompt) after the save persists; cleared on Restart-now / Later.
  const [restartPromptId, setRestartPromptId] = useState<LogicalId | null>(null);
  // GAP-12-E (12-09): the inline save-time cwd-drop notice, or null. Non-null → main rejected
  // the submitted cwd (kept the prior dir), so SessionEditModal stays OPEN with the notice.
  // Set by handleSaveProfile post-rehydrate; cleared on the next edit/typing/cancel.
  const [cwdDropNotice, setCwdDropNotice] = useState<string | null>(null);
  // The session whose in-terminal search bar is open (07-02 TERM-10). Non-null → that
  // session's SearchBar is open; null → none. The find chord TOGGLES this for the
  // active session (it never switches the active session). Hosted like `editingId`.
  const [searchOpenId, setSearchOpenId] = useState<LogicalId | null>(null);
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

  // ── Scrollback config (07-03, TERM-11 / SC2 / D-04/D-05) ──────────────────────────
  // The global xterm scrollback line cap, OWNED here and fanned out as a prop to every
  // SessionView (D-05). Boot default 5000 (D-04) until the boot effect reads the persisted
  // value via getUiState (07-01 read key) below. A SessionView seeds new Terminal({
  // scrollback }) from this prop and live-applies a change via term.options.scrollback (D-05).
  const [scrollback, setScrollback] = useState<number>(SCROLLBACK_DEFAULT);
  // Whether the gear-launched Preferences modal is open. Hosted like editingId/closingId.
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  // Commit a new scrollback value (from the Preferences field). Clamp it (D-04), drive the
  // SessionView props (fan-out is automatic via the prop + the SessionView live-apply
  // effect — no per-term loop here), and persist through the EXISTING validated
  // persistUiState path (no new bridge key; main re-clamps before any disk write — T-07-01).
  const handleSetScrollback = useCallback((n: number) => {
    const clamped = clampScrollback(n);
    setScrollback(clamped);
    window.api.persistUiState({ scrollback: clamped });
  }, []);

  const handleOpenPreferences = useCallback(() => setPreferencesOpen(true), []);
  const handleClosePreferences = useCallback(() => setPreferencesOpen(false), []);

  // Guards the boot effect so a fast double-mount (React StrictMode dev) does not
  // auto-add two default sessions.
  const bootedRef = useRef(false);

  // Live mirror of the current sessions list for the keyboard-switch subscription.
  // The onSwitchSession effect subscribes ONCE (it must not re-bind on every sessions
  // change, or a chord could race a listener teardown), so it reads the up-to-date
  // list through this ref instead of closing over the render-time `sessions` value.
  const sessionsRef = useRef<SessionRow[]>(sessions);
  sessionsRef.current = sessions;

  // ── Remove vs Delete (D-03/D-06, two-bucket lifecycle). BOTH go behind the SAME confirm
  //    modal (T-06.1-14); `removeMode` selects copy + side effect. The branch decision +
  //    state transforms are the PURE resolveRemoveAction/flipToDormant reducers
  //    (session-lifecycle-actions.ts, 12-06 IN-02): a CONFIGURED-LIVE Remove → ptyStop +
  //    flip dormant (recipe kept → Inactive List); everything else (ephemeral Remove, or
  //    any Delete) → ptyClose + drop the record. handleCloseRequest/handleDeleteRequest
  //    open the modal; confirmClose performs it; cancelClose dismisses. ──
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
    // Branch via the pure resolveRemoveAction reducer (12-06 IN-02); confirmClose owns the
    // IPC + setState side effects. configured-remove → ptyStop + flipToDormant (recipe kept
    // → Inactive List, activeId unchanged). Otherwise permanent: ptyClose drops the record.
    const action = resolveRemoveAction(row, removeMode);
    if (action.kind === 'configured-remove') {
      window.api.ptyStop(id);
      setSessions((prev) => flipToDormant(prev, id));
      setClosingId(null);
      return;
    }
    window.api.ptyClose(id);
    setSessions((prev) => {
      const result = closeSession(prev, activeId, id);
      setActiveId(result.activeId);
      return result.sessions;
    });
    setClosingId(null);
  }, [closingId, activeId, sessions, removeMode]);

  // ── Restart control (TERM-07 / SC3, IDENT-02): main orchestrates stop → await-exit →
  //    respawn under the SAME logicalId, returning {id, pid}. The kept SessionView preserves
  //    its xterm + writes the '— restarted HH:MM —' separator on the fresh 'running' status. ──
  // GAP-12-B (12-06): the "Restart to apply?" prompt calls this to apply a LIVE session's saved
  // launch fields (same logicalId, new ptyPid; ptyRestart is retained machinery, no new bridge
  // key, EXPECTED_API_KEYS stays 20). pid>0 = real respawn → optimistic running flip; pid<=0 =
  // failed respawn → the GAP-12-C dead-pid clear below (the error must NOT be clobbered).
  const handleRestart = useCallback((id: LogicalId) => {
    void (async () => {
      const result = await window.api.ptyRestart(id);
      // GAP-12-C (12-10 round 3): route BOTH outcomes through the SHARED resolveSpawnResult
      // reducer so Restart and Start can never diverge again. pid>0 → optimistic 'running';
      // pid<=0 (deleted-after-save / corrupt-store cwd) → flip to a VISIBLE 'error' card (the
      // round-2 fix only cleared the dead pid and RELIED on the broadcast error winning — but
      // that broadcast carries a notice, which applyStatusEvent's ITEM-4 guard keeps
      // informational, so the status never flipped and the error stayed unsurfaced on a live
      // row that "returned to home"). The handler now owns the lifecycle flip where the user
      // acted; the onPtyStatus notice only enriches errorMessage. applyStatusEvent unchanged.
      setSessions((prev) =>
        prev.map((row) =>
          row.logicalId === id ? resolveSpawnResult(row, result) : row,
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

  // ── Close the in-terminal search bar (07-02 TERM-10). The SearchBar calls this on
  //    Esc / ✕; clearing searchOpenId unmounts the overlay so a closed bar can never
  //    intercept a keystroke (SC3). Stable (empty deps) so SessionView's prop is steady. ──
  const handleCloseSearch = useCallback(() => setSearchOpenId(null), []);

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
      const result = await window.api.ptyCreate({ id, cols: 80, rows: 24 });
      // GAP-12-C (12-10 round 3): the dormant ▶ Start path now uses the SAME shared
      // resolveSpawnResult reducer as handleRestart. The round-2 fix only touched
      // handleRestart, leaving THIS path's pid<=0 unhandled — so a failed Start (a
      // deleted-after-save / corrupt-store cwd → create() returns pid -1 + a broadcast
      // 'error'+notice) was SWALLOWED: applyStatusEvent's ITEM-4 guard keeps the
      // notice-bearing event informational, so a dormant row stayed 'not_started' showing
      // the DORMANT IdleCard (Start button) with the captured error invisible — exactly the
      // operator's "after I start it just returned to home". resolveSpawnResult flips pid<=0
      // to a VISIBLE 'error' card (status:'error' → activeIsCard + the IdleCard error branch)
      // so the failure is surfaced where the user acted. pid>0 keeps the optimistic 'running'
      // flip; the subscription then keeps it live.
      setSessions((prev) =>
        prev.map((row) =>
          row.logicalId === id ? resolveSpawnResult(row, result) : row,
        ),
      );
    })();
  }, []);

  // ── Start without command (D-14): the same promote/spawn path as handleStart, but
  //    threads skipStartupCommand:true so main spawns a bare shell skipping the TERM-05
  //    auto-run for THIS launch even when a startupCommand is stored. The stored command
  //    is untouched (it runs on the next normal Start). Flows through the existing
  //    ptyCreate bridge shape — no new bridge key (Task 1 made main honor the flag). ──
  const handleStartNoCmd = useCallback((id: LogicalId) => {
    void (async () => {
      const result = await window.api.ptyCreate({
        id,
        cols: 80,
        rows: 24,
        skipStartupCommand: true,
      });
      // GAP-12-C (12-10 round 3): same shared resolveSpawnResult reducer as handleStart —
      // a bad-cwd "Start without command" must surface the error card too, not silently
      // return to the dormant view.
      setSessions((prev) =>
        prev.map((row) =>
          row.logicalId === id ? resolveSpawnResult(row, result) : row,
        ),
      );
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

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setCwdDropNotice(null); // GAP-12-E: a fresh edit/cancel never carries a stale drop notice.
  }, []);

  // GAP-12-B (12-06): "Restart to apply?" actions. Restart now → handleRestart (a failed
  // respawn surfaces the IdleCard via the pid<=0 clear, GAP-12-C). Later → dismiss.
  const confirmRestartApply = useCallback(() => {
    if (restartPromptId === null) return;
    handleRestart(restartPromptId);
    setRestartPromptId(null);
  }, [restartPromptId, handleRestart]);

  const dismissRestartApply = useCallback(() => setRestartPromptId(null), []);

  // ── Live edit half (D-02): name/icon apply IMMEDIATELY (no respawn, same logicalId —
  //    SESS-04/IDENT-02) AND mirror to main via ptyUpdateProfile so a later restart/
  //    reconcile rebuild does NOT revert the live edit (Pitfall 4). ──
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

  // ── Edit-prefill hydration (Open Q3): main VALIDATES/trims the restart fields (CR-01 +
  //    WR-05), so a submitted value may differ from what persists. Re-read listSessions()
  //    (no new bridge key) and merge main's truth via the pure mergeAuthoritativeProfiles
  //    reducer so the next edit prefills it. Status/errorMessage are NOT disturbed. Returns
  //    main's snapshot so handleSaveProfile (GAP-12-E) reads the persisted cwd off the SAME
  //    re-read for the drop compare — no second listSessions call. ──
  const rehydrateProfiles = useCallback(async () => {
    const authoritative = await window.api.listSessions();
    setSessions((prev) => mergeAuthoritativeProfiles(prev, authoritative));
    return authoritative;
  }, []);

  const handleSaveProfile = useCallback(
    (
      id: LogicalId,
      fields: { cwd: string; shell: string; startupCommand: string },
    ) => {
      // GAP-12-B (12-06): decide the restart-to-apply prompt from the PRE-save row,
      // SYNCHRONOUSLY, BEFORE ptyUpdateProfile/rehydrate overwrite the launch fields.
      // The SET is deferred behind the drop-check below (GAP-12-E precedence).
      const promptId = restartPromptIdFor(
        sessions.find((s) => s.logicalId === id) ?? null,
        fields,
      );
      window.api.ptyUpdateProfile(id, fields);
      // D-02: mirror the configured auto-promotion on the renderer row (any edit keeps
      // the session). The cwd/shell/startupCommand values are re-read from main's truth
      // below; here we only need to mark it configured.
      setSessions((prev) =>
        prev.map((row) =>
          row.logicalId === id ? { ...row, configured: true } : row,
        ),
      );
      void (async () => {
        // Re-read main's truth (edit-prefill, Open Q3) AND use it for GAP-12-E: AWAIT the
        // existing listSessions re-read so the drop compare runs against main's
        // POST-validation persisted cwd, not the optimistic local guess (no new bridge key).
        const authoritative = await rehydrateProfiles();
        // GAP-12-E precedence: decide the cwd-drop BEFORE the restart prompt. A DROP
        // (CR-01 kept the prior dir) keeps the modal OPEN with the inline notice and
        // SUPPRESSES the restart prompt (never respawn against a path main rejected). Only
        // a CLEAN save (notice === null) closes the modal AND applies the deferred prompt
        // (if a live session's launch fields changed). cwdDropNoticeFor only REPORTS main's
        // outcome — the renderer adds NO existence check.
        const notice = cwdDropNoticeFor(id, fields.cwd, authoritative);
        setCwdDropNotice(notice);
        if (notice === null) {
          cancelEdit();
          if (promptId !== null) setRestartPromptId(promptId);
        }
      })();
    },
    [rehydrateProfiles, sessions, cancelEdit],
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

  // ── Boot: one-shot hydrate from main. Take a single listSessions() snapshot, sort by
  //    `order`, focus the FIRST session (D-09). ZERO sessions → WelcomeEmptyState (D-10),
  //    NO auto-spawn. Restored rows are dormant (not_started); they go live only via the
  //    explicit Start ▶ (handleStart) — the snapshot replaces the old reconcile poll. ──
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    void (async () => {
      const existing = await window.api.listSessions();
      const sorted = [...existing].sort((a, b) => a.order - b.order);
      setSessions(sorted);
      setActiveId(sorted.length > 0 ? sorted[0].logicalId : null);
      // 07-03 (TERM-11): seed the live scrollback from persisted prefs (getUiState read
      // key); a persisted value clamps through clampScrollback (D-04), an absent one keeps
      // the boot default. Every SessionView honors the restored value on the next paint.
      const ui = await window.api.getUiState();
      if (typeof ui?.scrollback === 'number') {
        setScrollback(clampScrollback(ui.scrollback));
      }
    })();
  }, []);

  // ── Live status badges (TERM-08, SC4): subscribe per session; update that
  //    session's status on every transition; clean up all subs on change. ──
  useEffect(() => {
    const offs = sessions.map((s) =>
      window.api.onPtyStatus(s.logicalId, (p) => {
        setSessions((prev) =>
          prev.map((row) =>
            // The full per-row status-event handling lives in the PURE applyStatusEvent
            // reducer (FIX 4a self-exit → Inactive List + the ITEM-4 stale-notice guard:
            // a notice is informational and NEVER changes the row's lifecycle status, so
            // a stale 'running' ready-fail notice can no longer resurrect a dormant row
            // back into the Working Area). Unit-tested in apply-status-event.test.ts.
            row.logicalId === p.id
              ? applyStatusEvent(row, {
                  status: p.status,
                  ptyPid: p.ptyPid,
                  notice: p.notice,
                })
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
  //    (before-input-event) and pushes a SwitchIntent over onSwitchSession. We subscribe
  //    ONCE (empty deps, mirroring the onPtyStatus sub) and read the live list via
  //    sessionsRef inside the functional setActiveId update so the callback is stable yet
  //    never stale. resolveSwitch → setActiveId drives the SAME non-destructive switch as a
  //    click (TERM-06 / NAV-03). The Clear ({kind:'clear'}) and Search ({kind:'search'})
  //    chords ride this SAME channel (Plan 01 / 07-02, no new bridge key); both read the
  //    active id via the setActiveId updater (effect bound once) and NEVER switch active. ──
  useEffect(() => {
    const off = window.api.onSwitchSession((intent) => {
      if (intent.kind === 'clear') {
        setActiveId((cur) => {
          if (cur !== null) handleClear(cur);
          return cur; // Clear never switches the active session.
        });
        return;
      }
      // The find chord (Cmd+F mac / Ctrl+F win — 07-02 TERM-10) rides this SAME channel
      // as a { kind: 'search' } variant (Plan 01, zero new bridge key). It TOGGLES the
      // active session's search bar and NEVER changes the active id — read the active id
      // via the setActiveId functional updater so the effect stays bound once (mirrors
      // the 'clear' discipline; setSearchOpenId is a stable setter, not a new dep).
      if (intent.kind === 'search') {
        setActiveId((cur) => {
          if (cur !== null) {
            setSearchOpenId((prev) => (prev === cur ? null : cur));
          }
          return cur; // Search never switches the active session.
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

  // ── Agent-state lift (TERM-09 / SC4 — D-06/D-10): SessionView computes the overlay off
  //    its onPtyData stream and calls this on every CHANGE; we store it on the row only
  //    while it is 'running' (D-07) so a late classification can't resurrect an overlay on
  //    a stopped session. Computed for ALL running sessions (D-10) — backgrounded amber. ──
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

  // GAP-12-B: the session targeted by the open "Restart to apply?" prompt (drives the copy).
  const restartPromptSession =
    restartPromptId !== null
      ? (sessions.find((s) => s.logicalId === restartPromptId) ?? null)
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
        onStart={handleStart}
        onStartNoCmd={handleStartNoCmd}
        onContextMenu={handleContextMenu}
        onEdit={handleEdit}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        onReorder={handleReorder}
        onOpenPreferences={handleOpenPreferences}
      />
      {/* Terminal area: the framed white card on the cream field. The IdentityHeader caps
          the card above the .viewport-stack; a dormant active session shows the IdleCard;
          zero sessions → WelcomeEmptyState (D-04/D-10). The top StatusSummary pill strip
          was REMOVED 2026-06-14 (operator request) — deferred for a clean redesign. */}
      <div className="terminal-area">
        <div className="terminal-card">
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
            {/* GAP-11-A: the charcoal terminal is an INSET ROUNDED WELL — the .terminal-well
                WRAPPER owns radius/overflow/fill (D-03a: NEVER on .viewport-stack/.term-mount/
                .xterm). The well is ALWAYS mounted with ALL SessionViews so backgrounded
                sessions keep buffering (SC1/SC2); a dormant active session overlays the
                IdleCard on a --surface stage (D-03/D-04 white-card sibling). */}
            <div className="terminal-well" data-testid="terminal-well">
              <div className="viewport-stack">
                {startedSessions.map((s) => (
                  <SessionView
                    key={s.logicalId}
                    id={s.logicalId}
                    active={s.logicalId === activeId && !activeIsCard}
                    // GAP-10-D (10-07): the AUTHORITATIVE running status (seeded from the
                    // spawn return) — gates the agent-state classification on a first launch.
                    running={s.status === 'running'}
                    onAgentState={handleAgentState}
                    // The bar shows ONLY for the active, search-open session (07-02 TERM-10).
                    searchOpen={
                      s.logicalId === activeId && searchOpenId === s.logicalId
                    }
                    onCloseSearch={handleCloseSearch}
                    // 07-03 (TERM-11 / D-05): the global scrollback cap fanned to every term.
                    scrollback={scrollback}
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
            </div>
          </>
          )}
        </div>
      </div>
      <ConfirmModal
        open={closingSession !== null}
        title={
          removeMode === 'delete'
            ? `Delete “${closingSession?.name ?? ''}” permanently?`
            : `Remove “${closingSession?.name ?? ''}”?`
        }
        // D-04: the body is built by the pure, unit-tested buildConfirmBody (confirm-copy.ts)
        // — it reproduces the four idle bodies byte-for-byte and prepends the agent-aware
        // escalation prefix when the target row is mid-run ('in-progress') or 'waiting'. The
        // renderer-only agentState rides the row (read defensively, like errorMessage); pass
        // it straight through — the builder keys on the canonical AgentState values. ConfirmModal
        // stays a dumb controlled component (receives the computed string, renders it as a text node).
        body={buildConfirmBody({
          removeMode,
          configured: closingSession?.configured === true,
          isRunning: closingIsRunning,
          agentState: (closingSession as { agentState?: AgentState } | null)
            ?.agentState,
        })}
        confirmLabel={removeMode === 'delete' ? 'Delete' : 'Remove'}
        // DESIGN-AUDIT wave-4 (P1 #6): the permanent Delete reads one notch heavier than
        // the reversible Remove (Remove keeps the recipe → Inactive List).
        confirmVariant={removeMode === 'delete' ? 'danger-strong' : 'danger'}
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
            // SESS-07 / D-01 (Phase 11): a dormant (not_started) target offers "Start"
            // (promote); a live (non-dormant) target offers NO restart — recycle is
            // Remove → Inactive List → Start ▶. The Restart arm was removed; the live
            // branch simply omits the entry (no null in the ContextMenuItem[] array).
            ...(menuIsDormant
              ? [{ label: 'Start', onSelect: () => handleStart(menuState.id) }]
              : []),
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
              ? {
                  label: 'Delete',
                  danger: true,
                  onSelect: () => handleDeleteRequest(menuState.id),
                }
              : {
                  label: 'Remove',
                  danger: true,
                  onSelect: () => handleCloseRequest(menuState.id),
                },
          ]}
        />
      )}
      <SessionEditModal
        open={editingSession !== null}
        session={editingSession}
        // D-04: thread the editing row's main-side rejection notice (from onPtyStatus →
        // applyStatusEvent) so the CR-01 'Working directory not found' error renders
        // inline under the cwd field. Read defensively like the IdleCard does — no new
        // IPC. The IdleCard card (line ~699) stays too: both surfaces fire at different
        // moments (Open Q2).
        errorMessage={editingSession?.errorMessage}
        // GAP-12-E: the save-time cwd-drop notice keeps the modal open with the inline
        // notice + the kept prior dir; typing clears it. handleSaveProfile OWNS the close
        // decision now (closes on a valid save), so onSaveProfile no longer calls cancelEdit.
        cwdDropNotice={cwdDropNotice}
        onClearCwdDropNotice={() => setCwdDropNotice(null)}
        onSaveLive={(name, icon) => {
          if (editingId !== null) handleSaveLive(editingId, name, icon);
        }}
        onSaveProfile={(fields) => {
          if (editingId !== null) handleSaveProfile(editingId, fields);
        }}
        onCancel={cancelEdit}
      />
      {/* GAP-12-B (12-06): the "Restart to apply?" prompt — see confirmRestartApply. */}
      <RestartApplyPrompt
        open={restartPromptSession !== null}
        sessionName={restartPromptSession?.name ?? ''}
        confirmTestId="restart-apply-now"
        cancelTestId="restart-apply-later"
        onConfirm={confirmRestartApply}
        onCancel={dismissRestartApply}
      />
      {/* Gear-launched Preferences modal (07-03, TERM-11 / D-08). Hosts the scrollback
          field; live-applies on commit via handleSetScrollback (fan-out to open terms +
          persist) and dismisses with a single "Done". Hosted like the other modals. */}
      <PreferencesModal
        open={preferencesOpen}
        onClose={handleClosePreferences}
        scrollback={scrollback}
        onScrollbackChange={handleSetScrollback}
      />
    </div>
  );
}
