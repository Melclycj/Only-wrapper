---
phase: 05-persistence-shell-discovery
verified: 2026-06-06T17:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Full quit → relaunch restore"
    expected: "Create a named session (e.g. 🛋️ Parlour Claude RC), fully quit the app, reopen it — the session reappears with the correct name/icon/cwd/shell in not_started status with an IdleCard and a ▶ Start button. No session is missing."
    why_human: "WDIO cannot reliably fully-quit and relaunch the Electron Forge app within one smoke session. The persistence data path is unit-proven and bridge-smoke-proven; the actual quit+relaunch restore UX requires a manual run."
  - test: "Real pointer drag gesture for reorder"
    expected: "Drag the 3rd sidebar row above the 1st, quit the app, reopen — the new order persists and the sidebar renders the dragged row in its new position."
    why_human: "CDP/WebdriverIO cannot drive dnd-kit PointerSensor DnD deterministically. The persistOrder IPC path is smoke-asserted via bridge call; only the physical drag gesture requires human execution."
  - test: "Shell dropdown lists the host machine's discovered login shells"
    expected: "Open the session edit form — the Shell field is a <select> dropdown listing the machine's login shells from /etc/shells with $SHELL present and default-selected. No free-text input exists."
    why_human: "The host-specific /etc/shells + $SHELL contents vary by machine. The pure buildShellList logic is unit-tested; the real platform output requires a human to open the dropdown and observe what the OS exposes."
---

# Phase 5: Persistence + Shell Discovery Verification Report

**Phase Goal:** Session profiles survive app restarts — the user's sessions, names, icons, working directories, and sidebar ordering are all restored on reopen — and the shell list is populated correctly for the user's platform without hardcoded paths.
**Verified:** 2026-06-06T17:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After fully closing and reopening the app, all session profiles are restored with their correct names, icons, shells, working directories, and startup commands — no session is missing | ✓ VERIFIED | `SessionStore.load()` coerces every record through `coerceOnLoad`, hands them to `ptyManager.hydrate(data.sessions)` in `index.ts:125-126`. `listSessions()` merges live+dormant sorted by order. 8-field round-trip unit-proven GREEN in `session-store.test.ts`. Persistence smoke asserts the store file is created and the created session profile persists. |
| 2 | Restored sessions always open in `not_started` status regardless of what status they had when the app was closed; no session shows `running` on launch | ✓ VERIFIED | `coerceOnLoad` in `store-schema.ts:42-43` forces `{ ...rec, status: 'not_started', ptyPid: undefined }`. Called on every record by `SessionStore.load()` before `hydrate()`. 26 pure-module unit tests GREEN including the coercion invariant. `hydrate()` stores records WITHOUT spawning any PTY (Pattern 4 option b). |
| 3 | The sidebar preserves the user's custom session ordering across restarts | ✓ VERIFIED | Full chain verified in code: `SortableSidebarRow` onDragEnd → `handleReorder` in `SessionManager` → pure `reorder(sessions, fromId, toId)` from `session-reorder.ts` → `window.api.persistOrder([{id, order}])` → `setOrder()` (validate-in-main, live+dormant maps) → `signalStore()` → `scheduleSave()` → lowdb write. `listSessions()` sorts by order. `session-reorder.test.ts` GREEN (dense 0..n-1 reindex). `reorder.smoke.test.ts` asserts persisted store file reflects the new dense order. Boot snapshot in `SessionManager` sorts by order on load. |
| 4 | The shell selector in the session creation form is populated with available shells for the current platform (zsh/bash on macOS; PowerShell/CMD/Git Bash/WSL on Windows) with no hardcoded paths that break on non-standard installs | ✓ VERIFIED | `SessionEditModal.tsx:81-91` calls `window.api.discoverShells()` in a useEffect on modal open. Shell field is a `<select className="edit-select">` (no free-text `<input>`). `MacShellProvider` reads `/etc/shells` via `parseEtcShells`, calls `buildShellList(etcShellPaths, resolvedShell, existsFn)` — `resolvedShell` ($SHELL via `resolveShell()`) is ALWAYS first, on-disk-filtered, de-duped by path. No hardcoded paths. `WindowsShellProvider` is intentionally a stub returning the resolved default (Phase 8 per ROADMAP); D-05 safety holds (dropdown is never empty). |

