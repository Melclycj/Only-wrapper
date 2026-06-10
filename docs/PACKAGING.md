# Packaging

Just-Wrapper packages from a single Electron Forge codebase into runnable local
desktop apps for macOS and Windows (PKG-01). No app-store / auto-update /
distribution pipeline — local install only (PROJECT.md).

## Build

```bash
npm run make
```

On **macOS** this produces a runnable `.app` under `out/`:

```
out/Just-Wrapper-darwin-<arch>/Just-Wrapper.app
```

plus a `.zip` distributable under `out/make/`. The build carries the placeholder
app icon (`assets/icon.icns`) and the `com.justwrapper.app` bundle id. No manual
post-processing is required (SC1).

On **Windows** the same command produces a `Setup.exe` (Squirrel) under
`out/make/`; the Windows artifact is built and smoke-tested by the CI matrix
(`windows-latest`, added in Plan 03) — there is no local Windows machine in the
loop.

## Opening the unsigned macOS app (D-04)

The macOS `.app` is shipped **UNSIGNED and un-notarized** this phase (real
Developer-ID signing needs an Apple Developer Program membership, ~$99/yr — see
STATE.md blockers). Gatekeeper quarantines unsigned apps that were *downloaded*,
showing a "damaged / can't be opened" error. A locally-built `.app` is normally
fine, but if you transfer it or hit the quarantine prompt, open it one of two
ways:

1. **Right-click → Open** (then confirm the dialog once), or
2. Strip the quarantine attribute:

   ```bash
   xattr -dr com.apple.quarantine out/Just-Wrapper-darwin-arm64/Just-Wrapper.app
   ```

## Enabling signing / notarization later (env-gated flip)

Signing is **OFF by default** and is a config-free flip away from ON — the
`osxSign` / `osxNotarize` slots in `forge.config.ts` are env-gated, so setting
the credentials in the build environment turns them on with no code change:

| Env var | Purpose |
|---------|---------|
| `APPLE_IDENTITY` | Presence enables `osxSign` (sign with the default Developer ID identity) |
| `APPLE_ID` | Apple ID for notarization (presence enables `osxNotarize`) |
| `APPLE_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

These are read **only** from `process.env` — **never commit an Apple
credential.** With none set, the build is unsigned and notarization is skipped
cleanly (the D-04 default; CI needs no secrets this phase).

## Native module (node-pty) note

node-pty 1.1.0 is an N-API addon whose prebuilt `.node` is ABI-stable under
Electron 36 and is **shipped as-is** — `rebuildConfig.onlyModules: []` keeps the
packaging rebuild a no-op (a network-mandatory rebuild hard-fails offline). The
`postinstall` (`scripts/fix-node-pty.cjs`) does an opportunistic, non-fatal
rebuild when online and `chmod +x`'s the macOS `spawn-helper`. The
`AutoUnpackNativesPlugin` + `asar.unpackDir` keep-clause land node-pty's native
helpers in `app.asar.unpacked/` so they load from outside the ASAR archive.
**Do not reintroduce a mandatory packaging rebuild** (it makes the build more
fragile, not less).

## Continuous Integration

The `.github/workflows/build.yml` matrix is the **canonical producer and
verifier** of the cross-platform distributables. Dev/test is macOS-only, so CI
is how the real Windows `.exe`/`Setup.exe` gets built and smoke-tested at all.

On every `push` and `pull_request` it runs a 2-OS matrix:

| Leg | Runner | Produces |
|-----|--------|----------|
| `macos-latest` | macOS desktop session | the macOS `.app` (maker-zip) |
| `windows-latest` | Windows desktop session | the Windows `.exe` + `Setup.exe` (maker-squirrel) |

Each leg runs `npm ci` → `npm run make` → `npm run test:smoke`, then uploads the
`out/make/**` output as an artifact named `just-wrapper-<os>`. The canonical
**Windows installer is downloaded from the `just-wrapper-windows-latest`** run
artifact (the Actions run → Artifacts section).

**Gate policy:**
- `npm run make` is the **hard gate** — the artifact must build on both legs.
- `npm run test:smoke` (the packaged-binary PTY round-trip) is the
  **strong-preferred** gate; if it proves flaky for lack of a stable display on
  a runner it is treated as best-effort, with the canonical `claude --rc`
  human-verify as the binding SC2 gate (CI runners lack `claude`).
- `fail-fast: false` isolates a Windows-only flake from the macOS leg.

**No secrets.** The matrix needs **zero** credentials this phase — the build is
**unsigned** (maker-squirrel is unsigned by default; `osxSign`/`osxNotarize` are
env-gated off). Signing is the later env-gated flip described above (set the
`APPLE_*` env vars in the build environment, no code change). Until then,
download the unsigned artifact and use the local-open path
(`xattr -dr com.apple.quarantine` on macOS) above.
