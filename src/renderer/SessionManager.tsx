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
import type { LogicalId, SessionRecord } from '../shared/types';
import { SessionView } from './SessionView';
import { Sidebar } from './Sidebar';
// addSession is the SOLE spawn path (T-03-09) — kept in a React/xterm-free module
// so the no-double-spawn invariant is unit-testable in the Node env.
import { addSession } from './session-add';

// How often the renderer reconciles its rendered session list against main's
// authoritative listSessions() snapshot. Kept short so a session created OUTSIDE
// onAdd (the direct-ptyCreate startup-command seam) gets a controlled pane before
// its startup command injects (main does not replay output to late subscribers).
const RECONCILE_MS = 100;

export function SessionManager(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeId, setActiveId] = useState<LogicalId | null>(null);

  // Guards the boot effect so a fast double-mount (React StrictMode dev) does not
  // auto-add two default sessions.
  const bootedRef = useRef(false);

  // ── Stop control (TERM-07 / SC3): fire-and-forget. Main runs the platform-aware
  //    graceful kill and KEEPS the SessionRecord (status → 'stopped'); the row STAYS
  //    in the sidebar (Pitfall 5 — never auto-removed). The renderer only reflects
  //    the pushed 'stopped' status via the live onPtyStatus subscription below. ──
  const handleStop = useCallback((id: LogicalId) => {
    window.api.ptyStop(id);
  }, []);

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

  // ── Reconcile with main (source of truth — RESEARCH Open Q2 / Pitfall 5). ──
  // The renderer's onAdd is the normal spawn path, but a session can also be created
  // OUTSIDE it — main owns the authoritative record store, and the startup-command
  // E2E (TERM-05/D-05) calls `window.api.ptyCreate({ startupCommand })` DIRECTLY
  // (the no-form Phase-3 seam), bypassing onAdd. Such a session lands in main's
  // listSessions() but has no rendered SessionView. We mirror main here: poll
  // listSessions() and merge any id we don't yet render, so the directly-created
  // session gets a controlled pane (and the startup command becomes visible in it).
  // Existing rows are NOT clobbered — live status comes from the onPtyStatus
  // subscription; we only ADD ids we're missing (and adopt the first as active if
  // we have none yet). Phase 5 replaces this poll with the persisted snapshot.
  //
  // Interval is tight (RECONCILE_MS) deliberately: main does NOT replay output to a
  // late subscriber, so a directly-created session's controlled pane must mount —
  // and bind onPtyData — BEFORE the startup command injects (≥ STARTUP_SETTLE_MS
  // 300 ms after first output). A 100 ms poll mounts the pane well inside that
  // window, so the injected command's echo + output (STARTUP_OK, D-05) land in the
  // pane's buffer rather than being lost pre-subscription.
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

  return (
    <div className="ide-layout">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={onSelect}
        onAdd={onAdd}
        onStop={handleStop}
        onRestart={handleRestart}
      />
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
  );
}
