# Phase 5: Persistence + Shell Discovery - Research

**Researched:** 2026-06-06
**Domain:** Electron main-process local JSON persistence (lowdb v7 ESM-in-CJS), platform-aware shell discovery, React drag-to-reorder, BrowserWindow bounds restore, contextBridge IPC extension
**Confidence:** HIGH (all core decisions are locked in CONTEXT.md; the one genuinely risky surface — lowdb v7 ESM-only inside a CJS main bundle — is verified against npm + official docs)

## Summary

Phase 5 turns the in-memory `PtyManager` record store into a disk-backed store and replaces the single-shell `resolveShell()` with a discovered shell list. Nearly every behavioral decision is already locked (D-01..D-13 in CONTEXT.md), so this research is overwhelmingly *prescriptive HOW*, not exploratory. The codebase is unusually well-prepared for this: `SessionRecord` is already JSON-serializable, `listSessions()` is already documented as "the thing Phase 5 persists", `SessionManager.tsx`'s reconcile poll is explicitly written to be "replaced by the persisted snapshot", and the contextBridge has a battle-tested lockstep pattern (`api-types` + `EXPECTED_API_KEYS` + `preload` + `pty-manager` channel triple + `security.guard.test.ts`).

The single highest-risk integration surface is **lowdb v7 being a pure-ESM package consumed by a CJS main process**. This is VERIFIED: lowdb@7.0.1 declares `"type": "module"` with only an `exports.import`-style `"."` → `./lib/index.js` entry and **no CommonJS entry**. `vite.main.config.ts` forces the main bundle to `formats: ['cjs']` and `tsconfig.json` sets `"module": "commonjs"` — both deliberate, because node-pty must `require()`. A static `import { JSONFilePreset } from 'lowdb/node'` will therefore be transpiled to `require('lowdb/node')`, which throws `ERR_REQUIRE_ESM` at runtime (Node 18/20; node-pty's prebuild targets Electron 36's bundled Node). The correct, verified pattern is a **dynamic `import()`** inside the main bundle (Vite/Rollup must NOT down-level it to `require`), with lowdb marked `external` in `vite.main.config.ts` exactly like node-pty already is. This is the one item the planner must treat as load-bearing and verify with a runtime smoke check, not just a unit test.

**Primary recommendation:** Build a `SessionStore` module in `src/main/` that owns a lowdb `Low` instance loaded via dynamic `import()` (lowdb marked `external` in `vite.main.config.ts`), wraps it behind a small synchronous-facing API (debounced write + `flushSync`-on-quit), and is the producer/consumer around `PtyManager`'s existing record map. Build a `ShellDiscovery` interface with a fully-implemented + unit-tested macOS provider (reads `/etc/shells`, merges resolved `$SHELL`, filters to on-disk, de-dupes) and a stubbed Windows provider. Extend the contextBridge by exactly 3 new keys following the existing lockstep. Use `@dnd-kit/sortable` for reorder; use `electron-window-state` OR a hand-rolled bounds save (both viable — see Don't Hand-Roll). Coerce every restored record to `not_started` + clear `ptyPid` on load.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Reviving restored sessions**
- **D-01:** Restore is profiles-only — zero process coupling. Persistence writes `SessionRecord` data to disk and reads it back; it does not connect to, parse, or manage any running process. On load, every session is coerced to `not_started` and `ptyPid` cleared (SC2) — persisted status/PID are never trusted.
- **D-02:** TERM-05 (auto-run startup command) is NOT in this phase (it is Phase 5.1). Layer C (agent-state resume) stays out entirely.
- **D-03:** Explicit Start (▶), not lazy click. Clicking a dormant row selects/views it only (shows its idle card). A ▶ Start control on the row AND a context-menu "Start" item spawn a fresh shell in the saved `cwd`/`shell`. Label is **"Start" when `not_started`**, **"Restart"** once the session has run (reuse the existing spawn/restart paths).
- **D-04:** Idle pane = a session card. For a selected-but-not-started session the terminal area shows a placeholder card: identity (icon + name + status) + saved `cwd`, `shell`, and `startupCommand` (read-only, displayed — NOT executed) + a ▶ Start button. The real xterm surface appears only once started.

**Shell discovery (SC4)**
- **D-05:** Shell field becomes a dropdown — dropdown ONLY (no free-text). Replaces Phase 4's free-text editable path. Safety rule: the dropdown MUST always include the resolved default `$SHELL` even if discovery doesn't otherwise surface it, so the selector is never empty/unusable.
- **D-06:** macOS list = read `/etc/shells` + always include `$SHELL`. Use the OS's own registry of valid login shells. No hardcoded absolute paths — survives Homebrew/MacPorts/non-standard installs (SC4). Filter to entries that exist on disk; de-dupe.
- **D-07:** Build the platform-aware discovery seam now; macOS provider only this phase. Introduce a `ShellDiscovery` abstraction (interface) and fully implement + unit-test the macOS provider. Define the Windows provider's contract but leave its real enumeration (PowerShell/CMD/Git Bash/WSL) to Phase 8. SC4 is satisfied on macOS this phase; Windows is a clean drop-in.

**Ordering & reorder (NAV-04 / SC3)**
- **D-08:** Drag-to-reorder in the sidebar + persist the order. Persist `SessionRecord.order`; restore in that order.
- **D-09:** Restore focus = the FIRST session in saved order (show its idle card). `lastActive` is still persisted but is NOT the restore-focus driver (kept for possible future MRU use).

**First-run, empty state & new-session behavior**
- **D-10:** No-sessions state = welcome / empty state with a "Create a session" CTA. Applies to first-ever launch (no file) AND after the user closes every session. Nothing is auto-spawned. This REPLACES the current auto-add-one-default-session-on-empty boot behavior in `SessionManager.tsx`.
- **D-11:** New = live, restored = dormant. A session the user creates via "+"/the CTA starts live immediately (Phase 4 quick-add unchanged). Only sessions restored from disk start dormant (`not_started`).

