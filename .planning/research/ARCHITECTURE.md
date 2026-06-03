# Architecture Research

**Domain:** Cross-platform local desktop terminal session manager (Electron + xterm.js + node-pty)
**Researched:** 2026-06-03
**Confidence:** HIGH (VSCode terminal architecture is well-documented; node-pty and xterm.js APIs are stable and authoritative)

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          RENDERER PROCESS (BrowserWindow)                 │
│                                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  SessionA   │  │  SessionB   │  │  SessionC   │  │  Sidebar    │     │
│  │  xterm inst │  │  xterm inst │  │  xterm inst │  │  UI         │     │
│  │  (visible)  │  │  (hidden*)  │  │  (hidden*)  │  │  React      │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │                │             │
│  ┌──────┴────────────────┴────────────────┴────────────────┴──────────┐  │
│  │                  contextBridge API (preload.ts)                     │  │
│  │  terminal.write(id, data) | terminal.resize(id, cols, rows)        │  │
│  │  terminal.onOutput(id, cb) | session.create/stop/restart/list      │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────────────┼────────────────────────────────────┘
                                      │  Electron IPC (ipcMain / ipcRenderer)
                                      │  Channels: terminal:input, terminal:output,
                                      │            terminal:resize, session:create,
                                      │            session:status, session:list
┌─────────────────────────────────────┼────────────────────────────────────┐
│                          MAIN PROCESS                                      │
│                                                                            │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │                        SessionRegistry                            │    │
│  │  Map<logicalId, SessionRecord>                                    │    │
│  │  logicalId (uuid) → { meta, status, ptyHandle | null }           │    │
│  └───────────────────────┬───────────────────────────────────────────┘    │
│                          │                                                 │
│  ┌───────────────────────┴───────────────────────────────────────────┐    │
│  │                        PtyHostService                             │    │
│  │  Wraps node-pty; owns all IPtyProcess instances                   │    │
│  │  Handles: spawn, kill, resize, write, onData, onExit routing      │    │
│  │  Output buffer per session (ring buffer, capped ~200 KB)          │    │
│  └───────────────────────┬───────────────────────────────────────────┘    │
│                          │                                                 │
│  ┌───────────────────────┴───────────────────────────────────────────┐    │
│  │                        PersistenceService                         │    │
│  │  electron-store JSON in app.getPath('userData')                   │    │
│  │  Read at startup; debounced writes on SessionRegistry mutation    │    │
│  └───────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
                          │
                   node-pty (native .node)
                   ConPTY (Windows) / forkpty (macOS)
                          │
              ┌───────────┴───────────┐
              │  Shell process A      │  Shell process B  ...
              │  (powershell, zsh…)   │
              └───────────────────────┘

* Hidden sessions: xterm DOM container set to display:none (not destroyed).
  PTY stays alive; output is routed into the ring buffer and replayed to
  xterm on tab switch so the scrollback is current.
