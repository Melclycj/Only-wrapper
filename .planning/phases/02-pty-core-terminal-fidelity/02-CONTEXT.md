# Phase 2: PTY Core + Terminal Fidelity - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

A **single, real terminal session** with native fidelity: `node-pty` running in the **main** process streams to an `xterm.js` instance in the **renderer**, over the typed `contextBridge` seam established in Phase 1. The renderer — blank until now — becomes a full-window terminal pane.

This phase is the **Core Value proof**: a user can run `claude --rc`, `vim`, `python`, and `ssh` inside the session and they behave exactly like a native terminal (interactive prompts, full keyboard input, Ctrl+C/Ctrl+D, arrow-key history, copy/paste with bracketed paste, window resize → PTY resize, ANSI/truecolor, correct CJK/emoji cell widths, and responsive UI under 50 MB+ of output).

**Requirements covered:** TERM-01 (interactive terminal surface), TERM-02 (real PTY layer, not run→capture), TERM-03 (normal shell → manual `cd` → launch tools), TERM-04 (starts in configured initial working directory).

**Explicitly NOT in this phase:** multiple sessions, sidebar/tabs, session identity UI (name/icon), stop/restart controls and status lifecycle, configured startup commands, persistence, search, scrollback config UI, Windows-shell specifics, packaging. Those belong to Phases 3–8.

</domain>

<decisions>
## Implementation Decisions

### Shell & Environment Fidelity
- **D-01: Launch the user's `$SHELL` (fallback `/bin/zsh`) as a LOGIN + interactive shell.** Source order must include `.zprofile`/`.zlogin` AND `.zshrc` so PATH matches Terminal.app (Homebrew, nvm, asdf, etc. all resolve). **Inherit the full parent environment**, then set/override `TERM=xterm-256color` (and `COLORTERM=truecolor`). Rationale: the canonical `claude --rc` / `codex` scenario only works if those tools are found on PATH exactly as in the user's native terminal — this is the Core Value proof. *(Research/planner: confirm the correct cross-shell login+interactive invocation; zsh vs bash differ. The spawn layer must stay OS-agnostic per CLAUDE.md even though Phase 2 is macOS-first.)*

### Session Startup
- **D-02: Auto-start a single live shell on app launch** — no gating click — with cwd = the user's **home directory** (`~`). Rationale: one session this phase; the goal is to prove native fidelity immediately on boot. Stop/restart controls and the create-session form arrive in Phases 3/4. *(TERM-04's "configured working directory" defaults to home here because there is no creation UI yet.)*

### Copy / Paste & Selection
- **D-03: Standard macOS terminal copy/paste — Cmd+C / Cmd+V + right-click paste.** Cmd+C copies the current selection; Cmd+V pastes using **bracketed paste** so multi-line paste never auto-executes (SC2); right-click pastes. **Ctrl+C remains SIGINT** (distinct key — no conflict). **No copy-on-select** (least surprising; can become a later appearance/settings toggle).

### Terminal Buffer & Exit State
- **D-04: Default scrollback = 10,000 lines** (xterm `scrollback: 10000`). When the shell process exits, show a **passive "process exited" notice** in the pane — no auto-restart (stop/restart UI is Phase 3, TERM-07/08). The 50 MB-`cat` responsiveness criterion (SC5) is met via flow-control/backpressure, independent of buffer size.

### Claude's Discretion (guided by success criteria + CLAUDE.md)
- **Renderer:** single full-window xterm pane, default **monospace** font (configurable font is v2 / APPR-01), block cursor. No sidebar/header chrome (Phase 4).
- **xterm stack (per CLAUDE.md):** `@xterm/xterm` 5.5 + `addon-fit` (resize), `addon-webgl` (default renderer, `addon-canvas` fallback), `addon-web-links`, `addon-unicode11` (correct CJK/emoji cell widths — SC4).
- **IPC:** extend the typed `window.api` / `ElectronAPI` contextBridge surface with PTY channels (e.g. create / write / onData / resize / onExit) — never expose raw `ipcRenderer`. Channel naming and PTY-byte encoding (string vs binary-safe) → research/planner.
- **Resize:** debounce window resize → `addon-fit` → `pty.resize(cols, rows)` to land within the 1 s SC3 budget.
- **node-pty pin & packaging:** exact `node-pty` version against the Electron **36.9.5** ABI (compatibility matrix) and `.node` ASAR-unpack/`@electron/rebuild` → research must confirm (CLAUDE.md flags this tension).
- **Flow control (SC5):** xterm write-batching + node-pty pause/resume (or equivalent backpressure) so input stays responsive and no output is dropped → research/planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tech stack & build (authoritative)
- `CLAUDE.md` — Technology Stack table (node-pty; `@xterm/xterm` 5.5 + addons fit/webgl/canvas/web-links/unicode11), the **"Critical: node-pty Native Module Build Concerns"** section (ASAR unpack via `@electron-forge/plugin-auto-unpack-natives`, `@electron/rebuild`, Electron-version targeting, macOS forkpty notes), and **"What NOT to Use"** (no `child_process.exec` for sessions, no `node-pty` in renderer, no `.node` inside ASAR, no unscoped `xterm`). **MUST read before planning.**

