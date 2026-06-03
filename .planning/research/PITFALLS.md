# Pitfalls Research

**Domain:** Cross-platform local desktop terminal session manager (Electron + xterm.js + node-pty)
**Researched:** 2026-06-03
**Confidence:** HIGH — pitfalls verified against official docs, node-pty/xterm.js issue trackers, and Electron security documentation.

---

## Critical Pitfalls

### Pitfall 1: One-Shot Command Execution Instead of a Persistent PTY

**What goes wrong:**
Developers use `child_process.exec()` or `child_process.spawn()` without a PTY to run shell commands and display output. This produces no tty, so `isatty()` returns false in the child — interactive programs detect they are not in a terminal and refuse to cooperate. `claude --rc`, `codex`, `python` REPL, `vim`, `ssh`, and any program using readline or ncurses will behave incorrectly or not start at all. The Core Value of this project is violated on day one.

**Why it happens:**
`child_process.spawn()` is the obvious Node.js API for running a subprocess. The distinction between spawning a process and allocating a PTY is not surfaced in tutorials. Quick prototypes that show "it works" for simple commands mislead developers.

**How to avoid:**
Use `node-pty` exclusively via `pty.spawn()` for every terminal session. Never use `child_process` for interactive shell sessions. Validate with the canonical scenario: create a session with `claude --rc` as startup command and verify it launches the interactive agent, not a one-shot invocation.

**Warning signs:**
- `vim` opens but appears frozen or garbled immediately.
- `python` starts in script mode rather than REPL mode (no `>>>` prompt).
- Ctrl+C has no effect.
- `tput cols` inside the session prints 0 or 80 regardless of window size.
- Programs print "stdin is not a tty" warnings.

**Phase to address:**
Phase 1 (PTY Core) — this must be the foundation before any UI is built.

---

### Pitfall 2: Broken Ctrl+C / Ctrl+D / Signal Handling

**What goes wrong:**
Keyboard control characters are not forwarded as raw bytes to the PTY master. Pressing Ctrl+C in the xterm.js renderer does not send `\x03` to the PTY, so running processes ignore interrupt requests. `claude --rc` cannot be interrupted mid-generation; `npm run dev` cannot be stopped. Ctrl+D (`\x04`) — EOF on stdin — does not close REPLs.

**Why it happens:**
Two failure modes:
1. The Electron renderer intercepts Ctrl+C for clipboard copy instead of forwarding it to xterm.js. Many apps bind Ctrl+C globally in the renderer.
2. xterm.js is configured with `ctrlC` key bindings overridden or the `onKey` → PTY write pipeline is missing entirely — the terminal renders text but input is read-only.

**How to avoid:**
- Wire `terminal.onData(data => ptyProcess.write(data))` unconditionally — xterm.js translates all keystrokes, including control characters, into the correct byte sequences before this callback fires.
- Do not bind Ctrl+C, Ctrl+D, or Ctrl+Z at the Electron/BrowserWindow level; let xterm.js handle them.
- On Windows, ConPTY receives `\x03` and converts it to `CTRL_C_EVENT` automatically — do not replicate this in JavaScript.
- Write an integration test: spawn a `cat` process and verify that writing `\x03` terminates it.

**Warning signs:**
- Pressing Ctrl+C prints `^C` visually but running process does not stop.
- Ctrl+D does not close a `python` or `node` REPL.
- Long-running `claude --rc` generation cannot be interrupted.

**Phase to address:**
Phase 1 (PTY Core) — input forwarding must be verified before any session-management work.

---

### Pitfall 3: Resize Not Propagated — Programs Render at Wrong Width

**What goes wrong:**
The terminal window is resized (or the sidebar expands/collapses), xterm.js recalculates its column/row count, but `ptyProcess.resize(cols, rows)` is never called. The PTY's `TIOCSWINSZ` ioctl is never updated. Consequently, `tput cols` returns the original spawn-time value, shell prompts wrap incorrectly, TUI apps (vim, htop, less) draw to the wrong width, and `git diff` paginates with wrong line lengths.

**Why it happens:**
The resize event is a two-step operation: xterm.js emits a fit event (via the FitAddon) with new dimensions, and `node-pty` must receive `ptyProcess.resize(cols, rows)` separately. Developers wire the PTY spawn dimensions but forget to hook the resize callback. The Zed editor issue tracker documents exactly this — PTY dimensions were set at spawn and remained static.

**How to avoid:**
1. Install and use `@xterm/addon-fit`. Call `fitAddon.fit()` after any layout change (window resize, sidebar toggle, tab switch).
2. In the `fitAddon.fit()` post-hook (or via `terminal.onResize`), immediately call `ptyProcess.resize(terminal.cols, terminal.rows)`.
3. Also call resize when switching to a session whose terminal has not been visible — the xterm.js DOM may have been unsized.
4. Set `COLUMNS` and `LINES` environment variables on the initial spawn to match the actual rendered dimensions, not hardcoded defaults.

**Warning signs:**
- `tput cols` inside any session always returns 80.
- vim splits the screen at wrong column positions.
- Shell prompt wraps in the middle of a line.
- After sidebar collapse, `ls` output still formats for the old width.

**Phase to address:**
Phase 1 (PTY Core) — spawn dimensions and resize hook must be set up correctly from the start.

---

### Pitfall 4: node-pty ABI Mismatch with Electron

**What goes wrong:**
`node-pty` is a native addon (`.node` file compiled with node-gyp). When installed via `npm install`, it is compiled against the system Node.js ABI. Electron ships a different Node.js version with a different V8 ABI. Loading a module compiled for system Node inside Electron throws `MODULE_VERSION` mismatch errors at runtime. The app appears to build fine but crashes on first use.

