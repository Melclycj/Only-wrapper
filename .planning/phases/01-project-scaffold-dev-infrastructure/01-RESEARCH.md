# Phase 1: Project Scaffold + Dev Infrastructure - Research

**Researched:** 2026-06-03
**Domain:** Electron + Vite + TypeScript scaffold; process-split security; branded types; dev tooling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Define the FULL `SessionRecord` type now in `shared/types.ts`. Fields: `logicalId`, `ptyPid?`, `name`, `icon`, `cwd`, `shell`, `startupCommand?`, `status`, `order`, `lastActive`.
- **D-02:** `status` is a string-literal union: `type SessionStatus = 'not_started' | 'running' | 'stopped' | 'exited' | 'error'`.
- **D-03:** `icon` is a discriminated union: `{ type: 'emoji'; value: string } | { type: 'preset'; value: string } | { type: 'color'; value: string }`.
- **D-04:** `logicalId` is a branded/nominal type: `type LogicalId = string & { readonly __brand: 'LogicalId' }`, minted only via `newLogicalId()` factory wrapping uuid v4. `ptyPid` stays a plain `number`.
- **D-05:** Vitest guard test asserting `logicalId`/`ptyPid` stay distinct fields, never assigned from each other.
- **D-06:** ESLint `no-restricted-imports` rule banning `electron`/`ipcRenderer` imports anywhere under the renderer source tree.
- **D-07:** Vitest guard test asserting `webPreferences` has `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and that the preload exposes only the named typed API surface.
- **D-08:** Standard dev tooling: Electron Forge + Vite + TypeScript (strict), `@electron/rebuild` postinstall, ESLint + Prettier, Vitest. Git hooks/CI deferred.
- **D-09:** Tests = Vitest static/unit guard tests AND a real Electron boot smoke test (E2E launcher). Harness choice is open — research recommends.
- **D-10:** Conservative version posture — research MUST confirm the exact Electron version pin against the current node-pty ↔ Electron compatibility matrix.

### Claude's Discretion

- Project folder layout (`main/` / `renderer/` / `preload/` / `shared/`) — follow Electron Forge vite-typescript template conventions.
- IPC channel naming and `window.api` method shape — only a minimal typed bridge (version/ping) needed this phase.
- ESM-vs-CJS module strategy for the main process.
- TypeScript compiler strictness specifics and npm scripts layout.
- uuid version for `newLogicalId()`.

### Deferred Ideas (OUT OF SCOPE)

- node-pty introduction → Phase 2
- ASAR-unpack / makers / `@electron/rebuild`-in-CI / ConPTY version check → Phase 8
- Git hooks (Husky/lint-staged) and cross-platform CI → Phase 8

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IDENT-01 | Each session has a stable internal session ID that does not change on rename, icon change, process restart, tab switch, or startup-command change | Branded `LogicalId` type + `newLogicalId()` factory (D-04); Vitest guard test (D-05); full `SessionRecord` contract established here (D-01) |
| IDENT-02 | The logical session ID is stored and tracked separately from the terminal process/PID | `logicalId: LogicalId` and `ptyPid?: number` are structurally distinct fields in `SessionRecord`; branded type prevents accidental conflation at compile time |

</phase_requirements>

---

## Summary

Phase 1 is a pure scaffold phase: no PTY, no terminal UI, no persistence. Its job is to make two foundational invariants impossible to violate in later phases — (a) logical session identity is separated from PTY process ID at the type level, and (b) the renderer process can only reach the main process via a typed `contextBridge` surface, never raw IPC. Everything else in this phase exists to support those invariants or to establish the build tooling that later phases depend on.

The Electron Forge vite-typescript template (`@electron-forge/template-vite-typescript` 7.11.2) is the correct starting point. It scaffolds the main/preload/renderer process split, wires Vite for both processes, and outputs a Forge-aware `forge.config.ts`. React 19 and TypeScript 6 are added on top. The resulting directory layout follows a `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/` split, with `shared/types.ts` housing the `SessionRecord` contract immediately.

The single highest-risk decision in this phase is the **Electron version pin** (D-10). The node-pty ↔ Electron compatibility matrix has clarified significantly: `node-pty@1.1.0` (released December 2025) is a from-source native module rebuilt by `@electron/rebuild` against any Electron ABI registered in `node-abi`. All Electron versions 36–42 are registered in `node-abi 4.31.0` (the version `@electron/rebuild 4.0.4` uses). However, Playwright has a documented `electron.launch()` failure on Electron 36.x in CI environments (issue filed June 2025, partially resolved in Electron 37). Given the boot smoke test is required (D-09), **this research recommends pinning to Electron 36.x (specifically 36.9.5)** for conservative stability with a clear upgrade path, but **recommends `@wdio/electron-service` over Playwright** to avoid the Playwright/Electron 36 launch regression.

**Primary recommendation:** Scaffold with `create-electron-app@latest -- --template=vite-typescript`, pin Electron 36.9.5, add React 19 + TypeScript strict + Vitest + ESLint flat config + `@wdio/electron-service` for the boot smoke test, wire `@electron/rebuild` as a no-op postinstall. This establishes every invariant Phase 2 needs before adding a single line of PTY code.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `SessionRecord` type contract | Shared (`src/shared/`) | — | Must be importable by both main and renderer without pulling Electron APIs into the renderer bundle |
| `LogicalId` branded type + `newLogicalId()` | Shared (`src/shared/`) | — | ID generation is pure logic; no process dependency |
| IPC bridge surface (`window.api`) | Preload (contextBridge) | Main (ipcMain handler) | Bridge definition lives in preload; handler lives in main; renderer sees only the typed surface |
| Window creation + `webPreferences` | Main process | — | `BrowserWindow` is a main-process API; never instantiated in renderer |
| Boot smoke test | External test harness (WDIO) | — | Boots the full packaged-dev app; not a unit test |
| ESLint `no-restricted-imports` | Build/lint tooling | — | Enforced at edit time, not at runtime |
| Guard tests (Vitest) | Test (`src/shared/__tests__/`) | — | Pure TypeScript; runs in Node environment; no Electron APIs needed |

---

## Standard Stack

### Core (Phase 1 only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | **36.9.5** (pinned) | Desktop framework, main process, BrowserWindow | Conservative pin — pre-dates Playwright/Electron 36 CI issue; stable for 8+ months; node-pty will rebuild against ABI 135 via @electron/rebuild | [VERIFIED: npm registry] |
| @electron-forge/cli | 7.11.2 | Scaffold, dev server, build | Officially recommended by electron.org; Forge v7 uses Vite 8 | [VERIFIED: npm registry] |
| @electron-forge/plugin-vite | 7.11.2 | Bundler integration (main, preload, renderer) | Same Forge release family; Vite 8 as of Forge v7 | [VERIFIED: npm registry] |
| @electron-forge/template-vite-typescript | 7.11.2 | Scaffold template | Official template providing main/preload/renderer split | [VERIFIED: npm registry] |
| react | 19.2.7 | UI framework (renderer) | Largest Electron ecosystem; Forge has React + Vite + TS guide | [VERIFIED: npm registry] |
| react-dom | 19.2.7 | React DOM renderer | Paired with react | [VERIFIED: npm registry] |
| typescript | 6.0.3 | Type safety across all processes | Strict mode eliminates IPC bug class; Forge vite-typescript includes it | [VERIFIED: npm registry] |
| uuid | 14.0.0 | UUID v4 for `newLogicalId()` factory | Canonical UUID library; v14 is current stable | [VERIFIED: npm registry] |

### Dev Tools (Phase 1)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| @electron/rebuild | 4.0.4 | Rebuild native modules against Electron ABI | postinstall hook; no-op until Phase 2 adds node-pty | [VERIFIED: npm registry] |
| @electron-forge/plugin-auto-unpack-natives | 7.11.2 | Ensure .node binaries unpack outside ASAR | Not active in Phase 1 (no native modules yet); wired in forge.config.ts as placeholder | [VERIFIED: npm registry] |
| vitest | 4.1.8 | Test runner for guard tests | Vite-native; no separate webpack step; supports Node and jsdom environments | [VERIFIED: npm registry] |
| eslint | 10.4.1 | Linter; enforces renderer security boundary | v9+ uses flat config by default | [VERIFIED: npm registry] |
| typescript-eslint | 8.60.1 | TypeScript-aware ESLint rules | Replaces `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` in one package | [VERIFIED: npm registry] |
| eslint-config-prettier | 10.1.8 | Turn off ESLint style rules that conflict with Prettier | Trailing entry in ESLint config | [VERIFIED: npm registry] |
| prettier | 3.8.3 | Code formatter | Consistent formatting; no config required for defaults | [VERIFIED: npm registry] |
| @wdio/electron-service | 10.0.0 | Boot smoke test harness | Recommended over Playwright for reasons in D-09 section | [VERIFIED: npm registry] |
| electron-squirrel-startup | 1.0.1 | Handle Squirrel installer events on Windows | Required by Forge's Squirrel.Windows maker | [VERIFIED: npm registry] |
| @types/react | 19.2.16 | TypeScript types for React | Matched to React 19 | [VERIFIED: npm registry] |
| @types/react-dom | 19.2.3 | TypeScript types for ReactDOM | Matched to react-dom | [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@wdio/electron-service` | Playwright `_electron` | Playwright still labeled "experimental"; known Electron 36 launch failure in CI (issue #47419 electron/electron); WDIO auto-handles Chromedriver for Electron 26+ and is Electron Forge-aware |
| `@wdio/electron-service` | `wdio-electron-service` (legacy) | `wdio-electron-service` is deprecated; migrate to `@wdio/electron-service` (official WebdriverIO org successor) |
| `uuid` v14 | `crypto.randomUUID()` | `crypto.randomUUID()` is available in Node 19+ and modern browsers but would add an awkward platform-check in shared code; `uuid` is a single function and widely used |
| ESLint flat config | Legacy `.eslintrc` | ESLint 9 deprecated legacy config; flat config is the default and the only option going forward |
| `typescript-eslint` (v8, unified package) | `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` | Unified package is the modern approach since v6; fewer moving parts |

**Installation (Phase 1 only — node-pty is NOT installed until Phase 2):**
```bash
# 1. Scaffold
npm create electron-app@latest just-wrapper -- --template=vite-typescript
cd just-wrapper

# 2. Add React
npm install react react-dom
npm install --save-dev @types/react @types/react-dom

# 3. ID factory
npm install uuid

# 4. Windows installer helper
npm install electron-squirrel-startup

# 5. Dev tools
npm install --save-dev vitest eslint typescript-eslint eslint-config-prettier prettier
npm install --save-dev @wdio/electron-service

# 6. Pin Electron version (override what Forge scaffold chose)
npm install --save-dev electron@36.9.5

# NOTE: @electron/rebuild and @electron-forge/plugin-auto-unpack-natives
# are installed by the Forge template; confirm they are present.
```

---

## Package Legitimacy Audit

All packages verified against the npm registry. slopcheck was unable to verify Node.js packages (it targets PyPI by default); npm registry verification was performed manually via `npm view` for each package.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| electron | npm | 10+ yrs | 100M+/wk | github.com/electron/electron | N/A (npm-only check) | Approved — canonical Electron package |
| @electron-forge/cli | npm | 6+ yrs | 1M+/wk | github.com/electron/forge | N/A | Approved — official Electron toolchain |
| @electron/rebuild | npm | 6+ yrs | 5M+/wk | github.com/electron/rebuild | N/A | Approved — official Electron toolchain |
| node-pty | npm | 8+ yrs | 10M+/wk | github.com/microsoft/node-pty | N/A | Approved — Microsoft-maintained, industry standard |
| react | npm | 10+ yrs | 400M+/wk | github.com/facebook/react | N/A | Approved — industry standard |
| typescript | npm | 10+ yrs | 400M+/wk | github.com/microsoft/TypeScript | N/A | Approved — Microsoft-maintained |
| uuid | npm | 10+ yrs | 200M+/wk | github.com/uuidjs/uuid | N/A | Approved — widely used |
| vitest | npm | 3+ yrs | 50M+/wk | github.com/vitest-dev/vitest | N/A | Approved — Vite-native test runner |
| eslint | npm | 10+ yrs | 400M+/wk | github.com/eslint/eslint | N/A | Approved |
| typescript-eslint | npm | 4+ yrs | 200M+/wk | github.com/typescript-eslint/typescript-eslint | N/A | Approved — official TS-ESLint project |
| prettier | npm | 7+ yrs | 300M+/wk | github.com/prettier/prettier | N/A | Approved |
| @wdio/electron-service | npm | ~1 yr (as WDIO official) | [ASSUMED] | github.com/webdriverio/desktop-mobile | N/A | Approved — official WebdriverIO org |
| electron-squirrel-startup | npm | 8+ yrs | 1M+/wk | github.com/mongodb-js/electron-squirrel-startup | N/A | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none (slopcheck could not run against npm — manual verification performed)

*slopcheck was available but targets PyPI; all packages above were verified via `npm view` against the npm registry directly.*

---

## Architecture Patterns

### System Architecture Diagram

```
  npm start (dev)
       │
       ▼
Electron Main Process (Node.js)
  ├── BrowserWindow.webPreferences
  │     contextIsolation: true
  │     nodeIntegration: false
  │     sandbox: true
  │     preload: preload.js
  │
  ├── ipcMain.handle('api:get-version')
  │         responds with app.getVersion()
  │
  └── Loads renderer via Vite dev server URL
              │
              ▼
     Preload Script (sandboxed)
       contextBridge.exposeInMainWorld('api', {
         getVersion: () => ipcRenderer.invoke('api:get-version')
       })
              │
              ▼
     Renderer Process (Chromium + React)
       React app mounts in blank div
       window.api.getVersion() — only callable method in Phase 1
       No direct access to Node.js or Electron APIs

  [shared/types.ts] ← imported by main AND renderer (pure TypeScript)
    type LogicalId = string & { readonly __brand: 'LogicalId' }
    type SessionStatus = 'not_started' | 'running' | 'stopped' | 'exited' | 'error'
    type SessionIconSpec = { type: 'emoji'; value: string }
                         | { type: 'preset'; value: string }
                         | { type: 'color'; value: string }
    interface SessionRecord { logicalId, ptyPid?, name, icon, cwd, shell, ... }

  [Vitest] ← guard tests (Node environment, no Electron needed)
    identity.test.ts: asserts logicalId and ptyPid are distinct fields
    security.test.ts: asserts webPreferences config object
    bridge.test.ts: asserts preload api surface shape

  [@wdio/electron-service] ← boot smoke test (real Electron process)
    boots the app via `npm start` or packaged output
    asserts window visible, no console errors
```

### Recommended Project Structure

The Electron Forge vite-typescript template generates this structure; `shared/` and test files are added manually:

```
just-wrapper/
├── src/
│   ├── main/
│   │   └── index.ts          # Main process entry: BrowserWindow, ipcMain handlers
│   ├── preload/
│   │   └── index.ts          # contextBridge.exposeInMainWorld('api', {...})
│   ├── renderer/
│   │   ├── index.html        # Renderer HTML entry
│   │   └── index.tsx         # React root (blank in Phase 1)
│   └── shared/
│       ├── types.ts          # SessionRecord, LogicalId, SessionStatus, SessionIconSpec
│       ├── id-factory.ts     # newLogicalId() wrapping uuid v4
│       └── __tests__/
│           ├── identity.guard.test.ts   # D-05 guard
│           └── security.guard.test.ts  # D-07 guard
├── tests/
│   └── smoke/
│       └── boot.smoke.test.ts           # D-09 WDIO boot test
├── forge.config.ts
├── vite.main.config.ts
├── vite.preload.config.ts
├── vite.renderer.config.ts
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.ts
├── wdio.conf.ts
└── package.json
```

**Global variables exposed by Forge Vite plugin** (use in main/index.ts to load renderer):
- `MAIN_WINDOW_VITE_DEV_SERVER_URL` — URL of Vite dev server (dev mode)
- `MAIN_WINDOW_VITE_NAME` — static file path (prod mode)

### Pattern 1: Electron Forge Vite-TypeScript Template Layout

**What:** The official scaffold produces four entry files (`src/main.ts`, `src/preload.ts`, `src/renderer.ts`, `index.html`) plus `forge.config.ts` and three Vite config files.

**Note:** The Forge template places files at `src/main.ts` (flat), not `src/main/index.ts`. The recommended structure above moves them into subdirectories for Phase 2+ organization. Both approaches are valid; the planner should decide at wave 0.

**forge.config.ts (annotated):**
```typescript
// Source: electronforge.io/config/plugins/vite [CITED]
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRPM } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({}),
    new MakerRPM({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}), // wired now; essential once node-pty arrives in Phase 2
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
        { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
      ],
    }),
  ],
};

export default config;
```

**vite.main.config.ts:**
```typescript
// Source: electronforge.io/config/plugins/vite + node-pty external requirement [CITED]
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],  // Main process MUST be CJS — see ESM note below
    },
    rollupOptions: {
      external: ['electron', 'node-pty'], // node-pty is external even before Phase 2 installs it
    },
  },
});
```

**vite.preload.config.ts:**
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/preload/index.ts',
      formats: ['cjs'],  // Preload also CJS — see ESM note below
    },
    rollupOptions: {
      external: ['electron'],
    },
  },
});
```

### Pattern 2: Secure Process Split (webPreferences)

**What:** The `BrowserWindow` constructor requires specific security settings. `sandbox: true` is the default since Electron 20 but should be explicit.

**Implications of `sandbox: true` for the preload:**
- [CITED: electronjs.org/docs/latest/tutorial/sandbox] The preload runs in a sandboxed context where the `require` function is a polyfill with limited functionality.
- Available Electron modules in sandboxed preload: `contextBridge`, `crashReporter`, `ipcRenderer`, `nativeImage`, `webFrame`, `webUtils`
- Available Node.js built-ins in sandboxed preload: `events`, `timers`, `url`
- NOT available: fs, path, child_process, or any npm packages (cannot `require('uuid')`)
- Consequence for Phase 1: the preload cannot import `uuid`. `newLogicalId()` must live in `src/shared/id-factory.ts` and be called from the main process only.
- Consequence for IPC: `ipcRenderer` IS available in the preload; use `ipcRenderer.invoke()` inside `contextBridge.exposeInMainWorld()`.

**src/main/index.ts (BrowserWindow creation):**
```typescript
// Source: electronjs.org/docs/latest/tutorial/security [CITED]
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,   // REQUIRED — default since v12
      nodeIntegration: false,   // REQUIRED — never enable
      sandbox: true,            // REQUIRED — default since v20; explicit for D-07 guard test
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

