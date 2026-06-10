# Phase 4 — Artifacts This Phase Produces

> Authoritative manifest of every NEW symbol/file Phase 4 creates. The
> plan-review-convergence source-grounding pass excludes these newly-created
> symbols from drift verification — anything listed here is intentionally new,
> not a reference to an existing identifier.

## New renderer components (Plan 02)

| Symbol | File | Provides |
|--------|------|----------|
| `SessionEditModal` | `src/renderer/SessionEditModal.tsx` | Create/edit form modal (D-04) — live name/icon + restart-applied cwd/shell/startup |
| `IconPicker` | `src/renderer/IconPicker.tsx` | Emoji grid + free-text + color swatches (D-07/08/09) |
| `ContextMenu` | `src/renderer/ContextMenu.tsx` | Right-click Edit/Restart/Close menu (D-03) |
| `IdentityHeader` | `src/renderer/IdentityHeader.tsx` | Slim active-session identity bar above the terminal (D-05, IDENT-03) |

## New pure modules (Plan 01)

| Symbol(s) | File | Provides |
|-----------|------|----------|
| `emojiSpec`, `colorSpec`, `COLOR_INITIAL` | `src/renderer/icon-spec.ts` | Build/normalize SessionIconSpec; color→initial badge data (D-09) |
| `resolveSwitch` | `src/renderer/session-switch.ts` | (sessions, activeId, intent) → next activeId (D-12) |
| `splitEdit` | `src/renderer/session-edit.ts` | Live (name/icon) vs restart (cwd/shell/startup) field split (D-02) |
| `CURATED_EMOJI`, `COLOR_SWATCHES` | `src/renderer/emoji-set.ts` | Curated emoji array + warm color swatch list (D-08/D-09) |
| `matchSwitchKey`, `SwitchIntent`, `KeyInput` | `src/main/switch-keys.ts` | KeyInput → SwitchIntent matcher; main-side, electron-free (D-12/D-13) |

## New bridge keys (Plan 01 — 15-key surface)

| Key | Channel | Provides |
|-----|---------|----------|
| `ptyUpdateProfile` | `pty:update-profile` | Persist edited name/icon/cwd/shell/startupCommand into main's record (fire-and-forget) |
| `onSwitchSession` | `session:switch` | Subscribe to app-level switch intents (main → renderer); returns unsubscribe |

## New main-side methods / channel (Plan 01)

| Symbol | File | Provides |
|--------|------|----------|
| `PtyManager.updateProfile(id, fields)` | `src/main/pty-manager.ts` | id-validated, type-guarded record write (name/icon/cwd/shell/startupCommand) |
| `PTY_CHANNELS.updateProfile` | `src/main/pty-manager.ts` | `'pty:update-profile'` channel constant |
| `before-input-event` handler | `src/main/index.ts` | Intercepts switch chords → matchSwitchKey → `session:switch` send (Plan 03) |

## New CSS classes (Plans 02 & 04)

`.context-menu`, `.context-menu-item`, `.icon-picker`, `.emoji-grid`, `.color-swatches`, color-badge-initial styling, `.identity-header`, `.applies-on-restart-hint`, `.terminal-area`, `.sidebar.collapsed` (+ collapsed hide rules), `.collapsed-status-dot`, `.rail-tooltip`. Sidebar `collapsed` / `onToggleCollapse` props + `data-testid="sidebar-collapse"`. Sidebar `onContextMenu` / `onEdit` props.

## New test files (Plan 01 Wave 0)

| File | Covers |
|------|--------|
| `src/renderer/__tests__/icon-spec.test.ts` | SESS-03 spec construction + color-initial |
| `src/renderer/__tests__/session-switch.test.ts` | NAV-05 next/prev wraparound + out-of-range position |
| `src/renderer/__tests__/session-edit.test.ts` | SESS-01/02 live-vs-restart field split |
| `src/main/__tests__/switch-keys.test.ts` | NAV-05 chord matching (both modifiers, shift, alt/no-match) |
| `src/main/__tests__/pty-update-profile.test.ts` | SESS-01 restart respawns with edited cwd/shell; unknown-id no-op |
| `tests/smoke/keyboard-switch.smoke.test.ts` | NAV-05 E2E (A1 proof) |
| `tests/smoke/session-edit.smoke.test.ts` | SESS-01/02/04 + IDENT-03 E2E |
| `tests/smoke/sidebar-collapse.smoke.test.ts` | NAV-01/02 E2E |

New `xterm-driver.ts` helpers: `openContextMenu(id)`, `clickMenuItem(label)`, `toggleCollapse()`, `pressSwitchChord(intent)`, `readIdentityHeader()`.

## Modified existing symbols (not new — listed for clarity)

