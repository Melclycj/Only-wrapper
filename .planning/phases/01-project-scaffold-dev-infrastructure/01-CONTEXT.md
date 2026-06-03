# Phase 1: Project Scaffold + Dev Infrastructure - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A runnable Electron skeleton with the correct **main / renderer / preload** process split, a **typed `contextBridge` API** as the *only* renderer↔main bridge, **shared TypeScript types** that permanently separate `logicalId` from `ptyPid`, and the **native-module build tooling** (`@electron/rebuild` postinstall) wired up.

No terminal, no PTY, no UI — the renderer is intentionally **blank**. This phase exists to make the foundational identity and security invariants impossible to violate in later phases.

**Requirements covered:** IDENT-01 (stable internal session ID), IDENT-02 (logicalId tracked separately from PTY PID).

**Success criteria anchor (from ROADMAP.md):**
1. `npm start` launches an Electron window with a blank renderer — no console errors about nodeIntegration, contextIsolation, or preload.
2. `SessionRecord` in `shared/types.ts` has `logicalId: string` (UUID) and `ptyPid?: number` as distinct fields; nothing conflates them.
3. `contextBridge.exposeInMainWorld` is the only renderer↔main bridge; no raw `ipcRenderer` reachable in renderer code.
4. `@electron/rebuild` runs as a postinstall hook and completes without error on macOS.

**Explicitly NOT in this phase:** PTY spawning, xterm rendering, IPC data streaming, sidebar/session UI, persistence wiring, packaging/makers. Those belong to Phases 2–8.

</domain>

<decisions>
## Implementation Decisions

### Data Model (`shared/types.ts`)
- **D-01: Full `SessionRecord` shape now, not minimal.** Define every field the requirements already name, even though most stay unused until their phase wires them up. Rationale: PERS-01 already enumerates the full field set, so it is not speculative, and a stable contract from day one prevents the type reshaping every phase. Fields: `logicalId`, `ptyPid?`, `name`, `icon`, `cwd`, `shell`, `startupCommand?`, `status`, `order`, `lastActive`.
- **D-02: `status` is a string-literal union, not a TS enum.** `type SessionStatus = 'not_started' | 'running' | 'stopped' | 'exited' | 'error'`. Rationale: zero runtime cost, clean narrowing in `switch`, serializes to JSON as-is for lowdb persistence, and avoids enum/`isolatedModules` friction under the Vite + ESM build.
- **D-03: `icon` is a discriminated union, not a plain string.** `icon: { type: 'emoji'; value: string } | { type: 'preset'; value: string } | { type: 'color'; value: string }`. Rationale: future-proofs SESS-03's three icon kinds (emoji / built-in preset / color badge) without a later breaking change; the discriminant gives the renderer a clean render `switch`. The canonical scenario's `🛋️` is simply `{ type: 'emoji', value: '🛋️' }`.

### Identity Invariant Enforcement
- **D-04: `logicalId` is a branded (nominal) type.** `type LogicalId = string & { readonly __brand: 'LogicalId' }`, minted only by the id factory (uuid v4 wrapped in a `newLogicalId()` helper). Rationale: a bare `string` — or a stringified PID — cannot be passed where a `LogicalId` is expected, so session maps/lookups are structurally forced to key on identity, never on the process. This is the strongest available "can never be violated" guarantee and is compile-time-only (no runtime cost). `ptyPid` stays a plain `number`.
- **D-05: A Vitest guard test asserts the identity separation** — `SessionRecord` keeps `logicalId` and `ptyPid` as distinct fields and neither is ever assigned from the other.