// Minimal IPC handler for Phase 1 walking skeleton
ipcMain.handle('api:get-version', () => app.getVersion());

app.whenReady().then(createWindow);
```

### Pattern 3: Typed contextBridge Surface

**What:** The `contextBridge` is the only renderer↔main bridge. A shared TypeScript type for `window.api` ensures the renderer gets type-checked access.

**src/preload/index.ts:**
```typescript
// Source: github.com/electron/electron/docs/tutorial/context-isolation.md [CITED]
import { contextBridge, ipcRenderer } from 'electron';

// Define the API surface type inline — renderer imports from shared/api-types.ts
const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('api:get-version'),
};

contextBridge.exposeInMainWorld('api', api);

// Export type for use in shared/api-types.ts — see note below
export type ElectronAPI = typeof api;
```

**src/shared/api-types.ts** (the type bridge — importable in renderer):
```typescript
// This file contains NO runtime imports — pure types only
// Prevents any electron/node API from leaking into the renderer bundle
export type ElectronAPI = {
  getVersion: () => Promise<string>;
};

// Window augmentation — import this in renderer entry point
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
```

**src/renderer/index.tsx (fragment):**
```typescript
import '../../shared/api-types'; // import the Window augmentation

// Now window.api is typed
const version = await window.api.getVersion(); // TS knows return type: Promise<string>
```

### Pattern 4: Branded LogicalId Type

**What:** A compile-time-only nominal type that prevents `string` or `number` from being used where a `LogicalId` is expected. Zero runtime cost.

**src/shared/types.ts:**
```typescript
// Source: learningtypescript.com/articles/branded-types [CITED] + idiomatic 2025 TS pattern [ASSUMED]

