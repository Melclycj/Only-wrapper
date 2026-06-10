---
status: complete
phase: 03-multi-session-session-lifecycle
source: [03-VERIFICATION.md]
started: 2026-06-05
updated: 2026-06-05
---

## Current Test

Awaiting final human confirmation of restart-identity UX (item 3). All other items confirmed during the 03-03 human-verify checkpoint.

## Tests

### 1. Keep-alive feel (SC1)
expected: background output (e.g. `npm run dev`) keeps advancing while the session is hidden; switching never kills a process
result: passed — confirmed by user at 03-03 checkpoint

### 2. Current scrollback (SC2)
expected: switching back to a TUI session shows a current, non-torn, non-blank frame
result: passed — confirmed by user at 03-03 checkpoint

### 3. Restart identity UX (SC3 / TERM-07 / IDENT-02)
expected: Restart a non-running (exited/error) session → same name + icon, a visible `— restarted HH:MM —` separator above the kept scrollback, new ptyPid, same logical row
result: passed — confirmed by user 2026-06-05

### 4. Destructive Close flow (D-03a)
expected: Close opens the DESIGN.md confirm modal; Cancel/Esc/overlay preserves; Close kills the PTY + removes the row + reselects another session
result: passed — confirmed by user at 03-03 checkpoint (item B)

### 5. Status badge colors (SC4)
expected: running=blue, exited=green "Finished", error=derived red "Error", slate "Idle"/closed — matching DESIGN.md §Status system oklch
result: passed — confirmed by user at 03-03 checkpoint (item 4)

### 6. WebGL hand-off at scale
expected: ~10–15 sessions cycle with no "too many WebGL contexts" warning; active terminal always renders
result: passed — confirmed by user at 03-03 checkpoint (item 6)

### 7. Shutdown stability (bonus — reported defect)
expected: quitting while sessions stream output raises no "Object has been destroyed" exception
result: passed — confirmed by user at 03-03 checkpoint (item A)

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