**Why it happens:**
Electron embeds its own Node.js, which has a different ABI from the Node.js on `PATH`. `npm install` builds against system Node. The mismatch is not apparent during development if the developer never runs the packaged app.

**How to avoid:**
- Add `@electron/rebuild` as a dev dependency and run it after every `npm install` / package update: `npx electron-rebuild`.
- In CI, always run `electron-rebuild` as a post-install step before packaging.
- Pin the Electron version in `package.json` (`"electron": "^X.Y.Z"`) so rebuilds are stable.
- Consider `node-pty-prebuilt-multiarch` for teams that want to skip local compilation — it ships prebuilts for common Electron/Node ABI pairs. Verify coverage for your exact Electron version before relying on this.
- Never cross-compile `node-pty` for the wrong target (e.g., compiling on macOS for a Windows distribution requires Windows native tools; use a CI Windows runner instead).

**Warning signs:**
- App crashes immediately on startup with "was compiled against a different Node.js version" in the error log.
- Error: `NODE_MODULE_VERSION XX. This version of Node.js requires NODE_MODULE_VERSION YY`.
- Works in `npm start` (system Node) but crashes in the packaged `.app` or `.exe`.

**Phase to address:**
Phase 1 (PTY Core) — establish the rebuild pipeline before any other development; it is infrastructure.

---

### Pitfall 5: ASAR Archive Prevents node-pty from Loading

**What goes wrong:**
Electron packages app files into an `.asar` archive. `node-pty` includes a `spawn-helper` executable (macOS/Linux) or `winpty.dll` / `conpty.node` (Windows) that must exist as real filesystem files — they cannot be loaded from inside an ASAR archive. At runtime, `node-pty` fails to locate these helpers, causing PTY spawn to throw or silently fail.

**Why it happens:**
Electron automatically unpacks `.node` binary files from ASAR, but it does not automatically unpack arbitrary executables like `spawn-helper`. Developers assume "native modules are handled" and do not configure explicit unpack rules.

**How to avoid:**
In the packager configuration (electron-builder or Electron Forge), add explicit ASAR unpack patterns:
```json
"asarUnpack": [
  "node_modules/node-pty/build/**",
  "node_modules/node-pty/lib/pty.js"
]
```
Alternatively, set `asar: false` for development and verify that the production build with ASAR enabled still works before cutting a release. Write a smoke test that spawns a PTY in the packaged app, not just in development mode.

**Warning signs:**
- PTY spawn works in `npm start` (dev mode, no ASAR) but throws in the packaged app.
- Error messages referencing `app.asar/node_modules/node-pty/...` path not found.
- `spawn-helper: No such file or directory` in packaged app logs.

**Phase to address:**
Phase 2 (Packaging / Distribution) — must be addressed before first distributable build.

---

### Pitfall 6: macOS Notarization Blocked by Unnotarized Native Binaries

**What goes wrong:**
macOS Gatekeeper (Catalina 10.15 and later) requires all distributed apps to be notarized by Apple. If the ASAR-unpacked native `.node` files and helper executables are not included in the notarization submission, macOS shows "cannot be opened because the developer cannot be verified" — even when the app bundle itself is signed and notarized.

**Why it happens:**
Developers sign and notarize the app bundle but forget that the unpacked native binaries in `app.asar.unpacked/` are separate files that Apple's notarization scanner must also inspect. If they are not code-signed with a Developer ID before the notarization upload, the notarization ticket will not cover them.

