# Phase 8: Cross-Platform Packaging - Research

**Researched:** 2026-06-10
**Domain:** Electron Forge cross-platform packaging (Windows + macOS), node-pty native-module ASAR handling, GitHub Actions CI matrix, Windows shell/readiness seams, ConPTY OS gate
**Confidence:** HIGH (packaging mechanics + node-pty internals verified from the installed tree; CI YAML pattern MEDIUM; Windows shell-detection paths MEDIUM/ASSUMED — unverifiable on macOS without a real Windows runner)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — CI matrix is the canonical Windows producer + verifier.** New `.github/workflows/` (does not exist today). Matrix `windows-latest` + `macos-latest`; each runner: `npm ci` → `npm run make` → `npm run test:smoke`. Must NOT hard-require signing creds (unsigned output acceptable this phase). `maker-squirrel` and macOS signing behave differently under CI.
- **D-02 — Fill `WindowsShellProvider`.** Real enumeration of PowerShell / CMD / Git Bash / WSL behind the EXISTING `ShellDiscovery` seam in `src/main/shell-discovery.ts`. Electron-free pure helpers + injected deps, mirroring `MacShellProvider`. Keep the D-05 never-empty-dropdown invariant.
- **D-03 — Fill `WindowsReadinessProbe.forShell()`** (currently throws) behind the EXISTING `ReadinessProbeProvider` seam in `src/main/readiness-probe.ts`. POSIX `:` no-op does NOT apply to CMD/PowerShell — each shell needs its own state-changing-nothing marker + send-vs-match split. If a shell has no safe no-op probe, fail loudly / degrade with a documented "auto-run unsupported on `<shell>`" message rather than mis-fire.
- **D-04 — macOS unsigned `.app` + documented local-open path.** Wire sign/notarize CONFIG SLOTS (`osxSign`/`osxNotarize` placeholders) env-gated for a later flip. No secrets committed. Document right-click → Open / `xattr -dr com.apple.quarantine`.
- **D-05 — Native dialog pre-1809 gate.** At `app.whenReady` BEFORE `createWindow` (after the `electron-squirrel-startup` `started` guard), on win32 read `os.release()`, parse the build number, `< 17763` → `dialog.showErrorBox(...)` then `app.quit()`. Must run before any node-pty spawn.
- **D-06 — KEEP ship-prebuild.** `rebuildConfig.onlyModules: []` stays a no-op (node-pty 1.1.0 N-API prebuild ABI-stable under Electron 36, verified Phase 2; node-gyp rebuild hard-fails offline). Postinstall already does opportunistic non-fatal rebuild when online. **ROADMAP's "@electron/rebuild in CI" text is STALE — do NOT reintroduce a network-mandatory packaging rebuild.**
- **D-07 — Wire icon pipeline + metadata, ship placeholder icon.** `packagerConfig.icon` + per-maker icon (Squirrel `setupIcon`) → `assets/icon.{icns,ico,png}`. Set `appId` (`com.justwrapper.app`), `author`.
- **D-08 — Automated packaged-smoke (reuse WDIO `appBinaryPath`) asserting ASAR-internal PTY round-trip (SC3)** on macOS local + Windows CI; PLUS a blocking canonical `claude --rc` human-verify (SC2). Make `wdio.conf.ts` os-conditional (macOS path is hardcoded today, needs the Windows `.exe`). Use a stand-in PTY round-trip command for CI runners that lack `claude`.

### Claude's Discretion
Exact CI workflow YAML structure, the placeholder icon's actual artwork, the Windows shell enumeration order/labels, and the `os.release()` build-number parse helper — planner/researcher's call within the decisions above.

