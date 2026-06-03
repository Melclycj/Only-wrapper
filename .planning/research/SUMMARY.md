# Project Research Summary

**Project:** Just-Wrapper — Local Terminal Session Manager
**Domain:** Cross-platform local desktop terminal session manager (Windows + macOS) for coding-agent workflows
**Researched:** 2026-06-03
**Confidence:** HIGH

---

## Executive Summary

Just-Wrapper is a local desktop app that wraps multiple real, PTY-backed terminal sessions behind a clean sidebar interface. The core value is terminal fidelity — every interactive program (`claude --rc`, `codex`, `vim`, `ssh`, REPLs) must behave exactly as it does in a native terminal. The research consensus is unambiguous: build on **Electron + node-pty + @xterm/xterm**. Electron is the only framework with a production-proven PTY integration pattern (VS Code, Hyper, Tabby all use it), and Tauri's PTY story is pre-production. The recommended stack one-liner is: **Electron + @xterm/xterm + node-pty (main process only) + lowdb + Electron Forge**.

The product's differentiators — per-session emoji/icon identity, collapsible sidebar, stable logical session IDs, and status indicators — have no direct competition in existing terminals and are all achievable with low-to-medium implementation cost. The table-stakes features (real PTY, keyboard input, ANSI colors, resize reflow, multi-session switching) are well-understood and have established patterns. The Out of Scope list (browser extension, AI automation, cloud sync, SSH manager, plugin system) is well-reasoned; no exclusion creates meaningful risk for MVP.

The single most important spec gap uncovered: the existing session status set (`not_started / running / stopped / exited / error`) does not distinguish a **"waiting-for-input"** state. Coding agents routinely pause and wait for user confirmation. Without a sidebar alert when a background session is blocked, users miss agent prompts — which is the primary UX failure this product is designed to prevent. This should be decided as a requirement during requirements definition. The biggest implementation risks are the node-pty ABI rebuild pipeline and the PTY-in-main-process-only architectural rule; both are fully preventable with known techniques.

---

## Key Findings

### Framework Decision: Electron (not Tauri)

**Electron is the correct framework for this project.** The decision rests entirely on the Core Value: real terminal fidelity requires a live PTY, and node-pty is a first-class citizen in Electron's Node.js main process. Tauri's only PTY plugin has zero published releases and is self-described as "Developing!". A 2025 DoltHub assessment blocked Tauri adoption for a macOS+Windows target specifically citing Windows `.msix` limitations and macOS universal binary codesigning failures — exactly this project's deployment target. Tauri's bundle-size and idle-memory advantages (10–20 MB vs 80–150 MB; 50 MB vs 180 MB idle) are irrelevant when the app's workload is running multiple live shells with agent output.

### Recommended Stack

**Electron + @xterm/xterm + node-pty (main process) + lowdb + Electron Forge**

**Core technologies:**
- **Electron 42.x**: Desktop framework — only framework with production-proven PTY+native-module architecture; ships Chromium (renderer) + Node.js (main); used by VS Code, Hyper, Tabby
- **node-pty 1.1.0**: Pseudo-terminal — Microsoft-maintained, 10M+ weekly downloads; single API over ConPTY (Windows 1809+) and forkpty (macOS); powers VS Code's integrated terminal
- **@xterm/xterm 5.5.0**: Terminal renderer — industry standard with WebGL acceleration; full ANSI/VT100; powers VS Code, Hyper, Tabby, CloudShell; uses scoped package name (the unscoped `xterm` is deprecated)
- **React 19.x + TypeScript 5.x**: UI framework — largest Electron ecosystem; Electron Forge has official React + Vite + TypeScript template
- **lowdb 7.0.1**: Session metadata persistence — zero-dependency, Node.js-native JSON store; adequate for ~50 sessions; electron-store appears unmaintained (avoid it)
- **Electron Forge + Vite plugin**: Build and packaging — officially recommended by electron.org; fast HMR; handles native module unpack via `@electron-forge/plugin-auto-unpack-natives`

**Critical supporting libraries:** `@xterm/addon-fit`, `@xterm/addon-webgl`, `@xterm/addon-unicode11`, `uuid`, `@electron/rebuild`

