---
status: partial
phase: 08-cross-platform-packaging
source: [08-VERIFICATION.md]
started: 2026-06-10
updated: 2026-06-10
---

## Current Test

[awaiting human testing on real Windows hardware / CI]

## Tests

### 1. Windows installer runs + PTY session works (SC1 / SC3 on real Windows)
expected: The `just-wrapper-windows-latest` CI artifact installs and launches; a session opens a working shell with full PTY fidelity (the conpty.node native helper loads from outside the ASAR archive).
result: [pending]

### 2. Windows shell dropdown + per-shell auto-run (D-02 / D-03)
expected: On real Windows with shells installed, the session-form dropdown lists PowerShell / CMD / Git Bash / WSL; a Git Bash or WSL session auto-runs its startup command; a CMD or PowerShell session either auto-runs cleanly OR shows the "auto-run unsupported on <shell> — start the command manually" degrade notice with no garbled injection.
result: [pending]

### 3. Pre-1809 native error dialog (SC4 live)
expected: On a real or VM Windows build < 17763 (1809), the app shows a native "Windows 10 build 1809 or later required" dialog at startup and quits cleanly (no silent crash). Currently backed by logic proof only (os-gate.test.ts 9/9 GREEN).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

(none — these are documented best-effort items from the locked D-01 design: development/test is macOS-only, the GitHub Actions matrix is the Windows producer. The macOS canonical `claude --rc` scenario, SC1/SC3 macOS, and SC4 logic were all confirmed.)
