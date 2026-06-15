---
phase: 12-session-form-polish-edit-ux
plan: 05
gap_closure: true
status: complete
requirements: [UI-04]
completed: 2026-06-15
self_check: PASS
key_files:
  created:
    - src/main/app-menu.ts
    - src/main/__tests__/app-menu.test.ts
  modified:
    - src/main/index.ts
commits:
  - 25507ba  # Task 1 — pure app-menu.ts builder + unit test
  - (Task 2) # index.ts — Menu.setApplicationMenu at whenReady
---

# 12-05 SUMMARY — Application Edit menu (GAP-12-D root cause)

Executed INLINE on the main thread (Opus 4.8) — subagent spawn was 529-Overloaded.

## Root cause closed
`grep -rn "Menu|setApplicationMenu|buildFromTemplate" src/main` returned ZERO before this plan —
NO application menu was ever set, so the standard macOS Edit shortcuts had no role: **Cmd+A had no
Select-All role and bubbled out → it closed the edit modal** (the reported GAP-12-D symptom), and
Cmd+C/V/X/Z did not work in the form inputs.

## Tasks

**Task 1 — committed `25507ba`.** New `src/main/app-menu.ts`: a pure, electron-free builder
`buildAppMenuTemplate(platform): MenuItemConstructorOptions[]` (type-only electron import → stays
Vitest-importable, mirrors `lifecycle.ts`/`window-config.ts`). Returns an Edit submenu with the
standard roles `undo/redo/cut/copy/paste/selectAll`; on darwin it prepends `appMenu` + appends
`windowMenu` (native Cmd+Q/M/W). **Standard roles only — NO custom accelerators**, so the role
defaults (Cmd+A/C/V/X/Z) don't collide with the before-input-event chords (1-9/K/F). New
`app-menu.test.ts` (4 tests): darwin + win32 Edit roles present; darwin appMenu+windowMenu present;
no accelerator matches Cmd+(1-9/K/F).

**Task 2 — committed in this plan.** `index.ts`: added `Menu` to the electron import +
`buildAppMenuTemplate` from `./app-menu`; set `Menu.setApplicationMenu(Menu.buildFromTemplate(
buildAppMenuTemplate(process.platform)))` at `whenReady`, AFTER the ConPTY gate and before
`createWindow()`. The `before-input-event` chord interceptor (matchSwitchKey/Clear/Search) is
**byte-untouched** — Cmd+1-9/K/F still win over a focused xterm.

## Verification (actual)
- `npm run test:unit` → **49 files / 424 passed** (exit 0; +app-menu.test.ts 4 tests over the 420 baseline)
- `npx tsc --noEmit` → exit 0 · `eslint` (index.ts, app-menu.ts) → clean
- gates: `setApplicationMenu` present; `Menu` imported; before-input-event refs intact (11)
- **EXPECTED_API_KEYS stays 20** — a Menu is main-process-only, NOT an IPC surface; security.guard GREEN; no PTY/xterm path touched (Core Value safe)

## Deferred to 12-07 re-gate
Live confirmation that Cmd+A selects text in the name field (no modal close) + Cmd+C/V/X work +
the chords still fire is part of the BLOCKING operator human-verify in 12-07.

## Self-Check: PASS
