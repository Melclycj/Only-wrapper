<!-- GSD:project-start source:PROJECT.md -->

## Project

**Just-Wrapper — Local Terminal Session Manager**

A cross-platform local desktop app (Windows + macOS) that wraps multiple **real, PTY-backed terminal sessions** behind a clean side-tab interface. Each session has a stable identity (custom name + icon + status) and can be switched to instantly without killing its running process. It is built for coding-agent workflows — running tools like `claude --rc`, `codex`, REPLs, and dev servers across different projects, each in its own clearly-labeled session.

It is **not** a new shell and **not** a full terminal replacement. It is a session *manager* that sits on top of the user's existing shells (PowerShell, CMD, Git Bash, WSL on Windows; zsh, bash on macOS).

**Core Value:** **Real terminal fidelity.** A session inside the wrapper must behave *exactly* like a native local terminal — `claude --rc`, `codex`, `vim`, `ssh`, `python`, and `npm run dev` all work flawlessly. If this fails, nothing else matters. Stable session identity and instant non-destructive switching are the strong second priority.

### Constraints

- **Platform**: Cross-platform — Windows + macOS from a single codebase. PTY layer must work via ConPTY on Windows and forkpty on macOS (e.g. `node-pty`, which abstracts both). Linux is not a target but should not be actively precluded. Code must stay OS-agnostic except at explicit platform-aware edges (shell defaults, path handling, packaging).
- **Tech stack**: Desktop framework (Electron vs. Tauri) deferred to the research phase, which will recommend with rationale — cross-platform packaging quality is now a selection criterion. Terminal rendering expected via a mature emulator (e.g. xterm.js). PTY via a real cross-platform pseudo-terminal layer (e.g. node-pty), not command-capture.
- **Persistence**: Local-only. No cloud, no remote services, no telemetry. Session metadata stored on disk.
- **Packaging**: Simple local desktop packaging — installable/runnable Windows app, no app-store or distribution pipeline required for MVP.
- **Architecture**: Logical session ID must be decoupled from PTY process ID; restarting a process must preserve the logical ID.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Primary Decision: Electron over Tauri

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Electron | 42.x (latest stable) | Desktop framework, window management, Node.js runtime for PTY | Only framework with production-proven PTY-via-node-pty architecture. Ships Chromium (renderer) + Node.js (main). First-class native module support. Used by VS Code, Hyper, Tabby. |
| node-pty | 1.1.0 (stable) | Pseudo-terminal layer — ConPTY on Windows, forkpty on macOS | Microsoft-maintained, 10M+ weekly downloads. Single API over both platforms. Powers VS Code's integrated terminal. ConPTY (Windows 1809+) replaces winpty — which is now removed. v1.2.0-beta series tested against Electron 39. |
| @xterm/xterm | 5.5.0 | Terminal renderer (HTML Canvas / WebGL) | Industry standard. Renamed from `xterm` to `@xterm/xterm` at v5. Powers VS Code terminal, Hyper, Tabby, CloudShell. Full ANSI/VT100 support, scrollback, selection, Unicode. |
| React | 19.x | UI framework for sidebar + tabs shell | Largest Electron ecosystem (most guides, templates, patterns). Electron Forge has official React + TypeScript + Vite guide. Component model maps cleanly to session list + tab surface. |
| TypeScript | 5.x | Type safety across main + renderer processes | Eliminates class of IPC bugs between processes. Electron Forge's vite-typescript template includes it out of the box. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @xterm/addon-fit | 0.10.x | Resize xterm instance to fill its container div | Always — needed to handle window resize and sidebar-collapse resize events |
| @xterm/addon-webgl | 0.19.x | WebGL2 renderer for terminal (GPU-accelerated) | Default renderer path; fall back to @xterm/addon-canvas if WebGL2 unavailable (rare) |
| @xterm/addon-canvas | 0.7.x | Canvas 2D renderer fallback | Fallback only when WebGL2 context creation fails |
| @xterm/addon-web-links | 0.11.x | Clickable URL detection in terminal output | Always — useful for agent output containing URLs |
| @xterm/addon-unicode11 | 0.8.x | Correct width calculation for emoji and wide chars | Always — session names use emoji icons; terminal output may contain wide characters |
| lowdb | 7.0.1 | JSON file persistence for session metadata | Session profiles, order, last-active state. Zero-dependency, Node.js-native, adequate for ~50 sessions. |
| uuid | 10.x | Generate stable logical session IDs | Session ID generation — decoupled from PTY PID per architecture spec |
| electron-squirrel-startup | 1.x | Handle Squirrel install/uninstall events on Windows | Required for Windows NSIS/Squirrel installers via Electron Forge |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Electron Forge (with @electron-forge/plugin-vite) | Build, dev server, packaging | Officially recommended by electron.org. Vite plugin gives fast HMR in renderer. Use `@electron-forge/template-vite-typescript` to scaffold. |
| @electron/rebuild | Rebuild node-pty against Electron's ABI after installs | Critical — node-pty is a native C++ module. Must be rebuilt per Electron version. Add to `postinstall` npm script. |
| @electron-forge/plugin-auto-unpack-natives | Ensure .node binaries are unpacked outside ASAR | node-pty's `.node` file cannot load from inside ASAR archive. This plugin (or ASAR config) ensures it lands outside. |
| Vite | Renderer bundler (via Forge plugin) | Fast dev HMR; handles React/TSX. As of Forge v7+, Vite 7 is used. Treat node-pty as `external` in Vite config. |
| electron-builder | Alternative packager (not default — see note) | Use only if Forge's maker output proves insufficient for code signing requirements. electron-builder has more code-signing knobs. |