**Versions to pin:** node-pty@1.1.0 (stable, tested Electron 19–36); use v1.2.0-beta for Electron 38+. **Minimum Windows requirement: Windows 10 build 18309 (1809)** — ConPTY requires this; winpty is removed from node-pty 1.x.

### Expected Features

**Must have — table stakes (users will consider app broken without these):**
- Real interactive PTY terminal (node-pty + xterm.js) — foundation; nothing else works without it
- Full keyboard input: Ctrl+C, Ctrl+D, arrow keys, Tab completion
- ANSI/VT100 color and escape sequence rendering
- Copy/paste from terminal output
- Window resize reflows terminal correctly (SIGWINCH / ConPTY resize)
- Scrollback buffer
- Multiple concurrent sessions with instant non-destructive switching
- Persistent session list across app restarts (restore profiles only, not live processes)
- Start session in configured working directory
- Custom shell selection per session (PowerShell, CMD, WSL, zsh, bash)
- Session names visible in session list
- Stop and restart a session

**Should have — differentiators (this product's unique identity):**
- Per-session custom name + emoji/icon + color badge — no generic terminal does this natively
- Collapsible sidebar (expanded: icon + name + status; collapsed: icon badge only) — maximizes terminal space
- Stable logical session ID decoupled from PTY process ID — survives rename, restart, tab switch
- Session status indicator (`not_started / running / stopped / exited / error`)
- Optional startup-command per session — primary coding-agent use case (`claude --rc`, `codex`)
- `not_started` state (session profile exists before PTY is ever spawned)
- Persisted sidebar ordering

**Anti-features — explicitly out of scope for MVP (confirmed by research):**
- Browser extension / companion
- AI automation / driving agents
- Cloud sync / multi-device support
- SSH connection management
- Plugin system
- Warp-style command blocks (breaks PTY transparency)
- Custom uploaded icon files (SVG/PNG) — emoji + built-in set is sufficient
- Live terminal process recovery after full app quit — restore profiles only; user restarts manually

**Add after v1 validation (v1.x):** clickable URLs, keyboard shortcuts for session switching, search in scrollback (Ctrl+F), clear terminal shortcut, drag-to-reorder sidebar, font size zoom

### Architecture Approach

The architecture follows the VS Code terminal pattern with strict process separation: **node-pty lives exclusively in the main process; xterm.js lives exclusively in the renderer**. IPC (via `contextBridge`) is the only bridge. Three services in the main process handle the core concerns: `SessionRegistry` owns the logical session model and status state machine; `PtyHostService` owns all node-pty instances and output routing; `PersistenceService` handles debounced JSON writes to disk. The renderer holds one `xterm.js Terminal` instance per session; inactive sessions are hidden with CSS (`display: none`) but never destroyed — their PTY keeps running and output is buffered in a per-session ring buffer (~200 KB) in the main process, replayed on tab switch.

**Major components:**
1. **SessionRegistry** (main): `Map<logicalId, SessionRecord>` — canonical source of truth; enforces the `logicalId != ptyPid` separation
2. **PtyHostService** (main): Spawns/kills node-pty instances; routes output to ring buffer and IPC; handles resize
3. **PersistenceService** (main): Debounced writes to `app.getPath('userData')`; never persists runtime state (`status`, `ptyPid`, `exitCode`)
4. **preload.ts** (contextBridge): Narrow, typed API surface — the only bridge between renderer and main
5. **TerminalPanel** (renderer): One xterm.js instance per logical session; CSS show/hide; wires onData to IPC write
6. **SessionStore / Sidebar** (renderer): Zustand state mirroring session metadata; drives sidebar render

**Key architectural rules:**
- `node-pty` NEVER runs in the renderer process (security + stability)
- xterm.js instances are NEVER destroyed on tab switch — only on session delete
- Logical session ID (UUID) is NEVER the PTY process PID
- Runtime status is NEVER written to disk — always restore to `not_started` on app reopen
- `fit()` is ALWAYS called AFTER the terminal container is `display: block` (not before)

### Critical Pitfalls

1. **PTY in main process only — never renderer** — Running node-pty in the renderer violates Electron's security model (`contextIsolation: true`) and will crash. Wire: `node-pty (main) -> IPC -> xterm.js (renderer)`. This is non-negotiable.

2. **node-pty ABI mismatch with Electron** — node-pty is a native C++ addon compiled against system Node.js; Electron uses a different ABI. Add `"postinstall": "electron-rebuild -f -w node-pty"` and run it in every CI step. Failure symptom: works in `npm start` but crashes in the packaged app.

3. **ASAR archive prevents node-pty from loading** — `spawn-helper` (macOS/Linux) and `conpty.node` (Windows) must exist as real filesystem files, not inside the ASAR archive. Use `@electron-forge/plugin-auto-unpack-natives` or configure `asarUnpack` explicitly. Failure mode: PTY spawn works in dev, silently fails in packaged app.

4. **No flow control on PTY output** — Direct `pty.onData -> term.write()` without backpressure overflows xterm.js's 50 MB write buffer; data is silently dropped; UI freezes during `cat large-file`. Implement HIGH/LOW watermark (500 KB / 10 KB) using `pty.pause()` / `pty.resume()` and xterm's `write()` callback.

5. **fit() called before container is visible** — A container with `display: none` returns 0x0 dimensions; `fit()` passes `cols=0, rows=0` to `pty.resize()`, corrupting vim, htop, and any ncurses app. Always call `fit()` after `display: block`.

6. **TERM/COLORTERM not set at PTY spawn** — node-pty does not inherit the developer's `TERM` value; on Windows, ConPTY spawns with `TERM` unset. Always pass `{ TERM: 'xterm-256color', COLORTERM: 'truecolor', ...process.env }` in the spawn env.

7. **Using ptyPid as session identifier** — PIDs are recycled by the OS; restarting a session gives a new PID, breaking all IPC routing. Generate a UUID at session creation; use it as `logicalId` everywhere. Store `ptyPid` only as a transient field.

---

## Spec Gap: "Waiting-for-Input" Session Status

**This is the highest-priority gap found in research and should be decided during requirements definition.**

The current status set (`not_started / running / stopped / exited / error`) does not include a `waiting_for_input` state. Coding agents (`claude --rc`, `codex`) routinely pause and wait for user confirmation (permission prompts, yes/no questions). Without a sidebar visual alert when a background session is blocked, users miss these prompts — they assume the agent is still running when it is actually paused.

This is precisely the pain point this product is designed to solve. ccmanager and opensessions (direct use-case comparators) implement exactly this "Waiting" state. The status indicator infrastructure from Phase 2 makes it addable without architecture changes.

**Implementation approach:** Heuristic detection — output has gone idle after a prompt-like pattern (ends with `?` or `[y/N]` or similar). Complexity is MEDIUM.

**Candidate requirement to add to Active requirements:**
> `waiting_for_input` session status — visual sidebar alert when a background session's PTY output has gone idle with a pattern consistent with awaiting user input (permission prompt, confirmation dialog). Distinct from `running` (active work) and `stopped` (process terminated).

---

## Implications for Roadmap

Research converges on a clear build order driven by dependency chain and risk front-loading. **Validate packaging early** (smoke-test after Phase 1) rather than last — discovering ASAR/ABI issues after building the full feature set is expensive.

### Phase 1: PTY Core + Terminal Fidelity

**Rationale:** Terminal fidelity is the Core Value; everything else is wasted if this fails. Establishes the load-bearing foundation before any UI work. Validates the hardest technical risks (ABI rebuild pipeline, IPC data flow, keyboard fidelity) at minimum cost.

**Delivers:** Single working terminal session — hardcoded shell, single xterm.js instance, full keyboard input, ANSI colors, resize reflow, flow control, correct TERM/COLORTERM, bracketed paste, Unicode width.

**Features addressed:** Real interactive PTY, full keyboard input, ANSI rendering, copy/paste, resize reflow, scrollback buffer

**Pitfalls to prevent:** One-shot exec instead of PTY, Ctrl+C signal handling, resize propagation, ABI mismatch infra, bracketed paste, TERM/COLORTERM, flow control, Unicode11 addon, logical ID data model established here

**Research flag:** Standard pattern — VS Code architecture is well-documented; no additional research needed.

---

### Phase 2: Multi-Session Survival

**Rationale:** Background session survival is the second core value. With fidelity proven, add the session model without UI complexity — validating multiple PTYs coexist, ring buffer replay works, and the state machine is correct.

**Delivers:** N concurrent sessions, tab switching without killing background sessions, per-session ring buffer replay on activation, session status state machine (`not_started / running / stopped / exited / error`), stop/restart with stable logical ID.

**Features addressed:** Multiple concurrent sessions, switch without killing, stop/restart, session status indicator

**Pitfalls to prevent:** PTY killed on tab switch, xterm.js memory leaks, status state machine races

**Research flag:** Standard pattern — well-documented.

---

### Phase 3: Session Identity + Sidebar UI

**Rationale:** The product's visual identity layer. Depends on Phase 2's session model being stable. Non-destructive to add on top of working PTY/session core.

**Delivers:** Sidebar with session list (icon + name + status badge), per-session name/emoji/color, collapsible sidebar (expanded/collapsed modes), create/rename/delete session UI, session ordering.

**Features addressed:** Per-session name + icon + color badge, collapsible sidebar, `not_started` state (profile before PTY), sidebar ordering

**Pitfalls to prevent:** Icon required at session creation (collapsed sidebar unusable without it); xterm.js disposal on session delete

**Research flag:** Standard pattern — React component model maps cleanly.

---

### Phase 4: Persistence

**Rationale:** Can overlap Phase 3; both are independent of PTY concerns. Session metadata must survive app restart. Shell discovery is also here.

**Delivers:** Session profiles persisted to disk, restore on reopen (always `not_started` — never `running`), debounced writes, platform-aware shell defaults (PowerShell/CMD/WSL on Windows; zsh/bash on macOS), per-session cwd + startup command config.

**Features addressed:** Persist session metadata, restore profiles, persisted sidebar order, custom shell selection, optional startup command, configured working directory

**Pitfalls to prevent:** Concurrent write corruption (use lowdb's atomic writes), never persist runtime status, validate cwd at spawn time not save time, platform-aware shell paths, ConPTY Windows 1809+ version check

**Research flag:** Standard pattern — lowdb and shell resolution patterns are well-documented.

---

### Phase 5: Flow Control + Error Handling Polish

**Rationale:** Can run in parallel with Phase 4. Hardens the PTY pipeline for production use cases (high-throughput agent output, error UX).

**Delivers:** HIGH/LOW watermark backpressure (`pty.pause()` / `pty.resume()`), error handling for spawn failure / unexpected exit / invalid cwd, `error` status with exit code in sidebar, alt-screen cleanup on forced close (`terminal.reset()`).

**Features addressed:** Robustness for `cat large-file`, `npm install` output, crashed agent recovery UX

**Pitfalls to prevent:** Flow control overflow, alt-screen leak on forced close

**Research flag:** Standard pattern — xterm.js flow control guide is authoritative.

---

### Phase 6: Cross-Platform Packaging

**Rationale:** Last in sequence but smoke-test after Phase 1. Packaging wraps a working app — ASAR/ABI issues discovered late are expensive. Run a packaging smoke-test at the end of Phase 1 to validate the rebuild pipeline and ASAR unpack config before investing further.

**Delivers:** Distributable Windows installer and macOS `.app`; `@electron/rebuild` in `postinstall` and CI; ASAR unpack for `pty.node` + `spawn-helper`; Electron Forge maker configs for Windows + macOS; code signing stubs (unsigned local build acceptable for MVP); ConPTY Windows version check on startup.

**Pitfalls to prevent:** ABI mismatch, ASAR unpack missing spawn-helper, macOS notarization (budget 5–15 min per build + Apple Developer Program ~$99/year), Windows 1809 version check

**Research flag:** ASAR + node-pty packaging has known gotchas — `spawn-helper` path can shift between node-pty versions; verify after every node-pty version bump. macOS notarization needs planning lead time.

---

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** PTY core must exist before multi-session management.
- **Phase 2 before Phase 3:** Session identity UI is meaningless without a working session model.
- **Phase 3 and Phase 4 can overlap:** Sidebar UI and persistence are independent; both depend on Phase 2.
- **Phase 5 can run in parallel with Phase 4:** Flow control is a PTY pipeline concern; persistence is orthogonal.
- **Phase 6 is last but smoke-test after Phase 1:** Validate ABI/ASAR pipeline before investing in full feature set.

---

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 6 (Packaging):** macOS notarization details, Windows code signing options, and Electron Forge maker configuration are configuration-heavy and change between Electron versions. Run a packaging spike immediately after Phase 1.

**Phases with standard, well-documented patterns (skip research-phase):**
- **Phase 1 (PTY Core):** VS Code terminal architecture is exhaustively documented; node-pty + xterm.js IPC pattern has multiple production reference implementations.
- **Phase 2 (Multi-Session):** Ring buffer + CSS hide/show + state machine are established patterns.
- **Phase 3 (Sidebar UI):** Standard React component work.
- **Phase 4 (Persistence):** lowdb is well-documented; shell discovery patterns are OS-stable.
- **Phase 5 (Flow Control):** xterm.js flow control guide is authoritative.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Framework decision backed by practitioner post-mortem (DoltHub 2025), official node-pty/xterm.js docs, and multiple production reference apps (VS Code, Hyper, Tabby). lowdb vs electron-store is MEDIUM (maintenance concern noted). |
| Features | HIGH | Table stakes sourced from competitive analysis of 7 terminals; differentiators confirmed by use-case comparators (ccmanager, opensessions). |
| Architecture | HIGH | VS Code integrated terminal architecture is exhaustively documented; IPC patterns verified against Hyper and Tabby source. |
| Pitfalls | HIGH | All pitfalls verified against official docs, node-pty/xterm.js issue trackers, and Electron security documentation. |

**Overall confidence:** HIGH

### Gaps to Address

- **"Waiting-for-input" detection heuristic:** The status indicator framework is clear; the specific heuristic for detecting "agent paused for input" needs a decision during requirements definition. Recommended starting approach: idle timer + trailing prompt pattern match (e.g., ends with `?` or `[y/N]`).
- **node-pty version for Electron 42.x:** node-pty v1.1.0 is tested against Electron 19–36 stable; v1.2.0-beta is tested against Electron 39. Electron 42 compatibility should be verified against node-pty GitHub issues before committing. Consider starting on Electron 36.x (known stable) and upgrading after packaging is validated.
- **lowdb maintenance status:** lowdb v7 was last published 2023. Acceptable for MVP; revisit at v2 if maintenance becomes a concern.

---

## Sources

### Primary (HIGH confidence)
- [node-pty GitHub (microsoft/node-pty)](https://github.com/microsoft/node-pty) — version, ConPTY status, Electron compatibility
- [DoltHub: Electron vs Tauri (Nov 2025)](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) — Tauri blocking issues on Windows + macOS packaging
- [Tauri plugin-pty GitHub](https://github.com/Tnze/tauri-plugin-pty) — 0 releases, "Developing!" status confirmed
- [xterm.js Flow Control Guide](https://xtermjs.org/docs/guides/flowcontrol/) — watermark values, buffer limits
- [Electron Forge: Auto Unpack Natives Plugin](https://www.electronforge.io/config/plugins/auto-unpack-natives) — ASAR unpack requirement
- [Electron Security Tutorial](https://www.electronjs.org/docs/latest/tutorial/security) — contextIsolation, nodeIntegration, IPC validation
- [VS Code integrated terminal architecture](https://deepwiki.com/microsoft/vscode/6-integrated-terminal) — PTY host pattern
- [@xterm/xterm npm](https://www.npmjs.com/package/@xterm/xterm) — v5.5.0, package rename confirmed
- [Electron Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules) — @electron/rebuild usage

### Secondary (MEDIUM confidence)
- [ccmanager (GitHub)](https://github.com/kbwo/ccmanager) — "waiting" state pattern for coding agent session managers
- [opensessions (GitHub)](https://github.com/ataraxy-labs/opensessions) — per-thread status markers for coding agents
- [Agents UI: Tauri vs Electron for Developer Tools](https://agents-ui.com/blog/tauri-vs-electron-for-developer-tools/) — PTY latency benchmarks (methodology unknown)
- [lowdb npm](https://www.npmjs.com/package/lowdb) — v7.0.1, ESM-only, last published 2023
- [node-pty + Electron Forge packaging](https://thomasdeegan.medium.com/electron-forge-node-pty-9dd18d948956) — ASAR + spawn-helper config

---

*Research completed: 2026-06-03*
*Ready for roadmap: yes*