### Deferred Ideas (OUT OF SCOPE)
- Real branded app icon (placeholder only this phase; D-07 wires config so it's a later file-swap).
- Real macOS Developer ID signing + notarization (needs Apple Developer ~$99/yr; D-04 wires env-gated slots).
- macOS universal binary (`--arch=universal`) — only if the user asks; needs node-pty rebuilt for both arches + `lipo`. Default to host arch.
- The 5 pending todos (folder-picker, edit-modal-prefill, Start-discoverability, 05.1 deferred code-review, 06.1 code-review criticals) — none packaging-related.
- Linux packaging (untested target; MakerDeb/MakerRpm exist in config but are out of phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | App packages as a runnable/installable local desktop app for both Windows and macOS from a single codebase (MVP) | The entire phase. `npm run make` already produces a macOS `.app` (an `out/Just-Wrapper-darwin-arm64/` exists). This phase adds: a CI matrix that ALSO produces the Windows `.exe`/installer (D-01), the ConPTY gate (D-05), icon/appId metadata (D-07), and the packaged-smoke + canonical human-verify (D-08). Definition-of-Done item 6 ("builds and runs as a packaged desktop app on both Windows and macOS") is the gate. |
</phase_requirements>

## Summary

Phase 8 is overwhelmingly **config + CI + two Windows seam fills**, not new product surface. The hard packaging primitives — ASAR-unpack of node-pty's native helpers, the no-op `rebuildConfig`, the Vite-`ignore` keep-clause for node-pty/lowdb — are **already in `forge.config.ts` and proven** (a macOS `.app` is already in `out/` and 14/14 smokes run against it). The phase's job is to (1) stand up a 2-OS GitHub Actions matrix that becomes the canonical Windows producer/verifier, (2) fill `WindowsShellProvider` + `WindowsReadinessProbe`, (3) wire icon/appId/sign-slot metadata, (4) insert the pre-1809 native-dialog gate in `src/main/index.ts`, and (5) extend the WDIO smoke + add a canonical human-verify.

A decisive finding from inspecting the installed tree: **node-pty 1.1.0 ships prebuilds for ALL FOUR target triples in its npm tarball** — `darwin-arm64`, `darwin-x64`, `win32-arm64`, `win32-x64` — each with the right `pty.node` (+ macOS `spawn-helper`, + Windows `conpty.node`). A clean `npm ci` on a `windows-latest` runner therefore already has a working `win32-x64` native binary **with no rebuild and no network** (the N-API ABI-stable story, D-06). node-pty resolves the binary via its own `loadNativeModule()` from `prebuilds/${process.platform}-${process.arch}/`, and the macOS `spawn-helper` is loaded as `native.dir + '/spawn-helper'` — both must land in `app.asar.unpacked/`, which the existing `asar.unpackDir: '**/node_modules/node-pty/**'` + `AutoUnpackNativesPlugin` already cover.

**Primary recommendation:** Treat this as a "wire the proven config + fill two Windows seams + stand up CI" phase. Do NOT touch the working `rebuildConfig`/`ignore`/`asar.unpackDir` mechanics beyond ADDING icon/appId/osxSign-slot fields. Build the CI matrix to `npm ci → make → test:smoke` with NO signing creds required. Mirror `MacShellProvider`/`MacReadinessProbe` patterns exactly for the Windows fills, keeping them electron-free + injected-deps so they unit-test on macOS in the Node env. The single biggest verification risk is that **real Windows shell/probe behavior cannot be proven on macOS** — those paths are CI-smoke-verifiable (does the packaged app boot + PTY round-trip on `windows-latest`) but the shell-enumeration *correctness* (does Git Bash actually get found) and the per-shell readiness-probe *byte semantics* are human-verify-on-real-Windows items.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Produce Windows `.exe`/installer | CI (GitHub Actions `windows-latest`) | — | No local Windows machine in the loop (D-01); CI is the only real Windows producer |
| Produce macOS `.app` | Local dev + CI (`macos-latest`) | — | Already works locally; CI provides reproducibility |
| ASAR-unpack node-pty native helpers | Packaging config (`forge.config.ts`) | Electron runtime (loads `.node` from `unpacked/`) | `.node`/`spawn-helper`/`conpty.node` cannot load from inside ASAR (CLAUDE.md) |
| Native-module ABI correctness | npm tarball prebuilds (ship-as-is) | postinstall opportunistic rebuild (online only) | N-API ABI-stable; rebuild is best-effort, never mandatory (D-06) |
| Windows shell enumeration | Main process (`shell-discovery.ts`, `WindowsShellProvider`) | — | OS-level filesystem/registry probing; main-only (no renderer fs) |
| Windows readiness probe | Main process (`readiness-probe.ts`, `WindowsReadinessProbe`) | — | Writes bytes into the PTY (main owns node-pty) |
| Pre-1809 OS gate | Main process boot (`index.ts`, before `createWindow`) | Native `dialog.showErrorBox` | Must fire before any node-pty spawn / window creation (D-05) |
| App icon + identity metadata | Packaging config (`packagerConfig` + makers) | `assets/` files | Forge resolves base `icon` + per-maker `setupIcon` |
| Packaged-app verification | CI smoke (WDIO) + human-verify | — | ASAR-internal PTY round-trip is automatable; `claude --rc` interactive launch is inherently human |

## Standard Stack

**This phase installs ZERO new runtime packages.** Every tool it needs is already an exact-pinned devDependency (verified in `package.json`). The "stack" here is the existing toolchain used in a new way (CI) plus config extensions.

### Core (already installed — versions verified in the repo)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `electron` | 36.9.5 | Desktop runtime | Pinned; node-pty N-API prebuild ABI-stable under it (verified Phase 2) |
| `node-pty` | 1.1.0 | PTY layer; ships per-triple prebuilds | `node-addon-api` (N-API), prebuilds for all 4 targets in the tarball — verified in `node_modules/node-pty/prebuilds/` |
| `@electron-forge/cli` | 7.11.2 | `make`/`package` driver | Official Electron packager |
| `@electron-forge/maker-squirrel` | 7.11.2 | Windows `.exe` installer (Setup.exe) | Default Forge Windows maker; unsigned by default (no `windowsSign` ⇒ no signtool) |
| `@electron-forge/maker-zip` | 7.11.2 | macOS `.app` → `.zip` distributable | `['darwin']`-scoped in config |
| `@electron-forge/plugin-auto-unpack-natives` | 7.11.2 | Forces `.node` files outside ASAR | Already in `plugins[]`; complements the manual `asar.unpackDir` |
| `@electron-forge/plugin-vite` | 7.11.2 | Renderer/main bundling | Already wired |
| `@electron/rebuild` | 4.0.4 | Opportunistic from-source rebuild (online only) | Used by postinstall; NEVER mandatory in packaging (D-06) |
| `electron-squirrel-startup` | 1.0.1 | Windows install/uninstall shortcut events | Already in boot guard (`if (started) app.quit()`) |
| `webdriverio` + `@wdio/electron-service` | ^9.27 / 10.0.0 | Packaged-app smoke driver | Already boots the packaged `.app` via `appBinaryPath` |

### Supporting (host tooling, no install)
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `iconutil` + `sips` | Generate `assets/icon.icns` (and resize PNG) on macOS | Placeholder icon generation (D-07). Both verified present at `/usr/bin/` |
| `actions/checkout@v4`, `actions/setup-node@v4` | CI primitives | The matrix workflow (D-01) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `maker-squirrel` (Windows) | `maker-wix` (MSI) / `electron-builder` NSIS | Squirrel is the Forge default and already configured; MSI/NSIS add config surface and aren't needed for MVP local install (PROJECT.md: no distribution pipeline) |
| Forge default packaging | `electron-builder` | electron-builder has more signing knobs (CLAUDE.md alternatives table) but Forge is the established choice here; do NOT switch frameworks in the final phase |
| Native `dialog.showErrorBox` gate (D-05) | In-renderer error screen | Native dialog is robust even if the renderer/PTY can't start (the exact "OS too old" case); D-05 locks native |

**Installation:** None. (No `npm install` step in this phase.) If the planner believes a package is needed, that is a signal the approach drifted from the locked decisions — re-check against D-01..D-08.

## Package Legitimacy Audit

> Phase 8 installs **no new external packages**. All tooling is pre-installed and exact-pinned. slopcheck/registry verification is therefore N/A for new installs; the table below records the verification of the *already-pinned* packaging-critical packages against the npm registry (done via `npm view`).

| Package | Registry | Status | slopcheck | Disposition |
|---------|----------|--------|-----------|-------------|
| `node-pty` | npm | `latest` = 1.1.0 (pinned) — verified `npm view` | N/A (no new install) | Keep (pinned) |
| `electron` | npm | `36.9.5` is the current 36.x patch — verified `npm view electron@36` | N/A | Keep (pinned) |
| `@electron-forge/cli` | npm | `latest` = 7.11.2 (pinned) — verified `npm view` | N/A | Keep (pinned) |

**Packages removed due to slopcheck [SLOP] verdict:** none (no new installs).
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────────┐
   developer (macOS) ───► │ npm run make (local)  ──► out/…darwin-arm64/.app │ ──► WDIO smoke (local) ──► human-verify claude --rc (SC2)
                          └─────────────────────────────────────────────────┘
                                              ▲
                                              │ same forge.config.ts (single codebase, PKG-01)
                                              ▼
   git push / PR  ──► GitHub Actions matrix ──┬──► macos-latest:  npm ci → make → test:smoke
                                              └──► windows-latest: npm ci → make → test:smoke ──► .exe / Setup.exe  (canonical Windows artifact, D-01)

   ──────────────────────────────────────────────────────────────────────────────────────────────────

   Packaged app boot (BOTH platforms):
     app.whenReady
        │  if (started) app.quit()            ◄── electron-squirrel-startup guard (existing)
        │  ── D-05 GATE ── win32 && buildNum(os.release()) < 17763 ? dialog.showErrorBox + app.quit()   [BEFORE window, BEFORE any node-pty spawn]
        │  store.load() → ptyManager.hydrate() → setStoreSignal()
        ▼  createWindow()
              renderer mounts SessionView → window.api.ptyCreate(...)  (IPC, main owns node-pty)
                                                   │
                                                   ▼
        node-pty loadNativeModule('pty')  ──► resolves app.asar.unpacked/…/node-pty/prebuilds/<plat>-<arch>/pty.node
              macOS:   uses native.dir + '/spawn-helper'   ◄── MUST be unpacked + executable bit set
              Windows: loadNativeModule('conpty')          ◄── conpty.node MUST be unpacked
```

File-to-implementation mapping is in the Component Responsibilities table below, NOT the diagram.

### Component Responsibilities

| Concern | File | Change Type |
|---------|------|-------------|
| CI matrix | `.github/workflows/build.yml` (NEW) | create |
| ASAR unpack / ignore keep-clause / no-op rebuild | `forge.config.ts` | EXTEND (add icon/appId/osxSign slots) — do NOT rewrite the existing mechanics |
| Windows shell enumeration | `src/main/shell-discovery.ts` (`WindowsShellProvider`) | fill stub |
| Windows readiness probe | `src/main/readiness-probe.ts` (`WindowsReadinessProbe`) | fill throw |
| Pre-1809 gate + parse helper | `src/main/index.ts` + a new pure `os-gate.ts` (suggested) | insert + new pure module |
| Icon assets | `assets/icon.{icns,ico,png}` (NEW) | create |
| Metadata (`appId`/`author`) | `package.json` + `forge.config.ts` | edit |
| OS-conditional binary path | `wdio.conf.ts` | edit |
| ASAR-internal PTY round-trip smoke | `tests/smoke/pty-roundtrip.smoke.test.ts` (extend) or new `asar-pty.smoke.test.ts` | extend/new |
| Local-open + packaging notes | `README.md` or `docs/PACKAGING.md` (NEW) | create |

### Pattern 1: Mirror `MacShellProvider` for `WindowsShellProvider` (D-02)
**What:** Keep the same shape — pure builder + injected `existsFn`, `$SHELL`/default-first so the dropdown is never empty.
**When to use:** Filling the Windows enumeration.
**Approach (detection strategy per shell — MEDIUM/ASSUMED, see Open Questions):**
```typescript
// src/main/shell-discovery.ts — WindowsShellProvider (electron-free; existsFn injected for tests)
// Candidate set (well-known paths + env expansion); filter to on-disk; the resolved
// default is ALWAYS included first (D-05 never-empty invariant, mirrors buildShellList).
//
// PowerShell (Windows PowerShell 5.x): %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe   [CITED: CLAUDE.md]
// PowerShell 7 (pwsh, optional):       %ProgramFiles%\PowerShell\7\pwsh.exe                            [ASSUMED]
// CMD:                                  %SystemRoot%\System32\cmd.exe                                   [ASSUMED]
// Git Bash:                            %ProgramFiles%\Git\bin\bash.exe  (also \Git\usr\bin\bash.exe)    [ASSUMED]
// WSL:                                 %SystemRoot%\System32\wsl.exe                                    [CITED: CLAUDE.md]
//
// Use process.env.SystemRoot / ProgramFiles / ProgramFiles(x86) for expansion (NOT hardcoded C:\).
// Label each entry by basename ('powershell.exe', 'cmd.exe', 'bash.exe', 'wsl.exe') OR a friendlier
// label map ({ 'powershell.exe': 'PowerShell', ... }) — labeling is Claude's discretion (D-02).
```
**Key correctness rule:** reuse `resolveShell()` for the always-present default (do NOT recompute — canonical_refs note). Note `resolveShell()` today returns `process.env.SHELL || '/bin/zsh'` with `['-l']` args — that is POSIX-shaped and **wrong for Windows**. The planner must decide whether the Windows fill also needs a Windows-aware default (e.g. `process.env.ComSpec` or `powershell.exe`) — this is an Open Question (the existing `WindowsShellProvider` stub already calls `resolveShell().shell`, which on Windows yields `/bin/zsh` since `$SHELL` is unset — a latent bug the fill must address).

### Pattern 2: Per-shell readiness probe (D-03) — send-vs-match per shell
**What:** Each Windows shell needs a marker that (a) changes no state and (b) produces a detectable line distinct from the echoed input. The POSIX `:` builtin does NOT exist in CMD/PowerShell.
**Per-shell candidates (MEDIUM/ASSUMED — must be byte-validated on real Windows):**

| Shell | Candidate no-op marker | Match token | Notes |
|-------|------------------------|-------------|-------|
| Git Bash | `: __JW_READY_<hex>__\r` (POSIX `:` works — it IS bash) | nonce after newline | Reuse `buildPosixProbe` verbatim — Git Bash is bash |
| WSL | `: __JW_READY_<hex>__\r` (the WSL default shell is POSIX) | nonce after newline | Reuse `buildPosixProbe`; the launched shell inside WSL is bash/zsh |
| CMD | `echo __JW_READY_<hex>__\r` OR `rem`-then-`echo` | nonce on a produced line | `echo` is non-state-changing; `rem` alone produces NO output so it can't be matched — use `echo` |
| PowerShell | `Write-Output '__JW_READY_<hex>__'` OR `'__JW_READY_<hex>__'` (bare string echoes) | nonce on a produced line | PowerShell has no `:` no-op; a bare string literal or `Write-Output` is side-effect-free |
| PowerShell (fallback) | — | — | If no reliable marker validates, **degrade**: emit the documented "auto-run unsupported on PowerShell" notice via the EXISTING `onPtyStatus` notice channel (zero new bridge key), exactly like the 05.1 ready-timeout notice |

**Critical constraint (CMD/PowerShell echo semantics):** unlike POSIX `:` (which produces nothing and the shell only re-prompts), `echo`/`Write-Output` **deliberately emit the token**. So the send-vs-match split is different: the SEND command itself contains the nonce AND the OUTPUT contains the nonce. The matcher must therefore key off the **produced output line**, not just "nonce after any newline" — the typed-echo of the command line ALSO contains the nonce. Safe approach: split the nonce so the SENT command builds the token from concatenation (e.g. `echo __JW_RE%NUL%ADY...` is fragile) — **simpler and recommended**: use a distinct SEND token vs MATCH token (send `echo JWPROBE<hex>` but the matched token is the OUTPUT which on CMD appears on its own line; gate on the token appearing **twice** or after the prompt line). This is genuinely shell-specific and is the single most fragile part of D-03 — **bound the research to what is byte-testable on a Windows runner and degrade-loudly otherwise** (the locked D-03 fallback).
**When in doubt, prefer the loud degrade** (D-03 explicit): a mis-fired auto-run that injects garbage into a `claude --rc` session is worse than a clear "auto-run unsupported on `<shell>` — start the command manually" notice.

### Pattern 3: Pure OS-gate parse helper (D-05)
**What:** An electron-free pure function that extracts the Windows build number from `os.release()` and decides the gate, so it unit-tests on macOS with fixture strings (mirrors `buildPosixProbe`/`parseEtcShells`).
```typescript
// src/main/os-gate.ts (suggested NEW pure module — electron-free, Vitest-importable)
export const MIN_WINDOWS_BUILD = 17763; // Windows 10 1809 (ConPTY minimum, CLAUDE.md)

/** PURE — extract the build number (3rd dotted component) from an os.release() string.
 *  Windows os.release() looks like "10.0.17763" — major.minor.BUILD. [VERIFIED: node os docs + node-pty's own parser]
 *  node-pty parses it with the same regex (/(\d+)\.(\d+)\.(\d+)/) and reads group 3. */
export function parseWindowsBuild(release: string): number | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(release);
  return m ? Number(m[3]) : null;
}

/** PURE — should the app refuse to launch? Only on win32 with a parseable build < 17763. */
export function isUnsupportedWindows(platform: NodeJS.Platform, release: string): boolean {
  if (platform !== 'win32') return false;
  const build = parseWindowsBuild(release);
  return build !== null && build < MIN_WINDOWS_BUILD;
}
```
**Wiring in `src/main/index.ts` (D-05 — exact placement):**
```typescript
// AFTER the existing `if (started) { app.quit(); }` squirrel guard, INSIDE app.whenReady,
// BEFORE store.load()/hydrate()/createWindow() (so it precedes any node-pty spawn path):
app.whenReady().then(async () => {
  if (isUnsupportedWindows(process.platform, os.release())) {
    dialog.showErrorBox(
      'Windows 10 build 1809 or later required',
      'Just-Wrapper needs Windows 10 build 1809 (10.0.17763) or newer for its ' +
        'terminal engine (ConPTY). Please update Windows and try again.',
    );
    app.quit();
    return; // do NOT proceed to load/hydrate/createWindow
  }
  const data = await store.load();
  // …existing boot…
});
```
**Note the threshold discrepancy (document it):** node-pty's OWN ConPTY gate is `>= 18309` (build 1903-era) for `_useConpty`, and BELOW that it silently falls back to **winpty** (which still ships in the win32 prebuild). The project deliberately treats winpty as "What NOT to Use" (CLAUDE.md) and gates at **17763 (1809)** per D-05/CLAUDE.md. So between builds 17763 and 18309 node-pty would use winpty — the project's gate at 17763 ALLOWS those builds to launch but they'd run winpty under the hood. **Confirm with the user whether the intended floor is 17763 (ConPTY introduced, CLAUDE.md stated min) or 18309 (node-pty's actual ConPTY threshold).** D-05 locks 17763; flagged in Open Questions as a product-correctness check, not a re-litigation.

### Pattern 4: GitHub Actions matrix (D-01)
**What:** A 2-OS matrix, each leg `npm ci → make → test:smoke`, no signing creds. node-pty needs NO Python/node-gyp on the runner because the prebuild ships in the tarball.
```yaml
# .github/workflows/build.yml  (NEW — D-01)
name: build
on: [push, pull_request]
jobs:
  make:
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20          # Node 20/22 LTS; matches Electron 36's bundled Node-ish ABI surface
          cache: npm
      - run: npm ci                 # postinstall (fix-node-pty.cjs) runs here: opportunistic online rebuild + spawn-helper chmod
      - run: npm run make           # Forge: package + maker-squirrel (win) / maker-zip (mac), UNSIGNED
      - run: npm run test:smoke     # WDIO against the packaged binary (ASAR-internal PTY round-trip, SC3)
      - uses: actions/upload-artifact@v4
        with:
          name: just-wrapper-${{ matrix.os }}
          path: out/make/**
```
**Caveats verified:**
- `maker-squirrel` is **unsigned by default** — it only invokes signtool if you configure `windowsSign` [VERIFIED: forge issue #3677/#3770 describe `windowsSign` as the opt-in path]. So leaving signing slots empty produces a runnable unsigned `.exe`/`Setup.exe` on `windows-latest` with no creds (satisfies D-01/D-04).
- WDIO smoke on the runner needs a display. `windows-latest` and `macos-latest` GitHub runners have a desktop session; Electron + WDIO generally run headed there. **If the smoke flakes for lack of a display, gate `test:smoke` behind the produced binary existing and treat smoke as best-effort on CI with the human-verify as the SC2 gate** (consistent with D-08's "CI runners don't have `claude`" reality). Flagged in Validation Architecture.
- `fail-fast: false` so a Windows-only flake doesn't kill the macOS leg.

### Anti-Patterns to Avoid
- **Reintroducing a network-mandatory packaging rebuild** (`rebuildConfig.onlyModules: ['node-pty']` or removing the no-op). D-06 + the stale-ROADMAP warning: this makes the build MORE fragile (ECONNRESET offline), not less. The N-API prebuild is ABI-stable.
- **Rewriting `forge.config.ts`'s `ignore`/`asar.unpackDir`/`rebuildConfig`.** They are proven. EXTEND only (add `icon`, `appId`, `osxSign`/`osxNotarize` slots).
- **Hardcoding a non-macOS shell path in `resolveShell()`** that breaks the macOS-first case — the existing comment explicitly warns against this.
- **Committing any Apple credential or `osxSign` identity string.** Env-gate everything (`process.env.APPLE_ID ? {...} : undefined`).
- **Loading `.node` from inside ASAR** or running node-pty in the renderer (CLAUDE.md "What NOT to Use" — already correctly avoided; don't regress).
- **Adding a new bridge key.** The security guard asserts exactly 20 `EXPECTED_API_KEYS`. The D-03 degrade-notice reuses the existing `onPtyStatus` notice channel (like 05.1) — zero new keys. Packaging adds zero keys.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unpacking `.node` from ASAR | A custom post-make copy script | `AutoUnpackNativesPlugin` + `asar.unpackDir` (already in config) | Forge handles the unpacked path resolution; both are already wired and proven |
| Rebuilding node-pty per Electron ABI | A mandatory `electron-rebuild` in packaging | Ship the N-API prebuild (no-op `rebuildConfig`) + opportunistic postinstall | N-API is ABI-stable; rebuild only helps online and must never block (D-06) |
| Windows installer | A custom NSIS/Inno script | `maker-squirrel` (already configured) | Forge's default; unsigned-by-default works on CI |
| macOS `.icns` generation | A hand-rolled icon binary | `iconutil -c icns` from an `.iconset` (sips-resized PNGs) | Native macOS tooling, present at `/usr/bin/` (verified) |
| Windows build-number detection | A WMI/registry query | `os.release()` + regex (3rd component) | node-pty itself uses exactly this; no native call needed |
| Per-shell readiness | A timer/sleep settle | The existing send-vs-match probe seam (per-shell marker) | The settle-delay approach is what caused the original Phase-3 TERM-05 deferral |

**Key insight:** Almost everything this phase needs already exists in the toolchain or the codebase. The *new code* is narrow: a pure OS-gate module, two Windows seam fills, a CI YAML, and config-field additions. Resist building anything custom for unpacking/rebuilding/installing.

## Runtime State Inventory

> Phase 8 is a packaging + seam-fill phase, NOT a rename/refactor/migration. This section is included because it touches OS-registered state (Squirrel shortcuts) and packaged artifacts.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | lowdb store `just-wrapper-store.json` in `userData` — packaging does NOT change its schema or path. Verified: `SessionStore` resolves the path via `app.getPath` at runtime, unaffected by packaging. | None — verified by reading `index.ts` boot sequence |
| Live service config | None — no external services (local-only by design, PROJECT.md). | None |
| OS-registered state | `electron-squirrel-startup` creates/removes Start-menu/desktop shortcuts on Windows install/uninstall (the `if (started) app.quit()` guard handles the create/remove events). The `setupIcon` (D-07) feeds the Setup.exe icon. | Verify the squirrel guard stays first in boot (it does); the D-05 gate inserts AFTER it |
| Secrets/env vars | NONE committed. D-04 sign slots read `process.env.APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID` (absent ⇒ skip). CI needs NO secrets this phase. | Env-gate only; never commit |
| Build artifacts | `out/Just-Wrapper-darwin-arm64/` already exists (a prior local `make`). `out/make/**` is the installer output. These are gitignored build artifacts. node-pty `prebuilds/<triple>/` are shipped, not built. | None — `out/` is regenerated by `make`; ensure it's gitignored |

## Common Pitfalls

### Pitfall 1: spawn-helper loses its execute bit in the packaged app
**What goes wrong:** `pty.fork()` fails with `posix_spawnp failed` because `spawn-helper` (loaded as `native.dir + '/spawn-helper'`) is non-executable.
**Why it happens:** npm tarball extraction drops the execute bit; ASAR unpack may not preserve it.
**How to avoid:** `scripts/fix-node-pty.cjs` already `chmod +x`'s every prebuild's `spawn-helper` in postinstall. Verify the smoke proves a real PTY round-trip *in the packaged app* (it does today, macOS) so a stripped bit surfaces. On CI the postinstall runs during `npm ci`. **The packaged-app smoke (D-08) is the detector** — if spawn-helper isn't executable inside `app.asar.unpacked`, the PTY round-trip fails.
**Warning signs:** `posix_spawnp failed` in the packaged app but not `npm start`.

### Pitfall 2: Windows `conpty.node` not unpacked → MODULE load failure
**What goes wrong:** Packaged Windows app can't load `conpty.node` from inside ASAR.
**Why it happens:** If the `asar.unpackDir`/`AutoUnpackNativesPlugin` coverage misses the Windows-specific `conpty.node`/`conpty/` subdir.
**How to avoid:** `asar.unpackDir: '**/node_modules/node-pty/**'` is a recursive glob that covers `prebuilds/win32-x64/conpty.node` AND the `conpty/` subdir. The CI Windows smoke is the proof. Verify the unpack glob still matches after any config edit.
**Warning signs:** Windows-only "Cannot find module" / native load error at first PTY spawn.

### Pitfall 3: `resolveShell()` returns a POSIX path on Windows
**What goes wrong:** `WindowsShellProvider` stub calls `resolveShell().shell` which today returns `/bin/zsh` on Windows (since `$SHELL` is unset) — a non-existent path, so the on-disk filter drops it and the dropdown could be empty.
**Why it happens:** `resolveShell()` is macOS-shaped (`process.env.SHELL || '/bin/zsh'`, `['-l']`).
**How to avoid:** The D-02 fill MUST provide a Windows-aware default (e.g. `process.env.ComSpec` for cmd, or the PowerShell path) so the never-empty invariant truly holds on Windows. Do NOT rely on `resolveShell()` alone for the Windows default.
**Warning signs:** Empty shell dropdown on Windows; CI Windows smoke can't create a session.

### Pitfall 4: Squirrel maker silently tries to sign
**What goes wrong:** Build hangs or errors invoking signtool on CI.
**Why it happens:** A stray `windowsSign`/`certificateFile` config, or Squirrel's auto-sign path. [VERIFIED: forge #3315 documents a GitHub-Actions hang related to signing]
**How to avoid:** Leave `MakerSquirrel({})` with NO `windowsSign` (current config is correct). Do not add cert config. Unsigned is the locked D-04 choice.
**Warning signs:** CI Windows leg hangs at the make step.

### Pitfall 5: macOS quarantine blocks the unsigned `.app`
**What goes wrong:** Double-clicking the unsigned `.app` shows "damaged / can't be opened".
**Why it happens:** Gatekeeper quarantine on an unsigned, un-notarized app.
**How to avoid:** Document the local-open path (D-04): right-click → Open, or `xattr -dr com.apple.quarantine <app>`. This is a README note, not a code change.
**Warning signs:** User reports the app won't launch after download (not relevant for a locally-built `.app`, only a transferred one).

### Pitfall 6: Per-shell echo-probe matches its own command echo (CMD/PowerShell)
**What goes wrong:** The readiness matcher fires on the typed command's echo, not the shell's produced output, so the auto-run injects before the shell is truly ready (the exact pexpect send-vs-match bug the macOS probe already guards).
**Why it happens:** `echo`/`Write-Output` put the nonce in BOTH the echoed input line and the output line — unlike POSIX `:` which produces no output.
**How to avoid:** Use distinct send-vs-match tokens, or require the nonce to appear on a line that is NOT the command-echo line (after a fresh prompt). **Byte-validate on a real Windows runner**; if it can't be made reliable, degrade-loudly (D-03). This is the single most fragile fill.
**Warning signs:** Garbled/early auto-run on Windows; the canonical `claude --rc` scenario mis-fires on CMD/PowerShell.

## Code Examples

### macOS placeholder icon generation (D-07) — host tooling, runs on macOS
```bash
# Generate assets/icon.icns from a 1024px placeholder PNG (iconutil + sips both verified at /usr/bin).
# Source: macOS native iconutil/sips workflow.
mkdir -p assets/icon.iconset
for s in 16 32 64 128 256 512; do
  sips -z $s   $s   placeholder-1024.png --out assets/icon.iconset/icon_${s}x${s}.png
  sips -z $((s*2)) $((s*2)) placeholder-1024.png --out assets/icon.iconset/icon_${s}x${s}@2x.png
done
iconutil -c icns assets/icon.iconset -o assets/icon.icns
sips -z 512 512 placeholder-1024.png --out assets/icon.png   # Linux/base PNG
# .ico must be a REAL multi-size ICO (256x256), NOT a renamed PNG (Forge fails otherwise — VERIFIED).
# Generate on macOS via a tool that writes true ICO, or commit a prebuilt placeholder .ico.
```

### forge.config.ts EXTENSION (D-04 + D-07) — add, do not rewrite
```typescript
// Source: Electron Forge macOS code-signing docs (osxSign/osxNotarize shape) + icon docs.
const config: ForgeConfig = {
  packagerConfig: {
    name: 'Just-Wrapper',
    appBundleId: 'com.justwrapper.app',          // macOS bundle id (D-07)
    icon: 'assets/icon',                         // NO extension — Forge appends .icns/.ico per platform (VERIFIED)
    asar: { unpackDir: '**/node_modules/node-pty/**' }, // unchanged
    ignore: /* unchanged keep-clause */ undefined as never,
    // D-04 sign slots — env-gated so absent creds skip signing cleanly:
    osxSign: process.env.APPLE_IDENTITY ? {} : undefined,           // {} = sign with default identity when present
    osxNotarize: process.env.APPLE_ID
      ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_PASSWORD!,
          teamId: process.env.APPLE_TEAM_ID!,
        }
      : undefined,
  },
  rebuildConfig: { onlyModules: [] },            // unchanged no-op (D-06)
  makers: [
    new MakerSquirrel({ setupIcon: 'assets/icon.ico' }),  // Windows Setup.exe icon (D-07) — REAL .ico
    new MakerZIP({}, ['darwin']),
    new MakerDeb({}), new MakerRpm({}),          // out-of-phase but harmless
  ],
  // plugins unchanged (AutoUnpackNatives + Vite)
};
```
**Note:** `osxSign: process.env.X ? {} : undefined` — when undefined, Forge ships an unsigned `.app` (the D-04 default). When the env var is later set, it's a config-free flip. [CITED: Electron Forge macOS code-signing docs — `osxNotarize` strategy-1 fields appleId/appleIdPassword/teamId; `osxSign: {}` "object must exist even if empty"].

### wdio.conf.ts OS-conditional binary (D-08)
```typescript
// Source: existing wdio.conf.ts (hardcoded macOS path) + Forge out/ naming convention.
import os from 'node:os';
const appBinaryPath =
  process.platform === 'win32'
    ? `./out/Just-Wrapper-win32-${os.arch()}/Just-Wrapper.exe`
    : `./out/Just-Wrapper-darwin-${os.arch()}/Just-Wrapper.app/Contents/MacOS/Just-Wrapper`;