### Project intent & requirements
- `.planning/PROJECT.md` — Core Value (real terminal fidelity), identity model, constraints (cross-platform, local-only).
- `.planning/REQUIREMENTS.md` §"Terminal Session" — TERM-01..TERM-04 (this phase) and TERM-05..TERM-12 (later phases — informs which controls are deliberately absent now).
- `.planning/ROADMAP.md` §"Phase 2: PTY Core + Terminal Fidelity" — goal + 5 success criteria (the fidelity bar to hit).

### Constraints inherited from Phase 1
- `.planning/phases/01-project-scaffold-dev-infrastructure/01-CONTEXT.md` §decisions — **D-06/D-07** (contextBridge is the only renderer↔main seam; electron/node-pty banned in renderer; sandbox:true), **D-04** (branded `LogicalId`), **D-10** (conservative Electron pin constrains the node-pty choice).
- `src/shared/api-types.ts` — the `ElectronAPI` contextBridge surface to **extend** with PTY methods.
- `src/shared/types.ts` — `SessionRecord` (`shell`, `cwd`, `startupCommand` fields already defined) + `LogicalId`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/preload/index.ts` — the single `contextBridge.exposeInMainWorld('api', …)` pattern; **extend** the `api` object with PTY methods + event subscription (`onData`/`onExit`). Never expose raw `ipcRenderer`.
- `src/main/window-config.ts` — secure `buildWebPreferences`; the terminal window stays sandboxed/contextIsolated.
- `src/main/index.ts` — existing `ipcMain.handle('api:get-version', …)` pattern to extend with PTY channels; main process is where `node-pty` lives.
- `src/shared/types.ts` / `src/shared/api-types.ts` — `SessionRecord` + `ElectronAPI` contracts to build against.
- Test harnesses: Vitest (unit/guard) + WebdriverIO boot smoke — the smoke harness can be extended into a real PTY round-trip smoke (type a command, assert echoed output).

### Established Patterns
- **contextBridge-only** renderer↔main seam; `electron`/`node-pty` banned in renderer (ESLint, now incl. `node-pty`); `sandbox: true` preload.
- Atomic per-task commits + guard-test enforcement (the project's "make invariants impossible to violate" posture).

### Integration Points
- **Main:** a new PTY-manager module owns a `node-pty` process keyed by `LogicalId` (single session this phase; the keying generalizes to multi-session in Phase 3).
- **Preload:** extend `ElectronAPI` with terminal create/write/resize methods + `onData`/`onExit` subscriptions, all over the typed bridge.
- **Renderer:** an `xterm` instance bound to the `window.api` streams; `addon-fit` drives resize; full-window layout.

</code_context>

<specifics>
## Specific Ideas

- Canonical scenario to keep in view end-to-end: session running **`claude --rc`** must behave exactly like a native terminal — this is precisely why D-01 chose a login+interactive, full-env shell (so the tool resolves on PATH like it does in Terminal.app).
- The user consistently chose the **most native, least-surprising default** at every fork (login shell + full env, auto-start, standard Cmd+C/Cmd+V, mainstream 10k scrollback) — favor fidelity and convention over novel behavior throughout this phase.

</specifics>

<deferred>
## Deferred Ideas

None new — discussion stayed within phase scope. Topics raised were routed to their owning phases:
- Stop/restart, status lifecycle, configured startup command (TERM-05/07/08) → **Phase 3**.
- Multi-session, sidebar/tabs, session name/icon identity (NAV-*, SESS-*, IDENT-03) → **Phases 3/4**.
- Scrollback-size setting (TERM-11), scrollback search (TERM-10), clear/restart header controls (TERM-12), needs-attention indicator (TERM-09) → later phases.
- Configurable font/theme (APPR-01/02) → **v2**.
- Windows-shell specifics (PowerShell/WSL) + packaging/makers → **Phase 8** (spawn layer stays OS-agnostic now).

</deferred>

---

*Phase: 2-PTY Core + Terminal Fidelity*
*Context gathered: 2026-06-04*
