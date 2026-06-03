# Feature Research

**Domain:** Cross-platform local desktop terminal session manager for coding-agent workflows
**Researched:** 2026-06-03
**Confidence:** HIGH (table stakes and differentiators well-evidenced by competitive landscape; anti-features confirmed by scope analysis)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels broken or incomplete. Sourced from: iTerm2, Windows Terminal, WezTerm, tmux, Tabby, VS Code integrated terminal, Hyper.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real interactive PTY terminal | Every terminal product uses a true pseudo-terminal; anything less breaks interactive programs (vim, claude --rc, REPLs) | HIGH | node-pty abstracts ConPTY (Windows) and forkpty (macOS); this is the non-negotiable foundation |
| Full keyboard input: Ctrl+C, Ctrl+D, arrow keys, Tab completion | Any real shell session requires these; coding agents depend on them for prompts and cancellation | MEDIUM | Must pass raw key events through to PTY, not intercept them |
| ANSI/VT100 color and escape sequence rendering | All modern CLIs, coding agents, and dev tools emit color output; broken rendering is immediately visible | HIGH | xterm.js handles this; must configure parser options correctly |
| Copy / paste text from terminal output | Universal expectation; every terminal emulator supports it | LOW | xterm.js selection + clipboard API; handle Cmd/Ctrl+C conflict (copy vs interrupt) carefully |
| Window/pane resize reflows terminal correctly | Resizing terminal is routine; broken reflow corrupts output layout | MEDIUM | Must send SIGWINCH or ConPTY resize event to PTY when pane dimensions change |
| Scrollback buffer (terminal history) | Users scroll up to review output; coding agents produce long output | LOW | xterm.js `scrollback` option; default 1000 lines; configurable is table stakes |
| Multiple concurrent sessions | Single-session tools are useless for multi-agent workflows | MEDIUM | Core identity model: logical session ID decoupled from PTY process ID |
| Switch active session without killing background sessions | Tmux users expect this; it is the whole point of a session manager | MEDIUM | Background sessions stay running; only the renderer is hidden/shown |
| Persistent session list across app restarts | Every modern terminal (Warp, WezTerm, VS Code) restores sessions on reopen | MEDIUM | Store metadata to disk; restore profiles on launch; user restarts processes manually |
| Start session in a configured working directory | All terminal profiles (Windows Terminal, iTerm2) support this; coding agents need project-specific paths | LOW | Pass cwd to PTY spawn; validate path exists before launch |
| Custom shell selection per session (PowerShell, CMD, WSL, zsh, bash) | Windows Terminal, iTerm2, Tabby all support per-profile shell selection | LOW | Platform-aware shell enum; default to zsh on macOS, PowerShell on Windows |
| Session names visible in session list | VS Code renames, iTerm2 profile names, Windows Terminal tab names — all do this | LOW | Name stored in session metadata, shown in sidebar |
| Stop and restart a session | VS Code, iTerm2, Warp all support killing and relaunching a terminal | MEDIUM | Kill PTY process; preserve logical session ID; relaunch with same config |
| Clickable URLs in terminal output | Hyper, WezTerm, iTerm2, and most modern terminals auto-detect and make URLs clickable | LOW | xterm.js `linkProvider` or the `@xterm/addon-web-links` addon; open in system browser |

---

### Differentiators (This Product's Identity)

Features that define this product's unique value. These are NOT standard in generic terminal emulators but are directly needed for the coding-agent use case and the per-session identity model.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-session custom name + emoji/icon + color badge | In a multi-agent workflow with 6+ running sessions, visual identity is critical for instant recognition — e.g. "🛋️ Parlour Claude" is unambiguous in a sidebar; no generic terminal does this natively | LOW | Name + icon (emoji or built-in set) + color badge stored in session metadata; displayed in sidebar row |
| Collapsible sidebar (icon-only collapsed mode) | Maximizes terminal space when users know their sessions by icon; generic terminals use horizontal tab bars that cannot collapse to icons | MEDIUM | Two sidebar states: expanded (icon + name + status) and collapsed (icon badge only); toggle button or keyboard shortcut |
| Stable logical session ID decoupled from process ID | Rename, restart, icon change, tab switch — none should change the session's identity; no terminal emulator does this explicitly | MEDIUM | UUID generated at creation, stored in metadata, never reassigned; PTY process ID is separate ephemeral field |
| Session status indicator (not-started / running / stopped / exited / error) | Coding agents can be in any of these states; users need to know which sessions need attention without switching to each one | MEDIUM | Lifecycle events from PTY (spawn, exit, error) drive status enum; displayed as colored dot or badge in sidebar; depends on PTY lifecycle event subscription |
| Persisted session order (user-controlled sidebar ordering) | Users organize their workflow by placing related sessions adjacent; tab drag-reorder in iTerm2 is expected but order is never saved across app restarts in most tools | LOW | Order stored as array index in metadata; drag-to-reorder in sidebar writes updated order immediately |
| Optional startup-command-per-session vs normal shell mode | Running `claude --rc` or `codex` automatically on session start is the primary use case; normal shell mode is the fallback for interactive exploration | LOW | Session config field: `startupCommand?: string`; if set, spawn shell then send command; if not set, pure interactive shell |
| Session not-started state (profile without live process) | Users can define a session config before running it; existing terminals either show an empty shell or require immediate launch | LOW | Session exists in metadata with status `not-started`; user clicks Run/Start button to spawn PTY |

