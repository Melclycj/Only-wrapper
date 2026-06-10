---
phase: 5
slug: persistence-shell-discovery
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-06
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> The Per-Task Verification Map below is filled at PLANNING time; Plan 05-04 Task 3 flips
> `nyquist_compliant: true` + `wave_0_complete: true` once the full suite is green.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (unit, Node env) + WebdriverIO 9.x (`@wdio/electron-service`) smoke |
| **Config file** | `vitest.config.ts` (Node env; `src/**/__tests__/**/*.test.ts` + `src/**/*.guard.test.ts`) ; `wdio.conf.ts` (`tests/smoke/**/*.smoke.test.ts`) |
| **Quick run command** | `npm run test:unit` (`vitest run`) |
| **Full suite command** | `npm test` (`test:unit && test:smoke`) |
| **Estimated runtime** | unit ~a few seconds; smoke ~30–90s (built-app launch) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit` (fast; all pure helpers + the security guard)
- **After every plan wave:** Run `npm test` (unit + WDIO smoke) — the smoke run is the ONLY place Pitfall 1 (lowdb ESM-in-CJS at runtime) is caught
- **Before `/gsd-verify-work`:** Full suite must be green + a manual reopen check (canonical 🛋️ Parlour Claude RC reappears dormant after quit/reopen)
- **Max feedback latency:** unit < 10s; smoke < 90s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | PERS-01/02, NAV-04 | T-05-02 | coerceOnLoad forces not_started + clears ptyPid; buildShellList includes $SHELL/filters on-disk; reorder dense reindex; validateBounds rejects off-screen | unit (pure) | `npx vitest run src/main/__tests__/store-schema.test.ts src/main/__tests__/shell-discovery.test.ts src/main/__tests__/window-bounds.test.ts src/renderer/__tests__/session-reorder.test.ts` | ✅ | ✅ green |
| 05-01-02 | 01 | 1 | PERS-01/02, NAV-04 | T-05-01 / T-05-SC | exact 18-key bridge, no raw ipcRenderer; lowdb [VERIFIED] install + external + ignore allow-list; validate-in-main setters | unit (guard) | `npx vitest run src/shared/__tests__/security.guard.test.ts` | ✅ | ✅ green |
| 05-02-01 | 02 | 2 | PERS-01/02 | T-05-02 / T-05-04 / T-05-05 | round-trip 8 fields; corrupt→backup+fresh (no crash); fixed userData path; debounce/flush | unit | `npx vitest run src/main/__tests__/session-store.test.ts` | ✅ | ✅ green |
| 05-02-02 | 02 | 2 | PERS-02, NAV-04 | T-05-02 / T-05-06 | hydrate dormant (no spawn); listSessions merges live+dormant; before-quit flush; validated bounds restore | unit | `npx vitest run src/main/__tests__` | ✅ | ✅ green |
| 05-02-03 | 02 | 2 | PERS-01/02 | T-05-04 (Pitfall 1) | lowdb dynamic import resolves in BUILT app; store file created + written | smoke (WDIO) | `npm run test:smoke -- --spec tests/smoke/persistence.smoke.test.ts` | ✅ | ✅ green |
| 05-03-01 | 03 | 3 | PERS-02 (SC4) | T-05-03 | shell dropdown only (no free-text); $SHELL always present | unit (guard) | `npx vitest run src/shared/__tests__/security.guard.test.ts` | ✅ | ✅ green |
| 05-03-02 | 03 | 3 | PERS-02 | T-05-07 | IdleCard displays startupCommand, never executes it; welcome CTA present | type-check | `npx tsc --noEmit -p tsconfig.json` | ✅ | ✅ green |
| 05-03-03 | 03 | 3 | PERS-02, NAV-04 | T-05-02 | one-shot snapshot (no poll/auto-spawn); dormant→idle card+Start; collapse persists | unit + smoke | `npx vitest run && npm run test:smoke -- --spec tests/smoke/persistence.smoke.test.ts` | ✅ | ✅ green |
| 05-04-02 | 04 | 4 | NAV-04 | T-05-01 / T-05-08 | drag-reorder → pure dense reindex → persistOrder (validated main-side); silent persist | unit | `npx vitest run src/renderer/__tests__/session-reorder.test.ts` | ✅ | ✅ green |
| 05-04-03 | 04 | 4 | NAV-04 | T-05-01 | reorder persists across restart; full suite green | smoke + full | `npm test` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Continuity check: no 3 consecutive map rows lack an `<automated>` verify — every task has one.
> Plan 05-04 Task 1 is a `checkpoint:human-verify` legitimacy gate (no code → no automated verify; it precedes the dnd-kit install in 05-04-02, which IS automated-verified).

---

## Wave 0 Requirements

- [x] `src/main/__tests__/store-schema.test.ts` — D-01/SC2 (`coerceOnLoad`) — created Plan 05-01
- [x] `src/main/__tests__/session-store.test.ts` — PERS-01/02 round-trip, corrupt recovery, debounce/flush — RED stub in 05-01, GREEN in 05-02
- [x] `src/main/__tests__/shell-discovery.test.ts` — SC4/D-05/06/07 (pure parse + build + provider select) — created Plan 05-01
- [x] `src/main/__tests__/window-bounds.test.ts` — D-12 off-screen validation (Pitfall 5) — created Plan 05-01
- [x] `src/renderer/__tests__/session-reorder.test.ts` — NAV-04/SC3 dense reindex (Pitfall 6) — created Plan 05-01
- [x] `tests/smoke/persistence.smoke.test.ts` — restore round-trip + lowdb-ESM-in-built-app (Pitfall 1) — created Plan 05-02, extended Plan 05-03
- [x] `tests/smoke/reorder.smoke.test.ts` — drag-to-reorder persistence (NAV-04) — created Plan 05-04
- [x] `src/shared/__tests__/security.guard.test.ts` — goes RED at 15→18 keys, GREEN when preload matches — NO code change (reads EXPECTED_API_KEYS)
- [x] Framework install: none needed (Vitest + WDIO already configured)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full quit → relaunch restore | PERS-02/SC1 | WDIO cannot reliably fully-quit + relaunch the Forge app within one smoke session | Create `🛋️ Parlour Claude RC` (Icon 🛋️, a real project dir), quit the app fully, reopen → it reappears dormant with an idle card + ▶ Start, same name/icon/cwd; status is not_started (SC2) |
| Real pointer drag gesture | NAV-04/SC3 | dnd-kit/HTML5 pointer DnD is hard to drive deterministically over CDP | Drag the 3rd sidebar row above the 1st, quit, reopen → the new order persists |
| Shell dropdown lists discovered shells | SC4 | depends on the host's `/etc/shells` + `$SHELL` | Open the create/edit form → the Shell field is a dropdown listing the machine's login shells with `$SHELL` present and default-selected; no free-text input |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-06-06 — full suite GREEN (124 unit tests across 22 files; 10 smoke spec files including `reorder.smoke.test.ts`). `nyquist_compliant: true` + `wave_0_complete: true` set after `npm test` passed against the repackaged build. Manual phase-gate checks (full quit→relaunch restore; real pointer drag gesture; shell-dropdown listing) remain per the Manual-Only Verifications table.
