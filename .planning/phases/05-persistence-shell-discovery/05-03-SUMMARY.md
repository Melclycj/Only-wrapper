---
phase: 05-persistence-shell-discovery
plan: 03
subsystem: renderer-ui

# Dependency graph
requires:
  - phase: 05-persistence-shell-discovery
    plan: 01
    provides: "discoverShells() IPC + DiscoveredShell type; persistUiState() (18-key bridge); MacShellProvider (/etc/shells + $SHELL on-disk-filtered)"
  - phase: 05-persistence-shell-discovery
    plan: 02
    provides: "PtyManager.hydrate dormant map + create({id}) promotion (the Start ▶ primitive); listSessions() live+dormant merge sorted by order; coerce-on-load dormant (not_started) restore"
  - phase: 04-session-identity-sidebar
    provides: "renderIcon (Sidebar), STATUS_STYLE (status-colors), .status-badge/.identity-header/.edit-field CSS, ContextMenu, SessionEditModal split-edit form"
provides:
  - "Shell dropdown (D-05/SC4) — SessionEditModal free-text shell <input> replaced by a discovered <select className=edit-select>; $SHELL always present + default-selected; no free-text path (security V5/T-05-03)"
  - "IdleCard (D-04) — dormant-session placeholder card (identity + read-only mono cwd/shell/startupCommand + ▶ Start button); startupCommand DISPLAYED never executed (TERM-05 boundary, T-05-07)"
  - "WelcomeEmptyState (D-10) — zero-sessions CTA (welcome-create-session); boot no longer auto-spawns"
  - "SessionManager boot rewrite — one-shot listSessions() snapshot sorted by order, focus first (D-09); reconcile poll removed; handleStart promotes a dormant id via ptyCreate({id}); collapse toggle mirrors persistUiState (D-12)"
  - "Sidebar Start/Restart flip (D-03) — ▶ start-session for not_started ↔ ↻ restart-session for has-run; data-dormant row dimming; ContextMenu label parity"
