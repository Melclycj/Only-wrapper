---
phase: 04-session-identity-sidebar-ui
verified: 2026-06-05T14:25:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Canonical Parlour Claude RC flow — edit a session's name/icon live"
    expected: "Right-click a row -> Edit; change name to 'Parlour Claude RC', pick 🛋️ icon; row name + identity header update immediately; logicalId unchanged (same data-session-id on the row); set cwd + shell under 'Applies on restart'; Save; clicking another row switches non-destructively"
    why_human: "Live UI rendering of emoji, color-badge-with-initial visual rendering, and identity-header live update require visual inspection; automated E2E confirms the selector/event path but not the Nunito cozy aesthetic or emoji rendering fidelity"
  - test: "Keyboard chords never reach focused terminal (D-13 app-wins)"
    expected: "Run `npm start` with 3+ sessions; open vim in one session; focus it; press Cmd/Ctrl+1, Cmd/Ctrl+2 — sessions switch without vim receiving the keystroke; press Cmd/Ctrl+Shift+] and Cmd/Ctrl+Shift+[ to cycle next/previous with wraparound; background session keeps running"
    why_human: "The 'app-wins over vim/tmux/fzf' invariant (D-13) requires a live terminal in focus — cannot be asserted with WDIO DOM checks alone; requires a human to observe that vim does not receive the chord input"
  - test: "Collapsed rail visual identity — emoji + color badge + status dot + tooltip"
    expected: "Click chevron toggle; sidebar folds to ~52px icon-only rail; each session shows its emoji or color-badge-with-initial, a small status-color dot at the icon corner, and hovering shows the warm tooltip with name + status label; right-click a collapsed rail item opens the Edit/Restart/Close menu"
    why_human: "Visual inspection of collapsed rail: tooltip hover rendering, color-badge rendering in narrow rail, and cozy aesthetic (Nunito, --surface card) require human eyes; the collapse E2E confirms the DOM class/visibility but not visual quality"
---

# Phase 4: Session Identity + Sidebar UI — Verification Report

**Phase Goal:** The app's visual identity layer is complete — each session has a distinct name, icon, and status visible in a collapsible sidebar; sessions can be created and edited through a real form (name, icon, cwd, shell, optional startup command); and the user never needs the mouse to switch between sessions.
**Verified:** 2026-06-05T14:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sidebar lists sessions with icon + name + status badge; collapsing hides names but icon still identifies each session | VERIFIED | `Sidebar.tsx` renders `.collapsed-status-dot`, `.rail-tooltip`, and `collapsed ? 'sidebar collapsed' : 'sidebar'` class toggle; `terminal.css` has `.sidebar.collapsed` rules that hide `.row-name`/`.status-badge`/`.row-controls` while keeping `.row-icon` and revealing `.collapsed-status-dot`; sidebar-collapse E2E asserts this DOM behavior |
| 2 | User can create a session specifying name/icon/cwd/shell/startup — all fields functional; startupCommand is STORED-only (TERM-05 deferred, not auto-executed) | VERIFIED | `SessionEditModal.tsx` has fields `edit-name`, `edit-cwd`, `edit-shell`, `edit-startup`; `splitEdit` splits live vs restart halves; `ptyUpdateProfile` carries all five fields to main; `PtyManager.updateProfile` type-guards each field and stores `startupCommand` without writing to PTY (grep confirms zero `pty.write/spawn` calls involving `startupCommand`) |
| 3 | Rename/re-icon after creation does NOT create a new session or change logicalId | VERIFIED | `handleSaveLive` in `SessionManager.tsx` maps the existing row in-place (`prev.map(row => row.logicalId === id ? {...row, name, icon} : row)`) and calls `ptyUpdateProfile` — never calls `ptyCreate` or `newLogicalId` for an edit; session-edit E2E asserts `data-session-id` unchanged after rename |
| 4 | Keyboard shortcuts (Cmd/Ctrl+1–9 + next/prev) switch sessions without the mouse | VERIFIED | `src/main/index.ts` wires `win.webContents.on('before-input-event', ...)` that calls `matchSwitchKey(input)` and sends `'session:switch'` + `event.preventDefault()`; `SessionManager.tsx` subscribes via `window.api.onSwitchSession` and applies `resolveSwitch → setActiveId`; no `globalShortcut` used; keyboard-switch E2E PASSES |
| 5 | Switching updates panel immediately; previously active session stays running and visible on re-activation | VERIFIED | `setActiveId` is the only state change on switch (same TERM-06 non-destructive path as click-switch); `SessionView` keep-alive: all panes stay mounted, `active` prop toggles WebGL/focus; the background PTY is never killed or paused on a switch |

