# Phase 1: Project Scaffold + Dev Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 1-Project Scaffold + Dev Infrastructure
**Areas discussed:** Data model scope, Dev infra depth, Invariant enforcement

> **Area selection:** Four gray areas were surfaced — Data model scope, Dev infra depth, Invariant enforcement, Version posture. The user selected the first three to discuss. Version posture was left to Claude's default (captured in CONTEXT.md as D-10).

---

## Data model scope

### Q1 — SessionRecord completeness

| Option | Description | Selected |
|--------|-------------|----------|
| Full shape now | Define every requirement-named field (logicalId, ptyPid?, name, icon, cwd, shell, startupCommand?, status, order, lastActive) | ✓ |
| Identity-only, grow later | Define just logicalId + ptyPid? now, add the rest per phase | |
| You decide | Let Claude choose granularity | |

**User's choice:** Full shape now.
**Notes:** PERS-01 already enumerates the full field set, so it isn't speculative; a stable contract avoids reshaping the type every phase.

### Q2 — Status representation

| Option | Description | Selected |
|--------|-------------|----------|
| String literal union | `'not_started' \| 'running' \| 'stopped' \| 'exited' \| 'error'` | ✓ |
| TS enum | `enum SessionStatus { ... }` | |
| You decide | Claude picks | |

**User's choice:** String literal union.
**Notes:** Zero runtime cost, clean narrowing, JSON-serializable for lowdb, avoids enum/isolatedModules friction under Vite + ESM.

### Q3 — Icon field modeling

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated union | `{ type: 'emoji'\|'preset'\|'color'; value: string }` | ✓ |
| Plain string now | `icon: string` holding an emoji | |
| You decide | Claude picks | |

**User's choice:** Discriminated union.
**Notes:** Future-proofs SESS-03's three icon kinds without a later breaking change; discriminant gives the renderer a clean render switch.

---

## Dev infra depth

### Q1 — Tooling level

| Option | Description | Selected |
|--------|-------------|----------|
| Standard: lint + format + tests | Forge/Vite/TS + electron-rebuild + ESLint + Prettier + Vitest; hooks/CI deferred | ✓ |
| Minimal: build only | Just Forge/Vite/TS + electron-rebuild | |
| Full: + git hooks + CI | Standard + Husky/lint-staged + cross-platform GitHub Actions | |
| You decide | Claude picks | |

**User's choice:** Standard: lint + format + tests.
**Notes:** Enough to enforce invariants with guard tests and stay clean from commit #1 without heavy CI ceremony; cross-platform CI is arguably a Phase 8 concern.

### Q2 — Test scope

| Option | Description | Selected |
|--------|-------------|----------|
| Unit + static guard tests | Vitest assertions on identity separation + webPreferences config | |
| Add an Electron boot smoke test | Also wire a real E2E launcher asserting blank window, no console errors | ✓ |
| You decide | Claude picks | |

**User's choice:** Add an Electron boot smoke test (in addition to unit/static guards).
**Notes:** Harness (WebdriverIO vs Playwright-Electron) left to research; the decision to have a real boot smoke test is locked. Directly defends SC1.

---

## Invariant enforcement

### Q1 — Identity (logicalId vs ptyPid) guard

| Option | Description | Selected |
|--------|-------------|----------|
| Branded type for logicalId | `type LogicalId = string & { readonly __brand: 'LogicalId' }`, minted only by id factory | ✓ |
| Distinct fields + guard test | Plain string/number fields + Vitest assertion only | |
| You decide | Claude picks | |

**User's choice:** Branded type for logicalId.
**Notes:** A bare string or stringified PID can't masquerade as identity; forces session maps/lookups to key on identity, not process. Strongest "never violated" guarantee, compile-time only.

### Q2 — Renderer security boundary guard

| Option | Description | Selected |
|--------|-------------|----------|
| ESLint ban + guard test | `no-restricted-imports` on electron/ipcRenderer in renderer + Vitest webPreferences assertion | ✓ |
| Guard test only | Just the Vitest webPreferences/preload-surface assertion | |
| You decide | Claude picks | |

**User's choice:** ESLint ban + guard test.
**Notes:** Defense in depth — lint catches at edit time, test locks the config. Defends SC3.

---

## Claude's Discretion

- Version posture (not selected by user): default to a conservative, proven Electron + node-pty combo (lean Electron 36/38) over latest 42; research confirms the exact pin. Captured as D-10.
- Project folder layout (main/renderer/preload/shared) per Electron Forge vite-typescript conventions.
- IPC channel naming convention and concrete `window.api` shape (minimal typed bridge this phase; real PTY channels in Phase 2).
- ESM-vs-CJS module strategy for the main process (lowdb ESM-only vs node-pty native CJS) — resolve per research.
- TypeScript strictness specifics, npm scripts layout, uuid version (v4 expected).

## Deferred Ideas

None — discussion stayed within phase scope. Topics routed to owning phases: node-pty/PTY/IPC streaming → Phase 2; ASAR-unpack/makers/CI rebuild/ConPTY check → Phase 8; git hooks + cross-platform CI → deferred (revisit Phase 8).