affects: [05-04 (dnd-kit reorder of the same dormant/live rows + persistOrder), 08 (Windows shell enumeration behind the same discoverShells seam)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native <select> styled to match .edit-input exactly (.edit-select) — removes the arbitrary-path injection surface while keeping the splitEdit ref-read contract (.value identical to the old input)"
    - "Dormant-vs-live UI is status-driven, not a separate component tree: SessionView mounts ONLY for status !== 'not_started'; the active dormant session renders IdleCard in the viewport-stack (preserves the every-mounted-SessionView-has-a-live-PTY invariant — Pitfall 4)"
    - "Boot is a single listSessions() snapshot (no setInterval poll) — main's persisted store is the source of truth; restored rows are dormant until an explicit Start ▶"

key-files:
  created:
    - src/renderer/IdleCard.tsx
    - src/renderer/WelcomeEmptyState.tsx
  modified:
    - src/renderer/SessionEditModal.tsx
    - src/renderer/SessionManager.tsx
    - src/renderer/Sidebar.tsx
    - src/renderer/terminal.css
    - tests/smoke/persistence.smoke.test.ts
    - tests/smoke/helpers/xterm-driver.ts
    - tests/smoke/pty-roundtrip.smoke.test.ts
    - tests/smoke/pty-resize.smoke.test.ts
    - tests/smoke/pty-throughput.smoke.test.ts

key-decisions:
  - "Empty state keeps the sidebar chrome + '+ Add session' affordance (UI-SPEC §4 permits this) and renders WelcomeEmptyState in the terminal-area — preserves the add path for tooling/users AND keeps the existing smokes' clickAddSession working on an empty boot"
  - "SessionView gating lives in SessionManager (filter started sessions + render IdleCard for the active dormant) rather than an early-return inside SessionView — keeps SessionView's mount effect untouched and guarantees ptyResize is never called for a never-spawned id (Pitfall 4)"
  - "collapse is persisted on toggle (persistUiState) but NOT re-read into renderer state on boot — listSessions() does not carry the ui slot; D-12 collapse/bounds restore on the MAIN side (window lifecycle), so a boot re-read here would be redundant over-engineering"

patterns-established:
  - "ensureSession() smoke helper: idempotently spawns + waits for window.__term before single-pane sendKeys/readBuffer — the canonical pre-step now that boot does not auto-spawn a default session (D-10)"

requirements-completed: [PERS-02, NAV-04]

# Metrics
duration: 16min
completed: 2026-06-06
---

# Phase 5 Plan 03: Shell-Discovery + Dormant-UI Vertical Slice Summary

**The renderer slice that makes restored/dormant sessions a coherent, launchable experience: a real shell DROPDOWN populated from the OS (no free-text), a dormant-session IdleCard with a ▶ Start button (saved startupCommand displayed, never executed — TERM-05), a warm welcome CTA replacing the old auto-spawn boot, and a Sidebar Start (▶) ↔ Restart (↻) flip — with collapse now persisted.**

## Performance
- **Duration:** ~16 min
- **Started:** 2026-06-06T06:15:20Z
- **Completed:** 2026-06-06T06:31:10Z
- **Tasks:** 3
- **Files:** 11 (2 created, 9 modified)

## Accomplishments
- **Shell dropdown (D-05/SC4).** `SessionEditModal`'s free-text shell `<input ref>` is now a native `<select className="edit-select" ref>` populated from `window.api.discoverShells()` on modal open. A disabled "Finding shells…" option shows in flight; on resolve, one `<option value={path}>{label}</option>` per `DiscoveredShell`. The current `record.shell` is default-selected when present, else `$SHELL` (always first — main guarantees it, D-05 safety). The free-text path is GONE, so the renderer can no longer submit an arbitrary executable path (security V5/T-05-03). The `splitEdit` ref-read contract is preserved (a `<select>`'s `.value` reads identically to the old input). A `.edit-select` CSS rule mirrors `.edit-input` including the blue `:focus-visible` outline.
- **IdleCard (D-04).** New `IdleCard.tsx` renders in `.terminal-area` (replacing the live xterm) when the active session is `not_started`: identity (reused `renderIcon` 28px tile + name 20px/700 + slate "Idle" `.status-badge`), a recessed `--bg-sunk` config block of read-only JetBrains-Mono cwd/shell/startupCommand pairs, the TERM-05 displayed-not-executed cue (leading `$ ` glyph + "Saved for reference — not run automatically…" helper, empty → "No startup command saved"), an error-after-start red line, and a ▶ Start session button firing `onStart`. IdleCard has **no** `ptyWrite`/run path — the saved command is never executed (T-05-07).
- **WelcomeEmptyState (D-10).** New `WelcomeEmptyState.tsx`: the 🛋️ parlour glyph, "Your parlour is quiet" heading, the parlour body copy, and the filled-blue "Create a session" CTA (`data-testid="welcome-create-session"`) firing the existing live-spawn `onAdd`.
- **SessionManager boot rewrite.** The auto-add-on-empty boot is replaced by a one-shot `listSessions()` snapshot sorted by `order`, focusing the first session (D-09); zero sessions → WelcomeEmptyState (no auto-spawn — a corrupt-recovered empty store also lands here, surfacing nothing scarier). The `RECONCILE_MS` `setInterval` poll is removed entirely. `handleStart(id)` issues `ptyCreate({ id, cols, rows })` for the dormant id (main promotes it from the dormant map — Plan 05-02) and flips the row to running. The collapse toggle now mirrors `persistUiState({ collapsed })` (D-12). The active dormant session renders IdleCard in the viewport-stack; SessionView mounts only for started sessions (Pitfall 4 — never `ptyResize` a never-spawned id).
- **Sidebar Start/Restart flip (D-03).** The non-running row control flips ▶ `data-testid="start-session"` / `aria-label="Start {name}"` for `not_started` ↔ ↻ `data-testid="restart-session"` for has-run states; a new `onStart` prop wires the promote path. Dormant rows carry `data-dormant` (0.85 icon/name opacity, UI-SPEC §5) and the slate "Idle" badge. The ContextMenu "Restart" item flips to "Start" for a dormant target. A `.row-control-start` blue hover/focus accent was added (mirroring `.row-control-close`).

## Task Commits
1. **Task 1: Shell dropdown (D-05/SC4)** — `5c28826` (feat)
2. **Task 2: IdleCard (D-04) + WelcomeEmptyState (D-10)** — `779ebba` (feat)
3. **Task 3: Boot snapshot + Start wiring + collapse-persist; Sidebar flip; smoke** — `64ca677` (feat)