**Score: 5/5 truths verified**

### Deferred Items

No deferred items. All Phase 4 success criteria are met. TERM-05 (startup-command auto-run) is explicitly deferred to a later phase per the roadmap — `startupCommand` is stored, not executed, by design.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/switch-keys.ts` | matchSwitchKey pure matcher + SwitchIntent/KeyInput types | VERIFIED | 68 lines; exports `matchSwitchKey`, `SwitchIntent`, `KeyInput`; imports nothing from electron/node-pty |
| `src/renderer/session-switch.ts` | resolveSwitch reducer | VERIFIED | 35 lines; exports `resolveSwitch`; type-only import of SwitchIntent from main |
| `src/renderer/icon-spec.ts` | emojiSpec/colorSpec/COLOR_INITIAL builders | VERIFIED | 37 lines; exports `emojiSpec`, `colorSpec`, `COLOR_INITIAL`; imports only shared/types |
| `src/renderer/session-edit.ts` | splitEdit live-vs-restart reducer | VERIFIED | 41 lines; exports `splitEdit`; imports only shared/types |
| `src/renderer/emoji-set.ts` | CURATED_EMOJI (incl. 🛋️ + 🖥️) + COLOR_SWATCHES | VERIFIED | 54 lines; canonical emoji confirmed; 8 warm oklch swatches |
| `src/shared/api-types.ts` | ptyUpdateProfile + onSwitchSession on ElectronAPI | VERIFIED | Both methods present at lines 119–135 |
| `src/main/window-config.ts` | EXPECTED_API_KEYS = exactly 15 entries | VERIFIED | Confirmed 15 entries: getVersion + 7 PTY + 4 lifecycle + 1 ptyClose + ptyUpdateProfile + onSwitchSession |
| `src/main/pty-manager.ts` | PtyManager.updateProfile + pty:update-profile channel + create() honors record.shell | VERIFIED | `updateProfile` at line 439; `PTY_CHANNELS.updateProfile` at line 47; `create()` uses `prior?.shell && prior.shell.length` guard at line 163–166; registered in `registerIpc` + cleaned in `unregisterIpc` |
| `src/renderer/SessionEditModal.tsx` | Create/edit form modal (D-04) | VERIFIED | 218 lines; all required data-testid attrs present; uses `splitEdit`; has `applies-on-restart` group; imports `IconPicker` |
| `src/renderer/IconPicker.tsx` | Emoji grid + free-text + color swatches | VERIFIED | 92 lines; imports `emojiSpec`/`colorSpec`/`CURATED_EMOJI`/`COLOR_SWATCHES`; no `preset` option surfaced |
| `src/renderer/ContextMenu.tsx` | Right-click Edit/Restart/Close menu | VERIFIED | 106 lines; `role="menu"`, `role="menuitem"`, `data-testid="context-menu"`; document mousedown + keydown(Escape) cleanup |
| `src/renderer/IdentityHeader.tsx` | Slim active-session identity bar | VERIFIED | 38 lines; renders icon + name + STATUS_STYLE badge; NO `<button>` elements; `data-testid="identity-header"` |
| `src/renderer/Sidebar.tsx` | Collapse support + color-badge-with-initial + onContextMenu at row level | VERIFIED | `collapsed` + `onToggleCollapse` props; `COLOR_INITIAL` in color branch; `onContextMenu` at `.sidebar-row` div level (line 144); `.collapsed-status-dot` + `.rail-tooltip` elements per row |
| `src/renderer/SessionManager.tsx` | Hosts editingId + menuState + collapsed state + full wiring | VERIFIED | All three state vars present; renders ContextMenu + SessionEditModal + IdentityHeader; `handleSaveLive` + `handleSaveProfile` both call `ptyUpdateProfile`; `onSwitchSession` subscription present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/preload/index.ts` | `pty:update-profile` / `session:switch` channels | `ipcRenderer.send` + `ipcRenderer.on` | WIRED | Lines 138 and 148 confirmed; `ptyUpdateProfile` sends on `'pty:update-profile'`; `onSwitchSession` subscribes to `'session:switch'` |
| `src/main/pty-manager.ts` | `record.shell` | `create()` prefers `prior.shell` when non-empty | WIRED | Lines 163–166: `prior?.shell && prior.shell.length ? { shell: prior.shell, args: [] } : resolveShell()` |
| `src/shared/__tests__/security.guard.test.ts` | EXPECTED_API_KEYS | `Object.keys(exposed).sort() === EXPECTED_API_KEYS.sort()` | WIRED | Guard test passes in 82/82 unit tests; imports the real preload with electron mocked |
| `src/main/index.ts` | `matchSwitchKey` (switch-keys.ts) | `before-input-event` handler calls `matchSwitchKey(input)` | WIRED | Line 41 in index.ts |
| `src/renderer/SessionManager.tsx` | `resolveSwitch` + `window.api.onSwitchSession` | `onSwitchSession` subscription applies `resolveSwitch → setActiveId` | WIRED | Lines 238–240; subscription returns unsubscribe fn; reads sessions via `sessionsRef` |
| `src/renderer/SessionEditModal.tsx` | `window.api.ptyUpdateProfile` | `onSaveLive` / `onSaveProfile` in SessionManager call it | WIRED | SessionManager lines 157 and 169 confirm both live and restart halves call `ptyUpdateProfile` |
| `src/renderer/IconPicker.tsx` | `icon-spec.ts` / `emoji-set.ts` | `emojiSpec`/`colorSpec`/`CURATED_EMOJI`/`COLOR_SWATCHES` imports | WIRED | Lines 16–18 of IconPicker.tsx |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `Sidebar.tsx` | `sessions`, `activeId` | `SessionManager` state (reconcile poll + ptyStatus subscriptions) | Yes — fetches `window.api.listSessions()` and merges live status updates | FLOWING |
| `IdentityHeader.tsx` | `session` prop | Derived in `SessionManager` as `sessions.find(s => s.logicalId === activeId)` | Yes — real session record from state | FLOWING |
| `SessionEditModal.tsx` | `session` prop | Derived in `SessionManager` as `sessions.find(s => s.logicalId === editingId)` | Yes — real session record seeded from main's record store | FLOWING |
| `PtyManager.updateProfile` | `record` store | Written by `updateProfile()` and read by `create()` on next restart | Yes — typed mutation of live `sessions` Map; persists through restart cycle | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests (all 16 files, 82 tests) | `npm run test:unit` | 82 passed, 16 files, 0 failed | PASS |
| TypeScript compilation | `npx tsc --noEmit` | Exit 0, no errors | PASS |
| EXPECTED_API_KEYS has exactly 15 entries | `grep "^  '" src/main/window-config.ts \| wc -l` | 15 | PASS |
| `startupCommand` never written to PTY | `grep 'pty\.write.*startup\|pty\.spawn.*startup' src/main/pty-manager.ts` | No matches | PASS |
| `globalShortcut` not used for chords | `grep 'globalShortcut' src/main/index.ts` | No matches | PASS |
| `preset` icon kind not surfaced in IconPicker | `grep 'preset' src/renderer/IconPicker.tsx` | Only in comment (not rendered) | PASS |
| IdentityHeader has no `<button>` elements | `grep 'button' src/renderer/IdentityHeader.tsx` | No matches | PASS |
| `onContextMenu` at `.sidebar-row` level | `grep -n 'onContextMenu' src/renderer/Sidebar.tsx` | Line 144 — within `.sidebar-row` div's JSX | PASS |
| Renderer never imports electron/node-pty | `grep "^import.*from '.*electron'" src/renderer/*.ts src/renderer/*.tsx` | No matches | PASS |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist for this phase. Step 7c: SKIPPED (conventional probes not present; behavioral spot-checks above cover the equivalent checks).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IDENT-03 | 04-02 | Each session has user-visible identity (name + icon + status) in sidebar AND session header | SATISFIED | `IdentityHeader.tsx` renders icon + name + STATUS_STYLE badge above the active terminal; `Sidebar.tsx` shows the same in each row |
| SESS-01 | 04-01, 04-02 | User can create session specifying custom name/icon/cwd/shell/startup (all fields functional) | SATISFIED | `SessionEditModal` has all five fields; `splitEdit` routes live vs restart; `ptyUpdateProfile` persists all to main; `create()` honors stored shell/cwd on restart |
| SESS-02 | 04-02 | User can set a custom name per session, shown in sidebar + header | SATISFIED | Live name edit via `handleSaveLive` updates `sessions` state and mirrors to main |
| SESS-03 | 04-01, 04-02, 04-04 | User can assign emoji / color badge icon; icon stays visible when sidebar collapsed | SATISFIED | `IconPicker` offers emoji grid + free-text + color swatches; color branch renders `COLOR_INITIAL` badge; collapsed rail keeps `.row-icon` visible |
| SESS-04 | 04-02 | Rename/re-icon after creation does not create new session ID | SATISFIED | `handleSaveLive` maps existing row in-place; never calls `ptyCreate`/`newLogicalId`; E2E asserts `data-session-id` unchanged |
| NAV-01 | 04-04 | Sessions in sidebar show icon + name + running/stopped status; status legible when collapsed | SATISFIED | `.collapsed-status-dot` element colored from `STATUS_STYLE[s.status].accent`; `.rail-tooltip` shows status label on hover |
| NAV-02 | 04-04 | Sidebar supports expanded/collapsed modes; icon identifies session when collapsed | SATISFIED | Pinned chevron toggle (`data-testid="sidebar-collapse"`); `.sidebar.collapsed` CSS rail; icon stays visible; E2E PASSES |
| NAV-03 | 04-02, 04-03 | Clicking a session tab switches view without stopping the terminal process | SATISFIED | `onSelect → setActiveId` is renderer-only; PTY untouched; this was Phase 3 work, confirmed intact via regression |
| NAV-05 | 04-01, 04-03 | User can switch sessions via keyboard (Cmd/Ctrl+1–9 + next/prev) without mouse | SATISFIED | `before-input-event` → `matchSwitchKey` → `session:switch` → `resolveSwitch → setActiveId`; `event.preventDefault()` so chords never reach PTY; keyboard-switch E2E PASSES |