---

### Anti-Features (Deliberately NOT Building for MVP)

The product's Out of Scope list is well-reasoned. Each exclusion is confirmed and annotated with risk level.

| Anti-Feature | Why Excluded | Risk of Exclusion | Alternative Approach |
|--------------|--------------|-------------------|----------------------|
| Browser extension / companion (link tab to session) | Privacy-sensitive; substantial standalone scope; creates two-product complexity at MVP | LOW — defer cleanly | Defer to post-MVP optional module; keep session metadata API stable so companion can attach later |
| ChatGPT / Claude content reading (idle vs generating detection) | Requires observing another app's process or DOM; privacy violation concerns; no clear MVP value | LOW | Users visually observe agent state via the terminal output already visible in the session |
| AI automation / driving agents | The product hosts agents; it does not drive them; adding AI control conflates two very different tools | LOW | Users run `claude --rc` themselves; the wrapper provides the clean terminal environment |
| Cloud sync / multi-device support | Local-only is a deliberate design constraint; cloud adds auth, server costs, and privacy exposure | LOW | Local disk persistence is sufficient; users export config manually if needed |
| SSH connection management | Out-of-scope; users run `ssh` inside a session naturally; adding SSH manager creates a different product | LOW | Session shell already supports `ssh` commands; no special handling needed |
| Plugin system | Keeps MVP surface small; plugin APIs require stable contracts that are premature before v1 | LOW — but revisit at v2 | Built-in feature set covers coding-agent workflow; plugin system deferred to post-MVP |
| Warp-style command blocks (structured input/output blocks) | This is a session manager, not a reinvented terminal; command block parsing breaks PTY transparency | LOW | Raw terminal output is sufficient; coding agents have their own structured output |
| Custom uploaded icon files (SVG/PNG per session) | High implementation cost (file picker, icon storage, resizing); emoji + built-in icon library + color badge is sufficient visual identity | LOW | Emoji + color badge covers 99% of identity needs; custom images deferred to v2 |
| Live terminal process recovery after full app quit | Requires serializing PTY state to disk; fragile and complex; not expected in Electron/desktop apps | MEDIUM — see note | Restore profiles only; user relaunches sessions; this matches Warp, VS Code behavior |
| Split panes / tiling within a session | Adds significant layout management complexity; the per-session identity model already provides separation | LOW | Each session is its own full-pane terminal; users create multiple sessions instead of splits |
| Multi-window / detached sessions | Adds window management complexity; single-window app is simpler and sufficient for target workflow | LOW | Single window with collapsible sidebar covers the workflow |
| Session sharing / collaboration | Warp's team feature; not relevant for local solo coding-agent workflows | LOW | Out of scope permanently for MVP |

**Note on process recovery risk:** "Live process recovery after full app quit" is MEDIUM risk to exclude if users frequently kill the app while agents are mid-run (e.g. system crash). The mitigation is clear in-app messaging: "Sessions are preserved as profiles; restart them manually after relaunch." This matches user expectations from Warp and VS Code.

---

## Feature Dependencies