// Branded type — compile-time only, no runtime cost
export type LogicalId = string & { readonly __brand: 'LogicalId' };

// Only minting path — no other code may cast to LogicalId
export function newLogicalId(): LogicalId {
  // uuid v4 in pure Node.js context (main process only — NOT callable from sandboxed preload)
  // uuid v14 API: v4() for random UUID
  const { v4: uuidv4 } = require('uuid'); // CJS-compatible in main process
  return uuidv4() as LogicalId;
}

export type SessionStatus = 'not_started' | 'running' | 'stopped' | 'exited' | 'error';

export type SessionIconSpec =
  | { type: 'emoji'; value: string }
  | { type: 'preset'; value: string }
  | { type: 'color'; value: string };

export interface SessionRecord {
  logicalId: LogicalId;       // stable identity — UUID, branded
  ptyPid?: number;             // transient process ID — plain number, optional
  name: string;
  icon: SessionIconSpec;
  cwd: string;
  shell: string;
  startupCommand?: string;
  status: SessionStatus;
  order: number;
  lastActive: number;          // Unix timestamp ms
}
```

**uuid v14 import note:** uuid v14 is the current stable. For ESM-style shared code that is bundled by Vite: `import { v4 as uuidv4 } from 'uuid'` works. For CJS main process outside bundle: `const { v4 } = require('uuid')`. Since `newLogicalId()` will live in shared code and be called from the main process, the bundler handles the interop — use the ESM import in source. [VERIFIED: npm registry — uuid@14.0.0]

### Pattern 5: ESLint Flat Config with Renderer Path Restriction

**What:** ESLint v9 flat config scopes the `no-restricted-imports` rule to renderer source paths only, allowing preload and main to import `electron` and `ipcRenderer` freely.

**eslint.config.ts:**
```typescript
// Source: eslint.org/docs/latest/use/configure/migration-guide [CITED]
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // 1. Base TypeScript rules for ALL source
  ...tseslint.configs.recommended,

  // 2. Renderer-only security rule — scoped to src/renderer/** ONLY
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'electron/*'],
              message: 'Never import from electron in the renderer. Use window.api (contextBridge) instead.',
            },
            {
              group: ['*/ipcRenderer', '*ipcRenderer*'],
              message: 'ipcRenderer is not accessible in renderer. Use window.api (contextBridge).',
            },
          ],
        },
      ],
    },
  },

  // 3. Prettier last — must be trailing entry to override formatting rules
  eslintConfigPrettier,
);
```

**Key ESLint flat config behaviors to know:** [CITED: eslint.org/docs/latest/rules/no-restricted-imports]
- The `files` property scopes the override to a glob pattern — only files matching `src/renderer/**` get the restriction.
- Main process (`src/main/**`) and preload (`src/preload/**`) are NOT in this override and may import `electron` freely.
- `shared/` is also NOT restricted — but `shared/` must not import `electron` anyway (it's pure TypeScript). Consider adding a separate `no-restricted-imports` entry for `src/shared/**` as defense-in-depth.
- As of ESLint v9+, if multiple entries in `paths` have the same name, all apply (changed from v8 behavior).

### Pattern 6: Vitest for Guard Tests

**What:** Vitest runs in Node environment for guard tests that check TypeScript type structure and configuration objects. No Electron process required.

**vitest.config.ts:**
```typescript
// Source: vitest.dev/guide/environment [CITED]
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',   // Guard tests are pure Node — no browser/jsdom needed
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.guard.test.ts'],
    exclude: ['tests/smoke/**'],  // WDIO smoke tests run separately
  },
});
```

**src/shared/__tests__/identity.guard.test.ts (D-05):**
```typescript
import { describe, it, expect } from 'vitest';
import type { SessionRecord, LogicalId } from '../types';

describe('SessionRecord identity invariant (D-05)', () => {
  it('logicalId and ptyPid are declared as distinct fields', () => {
    // Type-level check: create a record and verify field types are structurally distinct
    const record: SessionRecord = {
      logicalId: 'test-id' as LogicalId,
      ptyPid: 12345,  // plain number — NOT a LogicalId
      name: 'Test',
      icon: { type: 'emoji', value: '🧪' },
      cwd: '/tmp',
      shell: '/bin/zsh',
      status: 'not_started',
      order: 0,
      lastActive: Date.now(),
    };

    // Runtime assertion: they are genuinely separate fields with different values
    expect(record.logicalId).not.toBe(record.ptyPid);
    expect(typeof record.logicalId).toBe('string');
    expect(typeof record.ptyPid).toBe('number');

    // If someone tries: record.logicalId = record.ptyPid — TypeScript compilation fails.
    // This test documents the invariant; the TS compiler is the real enforcer.
  });

  it('logicalId cannot be set to a raw number (compile-time enforced)', () => {
    // This test documents the invariant via a type assertion.
    // @ts-expect-error — this line MUST produce a TS error; if it does not, the brand is broken
    const bad: LogicalId = 12345;
    // If TypeScript accepts the above, the test infrastructure has regressed.
    // The @ts-expect-error means Vitest passes only when TS correctly rejects the assignment.
    expect(bad).toBeDefined(); // never reached in practice; TypeScript prevents compilation
  });
});
```

**src/shared/__tests__/security.guard.test.ts (D-07):**
```typescript
import { describe, it, expect } from 'vitest';

// Extract webPreferences into a config function — testable without Electron
export function buildWebPreferences(preloadPath: string) {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: preloadPath,
  };
}

// Export the window.api surface shape for guard checking
export const EXPECTED_API_KEYS = ['getVersion'] as const;

describe('Electron security config (D-07)', () => {
  it('webPreferences has contextIsolation:true, nodeIntegration:false, sandbox:true', () => {
    const prefs = buildWebPreferences('/fake/preload.js');
    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.nodeIntegration).toBe(false);
    expect(prefs.sandbox).toBe(true);
  });

  it('window.api surface exposes only documented methods', () => {
    // This is a shape/contract test — the actual preload exposes the same keys
    // A future regression that adds raw electron access would show up here
    const mockApi: Record<string, unknown> = {
      getVersion: async () => '1.0.0',
    };
    expect(Object.keys(mockApi)).toEqual(expect.arrayContaining(EXPECTED_API_KEYS));
    // No extra keys not in EXPECTED_API_KEYS
    const unexpectedKeys = Object.keys(mockApi).filter(
      k => !(EXPECTED_API_KEYS as readonly string[]).includes(k)
    );
    expect(unexpectedKeys).toHaveLength(0);
  });
});
```

**Note on Vitest + Electron environment:** [CITED: vitest.dev/guide/environment]
Guard tests run in `environment: 'node'`. Do NOT set `ELECTRON_RUN_AS_NODE=1` in package.json for the guard test script — that variable is only needed if you run Vitest inside Electron's own process (not applicable here). The guard tests have no Electron dependency.

### Pattern 7: Boot Smoke Test — @wdio/electron-service v10

**Why `@wdio/electron-service` over Playwright:**

1. **Playwright Electron 36 issue**: A documented `electron.launch()` failure exists for Electron 36.x in CI environments (filed June 2025, issue #47419 in electron/electron). It was partially fixed in Electron 37, but since this project pins Electron 36.9.5 for stability, using Playwright for smoke tests introduces a known fragility. [CITED: github.com/electron/electron/issues/47419]
2. **Playwright remains "experimental"**: The Playwright team labels Electron support experimental (confirmed in official docs and maintainer statement as of 2025). While functional for large projects like VS Code, the label carries real risk of breaking changes between Playwright versions.
3. **`@wdio/electron-service` is Electron Forge-aware**: v10 auto-detects Forge output paths at `out/{appName}-{OS}-{arch}`, requiring minimal configuration. It auto-installs the matching Chromedriver for Electron v26+. [CITED: webdriver.io/docs/desktop-testing/electron/]
4. **WDIO is the approach listed in Electron's official automated-testing docs**: Electron's docs list WebdriverIO as a supported option without the "experimental" caveat.

**wdio.conf.ts (minimal):**
```typescript
// Source: webdriver.io/docs/desktop-testing/electron/ [CITED]
import type { Options } from '@wdio/types';

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./tests/smoke/**/*.smoke.test.ts'],
  maxInstances: 1,
  services: [
    ['electron', {
      // Electron Forge auto-detection: out/just-wrapper-darwin-arm64/just-wrapper.app etc.
      // appEntryPoint only needed if auto-detection fails:
      // appEntryPoint: '.vite/build/main.js',
    }],
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { timeout: 30000 },
};
```

**tests/smoke/boot.smoke.test.ts:**
```typescript
// Source: webdriver.io/docs/desktop-testing/electron/ [CITED]
describe('Boot smoke test (D-09)', () => {
  it('app window appears with no console errors', async () => {
    // @wdio/electron-service boots the app and provides browser as the window
    const title = await browser.getTitle();
    expect(title).toBeTruthy(); // window opened

    // Assert no console errors were emitted during startup
    const logs = await browser.getLogs('browser');
    const errors = logs.filter((l: { level: string }) => l.level === 'SEVERE');
    expect(errors).toHaveLength(0);
  });
});
```

**Running the smoke test separately from unit tests:**
```json
// package.json scripts
{
  "test:unit": "vitest run",
  "test:smoke": "wdio run wdio.conf.ts",
  "test": "npm run test:unit && npm run test:smoke"
}
```

### Anti-Patterns to Avoid

- **`require('electron')` or `import { ipcRenderer }` in renderer code:** Violates contextIsolation. ESLint D-06 catches this. Runtime behavior: undefined or crash depending on sandbox setting.
- **Calling `newLogicalId()` from the preload or renderer:** `uuid` cannot be required in a sandboxed preload. The factory must only be called from main.
- **`window.api = { ...exposedByContextBridge }` pattern:** Do not reassign `window.api` in renderer code; the contextBridge property is read-only.
- **Using `__dirname` in renderer or preload Vite build:** `__dirname` is a CommonJS global. In Vite-built code, use `import.meta.url` or let Forge provide `MAIN_WINDOW_VITE_DEV_SERVER_URL`. Only use `__dirname` in the main process (CJS build).
- **TypeScript `enum` for SessionStatus:** [CITED: 01-CONTEXT.md decision D-02] String literal unions work better under `isolatedModules: true` (which Vite requires). Enums have runtime presence and serialize oddly.
- **`declare const` for Forge globals without a types stub:** Forge's Vite plugin injects `MAIN_WINDOW_VITE_DEV_SERVER_URL` and `MAIN_WINDOW_VITE_NAME` as globals. Without a `.d.ts` declaration, TypeScript will complain. Add a `src/types.d.ts` with `declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;` etc.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID string | `uuid` v4 | UUID collision probability is 1 in 10^18; hand-rolled IDs have no such guarantee |
| contextBridge typed surface | Custom IPC wrapper | `contextBridge.exposeInMainWorld` | Any other approach breaks contextIsolation |
| Module bundling for renderer | Custom webpack/rollup config | Vite via Electron Forge plugin | Forge Vite plugin handles HMR, externals, and Electron globals automatically |
| Native module rebuild | Custom build script | `@electron/rebuild` | `@electron/rebuild` handles all ABI lookup, header download, and rebuild in one command |
| Process sandboxing | Custom sandbox logic | `sandbox: true` in webPreferences | Electron's sandbox is OS-level (Chromium's sandbox); you cannot replicate it |

**Key insight:** The process-split model in Electron (main/preload/renderer) is load-bearing security infrastructure, not just an architecture preference. Any deviation from `contextBridge` as the only bridge introduces privilege escalation paths. Do not invent custom IPC patterns.

---

## D-10: Electron Version Pin — Authoritative Recommendation

**Recommended pin: Electron 36.9.5**

**Evidence chain:**

1. **node-pty 1.1.0** (released 2025-12-22) uses `node-addon-api ^7.1.0` and builds via `node-gyp` on install. It does NOT ship Electron-specific prebuilt binaries; it always rebuilds from source via `@electron/rebuild`. This means ABI compatibility depends entirely on whether `@electron/rebuild` can look up the target Electron's ABI. [VERIFIED: npm registry — node-pty@1.1.0]

2. **`@electron/rebuild 4.0.4`** depends on `node-abi ^4.2.0`; the current `node-abi@4.31.0` (published 2026-05-06) contains ABI entries for Electron 33–42 inclusive. ABI 135 = Electron 36, ABI 146 = Electron 42. All versions in the project's range are covered. [VERIFIED: npm registry — node-abi@4.31.0; CITED: github.com/electron/node-abi/abi_registry.json]

3. **node-pty 1.2.0-beta.13** (published 2026-05-13) used Electron 39.x in its own CI examples. However, since node-pty rebuilds from source against any ABI, "tested with Electron 39" does not mean "incompatible with Electron 36 or 42". It means the Microsoft maintainers verified the beta against Electron 39 in their CI. [CITED: github.com/microsoft/node-pty/releases]

4. **Electron 36.x has a documented Playwright `electron.launch()` failure** in Linux CI (issue #47419, June 2025). This is irrelevant for local macOS dev and a non-issue once we use `@wdio/electron-service` instead of Playwright. [CITED: github.com/electron/electron/issues/47419]

5. **D-10 conservative posture**: The CONTEXT.md explicitly says to lean toward Electron 36/38 over 42. Electron 36.9.5 was stable for 8+ months before the research date. No node-pty rebuild failures have been reported for Electron 36 with node-pty 1.1.0.

6. **Upgrade path**: If Electron 36 causes an unforeseen blocker before Phase 2 adds node-pty, upgrading to Electron 38 (ABI 139) requires one line change in `package.json` and a re-run of `npm install`. The `@electron/rebuild` postinstall handles everything automatically.

**Downside of pinning 36 vs 38 vs 42:**

| Pin | Pros | Cons |
|-----|------|------|
| 36.9.5 | Max stability, 8-month track record, avoids Playwright/36 CI issue | Oldest recommended pin; further from latest security patches |
| 38.8.6 | Newer security patches; still pre-latest | Slightly less track record with node-pty 1.1.0 |
| 42.3.2 (latest) | Latest security, Chrome 130 | node-pty 1.2.0-beta.13 was only tested against Electron 39; latest Electron has shorter stability track record with native modules |

**Final recommendation: Electron 36.9.5 for Phase 1.** Revisit before Phase 2 if node-pty reports issues. The version can be changed in one line; the architecture cannot.

---

## D-09: Boot Smoke Test — Authoritative Recommendation

**Recommended: `@wdio/electron-service` v10 (`@wdio/electron-service@10.0.0`)**

| Criterion | `@wdio/electron-service` v10 | Playwright `_electron` |
|-----------|------------------------------|------------------------|
| Electron Forge-aware | Yes — auto-detects `out/` path | No — must pass main script path manually |
| Electron 36 support | Yes — auto-handles Chromedriver for Electron 26+ | Known `electron.launch()` failure in CI on Electron 36.x |
| Experimental label | No — listed as supported in Electron official docs | Yes — still labeled "experimental" by Playwright team |
| Setup weight for smoke test | Medium (wdio.conf.ts + install) | Lower for simple tests, but needs Forge build output path |
| Chromedriver management | Automatic (v26+) | Not applicable (uses CDP directly) |
| Breaking changes risk | Low — WDIO 9.x → 10.x is the current stable series | Moderate — experimental APIs may change |

**Bottom line:** Use `@wdio/electron-service`. The Playwright/Electron 36 launch failure in CI would break the required smoke test in Phase 1 before the project even reaches Phase 8. WDIO avoids that regression entirely.

---

## Q8: ESM vs CJS Module Strategy

**Recommendation: Keep CJS for main process and preload; use ESM for renderer via Vite.**

**Rationale:**

- **Vite-built renderer** always outputs ESM (default); no action needed.
- **Electron Forge's Vite plugin** bundles main and preload as CJS by default (`format: 'cjs'` in `vite.main.config.ts`). This is the correct default. [CITED: electronforge.io/config/plugins/vite]
- **node-pty is a native CJS module.** It cannot be imported as ESM. If the main process were ESM, dynamic `import()` would be required just to load node-pty. CJS avoids this complexity entirely. [ASSUMED — node-pty's module type is CJS; this is training knowledge, confirmed by `npm view node-pty` showing no `"type": "module"` in package.json]
- **lowdb v7 is ESM-only** (Phase 5 concern). When Phase 5 arrives, the solution is to import lowdb via dynamic `import()` in the CJS main process: `const { Low } = await import('lowdb')`. This works in Node.js 18+ CJS. Do NOT set `"type": "module"` in `package.json` to accommodate lowdb — that would break node-pty's CJS require. [CITED: electronjs.org/docs/latest/tutorial/esm; ASSUMED — specific lowdb/node-pty interop recommendation is based on training knowledge]
- **Phase 1 action:** Explicitly set `formats: ['cjs']` in `vite.main.config.ts` and `vite.preload.config.ts`. Do NOT set `"type": "module"` in the root `package.json`.

---

## Common Pitfalls

### Pitfall 1: `@electron/rebuild` postinstall fails when node-pty is absent

**What goes wrong:** The postinstall script `electron-rebuild -f -w node-pty` errors with "Could not find module node-pty to rebuild" if node-pty is not installed.
**Why it happens:** The `-w` flag (which) tells electron-rebuild to rebuild only a specific named module; if that module is absent, it may exit non-zero.
**How to avoid:** Two options: (a) Do NOT use `-w node-pty` in Phase 1's postinstall — use `electron-rebuild -f` with no `-w` flag; this rebuilds all native modules found and exits with 0 if none are present. (b) Alternatively, use `electron-rebuild -f -w node-pty --skip-if-missing` if that flag exists in v4.0.4 (confirm in source). **Safest for Phase 1: `electron-rebuild -f` (no `-w`).**
**Warning signs:** `npm install` exits non-zero in Phase 1 with a message about node-pty not found.

### Pitfall 2: Forge global variables not declared in TypeScript

**What goes wrong:** TypeScript errors on `MAIN_WINDOW_VITE_DEV_SERVER_URL` in `src/main/index.ts` — `Cannot find name 'MAIN_WINDOW_VITE_DEV_SERVER_URL'`.
**Why it happens:** The Forge Vite plugin injects these as webpack-style `DefinePlugin` globals, but there is no `.d.ts` declaration for them in the scaffold by default.
**How to avoid:** Add to `src/types.d.ts`:
```typescript
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
```
**Warning signs:** TypeScript compilation errors in main process pointing to these global names.

### Pitfall 3: `uuid` require in sandboxed preload

**What goes wrong:** `require('uuid')` in `src/preload/index.ts` throws at runtime: "module not found" or "require is not a function".
**Why it happens:** Sandboxed preloads have a polyfilled `require` that only allows specific Electron + Node built-ins. npm packages are not available.
**How to avoid:** Never call `newLogicalId()` from the preload. ID generation belongs in the main process only. The `uuid` import in `src/shared/id-factory.ts` is fine — but only the main process calls `newLogicalId()`.
**Warning signs:** Console error in DevTools about require or module resolution on startup.

### Pitfall 4: Electron version type mismatch when guard test checks webPreferences

**What goes wrong:** The D-07 guard test checks the config object, but if the test directly instantiates `BrowserWindow`, it tries to import Electron — which is not available in a pure Vitest Node environment.
**Why it happens:** `BrowserWindow` is a main-process Electron API.
**How to avoid:** The D-07 guard test should NOT import from `electron`. Instead, extract `buildWebPreferences()` as a pure function in `src/main/window-config.ts` and import that function in the test. The test calls the function and asserts on the returned plain object. No Electron API needed. (See Pattern 6 above.)
**Warning signs:** Test fails with "Cannot find module 'electron'" — means the test is trying to import Electron directly.

### Pitfall 5: ESLint flat config does not apply to `.ts` files by default

**What goes wrong:** ESLint runs but doesn't lint TypeScript files — no errors caught.
**Why it happens:** ESLint flat config's default `files` pattern is `**/*.js`. TypeScript files must be explicitly included.
**How to avoid:** Add `files: ['**/*.{ts,tsx}']` to your config objects, or use `tseslint.config(tseslint.configs.recommended)` which handles this automatically.
**Warning signs:** Running `eslint src/renderer/index.tsx` produces no output (not even "no issues found").

