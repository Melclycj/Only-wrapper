# Phase 2: PTY Core + Terminal Fidelity - Research

**Researched:** 2026-06-04
**Domain:** node-pty (main process) ↔ xterm.js (renderer) PTY streaming over a sandboxed contextBridge; native terminal fidelity on Electron 36.9.5 / macOS arm64
**Confidence:** HIGH (stack, IPC, flow control, shell invocation); MEDIUM (xterm major-version pin — see Open Questions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Launch `$SHELL` (fallback `/bin/zsh`) as LOGIN + interactive.** Source order must include `.zprofile`/`.zlogin` AND `.zshrc` so PATH matches Terminal.app (Homebrew, nvm, asdf resolve). **Inherit the full parent environment**, then set/override `TERM=xterm-256color` and `COLORTERM=truecolor`. Spawn layer stays OS-agnostic per CLAUDE.md even though Phase 2 is macOS-first.
- **D-02: Auto-start a single live shell on app launch** (no gating click) with cwd = the user's **home directory** (`~`). TERM-04's "configured working directory" defaults to home here because there is no creation UI yet.
- **D-03: macOS copy/paste — Cmd+C / Cmd+V + right-click paste.** Cmd+C copies the selection; Cmd+V pastes using **bracketed paste** so multi-line paste never auto-executes (SC2); right-click pastes. **Ctrl+C remains SIGINT** (distinct key). **No copy-on-select.**
- **D-04: Default scrollback = 10,000 lines** (`scrollback: 10000`). On shell exit, show a **passive "process exited" notice** — no auto-restart. SC5 responsiveness is met via flow control, independent of buffer size.

### Claude's Discretion

- **Renderer:** single full-window xterm pane, default monospace font, block cursor, no sidebar/header chrome (Phase 4).
- **xterm stack (per CLAUDE.md):** `@xterm/xterm` 5.5 + `addon-fit`, `addon-webgl` (default) / `addon-canvas` (fallback), `addon-web-links`, `addon-unicode11`.
- **IPC:** extend typed `window.api` / `ElectronAPI` with PTY channels (create / write / onData / resize / onExit). Never expose raw `ipcRenderer`. Channel naming + PTY-byte encoding → this research.
- **Resize:** debounce window resize → `addon-fit` → `pty.resize(cols, rows)` within the 1 s SC3 budget.
- **node-pty pin & packaging:** exact version against Electron **36.9.5** ABI + `.node` ASAR-unpack / `@electron/rebuild` → this research.
- **Flow control (SC5):** xterm write-batching + node-pty pause/resume backpressure → this research.

### Deferred Ideas (OUT OF SCOPE — do not plan)

- Multiple sessions, sidebar/tabs, session identity UI, stop/restart controls, status lifecycle, configured startup commands, persistence, scrollback search, scrollback-size setting, Windows-shell specifics, packaging/makers. (Phases 3–8.)
- Configurable font/theme → v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TERM-01 | Real interactive terminal surface (keyboard, stdout/stderr, Ctrl+C/D, arrows, copy/paste, resize, ANSI, long-running + interactive programs) | xterm.js 5.5 instance + `onData` keystroke forwarding → `pty.write`; `pty.onData` → `term.write`; addon-fit for resize; bracketed paste for multi-line (Pattern 4, 5, 6) |
| TERM-02 | Real PTY layer (input → PTY → output → render), NOT run→capture | node-pty `spawn()` in main process keyed by `LogicalId`; full-duplex stream (Pattern 1, 2). `child_process.exec` is explicitly banned (CLAUDE.md "What NOT to Use") |
| TERM-03 | Normal shell → manual `cd` → launch tools (`claude --rc`, `codex`) | Login+interactive `$SHELL` with full inherited env so PATH matches Terminal.app (D-01, Pattern 3). No startup command this phase |
| TERM-04 | Each session starts in its configured cwd | `pty.spawn(shell, args, { cwd })`; cwd = `os.homedir()` this phase (D-02) |
</phase_requirements>

## Summary

Phase 2 wires a single `node-pty` pseudo-terminal in the **main** process to an `@xterm/xterm` instance in the **renderer**, streaming bytes both directions over the typed `contextBridge` seam built in Phase 1. The whole phase is the Core Value proof: `claude --rc`, `vim`, `python`, and `ssh` must behave exactly like they do in Terminal.app. Three things make that true — (1) spawning the shell as **login + interactive with full inherited env** so PATH resolution is identical to native, (2) faithfully forwarding *every* byte/keystroke in both directions (no line-buffering, no command capture), and (3) **flow control** so a 50 MB `cat` never freezes the UI or drops output.

The stack is already locked by CLAUDE.md and partly pre-wired by Phase 1: `node-pty` is marked `external` in `vite.main.config.ts`, ESLint bans it in renderer/shared, `@electron-forge/plugin-auto-unpack-natives` is in `forge.config.ts`, and `electron-rebuild -f` is the `postinstall`. **node-pty 1.1.0 (stable, 2025-12-22) is the correct pin** — it is a from-source V8-ABI native module that `@electron/rebuild` compiles against Electron 36.9.5's ABI (node-abi 4.31.0 registers Electron 36). It is NOT a NAPI module, so it must be rebuilt per Electron version; the existing postinstall already does this.

The one genuine version tension: **CLAUDE.md locks `@xterm/xterm` 5.5.0 with `addon-canvas` as the WebGL fallback, but xterm.js shipped 6.0.0 which *removed* the canvas addon.** I recommend honoring the locked decision and pinning the **5.5.x line** (xterm 5.5.0 + addon-webgl 0.18.0 + addon-canvas 0.7.0 + addon-fit 0.10.0 + addon-web-links 0.11.0 + addon-unicode11 0.8.0 — the 5.x-compatible addon majors). Adopting xterm 6 would contradict CLAUDE.md and invalidate the canvas-fallback decision; that is a user decision, not a research call (see Open Questions Q1).

**Primary recommendation:** Pin `node-pty@1.1.0` + the `@xterm/xterm@5.5.x` addon family. Spawn `zsh -l` (login) on a PTY (interactive) with full inherited env + `TERM=xterm-256color`/`COLORTERM=truecolor`. Stream via a per-`LogicalId` IPC channel set (`pty:create`/`pty:write`/`pty:resize` invoke+send, `pty:data`/`pty:exit` main→renderer events) added to the typed bridge. Use the **official xterm.js watermark flow-control pattern** (HIGH=100000 / LOW=10000, `term.write(chunk, cb)` + `pty.pause()`/`pty.resume()`) for SC5. Debounce resize → `fitAddon.fit()` → `pty.resize(cols, rows)`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PTY process spawn/kill/write/resize | Main process | — | node-pty is a native module; banned in renderer/shared by ESLint + sandbox; CLAUDE.md "never run node-pty in renderer" |
| Shell selection + login/interactive env | Main process | Shared (types only) | `$SHELL` resolution + env composition is Node logic; only the resulting `SessionRecord` fields live in shared |
| Byte stream PTY→renderer | Main (`pty.onData`) → Preload (`ipcRenderer.on`) → Renderer (`term.write`) | — | Main owns the PTY; preload bridges; renderer renders. No direct main↔renderer |
| Keystroke stream renderer→PTY | Renderer (`term.onData`) → Preload (`ipcRenderer.send`) → Main (`pty.write`) | — | xterm captures input; bridge forwards; main writes to PTY |
| Terminal rendering (ANSI, truecolor, Unicode, scrollback) | Renderer (xterm + addons) | — | GPU/Canvas rendering is a Chromium concern; lives entirely in renderer |
| Flow control / backpressure | Split: renderer write-callback ↔ main pause/resume | — | Watermark accounting straddles both; renderer's `term.write` callback signals when main may resume |
| Resize (fit → cols/rows → pty.resize) | Renderer (`addon-fit`) → Preload → Main (`pty.resize`) | — | Fit measures the DOM container (renderer); main applies new dims to the PTY |
| Copy/paste + bracketed paste | Renderer (xterm) | Main (menu/clipboard if needed) | Selection + paste are xterm/DOM; Cmd+C/V are renderer key handlers |
| Window/PTY lifecycle cleanup | Main process | — | `pty.kill()` on window close / `before-quit`; renderer cannot own native handles |

## Standard Stack

### Core (new in Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-pty | **1.1.0** | Pseudo-terminal in main process (forkpty on macOS, ConPTY on Windows) | Microsoft-maintained, powers VS Code's terminal; only production-proven PTY for Electron. `latest` dist-tag = 1.1.0, published 2025-12-22 [VERIFIED: npm registry] |
| @xterm/xterm | **5.5.0** (locked by CLAUDE.md; 6.0.0 exists — see Q1) | Terminal renderer (WebGL/Canvas), ANSI/VT, scrollback, Unicode | Industry standard; CLAUDE.md locks 5.5. Scoped `@xterm/*` package (unscoped `xterm` deprecated) [VERIFIED: npm registry — 5.5.0 published & 6.0.0 current] [CITED: CLAUDE.md lock] |

### Supporting (xterm addons — pin to the 5.x-compatible majors)

| Library | Version (5.x line) | Purpose | When to Use |
|---------|--------------------|---------|-------------|
| @xterm/addon-fit | 0.10.0 | Resize xterm to fill its container div | Always — drives resize→pty.resize (SC3) |
| @xterm/addon-webgl | 0.18.0 | WebGL2 GPU renderer (default path) | Default renderer; 2–5× faster for high-throughput (SC5) |
| @xterm/addon-canvas | 0.7.0 | Canvas 2D renderer fallback | Only when WebGL2 context creation fails. **Removed in xterm 6** — exists only on the 5.x line (see Q1) |
| @xterm/addon-web-links | 0.11.0 | Clickable URL detection | Always — agent output contains URLs |
| @xterm/addon-unicode11 | 0.8.0 | Correct cell-width for CJK/emoji (SC4) | Always — `activateUnicodeVersion('11')` after load; htop borders/CJK depend on it |

> **Addon-major pinning rule:** addon major versions track the xterm major. The `0.11/0.19/0.7/0.12/0.9` versions currently on `latest` are built for **xterm 6**. For xterm **5.5** use the 5.x-compatible majors above (`addon-fit@0.10`, `addon-webgl@0.18`, `addon-canvas@0.7`, `addon-web-links@0.11`, `addon-unicode11@0.8`). The planner MUST `npm view <addon> versions` and select the highest minor whose peer range includes `@xterm/xterm@5.5`. [CITED: xtermjs release notes — addon majors are version-locked to core major]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-pty 1.1.0 (rebuilt) | node-pty-prebuilt-multiarch | Prebuilds avoid the rebuild step but lag Electron versions (no Electron 28 builds historically) and are a third-party fork. CLAUDE.md + Phase-1 postinstall already chose rebuild-from-source. Stay with official node-pty. |
| node-pty `pause()`/`resume()` (manual watermark) | node-pty `handleFlowControl: true` (XON/XOFF) | Built-in XON/XOFF flow control intercepts `\x13`/`\x11` from the *child* and is meant for child-driven flow control; it does NOT give the renderer backpressure. The renderer-driven **watermark** pattern (write-callback) is the canonical xterm.js approach for UI responsiveness. Use the watermark pattern. [CITED: xtermjs.org/docs/guides/flowcontrol] |
| @xterm/xterm 5.5 | @xterm/xterm 6.0 | 6.0 is current but **removes addon-canvas**, removes `windowsMode`, reworks the viewport/scrollbar, and swaps the event system (EventEmitter→Emitter). Contradicts CLAUDE.md's locked 5.5 + canvas-fallback. Escalate as Q1, don't silently adopt. |
| WebGL renderer | DOM renderer | DOM renderer is the slowest; only for debugging. WebGL is required for SC5 throughput. |

**Installation (planner — verify exact 5.x-compatible addon minors at plan time):**
```bash
# PTY (native — rebuilt against Electron 36 by existing postinstall)
npm install node-pty@1.1.0

# Terminal renderer + addons (5.x line, honoring CLAUDE.md lock)
npm install @xterm/xterm@5.5.0 \
  @xterm/addon-fit@^0.10.0 \
  @xterm/addon-webgl@^0.18.0 \
  @xterm/addon-canvas@^0.7.0 \
  @xterm/addon-web-links@^0.11.0 \
  @xterm/addon-unicode11@^0.8.0

# Rebuild node-pty against Electron 36.9.5 ABI (postinstall already runs this; run explicitly after install)
npx electron-rebuild -f -w node-pty
```

**Version verification done this session:** `npm view node-pty version` → 1.1.0 (2025-12-22); `npm view @xterm/xterm version` → 6.0.0 (5.5.0 still published); addons current majors are 6-line (0.11/0.19/0.7/0.12/0.9). Environment confirmed: Node v22.19.0, Electron **36.9.5** installed, darwin **arm64**, `$SHELL=/bin/zsh`, node-abi 4.31.0 (registers Electron 36), `electron-rebuild` present in `node_modules/.bin`.

## Package Legitimacy Audit

slopcheck 0.6.1 is installed but targets PyPI; all packages below are canonical Microsoft / xterm.js org packages with multi-year history and were verified via `npm view` against the npm registry. node-pty's `install`/`postinstall` scripts were inspected (see note).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| node-pty | npm | 8+ yrs | 10M+/wk | github.com/microsoft/node-pty | N/A (PyPI tool) | Approved — Microsoft, powers VS Code |
| @xterm/xterm | npm | scoped since v5 (2022) | 5M+/wk | github.com/xtermjs/xterm.js | N/A | Approved — industry standard |
| @xterm/addon-fit | npm | scoped since v5 | — | xtermjs/xterm.js | N/A | Approved — official addon |
| @xterm/addon-webgl | npm | scoped since v5 | — | xtermjs/xterm.js | N/A | Approved — official addon |
| @xterm/addon-canvas | npm | scoped since v5 | — | xtermjs/xterm.js | N/A | Approved (5.x only — removed in 6) |
| @xterm/addon-web-links | npm | scoped since v5 | — | xtermjs/xterm.js | N/A | Approved — official addon |
| @xterm/addon-unicode11 | npm | scoped since v5 | — | xtermjs/xterm.js | N/A | Approved — official addon |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

> **node-pty install-script note (review, not block):** node-pty declares `install: "node scripts/prebuild.js || node-gyp rebuild"` and `postinstall: "node scripts/post-install.js"`. These are **expected** for a native module (download/compile the `.node` binary) and are how the addon builds against the local ABI — not a network-exfil risk. The project's existing `electron-rebuild -f` postinstall recompiles it against Electron 36's ABI afterward. No action beyond the normal rebuild step.

## Architecture Patterns

### System Architecture Diagram

```
 App launch (app.whenReady)
      │
      ▼
 ┌─────────────────────────── MAIN PROCESS (Node.js) ───────────────────────────┐
 │ PtyManager (new module, keyed by LogicalId — single entry this phase)         │
 │   spawn:  pty = nodePty.spawn($SHELL, ['-l'], {                               │
 │             name:'xterm-256color', cols, rows,                                │
 │             cwd: os.homedir(),                                                │
 │             env: { ...process.env, TERM:'xterm-256color',                     │
 │                    COLORTERM:'truecolor' } })                                 │
 │                                                                              │
 │   pty.onData(chunk) ──► flow-control watermark ──► webContents.send(         │
 │                            'pty:data', { id, data: chunk })                   │
 │   pty.onExit({exitCode}) ─────────────────────► send('pty:exit', {id,code})  │
 │                                                                              │
 │   ipcMain.handle('pty:create', …)  → returns { id, pid }                     │
 │   ipcMain.on('pty:write',  (e,{id,data}) → pty.write(data))                  │
 │   ipcMain.on('pty:resize', (e,{id,cols,rows}) → pty.resize(cols,rows))       │
 │   ipcMain.on('pty:ack' OR write-callback ─────► pty.resume() when watermark<LOW)│
 │                                                                              │
 │   app 'before-quit' / window 'closed' ─────────► pty.kill()  (lifecycle)     │
 └──────────────────────────────────────────────────────────────────────────────┘
      │ contextIsolation:true · sandbox:true (only ipcRenderer + contextBridge)
      ▼
 ┌────────────────── PRELOAD (sandboxed — extends window.api) ───────────────────┐
 │ contextBridge.exposeInMainWorld('api', {                                      │
 │   ...existing,                                                                 │
 │   ptyCreate:(opts) => ipcRenderer.invoke('pty:create', opts),                 │
 │   ptyWrite:(id,data)=> ipcRenderer.send('pty:write',{id,data}),               │
 │   ptyResize:(id,c,r)=> ipcRenderer.send('pty:resize',{id,cols:c,rows:r}),     │
 │   onPtyData:(id,cb) => { const h=(_,m)=>m.id===id&&cb(m.data);                │
 │                          ipcRenderer.on('pty:data',h);                        │
 │                          return ()=>ipcRenderer.off('pty:data',h); },         │
 │   onPtyExit:(id,cb) => { …subscribe 'pty:exit'… return unsubscribe; } })      │
 └──────────────────────────────────────────────────────────────────────────────┘
      ▼
 ┌──────────────────── RENDERER (Chromium + React + xterm) ──────────────────────┐
 │ const term = new Terminal({ scrollback:10000, allowProposedApi:true,          │
 │                             cursorStyle:'block', fontFamily:'monospace' })     │
 │ term.loadAddon(fitAddon); term.loadAddon(webLinksAddon);                       │
 │ term.loadAddon(unicode11Addon); term.unicode.activeVersion='11';              │
 │ try{ term.loadAddon(new WebglAddon()) }catch{ term.loadAddon(new CanvasAddon())}│
 │ term.open(div); fitAddon.fit();                                               │
 │                                                                              │
 │ const {id} = await window.api.ptyCreate({cols:term.cols, rows:term.rows})     │
 │ window.api.onPtyData(id, data => term.write(data /*, flow-cb*/))              │
 │ term.onData(d => window.api.ptyWrite(id, d))   // keystrokes incl. paste      │
 │ ResizeObserver(debounce 100ms)→ fitAddon.fit() → ptyResize(id,cols,rows)      │
 │ window.api.onPtyExit(id, code => term.write('\r\n[process exited]\r\n'))      │
 └──────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additions only)

```
src/
├── main/
│   ├── index.ts            # wire app.whenReady → createWindow → PtyManager auto-start (D-02)
│   ├── pty-manager.ts      # NEW: spawn/write/resize/kill keyed by LogicalId; flow-control; IPC handlers
│   └── shell-resolver.ts   # NEW: resolveShell() → { shell, args } login+interactive, OS-agnostic (D-01)
├── preload/
│   └── index.ts            # EXTEND api with ptyCreate/ptyWrite/ptyResize/onPtyData/onPtyExit
├── renderer/
│   ├── index.tsx           # mount <TerminalPane/> full-window
│   └── TerminalPane.tsx    # NEW: xterm instance + addons + flow-control + resize + paste
└── shared/
    └── api-types.ts        # EXTEND ElectronAPI with PTY method signatures + PtyData/PtyExit payload types
```

### Pattern 1: PTY spawn in main, keyed by LogicalId

**What:** A `PtyManager` owns one `node-pty` IPty keyed by `LogicalId` (generalizes to N in Phase 3). `ptyPid` (the spawned PID) is stored on the `SessionRecord` separately from `logicalId` — never conflated (IDENT-02 invariant from Phase 1).
**When:** Always — this is the TERM-02 core.
```typescript
// Source: node-pty README (microsoft/node-pty) — spawn signature
import * as pty from 'node-pty';
import os from 'node:os';
const p = pty.spawn(shell, args, {
  name: 'xterm-256color',          // sets $TERM inside the child (SC4)
  cols, rows,
  cwd: os.homedir(),               // D-02 / TERM-04
  env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
});
// p.pid → store as SessionRecord.ptyPid (NOT logicalId)
```

### Pattern 2: Bidirectional streaming over the typed bridge

**What:** `pty.onData` → `webContents.send('pty:data', …)`; renderer `term.onData` → `ipcRenderer.send('pty:write', …)`. Payloads carry `id` (LogicalId) so the design generalizes to multi-session without per-session channel name churn.
**Encoding:** node-pty emits **UTF-8 strings** by default (it does its own decoding and handles split multibyte sequences across chunk boundaries). Pass strings straight through IPC — **do not** re-encode to Buffer/base64 (that risks splitting a multibyte char mid-sequence and corrupting CJK/emoji — SC4). `term.write()` accepts the string directly. [CITED: node-pty README — onData emits string]

### Pattern 3: Login + interactive shell with native PATH (D-01)

**What:** macOS Terminal.app launches the shell as **login + interactive**, which sources `.zprofile`/`.zlogin` (login) AND `.zshrc` (interactive). Replicating both is what makes Homebrew/nvm/asdf-installed `claude`/`codex` resolve on PATH (TERM-03).
**How:** Spawn with the **login flag** (`-l`); because node-pty attaches a real TTY, the shell is already **interactive** (so `.zshrc` sources automatically — no `-i` needed, and `-i` can cause double-sourcing/job-control noise). Inherit full `process.env`.
```typescript
// Source: zsh startup-file semantics (freecodecamp/zsh config) + Terminal.app behavior
// OS-agnostic resolver (Windows branch deferred to Phase 8 but stubbed to stay OS-agnostic per CLAUDE.md)
function resolveShell(): { shell: string; args: string[] } {
  const shell = process.env.SHELL || '/bin/zsh';      // fallback /bin/zsh (D-01)
  // login flag → sources .zprofile/.zlogin/.zshrc (zsh) or .bash_profile/.bashrc (bash login)
  const args = ['-l'];                                 // interactive comes free from the PTY TTY
  return { shell, args };
}
```
> **bash vs zsh note:** a **login** bash sources `.bash_profile`/`.profile` and, when also interactive, your `.bash_profile` typically sources `.bashrc`. `zsh -l` on an interactive TTY sources `.zprofile`→`.zshrc`. Using `-l` + a PTY (interactive) covers both shells without per-shell flags. [CITED: freecodecamp zsh-config; isamert.net zsh login process]

### Pattern 4: Flow control / backpressure (SC5 — canonical xterm.js watermark)

**What:** Pause node-pty when xterm's write queue backs up; resume when it drains. This is THE pattern that keeps a 50 MB `cat` responsive and lossless.
**When:** Always wrap the `pty.onData → term.write` path.
```javascript
// Source: https://xtermjs.org/docs/guides/flowcontrol/  (official guide)
const HIGH = 100000;   // tune ≤ 500K to keep keystrokes snappy under fast input
const LOW  = 10000;
let watermark = 0;

// In MAIN: pty.onData → send chunk to renderer.
// In RENDERER: receive chunk, write to term, and ACK back so MAIN can resume.
window.api.onPtyData(id, chunk => {
  watermark += chunk.length;
  term.write(chunk, () => {                       // callback fires when xterm has parsed the chunk
    watermark = Math.max(watermark - chunk.length, 0);
    if (watermark < LOW) window.api.ptyResume(id); // → ipcMain → pty.resume()
  });
  if (watermark > HIGH) window.api.ptyPause(id);   // → ipcMain → pty.pause()
});
```
> **IPC placement:** because pause/resume must straddle processes, add `ptyPause(id)`/`ptyResume(id)` to the bridge (renderer→main `send`), OR keep watermark accounting in MAIN and have the renderer send a lightweight `pty:ack` per chunk. Either is valid; the per-chunk-callback→resume variant above is the documented one. Do **not** use node-pty `handleFlowControl` (XON/XOFF) for this — that is child-driven, not UI-driven. [CITED: xtermjs.org/docs/guides/flowcontrol]

### Pattern 5: Resize → fit → pty.resize within 1 s (SC3)

```typescript
// Source: @xterm/addon-fit usage + node-pty resize
const fit = new FitAddon();
term.loadAddon(fit);
const onResize = debounce(() => {
  fit.fit();                                  // recompute cols/rows from container size
  window.api.ptyResize(id, term.cols, term.rows);  // → pty.resize(cols, rows)
}, 100);                                       // 100ms debounce << 1s budget
new ResizeObserver(onResize).observe(containerDiv);
window.addEventListener('resize', onResize);
```
> `pty.resize(cols, rows)` triggers `SIGWINCH` in the child; `tput cols` updates and vim/ncurses reflow (SC3). Call `fit.fit()` once after `term.open()` before the initial `ptyCreate` so the PTY spawns at the correct size.

### Pattern 6: Bracketed paste + macOS copy/paste (D-03, SC2)

**What:** xterm enables **bracketed paste** automatically when the application (the shell) requests DECSET 2004. Pasting multi-line text then arrives wrapped in `\e[200~`…`\e[201~`, so the shell does **not** auto-execute intermediate newlines (SC2). You forward the pasted text through `term.onData` exactly like typed input — xterm handles the bracketing.
**Cmd+C / Cmd+V / right-click (D-03):**
```typescript
// Source: xterm.js attachCustomKeyEventHandler + clipboard API
term.attachCustomKeyEventHandler(e => {
  if (e.type !== 'keydown') return true;
  if (e.metaKey && e.code === 'KeyC' && term.hasSelection()) {     // Cmd+C copies selection
    navigator.clipboard.writeText(term.getSelection()); return false;
  }
  if (e.metaKey && e.code === 'KeyV') {                            // Cmd+V pastes (bracketed)
    navigator.clipboard.readText().then(t => term.paste(t)); return false;
  }
  return true;  // Ctrl+C falls through → xterm sends \x03 (SIGINT) — D-03 distinct key
});
// right-click paste:
containerDiv.addEventListener('contextmenu', e => {
  e.preventDefault();
  navigator.clipboard.readText().then(t => term.paste(t));
});
```
> `term.paste()` respects bracketed-paste mode automatically — prefer it over feeding raw text to `onData`. Ctrl+C is NOT intercepted, so xterm forwards `\x03` → PTY → SIGINT (SC2). [CITED: xterm.js API — paste(), attachCustomKeyEventHandler]

### Anti-Patterns to Avoid

- **`child_process.exec`/`spawn` one-shot for the session** — cannot host vim/REPL/interactive prompts. Banned by CLAUDE.md. Use node-pty.
- **node-pty in the renderer** — violates sandbox/contextIsolation; ESLint already errors on it. PTY lives in main only.
- **Re-encoding PTY bytes to base64/Buffer across IPC** — splits multibyte UTF-8; breaks CJK/emoji (SC4). Pass node-pty's UTF-8 strings through unchanged.
- **Writing every chunk to xterm with no flow control** — 50 MB `cat` floods the event loop, freezes input (fails SC5). Use the watermark.
- **Loading `.node` from inside ASAR** — fails at runtime. `auto-unpack-natives` (already in forge.config.ts) handles it; verify after `npm run package`.
- **Skipping `fit.fit()` before the initial spawn** — PTY starts at default 80×24, mis-sized until first resize.
- **Spawning with `-i` AND a PTY** — double-interactive can cause job-control warnings; the PTY already makes the shell interactive. Use `-l` only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pseudo-terminal / interactive process | Custom `child_process` + manual TTY emulation | node-pty | forkpty/ConPTY, SIGWINCH, raw mode, signal forwarding are deeply OS-specific |
| ANSI/VT parsing + rendering | Custom escape-sequence parser | @xterm/xterm | Thousands of VT100/VT220/xterm sequences, scrollback, selection, reflow |
| CJK/emoji cell-width | Manual `wcwidth` table | @xterm/addon-unicode11 | Unicode 11 width tables; wrong widths break htop/box-drawing (SC4) |
| Container-fit cols/rows math | Manual char-measure + division | @xterm/addon-fit | Accounts for padding, scrollbar, DPR, font metrics |
| Backpressure | Custom setTimeout throttling | xterm `write(cb)` + node-pty `pause/resume` watermark | The documented, race-free pattern (SC5) |
| Bracketed paste | Manual `\e[200~` wrapping | `term.paste()` | xterm tracks DECSET 2004 state per-application |
| Native rebuild per Electron ABI | Manual node-gyp invocation | @electron/rebuild (already postinstall) | Resolves the right ABI from node-abi automatically |

**Key insight:** Every fidelity criterion in this phase is a solved problem inside node-pty + xterm.js + the official addons. The phase's real work is *correct wiring and lifecycle*, not algorithms — so the highest-value tasks are the IPC contract, flow control, shell invocation, and cleanup, not any custom terminal logic.

## Runtime State Inventory

> This is a greenfield feature phase (no rename/migration). Only forward-looking lifecycle state applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no persistence in Phase 2 (PERS-* is Phase 5). Session is in-memory only. | None |
| Live service config | None — no external services | None |
| OS-registered state | The spawned shell becomes a real child **process** (`ptyPid`). Not OS-registered, but MUST be `pty.kill()`-ed on window close / `before-quit` to avoid orphaned shells. | Add lifecycle cleanup (Pattern in diagram) |
| Secrets/env vars | The PTY **inherits the full parent env** (D-01) including any secrets in `process.env`. This is intentional for PATH fidelity, but note: child sees the app's env. No new secret keys introduced. | None (documented behavior) |
| Build artifacts | `node-pty`'s compiled `.node` binary (rebuilt per Electron ABI). Stale after any Electron version bump or `node_modules` wipe. | `electron-rebuild -f -w node-pty` (already postinstall); verify `.node` unpacked outside ASAR after package |

**Verified:** No persisted/renamed state — confirmed by REQUIREMENTS.md (PERS-01/02 mapped to Phase 5) and CONTEXT.md Deferred Ideas.

## Common Pitfalls

### Pitfall 1: PATH differs from Terminal.app → `claude`/`codex` "command not found" (breaks TERM-03, the Core Value scenario)
**What goes wrong:** Spawning a plain non-login shell (or inheriting Electron's stripped GUI-app env) means Homebrew/nvm/asdf paths are missing; `claude --rc` isn't found.
**Why:** GUI apps on macOS don't inherit the login-shell PATH; only a login+interactive shell sources `.zprofile`+`.zshrc`.
**How to avoid:** Spawn `$SHELL -l` on a PTY (interactive), inherit full `process.env` (D-01, Pattern 3).
**Warning signs:** `echo $PATH` inside the session is short / missing `/opt/homebrew/bin`; `which claude` empty.

### Pitfall 2: UI freeze / dropped output under high throughput (fails SC5)
**What goes wrong:** `cat bigfile` floods `pty.onData`; unbounded `term.write` saturates the event loop; keystrokes lag, output drops.
**Why:** No backpressure between PTY producer and xterm consumer.
**How to avoid:** Official watermark flow control (Pattern 4); WebGL renderer.
**Warning signs:** Spinner/keystroke lag during large output; memory spike.

### Pitfall 3: Wrong cell widths — htop borders broken, emoji overlap (fails SC4)
**What goes wrong:** CJK/emoji render at 1 cell instead of 2.
**Why:** unicode11 addon not loaded/activated, or `allowProposedApi` off.
**How to avoid:** `new Terminal({ allowProposedApi: true })`, `loadAddon(unicode11)`, `term.unicode.activeVersion = '11'`.
**Warning signs:** Misaligned box-drawing in htop; emoji clipping.

### Pitfall 4: `.node` fails to load from ASAR in packaged build
**What goes wrong:** Dev (`npm start`) works; packaged app throws "cannot find module"/"invalid ELF/Mach-O".
**Why:** Native `.node` cannot be `require`-d from inside the ASAR archive.
**How to avoid:** `auto-unpack-natives` is already in forge.config.ts — keep it. Run the **packaging smoke test** (ROADMAP folds packaging validation into Phase 2) to catch this now, not in Phase 8.
**Warning signs:** Works in dev, fails after `npm run package`/`make`.

### Pitfall 5: WebGL context loss → blank/frozen terminal
**What goes wrong:** GPU driver resets the WebGL2 context; terminal stops rendering.
**Why:** Chromium can lose the WebGL context (sleep/GPU pressure).
**How to avoid:** Register `webglAddon.onContextLoss(() => { webglAddon.dispose(); term.loadAddon(new CanvasAddon()); })` to fall back to canvas (5.x has canvas; note Q1 for xterm 6).
**Warning signs:** Terminal blanks after wake-from-sleep.

### Pitfall 6: Orphaned shell processes on window/app close
**What goes wrong:** Closing the window leaves `zsh`/child processes running.
**Why:** node-pty child isn't killed when the renderer goes away.
**How to avoid:** `pty.kill()` on `window.on('closed')` and `app.on('before-quit')`; dispose IPC listeners and the xterm instance + addons in the renderer on unmount.
**Warning signs:** `ps aux | grep zsh` shows leftover shells after quitting.

### Pitfall 7: node-pty / Electron ABI mismatch after install
**What goes wrong:** `Error: The module was compiled against a different Node.js ABI`.
**Why:** node-pty built against system Node (v22), not Electron 36's V8 ABI.
**How to avoid:** `electron-rebuild -f -w node-pty` (postinstall already does `electron-rebuild -f`); re-run after any Electron bump.
**Warning signs:** App boots, but `require('node-pty')` throws on first PTY spawn.

## Code Examples

### Extend the typed bridge contract (api-types.ts)
```typescript
// Source: extends existing src/shared/api-types.ts ElectronAPI (Phase 1 pattern)
export interface PtyCreateOptions { cols: number; rows: number; cwd?: string }
export interface PtyCreateResult  { id: LogicalId; pid: number }

export type ElectronAPI = {
  getVersion: () => Promise<string>;
  ptyCreate: (opts: PtyCreateOptions) => Promise<PtyCreateResult>;
  ptyWrite:  (id: LogicalId, data: string) => void;
  ptyResize: (id: LogicalId, cols: number, rows: number) => void;
  ptyResume: (id: LogicalId) => void;   // flow control
  ptyPause:  (id: LogicalId) => void;    // flow control
  onPtyData: (id: LogicalId, cb: (data: string) => void) => () => void; // returns unsubscribe
  onPtyExit: (id: LogicalId, cb: (exitCode: number) => void) => () => void;
};
```
> The Phase-1 security guard test (`EXPECTED_API_KEYS` in `window-config.ts`) asserts the exact exposed key set — it MUST be updated to include the new PTY keys, or the guard test fails. That guard is the intended tripwire; updating it is a deliberate, reviewed task.

### node-pty UTF-8 string handling (no re-encode)
```typescript
// Source: node-pty README — IPty.onData emits string (UTF-8, multibyte-safe across chunks)
pty.onData((data: string) => {
  win.webContents.send('pty:data', { id, data }); // pass string straight through
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `xterm` / `xterm-addon-*` (unscoped) | `@xterm/xterm` / `@xterm/addon-*` (scoped) | xterm v5 (2022) | Unscoped deprecated; CLAUDE.md already uses scoped |
| node-pty winpty (Windows) | node-pty ConPTY | node-pty 1.x | Windows-only; deferred to Phase 8 |
| xterm 5.x with canvas-renderer addon | **xterm 6.0 removed addon-canvas** (DOM/WebGL only) | xterm 6.0 (current `latest`) | Conflicts with CLAUDE.md's canvas-fallback lock — see Q1 |
| Manual XON/XOFF | Renderer-driven watermark write-callback | xterm flow-control guide | Documented, UI-responsive backpressure (SC5) |

**Deprecated/outdated:**
- node-pty `latest` is **1.1.0** (2025-12-22), not the 1.2.0-beta line. CLAUDE.md's "v1.1.0 stable tested ≤ Electron 36 / v1.2.0-beta vs Electron 39" framing predates the 1.1.0 stable release. 1.1.0 stable is rebuilt-from-source against Electron 36's ABI via @electron/rebuild — version "compatibility" is a rebuild concern, not a prebuilt-matrix concern. [VERIFIED: npm registry dist-tags]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 5.x-compatible addon majors are addon-fit 0.10 / webgl 0.18 / canvas 0.7 / web-links 0.11 / unicode11 0.8. Inferred from addon-major-tracks-core convention; exact minors not individually peer-checked this session. | Standard Stack | Planner picks a wrong addon minor → install peer-dep error. Mitigation: planner runs `npm view <addon> versions` and matches `@xterm/xterm@5.5` peer range (cheap, deterministic). |
| A2 | `zsh -l` on a PTY sources both `.zprofile` and `.zshrc` (login + interactive) matching Terminal.app. Based on documented zsh startup semantics, not a runtime probe in this session. | Pattern 3 / Pitfall 1 | If a user's dotfiles gate on `[[ -o interactive ]]` oddly, PATH could differ. Mitigation: VALIDATION includes a `which claude`/`echo $PATH` parity check vs Terminal.app. |
| A3 | node-pty emits UTF-8 strings that are multibyte-safe across chunk boundaries (no manual buffering needed). Per README behavior. | Pattern 2 | If a multibyte char splits across chunks, a CJK/emoji glyph could momentarily corrupt. Mitigation: keep strings end-to-end (don't re-encode); SC4 manual check. |
| A4 | Pinning xterm 5.5 (honoring CLAUDE.md) is preferred over adopting 6.0. This is a recommendation, not a verified requirement. | Summary / Q1 | If the user prefers latest, plan targets the wrong major (addon set + canvas-fallback decision change). Mitigation: Q1 escalates to user/planner before install. |

## Open Questions

1. **xterm 5.5 (CLAUDE.md lock) vs xterm 6.0 (current `latest`, removed addon-canvas).**
   - What we know: CLAUDE.md explicitly locks `@xterm/xterm` 5.5.0 and names `@xterm/addon-canvas` as the WebGL fallback. xterm 6.0.0 is current and **removed the canvas addon** (DOM-only fallback), reworked the viewport, and changed the event system.
   - What's unclear: whether the user wants to honor the 5.5 lock (keeps canvas fallback, slightly older) or upgrade to 6.0 (newer, but canvas-fallback decision is void and the WebGL-loss fallback becomes the DOM renderer).
   - Recommendation: **honor CLAUDE.md — pin 5.5.x.** It's a locked decision; changing it is the user's call. If the user upgrades to 6.0 in discuss-phase, drop addon-canvas and use the DOM renderer as the WebGL-loss fallback. Flag for the planner to confirm before `npm install`.

2. **Flow-control IPC shape: per-chunk callback→resume vs renderer-side watermark with `ptyPause`/`ptyResume`.**
   - What we know: both are valid; the official guide's example keeps the watermark on the side that calls `term.write`. Since `term.write` is in the renderer but `pause/resume` is on the PTY in main, the accounting must cross the bridge.
   - What's unclear: whether to (a) keep the watermark in the renderer and expose `ptyPause`/`ptyResume`, or (b) keep watermark in main and have the renderer send a per-chunk `pty:ack`.
   - Recommendation: **(a)** — renderer watermark + `ptyPause`/`ptyResume` bridge methods (matches the guide most directly, fewer messages). Planner decides final shape; both satisfy SC5.

3. **Shell flag for non-zsh shells (bash) — `-l` only vs shell-specific.**
   - What we know: `-l` (login) + PTY-interactive covers zsh and bash for the macOS-first case.
   - What's unclear: edge dotfile setups; Windows is out of scope (Phase 8).
   - Recommendation: ship `-l` + interactive-via-PTY now; keep `resolveShell()` OS-agnostic so Phase 8 adds the Windows branch without refactor.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build / electron-rebuild | ✓ | v22.19.0 | — |
| Electron | Runtime / ABI target | ✓ | 36.9.5 (installed) | — |
| electron-rebuild | Rebuild node-pty against Electron ABI | ✓ | in node_modules/.bin (@electron/rebuild 4.0.4) | — |
| node-abi | ABI lookup for Electron 36 | ✓ | 4.31.0 (registers Electron 36) | — |
| C/C++ toolchain (node-gyp) | Compile node-pty `.node` | ✓ (assumed — macOS arm64, Xcode CLT) | — | If missing: `xcode-select --install` |
| `$SHELL` (/bin/zsh) | PTY spawn target (D-01) | ✓ | /bin/zsh | /bin/bash |
| WebGL2 (Chromium) | addon-webgl renderer | ✓ (modern Chromium) | — | addon-canvas (5.x) / DOM (6.x) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** WebGL2 → canvas/DOM renderer (runtime auto-fallback, Pitfall 5).
> node-gyp toolchain presence is assumed from a working Phase-1 Electron build on this machine; if `npm install node-pty` fails to compile, run `xcode-select --install`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (unit/guard) + WebdriverIO 9 / `@wdio/electron-service` 10 (boot + PTY round-trip E2E) |
| Config file | `vitest.config.ts`, `wdio.conf.ts` (both present from Phase 1) |
| Quick run command | `npm run test:unit` (vitest run) |
| Full suite command | `npm test` (unit + smoke) |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| TERM-02 / SC1 | PTY round-trip: write `echo hello\n`, assert `hello` echoed back | E2E (WDIO) | `npm run test:smoke` → `tests/smoke/pty-roundtrip.smoke.test.ts` | ❌ Wave 0 |
| SC4 ($TERM) | write `echo $TERM\n`, assert output contains `xterm-256color` | E2E (WDIO) | same harness | ❌ Wave 0 |
| SC3 (resize) | resize window/term, write `tput cols\n` (or `stty size`), assert new col count | E2E (WDIO) | `tests/smoke/pty-resize.smoke.test.ts` | ❌ Wave 0 |
| SC5 (throughput) | spawn a process that emits ~50MB; assert UI thread stays responsive (keystroke echoes within N ms) and no bytes dropped (checksum/line-count) | E2E (WDIO) | `tests/smoke/pty-throughput.smoke.test.ts` | ❌ Wave 0 |
| SC1 (Ctrl+C) | start `sleep 100`, send `\x03`, assert prompt returns (process killed) | E2E (WDIO) | same harness | ❌ Wave 0 |
| Bridge guard | `EXPECTED_API_KEYS` includes new PTY methods; preload exposes exactly that set | Unit (Vitest) | `npm run test:unit` → extend `security.guard.test.ts` | ✅ exists (update) |
| resolveShell | returns `{shell:'/bin/zsh' (or $SHELL), args:['-l']}`; falls back to `/bin/zsh` when `$SHELL` unset | Unit (Vitest) | `src/main/__tests__/shell-resolver.test.ts` | ❌ Wave 0 |
| flow-control | watermark pauses at HIGH, resumes below LOW (pure-function unit on the accounting) | Unit (Vitest) | `src/main/__tests__/flow-control.test.ts` | ❌ Wave 0 |
| Identity (IDENT-02 regression) | `ptyPid` stored separately from `logicalId`; never assigned across | Unit (Vitest) | existing Phase-1 guard | ✅ exists |

**Manual / human-verify (cannot fully automate — VALIDATION.md):**
- SC1 visual fidelity of `vim`/`python` REPL/`ssh` (interactive prompts, colors) — human.
- SC2 multi-line bracketed paste does NOT auto-execute — human (paste a 3-line snippet, confirm no execution until Enter).
- SC3 vim/ncurses **reflow** correctness on resize — human (semi-automatable via `tput cols`).
- SC4 truecolor render + CJK/emoji cell widths + **htop borders intact** — human (visual).
- SC1 `claude --rc` resolves on PATH and runs — human (requires the tool installed); automatable proxy: `which claude` / `echo $PATH` parity vs Terminal.app.

### Sampling Rate
- **Per task commit:** `npm run test:unit` (guard + resolveShell + flow-control).
- **Per wave merge:** `npm test` (adds WDIO PTY round-trip + resize + throughput).
- **Phase gate:** full suite green + manual fidelity checklist (vim/python/ssh/htop/paste/truecolor) before `/gsd-verify-work`. Packaging smoke (`npm run package` then launch + PTY round-trip) per ROADMAP's Phase-2-folded packaging check.

### Wave 0 Gaps
- [ ] `tests/smoke/pty-roundtrip.smoke.test.ts` — SC1/TERM-02, plus `$TERM` (SC4) and Ctrl+C (SC1) assertions
- [ ] `tests/smoke/pty-resize.smoke.test.ts` — SC3 (`tput cols` after resize)
- [ ] `tests/smoke/pty-throughput.smoke.test.ts` — SC5 (responsiveness + no-drop)
- [ ] `src/main/__tests__/shell-resolver.test.ts` — resolveShell login flag + fallback
- [ ] `src/main/__tests__/flow-control.test.ts` — watermark HIGH/LOW accounting
- [ ] Update `src/main/window-config.ts` `EXPECTED_API_KEYS` + `security.guard.test.ts` for new PTY bridge methods
- [ ] WDIO helper to drive xterm in-page (send keys / read buffer via `term.buffer` or DOM)

## Security Domain

`security_enforcement: true`, ASVS Level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Process split enforced: node-pty in main only; renderer reaches it solely via typed contextBridge (sandbox:true, contextIsolation:true). ESLint bans node-pty/electron in renderer+shared. |
| V2 Authentication | no | Local single-user desktop app; no auth surface |
| V3 Session Mgmt | no | No web sessions/cookies |
| V4 Access Control | partial | PTY inherits the user's own privileges only; no privilege escalation. cwd restricted to a real dir (home) |
| V5 Input Validation | yes | IPC payloads (`id`, `cols`, `rows`, `data`) crossing the bridge must be validated in main: `id` is a known LogicalId, `cols`/`rows` are positive ints (guard against resize-bomb), `data` is a string. Reject unknown ids. |
| V6 Cryptography | no | No crypto in this phase |
| V7 Error/Logging | yes | Do not log raw PTY byte streams (may contain secrets/keystrokes). Log lifecycle events only (spawn/exit/pid). |
| V12 Files/Resources | yes | `.node` native binary loaded only from the unpacked app dir (auto-unpack-natives); cwd is a validated path |

### Known Threat Patterns for Electron + node-pty

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Renderer compromise → arbitrary main-process command exec via PTY | Elevation of Privilege | contextIsolation+sandbox; expose only narrow typed PTY methods; validate every IPC arg in main; never `eval`/`exec` renderer-supplied strings as shell commands (the PTY only receives keystroke bytes the user typed) |
| Resize-bomb (huge cols/rows) | Denial of Service | Clamp `cols`/`rows` to sane bounds (e.g., 1–1000) before `pty.resize` |
| Unknown/forged `id` in IPC to control another PTY | Tampering | Validate `id` against the live PtyManager map; ignore unknown ids (single id this phase, but enforce now) |
| Secret leakage via logged PTY output | Information Disclosure | Never persist/log raw PTY data; passive exit notice only |
| Orphaned child processes | DoS / resource leak | `pty.kill()` on window close + `before-quit` (Pitfall 6) |
| Native `.node` loaded from writable/ASAR path | Tampering | auto-unpack-natives places `.node` in the read-only app resources dir; verify in packaging smoke |

## Sources

### Primary (HIGH confidence)
- node-pty README (github.com/microsoft/node-pty) — spawn options (`name`/`cols`/`rows`/`cwd`/`env`), `onData` emits string, `handleFlowControl` XON/XOFF semantics, "Node 16 or Electron 19 required"
- node-pty npm dist-tags via `npm view` — `latest`=**1.1.0** (2025-12-22), `beta`=1.2.0-beta.13; `install`/`postinstall` scripts inspected
- xterm.js official Flow Control guide (xtermjs.org/docs/guides/flowcontrol) — watermark code, HIGH=100000/LOW=10000, "HIGH ≤ 500K for snappy keystrokes", callback-counting variant
- `npm view @xterm/xterm version`/addons — 6.0.0 current; 5.5.0 published; addon current majors (fit 0.11 / webgl 0.19 / canvas 0.7 / web-links 0.12 / unicode11 0.9)
- Local environment probes — Electron 36.9.5 installed, Node v22.19.0, darwin arm64, node-abi 4.31.0, `electron-rebuild` present, `$SHELL=/bin/zsh`
- CLAUDE.md — locked stack, "Critical: node-pty Native Module Build Concerns", "What NOT to Use", Electron-36 targeting
- Phase 1 RESEARCH/code — externals in vite.main.config.ts, ESLint node-pty ban, auto-unpack-natives wired, contextBridge pattern, EXPECTED_API_KEYS guard

### Secondary (MEDIUM confidence)
- WebSearch on xterm 6.0.0 breaking changes (newreleases.io / xterm.js releases) — canvas addon removed, windowsMode removed, viewport rework, EventEmitter→Emitter
- freecodecamp "How Do Zsh Configuration Files Work", isamert.net zsh login deep-dive — `.zprofile`(login)+`.zshrc`(interactive) sourcing; macOS launches terminals as login shells
- VS Code issue #74620 (node-pty host flow control + event batching) — confirms watermark approach in production

### Tertiary (LOW confidence)
- node-pty-prebuilt-multiarch npm — prebuild availability lags Electron versions (informs the "rebuild-from-source is correct" decision; not adopted)

## Metadata

**Confidence breakdown:**
- Standard stack (node-pty 1.1.0, xterm addons): HIGH for node-pty/xterm core + versions (registry-verified); MEDIUM for exact 5.x addon minors (A1 — planner must `npm view`).
- Architecture / IPC / flow control / shell invocation: HIGH — official docs + node-pty README + existing Phase-1 seam.
- xterm major-version pin: MEDIUM — CLAUDE.md locks 5.5 but 6.0 is current and drops addon-canvas (Q1, user decision).
- Pitfalls / security: HIGH — well-documented Electron+node-pty failure modes.

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable stack; re-check node-pty dist-tag and xterm 5↔6 decision if planning slips)
