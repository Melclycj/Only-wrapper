---
phase: 08-cross-platform-packaging
plan: 01
subsystem: packaging
tags: [electron-forge, packaging, node-pty, conpty-gate, macos, icon, signing-slots, wdio-smoke]
requires:
  - "forge.config.ts proven ASAR-unpack + ignore keep-clause + no-op rebuild (Phase 2/5)"
  - "wdio.conf.ts packaged-binary smoke harness (Phase 2)"
  - "20-key contextBridge invariant (security.guard, Phase 7)"
provides:
  - "src/main/os-gate.ts — pure parseWindowsBuild + isUnsupportedWindows + MIN_WINDOWS_BUILD (SC4 logic)"
  - "ConPTY pre-window native-dialog gate wired in index.ts before any node-pty spawn (D-05)"
  - "assets/icon.{icns,ico,png} placeholder + forge icon/appId pipeline (D-07)"
  - "env-gated osxSign/osxNotarize slots — unsigned by default, no secret committed (D-04)"
  - "OS-conditional wdio appBinaryPath + win32-guarded packaged PTY smoke (D-08/SC1mac/SC3)"
affects:
  - "src/main/index.ts boot sequence"
  - "forge.config.ts packagerConfig + MakerSquirrel"
  - "package.json metadata"
  - "wdio.conf.ts + tests/smoke/pty-roundtrip.smoke.test.ts"
tech-stack:
  added: []
  patterns:
    - "Electron-free pure OS-gate module (mirrors shell-resolver.ts) — fail-OPEN on unparseable release"
    - "Env-gated Forge sign/notarize slots: process.env.X ? {...} : undefined (config-free flip, never a committed secret)"
    - "Real multi-size .ico (PNG-compressed entries) — not a renamed PNG"
    - "OS-conditional packaged-binary path + it.skip win32 guards for POSIX-only smoke assertions"
key-files:
  created:
    - "src/main/os-gate.ts"
    - "src/main/__tests__/os-gate.test.ts"
    - "assets/icon.icns"
    - "assets/icon.ico"
    - "assets/icon.png"
    - "assets/README.md"
    - "docs/PACKAGING.md"
  modified:
    - "src/main/index.ts"
    - "forge.config.ts"
    - "package.json"
    - "wdio.conf.ts"
    - "tests/smoke/pty-roundtrip.smoke.test.ts"
decisions:
  - "MIN_WINDOWS_BUILD locked at 17763 (D-05); node-pty's own ConPTY threshold (18309) preserved as a code comment for human confirmation, NOT silently changed"
  - "Gate fails OPEN on an unparseable os.release() — a parse quirk must never brick a supported host"
  - "Unsigned macOS .app this phase (D-04); osxSign/osxNotarize env-gated; zero Apple secret committed"
  - "Placeholder icon ships now (D-07); real branded icon is a later file-swap with config untouched"
  - "Packaged PTY echo round-trip is the cross-platform SC3 invariant; $TERM + Ctrl+C/SIGINT guarded to non-win32"
metrics:
  duration: "~7min"
  completed: "2026-06-10"
  tasks: 3
  files: 12
---

# Phase 8 Plan 01: macOS-Buildable Packaging Slice Summary

Delivered the macOS-buildable end-to-end packaging slice — `npm run make` now produces a runnable, icon-bearing, `com.justwrapper.app`-identified `.app` with no manual post-processing; the pre-1809 Windows ConPTY gate fires as a native dialog before any node-pty spawn; and the WDIO smoke proves a PTY round-trips from inside the ASAR archive against an OS-conditional binary path. SC1(mac), SC3(mac), and SC4(logic) are real and verified on the dev box; the Windows leg is deferred to the CI matrix (Plan 03).

## What Was Built

| Task | Capability | Commit |
|------|-----------|--------|
| 1 | Pure `os-gate.ts` (parse + gate) + ConPTY pre-window boot gate in `index.ts` (D-05/SC4) | `3fbcca4` |
| 2 | Icon pipeline + appId/author metadata + env-gated osxSign/osxNotarize slots (D-04/D-07) | `8cc277d` |
| 3 | OS-conditional wdio `appBinaryPath` + win32-guarded packaged PTY smoke; real make+smoke proof (D-08/SC1mac/SC3) | `a0bbbac` |

### Task 1 — OS gate (D-05 / SC4)
- `src/main/os-gate.ts`: electron-free pure module. `MIN_WINDOWS_BUILD = 17763`, `parseWindowsBuild(release)` (regex `/(\d+)\.(\d+)\.(\d+)/`, reads group-3 BUILD), `isUnsupportedWindows(platform, release)` (true only when `win32` AND parseable build `< floor`; fail-OPEN on unparseable; non-win32 never gated).
- 9 fixture-string unit tests, all GREEN.
- Wired at the TOP of `app.whenReady`, BEFORE `store.load()` — on a pre-1809 host it calls `dialog.showErrorBox(...)` → `app.quit()` → `return`, so the gate precedes every node-pty spawn path. The module-scope squirrel `if (started) app.quit()` guard stays first.