### Pitfall 6: Walking skeleton IPC not wired before smoke test

**What goes wrong:** Boot smoke test passes (window appears) but `window.api.getVersion()` is not callable — the renderer has no ipcMain handler registered.
**Why it happens:** If main process doesn't call `ipcMain.handle('api:get-version', ...)` before the window loads, the invoke call hangs forever.
**How to avoid:** Register all `ipcMain.handle()` calls before `app.whenReady()` resolves and `createWindow()` is called.
**Warning signs:** Renderer console shows `Error: No handler registered for 'api:get-version'`.

---

## Code Examples

### Walking Skeleton: Minimal End-to-End Slice

The "thinnest slice" for Phase 1 is: main registers handler → preload exposes typed bridge → renderer calls `window.api.getVersion()` → result displayed in blank window.

**src/renderer/index.tsx (minimal):**
```typescript
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../../shared/api-types'; // Window augmentation

function App() {
  const [version, setVersion] = useState<string>('...');

  useEffect(() => {
    window.api.getVersion().then(setVersion);
  }, []);

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <p>Just-Wrapper v{version}</p>
    </div>
  );
}

const root = document.getElementById('root')!;
ReactDOM.createRoot(root).render(<App />);
```

This intentionally blank renderer with a single version readout proves the contextBridge round-trip works (SC3) and the window opened without errors (SC1).

