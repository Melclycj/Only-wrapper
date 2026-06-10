---
phase: 08-cross-platform-packaging
reviewed: 2026-06-10T00:00:00Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - src/main/os-gate.ts
  - src/main/__tests__/os-gate.test.ts
  - src/main/index.ts
  - forge.config.ts
  - package.json
  - wdio.conf.ts
  - tests/smoke/pty-roundtrip.smoke.test.ts
  - src/main/shell-discovery.ts
  - src/main/readiness-probe.ts
  - src/main/__tests__/readiness-probe.test.ts
  - src/main/__tests__/shell-discovery.test.ts
  - .github/workflows/build.yml
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-06-10
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 8 delivers cross-platform packaging: a pure ConPTY build-number gate (`os-gate.ts`), a filled `WindowsShellProvider` and `WindowsReadinessProbe`, an OS-conditional WDIO binary path, a 2-OS CI matrix, and icon/appId/env-gated signing slots in `forge.config.ts`.

The implementation is architecturally sound. The security perimeter is clean: no hardcoded credentials anywhere, all Apple signing env vars read from `process.env`, zero secrets in `build.yml`, EXPECTED_API_KEYS count unchanged at 20, no new IPC bridge keys. The ConPTY gate is correctly placed before `store.load()`/`createWindow()`, fails open on unparseable releases, and never fires on non-win32. The degrade-loudly path for CMD/PowerShell sends zero bytes and its `unsupported` message is a fixed literal with only a shell basename interpolated (not attacker-controlled buffer data). All pure helpers are electron-free with injected deps. No file exceeds 800 lines. The proven `asar.unpackDir`, `ignore` keep-clauses, and `rebuildConfig: { onlyModules: [] }` are untouched.

Two warnings and two info items are documented below. None are blockers for v1.0 ship.

---

## Warnings

### WR-01: `osxNotarize` uses non-null assertions on env vars that are NOT checked at construction time

**File:** `forge.config.ts:27-28`

**Issue:** The `osxNotarize` object is constructed when `APPLE_ID` is truthy but `APPLE_PASSWORD` and `APPLE_TEAM_ID` are read with `!` (TypeScript non-null assertion). If a developer sets `APPLE_ID` without also setting both companion vars (a common mis-step when iterating on CI configuration), the notarize object silently carries `undefined` values despite the `!`. TypeScript's `!` suppresses the type error but provides zero runtime enforcement. Forge/altool will then fail at notarization time with an opaque "invalid credentials" error rather than a clear startup-time message pointing to the missing env var.

**Fix:** Guard all three vars together, or add explicit presence checks with a clear error:
```typescript
osxNotarize: (() => {
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  if (!appleId) return undefined;
  if (!appleIdPassword || !teamId) {
    throw new Error(
      'APPLE_ID is set but APPLE_PASSWORD or APPLE_TEAM_ID is missing — ' +
      'all three must be set together for notarization.',
    );
  }
  return { appleId, appleIdPassword, teamId };
})(),
```
This is a developer-experience issue, not a security vulnerability (no credential is committed), but it will waste time the first time a teammate tries to enable signing.

---

### WR-02: Unknown-shell degrade path interpolates the raw basename into a user-visible notice string without any sanitisation

**File:** `src/main/readiness-probe.ts:179`

**Issue:** The final fallback path in `WindowsReadinessProbe.forShell()` passes `base` directly to `buildDegradeProbe(base)`, which embeds it into the `unsupported` notice string:
```
`auto-run unsupported on ${shellLabel} — start the command manually`
```
`base` is computed as `shellPath.split(/[\\/]/).pop() ?? shellPath` — it is the last path component of whatever string the caller passed. In the current call graph this comes from `SessionRecord.shell` (a stored/user-supplied path), so an adversary who can write session storage can set `shell` to a path whose basename contains, e.g., newlines, ANSI escape sequences, or XSS payloads if the notice ever surfaces in an HTML context. The path is local-only right now and the downstream renderer is expected to escape this string, but the unsanitised origin is a latent risk worth noting.