**How to avoid:**
1. Sign all files in `app.asar.unpacked/` with `codesign --deep --force --sign "Developer ID Application: ..."` before creating the DMG/zip for notarization.
2. Use `@electron/notarize` (or Electron Forge's built-in notarization) which handles the stapling step automatically.
3. Use hardened runtime (`--options runtime`) to comply with Apple's notarization requirements.
4. Budget time: notarization adds 5-15 minutes per build and requires an Apple Developer Program membership (~$99/year).
5. Test on a separate macOS machine (or a clean VM) that has never accepted an exception for the app — Gatekeeper quarantine does not trigger on the developer's own machine.

**Warning signs:**
- Gatekeeper quarantine dialog on a fresh Mac despite successful notarization of the outer bundle.
- `codesign -vvv` shows unsigned files inside `app.asar.unpacked/`.
- Apple's notarization log includes warnings about unsigned executables.

**Phase to address:**
Phase 2 (Packaging / Distribution) — plan for this from the first packaged build; retrofitting after the fact is time-consuming.

---

### Pitfall 7: Broken Bracketed Paste Mode

**What goes wrong:**
When a shell enables bracketed paste mode (most modern shells do: bash 4+, zsh, fish), pasted text should be wrapped in `\x1b[200~` ... `\x1b[201~` escape sequences so the program can distinguish paste from typed input. If the Electron app handles paste events at the BrowserWindow level (e.g., via Clipboard API) instead of letting xterm.js handle them, the brackets are stripped. This causes multi-line pastes to be executed line-by-line as if typed, which can trigger shell history search, auto-accept incomplete commands, or execute dangerous commands prematurely.

**Why it happens:**
The Electron renderer's `paste` DOM event fires before xterm.js processes it. Developers who attach a global paste handler to improve UX accidentally bypass xterm.js's built-in bracketed paste implementation.

**How to avoid:**
- Let xterm.js handle all paste events natively. Do not attach a `paste` event listener to `document` or the BrowserWindow for the terminal view.
- Verify that `terminal.options.bracketedPasteMode` is not explicitly disabled.
- Test with zsh: paste a multi-line string and verify it arrives in the buffer without executing early.
- On Windows, test clipboard paste with ConPTY — there are historical issues with paste ordering in high-latency situations.

**Warning signs:**
- Pasting multiple lines executes each line immediately rather than placing them in the prompt.
- Vim receives pasted text with auto-indent applied (indicates brackets not received).
- Shell shows `^[[200~` literally in the prompt (brackets sent but not recognized — TERM mismatch).

**Phase to address:**
Phase 1 (PTY Core) — test immediately after wiring the paste path.

---

### Pitfall 8: ANSI / Truecolor Misconfiguration (TERM and COLORTERM)

**What goes wrong:**
The `TERM` environment variable is not set (or is set to `dumb` or `vt100`) when spawning the PTY. As a result, applications that check `TERM` for color support — including `claude --rc`, syntax highlighters, `git diff`, and many CLIs — produce plain uncolored output or incorrect escape sequences. If `COLORTERM=truecolor` is not set, tools fall back to 256-color mode and produce degraded output even though xterm.js supports 24-bit color.

**Why it happens:**
`node-pty` does not automatically inherit the developer's `TERM` value. On Windows, ConPTY spawns with `TERM` unset. Developers who test on macOS with their shell's `TERM=xterm-256color` already set do not notice the missing configuration until they package and test on a clean Windows install.

**How to avoid:**
When calling `pty.spawn()`, always pass explicit environment variables:
```javascript
env: {
  ...process.env,
  TERM: 'xterm-256color',
  COLORTERM: 'truecolor',
}
```
Do not rely on inheriting `process.env.TERM` — it may be unset or wrong in the packaged Electron environment. Verify by running `echo $TERM` and `echo $COLORTERM` inside a session.

**Warning signs:**
- `claude --rc` or other tools output plain text with no color.
- `git diff` shows no syntax highlighting.
- `echo $TERM` inside a session prints `dumb` or nothing.
- Truecolor test (printing 24-bit escape sequences) shows only 8 or 16 colors.

**Phase to address:**
Phase 1 (PTY Core) — set in the PTY spawn configuration; affects all subsequent testing.

---

### Pitfall 9: Alt-Screen Apps (vim, less, man) Leaking on Exit

**What goes wrong:**
Applications like vim, less, man, and htop use the terminal alt-screen (`smcup`/`rmcup` terminfo capabilities). When they exit normally, `rmcup` restores the original screen. If the process is killed forcibly (e.g., by closing the session tab without sending `q`/`:q`), the PTY process exits without sending `rmcup`, and the xterm.js buffer retains the last alt-screen frame. The next time the session is activated, the user sees a frozen vim screen instead of the shell prompt.

**Why it happens:**
Developers test the happy path (quit vim normally) but not the forced-kill path (close tab while vim is running). The xterm.js buffer captures whatever the PTY last wrote, which was the alt-screen content.

**How to avoid:**
- When stopping/closing a session, send `\x03` (SIGINT) then `q\r` to attempt graceful exit, then `SIGTERM`, then `SIGKILL` — with short delays.
- After a session ends, call `terminal.reset()` to clear the xterm.js buffer to a clean state, so reopening the session shows an empty terminal rather than stale output.
- Do not try to restore alt-screen content across restarts — only the scrollback below the alt-screen (normal buffer) should ever be considered for persistence.

**Warning signs:**
- After killing a vim session, restarting it shows the previous vim layout for a fraction of a second.
- Closing a session tab while `man git` is open leaves man's pager visible in the xterm.js buffer.
- `terminal.buffer.active.type` returns `'alternate'` when it should return `'normal'`.

**Phase to address:**
Phase 1 (PTY Core) for the kill/reset sequence; Phase 3 (Session Lifecycle) for the restart workflow.

---

### Pitfall 10: Missing Flow Control — Dropped or Garbled High-Throughput Output

**What goes wrong:**
Running `cat large-file.log` or `npm install` (which prints thousands of lines) causes xterm.js to buffer data faster than it can render. xterm.js has a hardcoded 50MB input buffer limit — data beyond this is silently discarded. Additionally, without flow control, the UI thread is blocked processing terminal output, making the app unresponsive to keyboard input during heavy output.

**Why it happens:**
The naive implementation pipes PTY data directly to `terminal.write()` without any backpressure mechanism. `terminal.write()` is non-blocking and queues data internally, so it appears to work until the buffer fills.

**How to avoid:**
Implement the XON/XOFF watermark pattern described in the xterm.js flow control guide:
```javascript
const HIGH_WATERMARK = 500_000; // bytes
const LOW_WATERMARK = 10_000;
let pending = 0;

pty.onData(data => {
  pending += data.length;
  if (pending > HIGH_WATERMARK) pty.pause();
  terminal.write(data, () => {
    pending -= data.length;
    if (pending < LOW_WATERMARK) pty.resume();
  });
});
```
node-pty also supports `flowControlPause` / `flowControlResume` options that use XON/XOFF signals. HIGH watermark must not exceed 500KB to keep the UI responsive.

**Warning signs:**
- `cat /dev/urandom | head -c 100M` causes the app to freeze or crash.
- Keyboard input is ignored for several seconds during heavy `npm install` output.
- Output of fast commands appears truncated or ends mid-line.
- Memory usage spikes to hundreds of MB during high-throughput sessions.

**Phase to address:**
Phase 1 (PTY Core) — implement watermark flow control alongside the PTY write pipeline.

---

### Pitfall 11: UTF-8 / Unicode Width Miscalculation

**What goes wrong:**
xterm.js uses a simplified Unicode width table by default. CJK characters and most emoji are not rendered as double-width cells, causing TUI layouts to misalign. Programs that use Unicode box-drawing (htop, ranger, many CLI tools) draw broken borders. Emoji in prompts (`🛋️` as a session icon if it appears in shell output) consume the wrong number of cells, causing cursor position corruption.

**Why it happens:**
xterm.js's default Unicode handling predates Unicode 11 emoji width rules. The `Unicode11Addon` exists to fix this, but it must be explicitly loaded and activated — it is not the default.

**How to avoid:**
```javascript
import { Unicode11Addon } from '@xterm/addon-unicode11';
const unicode11 = new Unicode11Addon();
terminal.loadAddon(unicode11);
terminal.unicode.activeVersion = '11';
```
Note: `unicode.activeVersion` is a proposed API — set `allowProposedApi: true` in the Terminal options. Also be aware that xterm.js v5 ships Unicode 12 width rules internally, and the addon activates Unicode 11 rules on top — this is the closest available approximation to correct behavior for modern emoji.

**Warning signs:**
- `htop` or `ranger` shows misaligned column borders.
- CJK text in shell output shifts the cursor to the wrong position.
- Emoji in the prompt or output causes the cursor to jump by the wrong number of columns.
- `printf '\U0001F6CB'` (sofa emoji) renders in a single column instead of two.

**Phase to address:**
Phase 1 (PTY Core) — configure Unicode addon when initializing the xterm.js Terminal instance.

---

### Pitfall 12: Killing PTY on Tab Switch (Session Loss)

**What goes wrong:**
When the user switches away from a session tab, the developer calls `ptyProcess.kill()` or destroys the xterm.js instance to "save memory." The session's running process (e.g., `npm run dev`, `claude --rc`) is terminated. When the user returns to the tab, the session is gone. This violates the project's second core value: stable session identity and instant non-destructive switching.

**Why it happens:**
Developers conflate "hide the UI" with "destroy the process." Tab-switch events look like cleanup opportunities. Tutorials for single-terminal apps show full teardown on close — this pattern is incorrectly applied to multi-tab managers.

**How to avoid:**
- PTY processes are never killed on tab switch — only on explicit user action (Stop button) or app quit.
- Detach xterm.js from the DOM when a tab is hidden (`terminal.element.remove()` or CSS `display:none`), but keep the `Terminal` instance alive and keep the `ptyProcess` running.
- Buffer PTY output to the inactive terminal instance using `terminal.write()` even when hidden — xterm.js continues to process data correctly when not attached to the DOM.
- On tab switch back, re-attach the terminal element to the DOM and call `fitAddon.fit()` + `ptyProcess.resize()`.

**Warning signs:**
- `npm run dev` stops when the user switches tabs.
- A session shows "exited" status immediately after switching away.
- Background `claude --rc` agent stops responding to prompts.

**Phase to address:**
Phase 3 (Session Lifecycle / Multi-Session Management).

---

### Pitfall 13: Memory Leaks from Unreleased xterm.js Instances

**What goes wrong:**
Each xterm.js `Terminal` instance holds a buffer that, with a 5000-line scrollback in truecolor mode, consumes ~34MB of RAM per session. If sessions are "destroyed" without calling `terminal.dispose()`, or if DOM listeners, addon references, or IPC callbacks retain a reference to the Terminal object, garbage collection never runs. With 10 sessions open for a workday, memory consumption becomes prohibitive.

**Why it happens:**
JavaScript object retention through closures is subtle. Common leaks:
- An `onData` callback closure captures `terminal` and is never removed.
- An IPC event listener (`ipcMain.on('pty-data', ...)`) captures the session object.
- A React/Vue component unmounts but the `Terminal` instance referenced in a ref survives.

**How to avoid:**
- Call `terminal.dispose()` and `ptyProcess.kill()` in the session cleanup path (explicit delete, not tab switch).
- Use `terminal.onData(handler)` disposables: `const disposable = terminal.onData(h); disposable.dispose()` on cleanup.
- Remove IPC listeners explicitly in the cleanup path using `ipcMain.removeHandler()` or the named listener pattern.
- Use a heap profiler (Chrome DevTools, connected to Electron's renderer) in development to verify sessions are GC'd after deletion.
- Cap scrollback per session (e.g., 3000 lines default, configurable to 10000) — do not use unlimited scrollback for sessions hosting high-output processes.

**Warning signs:**
- App memory grows monotonically after creating and deleting sessions.
- Chrome DevTools heap snapshot shows `Terminal` objects after all sessions are closed.
- App slows down noticeably after running for several hours with many session creates/deletes.

**Phase to address:**
Phase 3 (Session Lifecycle) — implement disposal lifecycle when building session create/delete.

---

### Pitfall 14: Logical Session ID vs. Process ID Confusion

**What goes wrong:**
The code uses the PTY process PID as the session identifier in the data store and IPC messages. When a session is stopped and restarted, a new PTY is spawned with a new PID. The old PID-keyed records become orphaned, IPC routing breaks (messages arrive for PID 1234 but the session now has PID 5678), and session metadata is lost or duplicated on restart.

**Why it happens:**
`ptyProcess.pid` is the most obvious unique identifier available immediately after spawn. Using it as the session key is the first-impulse implementation.

**How to avoid:**
Generate a stable UUID at session creation time (`crypto.randomUUID()`). Store it in the session metadata. All IPC channels, data store keys, and UI state use this UUID. The PTY process PID is stored as a transient field that is cleared on stop and updated on restart. The UUID never changes for the lifetime of the session.

```typescript
interface Session {
  id: string;           // UUID, stable forever
  pid: number | null;   // current PTY pid, null when stopped
  status: 'stopped' | 'running' | 'exited' | 'error';
  // ...
}
```

**Warning signs:**
- Restarting a session causes it to appear as a duplicate in the sidebar.
- IPC messages are routed to the wrong session after restart.
- Session metadata (name, icon, cwd) is lost after stop/restart.
- Console errors like "session not found: 5678" after restart.

**Phase to address:**
Phase 1 (Data Model) — the three-identity model (logical ID, PTY pid, user-visible identity) must be established before any session management code is written.

---

### Pitfall 15: Race Condition in Session Status State Machine

**What goes wrong:**
Session status transitions (stopped → running → exited → stopped) are driven by asynchronous events: PTY spawn, PTY `onExit`, user Stop action, and app startup restore. Without a guarded state machine, concurrent events cause invalid transitions: a Stop action arrives while the PTY is mid-exit, resulting in `ptyProcess.kill()` being called on an already-dead process (throws), or the status showing "running" while the process has already exited.

**Why it happens:**
Each event handler independently checks and sets status without locking. JavaScript is single-threaded but async — between `await spawn()` resolving and `onExit` firing, multiple state mutations can be queued.

**How to avoid:**
Implement an explicit state machine with valid transition guards:
```
not_started → starting → running → stopping → stopped
                                  → exited (process died)
                                  → error
```
Only allow `kill()` calls when status is `running` or `starting`. Ignore `onExit` events if status is already `stopped` (user already cleaned up). Use a single authoritative status field; never derive status from two separate booleans.

**Warning signs:**
- "Cannot read property 'kill' of null" errors in logs.
- Session shows "running" in the sidebar but the shell prompt is gone.
- Rapid stop/start produces duplicate `onExit` callbacks.
- Status shows "error" for sessions that exited normally.

**Phase to address:**
Phase 3 (Session Lifecycle) — build the state machine before implementing stop/restart UI.

---

### Pitfall 16: Store Corruption from Concurrent Writes

**What goes wrong:**
Multiple async operations (rename session, reorder tabs, save last-active timestamp on tab switch) all write to the same JSON or SQLite store simultaneously. With a flat JSON file and `fs.writeFile()`, the last writer wins and earlier changes are lost. With SQLite under default journal mode, concurrent writes from different async contexts produce `SQLITE_BUSY` errors or corrupted WAL state.

**Why it happens:**
Node.js is async but not parallel — developers assume "single-threaded means no concurrency issues." In practice, three IPC handlers can each call `db.write()` within the same event loop tick, and the second call overwrites the first.

**How to avoid:**
- For JSON files: use a write-queue (serialize all writes through a single async queue) or use `electron-store`, which handles atomic writes.
- For SQLite: enable WAL mode (`PRAGMA journal_mode=WAL`) and use `better-sqlite3` (synchronous API, no async race conditions from the JS side) rather than async sqlite3 wrappers.
- Never read-modify-write a session config without locking: use `UPDATE` SQL statements rather than fetch + mutate + overwrite.
- Treat the store as append-mostly for high-frequency events (status changes, last-active) and batch writes.

**Warning signs:**
- Session names revert to previous values intermittently.
- Session order in the sidebar is wrong after a restart.
- `SQLITE_BUSY` errors in logs during normal use.
- Intermittent loss of session metadata visible only in some runs.

**Phase to address:**
Phase 2 (Persistence) — design the write strategy before implementing any session mutation operations.

---

### Pitfall 17: Persisting Too Much — Trying to Restore Live Process State

**What goes wrong:**
Developers attempt to persist and restore the terminal scrollback buffer, environment variables of the running process, or the actual PTY state across app restarts. This is either technically infeasible (PTY state is kernel-managed, not serializable) or produces a misleading UX (old output shown as if the process is still running).

**Why it happens:**
The project requirement to "restore profiles on app reopen" is misread as "restore sessions including their running state." Terminal multiplexers (tmux, screen) do this with daemon persistence — an Electron app quit destroys the PTY.

**How to avoid:**
Per the PROJECT.md scope: persist only session metadata (ID, name, icon, cwd, shell, startup command, order, last active). Do not persist:
- Scrollback buffer (xterm.js `terminal.buffer` contents)
- Running process environment
- Live PTY file descriptors
On restart, restore the session profile (name, icon, shell, cwd, startup command) and leave the session in `not_started` state. The user starts the process manually.

**Warning signs:**
- App launch time grows proportionally with session scrollback size.
- Stale output from a previous run appears when opening a "restored" session.
- App tries to reconnect to a dead PTY PID from a previous run.

**Phase to address:**
Phase 2 (Persistence) — define persistence boundary explicitly in the data model.

---

### Pitfall 18: Storing Absolute Paths That Break Across Machines

**What goes wrong:**
Session working directory is persisted as an absolute path (e.g., `D:\Project\Marketing-parlour-room` on Windows, `/Users/jerry/Projects/app` on macOS). When session config is transferred to another machine, or the user moves the project folder, the stored path is invalid. The session spawns in the wrong directory silently (falls back to home or throws).

**Why it happens:**
The canonical validation scenario in PROJECT.md uses an absolute Windows path — it's the natural thing to store. No one thinks about path portability for a local app.

**How to avoid:**
- Store the configured path as-is (user's choice, often absolute), but validate existence at spawn time.
- If the path does not exist at spawn time, show a clear error ("working directory D:\... not found — update session settings") rather than silently spawning in `~`.
- For macOS dev where paths differ from Windows production: test with realistic Windows paths (using `path.win32` utilities) in the Windows packaging CI run.
- Do not normalize path separators in the stored string — store exactly what the user configured and let `node-pty`'s platform handling deal with it at spawn time.

**Warning signs:**
- Session spawns in `~` instead of the configured directory with no error shown.
- After moving a project folder, all sessions for that project silently start in the wrong place.
- Windows paths stored on macOS produce `path not found` on Windows due to drive-letter assumptions.

**Phase to address:**
Phase 2 (Persistence) — validate paths at spawn time, not at save time.

---

### Pitfall 19: Hardcoded Shell Paths / Platform Assumptions

**What goes wrong:**
Shell discovery uses hardcoded paths (`/bin/zsh`, `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`) rather than querying the platform. On macOS, Homebrew-installed zsh lives at `/opt/homebrew/bin/zsh` on Apple Silicon and `/usr/local/bin/zsh` on Intel. On Windows, PowerShell 7 (`pwsh.exe`) is at a different path than PowerShell 5 (`powershell.exe`). Git Bash and WSL have environment-dependent paths. Hardcoded paths break on a significant fraction of real user machines.

**Why it happens:**
The developer tests on one machine where the hardcoded path happens to be correct. macOS dev → Windows production is the most dangerous case in this project: the macOS developer hardcodes `/bin/zsh` and tests successfully; then the Windows user gets a "shell not found" error because Windows does not have `/bin/zsh`.

**How to avoid:**
Use platform-detection at runtime:
```javascript
import { platform } from 'os';

const defaultShells = {
  win32: ['pwsh.exe', 'powershell.exe'].find(shellExists),
  darwin: process.env.SHELL || '/bin/zsh',
  linux: process.env.SHELL || '/bin/bash',
};
```
For Windows, use `where.exe powershell` or `which` equivalents via `child_process.execSync`. Provide a per-session shell selector in the UI, with sensible per-platform defaults. Never assume a shell binary is at a fixed path.

**Warning signs:**
- "spawn /bin/zsh: ENOENT" on Windows.
- "No such file: C:\Windows\..." on a non-standard PowerShell install.
- Works on developer machine, fails on the test Windows machine immediately.

**Phase to address:**
Phase 1 (Shell Discovery) — implement platform-aware shell detection before any session creation UI.

---

### Pitfall 20: ConPTY Minimum Windows Version Requirement

**What goes wrong:**
node-pty 1.x removed winpty support entirely, requiring Windows 10 build 18309 (version 1809, October 2018) or later for ConPTY. If the app targets users on older Windows 10 builds or Windows 8/8.1, PTY spawn will fail with a cryptic error. The developer, testing on macOS, never encounters this.

**Why it happens:**
From the macOS dev environment, Windows version constraints are invisible. winpty removal in node-pty happened to simplify the codebase, but it shifted the minimum Windows version requirement to a specific build number, not just "Windows 10."

**How to avoid:**
- Add a startup version check on Windows: `os.release()` returns the NT kernel version; map it to the Windows 10 build number and show a clear error if below 10.0.17763 (build 1809).
- Document the minimum Windows requirement in the app's system requirements.
- Test on a Windows 10 VM at the minimum build in CI if possible.
- If supporting older Windows is required, pin to a node-pty version that still includes winpty (0.x series) — but be aware this means maintaining an older, less supported branch.

**Warning signs:**
- "ConPTY not available" errors on Windows during testing.
- Users on older enterprise Windows installs reporting the app won't start.

**Phase to address:**
Phase 2 (Packaging / Distribution) — add version check and document requirements.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `nodeIntegration: true` in renderer | No IPC boilerplate needed, direct Node API access | XSS in any rendered content → immediate RCE; fails Electron security audit; CVE risk | Never |
| `contextIsolation: false` | Simpler preload authoring | Renderer code can access Node globals; eliminates the security boundary contextIsolation provides | Never |
| Using `child_process.spawn()` instead of node-pty | Simpler setup, no native rebuild | Breaks all interactive programs; violations of Core Value; not recoverable without rewrite | Never |
| Flat JSON file for session store, no write queue | Fastest to implement | Concurrent write corruption; data loss on crash | Prototype only, replace before Phase 2 |
| Hardcoded `TERM=xterm-256color` without explicit spawn env | Works on developer machine | Breaks on Windows (TERM unset) or non-standard environments | Acceptable if always set explicitly, not inherited |
| Single xterm.js instance reused across sessions | Saves memory | State leaks between sessions; alt-screen corruption; cursor position errors | Never |
| Skipping `electron-rebuild` in CI | Faster builds | ABI mismatch in production package; silent failure | Never |
| Storing full scrollback in persistence store | "Restore session as-is" UX | Prohibitive file size; stale data UX confusion; not feasible for live processes | Never |
| Using `ptyProcess.pid` as session identifier | No UUID dependency | Breaks on restart; orphaned records; IPC routing failures | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| node-pty + Electron | Using system Node ABI build | Run `@electron/rebuild` after every install; add to CI pipeline |
| node-pty + ASAR | Assuming `.node` unpack is sufficient | Explicitly configure `asarUnpack` to include `spawn-helper` and all native helpers |
| xterm.js FitAddon | Calling `fit()` without then calling `ptyProcess.resize()` | Wire `terminal.onResize` to always call `ptyProcess.resize(cols, rows)` |
| xterm.js + clipboard | Handling `paste` at BrowserWindow level | Let xterm.js own all paste events; do not attach global paste handlers |
| xterm.js + Unicode | Using default Unicode width table | Load and activate `Unicode11Addon` at terminal initialization |
| xterm.js + memory | Not calling `terminal.dispose()` on session delete | Maintain a disposal registry; call `dispose()` and remove all IPC listeners on session delete |
| PTY spawn + env | Inheriting Electron `process.env` | Explicitly set `TERM`, `COLORTERM`, and sanitize inherited env for security |
| Electron IPC + PTY | Exposing raw `ipcRenderer` in preload | Use `contextBridge.exposeInMainWorld` with narrow, typed API methods only |
| macOS notarization | Notarizing bundle but not native binaries | Sign and notarize all files in `app.asar.unpacked/` explicitly |
| Windows ConPTY | Assuming all Windows 10 installs support ConPTY | Check build number ≥ 17763 at startup; display clear error otherwise |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No flow control on PTY data | UI freezes during `cat large-file`; keyboard unresponsive | Implement HIGH/LOW watermark (500KB/10KB) with `pty.pause()`/`pty.resume()` | Any session with >1 MB/s output |
| Unlimited xterm.js scrollback | Memory grows to gigabytes over a workday with high-output sessions | Cap scrollback (default 3000 lines, max 10000); do not set `scrollback: Infinity` | After ~30 minutes of verbose output |
| Attaching all xterm.js addons to all sessions | Addon overhead multiplied by session count | Load addons once and reuse, or lazy-load per session | 5+ concurrent sessions |
| Writing PTY output on every data event without batching | Excessive IPC overhead from main-to-renderer messages | Batch PTY output chunks before IPC send (50ms debounce or 4KB accumulator) | Sessions with many small writes |
| Re-rendering entire session list on any state change | Sidebar flicker; CPU spikes on status changes | Key sessions by stable UUID; use fine-grained reactive updates | 5+ sessions with frequent status changes |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `nodeIntegration: true` | XSS → immediate RCE; attacker runs arbitrary shell commands | Keep `nodeIntegration: false`, `contextIsolation: true` at all times |
| Exposing raw `ipcRenderer` via `contextBridge` | Renderer can send any IPC message, including privileged ones | Expose only named, typed methods that map to single IPC messages |
| IPC handlers without argument validation | Malicious renderer injects arbitrary shell commands via startup-command or cwd fields | Validate all IPC arguments with schema (type, length, allowed characters) in `ipcMain.handle` |
| Executing startup commands without sanitization | `; rm -rf ~` injected via session config field | Treat startup command as a shell argument, not a raw exec string; display a confirmation prompt for commands from untrusted config imports |
| Storing secrets (API keys) in session env config | Plaintext credentials on disk in `userData` directory | Never store secrets in session metadata; document that env vars with secrets should be set in shell profile, not session config |
| `webSecurity: false` in BrowserWindow | Disables same-origin policy; enables cross-origin data exfiltration | Never disable webSecurity; there is no legitimate reason to do so for this app |
| Not validating `event.sender` in IPC handlers | Any renderer window can invoke privileged PTY operations | In every `ipcMain.handle`, verify `event.senderFrame.url` matches expected app URL |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Stopping session on tab switch | Running agents (`claude --rc`) are killed silently; user loses work | Keep PTY alive on hide; only stop on explicit user action |
| No status distinction between "not started" and "exited" | User cannot tell if session needs to be started or crashed | Use four distinct states: not_started / running / stopped / exited — with different visual indicators |
| Resize not called after tab switch | TUI apps (vim, htop) render at wrong width after switching back | Call `fitAddon.fit()` + `ptyProcess.resize()` on every tab activation |
| Alt-screen leak on forced close | User sees frozen vim on next session open | Call `terminal.reset()` after PTY process exits |
| Ambiguous "Error" status | User cannot distinguish network error, crash, or shell not found | Capture the exit code and last error output; display it as a tooltip on the error status indicator |
| Paste executes lines immediately | Multi-line paste runs commands the user didn't intend to submit | Ensure bracketed paste is working (test explicitly with zsh); never intercept paste at the BrowserWindow level |

---

## "Looks Done But Isn't" Checklist

- [ ] **PTY fidelity:** Session appears to work for simple commands — verify with `vim`, `python` REPL, `claude --rc`, and `ssh` before declaring PTY layer complete.
- [ ] **Ctrl+C:** Killing processes with Ctrl+C appears to work — verify that the interrupt reaches the process by checking that a tight `while True: pass` Python loop actually stops.
- [ ] **Resize:** Terminal resizes visually — verify that `tput cols` inside the session matches the actual rendered width after every resize event including sidebar toggle.
- [ ] **ABI / ASAR:** App runs in dev mode — verify the packaged app (`.app` / `.exe`) starts and opens a PTY before shipping.
- [ ] **Bracketed paste:** Paste works — verify that pasting 3 lines into a zsh prompt does not execute them immediately.
- [ ] **Background sessions:** Switching tabs appears non-destructive — verify that `npm run dev` keeps outputting logs while another session is active.
- [ ] **Session restart:** Stop + Start creates a new PTY — verify that the logical session ID is unchanged and the session name/icon/cwd are preserved.
- [ ] **Memory:** App memory after 30 minutes of use is reasonable — verify no growth trend from session creates/deletes using Activity Monitor / Task Manager.
- [ ] **Unicode:** Basic Latin works — verify CJK and emoji in shell output render with correct widths (htop box-drawing intact).
- [ ] **macOS notarization:** Signed on developer machine — verify on a fresh Mac with no developer exception that Gatekeeper allows launch.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong exec strategy (child_process instead of PTY) | HIGH | Full rewrite of session spawn layer; likely requires redoing IPC contracts |
| ABI mismatch discovered post-release | MEDIUM | Add `electron-rebuild` to CI; cut a patch release with correctly compiled binary |
| ASAR unpack missing spawn-helper | LOW | Add `asarUnpack` config, cut patch release |
| Logical ID / PID confusion in data model | HIGH | Migrate store schema; all existing session data may need UUID back-fill |
| Flow control missing | MEDIUM | Add watermark wrapper around existing PTY data handler; no architecture change |
| contextIsolation disabled | MEDIUM | Enable contextIsolation; rewrite preload to use contextBridge — likely requires 1-2 days of IPC refactoring |
| Memory leaks from unreleased terminals | MEDIUM | Audit all session delete paths; add disposal calls; may require component refactor |
| macOS notarization failure | MEDIUM | Re-sign all unpacked binaries; re-submit for notarization; 15-30 minute turnaround per attempt |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| One-shot exec instead of PTY | Phase 1 (PTY Core) | `vim`, `claude --rc`, `python` REPL all work interactively |
| Broken Ctrl+C / signals | Phase 1 (PTY Core) | `while True: pass` stops on Ctrl+C |
| Resize not propagated | Phase 1 (PTY Core) | `tput cols` matches rendered width after resize and sidebar toggle |
| node-pty ABI mismatch | Phase 1 (Dev Infrastructure) | Packaged app opens PTY without crash |
| ASAR unpack missing | Phase 2 (Packaging) | Packaged app PTY spawn works with ASAR enabled |
| macOS notarization | Phase 2 (Packaging) | Fresh Mac accepts launch without Gatekeeper dialog |
| Bracketed paste broken | Phase 1 (PTY Core) | 3-line paste into zsh does not auto-execute |
| TERM / COLORTERM unset | Phase 1 (PTY Core) | `echo $TERM` returns `xterm-256color` in session |
| Alt-screen leak | Phase 1 (PTY Core) + Phase 3 | Close vim forcibly; reopen session shows clean prompt |
| Flow control missing | Phase 1 (PTY Core) | `cat /dev/urandom \| head -c 50M` doesn't freeze or crash |
| Unicode width errors | Phase 1 (PTY Core) | htop box-drawing intact; emoji in prompt correct width |
| PTY killed on tab switch | Phase 3 (Multi-Session) | `npm run dev` output continues while other session is active |
| xterm.js memory leaks | Phase 3 (Multi-Session) | Heap stable after 10 create/delete cycles |
| Logical ID / PID confusion | Phase 1 (Data Model) | Stop + Start preserves session name, icon, IPC routing |
| Status state machine races | Phase 3 (Session Lifecycle) | Rapid stop/start produces no duplicate events or null errors |
| Store concurrent write corruption | Phase 2 (Persistence) | Rename + reorder fired simultaneously produces consistent result |
| Persisting live process state | Phase 2 (Persistence) | App restart shows sessions in not_started state, not running |
| Absolute path across machines | Phase 2 (Persistence) | Invalid path shows clear error, does not silently spawn in ~ |
| Hardcoded shell paths | Phase 1 (Shell Discovery) | Works on Windows with non-standard PowerShell path |
| ConPTY minimum Windows version | Phase 2 (Packaging) | App shows version check error on Windows 10 pre-1809 |
| Security: nodeIntegration / contextIsolation | Phase 1 (Dev Infrastructure) | Electron security checklist passes; no `nodeIntegration: true` in codebase |
| Security: IPC surface exposure | Phase 1 (Dev Infrastructure) | No raw `ipcRenderer` exposed; all IPC handlers validate arguments |

---

## Sources

- [xterm.js Flow Control Guide](https://xtermjs.org/docs/guides/flowcontrol/) — watermark values, buffer limits, XON/XOFF implementation
- [xterm.js ITerminalOptions API](https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/) — `allowProposedApi`, `bracketedPasteMode` configuration
- [xterm.js Unicode 11 Addon](https://www.npmjs.com/package/@xterm/addon-unicode11) — required for correct CJK/emoji width
- [node-pty GitHub](https://github.com/microsoft/node-pty) — ConPTY requirements, winpty removal, Windows 10 1809 minimum
- [node-pty issue #372: ASAR + winpty.dll](https://github.com/microsoft/node-pty/issues/372) — ASAR unpack requirement for Windows native deps
- [node-pty issue #382: Proper PTY kill in Electron](https://github.com/microsoft/node-pty/issues/382) — zombie process cleanup guidance
- [Electron Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules) — ABI rebuild requirement
- [@electron/rebuild GitHub](https://github.com/electron/rebuild) — ABI mismatch tooling
- [Electron Security Tutorial](https://www.electronjs.org/docs/latest/tutorial/security) — contextIsolation, nodeIntegration, IPC validation
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) — contextBridge patterns
- [Electron Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing) — macOS notarization requirements
- [node-pty-prebuilt-multiarch](https://github.com/homebridge/node-pty-prebuilt-multiarch) — prebuilt binary coverage matrix
- [xterm.js issue #1518: Memory leak on dispose](https://github.com/xtermjs/xterm.js/issues/1518) — disposal pattern requirements
- [xterm.js issue #1059: Emoji/unicode width](https://github.com/xtermjs/xterm.js/issues/1059) — double-width character bugs
- [ConPTY Integration (DeepWiki)](https://deepwiki.com/microsoft/node-pty/4.4-conpty-integration) — ConPTY vs winpty architecture differences
- [BigBinary: Code-sign and notarize Electron app](https://www.bigbinary.com/blog/code-sign-notorize-mac-desktop-app) — macOS notarization step-by-step
- [Doyensec: Subverting Electron via insecure preload](https://blog.doyensec.com/2019/04/03/subverting-electron-apps-via-insecure-preload.html) — IPC exposure attack patterns
- [termstandard/colors](https://github.com/termstandard/colors) — COLORTERM truecolor detection standard
- [SQLite concurrent writes (Fractaled Mind)](https://fractaledmind.com/2023/10/13/sqlite-myths-concurrent-writes-can-corrupt-the-database/) — WAL mode recommendation

---
*Pitfalls research for: cross-platform local desktop terminal session manager (Electron + xterm.js + node-pty)*
*Researched: 2026-06-03*