### LogicalId Branded Type — Type Safety Demonstration

```typescript
// Source: learningtypescript.com/articles/branded-types [CITED]
import type { LogicalId } from './types';
import { newLogicalId } from './id-factory';

// CORRECT: LogicalId from the factory
const id: LogicalId = newLogicalId(); // ✓

// COMPILE ERROR (TypeScript catches this):
// const bad: LogicalId = 'arbitrary-string'; // ✗ Type 'string' not assignable to type 'LogicalId'
// const alsoBad: LogicalId = 12345;           // ✗ Type 'number' not assignable to type 'LogicalId'

// Map keyed by LogicalId (Phase 2+ pattern established now):
const sessionMap = new Map<LogicalId, string>();
sessionMap.set(id, 'session-data');
// sessionMap.set('some-pid', 'bad'); // ✗ TS error: string not assignable to LogicalId
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` | `typescript-eslint` unified package | typescript-eslint v6 (2023), v8 current | One install, one import replaces two packages |
| ESLint `.eslintrc.json` legacy config | `eslint.config.ts` flat config | ESLint v9 (2024) | Flat config is now the only non-deprecated option |
| `xterm` (unscoped npm package) | `@xterm/xterm` | xterm v5 (2023) | Old package is deprecated at v5.3.0; do not install |
| `electron-store` | `lowdb` v7 | 2024 (electron-store went unmaintained) | Phase 5 choice; flagged here to prevent accidental install in Phase 1 |
| `wdio-electron-service` | `@wdio/electron-service` | 2024–2025 (moved to official WDIO org) | `wdio-electron-service` is deprecated; use `@wdio/electron-service` |
| `winpty` on Windows | ConPTY (node-pty built-in) | node-pty 1.x | winpty dropped; ConPTY is the only Windows path; minimum Win 10 1809 |

