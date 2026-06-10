---
status: partial
phase: 08-cross-platform-packaging
source: [08-VERIFICATION.md]
started: 2026-06-10
updated: 2026-06-10
---

## Current Test

[awaiting human testing on real Windows hardware]

## CI Update (2026-06-10, run 27249633209)

The GitHub Actions windows-latest leg now PRODUCES + partially PROVES the Windows build:
- `npm run make` GREEN on windows-latest — the `.exe`/installer builds (SC1 win); `just-wrapper-windows-latest` artifact uploaded.
- Packaged smoke 10/15 GREEN on Windows (up from 5/15) after the `resolveShell` win32 fix (commit `7ec9f82`) — the Windows terminal now actually spawns `cmd.exe` (the prior `/bin/zsh` fallback was why it produced no output). The core PTY round-trip is among the now-passing specs.
- The 5 still-red Windows smokes are POSIX/zsh-coded assertions (`%` zsh prompt, `tput cols`, POSIX startup-command injection, plus one WDIO session-launch flake) — NOT product defects. They are the "port POSIX smoke assertions to Windows-shell-aware" follow-up (Test 4 below).

## Tests

### 1. Windows installer runs + PTY session works (SC1 / SC3 on real Windows)
expected: The `just-wrapper-windows-latest` CI artifact installs and launches; a session opens a working shell with full PTY fidelity (the conpty.node native helper loads from outside the ASAR archive).
result: [partial] — CI-proven on windows-latest: build GREEN + packaged PTY round-trip smoke GREEN. Real-hardware install + run still needs a human.

### 2. Windows shell dropdown + per-shell auto-run (D-02 / D-03)
expected: On real Windows with shells installed, the session-form dropdown lists PowerShell / CMD / Git Bash / WSL; a Git Bash or WSL session auto-runs its startup command; a CMD or PowerShell session either auto-runs cleanly OR shows the "auto-run unsupported on <shell> — start the command manually" degrade notice with no garbled injection.
result: [pending] — real-Windows install-path + byte-semantics verification.

### 3. Pre-1809 native error dialog (SC4 live)
expected: On a real or VM Windows build < 17763 (1809), the app shows a native "Windows 10 build 1809 or later required" dialog at startup and quits cleanly (no silent crash). Currently backed by logic proof only (os-gate.test.ts 9/9 GREEN).
result: [pending]

### 4. Port the 5 POSIX-coded smoke specs to be Windows-shell-aware (follow-up)
expected: pty-resize (`tput cols`), pty-throughput (POSIX 100MB), startup-command (POSIX injection + `%` prompt), multi-session-keepalive, alt-screen-reset assert macOS/zsh behavior. Make them shell-aware (or skip-on-win32 with a Windows equivalent) so the Windows smoke leg can go fully green rather than best-effort.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 3
partial: 1
skipped: 0
blocked: 0

## Gaps

(The Windows terminal SPAWN defect — `resolveShell` returning a non-existent `/bin/zsh` on Windows — was found by the Phase-8 Windows CI leg and FIXED in `7ec9f82` (cmd.exe via ComSpec). Remaining items are real-hardware verification + POSIX-smoke porting, per the locked D-01 macOS-dev / CI-Windows design.)