```
PTY lifecycle events (spawn / exit / error / resize)
    └──required by──> Session status indicator (running/stopped/exited/error)
    └──required by──> Stop and restart session
    └──required by──> SIGWINCH/resize reflow

Logical session ID (UUID, stable)
    └──required by──> Per-session name + icon + color badge (stored by ID)
    └──required by──> Persisted session order (order list references IDs)
    └──required by──> Startup-command-per-session config (config keyed by ID)
    └──required by──> Not-started session state (session exists before PTY)

Session metadata persistence (disk store)
    └──required by──> Persistent session list across app restarts
    └──required by──> Persisted session order
    └──required by──> Per-session custom name + icon + color badge

PTY terminal surface (xterm.js + node-pty)
    └──required by──> All table stakes terminal features (copy/paste, ANSI, keyboard, resize, scrollback)
    └──required by──> Clickable URLs (addon layered on xterm.js)

Collapsible sidebar
    └──requires──> Per-session icon (needs icon to identify session in collapsed state)
    └──requires──> Session status indicator (dot badge must show in collapsed state)

Optional startup command
    └──requires──> Shell spawn (normal shell mode) — startup command is injected after shell is live
```

### Dependency Notes

- **Status indicator requires PTY lifecycle events:** The `running/stopped/exited/error` states are only derivable from PTY process events; the UI cannot poll for them. Subscribe to node-pty `exit` and `error` events at spawn time.
- **Collapsible sidebar requires icon:** The collapsed state shows only an icon (+ status dot). If icon is missing or unset, collapsed mode is visually unusable. Session creation must enforce icon selection or provide a default.
- **Stable session ID must be assigned at creation:** All downstream features (metadata, ordering, config) key off this ID. It must be a UUID generated once and never recycled.
- **Not-started state enables pre-configured sessions:** A session can exist in metadata before a PTY is ever spawned. This is distinct from `stopped` (PTY ran and exited). The UI must handle both "never started" and "was running, now stopped" correctly.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what is needed to validate the core concept.

- [ ] Real interactive PTY terminal (node-pty + xterm.js) — without this, nothing else matters
- [ ] Full keyboard input (Ctrl+C, Ctrl+D, arrows, Tab) — required for any real shell use
- [ ] ANSI color rendering — required for coding agents and CLI tools
- [ ] Copy/paste from terminal — universal expectation
- [ ] Resize reflow — immediately visible breakage if missing
- [ ] Scrollback buffer — needed to review agent output
- [ ] Multiple concurrent sessions with stable logical IDs — core product concept
- [ ] Switch active session without killing background sessions — core product concept
- [ ] Collapsible sidebar with icon + name + status — the product's visual identity
- [ ] Per-session custom name + emoji/icon + color badge — the differentiator
- [ ] Session status indicator (not-started / running / stopped / exited / error) — essential for multi-agent situational awareness
- [ ] Stop and restart a session (same logical ID, new PTY process) — needed for recovering crashed agents
- [ ] Optional startup-command-per-session — the primary coding-agent use case
- [ ] Start in configured working directory — without this, users must `cd` manually every time
- [ ] Custom shell selection per session (PowerShell/CMD/WSL/zsh/bash) — table stakes for cross-platform
- [ ] Persist session metadata locally, restore profiles on reopen — without this, users recreate sessions every launch
- [ ] Persisted session order — sessions drifting in order is disorienting
- [ ] Platform-aware shell defaults — reduces friction on first launch

### Add After Validation (v1.x)

Features to add once core is working and the session model is validated.