`Sidebar.renderIcon` color branch (swatch → badge-with-initial, D-09); `EXPECTED_API_KEYS` (13 → 15); `security.guard.test.ts` (key count); `PtyManager.create()` (honors `record.shell`); `SessionManager` (editingId/menuState/collapsed state + onSwitchSession sub + live-edit mirror).

---

## Multi-Source Coverage Audit

| SOURCE | ID | Feature/Requirement | Plan | Status |
|--------|-----|---------------------|------|--------|
| GOAL | — | Visual identity layer: distinct name/icon/status in a collapsible sidebar, create/edit form, mouse-free switching | 01–04 | COVERED |
| REQ | IDENT-03 | Identity (name+icon+status) in sidebar AND header | 02 | COVERED |
| REQ | SESS-01 | Create with name/icon/cwd/shell/startupCommand (all functional) | 01,02 | COVERED |
| REQ | SESS-02 | Custom name per session | 01,02 | COVERED |
| REQ | SESS-03 | Icon from emoji/color badge; visible when collapsed | 01,02,04 | COVERED |
| REQ | SESS-04 | Rename/re-icon after creation without new id | 01,02 | COVERED |
| REQ | NAV-01 | Sidebar list: icon + name + status (legible collapsed) | 02,04 | COVERED |
| REQ | NAV-02 | Expanded/collapsed; icon identifies when collapsed | 04 | COVERED |
| REQ | NAV-03 | Click-switch, non-destructive (regression confirm) | 02,03 | COVERED |
| REQ | NAV-05 | Keyboard switch (positions + next/prev), no mouse | 01,03 | COVERED |
| RESEARCH | — | before-input-event main-side switch interception (Pattern 1) | 01,03 | COVERED |
| RESEARCH | — | Reuse ConfirmModal overlay for the form (Pattern 2) | 02 | COVERED |
| RESEARCH | — | Persist restart-applied fields into main's record (Pattern 3) | 01 | COVERED |
| RESEARCH | — | Lightweight hand-rolled context menu (Pattern 4) | 02 | COVERED |
| RESEARCH | — | Icon picker emoji grid + free-text + color (Pattern 5) | 01,02 | COVERED |
| RESEARCH | — | Sidebar collapse + rail + tooltip (Pattern 6) | 04 | COVERED |
| RESEARCH | — | Identity header (Pattern 7) | 02 | COVERED |
| RESEARCH | — | All branchy logic in React/xterm-free pure modules | 01 | COVERED |
| RESEARCH | — | Wave 0 RED stubs (Validation Architecture) | 01 | COVERED |
| RESEARCH | — | A1 key-string de-risk via NAV-05 E2E | 01,03 | COVERED |
| CONTEXT | D-01 | Quick-add stays; the form is an EDIT form | 02 | COVERED |
| CONTEXT | D-02 | Live (name/icon) vs restart-applied (cwd/shell/startup) | 01,02 | COVERED |
| CONTEXT | D-03 | Edit opened via right-click context menu (new component) | 02 | COVERED |
| CONTEXT | D-04 | Create/edit form is a MODAL dialog | 02 | COVERED |
| CONTEXT | D-05 | Slim identity bar above the terminal (identity-only) | 02 | COVERED |
| CONTEXT | D-06 | Shell field: resolved default + editable path | 02 | COVERED |
| CONTEXT | D-07 | Icon picker exposes emoji + color only (preset unsurfaced) | 01,02 | COVERED |
| CONTEXT | D-08 | Emoji = curated grid + free-text fallback | 01 | COVERED |
| CONTEXT | D-09 | Color = fixed warm palette; color icon = badge-with-initial | 01,02 | COVERED |
| CONTEXT | D-10 | Pinned chevron toggle folds sidebar to icon-only rail | 04 | COVERED |
| CONTEXT | D-11 | Collapsed rail = icon + status dot + hover tooltip; menu is control surface | 02,04 | COVERED |
| CONTEXT | D-12 | Shortcut scheme Cmd/Ctrl+1-9 + Shift+]/[ | 01,03 | COVERED |
| CONTEXT | D-13 | App always wins (before-input-event) | 01,03 | COVERED |
| CONTEXT | D-14 | Switching only — no new/close bindings | 03 | COVERED |

**Result:** All GOAL / REQ / RESEARCH / CONTEXT items COVERED. No MISSING rows.

**Exclusions (not gaps):** NAV-04 (order persistence) → Phase 5; platform-aware shell discovery → Phase 5; TERM-05 startup auto-run → deferred (form stores only); TERM-12 header quick controls → Phase 6; preset icon-kind UI, Cmd/Ctrl+T/W bindings, collapse-state persistence, browser/alternate-layout/appearance mockup screens → CONTEXT Deferred Ideas / out of v1 scope.
