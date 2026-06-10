---
phase: 2
slug: pty-core-terminal-fidelity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 02-RESEARCH.md §Validation Architecture. Task IDs are assigned during planning (step 8); the nyquist-auditor reconciles task rows once PLAN.md files exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (unit/guard) + WebdriverIO 9 / `@wdio/electron-service` 10 (boot + PTY round-trip E2E) |
| **Config file** | `vitest.config.ts`, `wdio.conf.ts` (both present from Phase 1) |
| **Quick run command** | `npm run test:unit` (vitest run) |
| **Full suite command** | `npm test` (unit + smoke) |
| **Estimated runtime** | unit ~1s · smoke ~10–30s (packages + boots the Electron app) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit` (guard + resolveShell + flow-control accounting)
- **After every plan wave:** Run `npm test` (adds WDIO PTY round-trip + resize + throughput)
- **Before `/gsd-verify-work`:** Full suite green + manual fidelity checklist (vim/python/ssh/htop/paste/truecolor); packaging smoke (`npm run package` → launch → PTY round-trip)
- **Max feedback latency:** ~5s (unit); ~30s (full suite)

---

## Per-Task Verification Map

> Task IDs are `TBD` until plans are created; rows are keyed by requirement / success criterion. `✅/❌ W0` = whether the test file exists (❌ W0 = a Wave 0 stub to create first).

| Task ID | Req / SC | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|----------|------|----------|-----------|-------------------|-------------|--------|
| TBD | TERM-02 / SC1 | — | PTY round-trip: write `echo hello\n`, assert `hello` echoed | E2E (WDIO) | `npm run test:smoke` → `tests/smoke/pty-roundtrip.smoke.test.ts` | ❌ W0 | ⬜ pending |
| TBD | SC4 | — | write `echo $TERM\n`, assert output contains `xterm-256color` | E2E (WDIO) | same harness | ❌ W0 | ⬜ pending |
| TBD | SC3 | — | resize term, write `tput cols\n`, assert new col count within 1s | E2E (WDIO) | `tests/smoke/pty-resize.smoke.test.ts` | ❌ W0 | ⬜ pending |
| TBD | SC5 | — | emit ~50MB; assert keystroke echo stays responsive + no bytes dropped (line-count/checksum) | E2E (WDIO) | `tests/smoke/pty-throughput.smoke.test.ts` | ❌ W0 | ⬜ pending |
| TBD | SC1 (Ctrl+C) | — | start `sleep 100`, send `\x03`, assert prompt returns | E2E (WDIO) | same harness | ❌ W0 | ⬜ pending |
| TBD | TERM-01 (bridge guard) | — | `EXPECTED_API_KEYS` includes new PTY methods; preload exposes exactly that set | Unit (Vitest) | `npm run test:unit` (extend `security.guard.test.ts`) | ✅ exists (update) | ⬜ pending |
| TBD | TERM-03/04 (resolveShell) | — | returns `{shell:$SHELL or /bin/zsh, args:['-l']}`; falls back to `/bin/zsh` when `$SHELL` unset | Unit (Vitest) | `src/main/__tests__/shell-resolver.test.ts` | ❌ W0 | ⬜ pending |
| TBD | SC5 (flow-control) | — | watermark pauses at HIGH, resumes below LOW (pure accounting unit) | Unit (Vitest) | `src/main/__tests__/flow-control.test.ts` | ❌ W0 | ⬜ pending |
| TBD | IDENT-02 (regression) | — | `ptyPid` stored separately from `logicalId`; never cross-assigned | Unit (Vitest) | existing Phase-1 identity guard | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/smoke/pty-roundtrip.smoke.test.ts` — SC1/TERM-02 + `$TERM` (SC4) + Ctrl+C (SC1)
- [ ] `tests/smoke/pty-resize.smoke.test.ts` — SC3 (`tput cols` after resize)
- [ ] `tests/smoke/pty-throughput.smoke.test.ts` — SC5 (responsiveness + no-drop)
- [ ] `src/main/__tests__/shell-resolver.test.ts` — `resolveShell` login flag + `/bin/zsh` fallback
- [ ] `src/main/__tests__/flow-control.test.ts` — watermark HIGH/LOW accounting
- [ ] Update `src/main/window-config.ts` `EXPECTED_API_KEYS` + `src/shared/__tests__/security.guard.test.ts` for the new PTY bridge methods (deliberate, reviewed change to the Phase-1 contract)
- [ ] WDIO helper to drive xterm in-page (send keys / read `term.buffer` or DOM)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `vim` / `python` REPL / `ssh` interactive fidelity (prompts, colors) | SC1 | Visual + interactive; depends on tools installed | Run each inside the session; confirm prompts, arrow keys, colors behave as in Terminal.app |
| Multi-line bracketed paste does NOT auto-execute | SC2 | Clipboard + visual timing | Paste a 3-line snippet; confirm nothing runs until Enter |
| vim/ncurses reflow on resize | SC3 | Visual reflow correctness | Open vim, resize window; confirm correct reflow (semi-automatable via `tput cols`) |
| truecolor render + CJK/emoji cell widths + htop borders intact | SC4 | Pixel-level visual | Run a truecolor test script + `htop`; confirm borders aligned, emoji/CJK width correct |
| `claude --rc` resolves on PATH and runs | SC1 / TERM-03 | Requires the tool installed | Run `claude --rc`; automatable proxy: `which claude` / `$PATH` parity vs Terminal.app |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
