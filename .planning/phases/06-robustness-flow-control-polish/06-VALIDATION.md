---
phase: 6
slug: robustness-flow-control-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 06-RESEARCH.md §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit, Node env) + WebdriverIO `@wdio/electron-service` (E2E smoke) |
| **Config file** | `vitest.config.*` + `wdio.conf.*` (existing — Phase 1 Wave 0) |
| **Quick run command** | `npm test` (Vitest unit suite — 147+ tests) |
| **Full suite command** | `npm test` + WDIO smoke suite (`tests/smoke/*.smoke.test.ts`) |
| **Estimated runtime** | ~30–60s unit; smoke adds minutes (per-test Electron boot) |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (Vitest quick suite) — must be green
- **After every plan wave:** Vitest full + the wave's relevant smoke test(s) green
- **Before `/gsd-verify-work`:** Full Vitest + full smoke suite green
- **Max feedback latency:** ~60 seconds (unit); smoke gated at wave/phase boundaries

---

## Per-Task Verification Map

| Req / SC | Behavior | Test Type | Automated Command | File Exists |
|----------|----------|-----------|-------------------|-------------|
| SC1 | 100MB throughput: no freeze/crash/drop; watermark pause+resume | E2E smoke (extend) | extend `tests/smoke/pty-throughput.smoke.test.ts` with `cat /dev/urandom \| head -c 100M` (or scaled `yes \| head`) | ✅ Phase 2 — extend |
| SC2 | Missing cwd → `error` + `Working directory not found: <path>`, never `~` | Unit + E2E | Vitest `src/main/__tests__/pty-spawn-error.test.ts` (cwd pre-validate + no-silent-home D-02); E2E bad-cwd Start → error card | ❌ Wave 0 |
| SC3 | Killed vim/less → clean prompt on reopen (no alt-screen frame) | E2E smoke | new `tests/smoke/alt-screen-reset.smoke.test.ts` | ❌ Wave 0 |
| SC4 / TERM-09 | idle+prompt → amber "Waiting"; flowing → blue; idle-no-prompt → free | Unit (pure classifier) + E2E | Vitest `src/shared/__tests__/agent-state.test.ts` (classifyIdle, lastNonEmptyLine, PROMPT_RE cases); E2E emit `[y/N]`, wait IDLE_MS, assert sidebar dot accent | ❌ Wave 0 |
| SC5 / TERM-12 | Header Clear + Restart work; Clear chord (Cmd+K / Ctrl+Shift+K) clears; keyboard-accessible | Unit (matcher) + E2E | Vitest Clear-chord matcher (mirror `switch-keys.test.ts`); E2E click Clear → buffer cleared, prompt preserved; chord → same; Restart → new pty | ❌ Wave 0 |
| Folder picker | Browse fills absolute path; CR-01 still gates; new `pickDirectory` key | Guard + unit + manual | `security.guard.test.ts` auto-asserts the key (EXPECTED_API_KEYS → 19); unit on the handler return; picker UX → human-verify | ⚠ partial |
| 05.1 fixes (WR-02/03/05) | probe matcher ignores echo line; bounded probe buffer; store-vs-inject trim consistent | Unit (extend) | extend `src/main/__tests__/readiness-probe.test.ts` + a pty-manager probe test | ✅ exists — extend |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/__tests__/agent-state.test.ts` — SC4 pure classifier (idle + prompt regex + last-non-empty-line)
- [ ] `src/main/__tests__/pty-spawn-error.test.ts` — SC2 cwd pre-validation + no-silent-home (D-02)
- [ ] `tests/smoke/alt-screen-reset.smoke.test.ts` — SC3
- [ ] `tests/smoke/header-controls.smoke.test.ts` — SC5 Clear/Restart + chord
- [ ] extend `tests/smoke/pty-throughput.smoke.test.ts` — SC1 at 100MB / `/dev/urandom`
- [ ] extend `src/main/__tests__/readiness-probe.test.ts` — WR-02 (echo-line false-positive), WR-03 (bounded buffer)
- [ ] extend `src/main/__tests__/switch-keys.test.ts` (or new `clear-key.test.ts`) — Clear-chord matcher
- [ ] Framework install: none needed (Vitest + WDIO already configured)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Amber "Waiting for you" feels right (regex/threshold tuning A1) | SC4 / TERM-09 | Heuristic quality is subjective; PROMPT_RE + IDLE_MS need real-output tuning | Run `🛋️ Parlour Claude RC`; trigger a `[y/N]` confirmation from another session; confirm the row goes amber promptly without false-positives mid-stream; confirm it clears state-driven (on response/new output) |
| Alt-screen reset choice: scrollback preserved vs cleared (Q1/A2) | SC3 | reset() clears scrollback (conflicts with Phase-3 D-03 preservation); `\x1b[?1049l` preserves it | Open vim, kill the PTY, restart; confirm clean prompt AND confirm whether prior scrollback should remain (decide reset() vs surgical exit-alt-screen) |
| Native folder picker UX | Folder picker todo | `dialog.showOpenDialog` is hard to drive in WDIO | Open Edit modal → Browse… → pick a dir → confirm the absolute path fills the cwd field and a bad/removed dir still errors via CR-01 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (flips when Wave 0 stubs land + human-verify gates pass)

**Approval:** pending