**Persisted UI preferences (beyond session profiles)**
- **D-12:** Persist sidebar collapse state (Phase 4 D-11's deferred home) AND window size & position.

**Save timing / durability**
- **D-13:** Write on change, debounced (~300 ms), + a guaranteed final flush on app quit. Debounce coalesces bursts (notably drag-reorder, which fires many `order` updates); the quit flush guarantees durability. Survives crash/force-quit.

### Claude's Discretion

- **Storage engine + location:** lowdb (recommended in CLAUDE.md / research; not yet installed — add it) writing JSON under Electron's `app.getPath('userData')`. Exact filename/schema layout is planner/researcher's call. Local-only, no cloud (locked constraint).
- **Schema versioning / migration:** include a version field; how to migrate is discretion.
- **Corrupt / unreadable file handling:** back up the bad file and start fresh (never crash on a malformed store); surface nothing scarier than the empty state.
- **Where persistence lives:** main is the authoritative record store. The `SessionManager.tsx` reconcile poll was written to be replaced by the persisted snapshot — collapse/simplify it as appropriate.
- **Idle-card / empty-state / Start-control visual treatment** — from DESIGN.md tokens (warm "parlour" aesthetic). Whether the ▶ row control reuses the existing per-row control row or the context menu only.
- **Collapsed icon-rail drag-to-reorder behavior** — expanded-mode dragging with the rail reflecting saved order is acceptable; full collapsed DnD optional.
- **Bridge surface:** any new IPC for persistence/discovery extends the typed contextBridge in lockstep with `EXPECTED_API_KEYS` + `security.guard.test.ts`; never expose raw `ipcRenderer`.

### Deferred Ideas (OUT OF SCOPE)

- **TERM-05 — auto-run the stored startup command on start** → Phase 5.1 (its own next increment). Needs shell-ready-detection research. Phase 5's "Start" spawns a BARE shell in the saved cwd/shell.
- **Layer C — app-level agent conversation/state resume** → v2 / out of scope. Covered for power users via their own `claude --continue` startup command.
- **Windows shell discovery enumeration** (PowerShell/CMD/Git Bash/WSL) → Phase 8, built behind the `ShellDiscovery` seam created this phase.
- **`lastActive`-based MRU restore focus** — persisted but not the restore-focus driver (D-09 uses first-in-order). MRU could use it later.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PERS-01** | Save session metadata locally — session ID, name, icon, cwd, shell, startup command, display order, last active time | `SessionRecord` already carries all 8 fields and is JSON-serializable (`types.ts` L65–95). lowdb `Low<StoreSchema>` persists `listSessions()` output verbatim. See Standard Stack + Architecture Pattern 1. |
| **PERS-02** | On reopen, restore saved profiles (metadata only, not live processes) and let the user start them | Hydrate `PtyManager` record map from the store on `whenReady`, coercing every record to `not_started` + clearing `ptyPid` (D-01). The Start (▶) control (D-03) spawns via the existing `create()` path. See Pattern 1 + Pattern 4. |
| **NAV-04** | Remember and persist the user's session order in the sidebar | Persist `SessionRecord.order`; drag-to-reorder via `@dnd-kit/sortable`; restore rows sorted by `order`. See Pattern 5. |
| **SC4 (shell discovery)** | Shell selector populated with platform-available shells, no hardcoded paths | `ShellDiscovery` interface + macOS provider reading `/etc/shells` + `$SHELL`, filter-to-on-disk + de-dupe (D-06). New `discoverShells` IPC feeds the dropdown. See Pattern 2. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read/write the session store file | **Main** | — | Disk I/O + lowdb live in main only (renderer is sandboxed, `nodeIntegration:false`). Mirrors node-pty's main-only rule. |
| Coerce restored records → `not_started`, clear `ptyPid` (D-01) | **Main** | — | Main is the authoritative record store (Phase 3 decision); the renderer never invents records. |
| Debounce + quit-flush write timing (D-13) | **Main** | — | The lifecycle hooks (`before-quit`) and the record store both live in main. |
| Shell discovery (`/etc/shells`, `$SHELL`, on-disk filter) | **Main** | — | Filesystem reads; renderer cannot touch `fs`. Exposed via a `discoverShells` IPC. |
| Window bounds + collapse-state read/write | **Main** | Renderer (collapse toggle origin) | `BrowserWindow.getBounds()`/`setBounds()` are main-only APIs; collapse state is a renderer UI value mirrored to main for persistence. |
| Drag-to-reorder interaction + idle card + empty state | **Renderer** | Main (persists the new order) | Pure UI; the renderer computes the new `order` and sends it to main, which persists it. |
| Start (▶) / Restart control wiring | **Renderer** | Main (`create`/`restart`) | UI affordance; the actual spawn is the existing main-side path. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lowdb` | 7.0.1 | JSON file persistence for the session store + UI prefs | CLAUDE.md-locked discretion choice. 4.7M weekly downloads, 8-yr-old package, maintainer `typicode` (same as `json-server`). Type-safe `Low<Schema>`, atomic writes via `steno`. **ESM-only** — see Pitfall 1. `[VERIFIED: npm registry]` (slopcheck OK) + `[CITED: github.com/typicode/lowdb]` |
| `steno` | 4.0.2 (transitive, via lowdb) | Atomic + throttled file writes underneath lowdb | lowdb's own dependency; gives crash-safe atomic rename writes for free (do NOT hand-roll). 4.7M weekly downloads. `[VERIFIED: npm registry]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@dnd-kit/core` | 6.3.1 | Pointer/keyboard drag-and-drop primitives | For drag-to-reorder (D-08). Accessible (keyboard reorder), small, React-19 compatible, no legacy `react-dnd` HTML5-backend friction. `[ASSUMED]` (slopcheck OK, but discovered via training/ecosystem knowledge — confirm before install) |
| `@dnd-kit/sortable` | 10.0.0 | Sortable-list preset built on `@dnd-kit/core` | The actual sidebar-list reorder. `useSortable` + `SortableContext` + `arrayMove`. `[ASSUMED]` (slopcheck OK — confirm before install) |
| `electron-window-state` | 5.0.3 | Persist + restore `BrowserWindow` bounds, with multi-display off-screen validation | OPTIONAL for D-12 window-bounds. Handles the "don't restore off-screen" edge case (Pitfall 5) for free. Alternative: hand-roll bounds in the same lowdb store (also fine — see Alternatives). `[ASSUMED]` (slopcheck OK — confirm before install) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `lowdb` | `electron-store` | Explicitly forbidden by CLAUDE.md "What NOT to use" (unmaintained). Do not use. |
| `lowdb` | Plain `fs.writeFileSync(JSON.stringify(...))` | Avoids the ESM-in-CJS problem entirely and is genuinely viable for ~50 records — but loses steno's atomic writes (partial-write corruption on crash) and the type-safe `Low<Schema>` model. CONTEXT.md discretion picked lowdb; honor it, but the planner should note this as the fallback if the dynamic-import path proves fragile in the packaged app (Pitfall 1). |
| `@dnd-kit/sortable` | Native HTML5 drag-and-drop (`draggable`, `onDragStart/Over/Drop`) | Zero dependency, but notoriously fiddly (drag-image ghosting, `dragover.preventDefault()` gotchas, no keyboard a11y, poor touch). For a small vertical list dnd-kit is lighter to *reason about* and gives keyboard reorder. Native DnD is the fallback if avoiding a new dependency is preferred. |
| `@dnd-kit/sortable` | `react-dnd` + HTML5 backend | Heavier, React-19 peer-dep friction, more boilerplate. dnd-kit is the current ecosystem default for sortable lists. |
| `electron-window-state` | Hand-rolled bounds in the lowdb store | Hand-rolling is ~30 lines (save `getBounds()` on `close`/`moved`/`resized`, validate against `screen.getAllDisplays()` on restore). Keeps everything in ONE store file and avoids a second dependency + its own JSON file. Recommended IF the planner wants a single source of truth; use the library if the off-screen validation logic is deemed risky to hand-roll. |

**Installation:**
```bash
npm install lowdb@7.0.1 @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0
# Optional (only if NOT hand-rolling window bounds):
npm install electron-window-state@5.0.3
```

**Version verification (run 2026-06-06):**
- `npm view lowdb version` → `7.0.1` (latest; `type: module`; `exports."."` → `./lib/index.js`, `exports."./node"` → `./lib/node.js`; **no CJS entry**; `engines.node >=18`; dep `steno@^4.0.2`)
- `npm view @dnd-kit/core version` → `6.3.1`
- `npm view @dnd-kit/sortable version` → `10.0.0`
- `npm view electron-window-state version` → `5.0.3`

## Package Legitimacy Audit

slopcheck was available and run on all candidates. NOTE: slopcheck's `install` subcommand *physically wrote* the packages to `package.json`/`package-lock.json` and `node_modules` during the check — this was **reverted** (`git checkout -- package.json package-lock.json` + removed the stray dirs) so research left the repo clean. The planner's install task installs them for real.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `lowdb` | npm | ~12 yrs (created 2014-04-02) | 4.7M/wk | github.com/typicode/lowdb | [OK] | Approved (CLAUDE.md-locked) — no `postinstall` script |
| `steno` | npm | mature (lowdb's dep) | 4.7M/wk | github.com/typicode/steno | [OK] (transitive) | Approved (pulled in by lowdb) |
| `@dnd-kit/core` | npm | mature | high | github.com/clauderic/dnd-kit | [OK] | Approved — planner should gate behind a verify checkpoint (tagged `[ASSUMED]`, see note) |
| `@dnd-kit/sortable` | npm | mature | high | github.com/clauderic/dnd-kit | [OK] | Approved — gate behind verify checkpoint |
| `electron-window-state` | npm | mature | moderate | github.com/mawie81/electron-window-state | [OK] | Approved IF used — gate behind verify checkpoint |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*lowdb is the only `[VERIFIED: npm registry]` package (CLAUDE.md-locked AND slopcheck OK AND repo confirmed). The dnd-kit packages and electron-window-state were discovered via ecosystem/training knowledge and are tagged `[ASSUMED]` per the package-name provenance rule — the planner should place each behind a `checkpoint:human-verify` before the install task, or have the user confirm the dnd library choice (see Assumptions Log A1/A2).*

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────── MAIN PROCESS ───────────────────────────┐
app launch                │                                                                     │
  │                       │   app.whenReady()                                                   │
  ▼                       │      │                                                              │
whenReady ────────────────┼──────┼──► SessionStore.load()                                       │
                          │      │       │  dynamic import('lowdb/node')                         │
                          │      │       │  read userData/just-wrapper-store.json                │
                          │      │       │  ├─ parse OK ─────► coerce each record → not_started, │
                          │      │       │  │                  clear ptyPid (D-01)               │
                          │      │       │  └─ parse FAIL ──► back up .corrupt, start fresh      │
                          │      │       ▼                                                       │
                          │      │   PtyManager.hydrate(records)  ◄── records sorted by `order`  │
                          │      │       (record map populated; NO pty.spawn — dormant)          │
                          │      ▼                                                                │
                          │   createWindow()                                                     │
                          │      restore bounds (validate on-screen) ─── from store (D-12)        │
                          │      win.show()                                                       │
                          └──────┬───────────────────────────────────────────────────────────┬──┘
                                 │  IPC (contextBridge — never raw ipcRenderer)                │
   ┌─────────────────────────────▼─────────────────────────────┐                              │
   │                      RENDERER (sandboxed)                  │                              │
   │  boot: window.api.listSessions() ──► one-shot snapshot     │                              │
   │        (NO reconcile poll — D / discretion: poll removed)  │                              │
   │  ├─ sessions.length === 0 ──► Welcome / empty state (D-10) │                              │
   │  └─ else ──► render rows sorted by order; focus first (D-9)│                              │
   │              dormant rows show Idle Card (D-04) until ▶    │                              │
   │                                                            │                              │
   │  user action ──► window.api.* ─────────────────────────────┼──► PtyManager mutates record │
   │   • drag-reorder ─► persistOrder([{id,order}])              │     │                        │
   │   • Start ▶ ──────► ptyCreate({id, cwd, shell}) (existing)  │     ▼                        │
   │   • edit/close ───► existing ptyUpdateProfile / ptyClose    │   SessionStore.scheduleSave()│
   │   • shell dropdown ─► discoverShells() ────────────────────┼──► ShellDiscovery.discover()  │
   │                                                            │     (macOS provider this phase│
   └────────────────────────────────────────────────────────────┘     Windows stub for Phase 8)│
                                                                                                 │
   on any record mutation ──► debounced ~300ms write ──► steno atomic write to JSON              │
   app before-quit ──► event.preventDefault() once ──► await flush ──► app.quit() (D-13)         │
```

### Recommended Project Structure
```
src/main/
├── session-store.ts       # NEW: SessionStore class — owns lowdb Low<Schema>, load/hydrate,
│                          #      scheduleSave (debounced), flush (quit). Dynamic import of lowdb.
├── store-schema.ts        # NEW: StoreSchema type + SCHEMA_VERSION + coerceOnLoad() pure helper
│                          #      (electron-free → unit-testable: coerces records → not_started).
├── shell-discovery.ts     # NEW: ShellDiscovery interface + MacShellProvider (impl) +
│                          #      WindowsShellProvider (stub) + selectProvider(platform).
│                          #      Pure parsing helpers (parse /etc/shells, merge $SHELL, filter,
│                          #      de-dupe) kept electron-free for Vitest (mirror shell-resolver.ts).
├── shell-resolver.ts      # KEEP: resolveShell() stays as the always-included $SHELL fallback (D-05)
├── window-bounds.ts       # NEW (if hand-rolling D-12): validateBounds() pure helper (on-screen check)
├── pty-manager.ts         # EXTEND: + hydrate(records) (dormant), + emit a change signal the store
│                          #         subscribes to; create() already honors stored cwd/shell.
├── window-config.ts       # EXTEND: EXPECTED_API_KEYS += 3 new keys
└── index.ts               # WIRE: whenReady → store.load → hydrate → createWindow(restore bounds);
                           #       before-quit → flush; register new IPC handlers

src/shared/
├── types.ts               # EXTEND (optional): StoreSchema/version wrapper if defined in shared
└── api-types.ts           # EXTEND: 3 new ElectronAPI methods

src/preload/index.ts       # EXTEND: 3 new bridge methods
src/renderer/
├── SessionManager.tsx     # EXTEND: replace boot auto-add w/ empty state; remove reconcile poll;
│                          #         one-shot snapshot load; sort by order; Start wiring; reorder.
├── Sidebar.tsx            # EXTEND: drag-to-reorder (dnd-kit); Start/Restart label; collapse persist.
├── SessionEditModal.tsx   # EXTEND: shell free-text input → discovered <select> dropdown (D-05).
├── IdleCard.tsx           # NEW: idle-pane session card (D-04).
└── WelcomeEmptyState.tsx  # NEW: no-sessions CTA (D-10).
```

### Pattern 1: lowdb-in-CJS-main via dynamic import (the load-bearing pattern)
**What:** lowdb@7 is pure ESM; the main bundle is CJS. Load it with a dynamic `import()` that the bundler must preserve (not transpile to `require`), and mark lowdb `external` so Rollup leaves it in `node_modules` to be imported at runtime.
**When to use:** The `SessionStore.load()` path — once, on first access.
**Example:**
```typescript
// src/main/session-store.ts — Source: github.com/typicode/lowdb (Node API) + verified ESM exports
// lowdb is marked `external` in vite.main.config.ts (alongside node-pty) so this
// dynamic import resolves the real ESM package at runtime instead of being bundled.
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { SessionRecord } from '../shared/types';
import { coerceOnLoad, SCHEMA_VERSION, type StoreSchema } from './store-schema';

// Lazy-typed handle — we cannot statically `import { Low } from 'lowdb'` (ERR_REQUIRE_ESM).
type LowApi<T> = { data: T; read(): Promise<void>; write(): Promise<void> };

export class SessionStore {
  private db!: LowApi<StoreSchema>;
  private file = path.join(app.getPath('userData'), 'just-wrapper-store.json');

  async load(): Promise<StoreSchema> {
    // Dynamic import — Vite/Rollup MUST keep this as import(), not down-level to require().
    const { Low } = await import('lowdb');
    const { JSONFile } = await import('lowdb/node');
    const defaultData: StoreSchema = { version: SCHEMA_VERSION, sessions: [], ui: {} };
    this.db = new Low<StoreSchema>(new JSONFile(this.file), defaultData) as unknown as LowApi<StoreSchema>;
    try {
      await this.db.read();              // sets db.data (or leaves defaultData if file absent)
    } catch {
      this.backupCorrupt();              // back up the bad file, start fresh (D-13 / discretion)
      this.db.data = defaultData;
      await this.db.write();
    }
    // D-01: never trust persisted status/PID — coerce on the way in.
    this.db.data.sessions = this.db.data.sessions.map(coerceOnLoad);
    return this.db.data;
  }

  private backupCorrupt(): void {
    try {
      if (fs.existsSync(this.file)) {
        fs.renameSync(this.file, `${this.file}.corrupt-${Date.now()}`);
      }
    } catch { /* never crash on backup failure */ }
  }
}
```

```typescript
// src/main/store-schema.ts — electron-free → Vitest can import it directly (mirrors window-config.ts)
import type { SessionRecord } from '../shared/types';

export const SCHEMA_VERSION = 1 as const;

export interface StoreSchema {
  version: number;
  sessions: SessionRecord[];
  ui: { collapsed?: boolean; bounds?: { x: number; y: number; width: number; height: number } };
}

/** D-01: every restored record loads dormant — status not_started, ptyPid cleared. PURE + unit-tested. */
export function coerceOnLoad(rec: SessionRecord): SessionRecord {
  return { ...rec, status: 'not_started', ptyPid: undefined };
}
```

> **Verification note for the planner:** `await import('lowdb')` works in a CJS module *only if the bundler does not rewrite it to `require()`*. With lowdb marked `external` in `vite.main.config.ts`, Rollup leaves `import()` intact and it resolves the ESM package at runtime. This MUST be smoke-tested in the actually-built app (`npm start`), not just unit-tested — a unit test runs under Vitest's ESM loader where `import('lowdb')` always works, hiding a packaged-app `require`-rewrite regression.

### Pattern 2: ShellDiscovery seam (interface + macOS provider + Windows stub)
**What:** A platform-aware interface so the Windows enumeration is a clean Phase-8 drop-in (D-07). The macOS provider reads `/etc/shells`, merges the resolved `$SHELL`, filters to on-disk entries, de-dupes.
**When to use:** The `discoverShells` IPC handler picks the provider for `process.platform`.
**Example:**
```typescript
// src/main/shell-discovery.ts — Source: macOS /etc/shells convention + D-06; resolveShell() reused
import fs from 'node:fs';
import { resolveShell } from './shell-resolver';

export interface DiscoveredShell { path: string; label: string; }  // label = basename for the dropdown
export interface ShellDiscovery { discover(): DiscoveredShell[]; }

/** PURE — parse /etc/shells contents (comments/blank lines stripped). Unit-tested with fixture text. */
export function parseEtcShells(contents: string): string[] {
  return contents
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

/** PURE — merge $SHELL (D-05 safety), filter to on-disk (existsFn injected for testability), de-dupe. */
export function buildShellList(
  etcShellPaths: string[],
  resolvedShell: string,
  existsFn: (p: string) => boolean,
): DiscoveredShell[] {
  const merged = [resolvedShell, ...etcShellPaths];          // $SHELL ALWAYS first (D-05)
  const seen = new Set<string>();
  const out: DiscoveredShell[] = [];
  for (const p of merged) {
    if (!p || seen.has(p) || !existsFn(p)) continue;          // de-dupe + on-disk filter (D-06)
    seen.add(p);
    out.push({ path: p, label: p.split('/').pop() ?? p });
  }
  return out;
}

export class MacShellProvider implements ShellDiscovery {
  discover(): DiscoveredShell[] {
    let etc = '';
    try { etc = fs.readFileSync('/etc/shells', 'utf8'); } catch { /* fall back to $SHELL only */ }
    const resolved = resolveShell().shell;                    // the always-included fallback (D-05)
    return buildShellList(parseEtcShells(etc), resolved, (p) => fs.existsSync(p));
  }
}

/** Windows enumeration (PowerShell/CMD/Git Bash/WSL) lands in Phase 8 (D-07). Contract defined now. */
export class WindowsShellProvider implements ShellDiscovery {
  discover(): DiscoveredShell[] {
    // Phase 8: enumerate PowerShell/CMD/Git Bash/WSL. For now return the resolved default so the
    // dropdown is never empty (D-05 safety rule still holds cross-platform).
    const resolved = resolveShell().shell;
    return resolved ? [{ path: resolved, label: resolved.split(/[\\/]/).pop() ?? resolved }] : [];
  }
}

export function selectShellProvider(platform: NodeJS.Platform): ShellDiscovery {
  return platform === 'win32' ? new WindowsShellProvider() : new MacShellProvider();
}
```

### Pattern 3: Debounced write + guaranteed quit flush (D-13)
**What:** Coalesce burst writes (drag-reorder fires many `order` updates) on a ~300ms trailing timer, but guarantee the trailing write lands before the app exits.
**When to use:** Every record mutation calls `scheduleSave()`; `before-quit` calls `flush()`.
**Example:**
```typescript
// inside SessionStore — Source: Electron before-quit semantics + lowdb write API
private saveTimer: NodeJS.Timeout | null = null;
private dirty = false;
private quitting = false;

scheduleSave(): void {
  this.dirty = true;
  if (this.saveTimer) clearTimeout(this.saveTimer);
  this.saveTimer = setTimeout(() => { void this.flush(); }, 300);   // D-13 debounce
}

async flush(): Promise<void> {
  if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
  if (!this.dirty) return;
  this.dirty = false;
  await this.db.write();   // steno does an atomic rename write under the hood
}
```
```typescript
// src/main/index.ts — quit flush. before-quit can fire multiple times; guard re-entrancy.
let quitting = false;
app.on('before-quit', (event) => {
  if (quitting) return;            // second pass: let the quit proceed
  if (store.isDirty()) {           // only block if there is a pending trailing write
    event.preventDefault();        // hold the quit while we flush
    quitting = true;
    void store.flush().finally(() => app.quit());   // re-issue quit after the write lands
  }
  // existing PTY teardown stays (ptyManager.disposeAll / unregisterIpc)
});
```
**Anti-pattern:** Doing `db.write()` synchronously on every keystroke-level mutation — lowdb rewrites the WHOLE file each time (write storm during a drag). And: a fire-and-forget async write inside `before-quit` with no `preventDefault()` — the process exits before the write resolves, losing the trailing debounced update (the exact D-13 failure mode).

### Pattern 4: Boot hydration without spawning (D-01 / PERS-02)
**What:** `PtyManager` gets a `hydrate(records)` method that populates its record map as dormant — record present, no `pty` handle, status `not_started`. `listSessions()` then returns these so the renderer's one-shot snapshot load renders dormant rows. The existing `create()` (Start ▶) is unchanged and spawns on demand.
**When to use:** `whenReady` → `store.load()` → `ptyManager.hydrate(store.sessions)` → `createWindow()`.
**Key detail:** `PtySession` currently REQUIRES a live `pty: IPty`. Hydration introduces a record-without-a-pty. Two viable shapes (planner's call): (a) make `pty?` optional and `alive` start false, or (b) keep a separate `dormantRecords: Map<LogicalId, SessionRecord>` that `listSessions()` merges and that `create({id})` promotes into a live `PtySession`. Option (b) keeps the live-session invariant ("every `PtySession` has a real pty") intact and is lower-risk — recommended.

### Pattern 5: Drag-to-reorder → persist order (D-08 / NAV-04)
**What:** `@dnd-kit/sortable` wraps the sidebar rows; on drop, compute the new ordered id list, write `order` back onto each record, send to main via a new `persistOrder` IPC.
**Example sketch:**
```tsx
// Sidebar.tsx — Source: dnd-kit sortable preset (useSortable + SortableContext + arrayMove)
// onDragEnd → arrayMove(sessions, oldIndex, newIndex) → reindex order → onReorder(ids)
// SessionManager maps the reordered ids to {logicalId, order} and calls window.api.persistOrder(...)
// which lands in PtyManager.setOrder() → store.scheduleSave().
```
The renderer sorts `sessions` by `order` for render; reorder mutates `order` locally (optimistic) AND notifies main. Collapsed-rail DnD is optional (D-08 discretion) — expanded-mode dragging with the rail reflecting saved order satisfies SC3.

### Pattern 6: contextBridge lockstep extension (3 new keys)
**What:** Each new IPC method is added to FIVE places in one atomic change, asserted by `security.guard.test.ts`. New keys needed:
| New key | Shape | Mirrors existing | Channel |
|---------|-------|------------------|---------|
| `discoverShells` | `() => Promise<DiscoveredShell[]>` | `listSessions` (invoke) | `shell:discover` |
| `persistOrder` | `(orders: {id: LogicalId; order: number}[]) => void` | `ptyUpdateProfile` (fire-and-forget send) | `store:persist-order` |
| `persistUiState` | `(ui: {collapsed?: boolean; bounds?: ...}) => void` | `ptyUpdateProfile` (send) | `store:persist-ui` |

(Start ▶ reuses the EXISTING `ptyCreate`/`ptyRestart` — no new key. Window-bounds save is main-driven on `close`/`moved`, so it may not even need a renderer IPC; collapse state does need `persistUiState`.) The five edit points: `api-types.ts` (`ElectronAPI`), `window-config.ts` (`EXPECTED_API_KEYS`), `preload/index.ts` (impl), `pty-manager.ts`-or-new-handler-module (`PTY_CHANNELS` + `ipcMain` handler), and the guard test goes green only when all match. **The guard test currently asserts an EXACT 15-key set — it will go RED the moment you add keys to `EXPECTED_API_KEYS`, and GREEN again only when the preload exposes exactly the new set.** This is intended (Wave-0 RED).

### Anti-Patterns to Avoid
- **Static `import` of lowdb in main.** Transpiles to `require('lowdb')` → `ERR_REQUIRE_ESM` at runtime. Use dynamic `import()` + `external`.
- **Trusting persisted `status`/`ptyPid` on load.** Violates D-01/SC2. Always coerce to `not_started` + clear pid.
- **Auto-spawning on boot.** The current `SessionManager.tsx` boot effect auto-adds a default session when empty — D-10 REPLACES this with the welcome/empty state. Remove the auto-add.
- **Keeping the 100ms reconcile poll.** It exists to bridge a not-yet-built persisted snapshot. D / discretion says collapse it to a one-shot snapshot load. Leaving the poll wastes cycles and can fight the persisted order.
- **Synchronous per-mutation `db.write()`.** Write storm during drag-reorder (rewrites whole file per `order` change). Debounce.
- **`before-quit` async write without `preventDefault()`.** Loses the trailing write (D-13 failure mode).
- **Hardcoded shell absolute paths.** Violates D-06/SC4. Read `/etc/shells` + `$SHELL`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic crash-safe file write | A `writeFileSync(tmp)` + `rename` dance | lowdb's built-in `steno` adapter (free, transitive) | steno handles the temp-file + atomic-rename + write-coalescing; hand-rolling risks partial writes that corrupt the store on crash. |
| JSON store with type-safe schema + defaults | Manual `JSON.parse`/`stringify` + migration glue | lowdb `Low<StoreSchema>` | Typed `db.data`, default-data merge, read/write API. CONTEXT.md-locked. |
| Drag-and-drop list reorder | Native HTML5 DnD event soup | `@dnd-kit/sortable` | Drag-image, keyboard a11y, and `arrayMove` are solved; native DnD is famously gotcha-laden. (Native DnD is an acceptable zero-dep fallback if avoiding the dep — see Alternatives.) |
| Off-screen window-bounds validation | — | `electron-window-state` OR a ~30-line `validateBounds()` against `screen.getAllDisplays()` | Restoring a window onto a now-disconnected monitor leaves it invisible (Pitfall 5). The validation is small but easy to forget — either library or a tested pure helper is fine. |

**Key insight:** The only thing genuinely worth a dependency here is lowdb (locked) + steno (free). Everything else (window bounds, even reorder) is hand-rollable; the planner should weigh "one more dependency" against the dnd-kit a11y/UX win, which is real for a draggable list.

## Common Pitfalls

### Pitfall 1: lowdb ESM-only collides with the CJS main bundle
**What goes wrong:** `import { JSONFilePreset } from 'lowdb/node'` (static) becomes `require('lowdb/node')` after Vite/tsc CJS transpile → `Error [ERR_REQUIRE_ESM]: require() of ES Module …`. App crashes on first store access.
**Why it happens:** lowdb@7.0.1 is `"type": "module"` with no CJS export (VERIFIED via `npm view`). `vite.main.config.ts` forces `formats: ['cjs']` and tsconfig `module: commonjs` — both DELIBERATE (node-pty must `require()`).
**How to avoid:** (1) Dynamic `await import('lowdb')` / `import('lowdb/node')`. (2) Add `'lowdb'` to `rollupOptions.external` in `vite.main.config.ts` (next to `'electron', 'node-pty'`) so it's not bundled and the runtime ESM resolution works. (3) Smoke-test in the BUILT app, not just Vitest. (4) If the packaged app still fights it, the documented fallback is plain `fs` + JSON (Alternatives table) — note this for the planner.
**Warning signs:** Works in `vitest run` (ESM loader) but throws on `npm start`; `ERR_REQUIRE_ESM` in the main-process console.

### Pitfall 2: lowdb not unpacked / pruned in the packaged app (Phase 8 risk, surfaces here)
**What goes wrong:** `forge.config.ts` `packagerConfig.ignore` currently keeps ONLY `/.vite` and `node-pty`, pruning all other `node_modules`. A lowdb marked `external` won't be bundled into `.vite` — so the packaged app would `MODULE_NOT_FOUND` lowdb at runtime.
**Why it happens:** The Vite-plugin default prunes node_modules; node-pty is explicitly re-included. lowdb (and steno) would be pruned too.
**How to avoid:** Either (a) extend the `ignore` allow-list to keep `node_modules/lowdb` + `node_modules/steno`, OR (b) do NOT mark lowdb external and instead let Vite bundle it (possible since lowdb is pure ESM and Rollup can bundle ESM into the CJS output — but verify node-pty's `external` still works and that steno's internals bundle cleanly). Option (a) is the lower-risk mirror of the existing node-pty handling. **This primarily bites at Phase 8 packaging, but the planner should decide the strategy NOW so dev (`npm start`, which runs unbundled from node_modules) and packaged builds agree.**
**Warning signs:** `npm start` works (resolves from real node_modules) but `npm run make` output throws `Cannot find module 'lowdb'`.

### Pitfall 3: `app.getPath('userData')` called before `whenReady`
**What goes wrong:** `app.getPath('userData')` returns the correct profile dir only after the app is ready; calling it at module top-level can throw or return a wrong path.
**How to avoid:** Resolve the store path inside `load()` (called from `whenReady`), not in a module-scope constant. The `SessionStore` in Pattern 1 computes `this.file` in the constructor — construct it inside `whenReady`, or lazily compute the path in `load()`.
**Warning signs:** Store written to an unexpected directory; path errors on launch.

### Pitfall 4: Restored record has no live PTY but code assumes `session.pty` exists
**What goes wrong:** `PtyManager` methods (`write`, `resize`, `stop`, `listSessions` map) assume each `PtySession` has a live `pty`. A hydrated dormant record breaks this.
**How to avoid:** Use the separate-dormant-map approach (Pattern 4 option b): `listSessions()` returns `[...liveRecords, ...dormantRecords]`; `create({id})` for a dormant id moves it from the dormant map into a live `PtySession`. Keeps the "live session always has a pty" invariant.
**Warning signs:** `Cannot read properties of undefined (reading 'write')` when interacting with a not-yet-started session.

### Pitfall 5: Window restored off-screen
**What goes wrong:** Saved bounds point at a monitor that's no longer connected → window opens invisibly off-screen.
**How to avoid:** Before `setBounds`/window creation, validate saved bounds intersect a current display (`screen.getAllDisplays()` work areas); if not, fall back to defaults/centered. `electron-window-state` does this; a hand-rolled `validateBounds()` is ~30 lines and unit-testable. Restore bounds BEFORE `win.show()` to avoid a visible jump.
**Warning signs:** App "won't open" after unplugging an external monitor.

### Pitfall 6: `order` collisions / gaps after close
**What goes wrong:** Closing a middle session leaves an `order` gap; a naive `this.sessions.size` for new-session order (current `create()` uses `opts.order ?? prior?.order ?? this.sessions.size`) can collide with a restored record's order.
**How to avoid:** On reorder, reindex `order` densely (0..n-1). On new-session create, assign `order = max(existing.order) + 1`. Sort by `order` for render; treat `order` as a sort key, not a slot index.
**Warning signs:** Two rows with the same `order`; unstable sidebar ordering after add/close cycles.

## Code Examples

(See Patterns 1–6 above — all examples are inline there with sources. Key verified API anchors:)

### lowdb v7 Node API (verified)
```javascript
// Source: github.com/typicode/lowdb (Node API section)
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
const db = new Low(new JSONFile('file.json'), defaultData)  // defaultData merged when file absent
await db.read()    // sets db.data
await db.write()   // atomic write via steno
// or the preset:
import { JSONFilePreset } from 'lowdb/node'
const db = await JSONFilePreset('db.json', { sessions: [] })
```
(In our CJS main these become `await import('lowdb')` / `await import('lowdb/node')` — Pattern 1.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `electron-store` for app config | `lowdb` v7 (typed, ESM) | electron-store maintenance lapsed (CLAUDE.md) | Forbidden by CLAUDE.md; lowdb chosen |
| lowdb v1–v3 (CJS, lodash-based chaining) | lowdb v7 (ESM-only, plain `db.data` + adapters) | v3→v4+ rewrite | The CJS chaining API is gone; v7 is pure ESM — root cause of Pitfall 1 |
| `react-dnd` + HTML5 backend | `@dnd-kit` | ~2021 onward | dnd-kit is the current accessible-sortable default |

**Deprecated/outdated:**
- lowdb's old `db.get('x').push().write()` lodash chaining — gone in v7. Use `db.data.x.push(...)` then `await db.write()`.
- Any tutorial showing `require('lowdb')` — that's v1–v3 era; v7 is ESM-only.

## Runtime State Inventory

> Phase 5 INTRODUCES persistent state rather than renaming existing state, but the planner must know what already exists on disk and what the new file looks like.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None yet** — no store file exists today (`lowdb` not installed; `uuid` is). This phase CREATES `app.getPath('userData')/just-wrapper-store.json`. On macOS that resolves to `~/Library/Application Support/Just-Wrapper/` (from `productName: "Just-Wrapper"`). | Define schema + version field; corrupt-file backup path. New file only — no migration of existing data. |
| Live service config | None — local-only app, no external services (locked constraint). | None. |
| OS-registered state | None — no OS task/daemon registration in this app. | None. |
| Secrets/env vars | None new. `$SHELL` is READ for discovery (D-05/06) but not stored as a secret. | None. |
| Build artifacts | `forge.config.ts` `packagerConfig.ignore` prunes node_modules except `/.vite` + `node-pty`. Adding lowdb (external) means lowdb+steno must be added to the keep-list OR bundled (Pitfall 2). | Decide bundle-vs-external strategy now; update `ignore` allow-list or `vite.main.config.ts` external accordingly. |

**Verified:** the only persistent state is the NEW JSON store this phase introduces. No pre-existing on-disk state to migrate.

## Common Pitfalls Recap → Validation linkage

(Each pitfall has a corresponding test in Validation Architecture below: Pitfall 1→runtime smoke, Pitfall 4→hydrate-no-spawn test, Pitfall 5→validateBounds unit test, Pitfall 6→order round-trip test, D-01→coerceOnLoad unit test.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@dnd-kit/sortable` + `@dnd-kit/core` are the right reorder choice (vs native HTML5 DnD) | Standard Stack / Pattern 5 | Adds 2 deps; if user prefers zero-dep, native HTML5 DnD is the documented fallback. Low risk — both work; this is a UX/dep-count tradeoff the user may want to weigh. |
| A2 | `electron-window-state` for D-12 bounds (vs hand-rolling) | Standard Stack / Don't Hand-Roll | Adds a dep + a 2nd JSON file. Hand-rolling into the lowdb store keeps one source of truth. Genuinely a coin-flip — flag for user/planner preference. |
| A3 | Marking lowdb `external` (mirror node-pty) is the right bundling strategy vs letting Vite bundle the pure-ESM package | Pattern 1 / Pitfall 2 | If external, the Forge `ignore` allow-list must include lowdb+steno or packaging breaks (Phase 8). Bundling avoids the keep-list edit but must be verified not to break the CJS output. Medium risk — verify in built app. |
| A4 | Dynamic `import()` survives Vite/Rollup CJS transpile as a real runtime import | Pattern 1 | If Rollup down-levels `import()` to `require()`, the ESM load fails. Standard Rollup keeps dynamic import for externals, but MUST be smoke-tested in the built app, not just Vitest. HIGH attention item. |
| A5 | macOS store path is `~/Library/Application Support/Just-Wrapper/` | Runtime State Inventory | Derived from `productName`; if `app.getName()` differs, path differs. Low risk — `app.getPath('userData')` is authoritative at runtime regardless. |

## Open Questions

1. **Bundle vs external for lowdb in the packaged app.**
   - What we know: node-pty is external + re-included in Forge `ignore`. lowdb is pure ESM; Rollup *can* bundle ESM into CJS output.
   - What's unclear: whether bundling lowdb into the CJS main breaks (its dynamic `import('lowdb/node')` subpath, steno internals) vs. marking external + extending the keep-list.
   - Recommendation: Start with `external` + dynamic import (mirrors node-pty, lowest cognitive load), extend Forge `ignore` to keep `lowdb` + `steno`. Verify with `npm start` AND a `npm run make` packaging smoke before phase sign-off. If bundling proves cleaner, switch — but external is the safe default.

2. **Window bounds: library vs hand-roll (A2).** Recommend hand-roll a tested `validateBounds()` into the lowdb store to keep ONE store file, unless the planner/user wants the library's convenience. Either is fine for SC.

3. **Idle-card placement & Start-control surface (D-04 discretion).** Whether ▶ lives in the per-row control row (next to edit/close) or only the context menu. Recommendation: add ▶ to the row controls for `not_started`/non-running rows (reuse the existing `.row-controls` slot that already conditionally renders Restart ↻) — minimal new UI, and the label flips Start↔Restart per D-03. The idle card (D-04) is a new `IdleCard.tsx` rendered in `terminal-area` when the active session is dormant.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node ≥18 | lowdb engines | ✓ (Electron 36 bundles Node 20.x) | — | — |
| `/etc/shells` | macOS shell discovery (D-06) | ✓ (present on macOS) | — | If unreadable, fall back to `$SHELL` only (D-05 safety) — handled in `MacShellProvider` |
| `$SHELL` env var | D-05 safety entry | ✓ (set in interactive shells) | — | `resolveShell()` falls back to `/bin/zsh` (existing) |
| npm registry (install) | lowdb / dnd-kit install | ✓ | — | — |
| slopcheck | Package legitimacy gate | ✓ | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `/etc/shells` (falls back to `$SHELL`-only list).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (unit, Node env) + WebdriverIO 9.x (`@wdio/electron-service`) smoke |
| Config file | `vitest.config.ts` (Node env; includes `src/**/__tests__/**/*.test.ts` + `src/**/*.guard.test.ts`); `wdio.conf.ts` |
| Quick run command | `npm run test:unit` (`vitest run`) |
| Full suite command | `npm test` (`test:unit && test:smoke`) |

### Phase Requirements → Test Map
| Req / Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------------|----------|-----------|-------------------|-------------|
| D-01 / SC2 | `coerceOnLoad()` forces every record → `not_started`, clears `ptyPid` | unit (pure) | `vitest run src/main/__tests__/store-schema.test.ts` | ❌ Wave 0 |
| PERS-01 / PERS-02 | round-trip: write records → read back → all 8 fields intact | unit | `vitest run src/main/__tests__/session-store.test.ts` | ❌ Wave 0 |
| corrupt-file recovery (D-13/discretion) | malformed JSON → backs up `.corrupt-*`, starts fresh, never throws | unit (inject bad file) | `vitest run src/main/__tests__/session-store.test.ts` | ❌ Wave 0 |
| D-13 durability | `scheduleSave()` debounces; `flush()` writes the pending change; trailing write not lost | unit (fake timers) | `vitest run src/main/__tests__/session-store.test.ts` | ❌ Wave 0 |
| SC4 / D-06 | `parseEtcShells` strips comments/blanks; `buildShellList` includes `$SHELL`, filters on-disk, de-dupes | unit (pure, injected `existsFn`) | `vitest run src/main/__tests__/shell-discovery.test.ts` | ❌ Wave 0 |
| D-05 safety | dropdown list always contains resolved `$SHELL` even if `/etc/shells` empty/unreadable | unit | `vitest run src/main/__tests__/shell-discovery.test.ts` | ❌ Wave 0 |
| D-07 seam | `selectShellProvider('win32')` → WindowsShellProvider (non-empty, never throws) | unit | `vitest run src/main/__tests__/shell-discovery.test.ts` | ❌ Wave 0 |
| NAV-04 / SC3 / D-08 | `order` round-trips; reorder reindexes densely; sort-by-order stable across add/close (Pitfall 6) | unit (pure reorder reducer) | `vitest run src/renderer/__tests__/session-reorder.test.ts` | ❌ Wave 0 |
| D-12 | `validateBounds()` rejects off-screen bounds, accepts on-screen (Pitfall 5) | unit (mock displays) | `vitest run src/main/__tests__/window-bounds.test.ts` | ❌ Wave 0 |
| SC3 bridge | preload exposes EXACTLY the new `EXPECTED_API_KEYS` (15 + 3 = 18), no raw ipcRenderer | unit (existing guard) | `vitest run src/shared/__tests__/security.guard.test.ts` | ✅ exists (update keys) |
| **Pitfall 1 (load-bearing)** | lowdb dynamic `import()` actually loads in the BUILT app | smoke (WDIO) | `npm run test:smoke` — launch app, assert store file created + readable | ❌ Wave 0 (extend smoke) |
| SC1 / SC2 / D-09 / D-10 | reopen restores all profiles dormant; first-in-order focused; empty file → welcome state | smoke (WDIO) | `npm run test:smoke` | ❌ Wave 0 (extend smoke) |

### Sampling Rate
- **Per task commit:** `npm run test:unit` (fast, < a few seconds; all pure helpers)
- **Per wave merge:** `npm test` (unit + WDIO smoke) — the smoke run is the ONLY place Pitfall 1 (ESM-in-CJS at runtime) is caught.
- **Phase gate:** Full suite green + a manual reopen check (canonical scenario: `🛋️ Parlour Claude RC` reappears dormant after quit/reopen) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/main/__tests__/store-schema.test.ts` — covers D-01/SC2 (`coerceOnLoad`)
- [ ] `src/main/__tests__/session-store.test.ts` — covers PERS-01/02 round-trip, corrupt recovery, debounce/flush
- [ ] `src/main/__tests__/shell-discovery.test.ts` — covers SC4/D-05/D-06/D-07 (pure parse + build + provider select)
- [ ] `src/main/__tests__/window-bounds.test.ts` — covers D-12 off-screen validation (Pitfall 5)
- [ ] `src/renderer/__tests__/session-reorder.test.ts` — covers NAV-04/SC3/D-08 + Pitfall 6 dense reindex
- [ ] Extend `wdio.conf.ts` smoke spec — restore round-trip + the load-bearing lowdb-ESM-in-built-app check (Pitfall 1)
- [ ] Update `src/shared/__tests__/security.guard.test.ts` expectation when `EXPECTED_API_KEYS` grows by 3
- [ ] Framework install: none needed (Vitest + WDIO already configured)

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Persistence I/O confined to main; renderer stays sandboxed (`contextIsolation:true`, `nodeIntegration:false`, `sandbox:true` — unchanged). New IPC is narrow + typed, never raw `ipcRenderer`. |
| V5 Input Validation | yes | `persistOrder`/`persistUiState` payloads from the renderer MUST be validated main-side before being written to disk — mirror the existing `isStringData`/id-validation discipline in `pty-manager.ts` (type-guard `order` is a finite number, ids are known, bounds are finite). A forged payload must never write arbitrary data into the store. |
| V6 Cryptography | no | Local-only metadata, no secrets stored. `$SHELL` is read, not persisted as a secret. |
| V12 File / Resource | yes | Store path is FIXED to `app.getPath('userData')` — never derived from renderer input (prevents path traversal). Corrupt-file handling backs up rather than executing/parsing untrusted content as code. `/etc/shells` is read-only; entries are filtered through `fs.existsSync` and surfaced as label/path strings only (never executed except via the existing validated `create()` spawn path). |
| V14 Configuration | yes | No loosening of the locked webPreferences. The contextBridge surface stays exact-match-asserted by `security.guard.test.ts`. |

### Known Threat Patterns for Electron persistence + shell discovery

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Renderer sends forged `order`/`ui` payload to corrupt the store or write unbounded data | Tampering | Main-side type-guard + id-validation before write (V5); reuse the established validate-in-main pattern. |
| Persisted `shell` path points at an arbitrary executable on restore | Tampering / Elevation | Shell only spawns through the existing validated `create()` path; discovery filters to on-disk `/etc/shells` + `$SHELL` entries (D-06). The store is local + user-owned, so this is low-severity, but the dropdown-only field (D-05, no free-text) removes the renderer's ability to inject an arbitrary path. |
| Store path derived from untrusted input → path traversal | Tampering | Path is a fixed `app.getPath('userData')` join with a constant filename; never renderer-controlled (V12). |
| Corrupt/malicious store file crashes the app or is parsed as code | DoS | `JSON.parse` in try/catch → back up `.corrupt-*` + fresh store (never crash, never eval) — D-13/discretion. |
| Restoring a persisted `running`/`ptyPid` re-attaches to a stale/foreign PID | Tampering | D-01: never trust persisted status/PID; coerce to `not_started`, clear `ptyPid` on load. |

**security_block_on: high** — the highest-severity item is the renderer→main write-payload validation (V5/Tampering). The plan MUST include main-side validation tasks + tests for `persistOrder`/`persistUiState`, mirroring the existing `pty-manager.ts` validation discipline. No item rises to a blocking severity provided that validation is present.

## Sources

### Primary (HIGH confidence)
- `npm view lowdb@7.0.1` (version, `type: module`, `exports` map, no CJS entry, `engines.node>=18`, `dependencies.steno`, no postinstall, created 2014, maintainer typicode, 4.7M wk dl) — local tool, 2026-06-06
- `npm view @dnd-kit/core` (6.3.1), `@dnd-kit/sortable` (10.0.0), `electron-window-state` (5.0.3) — local tool, 2026-06-06
- `slopcheck install lowdb @dnd-kit/core @dnd-kit/sortable electron-window-state` → all [OK] — local tool, 2026-06-06
- github.com/typicode/lowdb — Node API (`Low`, `JSONFile`, `JSONFilePreset`, `db.read`/`write`, atomic writes, pure-ESM) — WebFetch 2026-06-06
- Repo source (read directly): `pty-manager.ts`, `index.ts`, `shell-resolver.ts`, `SessionManager.tsx`, `Sidebar.tsx`, `SessionView.tsx`, `SessionEditModal.tsx`, `api-types.ts`, `preload/index.ts`, `window-config.ts`, `security.guard.test.ts`, `types.ts`, `package.json`, `tsconfig.json`, `vite.main.config.ts`, `forge.config.ts`, `vitest.config.ts` — HIGH
- `.planning/phases/05-persistence-shell-discovery/05-CONTEXT.md` (D-01..D-13) — HIGH (authoritative contract)

### Secondary (MEDIUM confidence)
- `.planning/DESIGN.md` (parlour tokens, status ramps, idle/empty-state language) — MEDIUM (design intent)

### Tertiary (LOW confidence)
- dnd-kit as ecosystem-standard sortable choice — training/ecosystem knowledge, tagged `[ASSUMED]` (A1)
- `~/Library/Application Support/Just-Wrapper/` exact store path — derived from `productName`, authoritative path is `app.getPath('userData')` at runtime (A5)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — lowdb locked + verified on npm + docs; dnd-kit/window-state slopcheck OK but `[ASSUMED]` for the choice (not existence)
- Architecture: HIGH — all behavioral decisions locked in CONTEXT.md; codebase explicitly pre-shaped for this phase (reconcile poll, listSessions-as-source-of-truth)
- ESM-in-CJS risk (Pattern 1 / Pitfall 1): HIGH on the *diagnosis* (verified lowdb is ESM-only + main is CJS), MEDIUM on the *exact bundler behavior in the packaged app* (must smoke-test — A3/A4, Open Q1)
- Pitfalls: HIGH — derived from verified package facts + existing code invariants

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (stable stack; lowdb v7 unchanged since 2025-03; re-verify only if Electron/node-pty version bumps for Phase 8)
