# Phase 8: Cross-Platform Packaging - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 11 (5 modify, 4 new, 2 new-test/extend)
**Analogs found:** 9 / 11 (2 greenfield — CI YAML + icon asset)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/shell-discovery.ts` (`WindowsShellProvider` fill) | service / platform-seam | transform (pure) | SAME FILE `MacShellProvider` + `buildShellList`/`parseEtcShells` | exact (same file, same seam) |
| `src/main/readiness-probe.ts` (`WindowsReadinessProbe.forShell()` fill) | service / platform-seam | transform (send-vs-match) | SAME FILE `MacReadinessProbe` + `buildPosixProbe` | exact (same file, same seam) |
| `src/main/os-gate.ts` (NEW pure module) | utility | transform (pure) | `src/main/shell-resolver.ts` (electron-free pure) | role + pattern match |
| `src/main/index.ts` (ConPTY gate insert) | boot / config | event-driven (lifecycle) | SAME FILE `app.whenReady` + squirrel `started` guard | exact (same file) |
| `forge.config.ts` (icon/appId/sign slots) | config | config | SAME FILE `packagerConfig` block | exact (extend, do not rewrite) |
| `package.json` (`appId`/`author`) | config | config | existing `productName`/`version` fields | edit |
| `wdio.conf.ts` (os-conditional `appBinaryPath`) | config / test-harness | config | SAME FILE hardcoded macOS path | exact (same file) |
| `src/main/__tests__/shell-discovery.test.ts` (extend) | test | transform | SAME FILE existing `buildShellList`/`selectShellProvider` cases | exact |
| `src/main/__tests__/readiness-probe.test.ts` (extend) | test | transform | SAME FILE Group-1 pure-helper cases | exact |
| `src/main/__tests__/os-gate.test.ts` (NEW) | test | transform | `shell-discovery.test.ts` pure-helper style | role match |
| `tests/smoke/pty-roundtrip.smoke.test.ts` (extend) | test (e2e/smoke) | request-response (PTY) | SAME FILE existing round-trip cases | exact |
| `.github/workflows/build.yml` (NEW) | CI config | batch | **NONE — greenfield** | no analog |
| `assets/icon.{icns,ico,png}` (NEW) | asset | — | **NONE — greenfield** | no analog |
| `docs/PACKAGING.md` (NEW, D-04 note) | doc | — | — (trivial prose) | no analog |

---

## Pattern Assignments

### `src/main/shell-discovery.ts` — `WindowsShellProvider` fill (D-02)

**Analog:** the SAME FILE's `MacShellProvider` + the pure `buildShellList`/`parseEtcShells` helpers.

**The exact pattern to mirror** (`shell-discovery.ts:48-80`): a PURE builder that places a resolved default FIRST (never-empty invariant D-05), filters to on-disk via an **injected `existsFn`**, de-dupes by path, labels by basename — then a thin provider class that wires real `fs.existsSync` into the pure builder. `buildShellList(etcShellPaths, resolvedShell, existsFn)` is the contract to reuse-by-analogy: the Windows fill should expose an equivalent pure builder (e.g. `buildWindowsShellList(candidates, windowsDefault, existsFn)`) so it unit-tests in the Node env with no Electron and no real FS.

```typescript
// shell-discovery.ts:48-62 — the pure builder shape to mirror for Windows
export function buildShellList(
  etcShellPaths: string[],
  resolvedShell: string,
  existsFn: (p: string) => boolean,
): DiscoveredShell[] {
  const merged = [resolvedShell, ...etcShellPaths]; // default ALWAYS first (D-05)
  const seen = new Set<string>();
  const out: DiscoveredShell[] = [];
  for (const p of merged) {
    if (!p || seen.has(p) || !existsFn(p)) continue; // de-dupe + on-disk filter
    seen.add(p);
    out.push({ path: p, label: p.split('/').pop() ?? p });
  }
  return out;
}
```

**Existing stub to replace** (`shell-discovery.ts:87-94`) — note it ALREADY splits on `[\\/]` for the Windows basename label, and it currently calls `resolveShell().shell` which returns `/bin/zsh` on Windows (the latent bug Pitfall 3 — the fill MUST supply a Windows-aware default, e.g. `process.env.ComSpec` / `%SystemRoot%\System32\cmd.exe` / PowerShell path, NOT rely on `resolveShell()`):

```typescript
export class WindowsShellProvider implements ShellDiscovery {
  discover(): DiscoveredShell[] {
    const resolved = resolveShell().shell;          // ← BUG on Windows: yields /bin/zsh
    return resolved
      ? [{ path: resolved, label: resolved.split(/[\\/]/).pop() ?? resolved }]
      : [];
  }
}
```

**Candidate paths (RESEARCH Pattern 1 — use env expansion, NOT hardcoded `C:\`):** PowerShell `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe` [CITED CLAUDE.md], pwsh7 `%ProgramFiles%\PowerShell\7\pwsh.exe` [A1], CMD `%SystemRoot%\System32\cmd.exe` [A2], Git Bash `%ProgramFiles%\Git\bin\bash.exe` [A3], WSL `%SystemRoot%\System32\wsl.exe` [CITED CLAUDE.md]. Label-map (`{ 'powershell.exe': 'PowerShell', … }`) is Claude's discretion.

**Test analog** (`shell-discovery.test.ts:42-98`): `const exists = (paths) => (p) => paths.includes(p)` injected stub; assert default-first, never-empty-when-no-candidates (D-05), on-disk filter, de-dupe, basename labels, and `selectShellProvider('win32') instanceof WindowsShellProvider` non-throwing + length ≥ 1.

---

### `src/main/readiness-probe.ts` — `WindowsReadinessProbe.forShell()` fill (D-03)

**Analog:** the SAME FILE's `MacReadinessProbe` (`readiness-probe.ts:109-118`) + pure `buildPosixProbe` (`readiness-probe.ts:78-100`).

**The send-vs-match split to mirror** (`readiness-probe.ts:78-100`): `marker` (bytes SENT, distinct from the matched token via the `: ` no-op prefix + CR) vs `matches(buffer)` (fires ONLY when the nonce appears on a PRODUCED line — `\n` precedes it — so the shell's bare echo of its own input never trips it). 8 KB tail bound (`PROBE_SCAN_LIMIT`) caps the scan to the most-recent produced line.

```typescript
// readiness-probe.ts:85-99 — the matcher shape Git Bash/WSL REUSE verbatim
const re = new RegExp(`\\n[^\\n]*${safe}`);       // nonce AFTER a newline boundary
return {
  marker: `: ${nonce}\r`,                          // ':' POSIX no-op + CR (ICRNL→NL)
  nonce,
  matches: (buffer: string): boolean => {
    const tail = buffer.length > PROBE_SCAN_LIMIT
      ? buffer.slice(buffer.length - PROBE_SCAN_LIMIT) : buffer;
    return re.test(tail);
  },
};
```

**Per-shell strategy (RESEARCH Pattern 2):**
- **Git Bash + WSL** → REUSE `buildPosixProbe` verbatim (they ARE bash/POSIX) — high confidence.
- **CMD / PowerShell** → POSIX `:` does NOT exist. Use `echo <nonce>` / `Write-Output '<nonce>'` with the matcher keyed off the **produced output line** (Pitfall 6: `echo` puts the nonce in BOTH the echoed input AND the output, so use distinct send-vs-match tokens or require the nonce on a non-echo line). If a Windows-runner byte test can't confirm reliability → **degrade-loudly** (locked D-03 fallback).

**Existing stub to replace** (`readiness-probe.ts:126-131`) — currently THROWS (loud-by-design intent; the Windows shells with no safe no-op KEEP this loud-fail spirit via the notice channel instead of mis-firing):

```typescript
export class WindowsReadinessProbe implements ReadinessProbeProvider {
  forShell(shellPath: string): ShellReadinessProbe {
    void shellPath;
    throw new Error('Windows readiness probe is implemented in Phase 8 (D-03 seam stub).');
  }
}
```

**Degrade-loudly channel (ZERO new bridge key):** reuse the EXISTING `onPtyStatus` notice channel — `api-types.ts:81-86` documents `notice?: string` riding `onPtyStatus` exactly like the 05.1 ready-timeout notice. So "auto-run unsupported on PowerShell" emits through the existing key; **EXPECTED_API_KEYS stays at 20** (`onPtyStatus` is key index 12, `window-config.ts:112`).

**Test analog** (`readiness-probe.test.ts:35-93`, Group 1): pure-helper assertions on `marker` exact bytes, `matches()` FALSE on bare-echo / first-line, TRUE on produced-line-after-newline, 8 KB tail bound, and `selectReadinessProbe('win32')` per-shell behavior. Group 2's FakeChild harness (`readiness-probe.test.ts:126-326`) is the integration analog if a Windows probe needs PtyManager-level verification.

---

### `src/main/os-gate.ts` — NEW pure module (D-05 / SC4)

**Analog:** `src/main/shell-resolver.ts` (the established electron-free pure-module convention — a banner comment explaining "no `electron` import lets Vitest import it directly", then exported pure functions).

**Pattern to follow** (RESEARCH Pattern 3 — verbatim): `MIN_WINDOWS_BUILD = 17763`, `parseWindowsBuild(release): number | null` (regex `/(\d+)\.(\d+)\.(\d+)/` → group 3, mirroring node-pty's own parser), `isUnsupportedWindows(platform, release): boolean` (only `win32` + parseable build `< 17763`). Pure → unit-tests with fixture strings like `'10.0.17763'` / `'10.0.17134'`.

**Threshold note to document (A6):** node-pty's own ConPTY gate is `>= 18309`; between 17763–18308 node-pty silently falls back to winpty (which CLAUDE.md excludes). D-05 LOCKS 17763 — surface as a one-line product note, do NOT re-litigate.

**Test analog:** `shell-discovery.test.ts` pure-helper style — fixture-string table for `parseWindowsBuild` + `isUnsupportedWindows` (win32-below / win32-above / non-win32 / unparseable).

---

### `src/main/index.ts` — ConPTY gate insertion (D-05)

**Analog:** the SAME FILE's boot sequence. The squirrel `started` guard is `index.ts:17-19`; `dialog` is ALREADY imported (`index.ts:1`); the insertion point is INSIDE `app.whenReady().then(async () => {…})` at `index.ts:165-170`, BEFORE `store.load()`.

```typescript
// index.ts:165-170 — the boot block; D-05 gate inserts at the TOP of this callback,
// after the module-scope `if (started) app.quit()` (line 17-19), before store.load():
app.whenReady().then(async () => {
  // ── D-05 GATE inserts HERE ──
  // if (isUnsupportedWindows(process.platform, os.release())) {
  //   dialog.showErrorBox('Windows 10 build 1809 or later required', '…');
  //   app.quit();
  //   return; // before any node-pty spawn / window
  // }
  const data = await store.load();
  ptyManager.hydrate(data.sessions);
  ptyManager.setStoreSignal(syncStore);
  createWindow();
});
```

**Required new import:** `import os from 'node:os';` (note `node:path` is already imported line 2; follow the `node:` prefix convention) + `import { isUnsupportedWindows } from './os-gate';`. `dialog` and `app` need no new import.

---

### `forge.config.ts` — EXTEND for icon/appId/sign slots (D-04 / D-07)

**Analog:** the SAME FILE's `packagerConfig` block (`forge.config.ts:10-48`) and `makers` array (`forge.config.ts:58-63`). **EXTEND ONLY — do NOT touch `asar.unpackDir`, the `ignore` keep-clause, or `rebuildConfig.onlyModules: []` (D-06).**

Add to `packagerConfig` (alongside existing `asar`/`ignore`): `name: 'Just-Wrapper'`, `appBundleId: 'com.justwrapper.app'`, `icon: 'assets/icon'` (NO extension — Forge appends `.icns`/`.ico` per platform), and env-gated `osxSign: process.env.APPLE_IDENTITY ? {} : undefined` / `osxNotarize: process.env.APPLE_ID ? {appleId, appleIdPassword, teamId} : undefined`. Change maker line `forge.config.ts:59` `new MakerSquirrel({})` → `new MakerSquirrel({ setupIcon: 'assets/icon.ico' })` (REAL multi-size ICO, not a renamed PNG). Leave `windowsSign` UNSET (Pitfall 4 — unsigned is the D-04 lock; a stray cert config hangs CI).

---

### `wdio.conf.ts` — os-conditional `appBinaryPath` (D-08)

**Analog:** the SAME FILE's hardcoded macOS path (`wdio.conf.ts:22-24`). Replace the inline string with a `process.platform === 'win32' ? './out/Just-Wrapper-win32-${os.arch()}/Just-Wrapper.exe' : './out/Just-Wrapper-darwin-${os.arch()}/Just-Wrapper.app/Contents/MacOS/Just-Wrapper'` ternary (add `import os from 'node:os'`).

```typescript
// wdio.conf.ts:21-25 — the slot to make os-conditional
'wdio:electronServiceOptions': {
  appBinaryPath:
    './out/Just-Wrapper-darwin-arm64/Just-Wrapper.app/Contents/MacOS/Just-Wrapper',
},
```

**Smoke extend analog:** `tests/smoke/pty-roundtrip.smoke.test.ts:27-39` already proves PTY-inside-ASAR via `echo hello` + `echo $TERM`. For CI (no `claude`) the stand-in must be shell-appropriate per OS (`echo hello` works cross-shell; for a CWD probe use `echo $TERM` on POSIX vs a Windows equivalent). This IS the SC3 detector (spawn-helper/conpty.node loading from `app.asar.unpacked`).

---

## Shared Patterns

### Electron-free PURE helper + injected dependency (cross-cutting — D-02/D-03/D-05)
**Source:** `shell-resolver.ts:1-37`, `shell-discovery.ts:48-62`, `readiness-probe.ts:78-100`.
**Apply to:** ALL three Windows/gate fills (`WindowsShellProvider`, `WindowsReadinessProbe`, `os-gate.ts`).
**Rule:** no `electron` / `node-pty` import in the pure layer; dependencies (`existsFn`, `nonce`, `release` string) injected as params so Vitest imports them directly in the Node env. Thin provider/wiring class adapts real `fs`/`crypto`/`os` into the pure core.

### Never-empty / loud-degrade safety (D-05 / D-03)
**Source:** `shell-discovery.ts:53` (default-first) vs `readiness-probe.ts:128-129` (throw, no safe fallback).
**Apply to:** `WindowsShellProvider` (default ALWAYS first, dropdown never empty) vs `WindowsReadinessProbe` (mis-fire is worse than a clear "auto-run unsupported on `<shell>`" notice — degrade via `onPtyStatus`, NOT a silent best-effort inject).

### Bridge-key invariant — ZERO new keys (security guard)
**Source:** `window-config.ts:100-121` (exactly 20 `EXPECTED_API_KEYS`) + `security.guard.test.ts:48-52`.
**Apply to:** the WHOLE phase. Packaging adds NO bridge key; the D-03 degrade-notice reuses the existing `onPtyStatus` channel (`api-types.ts:81-86`, `notice?: string`). The security guard test must stay GREEN at 20.

### Pure-helper unit-test style
**Source:** `shell-discovery.test.ts:18-98`, `readiness-probe.test.ts:35-93`.
**Apply to:** `os-gate.test.ts` (new) + the shell-discovery/readiness-probe extensions — fixture-string/injected-stub tables, exact-byte assertions, no real FS/PTY/Electron.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.github/workflows/build.yml` | CI config | batch | Greenfield — `.github/` does not exist in-repo. Use RESEARCH Pattern 4 YAML (2-OS matrix, `npm ci → make → test:smoke`, `fail-fast: false`, no signing creds, `upload-artifact`). |
| `assets/icon.{icns,ico,png}` | asset | — | Greenfield — no `assets/` dir. Generate via `iconutil`+`sips` (both verified at `/usr/bin/`, RESEARCH Code Examples); `.ico` must be a REAL multi-size ICO, not a renamed PNG. |
| `docs/PACKAGING.md` | doc | — | Greenfield prose — D-04 local-open note (`xattr -dr com.apple.quarantine` / right-click→Open). No code pattern. |

## Metadata

**Analog search scope:** `src/main/`, `src/main/__tests__/`, `src/shared/`, `tests/smoke/`, repo root config (`forge.config.ts`, `wdio.conf.ts`, `package.json`).
**Files scanned:** 11 source/test/config files read in full + grep verification of `EXPECTED_API_KEYS` (20, GREEN) and the `onPtyStatus` notice channel.
**Pattern extraction date:** 2026-06-10