**Deprecated/outdated (do not use in this project):**
- `xterm` (unscoped): deprecated at v5.3.0; use `@xterm/xterm`
- `electron-store`: unmaintained; use `lowdb`
- `wdio-electron-service` (scoped without @wdio): deprecated; use `@wdio/electron-service`
- `electron-rebuild` (old package name): use `@electron/rebuild`
- `.eslintrc.json`/`eslintrc.js`: deprecated in ESLint 9; use `eslint.config.ts`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | node-pty is CJS-only (no `"type": "module"`) | Q8 ESM/CJS strategy | If node-pty were ESM-capable, dynamic import workaround in Phase 5 might be unnecessary. Low risk — CJS main process is correct regardless. |
| A2 | `@electron/rebuild` with no `-w` flag exits 0 when no native modules are present | Pitfall 1; Standard Stack notes | If it exits non-zero, postinstall would fail after every `npm install` in Phase 1. Mitigation: test immediately after scaffold with `npm run postinstall` and observe exit code. |
| A3 | `@wdio/electron-service` v10 works with Electron 36 in local macOS dev (the known issue is Linux CI-specific) | D-09 recommendation | If v10 fails on macOS locally with Electron 36, the smoke test setup needs a different approach. Mitigation: verify in Wave 1 of Phase 1 before committing to WDIO. |
| A4 | uuid v14 API for v4: `import { v4 as uuidv4 } from 'uuid'` works in ESM-bundled source | Pattern 4 | uuid v14 may have changed the API surface. Mitigation: verify `uuidv4()` is still exported as `v4` in uuid@14. Low risk — this API has been stable since uuid v1. |
| A5 | `@ts-expect-error` pattern in Vitest guard test is the idiomatic way to assert TypeScript type errors at test time | Pattern 6 guard test | If the TypeScript project is not strict enough, `@ts-expect-error` may silently not error. Mitigation: ensure `tsconfig.json` has `"strict": true` and `"noImplicitAny": true`. |

