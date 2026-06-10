---
phase: 01-project-scaffold-dev-infrastructure
reviewed: 2026-06-04T00:30:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - src/main/index.ts
  - src/main/window-config.ts
  - src/preload/index.ts
  - src/renderer/index.html
  - src/renderer/index.tsx
  - src/shared/api-types.ts
  - src/shared/id-factory.ts
  - src/shared/types.ts
  - src/shared/vite-globals.d.ts
  - src/shared/__tests__/identity.guard.test.ts
  - src/shared/__tests__/security.guard.test.ts
  - tests/smoke/boot.smoke.test.ts
  - forge.config.ts
  - eslint.config.ts
  - vite.main.config.ts
  - vite.preload.config.ts
  - vite.renderer.config.ts
  - vitest.config.ts
  - wdio.conf.ts
  - tsconfig.json
  - package.json
  - .prettierrc.json
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: remediated
remediation:
  resolved: [CR-01, CR-02]
  resolved_commits: [cfc2f34, 40a4785]
  deferred: [WR-01, WR-02, WR-03, WR-04, WR-05, WR-06, WR-07]
  note: Both criticals fixed and verified (8/8 unit tests, node-pty ban proven, eslint clean). 7 warnings deferred to a follow-up / secure-phase.
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-04T00:30:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

This phase establishes the Electron process split, the branded-identity contract, and the dev/security tooling. The core invariants the phase advertises (contextIsolation/sandbox/nodeIntegration, branded `LogicalId`, contextBridge exposing only `getVersion`) are *present in the source*, but several of the **guarantees are not actually enforced by the tests or tooling that claim to enforce them**. The most serious problems are a security-guard test that validates a mock instead of the real preload surface (so a real leak would pass green), and an ESLint renderer import-ban that does not cover `node-pty` even though the phase brief names `node-pty` as a banned import. There are also missing Electron hardening handlers (no navigation/window-open guard, no CSP) and unhandled promise rejections in the main and renderer entry points. Dependency pins have drifted from the versions documented in CLAUDE.md.

## Remediation (2026-06-04)

Both criticals fixed before phase completion; the 7 warnings are deferred to a follow-up.

- **CR-01 — RESOLVED** (`cfc2f34`): `security.guard.test.ts` now imports the real `src/preload/index.ts` with `electron` mocked (`vi.hoisted` + `vi.mock`) and asserts the `contextBridge.exposeInMainWorld` surface is exactly `EXPECTED_API_KEYS` with no `ipcRenderer` leak. Verified: adding raw electron access to the real preload now fails the test (8/8 unit tests pass).
- **CR-02 — RESOLVED** (`40a4785`): `node-pty` added to the renderer and shared `no-restricted-imports` bans (proven via an ephemeral probe that now fails lint). Also fixed a latent gap: a global `ignores` block (`.vite/out/dist/coverage`) so `npm run lint` no longer fails on generated build bundles.
- **Deferred (WR-01..WR-07):** navigation/window-open guard, CSP, unhandled promise rejections, IPC input-validation pattern, and CLAUDE.md dependency-pin drift. Tracked here for a follow-up or `/gsd-secure-phase`.

## Critical Issues

### CR-01: Security guard test validates a mock, not the real preload surface — a real leak passes green

**File:** `src/shared/__tests__/security.guard.test.ts:26-41`
**Issue:** The test named "window.api surface exposes only documented methods (SC3 — contextBridge is the only surface)" claims to catch "a regression that adds raw electron access." It does not. It constructs `mockApi` by looping over `EXPECTED_API_KEYS` and then asserts that `Object.keys(mockApi)` equals `EXPECTED_API_KEYS`. That is a tautology: the object is built *from* the constant it is compared against, so the assertion can never fail regardless of what `src/preload/index.ts` actually exposes. If a future edit adds `ipcRenderer` or `nodeRequire` to the real `contextBridge.exposeInMainWorld('api', ...)` call, this test stays green. The single most security-critical assertion of Phase 1 (SC3 — "contextBridge is the only surface") has zero real coverage.

The real preload object lives in `src/preload/index.ts` (`const api: ElectronAPI = {...}`) but is never imported here because it `require`s `electron` (unavailable in the Vitest Node env). The fix is to assert against the actual exported surface, not a regenerated mock.
**Fix:**
```ts
// Export the surface from preload as a plain object so it is importable
// without pulling in electron at module-eval time. In src/preload/index.ts:
//   export const apiSurface = { getVersion: ... } satisfies ElectronAPI;
//   contextBridge.exposeInMainWorld('api', apiSurface);
// Guard against the electron import by mocking it:
import { vi } from 'vitest';
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn() },
}));
import { apiSurface } from '../../preload/index';

it('preload exposes ONLY EXPECTED_API_KEYS', () => {
  expect(Object.keys(apiSurface).sort()).toEqual([...EXPECTED_API_KEYS].sort());
});
```

