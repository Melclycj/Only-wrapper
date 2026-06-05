---
phase: 04-session-identity-sidebar-ui
plan: 01
subsystem: ui
tags: [electron, contextbridge, ipc, node-pty, react, pure-modules, switch-keys, icon-spec, tdd, nyquist]

# Dependency graph
requires:
  - phase: 03-multi-session-session-lifecycle
    provides: PtyManager (create/stop/restart/close, id-validated mutators), 13-key contextBridge surface + EXPECTED_API_KEYS guard, session-add/session-close pure-reducer convention, xterm-driver E2E helpers
  - phase: 02-pty-terminal-core
    provides: PtyManager.create + resolveShell, the contextBridge lockstep + security.guard.test.ts
provides:
  - "5 React/xterm/electron-free pure modules: switch-keys (matchSwitchKey), session-switch (resolveSwitch), icon-spec (emojiSpec/colorSpec/COLOR_INITIAL), session-edit (splitEdit), emoji-set (CURATED_EMOJI/COLOR_SWATCHES)"
  - "15-key contextBridge surface: ptyUpdateProfile (14th) + onSwitchSession (15th) wired in lockstep across api-types + EXPECTED_API_KEYS + preload + pty-manager channel triple; security guard GREEN at 15 keys"
  - "PtyManager.updateProfile: id-validated + type-guarded record write (startupCommand stored-only, TERM-05 deferred)"
  - "create() honors a stored record.shell (non-empty) with a resolveShell() fallback (A2) so an edited shell takes effect on restart"
  - "Wave 0 RED stubs: 5 unit stubs (closed by this plan) + 3 E2E smoke stubs (close in 04-02/03/04) + 5 new xterm-driver helpers"
  - "04-VALIDATION.md per-task verification map + Wave 0 requirements populated"