**Score:** 4/4 truths verified

---

### Code Review Findings Assessment (CR-01, CR-02)

Two Critical findings from 05-REVIEW.md were independently verified against the codebase:

#### CR-01: Arbitrary shell-path injection at the `pty:update-profile` IPC boundary

**Confirmed in codebase:** `pty-manager.ts:564-568` — `updateProfile()` type-guards `shell` only as `typeof fields.shell === 'string'` and stores it verbatim. `create()` at line 203-206 then spawns the stored string directly as the executable with no further validation. The `discoverShells()` allowlist is never consulted on the persist path.

**SC4 impact:** SC4 requires the dropdown be populated from the discovered shell list — VERIFIED. The allowlist non-enforcement at the IPC boundary is a security hardening gap (T-05-03 defense-in-depth) that goes beyond the literal SC4 wording. The renderer-side `<select>` control prevents free-text injection from the legitimate UI path. A compromised or malicious renderer context could bypass the dropdown and inject an arbitrary shell path.

**Judgment: NOT an SC blocker.** SC4 is the dropdown being populated correctly, which is verified. CR-01 is a security hardening gap — a WARNING that the phase's own stated T-05-03 invariant ("renderer can no longer submit an arbitrary executable path") is only enforced at the renderer UI layer, not at the IPC boundary. Should be addressed before Phase 8/packaging.

#### CR-02: Profile edits to restored DORMANT sessions are silently dropped

**Confirmed in codebase:** `pty-manager.ts:564-565` — `updateProfile()` calls `this.sessions.get(id)` and returns early if the session is not in the live map. A restored (boot-hydrated) session lives in `dormantRecords` until explicitly Started. The user can open the Edit modal on any row including dormant rows (Sidebar has an edit button on every row, `handleEdit` is called for any id in `sessions` array which includes dormant rows via `listSessions()`). When a dormant session's profile is edited, `handleSaveLive` updates the renderer-local React row (visual update) and calls `ptyUpdateProfile(id, ...)`, but main's `updateProfile()` no-ops because `this.sessions.get(id)` returns undefined. `signalStore()` is never called. The edit is neither persisted to the store nor applied to the dormant record. On the next boot, `listSessions()` returns the un-edited dormant record.

**SC1 impact:** SC1 as literally stated ("profiles are RESTORED with their correct fields on reopen") tests the RESTORE path. The dormant record that was restored IS correct (it has the fields as they were when last persisted). CR-02 is a gap in editing those restored records — the edit-persistence invariant is broken for dormant sessions. This is distinct from the restore path itself.