```

---

## Component Responsibilities

| Component | Responsibility | Lives In |
|-----------|----------------|----------|
| `SessionRegistry` | Canonical map of all logical sessions; owns the status state machine; decouples logicalId from ptyPid | Main process |
| `PtyHostService` | Creates/destroys `node-pty` IPtyProcess instances; routes raw output to the correct session buffer and IPC channel; calls `pty.resize()` | Main process |
| `PersistenceService` | Serialises/deserialises SessionRecord metadata to disk via electron-store; debounced writes; no live-process state | Main process |
| `ShellResolver` | Returns ordered default shell list per OS; validates shell executable exists | Main process (util) |
| `preload.ts` (contextBridge) | Exposes a typed, minimal API surface to the renderer; wraps `ipcRenderer.invoke/on`; hides raw Electron IPC | Preload script |
| `SessionStore` (renderer state) | React/Zustand store mirroring session metadata in UI; receives status events over IPC | Renderer process |
| `TerminalPanel` | Mounts/unmounts xterm.js Terminal instance per logical session; handles `show/hide` via CSS; wires `onData` → `contextBridge.write` | Renderer process |
| `FitService` | Observes `ResizeObserver` on the terminal container; calls `terminal.fit()` then propagates new cols/rows via `contextBridge.resize` | Renderer process |
| `Sidebar` | Renders session list from `SessionStore`; dispatches `activateSession`, `createSession`, `stopSession`, `restartSession` | Renderer process |

---

## Recommended Project Structure

```
src/
├── main/
│   ├── index.ts                 # Electron entry: creates BrowserWindow, registers IPC handlers
│   ├── session-registry.ts      # SessionRecord map + status state machine
│   ├── pty-host.ts              # node-pty wrapper, output routing, ring buffer per session
│   ├── persistence.ts           # electron-store read/write, schema, debounce wrapper
│   ├── shell-resolver.ts        # OS-aware shell discovery
│   └── ipc-handlers.ts          # Registers all ipcMain.handle() / ipcMain.on() calls
├── preload/
│   └── preload.ts               # contextBridge.exposeInMainWorld('terminal', API)
├── renderer/
│   ├── main.tsx                 # React root
│   ├── stores/
│   │   └── session-store.ts     # Zustand store; mirrors SessionRecord[] from main
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── TerminalPanel.tsx    # One instance per logicalId; show/hide via CSS
│   │   ├── TerminalContainer.tsx# Hosts the xterm Terminal, wires resize observer
│   │   └── SessionStatusBadge.tsx
│   └── services/
│       └── fit-service.ts       # ResizeObserver → term.fit() → IPC resize
├── shared/
│   ├── types.ts                 # SessionRecord, SessionStatus, IPC channel constants
│   └── constants.ts             # Ring buffer size, debounce ms, status values
└── assets/
    └── icons/                   # Built-in icon set for session identity
```

### Structure Rationale

- **`main/` vs `renderer/`:** Strict separation mirrors Electron's process model. Node.js APIs and native modules only ever appear in `main/`; the renderer is a sandboxed browser context.
- **`preload/`:** Single preload boundary. contextBridge is the only bridge; nothing leaks raw IPC or Node APIs to the renderer.
- **`shared/types.ts`:** Both sides import the same type definitions to keep the IPC contract typed end-to-end without cross-process imports of runtime code.
- **`pty-host.ts` separate from `session-registry.ts`:** Registry owns the _logical_ model; PTY host owns the _process_ model. This enforces the logicalId/processId separation at the module boundary.

---

## Architectural Patterns

### Pattern 1: Logical Session ID Decoupled from Process ID

**What:** Each session has two distinct identities — a stable `logicalId` (UUID generated at session creation, never changes) and an ephemeral `ptyPid` (assigned on spawn, null when stopped, replaced on restart).

**When to use:** Always — this is the defining constraint from the spec.

**Trade-offs:** A small join is needed at every PTY event (`pid → logicalId`), but this is just a Map lookup.

```typescript
// shared/types.ts
export type SessionStatus =
  | 'not_started'   // created but never spawned
  | 'running'       // PTY alive
  | 'stopped'       // user-requested stop (process killed)
  | 'exited'        // process exited on its own (exit code 0)
  | 'error';        // process exited with non-zero code or spawn failure

export interface SessionRecord {
  // Logical identity — stable, user-visible
  logicalId: string;          // UUID, generated once at creation
  name: string;
  icon: string;               // emoji or built-in icon key
  color?: string;             // badge color
  order: number;              // sidebar position

  // Session configuration
  shell: string;              // full path to shell executable
  cwd: string;
  startupCommand?: string;    // optional command run after spawn
  lastActive?: number;        // unix ms

  // Runtime state — NOT persisted to disk
  status: SessionStatus;
  ptyPid?: number;            // undefined when status is not 'running'
  exitCode?: number;
}

// main/session-registry.ts
const sessions = new Map<string, SessionRecord>();
const pidToLogicalId = new Map<number, string>();   // fast reverse lookup
```

### Pattern 2: PTY Output Ring Buffer + Replay on Tab Switch

**What:** Each session maintains an in-memory ring buffer in the main process. When a tab is hidden, incoming PTY output still flows into the buffer. When the tab becomes visible again, buffered data is replayed into the xterm instance before resuming live streaming.

**When to use:** Essential for background session fidelity. Without this, a user switching back to a busy session sees a frozen screen.

**Trade-offs:** Memory usage grows with number of sessions and buffer size. Cap at ~200 KB per session (configurable) — enough for typical REPL/agent output without unbounded growth.

```typescript
// main/pty-host.ts  (sketch)
const outputBuffers = new Map<string, Uint8Array[]>();  // logicalId → chunks

