# Phase 8: Cross-Platform Packaging - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

The FINAL phase. Turn the `npm start`-only app into installable, runnable
**distributables for both Windows and macOS from one codebase**:

- `npm run make` produces a runnable `.app` (macOS) and a runnable `.exe` / installer (Windows) with no manual post-processing (PKG-01 / SC1)
- node-pty's native helpers load correctly from **outside** the ASAR archive on both platforms — `spawn-helper` (macOS), `conpty.node` (Windows) (SC3)
- the packaged app passes the canonical scenario (`Parlour Claude RC` / 🛋️ / real project dir / `claude --rc`) (SC2)
- a Windows build below 10.0.17763 (1809) shows a clear "Windows 10 build 1809 or later required" error instead of crashing silently (SC4)

This phase ALSO fills the two Windows seams that prior phases explicitly deferred
to Phase 8 (real Windows shell enumeration + Windows readiness probe) — see D-02/D-03.

**Out of phase (do NOT add):** real Developer-ID signing/notarization (config slots only — D-04), a real branded app icon (placeholder only — D-07), app-store / auto-update / distribution pipeline (PROJECT.md: local-only, no pipeline for MVP), Linux packaging (untested target).

</domain>

<decisions>
## Implementation Decisions

### Windows production & verification — GitHub Actions CI matrix
- **D-01:** A new **GitHub Actions CI matrix** (`windows-latest` + `macos-latest`) is the canonical producer AND verifier of the cross-platform artifacts. Dev/test is macOS-only (no local Windows machine in the loop for CI), so CI is how the real Windows `.exe`/installer gets built and smoke-tested at all. Each runner: `npm ci` → `npm run make` → `npm run test:smoke` (the existing WDIO smoke against the packaged binary). **Net-new:** `.github/workflows/` does not exist today.
  - Caveat for the planner: `maker-squirrel` and macOS signing behave differently under CI; unsigned output is acceptable this phase (D-04), so CI must not hard-require signing creds.

