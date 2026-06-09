---
phase: 08-cross-platform-packaging
plan: 02
subsystem: infra
tags: [windows, shell-discovery, readiness-probe, pty, electron-free, vitest, conpty]

# Dependency graph
requires:
  - phase: 05-startup-and-readiness
    provides: buildPosixProbe + ShellReadinessProbe send-vs-match seam (reused verbatim for Git Bash/WSL)
  - phase: 05-shell-discovery
    provides: ShellDiscovery seam + buildShellList pure-builder pattern (mirrored for Windows)
provides:
  - WindowsShellProvider real enumeration (PowerShell/CMD/Git Bash/WSL) behind the existing ShellDiscovery seam
  - buildWindowsShellList pure builder (default-first never-empty, on-disk filter, de-dupe, friendly labels)
  - WindowsReadinessProbe.forShell() filled — POSIX reuse for Git Bash/WSL, degrade-loudly for CMD/PowerShell
  - ShellReadinessProbe.unsupported optional degrade signal (internal main type; routes through existing onPtyStatus notice, zero new bridge key)
affects: [08-03-ci-packaging, windows-human-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "electron-free pure builder + injected existsFn (buildWindowsShellList mirrors buildShellList)"
    - "degrade-loudly probe shape (marker='', matches()=false, unsupported notice) instead of throw/mis-fire"

key-files:
  created: []
  modified:
    - src/main/shell-discovery.ts
    - src/main/__tests__/shell-discovery.test.ts
    - src/main/readiness-probe.ts
    - src/main/__tests__/readiness-probe.test.ts

key-decisions:
  - "CMD/PowerShell readiness = DEGRADE-LOUDLY (not a guessed echo marker): byte-correctness is unverifiable on the macOS dev box and a mis-fire into a claude --rc session is worse than a clear notice (locked D-03)."
  - "Windows-aware default is computed from process.env.ComSpec/cmd.exe, NOT resolveShell() (which yields /bin/zsh on Windows — Pitfall 3)."
  - "The Windows default is UNCONDITIONALLY included (not existsFn-filtered) — the hard D-05 never-empty guarantee that holds even when nothing is on disk (e.g. the macOS dev box)."
  - "Degrade notice rides the existing onPtyStatus notice channel via a new internal ShellReadinessProbe.unsupported field — ZERO new bridge keys; EXPECTED_API_KEYS stays 20."

patterns-established:
  - "Pattern: per-shell readiness strategy — POSIX-reuse for bash-family, degrade-loudly for non-POSIX shells whose markers can't be byte-validated on the dev box."

requirements-completed: [PKG-01]

# Metrics
duration: ~12min
completed: 2026-06-10
---

# Phase 8 Plan 02: Windows Shell Discovery + Readiness Probe Fill Summary

**Filled the two deferred Windows seams: real WindowsShellProvider enumeration (PowerShell/CMD/Git Bash/WSL, never-empty) and WindowsReadinessProbe.forShell() (POSIX-reuse for Git Bash/WSL, degrade-loudly for CMD/PowerShell) — both electron-free pure helpers, unit-proven on macOS, zero new bridge keys.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-10T02:15:00Z (approx)
- **Completed:** 2026-06-10T02:19:00Z (approx)
- **Tasks:** 2 (both TDD)
- **Files modified:** 4

## Accomplishments
- `WindowsShellProvider.discover()` now enumerates PowerShell / PowerShell 7 / CMD / Git Bash (bin + usr/bin) / WSL from env-expanded well-known paths (`process.env.SystemRoot` / `ProgramFiles`), filters to on-disk, de-dupes, and labels via a friendly basename map — with a Windows-aware default (`process.env.ComSpec`) placed first so the dropdown is never empty (D-02/D-05).
- `buildWindowsShellList(candidates, windowsDefault, existsFn)` pure builder mirrors `buildShellList`, with the default UNCONDITIONALLY included (the hard never-empty guarantee that holds even when no candidate exists on disk).
- `WindowsReadinessProbe.forShell()` no longer throws: Git Bash + WSL reuse `buildPosixProbe` verbatim; CMD + PowerShell degrade loudly (no bytes sent, never matches, carry an "auto-run unsupported on <shell>" notice).
- Closed the PROJECT.md "Active" Windows-shell-discovery deferral; Windows auto-run is now safe (auto-runs on Git Bash/WSL, degrades cleanly on CMD/PowerShell).

## Task Commits

Each task was committed atomically (TDD: red+green folded into one feat commit per task after verification):

1. **Task 1: Fill WindowsShellProvider enumeration (D-02/D-05)** — `3ace822` (feat)
2. **Task 2: Fill WindowsReadinessProbe.forShell() — POSIX reuse + degrade-loudly (D-03)** — `2f33ffd` (feat)

**Plan metadata:** committed separately with STATE.md/ROADMAP.md.

## Files Created/Modified
- `src/main/shell-discovery.ts` — added `buildWindowsShellList` pure builder + filled `WindowsShellProvider` (env-expanded candidates, ComSpec default, fs.existsSync injected). Added `node:path` import.
- `src/main/__tests__/shell-discovery.test.ts` — `buildWindowsShellList` describe block: default-first, full enumeration with labels, hard-D-05 (all-false existsFn), de-dupe, on-disk filter, basename fallback.
- `src/main/readiness-probe.ts` — added `ShellReadinessProbe.unsupported?` field + `buildDegradeProbe` helper; filled `WindowsReadinessProbe.forShell()` (basename branch: bash/wsl → POSIX reuse; cmd/powershell/pwsh → degrade). Removed the unconditional Phase-8 throw.
- `src/main/__tests__/readiness-probe.test.ts` — replaced the win32 THROWS case with the per-shell contract: Git Bash/WSL POSIX-reuse probe assertions, CMD/PowerShell degrade-contract assertions, no-throw guarantee.

## Decisions Made
- **CMD/PowerShell → degrade-loudly, not a guessed marker.** The POSIX `:` no-op doesn't exist there, and `echo`/`Write-Output` markers put the nonce in BOTH the command-echo line and the output line (Pitfall 6). A safe send-vs-match split is unverifiable on the macOS dev box, so per locked D-03 we degrade loudly (a clear "start the command manually" notice) rather than risk injecting garbage into a `claude --rc` session.
- **Windows default from ComSpec, included unconditionally.** Avoids the Pitfall-3 latent bug (`resolveShell()` returns `/bin/zsh` on Windows) and guarantees the dropdown is never empty even when every well-known path is absent (the macOS-dev-box case).
- **Degrade signal via internal `unsupported` field.** No new bridge key — the caller routes it through the existing `onPtyStatus` `notice?:string` channel exactly like the 05.1 ready-timeout notice. `EXPECTED_API_KEYS` stays 20.

## Deviations from Plan

None - plan executed exactly as written. (The plan explicitly offered "marker OR degrade" for CMD/PowerShell and recommended the degrade as the locked-safe default; the degrade path was chosen, as authorized.)

One minor implementation refinement within the plan's intent: the Windows default is included UNCONDITIONALLY (not existsFn-filtered) so the never-empty invariant holds on the macOS dev box where no Windows shell exists on disk — required to keep the pre-existing `selectShellProvider('win32')` length≥1 test GREEN. This is the hard reading of D-05 and was added as an explicit unit test.

## Issues Encountered
- Initial `buildWindowsShellList` filtered the default through `existsFn`, breaking the cross-platform `selectShellProvider('win32').discover().length >= 1` test on macOS (no Windows shells on disk). Resolved by making the default unconditional and adding a dedicated "all-false existsFn" test pinning the guarantee.

## Verification
- `npm run test:unit` — 313 passed (38 files), including `security.guard.test.ts` (EXPECTED_API_KEYS===preload keys, still 20).
- `npx tsc --noEmit` — clean.
- `grep "Windows readiness probe is implemented in Phase 8"` — empty (throw removed).
- EXPECTED_API_KEYS count = 20 (security.guard GREEN; no bridge key added).

## Known Stubs
None. Both seams are now filled with real logic. The CMD/PowerShell degrade is a deliberate, documented behavior (D-03 locked) — not a stub.

## Plan 03 CI-smoke + Human-Verify Items ([ASSUMED] — confirm on real Windows)
The enumeration LOGIC, never-empty invariant, and per-shell readiness STRATEGY are unit-proven on macOS, but the following byte/path facts are unverifiable on the dev box and must be confirmed by Plan 03's Windows CI smoke + human-verify:

| Item | Tag | What to confirm on real Windows |
|------|-----|---------------------------------|
| PowerShell 7 path `%ProgramFiles%\PowerShell\7\pwsh.exe` | A1 | exists when pwsh7 installed |
| CMD path `%SystemRoot%\System32\cmd.exe` | A2 | exists (should always) |
| Git Bash path `%ProgramFiles%\Git\bin\bash.exe` (and `\usr\bin\bash.exe`) | A3 | which one exists per Git install |
| CMD readiness byte semantics | A4 | whether a safe send-vs-match marker is achievable (currently degraded) |
| PowerShell readiness byte semantics | A5 | whether a safe send-vs-match marker is achievable (currently degraded) |

If A4/A5 prove a safe marker IS achievable on real Windows, a follow-up can upgrade CMD/PowerShell from degrade to a producing-line-guarded marker without touching the seam shape or any bridge key.

## Next Phase Readiness
- Windows shell discovery + readiness are functionally complete behind the existing seams; ready for Plan 03 (CI packaging + Windows smoke + canonical human-verify).
- No blockers. CMD/PowerShell auto-run is intentionally degraded pending real-Windows byte validation.

## Self-Check: PASSED
- FOUND: src/main/shell-discovery.ts
- FOUND: src/main/readiness-probe.ts
- FOUND: .planning/phases/08-cross-platform-packaging/08-02-SUMMARY.md
- FOUND commit: 3ace822 (Task 1)
- FOUND commit: 2f33ffd (Task 2)

---
*Phase: 08-cross-platform-packaging*
*Completed: 2026-06-10*