pty.onData((data) => {
  const buf = outputBuffers.get(logicalId)!;
  buf.push(Buffer.from(data));
  trimBuffer(buf, MAX_BUFFER_BYTES);   // ring eviction

  // Send to renderer only if session is active (tab visible)
  if (activeSessionId === logicalId) {
    mainWindow.webContents.send(`terminal:output:${logicalId}`, data);
  }
});

// On tab switch: flush buffer then resume live
ipcMain.handle('terminal:activate', (_, logicalId) => {
  activeSessionId = logicalId;
  const chunks = outputBuffers.get(logicalId) ?? [];
  for (const chunk of chunks) {
    mainWindow.webContents.send(`terminal:output:${logicalId}`, chunk);
  }
  outputBuffers.set(logicalId, []);
});
```

### Pattern 3: xterm DOM Retain (CSS hide/show, never destroy)

**What:** Every session's xterm Terminal instance is created once and mounted into the DOM. Inactive sessions are hidden with `display: none` (or `visibility: hidden`). The xterm instance is never disposed between tab switches.

**When to use:** Always for background sessions that must survive tab switching.

**Trade-offs:** Memory proportional to number of open sessions (each xterm instance holds its scrollback buffer in the renderer). For MVP with ~10 sessions this is fine; with 50+ it may warrant lazy instantiation on first activation.

**Critical:** xterm requires a visible (dimension-bearing) DOM element for `open()` and for `fit()`. Use `visibility: hidden` instead of `display: none` if the element needs measurable dimensions at creation time. For subsequent hide/show after initial open, `display: none` is safe and uses no paint resources.

```typescript
// renderer/components/TerminalPanel.tsx  (sketch)
const termRefs = useRef<Map<string, Terminal>>(new Map());

function activateSession(logicalId: string) {
  // Hide all panels
  termRefs.current.forEach((_, id) => {
    document.getElementById(`panel-${id}`)!.style.display = 'none';
  });
  // Show active
  document.getElementById(`panel-${logicalId}`)!.style.display = 'block';
  // Fit to new container size
  fitAddon.fit();
  window.terminal.resize(logicalId, term.cols, term.rows);
}
```

### Pattern 4: Flow Control with High/Low Watermark

**What:** Use the xterm.js `write()` callback combined with PTY pause/resume to prevent OOM during high-throughput output (e.g., `cat large_file`, `yes` pipe).

**When to use:** Production use — skip this and `cat /dev/urandom` will exhaust the 50 MB xterm write buffer and silently discard data.

**Trade-offs:** Adds latency to output rendering proportional to the write callback overhead. Tune HIGH/LOW thresholds.

```typescript
// renderer/components/TerminalContainer.tsx  (sketch)
const HIGH_WATERMARK = 100_000;   // bytes
const LOW_WATERMARK  =  10_000;

let pendingBytes = 0;
let paused = false;

window.terminal.onOutput(logicalId, (data: string) => {
  pendingBytes += data.length;
  if (!paused && pendingBytes > HIGH_WATERMARK) {
    paused = true;
    window.terminal.setPaused(logicalId, true);   // IPC → pty.pause()
  }
  term.write(data, () => {
    pendingBytes -= data.length;
    if (paused && pendingBytes < LOW_WATERMARK) {
      paused = false;
      window.terminal.setPaused(logicalId, false);  // IPC → pty.resume()
    }
  });
});
```

### Pattern 5: Resize Propagation Chain

**What:** A `ResizeObserver` on the terminal container fires `fitAddon.fit()`, which computes new cols/rows from the container's pixel dimensions. Those values are sent via IPC to `pty.resize(cols, rows)`. This must happen _after_ the tab becomes visible so container has real dimensions.

**When to use:** Every time the window resizes or a tab switch reveals a previously hidden terminal.

**Data flow:**
```
Window resize / tab becomes visible
    → ResizeObserver fires on container element
    → fitAddon.fit()  [computes cols/rows from px]
    → term.cols, term.rows
    → ipcRenderer.invoke('terminal:resize', { logicalId, cols, rows })
    → main: pty.resize(cols, rows)
    → PTY sends SIGWINCH to shell
    → Shell redraws (vim, claude --rc, etc. reflow)
