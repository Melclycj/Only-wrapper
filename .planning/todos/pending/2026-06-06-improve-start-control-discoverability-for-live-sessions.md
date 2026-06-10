---
created: 2026-06-06T14:35:34.115Z
title: Improve Start control discoverability for live sessions
area: ui
files:
  - src/renderer/IdleCard.tsx
  - src/renderer/SessionManager.tsx
  - src/main/pty-manager.ts:253
---

## Problem

Surfaced during Phase 05.1 (TERM-05) human-verify checkpoint. There is no visible
▶ Start control for a live session — the only lifecycle action available is to
`exit` the shell and then restart it. This is partly by design (D-01: `+ Add session`
instant-spawns; there is no create-first path), and a `Start ▶` path *does* exist but
only for **dormant/promoted** records (pty-manager.ts:253 reuses the stored cwd on
promotion). So a freshly-added, running session exposes no explicit Start/Stop
affordance.

User feedback: acceptable for a pure functionality test, but for final
user-interaction polish the start/stop lifecycle needs a clearer, discoverable
control rather than relying on typing `exit`.

NOT a TERM-05 auto-run defect — this is session lifecycle UX (Phase 03 territory,
the multi-session session-lifecycle work).

## Solution

TBD — consider:
1. A visible Start/Stop (or Restart) control on the session row / IdleCard for live
   sessions, consistent with the existing dormant-record Start ▶ promotion path.
2. Clarify the intended lifecycle (instant-spawn vs. explicit start) and align the UI
   affordances with it so users aren't forced to type `exit` to recycle a session.

Revisit alongside the dormant/promoted-record Start ▶ flow so both share one control
model.
