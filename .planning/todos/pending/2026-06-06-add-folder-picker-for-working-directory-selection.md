---
created: 2026-06-06T14:35:34.115Z
title: Add folder picker for working directory selection
area: ui
files:
  - src/renderer/SessionEditModal.tsx:176-189
  - src/main/pty-manager.ts:713-718
---

## Problem

Surfaced during Phase 05.1 (TERM-05) human-verify checkpoint. The **Working
directory** field is free-text only and main requires an absolute path to an
existing directory (CR-01 RCE-class guard, pty-manager.ts:713-718) — anything else
is rejected. Typing an absolute path by hand is error-prone, and there is currently
no folder picker anywhere in the app (no `dialog.showOpenDialog` usage exists).

A native "Browse…" folder picker would remove the absolute-path friction entirely
(the OS dialog returns absolute paths) and make session setup feel native.

## Solution

TBD — sketch:
1. Main: add a `dialog.showOpenDialog({ properties: ['openDirectory'] })` handler.
2. Bridge: expose a minimal `pickDirectory(): Promise<string | null>` IPC (one new
   key — weigh against the security-guard bridge-surface budget / EXPECTED_API_KEYS).
3. Renderer: add a "Browse…" button next to the Working directory input in
   SessionEditModal that fills the field with the chosen absolute path.

Keep main as the validator of record (the picker is convenience; CR-01 still gates
the value).