All 9 requirements for Phase 4 are SATISFIED.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/IconPicker.tsx` | 68 | `placeholder="Or type an emoji…"` | Info | Not a code stub — a genuine HTML input placeholder string for the free-text emoji field. No impact. |

No debt markers (TBD/FIXME/XXX), no unreachable stubs, no hardcoded empty data arrays flowing to visible output, no hollow props.

---

### CONTEXT.md Decisions (D-01..D-14) Compliance

| Decision | Compliant | Evidence |
|----------|-----------|----------|
| D-01: Quick-add stays; form is EDIT form | Yes | `+ Add session` calls `addSession()` unchanged; `SessionEditModal` is only opened via context menu or double-click on existing row |
| D-02: name/icon live; cwd/shell/startup on restart with visible hint | Yes | `splitEdit` enforced; `applies-on-restart-hint` rendered; `handleSaveLive` vs `handleSaveProfile` split |
| D-03: Edit via right-click context menu; existing row controls optional | Yes | `ContextMenu` renders Edit/Restart/Close; existing row Restart/Close buttons kept per D-03 discretion |
| D-04: Modal dialog reusing ConfirmModal overlay pattern | Yes | `SessionEditModal` copies `.modal-overlay`/`.modal-dialog`/Esc/scrim/focus-on-open skeleton |
| D-05: Slim identity bar above active terminal, identity-only | Yes | `IdentityHeader` has no `<button>` elements; no controls |
| D-06: Shell field pre-filled with resolved shell, editable free-text | Yes | Modal seeds `setShell(session.shell)` from record; never recomputes in renderer |
| D-07: Expose emoji + color only; preset not surfaced | Yes | `IconPicker` has no preset UI; only comment reference |
| D-08: Curated emoji grid + free-text input | Yes | `CURATED_EMOJI` grid + `<input type="text">` for custom emoji |
| D-09: Color = fixed warm palette; badge-with-initial | Yes | `COLOR_SWATCHES` array; `renderIcon` color branch calls `COLOR_INITIAL` |
| D-10: Pinned toggle button folds to icon-only rail | Yes | `data-testid="sidebar-collapse"` button; `aria-pressed`; chevron `»`/`«` |
| D-11: Collapsed rail = icon + status dot + hover tooltip; context menu is control surface | Yes | `.collapsed-status-dot` + `.rail-tooltip` per row; `onContextMenu` at `.sidebar-row` level |
| D-12: Positions Cmd/Ctrl+1-9; next/prev Cmd/Ctrl+Shift+]/[ | Yes | `matchSwitchKey` implements exactly this scheme |
| D-13: App always wins — switch chords never reach PTY | Yes | `before-input-event` + `event.preventDefault()` on match; no `globalShortcut` |
| D-14: Switching-only keyboard coverage | Yes | No Cmd+T or Cmd+W bindings added; only switching intents handled |

---

### Human Verification Required

#### 1. Canonical Parlour Claude RC Edit Flow

**Test:** Run `npm start`; right-click a sidebar row; choose "Edit"; change name to "Parlour Claude RC", pick 🛋️ in the emoji grid; set a cwd (any real path) and shell (e.g. `/bin/zsh`) under the "Applies on restart" section; click Save
**Expected:** The sidebar row's name + icon update IMMEDIATELY while the row retains the same `data-session-id`; the identity header above the terminal also reflects the new name + icon; clicking another row then back confirms click-switch is non-destructive; setting a new shell takes effect only on the next restart (the running session is not killed)
**Why human:** Emoji rendering fidelity (🛋️ correct glyph, correct cell width), live identity-header visual update, cozy aesthetic (Nunito, rounded modal, --surface card), and the "applies on restart" visual grouping all require visual inspection

#### 2. Keyboard Chords Do Not Reach a Focused Terminal (D-13 app-wins)

**Test:** Run `npm start` with 3+ sessions; open `vim` in one session and leave it focused in insert mode; press Cmd+1 (macOS) or Ctrl+1 (Windows)
**Expected:** The session switches to the first sidebar position — vim does NOT receive the key; the active terminal panel and identity header change; pressing Cmd/Ctrl+Shift+] and Cmd/Ctrl+Shift+[ cycles next/previous with wraparound; the session that was running `vim` is still alive and visible when switched back to
**Why human:** The "app wins over a focused xterm" invariant (D-13) requires a live terminal with a running interactive program — WDIO's synthetic key injection bypasses `before-input-event` entirely (confirmed in the A1 note in xterm-driver.ts); only a human pressing physical keyboard keys through the native input path can verify the chord is intercepted before xterm receives it

#### 3. Collapsed Rail Visual Identity + Context Menu Access

**Test:** Run `npm start` with 2+ sessions (give one a color icon to verify the badge-with-initial in the rail); click the chevron toggle to collapse the sidebar; hover over a collapsed rail item; right-click a collapsed rail item
**Expected:** Sidebar folds to ~52px; per row: emoji shows its glyph or color-badge shows the session-name initial in a colored circle; a small status-color dot appears at the icon corner; hovering shows a warm tooltip with "name · status"; right-click opens Edit/Restart/Close context menu; clicking chevron again expands back
**Why human:** The visual rendering of the color-badge-with-initial (correct letter, correct swatch color), the tooltip's warm on-brand styling (Nunito, `--surface` card, `--radius`), and the status dot's position and color-swatch accuracy all require visual inspection that CSS/DOM checks cannot fully cover

---

### Gaps Summary

No code gaps. All 5 ROADMAP success criteria are verified in the codebase:

1. All required source files exist and are substantive (not stubs)
2. All key links are wired: preload bridge, before-input-event interceptor, onSwitchSession subscription, ptyUpdateProfile call chain, SessionEditModal → splitEdit → ptyUpdateProfile
3. Data flows to real output: sessions populate from `listSessions()` + status subscriptions; edits persist through `ptyUpdateProfile` → `updateProfile` → `record` → honored on next `create()`
4. Unit test suite: 82/82 passing across 16 files including security guard, pure module tests, and pty-update-profile tests
5. TypeScript: clean (`npx tsc --noEmit` exit 0)

Three human verification items remain — all are visual/interactive behaviors that grep and DOM checks cannot fully cover. These are end-of-phase human-UAT checks per the plan design, not code gaps.

---

_Verified: 2026-06-05T14:25:00Z_
_Verifier: Claude (gsd-verifier)_
