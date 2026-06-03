---
phase: 1
slug: project-scaffold-dev-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 01-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/guard) + WebdriverIO `@wdio/electron-service` v10 (boot smoke) |
| **Config file** | `vitest.config.ts` + `wdio.conf.ts` (both installed in Wave 0) |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test:unit && npm run test:smoke` |
| **Estimated runtime** | ~1s unit; smoke boots a real Electron window (~10–20s) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit` (guard tests; ~1s)
- **After every plan wave:** Run `npm run test:unit && npm run test:smoke`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~1s (unit) / ~20s (smoke)

---

## Per-Task Verification Map

> Task IDs are assigned by the planner (PLAN.md). Rows below map each phase requirement / success criterion to its objective test. `❌ W0` = test file does not exist yet and must be created in Wave 0.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | W0 | IDENT-01 | — | `logicalId` is a branded `LogicalId`; only `newLogicalId()` mints one | unit (guard) | `vitest run src/shared/__tests__/identity.guard.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | W0 | IDENT-02 | — | `logicalId` and `ptyPid` are distinct fields, never cross-assigned | unit (guard) | `vitest run src/shared/__tests__/identity.guard.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | — | SC1 | — | `npm start` launches a blank Electron window with no console errors | smoke (E2E) | `npm run test:smoke` (wdio run wdio.conf.ts) | ❌ W0 | ⬜ pending |
| TBD | 01 | — | SC3 | T-1-04 | `contextBridge.exposeInMainWorld` is the only renderer↔main bridge | unit (guard) | `vitest run src/shared/__tests__/security.guard.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | — | D-07 | T-1-01 | `webPreferences`: `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true` | unit (guard) | `vitest run src/shared/__tests__/security.guard.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | — | D-06 | T-1-04 | No `electron`/`ipcRenderer` imports under `src/renderer/**` | lint | `eslint src/renderer/` | ❌ W0 | ⬜ pending |
| TBD | 01 | — | SC4 | — | `@electron/rebuild` postinstall runs without error (no native modules yet → clean exit 0) | manual (npm hook) | `npm install` (observe postinstall exit code) | N/A (package.json script) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest runner config
- [ ] `wdio.conf.ts` — WebdriverIO boot-smoke harness config (`@wdio/electron-service`)
- [ ] `eslint.config.ts` — ESLint v9 flat config with path-scoped renderer `no-restricted-imports` (D-06)
- [ ] `src/shared/__tests__/identity.guard.test.ts` — stubs for IDENT-01, IDENT-02
- [ ] `src/shared/__tests__/security.guard.test.ts` — stubs for SC3, D-07
- [ ] `tests/smoke/boot.smoke.test.ts` — stub for SC1
- [ ] `src/shared/types.d.ts` — Forge/Vite injected-global declarations + `Window.api` augmentation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `@electron/rebuild` postinstall completes without error on macOS | SC4 | Runs as an npm lifecycle hook, not a test; no native modules present in Phase 1 so it is effectively a clean no-op until Phase 2 | Run `npm install` (or `npm run postinstall` / `electron-rebuild -f`) and confirm exit code 0 with no rebuild errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