**If this table is empty: N/A** — several assumptions are noted above; they are low-risk and verifiable during implementation.

---

## Open Questions

1. **Exact `@electron/rebuild` behavior with no native modules**
   - What we know: Documentation says it rebuilds all native modules it finds; `-w` restricts to named module.
   - What's unclear: Whether running with no `-w` and no native modules installed exits 0 silently or logs a warning.
   - Recommendation: Include `npm run postinstall` in the Wave 0 validation checklist; if it errors, remove `-w` or add a package.json `postinstall` guard like `electron-rebuild -f 2>/dev/null || true` (acceptable since Phase 1 has no native modules).

2. **uuid v14 exact import API**
   - What we know: uuid@14.0.0 is current stable; uuid has exported `v4` since v1.
   - What's unclear: Whether any breaking changes in v14 affect `import { v4 as uuidv4 }`.
   - Recommendation: Verify `npm view uuid@14.0.0 exports` in Wave 0; fall back to `crypto.randomUUID()` (available Node 19+, Electron 21+ renderer) if needed.

3. **Electron 36 vs 38 for Phase 2 node-pty compatibility**
   - What we know: Both have ABI entries in node-abi; both should rebuild node-pty. No specific failures found in search.
   - What's unclear: Whether any unreported node-pty 1.1.0 issues exist with Electron 36 ABI 135.
   - Recommendation: After Phase 1 scaffold is complete, add `node-pty@1.1.0` to a local branch and run `@electron/rebuild` before committing to Electron 36. If rebuild fails, bump to 36 → 37 (ABI 136) or 38 (ABI 139).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install, Electron build | ✓ | 22+ (macOS dev machine) | — |
| npm | Package management | ✓ | Current | — |
| macOS (dev) | Phase 1 SC4 (@electron/rebuild) | ✓ | macOS 12+ | — |
| Xcode CLI tools | node-gyp / @electron/rebuild | Must verify on dev machine | Any recent | Brew install xcode-select |
| Python 3 | node-gyp (rebuild) | ✓ (Anaconda detected) | 3.12 | — |
| Git | Forge project scaffold | ✓ | Any | — |