**Fix:** The simplest mitigation is to strip non-printable characters from `base` before using it as a label:
```typescript
// Sanitise the basename: allow printable ASCII only, cap length.
const safeBase = base.replace(/[^\x20-\x7E]/g, '?').slice(0, 64);
return buildDegradeProbe(safeBase);
```
Alternatively — and architecturally cleaner — call `buildDegradeProbe('unknown shell')` for the catch-all path and log `shellPath` separately, never embedding it in the UI-visible string.

---

## Info

### IN-01: Dead fallback branch in `windowsDefault` chain

**File:** `src/main/shell-discovery.ts:166-169`

**Issue:** The `windowsDefault` value is computed as:
```typescript
const windowsDefault =
  process.env.ComSpec ||
  path.join(systemRoot, 'System32', 'cmd.exe') ||
  candidates[0];
```
`path.join(...)` always returns a non-empty string (even with fallback values for `systemRoot`). The `|| candidates[0]` branch is therefore permanently dead — it can never be reached. This is a misleading guard that implies a scenario (path.join returning a falsy value) that cannot occur.

**Fix:** Remove the dead third operand:
```typescript
const windowsDefault =
  process.env.ComSpec ||
  path.join(systemRoot, 'System32', 'cmd.exe');
```

---

### IN-02: Unknown-shell degrade path (`buildDegradeProbe(base)`) lacks a dedicated test case

**File:** `src/main/__tests__/readiness-probe.test.ts` (gap — no corresponding line)

**Issue:** The `WindowsReadinessProbe.forShell()` tests cover Git Bash, WSL, CMD, and PowerShell/pwsh. The final catch-all branch (`return buildDegradeProbe(base)`) — for any Windows shell that is not one of the four named types — has no test case. The `shell-discovery.test.ts` equivalent (`falls back to the raw basename for an unmapped shell`) exists for `buildWindowsShellList`, but the readiness-probe fallback path is not exercised.

**Fix:** Add a test case for an unmapped shell (e.g. `nu.exe` or a custom binary):
```typescript
it('unknown Windows shell → degrade-loudly (safe default, no guessed marker)', () => {
  const probe = provider.forShell('C:\\tools\\nu.exe');
  expect(probe.marker).toBe('');
  expect(probe.matches('anything')).toBe(false);
  expect(probe.unsupported).toMatch(/nu\.exe/i);
});
```

---

## Verification of Specific Review Criteria

| Criterion | Result |
|---|---|
| No hardcoded secrets (build.yml / forge.config.ts) | PASS — all signing vars read from `process.env`; build.yml uses zero secrets |
| ConPTY gate runs before createWindow / store.load | PASS — gate is first statement inside `app.whenReady().then(async () => {` |
| ConPTY gate fails OPEN on unparseable release | PASS — `isUnsupportedWindows` returns `false` when `parseWindowsBuild` returns `null` |
| Degrade-loudly: CMD/PowerShell send zero bytes + always-false match | PASS — `marker: ''`, `matches: () => false` |
| Degrade-loudly: notice is a fixed literal (no nonce/buffer interpolation) | PARTIAL — fixed for CMD/PowerShell; unknown-shell path interpolates raw basename (WR-02) |
| Zero new IPC bridge keys (EXPECTED_API_KEYS must remain 20) | PASS — count is 20, confirmed in window-config.ts |
| forge.config.ts: asar.unpackDir / ignore keep-clauses / rebuildConfig unchanged | PASS — all three intact, lowdb/steno keep-clause also preserved |
| Pure helpers are electron-free with injected deps | PASS — os-gate.ts, shell-discovery.ts, readiness-probe.ts carry no `electron` import |
| No files > 800 lines | PASS — largest changed file is readiness-probe.ts at 186 lines |
| CI YAML: no mandatory standalone @electron/rebuild step | PASS — rebuild only via postinstall; no standalone step added |
| CI YAML: `npm run make` is a hard gate (no continue-on-error) | PASS — no `continue-on-error` present |

---

_Reviewed: 2026-06-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