```

**Important:** When switching from a hidden tab to a visible one, always call `fit()` _after_ `display: block` is applied. Calling it while the element has `display: none` gives 0x0 dimensions, which corrupts vim/ncurses apps.

---

## Session Status State Machine

```
             create()
                │
         ┌──────▼──────┐
         │ not_started │  (session profile exists, no PTY yet)
         └──────┬──────┘
                │ spawn() — PtyHostService.spawn(logicalId)
                │           assigns new ptyPid
         ┌──────▼──────┐
    ┌───►│   running   │◄──────────────────────────────┐
    │    └──────┬──────┘                                │
    │           │ stop() — user requests kill           │ restart()
    │           │ ─────────────────────────────────┐    │ (kill if running +
    │           │ onExit(code=0) — clean exit       │    │  new spawn, same id)
    │           │ ─────────────────────────────┐   │    │
    │           │ onExit(code≠0) — error exit   │   │   │
    │           │ ────────────────────────┐     │   │   │
    │    ┌──────▼──────┐  ┌───────▼───┐  │     │   │   │
    │    │   stopped   │  │  exited   │  │     ▼   ▼   │
    │    └──────┬──────┘  └─────┬─────┘  │  ┌──────────┴─┐
    │           │               │        └─►│   error    │
    │           │ restart()     │ restart() │            │
    └───────────┴───────────────┴───────────┴────────────┘
                               │ destroy()
                               ▼
                        (removed from registry)
```

**Invariants:**
- `logicalId` is never reused, never changes.
- `ptyPid` is `undefined` unless `status === 'running'`.
- Transition to `running` always assigns a fresh `ptyPid` from the new spawn.
- `exitCode` is set on `exited` and `error` transitions; cleared on next `running` transition.
- `not_started` is valid after create and also valid as an initial state when a profile is restored from disk (live processes are never restored).

---

## Data Flow

### Input Flow (Keystroke → PTY)

```
User keypress in xterm
    → xterm emits onData(input: string)
    → TerminalPanel: window.terminal.write(logicalId, input)
    → preload.ts: ipcRenderer.invoke('terminal:input', { logicalId, data })
    → main ipcMain.handle('terminal:input')
    → PtyHostService: sessions.get(logicalId).pty.write(data)
    → OS PTY / shell process receives input
```

### Output Flow (PTY → xterm)

```
Shell writes output to PTY master
    → node-pty fires onData(data: string)
    → PtyHostService:
        - appends to outputBuffer[logicalId]  (ring buffer)
        - if logicalId === activeSessionId:
            mainWindow.webContents.send('terminal:output:' + logicalId, data)
    → preload.ts: registered listener fires onOutput callback
    → TerminalPanel: term.write(data, flowControlCallback)
    → xterm renders to canvas
```

### Resize Flow

```
Container pixel dimensions change (window resize or tab reveal)
    → ResizeObserver callback
    → fitAddon.fit()  — computes { cols, rows } from px / charSize
    → ipcRenderer.invoke('terminal:resize', { logicalId, cols, rows })
    → main: pty.resize(cols, rows)
    → OS sends SIGWINCH to child process
    → Shell / interactive program redraws
```

### Status Event Flow

```
node-pty onExit({ exitCode, signal })
    → PtyHostService: updates SessionRegistry status (running → exited/error/stopped)
    → clears ptyPid, sets exitCode
    → mainWindow.webContents.send('session:status', { logicalId, status, exitCode })
    → preload.ts: listener fires
    → renderer SessionStore: updates session status
    → Sidebar re-renders badge
    → PersistenceService: debounced write triggered
```

### Session Create Flow

```
User submits create-session form
    → ipcRenderer.invoke('session:create', { name, icon, shell, cwd, startupCommand })
    → main: SessionRegistry.create() — generates logicalId (UUID v4), status='not_started'
    → PersistenceService.save() (immediate — new record)
    → if startupCommand or autoStart: PtyHostService.spawn(logicalId)
    → returns { logicalId } to renderer
    → renderer SessionStore.addSession()
    → Sidebar renders new entry
```

### App Reopen / Profile Restore Flow

```
app ready
    → PersistenceService.load() → SessionRecord[]
    → for each record: SessionRegistry.restore(record)
        - status forced to 'not_started'  (never 'running' — no live restore)
        - ptyPid = undefined
    → send 'session:list' to renderer on window-ready
    → renderer SessionStore.hydrate(records)
    → Sidebar renders all sessions with 'not_started' status
    → User manually starts desired sessions