### Task 2 — icon + metadata + sign slots (D-04 / D-07)
- `assets/icon.{icns,ico,png}` placeholder JW mark. `icon.icns` built via `iconutil`/`sips`; `icon.ico` is a **real multi-size ICO** (16/32/48/64/128/256), `file` reports "MS Windows icon resource", **not** a renamed PNG.
- `forge.config.ts` EXTENDED (additive only): `name`, `appBundleId: 'com.justwrapper.app'`, `icon: 'assets/icon'` (no extension), env-gated `osxSign`/`osxNotarize`, `MakerSquirrel({ setupIcon: 'assets/icon.ico' })`. The proven `asar.unpackDir`, the `ignore` keep-clause, and `rebuildConfig.onlyModules: []` (D-06) are **byte-for-byte unchanged** (diff confirmed additive). `windowsSign` left UNSET (Pitfall 4).
- `package.json`: `author: "Just-Wrapper"` + `appId: "com.justwrapper.app"`; scripts/deps unchanged.
- `docs/PACKAGING.md`: make overview, `xattr -dr com.apple.quarantine` local-open path, env-gated signing flip table. **No Apple secret committed** (negative grep passes).

### Task 3 — packaged smoke + proof (D-08 / SC1mac / SC3)
- `wdio.conf.ts`: `appBinaryPath` is now a `process.platform === 'win32'` ternary using `os.arch()`.
- `tests/smoke/pty-roundtrip.smoke.test.ts`: stale RED banner removed; `echo hello` round-trip is the cross-platform SC3 invariant; `$TERM`/`xterm-256color` and Ctrl+C/SIGINT guarded to non-win32 (`it.skip` on win32). Zero new bridge key.

## Verification Evidence

### `npm run make` (SC1 mac) — exit 0
```
✔ Packaging for arm64 on darwin
✔ Packaging application
✔ Making a zip distributable for darwin/arm64
✔ Making distributables
› Artifacts available at: /Users/jerry/Project/Just-wrapper/out/make
```
Post-make checks:
- `out/Just-Wrapper-darwin-arm64/Just-Wrapper.app` exists.
- `Contents/Resources/electron.icns` = 287122 bytes (matches `assets/icon.icns`) — placeholder icon applied.
- `CFBundleIdentifier` = `com.justwrapper.app`.
- `spawn-helper` unpacked + executable: `-rwxr-xr-x ... app.asar.unpacked/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper`.

### `npm run test:smoke` — packaged PTY round-trip (SC3), exit 0
```
[chrome 136.0.7103.177 mac #0-0] » tests/smoke/pty-roundtrip.smoke.test.ts
[chrome 136.0.7103.177 mac #0-0] PTY round-trip smoke (SC3, TERM-02, SC4)
[chrome 136.0.7103.177 mac #0-0]    ✓ echoes typed input back through the packaged-app PTY (echo hello — SC3)
[chrome 136.0.7103.177 mac #0-0]    ✓ reports TERM=xterm-256color from the PTY environment (SC4, POSIX)
[chrome 136.0.7103.177 mac #0-0]    ✓ forwards Ctrl+C (0x03) as SIGINT and returns to the prompt (POSIX)
[chrome 136.0.7103.177 mac #0-0] 3 passing (1.6s)
```
Full smoke suite: **15 passed, 15 total (100%)** in 00:01:13.

### Unit + types + lint
- `npm run test:unit` → **301 passed (38 files)** including the 9 new os-gate cases and `security.guard` at exactly **20 EXPECTED_API_KEYS** (unchanged).
- `npx tsc --noEmit` → clean (exit 0).
- `eslint wdio.conf.ts tests/smoke/pty-roundtrip.smoke.test.ts` → clean. (The 8 repo eslint errors are all in pre-existing `.planning/spikes/*.cjs`, already on deferred-items from 06.1-04 — out of scope.)

## Invariants Held

- **EXPECTED_API_KEYS stayed exactly 20** — packaging added zero bridge keys; `window-config.ts` was not edited; `security.guard` GREEN.
- **17763-vs-18309 discrepancy preserved, not silently changed** — `os-gate.ts` keeps `MIN_WINDOWS_BUILD = 17763` (D-05 lock) with a code comment flagging node-pty's own `>= 18309` `_useConpty` threshold for the human to confirm later (08-RESEARCH Open Q1 / A6).
- **D-06 proven mechanics untouched** — `asar.unpackDir`, `ignore` keep-clause, `rebuildConfig.onlyModules: []` byte-for-byte unchanged; no network-mandatory rebuild added.
- **No Apple secret committed** — all sign/notarize values read from `process.env`; negative grep in Task 2 verify passes.

## Deviations from Plan

None — plan executed exactly as written. All three tasks, all acceptance criteria, and the real `npm run make` + `npm run test:smoke` proofs completed on the dev box (no faked GREEN, no deferred packaging step).

## Known Stubs

None. The placeholder icon is an intentional, documented D-07 placeholder (swap-by-file later, config untouched) — `assets/README.md` records this. It does not block the plan goal (a real, icon-bearing, buildable `.app` ships now).

## Threat Flags

None. This plan introduced no new network endpoint, auth path, or trust-boundary surface beyond the threat register already enumerated in 08-01-PLAN.md (`<threat_model>` T-08-01..T-08-SC, all `mitigate`/`accept(no change)` and honored: env-gated secrets, native pre-1809 gate before any spawn, pinned node-pty prebuild, zero new bridge keys, zero new package installs).

## Notes for the Phase Gate

- SC1(mac) + SC3(mac) + SC4(logic) are verified on the dev box this plan.
- The Windows leg (SC1 win / SC3 win) is the CI matrix's job (Plan 03) — `wdio.conf.ts` now produces the `out/Just-Wrapper-win32-<arch>/Just-Wrapper.exe` path the Windows runner consumes, and the smoke's win32 guards make the POSIX-only assertions skip cleanly there.
- SC2 (canonical `claude --rc` interactive launch in the packaged app) remains the blocking end-of-phase human-verify per D-08 — not part of this plan.

## Self-Check: PASSED

All 8 created files exist on disk; all 3 task commits (`3fbcca4`, `8cc277d`, `a0bbbac`) are present in git history.
