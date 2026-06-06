---
status: partial
phase: 05-persistence-shell-discovery
source: [05-VERIFICATION.md, 05-VALIDATION.md]
started: 2026-06-06T00:00:00Z
updated: 2026-06-06T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full quit → relaunch restore
expected: Create a named session (custom name + icon + cwd), fully quit the app (Cmd+Q, not just close the window), then reopen. The session reappears in the sidebar, dormant (`not_started`), with the correct name/icon/cwd, showing an IdleCard with a ▶ Start button — no session is missing and none shows `running` on launch.
result: [pending]

### 2. Real pointer-drag reorder survives restart
expected: With ≥3 sessions, drag the 3rd sidebar row above the 1st using the hover ⠿ handle. A plain click still switches sessions (drag only engages past the ~5px activation distance). Fully quit and reopen — the custom order is preserved.
result: [pending]

### 3. Shell dropdown lists host login shells
expected: Open the session edit/create form. The Shell field is a `<select>` (not free-text) populated from the host's `/etc/shells`, with `$SHELL` present and default-selected. No hardcoded path that would break on a non-standard install.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