- [ ] Clickable URLs in terminal output — high value, low cost; add after PTY is stable
- [ ] Search in terminal scrollback (Ctrl+F) — power-user feature; add once core UX is validated (see Gaps section)
- [ ] Keyboard shortcut to switch sessions (e.g. Ctrl+1..9 or Cmd+[/]) — fast navigation; add once sidebar is stable
- [ ] Clear terminal button / keyboard shortcut (Ctrl+L equivalent without polluting history) — common expectation
- [ ] Drag-to-reorder sessions in sidebar — nice-to-have UX polish once order persistence is working
- [ ] Font size zoom (Ctrl+= / Ctrl+-) — expected by power users; cheap to add with xterm.js

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Custom icon files (SVG/PNG) — emoji + built-in set is sufficient for MVP; defer to v2 when demand is confirmed
- [ ] Theme / color scheme settings (beyond default dark) — polish; not workflow-blocking
- [ ] Browser companion integration — explicitly deferred; keep session metadata API stable
- [ ] Export / import session configs — useful for sharing setups; not blocking MVP
- [ ] Session groups / folders in sidebar — organizing 10+ sessions; defer until users have that many
- [ ] Live process recovery after app quit — high complexity; defer until there is strong user demand
- [ ] Plugin system — defer until feature set is stable

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Real PTY terminal (node-pty + xterm.js) | HIGH | HIGH | P1 |
| Full keyboard input + ANSI rendering | HIGH | MEDIUM | P1 |
| Multiple sessions with stable IDs | HIGH | MEDIUM | P1 |
| Session switch without killing | HIGH | MEDIUM | P1 |
| Collapsible sidebar with icon + status | HIGH | MEDIUM | P1 |
| Per-session name + icon + color badge | HIGH | LOW | P1 |
| Session status indicator | HIGH | MEDIUM | P1 |
| Stop / restart session | HIGH | MEDIUM | P1 |
| Startup command per session | HIGH | LOW | P1 |
| Persist metadata + restore on reopen | HIGH | MEDIUM | P1 |
| Start in configured working directory | HIGH | LOW | P1 |
| Custom shell selection per session | HIGH | LOW | P1 |
| Scrollback buffer | HIGH | LOW | P1 |
| Copy / paste | HIGH | LOW | P1 |
| Resize reflow | HIGH | MEDIUM | P1 |
| Persisted session order | MEDIUM | LOW | P1 |
| Clickable URLs | MEDIUM | LOW | P2 |
| Keyboard shortcuts (session switching) | MEDIUM | LOW | P2 |
| Search in scrollback | MEDIUM | MEDIUM | P2 |
| Clear terminal shortcut | MEDIUM | LOW | P2 |
| Font size zoom | LOW | LOW | P2 |
| Drag-to-reorder sidebar | LOW | MEDIUM | P2 |
| Theme settings | LOW | MEDIUM | P3 |
| Custom icon files | LOW | HIGH | P3 |
| Session groups / folders | LOW | MEDIUM | P3 |

---

## Gaps the Spec May Have Missed

These are cheap and high-value features the PROJECT.md does not explicitly mention. Each is worth adding to Active requirements or v1.x scope.