### Renderer Security Boundary Enforcement (defense in depth)
- **D-06: ESLint `no-restricted-imports` ban** forbidding `electron` / `ipcRenderer` imports anywhere under the renderer source tree — catches violations at edit time.
- **D-07: Vitest guard test on `webPreferences`** asserting `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and that the preload exposes only the named typed API surface — locks the security config so a regression fails the suite.

### Dev Infrastructure
- **D-08: "Standard" tooling level** — Electron Forge + Vite + TypeScript (`strict`), `@electron/rebuild` postinstall (mandated by SC4), plus ESLint + Prettier and **Vitest** as the test runner. Git hooks (Husky/lint-staged) and CI are **deferred** (CI's cross-platform rebuild concern is better addressed in Phase 8 packaging).
- **D-09: Test suite covers both static guards AND a real boot smoke test.** (a) Vitest unit/static guard tests for the invariants above (D-05, D-07). (b) A real end-to-end launcher that boots the packaged-dev app and asserts a blank window with **no console errors** (defends SC1). Harness selection (WebdriverIO — Electron's officially recommended option — vs. Playwright-Electron) is left to research/planning; the *decision to have a boot smoke test* is locked.

### Version Posture (not user-selected — captured as default)
- **D-10: Prioritize a conservative, proven Electron + node-pty combo over latest stable.** Lean toward Electron 36/38 with a well-tested `node-pty` native rebuild rather than Electron 42, prioritizing native-module ABI reliability (the project's Core Value depends on node-pty working flawlessly). **Research must confirm the exact pin** by checking the current node-pty ↔ Electron compatibility matrix (CLAUDE.md flags this tension explicitly). Note: node-pty itself is NOT introduced until Phase 2 — but the Electron version chosen here constrains it, so the pin decision belongs to this phase's setup.

### Claude's Discretion
- Project folder layout (`main/` / `renderer/` / `preload/` / `shared/` or equivalent) — follow the Electron Forge vite-typescript template conventions.
- IPC channel naming convention and the concrete `window.api` method shape — only a minimal typed bridge is needed this phase (e.g. a version/ping method establishing the pattern); the real PTY channels arrive in Phase 2.
- ESM-vs-CJS module strategy for the main process (lowdb v7 is ESM-only; node-pty is native CJS) — a known interop edge; resolve per research. lowdb is not wired until Phase 5, so this can be deferred if it simplifies the scaffold.
- TypeScript compiler strictness specifics and npm scripts layout.
- uuid version (v4 expected) for `newLogicalId()`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tech stack & build (authoritative for this phase)
- `CLAUDE.md` — the locked Technology Stack research output: Electron over Tauri, node-pty, @xterm/xterm 5.5, React 19, TypeScript 5, Electron Forge + Vite plugin, lowdb 7, uuid. Also the **node-pty native module build concerns** section (ASAR unpack via `@electron-forge/plugin-auto-unpack-natives`, `@electron/rebuild` postinstall, Electron version-targeting guidance) and the "What NOT to Use" anti-patterns (no `child_process.exec` for sessions, no unscoped `xterm`, no node-pty in renderer, no `.node` inside ASAR). **MUST read before planning.**

### Project intent & requirements
- `.planning/PROJECT.md` — Core Value (real terminal fidelity), identity model (logical ID vs process ID vs user-visible identity must never be conflated), constraints (cross-platform, local-only).
- `.planning/REQUIREMENTS.md` §Session Identity — IDENT-01, IDENT-02 (this phase) and IDENT-03/SESS/PERS (informs the full `SessionRecord` shape decided in D-01).
- `.planning/ROADMAP.md` §"Phase 1" — goal + 4 success criteria.

No standalone ADRs or external spec files exist — the research output lives inline in `CLAUDE.md`, and all phase-1 decisions are captured in `<decisions>` above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **None — greenfield.** The repo contains only `.planning/` and `CLAUDE.md`; no `package.json`, `src/`, or `shared/` yet. This phase creates the initial scaffold from scratch via the Electron Forge `vite-typescript` template.

### Established Patterns
- No code patterns exist yet. The patterns *established by this phase* (process split, branded identity type, contextBridge-only boundary, guard-test enforcement) become the conventions every later phase inherits.

### Integration Points
- `shared/types.ts` `SessionRecord` / `LogicalId` / `SessionStatus` — the contract Phases 2–5 build PTY, lifecycle, sidebar, and persistence against.
- The typed `contextBridge` surface (`window.api`) — the single seam Phase 2's PTY IPC plugs into.

</code_context>

<specifics>
## Specific Ideas

- Branded `LogicalId` minted only via an id factory (`newLogicalId()` wrapping uuid v4) — the user explicitly wanted the strongest structural guarantee that identity can't be impersonated by a bare string or a stringified PID.
- Enforcement is **defense-in-depth by design**: lint catches violations at edit time, guard tests lock the config/contract, and a boot smoke test proves the window actually comes up clean. The user chose the more thorough option at every enforcement fork.
- Canonical validation scenario to keep in view (used end-to-end in later phases): session `Name: Parlour Claude RC`, `Icon: 🛋️`, `Command: claude --rc`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Several topics were explicitly routed to their owning phases rather than deferred ad hoc:
- node-pty introduction, IPC data streaming, terminal fidelity → Phase 2.
- ASAR-unpack / makers / `@electron/rebuild`-in-CI / ConPTY version check → Phase 8 (this phase only wires `@electron/rebuild` as a local postinstall hook).
- Git hooks (Husky/lint-staged) and cross-platform CI → deferred (revisit at Phase 8).

</deferred>

---

*Phase: 1-Project Scaffold + Dev Infrastructure*
*Context gathered: 2026-06-03*