### CR-02: ESLint renderer import-ban does not catch `node-pty` — a primary banned import is unguarded

**File:** `eslint.config.ts:13-29`
**Issue:** The phase brief states the renderer import ban targets `electron`/`node-pty`, and CLAUDE.md's "What NOT to Use" explicitly forbids running node-pty in the renderer ("Violates Electron's security model"). The `no-restricted-imports` config under `src/renderer/**` only bans the `electron`/`electron/*` groups and `*/ipcRenderer` patterns. `node-pty` is not in the pattern list, so `import { spawn } from 'node-pty'` inside a renderer file passes lint clean. This is the exact failure mode the rule was supposed to prevent, and it becomes load-bearing in Phase 2 when node-pty is added. The edit-time guard is therefore incomplete for its stated purpose.
**Fix:**
```ts
patterns: [
  {
    group: ['electron', 'electron/*', 'node-pty', 'node-pty/*'],
    message:
      'Never import electron or node-pty in the renderer. Use window.api (contextBridge).',
  },
  {
    group: ['*/ipcRenderer', '*ipcRenderer*'],
    message: 'ipcRenderer is not accessible in renderer. Use window.api (contextBridge).',
  },
],
```

## Warnings

### WR-01: No `setWindowOpenHandler` / `will-navigate` guard — renderer can open arbitrary windows and navigate away

