---
created: 2026-06-06T14:35:34.115Z
title: Edit modal does not prefill saved cwd and startup command
area: ui
files:
  - src/renderer/SessionEditModal.tsx:68-75
  - src/renderer/session-add.ts:48
  - src/renderer/SessionManager.tsx:213-218,432
  - src/main/pty-manager.ts:697-718
---

## Problem

Surfaced during Phase 05.1 (TERM-05) human-verify checkpoint. When you re-open the
Edit session modal, the **Working directory** and **Startup command** fields show
empty even though the values were saved and are correctly used (auto-run runs the
command; the session spawns in the right cwd).

The modal itself is correct — it pre-fills from the record
(`setCwd(session.cwd)`, `setStartupCommand(session.startupCommand ?? '')`,
SessionEditModal.tsx:72-74, controlled inputs). The root cause is upstream record
hydration:

- `session-add.ts:48` mints the renderer `SessionRecord` with `cwd: ''` by design
  (D-02: the *real* resolved cwd lives only in main; the renderer carries the
  contract field empty). So `session.cwd` is `''` at edit time.
- After `onSaveProfile` persists cwd/shell/startupCommand to main
  (SessionManager.tsx:213-218,432), the renderer's in-memory `SessionRecord` is not
  refreshed with those values, so `session.startupCommand`/`session.cwd` stay
  stale/empty on the next open.

Net effect: the edit form can't show what's actually persisted in main.

NOT a TERM-05 auto-run defect — auto-run reads the values from main correctly. This
is a session edit/record round-trip gap (Phase 03/04 territory).

## Solution

TBD — likely options:
1. Have main return the resolved/persisted profile (cwd, shell, startupCommand) and
   hydrate the renderer `SessionRecord` after spawn and after `onSaveProfile`, so the
   record always mirrors main's truth before the modal seeds from it.
2. Or have the edit modal fetch the live profile from main on open (a
   `getSessionProfile(id)` IPC) instead of relying on the renderer record.

Pick whichever keeps main as the single source of truth (D-02) without widening the
IPC bridge surface unnecessarily (respect security V5/CR-01 validation).