| Gap Feature | Why High-Value | Complexity | Risk If Missed |
|-------------|----------------|------------|----------------|
| **Search in terminal scrollback** (Ctrl+F / Cmd+F) | Coding agents produce long output; users need to find error messages, filenames, or specific lines without scrolling. iTerm2, WezTerm, Hyper, Warp all support this. Users switching from those tools will miss it immediately. | MEDIUM | Users frustrated by inability to find text in long agent output; perceived as incomplete |
| **Keyboard shortcut to switch sessions** (e.g. Ctrl+1–9, Cmd+[, Cmd+]) | Clicking the sidebar to switch sessions interrupts keyboard flow; every serious terminal (Warp, iTerm2, tmux, VS Code) has keyboard-driven session/tab navigation. Especially important for collapsed sidebar state. | LOW | Reduces the product to mouse-only navigation; power users will complain |
| **Clear terminal button (and keyboard shortcut)** | Ctrl+L works inside most shells, but it also sends to the running process. A dedicated "clear viewport" action that does NOT inject a command into the shell history is expected in VS Code, iTerm2 (Cmd+K), and Windows Terminal. | LOW | Minor annoyance; workaround via typing `clear` exists but is less clean |
| **Configurable scrollback buffer size** | Default 1000 lines is insufficient for long agent runs. Users running `claude --rc` for extended tasks will overflow it. WezTerm, xterm.js, and iTerm2 all expose this. A settings option (e.g. 5000, 10000, unlimited) costs minimal effort. | LOW | Long agent sessions lose early output; users cannot diagnose failures |
| **Font size adjustment** (Ctrl+= to zoom in, Ctrl+- to zoom out, Ctrl+0 to reset) | Standard in every GUI terminal; developers adjust font size for readability or screensharing. xterm.js exposes `options.fontSize` directly. | LOW | Minor friction; no functional breakage |
| **Session rename in-place** (double-click or context menu on sidebar item) | Users want to rename sessions after creation without going through a full settings modal. VS Code, Windows Terminal, iTerm2 all support inline rename. | LOW | Users create sessions with generic names and then can not easily fix them |
| **Context menu on session in sidebar** (right-click: Rename, Restart, Stop, Delete) | Standard UX pattern for session list items in VS Code, Tabby, and IDE panels. Gives access to session actions without requiring keyboard shortcuts or toolbar buttons. | LOW | Discoverability of actions is poor; users may not find stop/restart |
| **New session button / keyboard shortcut** | Creating a new session should be one click or one keystroke (Cmd+N or +). All terminal apps provide this. A multi-session manager without fast new-session creation impedes flow. | LOW | Sessions feel hard to create; users avoid making new ones |
| **Notification / visual alert when background session needs input** | Coding agents frequently pause and wait for user input (permission prompts, confirmations). If the user is on a different session, they will miss it. A subtle badge or sidebar highlight (like ccmanager's "Waiting" state) is high value for the target use case. | MEDIUM | Users lose minutes because they do not notice a paused agent; this is the primary pain point the product is designed to solve |

**Highest priority gap:** The **"background session waiting for input" alert** is the most critical missed feature. The product's core use case is running multiple concurrent coding agents; agents regularly pause for user confirmation. Without a visible alert on the sidebar when a background session is waiting, users miss these prompts and think agents are still running. This deserves explicit status-indicator work — distinguishing `running` from `waiting-for-input` as separate states, driven by heuristics (output idle + prompt character pattern) or by the agent's own escape sequences.

---

## Competitor Feature Analysis

| Feature | iTerm2 | Windows Terminal | Warp | WezTerm | tmux | This Product |
|---------|--------|-----------------|------|---------|------|-------------|
| Real PTY | Yes | Yes | Yes | Yes | Yes | Yes (node-pty) |
| Named sessions/profiles | Profiles (persistent) | Profiles (persistent) | Sessions (per-run) | Workspaces | Named sessions | Yes (core differentiator) |
| Per-session icon/badge | No | No | No | No | No | Yes (differentiator) |
| Sidebar with icons | No (tabs only) | No (tabs only) | No | No | No | Yes (differentiator) |
| Session status indicator | Tab dot (new output) | No | Run status | No | No | Yes (differentiator) |
| Stable ID across restart | No | No | No | No | No | Yes (differentiator) |
| Startup command per profile | Yes | Yes | No | Yes | No | Yes |
| Collapsible to icons | No | No | No | No | No | Yes (differentiator) |
| Search in scrollback | Yes (robust) | No (as of 2024) | Yes | Yes (copy mode) | Yes (copy mode) | v1.x (gap) |
| Keyboard session switching | Cmd+1..9 | Ctrl+Tab | Yes | Yes | Ctrl+b + n/p | v1.x (gap) |
| Drag-to-reorder | Yes (drag tabs) | Yes (drag tabs) | Yes | Yes | No | v1.x |
| Plugin system | Yes | No | Yes | Yes (Lua config) | Yes | No (out of scope) |
| SSH management | No | No | Yes | Yes (mux) | No | No (out of scope) |
| Cloud sync | No | No | Yes | No | No | No (out of scope) |

---

## Sources

- [iTerm2 Features](https://iterm2.com/features.html) — session management, profiles, search, scrollback (HIGH confidence)
- [Warp Sessions Overview](https://docs.warp.dev/terminal/sessions/) — session navigation, restoration (HIGH confidence)
- [WezTerm Workspaces](https://wezterm.org/recipes/workspaces.html) — workspace/session model (HIGH confidence)
- [Windows Terminal Panes](https://learn.microsoft.com/en-us/windows/terminal/panes) — profile and keyboard shortcut patterns (HIGH confidence)
- [tmux Core Concepts](https://tmux.info/docs/core-concepts) — session/window/pane model (HIGH confidence)
- [Tabby Terminal](https://tabby.sh/) — cross-platform terminal with SSH, tabs, plugin system (MEDIUM confidence)
- [Hyper Terminal](https://hyper.is/) — Electron-based terminal, plugin system, URL detection (MEDIUM confidence)
- [ccmanager (GitHub)](https://github.com/kbwo/ccmanager) — coding agent session manager with status indicators (HIGH confidence for use-case validation)
- [opensessions (GitHub)](https://github.com/ataraxy-labs/opensessions) — tmux sidebar for coding agents, per-thread status markers (HIGH confidence for use-case validation)
- [Nimbalyst Session Manager Comparison](https://nimbalyst.com/blog/best-session-managers-for-claude-code-and-codex/) — UX patterns for Claude Code / Codex session management (MEDIUM confidence)
- [xterm.js ITerminalOptions](https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/) — scrollback, font, options API (HIGH confidence)
- [Hyperlinks in Terminal Emulators](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda) — OSC 8 standard and URL detection (HIGH confidence)
- [Agentastic Notifications](https://www.agentastic.dev/docs/features/notifications) — waiting-for-input detection pattern for coding agents (MEDIUM confidence)

---
*Feature research for: cross-platform local desktop terminal session manager (coding-agent workflows)*
*Researched: 2026-06-03*