**File:** `src/main/index.ts:11-26`
**Issue:** Electron security best practice (and the project's "real terminal fidelity / agent output containing URLs" use case, where terminal output is untrusted) requires denying or controlling new-window creation and navigation. With no `webContents.setWindowOpenHandler` and no `will-navigate` handler, a `window.open(...)` or an injected navigation in the renderer can spawn an uncontrolled `BrowserWindow` or navigate the app frame to a remote origin. `contextIsolation`/`sandbox` reduce but do not eliminate this; the open-handler is the standard mitigation.
**Fix:**
```ts
win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
win.webContents.on('will-navigate', (event, url) => {
  if (url !== win.webContents.getURL()) event.preventDefault();
});
```

### WR-02: No Content-Security-Policy in the renderer HTML

**File:** `src/renderer/index.html:3-6`
**Issue:** There is no CSP `<meta http-equiv="Content-Security-Policy">` tag and no `onHeadersReceived` CSP in the main process. Electron flags a missing CSP as a security warning, and for an app that will render untrusted terminal/agent output (including URLs via addon-web-links per CLAUDE.md), a restrictive CSP is the baseline defense against injected script execution. Establishing it now, while the renderer is trivial, is far cheaper than retrofitting.
**Fix:**
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'" />
```
(Loosen `script-src`/`connect-src` only as the Vite dev server requires, ideally via a dev-only header.)

### WR-03: Unhandled promise rejection on `loadURL` / `loadFile`

**File:** `src/main/index.ts:19-25`
**Issue:** `win.loadURL(...)` and `win.loadFile(...)` both return promises that are discarded. If the dev server URL is unreachable or the packaged `index.html` path is wrong (a real risk given the bespoke `outDir` gymnastics in `vite.renderer.config.ts`), the rejection is unhandled and the window silently shows a blank page with no diagnostic. The walking-skeleton smoke test (SC1) would fail with no actionable error.
**Fix:**
```ts
const loaded = MAIN_WINDOW_VITE_DEV_SERVER_URL
  ? win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  : win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
loaded.catch((err) => console.error('Failed to load renderer:', err));
```

### WR-04: `app.whenReady().then(createWindow)` swallows window-creation failures

**File:** `src/main/index.ts:31`
**Issue:** The promise returned by `whenReady().then(createWindow)` has no `.catch`. Any throw inside `createWindow` (e.g. `buildWebPreferences` path resolution, BrowserWindow construction) produces an unhandled rejection rather than a logged, diagnosable failure. For a process-bootstrap path this should fail loudly.
**Fix:**
```ts
app.whenReady().then(createWindow).catch((err) => {
  console.error('Window creation failed:', err);
  app.quit();
});
```

### WR-05: Unhandled rejection in renderer `getVersion()` call

**File:** `src/renderer/index.tsx:8-10`
**Issue:** `window.api.getVersion().then(setVersion)` has no `.catch`. If the IPC handler throws or is missing (e.g. handler-name drift between `ipcMain.handle('api:get-version', ...)` and the preload's `ipcRenderer.invoke('api:get-version')`), the UI is stuck displaying `'...'` forever with an unhandled rejection in the console and no user-visible error. The two string literals are also duplicated across `src/main/index.ts:29` and `src/preload/index.ts:11` with no shared constant, so a typo in one silently breaks the channel.
**Fix:**
```ts
window.api.getVersion().then(setVersion).catch(() => setVersion('unknown'));
```
Additionally, extract the channel name to a shared constant (e.g. in `src/shared/api-types.ts`) and reference it from both the main handler and the preload invoke.

### WR-06: IPC handler ignores its arguments but establishes no validation pattern

**File:** `src/main/index.ts:29`
**Issue:** `ipcMain.handle('api:get-version', () => app.getVersion())` takes no args today, which is fine. But this is the *template* every later IPC handler will be copied from, and the phase brief explicitly asks to flag IPC handlers lacking input validation. As written there is no convention (no arg-typing, no validation wrapper, no allow-listing of senders via `event.senderFrame`). Establishing a validated-handler pattern now prevents Phase 2+ handlers (which will take session IDs, cwd paths, shell paths — all attacker-influenceable) from shipping unvalidated.
**Fix:** Introduce a thin `registerHandler(channel, schema, fn)` helper that validates payloads (e.g. via a small runtime guard) and optionally checks `event.senderFrame` origin before dispatch, and route even this trivial handler through it to set the precedent.

### WR-07: Dependency versions drift from the pins documented in CLAUDE.md

**File:** `package.json:41-54`
**Issue:** CLAUDE.md pins specific versions and the "Version Compatibility" table is part of the project contract, but several deps diverge:
- `uuid` is `14.0.0`; CLAUDE.md specifies `uuid 10.x`.
- `typescript` is `6.0.3`; CLAUDE.md specifies `TypeScript 5.x`.
- `eslint` is `10.4.1` and `electron` is `36.9.5` (within the documented 36.x range, acceptable), but TS 6 and uuid 14 are major-version jumps beyond what the documented stack and its stated compatibility notes were validated against.

These are not necessarily wrong, but they are undocumented deviations from the project's own pinned stack. Either update CLAUDE.md's stack tables to reflect the intentional upgrades (with rationale), or pin back to the documented majors. Silent drift defeats the purpose of the pinned-version convention.
**Fix:** Reconcile `package.json` with CLAUDE.md — update the CLAUDE.md version tables for any intentional bumps (uuid 14, TS 6) and add a one-line rationale, or downgrade to the documented majors.

## Info

### IN-01: `.prettierrc.json` is an empty object — no formatting contract

**File:** `.prettierrc.json:1`
**Issue:** The file is `{}`. The eslint config wires `eslint-config-prettier` to defer formatting to Prettier, but with zero configured options the "contract" is just Prettier defaults. That works, but it means conventions like `singleQuote`/`trailingComma` (already used throughout the source) are implicit rather than enforced. Consider committing the actual intended options so formatting is explicit and stable across contributor environments.

### IN-02: `tsconfig.json` excludes test files from type-checking, so `@ts-expect-error` guard is not type-verified by the build

**File:** `tsconfig.json:20`
**Issue:** `exclude: ["src/**/__tests__/**", "tests/**", ...]` removes the guard tests from the main tsconfig program. The identity guard test (`identity.guard.test.ts:33-38`) relies on `@ts-expect-error` to prove the brand rejects a numeric assignment — but that assertion is only meaningful if a typechecker actually compiles that file. Vitest transpiles per-file with esbuild (no type errors raised), so the brand's compile-time guarantee is not verified in CI unless a separate `tsc --noEmit` runs over the test files. Confirm a typecheck step covers the tests, or the `@ts-expect-error` provides false assurance.

### IN-03: `wdio.conf.ts` hardcodes a darwin-arm64 binary path, defeating cross-platform smoke runs

**File:** `wdio.conf.ts:22-24`
**Issue:** `appBinaryPath` is pinned to `./out/Just-Wrapper-darwin-arm64/...`. CLAUDE.md's core constraint is cross-platform (Windows + macOS). On Windows or Intel macOS this path does not exist and the smoke test cannot run. The comment acknowledges pinning "across platforms/arches" but the value is single-platform. Derive the path from `process.platform`/`process.arch` or rely on Forge auto-detection.

### IN-04: Vite renderer/preload `outDir` overrides are fragile and undocumented in one place

**File:** `vite.preload.config.ts:9` and `vite.renderer.config.ts:14`
**Issue:** Both configs hand-compute output directories (`.vite/preload`, `../../.vite/renderer/main_window`) to satisfy the path `src/main/index.ts` loads from (`../preload/index.js`, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`). This coupling between three files is implicit and easy to break — a change to any one silently produces a blank window (see WR-03). Not a bug today, but worth a single shared comment block or constant documenting the contract so the relationship is discoverable.

---

_Reviewed: 2026-06-04T00:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