### Windows shell discovery + readiness probe — FILL the stubs (in scope)
- **D-02:** Implement the real **WindowsShellProvider** enumeration (PowerShell / CMD / Git Bash / WSL) behind the EXISTING `ShellDiscovery` seam in `src/main/shell-discovery.ts` — replaces the default-only stub. Closes the PROJECT.md "Active" deferral ("Windows discovery deferred to Phase 8"). Keep the D-05 safety invariant: the dropdown is never empty.
- **D-03:** Implement **WindowsReadinessProbe.forShell()** (currently `throw`s) behind the EXISTING `ReadinessProbeProvider` seam in `src/main/readiness-probe.ts`, so a Windows session carrying a startup command (TERM-05 auto-run) works instead of crashing. **Research needed:** the macOS probe uses the POSIX `:` no-op + CR; PowerShell / CMD / Git Bash / WSL each need their own state-changing-nothing readiness marker + send-vs-match split (the POSIX `:` does not apply to CMD/PowerShell). If a given Windows shell has no safe no-op probe, prefer a loud, documented "auto-run unsupported on <shell>" degrade over a silent mis-fire (the throw's original intent — `readiness-probe.ts:120-131`).
- Both seams are electron-free with injected deps — fill them with the same interface-first / pure-helper pattern as the macOS providers so they unit-test in the Node env.

### macOS signing / notarization — true stub + local-open doc
- **D-04:** Ship an **UNSIGNED** `.app`. No Apple Developer account is assumed (STATE.md blocker: notarization needs the ~$99/yr Apple Developer Program). Document the local-open path (right-click → Open, or `xattr -dr com.apple.quarantine <app>`) in a packaging/README note. **Wire the sign/notarize CONFIG SLOTS** (e.g. `packagerConfig.osxSign` / `osxNotarize` placeholders) so enabling real signing later is a config-flip + env-gated credentials — never commit a secret.

### ConPTY pre-1809 gate + rebuild approach
- **D-05:** **Native dialog pre-window gate.** In `src/main/index.ts`, at `app.whenReady` BEFORE `createWindow` (and after the `electron-squirrel-startup` `started` quit guard), on `win32` read `os.release()`, parse the build number, and if `< 17763` (Windows 10 1809) call `dialog.showErrorBox('Windows 10 build 1809 or later required', …)` then `app.quit()`. Native `showErrorBox` (NOT an in-app renderer screen) — most robust on the exact "OS too old / ConPTY missing" case it is meant to catch.
- **D-06:** **Keep ship-prebuild.** `forge.config.ts` `rebuildConfig.onlyModules: []` stays a **no-op** — node-pty 1.1.0 is N-API and its prebuild is ABI-stable under Electron 36 (verified Phase 2; node-gyp rebuild needs network headers and hard-fails offline with ECONNRESET). The postinstall `scripts/fix-node-pty.cjs` ALREADY does an opportunistic, NON-FATAL `electron-rebuild` when the network is reachable → on CI (has network) this satisfies the *spirit* of "rebuild in CI" with no offline hard-fail risk, and it keeps `chmod +x` on `spawn-helper` (npm extraction drops the execute bit → `posix_spawnp failed`).
  - **⚠ ROADMAP Phase 8 text "@electron/rebuild in CI" is STALE** — written before the N-API ABI-stable fact was verified in Phase 2. The planner MUST NOT reintroduce a network-MANDATORY packaging rebuild; doing so makes the build *more* fragile, not less.

### App icon + metadata — wire pipeline, placeholder icon
- **D-07:** **Wire the icon pipeline now, ship a placeholder.** Create `assets/` and point `packagerConfig.icon` + per-maker icon paths (Squirrel `setupIcon`) at `assets/icon.{icns,ico,png}`. Drop in a simple placeholder mark (JW / 🛋️ motif) so swapping a nicer icon later is a file replacement with config untouched. Set `appId` (suggest `com.justwrapper.app`) and `author` in `package.json` / forge config. `productName` is already `"Just-Wrapper"`.

### Packaged-app verification — automated smoke + canonical human-verify
- **D-08:** **Automated packaged-smoke + a blocking canonical human-verify.** Reuse the existing WDIO harness (`wdio.conf.ts` already points `appBinaryPath` at the packaged `.app`) to assert an ASAR-internal PTY round-trip (SC3) against `npm run make` output — macOS locally + Windows on CI. PLUS a blocking end-of-phase **human-verify** for the canonical `claude --rc` scenario (SC2): macOS primary, Windows best-effort on the user's own machine. Consistent with every prior phase's end-of-phase human-verify (nyquist gate).
  - CI runners don't have `claude` installed, so SC2's "the agent launches interactively" is INHERENTLY a human-verify; the CI/automated smoke uses a stand-in command (a shell echo / `tput cols` round-trip) to prove PTY-works-inside-ASAR.

### Claude's Discretion
- Exact CI workflow YAML structure, the placeholder icon's actual artwork, the Windows shell enumeration order/labels, and the `os.release()` build-number parse helper — planner/researcher's call within the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Packaging config & native-module handling
- `forge.config.ts` — ASAR `unpackDir` for node-pty, `ignore` keep-clause (node-pty + lowdb + steno), `rebuildConfig.onlyModules: []` no-op, makers (Squirrel/ZIP-darwin/Deb/Rpm), AutoUnpackNatives + Vite plugins. **Extend this file for icon/appId/sign slots — do not rewrite.**
- `scripts/fix-node-pty.cjs` — postinstall: `chmod +x` spawn-helper + opportunistic NON-FATAL `electron-rebuild` (the actual "rebuild in CI" mechanism per D-06).
- `vite.main.config.ts` — node-pty + lowdb marked `external` (why the forge `ignore` keep-clause exists).
- `package.json` — scripts (`make`/`package`/`start`/`test:smoke`), `productName`/`version`, exact-pinned deps (electron 36.9.5, node-pty 1.1.0, forge 7.11.2 makers).

### Windows seams to FILL (D-02/D-03)
- `src/main/shell-discovery.ts` — `ShellDiscovery` seam; `WindowsShellProvider` stub (fill), `MacShellProvider` (the pattern to mirror), `selectShellProvider`, pure `parseEtcShells`/`buildShellList`.
- `src/main/readiness-probe.ts` — `ReadinessProbeProvider` seam; `WindowsReadinessProbe.forShell()` THROWS (fill), `MacReadinessProbe` + pure `buildPosixProbe` (send-vs-match + 8 KB tail bound) to mirror.
- `src/main/shell-resolver.ts` — `resolveShell()` reused by both providers (do not recompute).

### Boot sequence & verification harness
- `src/main/index.ts` — `electron-squirrel-startup` `started` guard, `app.whenReady`, `createWindow`. **The ConPTY gate (D-05) inserts here, before the window.**
- `wdio.conf.ts` — `appBinaryPath` already targets the packaged `.app` (reuse for D-08; needs a Windows-path variant for CI).
- `tests/smoke/boot.smoke.test.ts`, `tests/smoke/pty-roundtrip.smoke.test.ts` — existing packaged-app smokes to extend for SC3.

### Requirements, roadmap & standards
- `.planning/ROADMAP.md` → "Phase 8: Cross-Platform Packaging" — Goal + SC1..SC4 (**NOTE the "@electron/rebuild in CI" line is stale — see D-06**).
- `.planning/REQUIREMENTS.md` — PKG-01 + Definition of Done item 6 (builds+runs packaged on both OSes).
- `.planning/PROJECT.md` — "Active" Windows-shell-discovery deferral (closed by D-02/D-03); Constraints (local-only, no distribution pipeline, ConPTY edge); Key Decisions table.
- `CLAUDE.md` (project root) → "Critical: node-pty Native Module Build Concerns" + "What NOT to Use" — the canonical packaging gotchas (ASAR unpack, ConPTY 1809 min, `win_delay_load_hook` must stay default, macOS universal `lipo`, no .node-from-ASAR, no node-pty in renderer).
- `.planning/STATE.md` → Blockers/Concerns — notarization needs Apple Developer ($99/yr); node-pty/Electron version note.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`forge.config.ts`** — the ASAR-unpack + ignore-keep + no-op-rebuild config is already correct and proven; this phase EXTENDS it (icon, appId, sign slots, maybe a universal macOS arch flag), not rewrites it.
- **WDIO harness (`wdio.conf.ts`)** — already boots the *packaged* `.app` via `appBinaryPath`; the 15 existing `tests/smoke/*.smoke.test.ts` already run against the packaged binary → packaged-app automation (D-08) is half-built.
- **`ShellDiscovery` + `ReadinessProbeProvider` seams** — the Windows providers fill behind the EXISTING interfaces (no new seam, no new bridge key). `selectShellProvider`/`selectReadinessProbe` already branch on `win32`.
- **`scripts/fix-node-pty.cjs`** — keep its opportunistic-rebuild + spawn-helper `chmod` behavior; it IS the "rebuild in CI" answer.

### Established Patterns
- **Interface-first / electron-free pure helpers with injected deps** (`buildShellList`, `parseEtcShells`, `buildPosixProbe`) — Windows fills MUST follow this so they unit-test in the Node env without Electron/real-PTY.
- **Every phase ends with a blocking human-verify before `nyquist_compliant` flips** — D-08 follows this; the canonical 🛋️ scenario is the gate.
- **Exact-pinned deps + `security.guard` `EXPECTED_API_KEYS` invariant (currently 20)** — packaging adds ZERO new bridge keys; the guard must stay GREEN at 20.

### Integration Points
- ConPTY gate (D-05) → inserts in `src/main/index.ts` between the squirrel `started` guard and `createWindow`.
- Icon/appId/sign config (D-04/D-07) → `forge.config.ts` `packagerConfig` + makers; assets in new `assets/`.
- CI (D-01) → new `.github/workflows/*.yml` calling `npm ci` → `npm run make` → `npm run test:smoke` on a 2-OS matrix.

</code_context>

<specifics>
## Specific Ideas

- **Canonical SC2 human-verify target:** Name `Parlour Claude RC`, Icon `🛋️`, Path a real project dir, Command `claude --rc` — must launch interactively inside the *packaged* app (PROJECT.md §Canonical validation scenario).
- **Windows shells to enumerate (D-02):** PowerShell, CMD, Git Bash, WSL (PROJECT.md "Shells to support"). Windows shell paths from CLAUDE.md: PowerShell `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`, WSL `C:\Windows\System32\wsl.exe`.
- **Metadata suggestions:** `appId = com.justwrapper.app`; placeholder icon = a simple JW / 🛋️ mark.
- **ConPTY threshold:** Windows 10 1809 = build `17763` (CLAUDE.md "ConPTY requires Windows 10 1809+").

</specifics>

<deferred>
## Deferred Ideas

- **Real branded app icon** (nicer than the placeholder) — file-swap later; D-07 wires the config so no further config change is needed.
- **Real macOS Developer ID signing + notarization** — needs Apple Developer membership ($99/yr); D-04 wires env-gated config slots so it's a later flip.
- **macOS universal binary (`--arch=universal`)** — only if the user wants one artifact for Intel + Apple Silicon; needs node-pty rebuilt for both arches + `lipo` (CLAUDE.md). Default to the host arch unless the planner/user asks for universal.
- **The 5 pending todos** (`folder-picker`, `edit-modal-prefill`, `Start-discoverability`, `05.1 deferred code-review`, `06.1 code-review criticals`) — reviewed; NONE are packaging-related, all remain out of Phase 8 scope in their own backlog.
- **Awareness (not a Phase-8 dependency):** ROADMAP shows Phase 6 at 3/4 (`06-04-header-controls-reset` unchecked), but Phase 6.1 superseded that lifecycle work and Phase 7 is complete; Phase 8 depends only on Phase 7, so this does not gate packaging.

</deferred>

---

*Phase: 8-cross-platform-packaging*
*Context gathered: 2026-06-10*