**Judgment: NOT an SC1 blocker** for the literal restore invariant. However, this is a significant data durability bug that defeats the phase's core value for exactly the sessions the phase exists to make manageable (restored ones). A user who edits a dormant session's name/icon/cwd/shell and saves will see their edit silently disappear on next boot. Recorded as a WARNING requiring follow-up before Phase 6/packaging.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/store-schema.ts` | StoreSchema type, SCHEMA_VERSION, coerceOnLoad | ✓ VERIFIED | Exports `SCHEMA_VERSION = 1 as const`, `StoreSchema` interface (version/sessions/ui), `coerceOnLoad` — electron-free, no `import 'electron'` |
| `src/main/shell-discovery.ts` | DiscoveredShell, ShellDiscovery, parseEtcShells, buildShellList, MacShellProvider, WindowsShellProvider, selectShellProvider | ✓ VERIFIED | All 7 exports present. Pure parsing helpers are electron-free and injected-existsFn testable. MacShellProvider reads /etc/shells real FS. WindowsShellProvider stub returns resolved default. |
| `src/main/window-bounds.ts` | validateBounds, DEFAULT_BOUNDS | ✓ VERIFIED | Both exported. DEFAULT_BOUNDS = `{ width: 1200, height: 800, x: 0, y: 0 }`. validateBounds returns saved bounds when top-left is within a display work-area, else DEFAULT_BOUNDS. |
| `src/renderer/session-reorder.ts` | reorder (pure dense reindex) | ✓ VERIFIED | `export function reorder` present. Implements arrayMove semantics + `.map((s,i) => ({...s, order: i}))` dense reindex. No React/dnd-kit imports. |
| `src/main/session-store.ts` | SessionStore class — lowdb Low<StoreSchema> via dynamic import | ✓ VERIFIED | `await import('lowdb')` at line 98. Dynamic (NOT static). Corrupt recovery, debounce/flush, coerceOnLoad on load, pathOverride test seam. |
| `src/main/pty-manager.ts` | hydrate(records), dormantRecords map, setStoreSignal, listSessions merge | ✓ VERIFIED | `dormantRecords: Map<LogicalId, SessionRecord>` at line 159. `hydrate(records)` at line 374. `listSessions()` merges live+dormant sorted by order at line 477-481. `setStoreSignal()` at line 338. |
| `src/main/index.ts` | whenReady store.load→hydrate→createWindow + before-quit flush | ✓ VERIFIED | Lines 124-128: `await store.load(); ptyManager.hydrate(data.sessions); ptyManager.setStoreSignal(syncStore); createWindow()`. Lines 149-158: before-quit `preventDefault()` + `store.flush()` re-entrancy guard. |
| `src/renderer/SessionEditModal.tsx` | shell <select> populated from discoverShells() | ✓ VERIFIED | Lines 81-91: useEffect calls `window.api.discoverShells()` on modal open. Lines 195-229: renders `<select className="edit-select">` with in-flight "Finding shells…" option or discovered shells. No free-text `<input>` for shell. |
| `src/renderer/IdleCard.tsx` | dormant-session placeholder card, Start button, no ptyWrite | ✓ VERIFIED | Renders identity + config block + Start button. No `window.api.ptyWrite` or any write/run path. `data-testid="idle-start-session"` present. startupCommand displayed with TERM-05 boundary helper text. |
| `src/renderer/WelcomeEmptyState.tsx` | zero-sessions CTA | ✓ VERIFIED | `data-testid="welcome-create-session"` present. Heading "Your parlour is quiet". CTA fires onCreate. |
| `src/renderer/SessionManager.tsx` | boot snapshot, no reconcile poll, handleStart promote, collapse-persist | ✓ VERIFIED | No RECONCILE_MS or setInterval poll. Boot useEffect: single `listSessions()` snapshot sorted by order. `handleStart` issues `ptyCreate({id})` for dormant id. `handleToggleCollapse` calls `window.api.persistUiState({collapsed: next})`. |
| `src/renderer/Sidebar.tsx` | dnd-kit SortableContext, useSortable rows, Start/Restart flip | ✓ VERIFIED | DndContext + SortableContext wrapping. SortableSidebarRow uses useSortable(). ▶ `data-testid="start-session"` for not_started; ↻ `data-testid="restart-session"` for has-run. |
| `tests/smoke/persistence.smoke.test.ts` | lowdb ESM-in-built-app proof + store round-trip | ✓ VERIFIED | File exists. Asserts store file created + parseable (Pitfall 1 proof). Created session profile persists to disk. Empty-boot CTA assertion. |
| `tests/smoke/reorder.smoke.test.ts` | drag-to-reorder persistence smoke | ✓ VERIFIED | File exists. Drives persistOrder bridge, asserts dense order in persisted store file. Drag-handle affordance assertion. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main/index.ts` | `src/main/session-store.ts` | `whenReady → store.load() → ptyManager.hydrate(data.sessions)` | ✓ WIRED | Lines 124-127: exact pattern present. store is SessionStore instance. |
| `src/main/pty-manager.ts` | `src/main/session-store.ts` | `signalStore → storeSignal → store.scheduleSave()` | ✓ WIRED | `setStoreSignal(syncStore)` in index.ts:127. `syncStore` calls `store.setSessions + store.setUi`. `signalStore()` called from create/onExit/close/updateProfile/setOrder/setUiState. |
| `src/main/index.ts` before-quit | `src/main/session-store.ts flush()` | `event.preventDefault() → await flush() → app.quit()` | ✓ WIRED | Lines 149-158: `if (!quitting && store.isDirty()) { quitting = true; event.preventDefault(); void store.flush().finally(() => app.quit()); }` |
| `src/preload/index.ts` | `src/main/window-config.ts EXPECTED_API_KEYS` | security.guard.test.ts exact-set assertion | ✓ WIRED | 18 keys in EXPECTED_API_KEYS (lines 92-94: discoverShells, persistOrder, persistUiState). Security guard GREEN (4/4 tests passing). |
| `src/shared/api-types.ts` | `src/preload/index.ts` | ElectronAPI type implemented by the api object | ✓ WIRED | `discoverShells`, `persistOrder`, `persistUiState` all present in both api-types.ts and preload/index.ts. |
| `src/renderer/SessionEditModal.tsx` | `window.api.discoverShells` | useEffect on open → populate <select> options | ✓ WIRED | Lines 81-91: `window.api.discoverShells().then((discovered) => { if (!cancelled) setShells(discovered); })` |
| `src/renderer/SessionManager.tsx` | `src/renderer/IdleCard.tsx` | render IdleCard in terminal-area when activeRecord.status === 'not_started' | ✓ WIRED | Lines 343-344, 387-389: `activeIsDormant = activeRecord?.status === 'not_started'`; IdleCard rendered when true. |
| `src/renderer/SessionManager.tsx` | `window.api.persistUiState` | collapse toggle → persistUiState({ collapsed }) | ✓ WIRED | Lines 73-78: `handleToggleCollapse` calls `window.api.persistUiState({ collapsed: next })`. |
| `src/renderer/Sidebar.tsx` | `src/renderer/session-reorder.ts` | onDragEnd → reorder(sessions, fromId, toId) (optimistic local) | ✓ WIRED | `handleReorder` in SessionManager lines 170-178 imports and calls `reorder(prev, fromId, toId)`. |
| `src/renderer/SessionManager.tsx` | `window.api.persistOrder` | onReorder → persistOrder([{ id, order }]) | ✓ WIRED | Lines 173-176: `window.api.persistOrder(next.map(s => ({ id: s.logicalId, order: s.order })))`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `src/renderer/SessionManager.tsx` | `sessions` | `window.api.listSessions()` boot effect (line 260) | Yes — main's `listSessions()` returns live+dormant records from real maps, populated by `hydrate(store.data.sessions)` | ✓ FLOWING |
| `src/renderer/SessionEditModal.tsx` | `shells` | `window.api.discoverShells()` useEffect (line 85) | Yes — main calls `selectShellProvider(process.platform).discover()` which reads real `/etc/shells` and `resolveShell()` | ✓ FLOWING |
| `src/renderer/IdleCard.tsx` | `session` prop | `activeRecord` in SessionManager from `sessions` state | Yes — same `sessions` array sourced from listSessions() above | ✓ FLOWING |
| `src/main/session-store.ts` | `db.data.sessions` | `await db.read()` (lowdb JSONFile) from real disk | Yes — lowdb reads actual JSON file on disk; missing file → defaultData; corrupt → backup+defaultData | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 22 unit test files pass (124 tests) | `npx vitest run` | 22 files / 124 tests passed in 661ms | ✓ PASS |
| Pure module tests GREEN | `npx vitest run src/main/__tests__/store-schema.test.ts src/main/__tests__/shell-discovery.test.ts src/main/__tests__/window-bounds.test.ts src/renderer/__tests__/session-reorder.test.ts` | 4 files / 26 tests passed | ✓ PASS |
| Security guard GREEN at 18 keys | `npx vitest run src/shared/__tests__/security.guard.test.ts` | 1 file / 4 tests passed | ✓ PASS |
| lowdb externalized in vite.main.config.ts | `grep lowdb vite.main.config.ts` | `external: ['electron', 'node-pty', 'lowdb']` | ✓ PASS |
| lowdb kept in forge packaging allow-list | `grep lowdb forge.config.ts` | Allow-list entry for `/node_modules/lowdb` and steno present | ✓ PASS |
| No electron import in four pure modules | `grep "from 'electron'" store-schema.ts shell-discovery.ts window-bounds.ts session-reorder.ts` | No output (electron-free) | ✓ PASS |
| RECONCILE_MS poll removed | `grep RECONCILE_MS src/renderer/SessionManager.tsx` | No output (removed) | ✓ PASS |
| No auto-spawn on empty (WelcomeEmptyState wired) | `grep WelcomeEmptyState src/renderer/SessionManager.tsx` | Import + render in isEmpty branch present | ✓ PASS |
| dnd-kit exact-pinned in package.json | `grep dnd-kit package.json` | `"@dnd-kit/core": "6.3.1"`, `"@dnd-kit/sortable": "10.0.0"` (no caret) | ✓ PASS |
| updateProfile does NOT touch dormantRecords (CR-02) | Read `pty-manager.ts:554-574` | `this.sessions.get(id); if (!s) return;` — dormant map never consulted | ✗ CONFIRMED (CR-02 bug, outside literal SCs — WARNING) |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes exist for this phase. Smoke tests are WDIO-driven and require a fully built app (`npm run make`); they were confirmed GREEN by the SUMMARY (05-04 SUMMARY: "10 spec files passed"). Smoke re-execution is outside this verification's scope (requires a built binary). The full unit suite is confirmed GREEN via `npx vitest run`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PERS-01 | 05-01, 05-02 | App saves session metadata locally — session ID, name, icon, working directory, shell, startup command, display order, last active time | ✓ SATISFIED | `SessionStore` persists all 8 fields via lowdb. `session-store.test.ts` round-trip test asserts all 8 fields survive write→read. SC1 verified. |
| PERS-02 | 05-01, 05-02, 05-03 | On reopen, app restores saved session profiles (metadata only, not live processes) and lets the user start them again | ✓ SATISFIED | `hydrate()` restores as dormant (no spawn). `listSessions()` returns dormant rows. IdleCard + Start ▶ lets user start them. SC2 verified. |
| NAV-04 | 05-01, 05-02, 05-04 | App remembers and persists the user's session order in the sidebar | ✓ SATISFIED | `reorder()` pure dense reindex + `persistOrder()` IPC + `setOrder()` validate-in-main + `signalStore()` → `scheduleSave()`. SC3 verified. `reorder.smoke.test.ts` asserts on-disk order. |

