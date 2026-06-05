---
status: resolved
phase: 04-session-identity-sidebar-ui
source: [04-VERIFICATION.md]
started: 2026-06-05T04:27:37Z
updated: 2026-06-05T04:35:00Z
---

## Current Test

[all human UAT items approved by user — 2026-06-05]

## Tests

### 1. Canonical "Parlour Claude RC" edit flow (SESS-01/02/03/04, IDENT-03, D-01/D-02)
expected: Right-click a sidebar row → Edit. Change the name to "Parlour Claude RC" and pick the 🛋️ emoji. The sidebar row AND the identity header above the terminal update LIVE (same `data-session-id` / logicalId — no new session). Set a cwd and shell — these show an "applies on restart" hint and take effect only after a restart, not immediately. Click-switching between sessions stays non-destructive (background process keeps running).
result: passed

### 2. Keyboard chords do not reach a focused terminal (NAV-05, D-13 "app always wins")
expected: Open `vim` (or `tmux`) in a session and keep it focused. Press Cmd+1 / Ctrl+1 (and Cmd/Ctrl+Shift+] / [). The app switches sessions; the focused vim/tmux does NOT receive the keystroke; background sessions stay alive. (This invariant cannot be proven by the automated E2E — WDIO's synthetic key injection bypasses Electron's `before-input-event`; only real physical keyboard input exercises the native path.)
result: passed

### 3. Collapsed rail visual identity (NAV-01/NAV-02, SESS-03, D-10/D-11)
expected: Click the chevron toggle to collapse the sidebar to a ~52px icon-only rail. Each item still identifies its session: emoji icons render correctly, color-kind icons show the correct first-letter initial on the colored badge, a status-color dot sits at the corner, and hovering shows a warm (Nunito) tooltip with the session name. Right-clicking a collapsed rail item opens the context menu (Edit / Restart / Close).
result: passed

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