## Installation

# Scaffold with Electron Forge vite-typescript template

# Core terminal stack

# Persistence + utilities

# Windows installer helper

# Dev: native module rebuild

# Add to package.json scripts:

# "postinstall": "electron-rebuild -f -w node-pty"

## Alternatives Considered

| Recommended | Alternative | When Alternative Is Better |
|-------------|-------------|---------------------------|
| Electron | Tauri | If the app has no PTY/native-module requirement and bundle size is the primary concern. Tauri's PTY plugin is not production-ready as of 2026. |
| node-pty | Shell-out per command / `child_process.exec` | Never for interactive sessions. One-shot exec cannot support vim, REPLs, interactive prompts, arrow keys, or Ctrl+C. Anti-pattern. |
| @xterm/xterm | hterm.js | hterm is Google's older library, lower performance, smaller community. xterm.js has WebGL acceleration and is the clear industry leader. |
| @xterm/addon-webgl | DOM renderer (default xterm.js renderer) | Only use DOM renderer for debugging. WebGL is 2–5x faster for high-throughput output (agent streaming). |
| lowdb | electron-store | electron-store appears unmaintained (last release >1 year ago, many open issues). lowdb v7 is cleaner and type-safe. |
| lowdb | SQLite (better-sqlite3) | Overkill for session metadata with ~50 records and no relational queries. SQLite requires another native module rebuild. Add only if querying/filtering sessions at scale. |
| lowdb | Plain `fs.writeFileSync` with JSON | Acceptable but error-prone: no atomic writes, no type safety, manual migration. lowdb gives these free. |
| Electron Forge | electron-builder | electron-builder has more code-signing configuration but a steeper config surface. Forge is simpler and officially endorsed. Use builder only if Forge's Windows signing options prove inadequate. |
| React | Svelte | Svelte 5 has a smaller runtime bundle and compile-time reactivity. For an Electron app the 36KB React overhead is not meaningful. React's larger ecosystem (hooks, ecosystem libs, team familiarity) wins. Consider Svelte if bundle size becomes a concern on very slow machines. |
| React | Vanilla JS + Web Components | Viable for a minimal session list, but component lifecycle complexity (PTY attachment/detach, resize, focus management) benefits from React's model. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `child_process.exec` / `spawn` (one-shot) for terminal sessions | Cannot maintain a live PTY. No interactive input, no ANSI colors, no arrow keys, no Ctrl+C forwarding. Fundamental architectural failure for this project's Core Value. | `node-pty` with a persistent PTY per session |
| `xterm` (unscoped npm package) | Deprecated. Last published v5.3.0; active development moved to `@xterm/xterm`. | `@xterm/xterm` 5.5.0+ |
| `xterm-addon-webgl` (unscoped) | Deprecated alongside unscoped `xterm`. | `@xterm/addon-webgl` |
| `electron-store` | Appears unmaintained; last release >12 months ago; open issues accumulating. | `lowdb` 7.0.1 |
| `winpty` on Windows | node-pty dropped winpty support. Requires Windows 10 1809+ (ConPTY). That is the correct modern path and a reasonable minimum. | ConPTY via node-pty (default on Windows 1809+) |
| Running node-pty in the renderer process | Violates Electron's security model; will break with `contextIsolation: true`. | Run node-pty exclusively in the main process; pipe data to renderer via IPC (`ipcMain` / `ipcRenderer`) |
| Loading .node native files from inside ASAR | Native modules cannot be `require()`-d from inside the ASAR archive. | Use `@electron-forge/plugin-auto-unpack-natives` or set `asar.unpackDir` to cover `node-pty`'s binaries |
| Tauri + tauri-plugin-pty | Plugin has zero published releases, 19 stars, and is self-described as "developing". Unsuitable for production. | Electron + node-pty |