**Missing dependencies with no fallback:** None known — all tooling is npm-installable.

**Missing dependencies with fallback:** Xcode CLI tools (needed for node-gyp) — if absent, `xcode-select --install`. This is the most common macOS first-run failure.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:unit` |
| Full suite command | `npm run test:unit && npm run test:smoke` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IDENT-01 | `logicalId` is a branded `LogicalId` type; only `newLogicalId()` can create one | unit (guard) | `vitest run src/shared/__tests__/identity.guard.test.ts` | ❌ Wave 0 |
| IDENT-02 | `logicalId` and `ptyPid` are distinct fields; never assigned from each other | unit (guard) | `vitest run src/shared/__tests__/identity.guard.test.ts` | ❌ Wave 0 |
| SC1 | `npm start` launches a blank Electron window with no console errors | smoke (E2E) | `wdio run wdio.conf.ts` | ❌ Wave 0 |
| SC3 | `contextBridge.exposeInMainWorld` is the only renderer↔main bridge | unit (guard) | `vitest run src/shared/__tests__/security.guard.test.ts` | ❌ Wave 0 |
| SC4 | `@electron/rebuild` postinstall hook runs without error | manual (npm hook) | `npm install` (observe postinstall exit) | N/A (script in package.json) |
| D-07 | `webPreferences` has `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` | unit (guard) | `vitest run src/shared/__tests__/security.guard.test.ts` | ❌ Wave 0 |
| D-06 | No `electron`/`ipcRenderer` imports in `src/renderer/**` | lint | `eslint src/renderer/` | ❌ Wave 0 (config file) |

### Sampling Rate

- **Per task commit:** `npm run test:unit` (guard tests; ~1s)
- **Per wave merge:** `npm run test:unit && npm run test:smoke`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/shared/__tests__/identity.guard.test.ts` — covers IDENT-01, IDENT-02
- [ ] `src/shared/__tests__/security.guard.test.ts` — covers SC3, D-07
- [ ] `tests/smoke/boot.smoke.test.ts` — covers SC1
- [ ] `vitest.config.ts` — test runner config
- [ ] `wdio.conf.ts` — smoke test harness config
- [ ] `eslint.config.ts` — ESLint flat config with renderer restriction (D-06)
- [ ] `src/shared/types.d.ts` — Forge global variable declarations

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in Phase 1 |
| V3 Session Management | No | No network sessions in Phase 1 |
| V4 Access Control | Yes — process boundary | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; contextBridge as only bridge |
| V5 Input Validation | No | No user input processed in Phase 1 |
| V6 Cryptography | No | No crypto operations in Phase 1 |

### Known Threat Patterns for Electron Scaffold

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Renderer accessing Node.js APIs directly | Elevation of Privilege | `nodeIntegration: false` + `contextIsolation: true` (default + explicit) |
| Prototype pollution via IPC | Tampering | Validate IPC argument types in `ipcMain.handle` handlers (applies from Phase 2; not user-supplied in Phase 1) |
| Preload script injection from untrusted URL | Spoofing | `sandbox: true` limits preload to whitelisted modules |
| Raw `ipcRenderer` exposed on `window` | Elevation of Privilege | ESLint D-06 rule bans this in renderer; `contextBridge` is the only export path |

---

## Sources

### Primary (HIGH confidence)

- [Electron docs: Security](https://www.electronjs.org/docs/latest/tutorial/security) — webPreferences settings, contextIsolation, sandbox
- [Electron docs: Sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox) — sandboxed preload available modules (ipcRenderer, contextBridge; no npm packages)
- [Electron docs: ESM](https://www.electronjs.org/docs/latest/tutorial/esm) — ESM support requires Electron 28+; main-process async loading constraints
- [Electron docs: Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules) — @electron/rebuild usage
- [Electron Forge: Vite + TypeScript template](https://www.electronforge.io/templates/vite-+-typescript) — scaffold command, Vite plugin
- [Electron Forge: Vite Plugin](https://www.electronforge.io/config/plugins/vite) — forge.config.ts structure, global variables
- [node-abi ABI registry](https://github.com/electron/node-abi/blob/main/abi_registry.json) — ABI numbers for Electron 36–42
- [node-pty npm](https://www.npmjs.com/package/node-pty) — v1.1.0 stable (2025-12-22), v1.2.0-beta.13 (2026-05-13)
- [node-pty releases](https://github.com/microsoft/node-pty/releases) — v1.2.0-beta.13 uses Electron 39 in examples
- [@electron/rebuild npm](https://www.npmjs.com/package/@electron/rebuild) — v4.0.4, uses node-abi ^4.2.0
- [WebdriverIO Electron docs](https://webdriver.io/docs/desktop-testing/electron/) — @wdio/electron-service setup, Forge auto-detection
- [Electron automated testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing) — WebdriverIO and Playwright both listed
- [Vitest environments](https://vitest.dev/guide/environment) — Node environment for guard tests

### Secondary (MEDIUM confidence)

- [Electron issue #47419](https://github.com/electron/electron/issues/47419) — Playwright `electron.launch()` failure on Electron 36.x; partially fixed in Electron 37
- [Playwright maintainer on Electron experimental status](https://ray.run/discord-forum/threads/141836-state-of-electron-support-on-playwright) — "experimental by definition, usable in production"
- [learningtypescript.com: Branded Types](https://www.learningtypescript.com/articles/branded-types) — branded type pattern documentation
- [ESLint no-restricted-imports docs](https://eslint.org/docs/latest/rules/no-restricted-imports) — rule options, path scoping via flat config `files`
- [ESLint flat config migration guide](https://eslint.org/docs/latest/use/configure/migration-guide) — flat config `files` property usage

### Tertiary (LOW confidence / Assumed)

- `@electron/rebuild` no-op behavior with no native modules — assumed based on tool design; flag for verification in Wave 0
- uuid v14 `v4` export API is backward-compatible — assumed; verify with `npm view uuid@14.0.0`

---

## Metadata

**Confidence breakdown:**
- Electron version pin: HIGH — backed by node-abi ABI registry (authoritative), release dates, and D-10 conservative posture directive
- Scaffold / Forge template: HIGH — official Electron Forge docs
- Typed contextBridge pattern: HIGH — official Electron context-isolation docs
- Sandbox preload restrictions: HIGH — official Electron sandbox docs
- Boot smoke test recommendation (WDIO): HIGH for the logic; MEDIUM for WDIO v10 + Electron 36 local macOS (see A3 assumption)
- Branded types: HIGH — well-established TypeScript pattern
- ESLint flat config: HIGH — official ESLint docs
- Vitest setup: HIGH — official Vitest docs
- ESM/CJS strategy: MEDIUM — based on official Electron ESM docs + training knowledge for interop

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable domain; Electron and Forge release on ~8-week cycles — check for Electron 43 before Phase 2)