```

---

## IPC Channel Contract

All channels are typed in `shared/types.ts`. The preload script exposes them through `contextBridge` — the renderer never calls `ipcRenderer` directly.

| Channel | Direction | Payload | Notes |
|---------|-----------|---------|-------|
| `session:create` | R→M | `CreateSessionParams` | Returns `{ logicalId }` |
| `session:list` | R→M (invoke) | — | Returns `SessionRecord[]` |
| `session:stop` | R→M | `{ logicalId }` | Kills PTY, transitions to `stopped` |
| `session:restart` | R→M | `{ logicalId }` | Kill + respawn, same logicalId |
| `session:destroy` | R→M | `{ logicalId }` | Remove from registry + persistence |
| `session:update-meta` | R→M | `{ logicalId, patch }` | Rename, icon change, reorder |
| `session:status` | M→R | `{ logicalId, status, exitCode? }` | Push event |
| `terminal:input` | R→M | `{ logicalId, data: string }` | Keystroke/paste |
| `terminal:output:{id}` | M→R | `data: string` | Per-session channel to avoid fan-out |
| `terminal:resize` | R→M | `{ logicalId, cols, rows }` | After fit addon computes dims |
| `terminal:activate` | R→M | `{ logicalId }` | Flush buffer + mark active |
| `terminal:set-paused` | R→M | `{ logicalId, paused: boolean }` | Flow control pause/resume |

**Channel naming for output:** Use per-session channels (`terminal:output:${logicalId}`) rather than a single fan-out channel. This prevents the renderer from having to demux every output event and avoids sending data to invisible listeners. The preload registers a listener per session on creation and removes it on destruction.

---

## Persistence Layer

### What Is Persisted

```typescript
// Serialised to disk — metadata only, no runtime state
interface PersistedSession {
  logicalId: string;
  name: string;
  icon: string;
  color?: string;
  order: number;
  shell: string;
  cwd: string;
  startupCommand?: string;
  lastActive?: number;
  // status, ptyPid, exitCode — NOT persisted
}
```

### Storage Location

`electron-store` writes to `app.getPath('userData')`:
- macOS: `~/Library/Application Support/<AppName>/config.json`
- Windows: `C:\Users\<user>\AppData\Roaming\<AppName>\config.json`

### Write Strategy

Write only in the main process (`PersistenceService`). Use a debounced write with a 500 ms delay triggered by:
- Session create / destroy
- Session metadata change (name, icon, order, cwd, startupCommand)
- `lastActive` update on session activation

Do NOT write on status changes (running/stopped/exited) — those are runtime state.

Atomic writes are handled by electron-store internally. No additional locking is needed for a single-process writer.

---

## Cross-Platform Edges

### Shell Discovery

```typescript
// main/shell-resolver.ts
import { platform } from 'os';
import { existsSync } from 'fs';