## Files Created/Modified
- `src/renderer/IdleCard.tsx` (created) — dormant-session card; reuses renderIcon + STATUS_STYLE; displays-never-executes startupCommand; ▶ Start button → onStart.
- `src/renderer/WelcomeEmptyState.tsx` (created) — zero-sessions CTA (welcome-create-session) → onCreate.
- `src/renderer/SessionEditModal.tsx` (modified) — discoverShells() useEffect + shells state; free-text shell `<input>` → discovered `<select className="edit-select">`; in-flight "Finding shells…"; handleSave guards the select value until discovery resolves.
- `src/renderer/SessionManager.tsx` (modified) — boot snapshot (sort+focus-first, no auto-spawn); reconcile poll removed; handleStart promote; handleToggleCollapse → persistUiState; IdleCard/WelcomeEmptyState render; startedSessions SessionView gate; ContextMenu Start/Restart flip; race-safe onAdd naming/order.
- `src/renderer/Sidebar.tsx` (modified) — onStart prop; dormant ▶/has-run ↻ control flip; data-dormant row attribute.
- `src/renderer/terminal.css` (modified) — .edit-select (+ focus-visible); .idle-card* + .welcome-* surfaces (existing tokens + documented blue/red ramps); .row-control-start; [data-dormant] dimming.
- `tests/smoke/persistence.smoke.test.ts` (modified) — empty-store welcome CTA (D-10), lowdb-on-add proof, round-trip, Start ▶ flip exclusivity.
- `tests/smoke/helpers/xterm-driver.ts` (modified) — ensureSession() (idempotent spawn + window.__term readiness wait).
- `tests/smoke/pty-roundtrip|resize|throughput.smoke.test.ts` (modified) — before(ensureSession) hooks (boot no longer auto-spawns).

## Decisions Made
- **Empty state keeps the sidebar chrome.** UI-SPEC §4 permits "the sidebar chrome + collapse toggle may remain". Rendering WelcomeEmptyState inside `.terminal-area` (not replacing the whole layout) keeps the `+ Add session` affordance live — which both honors the spec and keeps every existing smoke's `clickAddSession()` working on an empty boot.
- **SessionView gating in SessionManager, not SessionView.** Filtering `startedSessions` and rendering IdleCard for the active dormant session keeps SessionView's mount effect untouched and guarantees `ptyResize` is never called for a never-spawned id (Pitfall 4). A dormant→running Start naturally re-includes the row in the SessionView map (fresh mount under the same logicalId).
- **collapse persisted on toggle, not re-read on boot.** `listSessions()` does not carry the ui slot; D-12 collapse + window bounds restore on the MAIN side (window lifecycle, Plan 05-02). A boot re-read into renderer state would be redundant — the plan explicitly said "do not over-engineer".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Race-safe onAdd session naming/order**
- **Found during:** Task 3 (the keyboard-switch smoke failed after the boot rewrite)
- **Issue:** `onAdd` read `count = prev.length` inside a `setSessions` updater BEFORE awaiting the spawn, then named the record `Session ${count+1}` with `order = count`. Two rapid `clickAddSession()` calls both captured `count = 0` (neither had appended yet), producing two `Session 1` rows with `order = 0`. The OLD auto-spawn boot masked this (the pre-seeded session made the first real add see `prev.length ≥ 1`); removing it (D-10) surfaced the collision, and the keyboard-switch smoke's "header changes on switch" assertion failed because both sessions read "Session 1".
- **Fix:** Spawn once with a provisional index, then derive the FINAL `name`/`order` from `prev.length` INSIDE the functional append — concurrent adds now index off the up-to-date list. Single spawn preserved (T-03-09).
- **Files modified:** src/renderer/SessionManager.tsx
- **Committed in:** 64ca677 (Task 3)

