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

export function SessionManager(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeId, setActiveId] = useState<LogicalId | null>(null);

  // Guards the boot effect so a fast double-mount (React StrictMode dev) does not
  // auto-add two default sessions.
  const bootedRef = useRef(false);

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