// …capabilities[0]['wdio:electronServiceOptions'].appBinaryPath = appBinaryPath;
```
**CI stand-in PTY round-trip (D-08, no `claude` on runners):** the existing `pty-roundtrip.smoke.test.ts` already proves PTY-works-inside-ASAR via `echo hello` + `echo $TERM`. On Windows the stand-in must be shell-appropriate (e.g. `echo hello` works in cmd/PowerShell; `echo %CD%`/`Get-Location` for a CWD check). The smoke proves SC3 (PTY round-trip inside the packaged ASAR app); SC2 (`claude --rc` interactive) is the human-verify.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `electron-rebuild` mandatory in packaging | Ship N-API prebuild, no-op `rebuildConfig` | node-pty went N-API (`node-addon-api`); verified Phase 2 | No network needed to package; offline-safe (D-06) |
| winpty on Windows | ConPTY (node-pty default ≥ build 18309) | Windows 10 1809+/1903 | Project gates at 1809 (17763) and treats winpty as out (CLAUDE.md) |
| Manual `out/` path in WDIO | Forge auto-detect / OS-conditional path | This phase (D-08) | Windows + macOS from one harness |

**Deprecated/outdated (do NOT reintroduce):**
- ROADMAP Phase-8 line "@electron/rebuild in CI" — STALE (D-06). The postinstall's opportunistic rebuild already satisfies the spirit; a mandatory rebuild is a regression.
- winpty — node-pty still ships it in the win32 prebuild but the project's 1809 gate + CLAUDE.md exclude it.

## Assumptions Log

> Claims tagged `[ASSUMED]` that need user/real-Windows confirmation before they become locked.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PowerShell 7 path `%ProgramFiles%\PowerShell\7\pwsh.exe` | Pattern 1 (D-02) | Missing/wrong path → that entry absent from dropdown (graceful — on-disk filter drops it) |
| A2 | CMD path `%SystemRoot%\System32\cmd.exe` | Pattern 1 (D-02) | Low — cmd is ubiquitous; on-disk filter handles a wrong path |
| A3 | Git Bash path `%ProgramFiles%\Git\bin\bash.exe` (or `\usr\bin\`) | Pattern 1 (D-02) | Git Bash not detected on non-default installs (well-known-path heuristic; registry would be more robust) |
| A4 | CMD readiness marker = `echo <nonce>` with output-line match | Pattern 2 (D-03) | Mis-fire risk → degrade-loudly fallback (locked D-03) |
| A5 | PowerShell readiness marker = bare string / `Write-Output` | Pattern 2 (D-03) | Mis-fire risk → degrade-loudly fallback (locked D-03) |
| A6 | The intended Windows floor is 17763 (1809), not 18309 (node-pty's ConPTY threshold) | Pattern 3 (D-05) | Builds 17763–18308 launch but run winpty under the hood; product-correctness question |
| A7 | GitHub `windows-latest`/`macos-latest` runners can run a headed WDIO Electron smoke | Pattern 4 (D-01) / Validation | If headless-only, CI smoke flakes → treat as best-effort, human-verify is the SC2 gate |
| A8 | A real multi-size `.ico` can be produced/committed from the macOS dev box | Code Examples (D-07) | If not, ship a prebuilt placeholder `.ico` committed to `assets/` |

## Open Questions

1. **Windows OS floor: 17763 vs 18309?**
   - What we know: CLAUDE.md states ConPTY min = 1809 (17763); D-05 locks 17763. node-pty's own `_useConpty` gate is `>= 18309` and falls back to winpty below that.
   - What's unclear: between 17763 and 18308 the app would launch but use winpty (which CLAUDE.md excludes).
   - Recommendation: Implement D-05 as locked (17763). Surface this to the user as a one-line product note — if they want a "ConPTY guaranteed" floor, the constant becomes 18309. Do NOT block on it.

2. **`resolveShell()` Windows default.**
   - What we know: today it returns `/bin/zsh` on Windows (no `$SHELL`), which the on-disk filter would drop.
   - What's unclear: should the Windows default be `cmd.exe` (ComSpec), `powershell.exe`, or the first-found of the enumeration?
   - Recommendation: `WindowsShellProvider` should compute its own Windows-aware default (ComSpec/PowerShell) and place it first, independent of `resolveShell()`. Planner's call on which.

3. **Can CMD/PowerShell readiness be made byte-reliable, or do they degrade?**
   - What we know: Git Bash + WSL reuse `buildPosixProbe` (they're POSIX). CMD/PowerShell have no `:` no-op.
   - What's unclear: whether a robust send-vs-match marker exists for CMD/PowerShell without real-Windows byte captures.
   - Recommendation: Implement Git Bash + WSL via the POSIX probe (high confidence). Attempt CMD/PowerShell `echo`/`Write-Output` markers; if a Windows-runner byte test can't confirm reliability, **degrade-loudly** per D-03 (the locked fallback). Bound the scope here.

4. **Is the CI WDIO smoke reliable on GitHub runners, or best-effort?**
   - What we know: the smoke boots the packaged binary headed; runners have a desktop.
   - What's unclear: Electron+WDIO stability on `windows-latest` CI specifically.
   - Recommendation: Make `make` the hard gate (artifact must build) and `test:smoke` the strong-preferred gate; if it flakes, keep the artifact-builds + the human-verify (SC2) as the binding gates. Document in Validation Architecture.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `iconutil` | macOS `.icns` generation (D-07) | ✓ | macOS builtin | Commit a prebuilt `.icns` |
| `sips` | PNG resize for iconset (D-07) | ✓ | macOS builtin | Commit prebuilt PNGs |
| `node-pty` win32 prebuild | Windows packaged PTY (PKG-01/SC3) | ✓ (in tarball) | win32-x64 + win32-arm64 `pty.node`/`conpty.node` | none needed — ships prebuilt |
| GitHub Actions `windows-latest` | Windows artifact producer (D-01) | ✓ (CI) | runner image | none — this IS the Windows producer |
| Real Windows hardware | Shell-enumeration + readiness-probe *correctness* (D-02/D-03) | ✗ (user has a machine, not in CI loop) | — | CI smoke proves boot+PTY; correctness is human-verify on user's machine |
| Apple Developer creds | Real signing/notarization (out of phase, D-04) | ✗ | — | unsigned `.app` + local-open doc |
| true multi-size `.ico` writer | Windows `setupIcon` (D-07) | ? on macOS | — | commit a prebuilt placeholder `.ico` (A8) |

**Missing dependencies with no fallback:** none that block the phase. Real-Windows shell/probe *correctness* has no macOS automation — it is a human-verify item (acceptable per D-08).
**Missing dependencies with fallback:** Apple creds (→ unsigned + doc); `.ico` writer on macOS (→ commit prebuilt placeholder).

## Validation Architecture

> `workflow.nyquist_validation: true` (verified in `.planning/config.json`) — this section is REQUIRED and feeds the orchestrator's VALIDATION.md (Nyquist gate).

### Test Framework
| Property | Value |
|----------|-------|
| Framework (unit) | Vitest 4.1.8 (`vitest run`) — Node env, electron-free pure modules |
| Framework (smoke) | WebdriverIO 9.x + `@wdio/electron-service` 10.0.0 against the **packaged** binary |
| Config file | `wdio.conf.ts` (smoke), `vitest` default (unit) |
| Quick run command | `npm run test:unit` (Vitest) |
| Full suite command | `npm test` (`test:unit && test:smoke`) |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| SC1 / PKG-01 | `npm run make` produces runnable `.app` (mac) + `.exe`/installer (win) | CI artifact build | `npm run make` (both matrix legs) | ❌ Wave 0 — `.github/workflows/build.yml` |
| SC3 | PTY round-trip works inside the ASAR-packaged app (spawn-helper/conpty.node outside ASAR) | smoke (packaged) | `npm run test:smoke` (extend `pty-roundtrip.smoke.test.ts`, OS-conditional path) | ✅ exists (extend) + ❌ Wave 0 `wdio.conf.ts` OS-conditional |
| SC4 | Pre-1809 Windows shows the error dialog instead of crashing | unit (pure gate) | `vitest run` (new `os-gate.test.ts`: parse + `isUnsupportedWindows` fixtures) | ❌ Wave 0 — `src/main/os-gate.ts` + test |
| D-02 | `WindowsShellProvider` enumerates + never-empty | unit | `vitest run` (mirror `shell-discovery` tests; injected `existsFn` fixtures) | ❌ Wave 0 — extend `shell-discovery` tests |
| D-03 | `WindowsReadinessProbe.forShell()` per-shell marker / degrade | unit | `vitest run` (mirror `readiness-probe` tests; per-shell marker + send-vs-match) | ❌ Wave 0 — extend `readiness-probe` tests |
| SC2 | Canonical `Parlour Claude RC` / 🛋️ / `claude --rc` launches interactively in the packaged app | **human-verify (blocking)** | manual — macOS primary, Windows best-effort on user's machine | N/A — human gate |
| invariant | Security guard stays at exactly 20 `EXPECTED_API_KEYS` | unit | `vitest run` (security.guard) | ✅ exists (must stay GREEN) |

### Sampling Rate
- **Per task commit:** `npm run test:unit` (fast; covers os-gate, shell-discovery, readiness-probe pure helpers).
- **Per wave merge / pre-package:** `npm test` (unit + packaged smoke) locally on macOS.
- **Phase gate:** Both CI matrix legs green (make + smoke) on `windows-latest` + `macos-latest`, full suite green locally, THEN the blocking canonical human-verify (SC2). nyquist_compliant flips only on explicit user approval (every prior phase's pattern).

### Wave 0 Gaps
- [ ] `.github/workflows/build.yml` — the 2-OS matrix (D-01) — covers SC1 + drives the SC3 smoke on Windows
- [ ] `src/main/os-gate.ts` + `os-gate.test.ts` — pure parse + gate (D-05/SC4)
- [ ] `wdio.conf.ts` — OS-conditional `appBinaryPath` (D-08/SC3)
- [ ] Extend `shell-discovery` unit tests for `WindowsShellProvider` (D-02) — injected `existsFn` fixtures, never-empty assertion
- [ ] Extend `readiness-probe` unit tests for `WindowsReadinessProbe` (D-03) — per-shell marker + send-vs-match + degrade-notice
- [ ] Extend `pty-roundtrip.smoke.test.ts` (or new `asar-pty.smoke.test.ts`) for an OS-appropriate stand-in command (D-08)
- [ ] `assets/icon.{icns,ico,png}` placeholder (D-07)
- [ ] `docs/PACKAGING.md` (or README note) — local-open path (D-04)

## Security Domain

> `security_enforcement` not explicitly false → included. This phase is local-only desktop packaging (no network, no auth, no user-supplied web input), so most ASVS web categories are N/A. The security-relevant surface is: secret handling (no committed creds), native-module trust, and the contextBridge invariant.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface (local desktop app) |
| V3 Session Management | no | No web sessions |
| V4 Access Control | no | No multi-user / no remote access |
| V5 Input Validation | partial | PTY IPC args already validated in main (existing); the Windows readiness marker must not inject attacker-controlled bytes — the nonce is crypto-random/literal |
| V6 Cryptography | no (n/a strength) | Nonce is uniqueness-only (no crypto-strength requirement, per existing comment) |
| V14 Configuration / Secrets | **yes** | No hardcoded Apple creds; env-gated sign slots; CI needs no secrets this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Committed signing credential | Information Disclosure | Env-gate `osxSign`/`osxNotarize` (`process.env.X ? {} : undefined`); never commit; CI uses no secrets this phase (D-04) |
| Loading a tampered/untrusted native `.node` | Tampering | Ship the pinned node-pty prebuild from the locked tarball; exact-pinned dep; no dynamic download at runtime |
| Renderer gaining raw IPC / fs access | Elevation of Privilege | contextBridge-only invariant (20 `EXPECTED_API_KEYS`, security.guard GREEN); packaging adds zero keys; node-pty stays in main |
| Readiness-probe byte injection | Tampering | Nonce is a literal/random token built in main; degrade-loudly rather than inject on an unverified shell (D-03) |
| Unsigned app tampered post-build | Tampering | Out of phase (no notarization this phase); documented as a known limitation; D-04 wires the later sign flip |

## Sources

### Primary (HIGH confidence)
- Installed `node_modules/node-pty/` tree (version 1.1.0, `node-addon-api` dep, `loadNativeModule` in `lib/utils.js`, prebuilds for darwin-arm64/darwin-x64/win32-arm64/win32-x64, `_getWindowsBuildNumber` regex in `lib/windowsPtyAgent.js`) — verified by direct read/grep
- Project files: `forge.config.ts`, `package.json`, `src/main/index.ts`, `src/main/shell-discovery.ts`, `src/main/readiness-probe.ts`, `src/main/shell-resolver.ts`, `wdio.conf.ts`, `scripts/fix-node-pty.cjs`, `.planning/{CONTEXT,REQUIREMENTS,ROADMAP,STATE}.md`, `.planning/config.json` — read directly
- `node --version`/`os.release()`/`iconutil`/`sips` availability — verified via Bash on the dev box
- [Electron Forge macOS code-signing docs](https://www.electronforge.io/guides/code-signing/code-signing-macos) — `osxSign: {}` + `osxNotarize` field shapes (appleId/appleIdPassword/teamId)
- [Electron Forge Custom App Icons](https://www.electronforge.io/guides/create-and-add-icons) — `icon` (no extension) + per-maker `setupIcon`; `.ico` must be a real ICO

### Secondary (MEDIUM confidence)
- [Build and Publish a Multi-Platform Electron App on GitHub](https://dev.to/erikhofer/build-and-publish-a-multi-platform-electron-app-on-github-3lnd) — matrix workflow shape (`runs-on: ${{ matrix.os }}`, `npm ci`, `npm run make`)
- [Electron Forge issue #3677 / #3770](https://github.com/electron/forge/issues/3677) — `windowsSign` is the opt-in signing path (unsigned Squirrel works without it)
- [Electron Forge issue #3315](https://github.com/electron/forge/issues/3315) — GitHub-Actions signing hang (why to keep `windowsSign` unset)
- [Node.js os.release() / GeeksforGeeks](https://www.geeksforgeeks.org/node-js-os-release-method/) — Windows format `10.0.<build>`; build is the 3rd component

### Tertiary (LOW confidence — flagged for real-Windows validation)
- Windows shell install paths (PowerShell 7, Git Bash, CMD) — well-known-path heuristics, ASSUMED (A1–A3)
- CMD/PowerShell readiness markers — ASSUMED, must be byte-validated on a Windows runner or degrade-loudly (A4–A5)

## Metadata

**Confidence breakdown:**
- Packaging mechanics (ASAR/unpack/rebuild/prebuilds): HIGH — verified directly from the installed node-pty tree + proven by the existing macOS `.app` + 14/14 smokes
- CI matrix YAML: MEDIUM — standard Forge pattern, but WDIO-on-CI stability and exact runner behavior unverified until it runs (A7)
- D-05 OS gate: HIGH on the parse mechanics (mirrors node-pty's own regex), MEDIUM on the 17763-vs-18309 threshold choice (product question, A6)
- D-02 Windows shell enumeration: MEDIUM — pattern is clear (mirror Mac provider), but the actual install paths are ASSUMED (A1–A3)
- D-03 Windows readiness probe: MEDIUM/LOW — Git Bash/WSL high (POSIX reuse), CMD/PowerShell low (no `:` no-op; degrade-loudly is the locked safety net)
- D-04/D-07 config slots + icon: HIGH — verified Forge config shapes + macOS icon tooling present

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable toolchain; pinned deps. Re-verify only if Electron/node-pty/Forge versions bump — they should NOT this phase.)