affects: [04-02-create-edit-form, 04-03-keyboard-switch, 04-04-sidebar-collapse, 05-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure React/xterm/electron-free module convention extended to switch-keys (main-side), session-switch, session-edit, icon-spec, emoji-set"
    - "A1-defensive key matching: matchSwitchKey accepts logical key OR physical code so the NAV-05 E2E confirms real Electron strings with a one-line change"
    - "Interface-first wave: pure-module signatures + 2 bridge keys + 15-key guard set defined first so Plans 02-04 build against contracts, not reverse-engineered code"
    - "A2 shell-honor: create() prefers a stored record.shell with resolveShell() fallback; startupCommand carried through the record but never written to a PTY (TERM-05 deferred)"

key-files:
  created:
    - src/main/switch-keys.ts
    - src/renderer/session-switch.ts
    - src/renderer/icon-spec.ts
    - src/renderer/session-edit.ts
    - src/renderer/emoji-set.ts
    - src/main/__tests__/switch-keys.test.ts
    - src/main/__tests__/pty-update-profile.test.ts
    - src/renderer/__tests__/session-switch.test.ts
    - src/renderer/__tests__/icon-spec.test.ts
    - src/renderer/__tests__/session-edit.test.ts
    - tests/smoke/keyboard-switch.smoke.test.ts
    - tests/smoke/session-edit.smoke.test.ts
    - tests/smoke/sidebar-collapse.smoke.test.ts
  modified:
    - src/shared/api-types.ts
    - src/main/window-config.ts
    - src/preload/index.ts
    - src/main/pty-manager.ts
    - tests/smoke/helpers/xterm-driver.ts
    - .planning/phases/04-session-identity-sidebar-ui/04-VALIDATION.md

key-decisions:
  - "matchSwitchKey uses ONE rule for both platforms: primary = meta || control (macOS Cmd OR Windows Ctrl); Cmd/Ctrl+1-9 position, Cmd/Ctrl+Shift+]/[ next/prev; Alt/no-primary/non-keyDown → null"
  - "A1-defensive matcher: accepts logical `key` OR physical `code` (Digit1/BracketRight) so the NAV-05 E2E can confirm empirical Electron strings without a structural change"
  - "create() prefers a non-empty stored record.shell over resolveShell() (A2, Pitfall 3); an edited shell launches with no extra args (user supplied a full path), resolveShell supplies '-l' in the fallback"
  - "startupCommand is carried through the SessionRecord on restart but NEVER written to a PTY — TERM-05 auto-run stays deferred (T-04-04, grep-verified)"
  - "security.guard.test.ts needed NO code change — it asserts Object.keys(exposed) === EXPECTED_API_KEYS dynamically, so it went RED→GREEN automatically once preload + the 15-key array agreed"
  - "COLOR_INITIAL uses the spread iterator ([...name][0]) so a full code point (not a lone surrogate half) is uppercased; emoji values are stored verbatim (Pitfall 6)"

patterns-established:
  - "Pure-module-first wave: every branchy bit (matcher/reducer/split/icon/palette) lives in a React/xterm/electron-free module unit-tested in the Node env before any UI consumes it"
  - "Bridge-key lockstep: each new contextBridge key updates api-types + EXPECTED_API_KEYS + preload + pty-manager channel triple + (dynamically) the guard test in ONE atomic commit"

requirements-completed: [SESS-01, SESS-03, NAV-05, SESS-02, SESS-04]

# Metrics
duration: ~7min
completed: 2026-06-05
---

# Phase 4 Plan 01: Session Identity Foundation Summary

**Interface-first foundation: 5 React/xterm/electron-free pure modules (switch-key matcher, switch reducer, icon-spec builders, edit-split, emoji/color palette), the 15-key contextBridge surface (ptyUpdateProfile + onSwitchSession) wired in atomic lockstep, and PtyManager.updateProfile making an edited cwd/shell take effect on restart while startupCommand stays stored-only.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-05T12:06:00Z
- **Completed:** 2026-06-05T12:13:30Z
- **Tasks:** 3
- **Files modified:** 19 (13 created, 6 modified)

## Accomplishments
- Five pure modules implemented + unit-GREEN, all importing only `../shared/types` (verified React/xterm/electron-free): `matchSwitchKey`, `resolveSwitch`, `emojiSpec`/`colorSpec`/`COLOR_INITIAL`, `splitEdit`, `CURATED_EMOJI`/`COLOR_SWATCHES`.
- 15-key contextBridge surface live: `ptyUpdateProfile` (fire-and-forget, mirrors ptyClose) + `onSwitchSession` (subscribe, mirrors onPtyStatus); the security guard asserts exactly 15 keys with no raw ipcRenderer.
- `PtyManager.updateProfile` — id-validated (unknown id → no-op, T-04-01), type-guarded per field (T-04-02), startupCommand stored-only (T-04-04); `create()` honors a stored `record.shell` with a `resolveShell()` fallback (A2) so an edited shell respawns correctly.
- Wave 0 fail-fast Nyquist coverage: 5 RED unit stubs (closed by Tasks 2-3 this plan) + 3 E2E smoke stubs (keyboard-switch is the A1 proof; close in 04-02/03/04) + 5 new xterm-driver helpers.
- `04-VALIDATION.md` per-task verification map + Wave 0 requirements populated (nyquist_compliant deliberately left false — Plan 04 closes the last E2E gap).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 RED stubs + extended E2E driver helpers (Nyquist)** - `e9d56c4` (test)
2. **Task 2: Five React/xterm/electron-free pure modules (GREEN)** - `4625720` (feat)
3. **Task 3: Atomic bridge lockstep — ptyUpdateProfile + onSwitchSession + updateProfile + create() honors record.shell** - `95b6149` (feat)

_Plan-level TDD gate: the RED `test` commit (e9d56c4) precedes both `feat` GREEN commits (4625720, 95b6149)._

## Files Created/Modified
- `src/main/switch-keys.ts` - Pure `matchSwitchKey` (Cmd/Ctrl+1-9 → position, Shift+]/[ → next/prev) + `SwitchIntent`/`KeyInput` types; A1-defensive (key OR code); electron-free
- `src/renderer/session-switch.ts` - Pure `resolveSwitch` reducer (intent → next activeId) with next/prev wraparound + out-of-range safety
- `src/renderer/icon-spec.ts` - `emojiSpec`/`colorSpec` builders + `COLOR_INITIAL` (uppercased first grapheme, bullet fallback, '' for non-color)
- `src/renderer/session-edit.ts` - `splitEdit` (live name/icon vs restart cwd/shell/startupCommand), no side effects
- `src/renderer/emoji-set.ts` - `CURATED_EMOJI` (cozy dev/tool set incl. 🛋️ + 🖥️) + warm `COLOR_SWATCHES` oklch palette
- `src/shared/api-types.ts` - Added `ptyUpdateProfile` + `onSwitchSession` to `ElectronAPI` (type-only SwitchIntent/SessionIconSpec imports)
- `src/main/window-config.ts` - `EXPECTED_API_KEYS` extended to 15 with the T-04-03 doc-comment
- `src/preload/index.ts` - Wired `pty:update-profile` send + `session:switch` on/removeListener
- `src/main/pty-manager.ts` - `PTY_CHANNELS.updateProfile` + `updateProfile()` + `create()` A2 shell-honor + startupCommand stored-only carry-through + registerIpc/unregisterIpc symmetry
- `tests/smoke/helpers/xterm-driver.ts` - 5 new helpers: `openContextMenu`, `clickMenuItem`, `toggleCollapse`, `pressSwitchChord`, `readIdentityHeader`
- `tests/smoke/{keyboard-switch,session-edit,sidebar-collapse}.smoke.test.ts` - 3 Wave 0 E2E stubs
- `src/{main,renderer}/__tests__/*` - 5 Wave 0 unit stubs (now GREEN)
- `.planning/phases/04-session-identity-sidebar-ui/04-VALIDATION.md` - Per-task map + Wave 0 list populated

## Decisions Made
See key-decisions frontmatter. Most load-bearing: one cross-platform primary-modifier rule (meta||control), A1-defensive key/code matching, A2 shell-honor in create(), and startupCommand kept strictly stored-only.

## Deviations from Plan

None - plan executed exactly as written. The plan anticipated that `security.guard.test.ts` would need no code change (it asserts against EXPECTED_API_KEYS dynamically); confirmed — it went RED→GREEN automatically, so it is listed in the plan's `files_modified` but was not edited.

## Issues Encountered
None. Baseline was 11 files / 54 tests GREEN; after Task 1 the 5 new unit files went RED (6 failures) as designed; after Task 2 four suites went GREEN; after Task 3 all 16 files / 82 tests GREEN with `npx tsc --noEmit` and `eslint .` clean.

## Known Stubs
The three E2E smoke stubs (`keyboard-switch`, `session-edit`, `sidebar-collapse`) are INTENTIONAL Wave 0 RED stubs that drive not-yet-built DOM (context menu, edit modal, identity header, collapse toggle, before-input-event). They are not regressions — they go GREEN as Plans 04-02 (edit), 04-03 (keyboard switch), 04-04 (collapse) land. `nyquist_compliant` stays `false` in 04-VALIDATION.md until Plan 04 closes the last gap. No stub blocks this plan's own goal (the pure modules + bridge + updateProfile are fully wired and unit-GREEN).

## User Setup Required
None - no external service configuration required. Phase 4 installs ZERO packages (per 04-RESEARCH Package Legitimacy Audit).

## Next Phase Readiness
- Plan 04-02 (create/edit form) can build SessionEditModal + IconPicker against `splitEdit`, `emojiSpec`/`colorSpec`/`COLOR_INITIAL`, `emoji-set`, and `window.api.ptyUpdateProfile` — all live and tested.
- Plan 04-03 (keyboard switch) can wire `before-input-event` → `matchSwitchKey` → `session:switch` → `onSwitchSession` → `resolveSwitch`; the A1 E2E proof stub is ready.
- Plan 04-04 (collapse) closes the last Wave 0 gap and flips `nyquist_compliant: true`.

## Self-Check: PASSED

All 8 sampled created files exist on disk; all 3 task commits (e9d56c4, 4625720, 95b6149) are present in git history. Full unit suite: 16 files / 82 tests GREEN; `npx tsc --noEmit` and `eslint .` clean.

---
*Phase: 04-session-identity-sidebar-ui*
*Completed: 2026-06-05*