## Critical: node-pty Native Module Build Concerns

### Required setup

### forge.config.ts — mark node-pty as external in Vite, unpack .node from ASAR

### Windows-specific gotchas

- **ConPTY requires Windows 10 1809+** (build 18309). This is the project's minimum Windows requirement.
- winpty is removed from node-pty. Do not attempt to use it.
- node-pty spawns a `conpty.node` binary alongside the `.node` addon. Both must be unpacked outside ASAR. The auto-unpack-natives plugin handles this.
- `win_delay_load_hook` must NOT be set to false in `binding.gyp` (this is a default node-pty behavior; do not override it).
- On Windows, shell paths for PowerShell: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`; for WSL: `C:\Windows\System32\wsl.exe`.

### macOS-specific gotchas

- node-pty uses `forkpty` (POSIX). Works on both Intel and Apple Silicon.
- For macOS universal binary (`--arch=universal`): node-pty must be rebuilt for both `x64` and `arm64` and lipo'd together, or built separately. Electron Forge's maker handles this with `--arch=universal` flag.
- Shell defaults: `/bin/zsh` (macOS 10.15+), `/bin/bash` fallback.

### Electron version targeting

- node-pty v1.1.0 (stable) is tested against Electron 19+ minimum; the v1.2.0-beta series is tested against Electron 39.x.
- **Pin to Electron 36.x or 38.x** (stable at time of development) to get pre-built binaries or well-tested beta rebuild. Electron 42 is latest stable; check node-pty GitHub issues for compatibility before adopting.
- Run `@electron/rebuild` in CI after every `npm install` and after every Electron version bump.

## Architecture: PTY in Main Process, Terminal Render in Renderer

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| node-pty@1.1.0 | Electron 19–36 (stable tested range) | v1.2.0-beta tested against Electron 39; use beta for Electron 38+ |
| @xterm/xterm@5.5.0 | Any modern Chromium (Electron 22+) | WebGL addon requires WebGL2 support (all modern Chromium builds have it) |
| @xterm/addon-webgl@0.19.0 | @xterm/xterm@5.x | Must match xterm major version |
| @xterm/addon-fit@0.10.x | @xterm/xterm@5.x | Must match xterm major version |
| lowdb@7.0.1 | Node.js 18+, ESM only | lowdb v7 is ESM-only. Electron's main process can run ESM or use dynamic import(). |
| Electron Forge v7+ | Vite 7 | Forge v7 upgraded to Vite 7; confirm Vite config syntax if upgrading from earlier forge. |

## Sources

- [node-pty GitHub (microsoft/node-pty)](https://github.com/microsoft/node-pty) — version, ConPTY status, Electron compatibility — HIGH confidence
- [node-pty releases](https://github.com/microsoft/node-pty/releases) — confirmed v1.2.0-beta.13 tests against Electron 39.x — HIGH confidence
- [Agents UI: Tauri vs Electron for Developer Tools](https://agents-ui.com/blog/tauri-vs-electron-for-developer-tools/) — PTY latency benchmarks, Tauri recommendation for terminal-heavy apps — MEDIUM confidence (benchmark methodology unknown)
- [DoltHub: Electron vs Tauri (Nov 2025)](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) — Tauri blocking issues on Windows .msix and macOS universal binary signing — HIGH confidence (practitioner post-mortem)
- [Tauri plugin-pty GitHub (Tnze)](https://github.com/Tnze/tauri-plugin-pty) — 0 releases, 19 stars, "Developing!" status — HIGH confidence
- [@xterm/xterm npm](https://www.npmjs.com/package/@xterm/xterm) — v5.5.0 current, package rename from `xterm` confirmed — HIGH confidence
- [@xterm/addon-webgl npm](https://www.npmjs.com/package/@xterm/addon-webgl) — v0.19.0 current — HIGH confidence
- [Electron Forge: Auto Unpack Natives Plugin](https://www.electronforge.io/config/plugins/auto-unpack-natives) — ASAR unpack requirement for .node files — HIGH confidence
- [Electron Forge: Vite + TypeScript template](https://www.electronforge.io/templates/vite-+-typescript) — official scaffold — HIGH confidence
- [lowdb npm](https://www.npmjs.com/package/lowdb) — v7.0.1, last published 2023, ESM-only — MEDIUM confidence (maintenance concern noted)
- [Electron Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules) — @electron/rebuild usage — HIGH confidence
- [WebSearch: Tabby terminal node-pty IPC architecture](https://readoss.com/en/vercel/hyper/hypers-architecture-navigating-electron-terminal-emulator-codebase) — IPC pattern confirmed in Hyper/Tabby — HIGH confidence

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