All three required requirement IDs are mapped, verified, and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/main/pty-manager.ts` | 564-565 | `updateProfile()` only checks `this.sessions.get(id)` — dormant records are silently no-oped | ⚠️ Warning | Profile edits to boot-restored (dormant) sessions are lost on next restart. Edit button is available on all rows including dormant. Data durability gap for the exactly the restored sessions this phase delivers. |
| `src/main/pty-manager.ts` | 568 | `typeof fields.shell === 'string'` only — no allowlist check against discovered shells | ⚠️ Warning | Defense-in-depth gap: allowlist enforced only in renderer `<select>`, not at IPC boundary. A compromised renderer could inject an arbitrary shell path. Not an SC4 violation (dropdown is populated correctly from discovery). |
| `src/main/index.ts` | 153 | `void store.flush().finally(() => app.quit())` — flush rejection becomes unhandled promise rejection | ℹ️ Info | Disk-full or permission-revoked flush failure produces an unhandled rejection; the data is lost with no diagnostic. Low probability in practice. |
| `tests/smoke/persistence.smoke.test.ts` | ~200 | `expect(dormantStarts).toBeGreaterThanOrEqual(0)` — always-true assertion (IN-04 from review) | ℹ️ Info | Dead test assertion; does not actually validate the dormant Start affordance count. |

No `TBD`, `FIXME`, or `XXX` markers were found in phase-modified files (searched key files). No debt-marker gate blockers.

### Human Verification Required

Three items from the 05-VALIDATION.md Manual-Only Verifications table are reproduced here as required human checks. These were pre-documented at planning time as WDIO-unresolvable.

#### 1. Full Quit → Relaunch Restore

**Test:** Create a session named "Parlour Claude RC" with icon 🛋️ and a real project directory as cwd. Fully quit the app (Cmd+Q / Alt+F4, not just close window). Reopen the app.
**Expected:** The session reappears in the sidebar in `not_started` status with the correct name, icon, and cwd. The terminal area shows an IdleCard with a ▶ Start button. Clicking Start promotes it to a live session. No session is missing; no session shows `running` on launch.
**Why human:** WDIO cannot reliably fully-quit and relaunch the Electron Forge app within one smoke session. The persistence data path is unit-proven (SessionStore round-trip, coerceOnLoad) and bridge-smoke-proven (persistence.smoke.test.ts asserts the store file is created); the actual quit+relaunch DOM experience requires manual execution.

#### 2. Real Pointer Drag Gesture for Reorder

**Test:** Create 3+ sessions. Drag the 3rd sidebar row above the 1st using the mouse (the ⠿ drag handle appears on hover). Quit the app, reopen it.
**Expected:** The dragged row is now in position 1 in the sidebar on next boot. The order persists. No duplicate order values.
**Why human:** CDP/WebdriverIO cannot drive dnd-kit PointerSensor DnD deterministically. The `persistOrder` IPC path is smoke-asserted via direct bridge call in `reorder.smoke.test.ts`; the physical drag gesture and its interaction with the 5px activation distance requires human execution.

#### 3. Shell Dropdown Lists Host Machine's Discovered Login Shells

**Test:** Open the session edit form (click ✎ on a session or right-click → Edit). Observe the Shell field.
**Expected:** The Shell field is a `<select>` dropdown (no free-text input) listing the machine's login shells from `/etc/shells` with `$SHELL` present and default-selected. On macOS this should include at minimum `/bin/zsh` and `/bin/bash`. No hardcoded paths that would fail on a non-standard install.
**Why human:** The host-specific `/etc/shells` contents and `$SHELL` vary by machine and login configuration. The pure `buildShellList` logic is unit-tested with fixture data; the real platform output requires a human to open the dropdown and observe the listed shells.

---

## Gaps Summary

No FAILED must-haves. All 4 Success Criteria are verified in the codebase. Two code review findings were confirmed as real implementation defects:

**CR-02** (dormant-session profile edits silently dropped) is the more impactful issue — it means edits to restored sessions are lost on the next boot, which undermines the practical value of the persistence system. This is outside the literal Success Criteria but should be treated as a near-blocker for the phase's own value proposition. **Recommend fixing before Phase 6 work begins.**

**CR-01** (shell allowlist not enforced at IPC boundary) is a security hardening gap. The renderer UI correctly uses a `<select>` that prevents free-text input, but the main-side `updateProfile()` handler accepts any string shell path. A defense-in-depth fix (validate shell against `discoverShells()` allowlist before persisting) should be applied before Phase 8 packaging.

Both issues are documented in the code review (05-REVIEW.md) with fix guidance. Neither blocks the phase's literal Success Criteria.

The three human verification items (full quit→relaunch restore, real pointer drag, shell dropdown listing) are pre-acknowledged MANUAL-only checks from 05-VALIDATION.md and require a human to execute against a running built app.

---

_Verified: 2026-06-06T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