**2. [Rule 3 - Blocking] pty-* single-pane smokes assumed a boot-spawned session**
- **Found during:** Task 3 (pty-roundtrip/resize/throughput failed after the boot rewrite)
- **Issue:** Those three smokes call `sendKeys`/`readBuffer` directly with NO `clickAddSession()` — they relied on the removed auto-spawn boot for a terminal to exist. With D-10 (nothing auto-spawns) their first action hit an empty app (no `window.__term`).
- **Fix:** Added an idempotent `ensureSession()` helper (spawn if no terminal, wait for `window.__term` + the xterm helper textarea — the active WebGL pane does NOT populate `.xterm-rows`, so readiness keys off the term handle the single-pane helpers actually read) and a `before(ensureSession)` hook to each of the three specs. Out of scope to alter their assertions; they only needed the session they exercise to exist.
- **Files modified:** tests/smoke/helpers/xterm-driver.ts, tests/smoke/pty-roundtrip.smoke.test.ts, tests/smoke/pty-resize.smoke.test.ts, tests/smoke/pty-throughput.smoke.test.ts
- **Committed in:** 64ca677 (Task 3)

**3. [Rule 2 - Critical] persistence smoke premise updated to the new boot contract**
- **Found during:** Task 3 (the persistence smoke's first test asserted "the renderer auto-starts a session on boot")
- **Issue:** The store file is no longer created by a boot auto-spawn (D-10) — on an empty store the app shows the welcome CTA and writes nothing until a session is added. The existing test's premise was now false.
- **Fix:** Reframed: a new empty-boot test asserts the welcome CTA / no-auto-spawn; the lowdb-resolution proof now adds a session first (`clickAddSession`) before asserting the store is written; a new test asserts the dormant Start ▶ / live flip is exclusive. The round-trip test is unchanged.
- **Files modified:** tests/smoke/persistence.smoke.test.ts
- **Committed in:** 64ca677 (Task 3)

**Total deviations:** 3 auto-fixed (1 race bug surfaced by the mandated boot change, 1 blocking smoke setup, 1 test-premise correction). No architectural changes, no scope creep — all three are direct consequences of removing the auto-spawn boot the plan mandated, fixed inside the planned files + the smokes the plan said to extend.

## Issues Encountered
None outstanding. Full unit suite: **124 passed (22 files)**. `tsc --noEmit` + `eslint` clean on all touched source. Full smoke suite: **9 spec files passed** (boot, keyboard-switch, multi-session-keepalive, persistence×4, pty-roundtrip, pty-resize, pty-throughput, session-edit, sidebar-collapse) against the repackaged build.

## Known Stubs
None. The shell dropdown is wired to the real `discoverShells()` provider; IdleCard reads the real persisted record; Start fires the real `ptyCreate({id})` promotion. The Windows shell enumeration is intentionally Phase 8 behind the same `discoverShells` seam (the macOS provider is live + SC4-satisfying this phase); the `WindowsShellProvider` stub returns the resolved default so the dropdown is never empty cross-platform (D-05 safety holds).

## Threat Flags
None — no new network endpoints, auth paths, or trust boundaries beyond the plan's `<threat_model>`. The two mitigations this plan owns are implemented + verified: T-05-03 (dropdown-only, no free-text → no arbitrary-path injection; grep-verified the free-text input is removed) and T-05-07 (IdleCard displays startupCommand read-only with no ptyWrite path; grep-verified). Start spawns only through the validated `create()` path (T-05-02 — fresh ptyPid, never re-attaches a persisted PID).

## User Setup Required
None.

## Next Phase Readiness
- **Ready for Plan 05-04 (dnd-kit reorder):** the same dormant/live sidebar rows now carry the Start/Restart affordance; reorder maps to `persistOrder`, and dormant rows are already first-class in `setOrder` (Plan 05-02).
- **Phase-gate MANUAL check (carried):** create 🛋️ Parlour Claude RC, quit, reopen → it reappears dormant with an idle card + ▶; the shell dropdown lists discovered shells. WDIO cannot drive a full app quit/relaunch — this is the human reopen verification (noted `// MANUAL:` in the persistence smoke; the built app's restore path is unit + round-trip proven, the DOM affordance contract is asserted).

---
*Phase: 05-persistence-shell-discovery*
*Completed: 2026-06-06*

## Self-Check: PASSED

- Both created files (`src/renderer/IdleCard.tsx`, `src/renderer/WelcomeEmptyState.tsx`) verified present on disk.
- All 3 task commits (`5c28826`, `779ebba`, `64ca677`) verified in git history.
- Full unit suite GREEN (124 passed); full smoke suite GREEN (9 spec files) against the repackaged build; tsc + eslint clean.