function getDefaultShells(): ShellOption[] {
  if (platform() === 'win32') {
    return [
      { label: 'PowerShell',  exe: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' },
      { label: 'PowerShell 7', exe: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' },
      { label: 'CMD',         exe: 'C:\\Windows\\System32\\cmd.exe' },
      { label: 'Git Bash',    exe: 'C:\\Program Files\\Git\\bin\\bash.exe' },
      { label: 'WSL',         exe: 'C:\\Windows\\System32\\wsl.exe' },
    ].filter(s => existsSync(s.exe));
  }
  // macOS
  return [
    process.env.SHELL ?? '/bin/zsh',
    '/bin/zsh',
    '/bin/bash',
  ].filter(existsSync).map(exe => ({ label: exe.split('/').pop()!, exe }));
}
```

- Read `process.env.SHELL` on macOS as the primary default; fall back to `/bin/zsh`.
- On Windows, check each well-known path with `existsSync` — don't assume paths.
- WSL requires `wsl.exe` as the executable, not a direct Linux binary path.
- Store the full resolved shell path in `SessionRecord.shell` at creation time, not a symbolic name.

### Path Normalization

- Store `cwd` as a native OS path (backslashes on Windows, forward slashes on macOS).
- Use Node's `path` module, not string manipulation.
- Pass `cwd` directly to `node-pty` spawn; it handles the OS-level path internally.
- For display in UI, use `path.basename(cwd)` as a short label.

### Native Module Packaging

node-pty is a native `.node` add-on that must be rebuilt for Electron's specific Node ABI:

1. Run `@electron/rebuild` in `postinstall` to recompile for target Electron version.
2. Configure ASAR unpacking for both `pty.node` and `spawn-helper` (the secondary executable node-pty uses internally on macOS/Linux):
   ```json
   // electron-forge maker config (or electron-builder)
   "asar": { "unpack": "**/{*.node,spawn-helper}" }
   ```
3. On Windows, ConPTY support requires Windows build 18309+ (Windows 10 1809). No special ASAR handling is needed for the Windows binary — only the `.node` file.
4. After packing, verify spawn-helper lands outside the ASAR at the path node-pty expects relative to `pty.node`. The exact relative path can shift between node-pty versions; test after every node-pty version bump.

---

## Anti-Patterns

### Anti-Pattern 1: Storing ptyPid as the Session's Primary Key

**What people do:** Use the process PID returned by `pty.pid` as the ID passed around the app.

**Why it's wrong:** The PID is recycled by the OS when the process exits. After a restart, the new PTY has a different PID — all references break. Restarting a session appears to create a new session.

**Do this instead:** Generate a UUID at session creation and use it as `logicalId` everywhere. Map `ptyPid → logicalId` in a secondary index for PTY event routing only.

### Anti-Pattern 2: Running node-pty in a Worker Thread

**What people do:** Move PTY work to a worker thread to keep the main thread unblocked.

**Why it's wrong:** node-pty explicitly documents it is not thread-safe. Running across multiple workers causes crashes and undefined behavior.

**Do this instead:** Keep all node-pty calls on the main thread. If heavy CPU work is needed, put that work (not the PTY) in a worker thread or a child process.

### Anti-Pattern 3: Disposing and Recreating xterm on Tab Switch

**What people do:** Call `terminal.dispose()` when hiding a session tab, then `new Terminal()` + `open()` when the user switches back.

**Why it's wrong:** Scrollback history is lost. The terminal state (cursor position, alt screen, modes) is reset. Interactive programs like vim or claude --rc see a disconnected terminal.

**Do this instead:** Create each xterm Terminal instance once. Hide/show with CSS. Keep the instance alive for the full session lifetime. Dispose only when the session is destroyed.

### Anti-Pattern 4: Skipping Flow Control for "Simple" Output

**What people do:** Wire `pty.onData → term.write(data)` directly without any backpressure.

**Why it's wrong:** xterm.js has a hardcoded 50 MB write buffer. Commands like `cat large_file`, `npm install` with verbose output, or running `yes` will overflow it, silently dropping data. The user sees a frozen or garbled terminal.

**Do this instead:** Implement the high/low watermark pattern using the `write()` callback and `pty.pause()` / `pty.resume()`.

### Anti-Pattern 5: Calling fit() Before the Terminal Container Is Visible

**What people do:** Call `fitAddon.fit()` immediately after creating an xterm instance regardless of whether its DOM container is visible.

**Why it's wrong:** A container with `display: none` has zero pixel dimensions. fit() computes `cols=0, rows=0` and passes those to `pty.resize()`, which corrupts the terminal dimensions. vim and other curses programs then render broken.

**Do this instead:** Always call `fit()` _after_ setting the container to `display: block`. On initial creation, open the terminal in a briefly-visible state (or use `visibility: hidden` rather than `display: none`), then proceed.

### Anti-Pattern 6: Persisting Runtime Status to Disk

**What people do:** Save `status: 'running'` to the session store file.

**Why it's wrong:** On app reopen, the app tries to restore a "running" session that no longer exists. Either it attempts to reconnect (no process to connect to) or displays a misleading running badge.

**Do this instead:** Never persist `status`, `ptyPid`, or `exitCode`. On load, always initialize restored sessions to `not_started`. The user explicitly starts sessions they want.

---

## Suggested Build Order (Phase Dependencies)

This order minimises integration risk by establishing the load-bearing core first, then layering on non-destructive features.

```
Phase 1 — Skeleton + PTY Core
  • Electron app boots, single BrowserWindow
  • Main process spawns one hardcoded PTY (zsh/PowerShell)
  • Single xterm.js instance in renderer
  • Raw IPC: terminal:input, terminal:output, terminal:resize
  • Fit addon + ResizeObserver
  Validates: terminal fidelity (the Core Value) before building anything else

Phase 2 — Session Registry + Multiple PTYs
  • SessionRegistry with logicalId/ptyPid split
  • PtyHostService manages N concurrent PTYs
  • Per-session output ring buffer
  • IPC channels: session:create, session:stop, session:restart, session:status
  • Renderer holds multiple xterm instances (DOM hidden/show via CSS)
  • Tab activation flushes ring buffer, calls fit()
  Validates: background session survival, tab switching, state machine

Phase 3 — Session Identity + Sidebar UI
  • Sidebar component with session list (name, icon, status badge)
  • SessionRecord: name, icon, color, order
  • session:update-meta, session:destroy IPC
  • Reorder sessions (drag or up/down arrows)
  Validates: user-visible identity model

Phase 4 — Persistence
  • PersistenceService with electron-store
  • Debounced writes on metadata change
  • Profile restore on app reopen (status reset to not_started)
  • Shell discovery (ShellResolver, per-OS defaults)
  • Per-session shell + cwd + startupCommand configuration
  Validates: sessions survive app restart as profiles

Phase 5 — Flow Control + Robustness
  • High/low watermark backpressure (pty.pause/resume + write callback)
  • terminal:set-paused IPC
  • Error handling: spawn failure, unexpected exit, cwd does not exist
  • status: error with exitCode surfaced in sidebar badge
  Validates: high-throughput output, error UX

Phase 6 — Packaging
  • @electron/rebuild in postinstall
  • ASAR unpack for pty.node + spawn-helper
  • Electron Forge / electron-builder config for Windows + macOS
  • Code signing stubs (unsigned local build is fine for MVP)
  • Test on both platforms: fidelity + packaging
  Validates: distributable artifact on both OSes
```

**Key dependency chain:**
- Phase 1 must complete before Phase 2 (PTY core before multi-session)
- Phase 2 must complete before Phase 3 (session model before identity UI)
- Phase 3 can overlap Phase 4 (UI and persistence are independent)
- Phase 5 can be done in parallel with Phase 4 (flow control is a PTY concern, persistence is orthogonal)
- Phase 6 is last (packaging is a wrapper around a working app)

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Renderer ↔ Main | Electron IPC via contextBridge | Typed channels in shared/types.ts; no raw ipcRenderer in renderer |
| Main ↔ node-pty | Direct function calls, event callbacks | All on main thread; never worker threads |
| PtyHostService ↔ SessionRegistry | Direct module import | Both in main process; single-process, no IPC needed |
| SessionRegistry ↔ PersistenceService | Direct function calls, triggered on mutations | Debounce in PersistenceService layer |
| xterm ↔ FitService | DOM ResizeObserver + xterm Terminal API | Renderer-only; no IPC until resize values are determined |

---

## Sources

- VS Code integrated terminal architecture (PTY host / multi-session): https://deepwiki.com/microsoft/vscode/6-integrated-terminal
- Superset terminal daemon deep dive (daemon architecture, ring buffer, backpressure): https://superset.sh/blog/terminal-daemon-deep-dive
- xterm.js flow control guide: https://xtermjs.org/docs/guides/flowcontrol/
- node-pty README (ConPTY/forkpty, thread safety, API): https://github.com/microsoft/node-pty/blob/main/README.md
- node-pty Electron example: https://github.com/microsoft/node-pty/tree/main/examples/electron
- Electron IPC official docs: https://www.electronjs.org/docs/latest/tutorial/ipc
- Electron native modules + packaging: https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules
- node-pty + Electron Forge packaging (ASAR, spawn-helper): https://thomasdeegan.medium.com/electron-forge-node-pty-9dd18d948956
- electron-store (userData persistence): https://github.com/sindresorhus/electron-store
- Electron contextBridge security: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- xterm.js Terminal API: https://xtermjs.org/docs/api/terminal/classes/terminal/
- @electron/rebuild: https://github.com/electron/rebuild

---
*Architecture research for: cross-platform local desktop terminal session manager*
*Researched: 2026-06-03*
