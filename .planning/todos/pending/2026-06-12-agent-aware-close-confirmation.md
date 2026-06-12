---
created: 2026-06-12T04:30:00.000Z
title: Agent-aware close confirmation (escalate copy when claude is mid-task) + app-quit guard
area: ui
files:
  - src/renderer/SessionManager.tsx
  - src/renderer/ConfirmModal.tsx
  - src/main/index.ts
---

## Problem

Operator question at the Phase-10 gate session (2026-06-12): "when i tried to
close a session when claude is on, or a background processing is running, will
there be any reminder?"

Current state (verified in code):

- **Session close: YES, always a reminder.** Every ✕ Remove / context-menu Delete
  opens `ConfirmModal` first (D-03a / T-06.1-14, SessionManager.tsx ~698-716), and
  the body copy is RUNNING-AWARE: a configured live session says "This ends its
  running process and moves the session to the Inactive List…"; an ephemeral
  running one says "This ends its running process and removes the session."
- **But it is not AGENT-aware.** The copy is the same whether the shell is sitting
  idle or claude is mid-task / waiting on a permission prompt. `agentState` is
  already on the row (waiting/working seam), so the modal could escalate: e.g.
  "Claude is still working in this session — closing will kill it mid-task." A
  waiting-on-you state arguably deserves the strongest wording.
- **App quit: NO per-session reminder.** `before-quit` flushes persistence and
  kills all PTYs (T-02-06 no-orphans contract, pty-manager.ts) — quitting with N
  running/agent-busy sessions is silent.

## Solution

TBD — sketch:
1. Thread `agentState` (and maybe a "has running PTY" count) into the confirm-modal
   copy branch in SessionManager.tsx — escalated title/body when
   `agentState === 'working' | 'waiting'`.
2. Decide the app-quit story: a quit-time confirm when any session has a running
   PTY (or only when an agent is working/waiting), vs keeping silent quit. Needs an
   operator decision — quit guards annoy fast-quit users; scope to agent-busy only?
3. Keep ConfirmModal a dumb controlled component; logic stays in SessionManager.

Candidate phase: Phase 11 (Terminal Area Polish) or session-lifecycle follow-up;
small enough to ride a gap-closure round if the operator wants it sooner.
