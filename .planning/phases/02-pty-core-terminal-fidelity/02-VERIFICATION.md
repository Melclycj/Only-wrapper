---
phase: 02-pty-core-terminal-fidelity
verified: 2026-06-04T17:45:00Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Launch app and run claude --rc (or codex) to verify PATH parity with Terminal.app"
    expected: "claude/codex resolves on PATH, launches interactively; shell prompt matches Terminal.app environment (Homebrew/nvm/asdf paths present)"
    why_human: "Requires the tool installed on this machine; PATH parity depends on login-shell sourcing of .zprofile/.zshrc which cannot be verified by grep"
  - test: "Run vim, python REPL, and ssh — verify interactive fidelity (prompts, arrow keys, colors)"
    expected: "vim opens and navigates with arrow keys, :q works; python REPL responds to Ctrl+D; ssh prompt behaves natively; programs look identical to Terminal.app"
    why_human: "Visual + interactive fidelity cannot be verified programmatically; requires human eyeballs and keyboard"
  - test: "Run a truecolor gradient script and htop — verify truecolor and box-drawing borders"
    expected: "Smooth 24-bit color gradients visible; htop box-drawing borders are correctly aligned, not corrupted"
    why_human: "Pixel-level visual correctness; no automated way to assert gradient smoothness or border alignment"
  - test: "Print CJK text and emoji (echo '日本語 🛋️ 表示') — verify correct cell widths"
    expected: "CJK characters occupy 2 cells each; emoji glyph shows without overlap or clipping"
    why_human: "Cell-width correctness is a render-time visual property; unicode11 addon is wired in code but correctness requires visual inspection"
  - test: "Paste a 3-line snippet via Cmd+V and right-click — verify multi-line paste does NOT auto-execute"
    expected: "Pasted lines appear in the terminal input area but do not execute until the user presses Enter"
    why_human: "Bracketed-paste behavior depends on the shell's DECSET 2004 support and clipboard timing; requires manual testing"
---

# Phase 2: PTY Core + Terminal Fidelity Verification Report

**Phase Goal:** A user can open the app and interact with a single real terminal session exactly as they would in a native terminal — interactive programs, control characters, colors, resize, and the canonical `claude --rc` scenario all work. This is the Core Value proof.
**Verified:** 2026-06-04T17:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — claude --rc/vim/python/ssh behave like a native terminal; Ctrl+C kills a process | VERIFIED (automated) + HUMAN NEEDED (visual) | E2E pty-roundtrip: echo hello GREEN, Ctrl+C on sleep 100 GREEN. resolveShell() returns $SHELL with -l login flag (3/3 unit tests GREEN). node-pty spawned with full process.env. Visual fidelity (vim/python/ssh/claude) needs human. |
| 2 | SC2 — Ctrl+C=SIGINT, Ctrl+D closes REPL, arrow-key history, bracketed paste does NOT auto-execute | VERIFIED (automated) + HUMAN NEEDED (paste) | attachCustomKeyEventHandler wired: Cmd+C copies selection, Cmd+V/right-click paste via term.paste() (bracketed paste honored). Ctrl+C not intercepted — falls through to PTY as 0x03. Actual paste non-auto-execute behavior needs human. |
| 3 | SC3 — window resize → tput cols updates within 1s; vim/ncurses reflow | VERIFIED | E2E pty-resize: ResizeObserver + 100ms debounce → fit.fit() → ptyResize confirmed GREEN by WDIO test against packaged app. |
| 4 | SC4 — $TERM=xterm-256color; truecolor; CJK/emoji correct cell widths | VERIFIED (automated) + HUMAN NEEDED (visual) | E2E: echo $TERM → xterm-256color GREEN. Spawn uses name:'xterm-256color', env TERM+COLORTERM=truecolor. Unicode11Addon loaded, term.unicode.activeVersion='11'. Visual truecolor/CJK/htop needs human. |
| 5 | SC5 — 50MB+ cat does not freeze UI or drop output; input stays responsive | VERIFIED | E2E pty-throughput: yes pipe head -n 25000000 wc -l GREEN. CR-02 fix: explicit paused edge-tracking (paused bool, createWatermark accountant from shared/flow-control.ts). 5/5 flow-control unit tests (incl. hysteresis edge case) GREEN. |

**Score:** 5/5 truths verified (5 automated VERIFIED; 4 also need human visual/interactive confirmation of the SC criteria the E2E cannot cover)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | node-pty 1.1.0 + @xterm/xterm 5.5.0 + 5 addons pinned | VERIFIED | All 7 packages at exact versions: node-pty@1.1.0, @xterm/xterm@5.5.0, addon-fit@0.10.0, addon-webgl@0.18.0, addon-canvas@0.7.0, addon-web-links@0.11.0, addon-unicode11@0.8.0 |
| `src/main/shell-resolver.ts` | resolveShell() with login flag + /bin/zsh fallback | VERIFIED | Exports resolveShell(): ResolvedShell; args=['−l']; shell=$SHELL or /bin/zsh; electron-free. 3/3 unit tests GREEN. |
| `src/main/flow-control.ts` | CORRECTLY ABSENT (WR-01 fix) | VERIFIED | File deleted in commit 4f00a0b. Watermark moved to src/shared/flow-control.ts where renderer actually uses it. |
| `src/shared/flow-control.ts` | createWatermark() HIGH/LOW accounting | VERIFIED | 74 lines; exports WATERMARK_HIGH=100000, WATERMARK_LOW=10000, createWatermark(). 5/5 unit tests GREEN incl. CR-02 hysteresis edge-tracking case. |
| `src/main/pty-manager.ts` | PtyManager class with IPC handlers + idempotency | VERIFIED | 244 lines; class PtyManager with create/write/resize/pause/resume/kill/disposeAll/registerIpc/unregisterIpc; ipcRegistered flag (CR-01); clampDimension + isStringData exported. |
| `src/shared/api-types.ts` | ElectronAPI with ptyCreate/ptyWrite/ptyResize/ptyPause/ptyResume/onPtyData/onPtyExit + payload types | VERIFIED | All 7 PTY methods typed; PtyCreateOptions, PtyCreateResult, PtyDataPayload, PtyExitPayload declared; imports LogicalId type-only; no electron/node module. |
| `src/main/window-config.ts` | EXPECTED_API_KEYS includes all 8 methods | VERIFIED | ['getVersion','ptyCreate','ptyWrite','ptyResize','ptyPause','ptyResume','onPtyData','onPtyExit'] present; contextIsolation:true, nodeIntegration:false, sandbox:true unchanged. |
| `src/main/index.ts` | PtyManager wired; disposeAll on window-close and before-quit; unregisterIpc on before-quit | VERIFIED | ptyManager.registerIpc(win) in createWindow(); win.on('closed') → disposeAll(); app.on('before-quit') → disposeAll() + unregisterIpc(). |
| `src/preload/index.ts` | contextBridge with all 7 PTY methods; no raw ipcRenderer | VERIFIED | All 7 PTY channels wired; onPtyData/onPtyExit filter by id and return unsubscribe; single exposeInMainWorld('api',...); security.guard.test.ts GREEN (preload keys === EXPECTED_API_KEYS). |
| `src/renderer/TerminalPane.tsx` | xterm + addons + round-trip + flow-control watermark + copy/paste | VERIFIED | 223 lines; Terminal with scrollback:10000, allowProposedApi:true; Unicode11 activeVersion='11'; WebGL→Canvas fallback; ptyCreate on mount; onPtyData → watermark → term.write(chunk,cb); paused edge bool; Cmd+C/Cmd+V/right-click via term.paste(); contextmenu listener removed in cleanup; disposed flag. |
| `src/renderer/index.tsx` | Mounts TerminalPane full-window | VERIFIED | Imports TerminalPane and terminal.css; renders <TerminalPane/> into #root. |
| `src/renderer/terminal.css` | Full-window layout, dark background | VERIFIED | html/body/#root height:100%; .terminal-pane width/height 100%; background #1e232c. |
| `tests/smoke/helpers/xterm-driver.ts` | sendKeys/readBuffer/waitForText/resizeWindow | VERIFIED | All 4 helpers present; sendKeys focuses xterm-helper-textarea; readBuffer reads .xterm-rows DOM with window.__term fallback; resizeWindow via browser.electron.execute. |
| `tests/smoke/pty-roundtrip.smoke.test.ts` | E2E: echo hello, $TERM, Ctrl+C | VERIFIED | Tests present with substantive assertions; import from xterm-driver; banner comment. GREEN per orchestrator evidence. |
| `tests/smoke/pty-resize.smoke.test.ts` | E2E: tput cols after resize within 1s | VERIFIED | Sophisticated test with colsFromBuffer, readStableCols, resizeWindow, <1000ms assertion. GREEN per orchestrator evidence. |
| `tests/smoke/pty-throughput.smoke.test.ts` | E2E: 50MB responsiveness + no-drop | VERIFIED | yes pipe head -n 25000000 wc -l with sentinel nonce + '25000000' count assertion. GREEN per orchestrator evidence. |
| `src/main/__tests__/ipc-registration.test.ts` | CR-01 idempotency proof | VERIFIED | 4 tests: create handler registered once, no stacked listeners, N cycles no-throw, re-register after teardown. All GREEN. |
| `src/main/__tests__/pty-validation.test.ts` | clampDimension + isStringData unit tests | VERIFIED | 9 tests covering clamp (0/NaN/neg/Inf/large/in-range/fractional) and type guard. All GREEN. |
| `src/main/__tests__/shell-resolver.test.ts` | resolveShell unit tests | VERIFIED | 3 tests: args=['-l'], $SHELL passthrough, /bin/zsh fallback. All GREEN. |
| `src/shared/__tests__/flow-control.test.ts` | createWatermark unit tests incl. hysteresis | VERIFIED | 5 tests incl. CR-02 edge-tracking (pause-once/resume-once). All GREEN. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/main/pty-manager.ts` | node-pty spawn | pty.spawn(shell, args, opts) | WIRED | Line 97: pty.spawn() call with name/cols/rows/cwd/env |
| `src/main/pty-manager.ts` | `src/main/shell-resolver.ts` | resolveShell() | WIRED | Line 22 import; line 95 call: const { shell, args } = resolveShell() |
| `src/main/index.ts` | `src/main/pty-manager.ts` | PtyManager + before-quit cleanup | WIRED | Line 15 import; line 27 registerIpc; lines 63-66 before-quit disposeAll+unregisterIpc |
| `src/preload/index.ts` | ipcRenderer pty channels | contextBridge api methods | WIRED | pty:create/write/resize/pause/resume/data/exit all present; no raw ipcRenderer exposed |
| `src/renderer/TerminalPane.tsx` | `window.api.ptyCreate` | create PTY on mount | WIRED | Line 145-147: void window.api.ptyCreate({cols,rows}).then(({id})=>{...}) |
| `src/renderer/TerminalPane.tsx` | `window.api.onPtyData` | stream PTY output to term.write | WIRED | Line 171: offData = window.api.onPtyData(id, (data) => { watermark.add... term.write... }) |
| `src/renderer/TerminalPane.tsx` | `window.api.ptyPause / ptyResume` | watermark backpressure | WIRED | Lines 173-175: ptyPause on shouldPause(); lines 179-181: ptyResume on shouldResume() when paused |
| `src/renderer/TerminalPane.tsx` | `term.paste / navigator.clipboard` | Cmd+C/V + right-click bracketed paste | WIRED | Lines 110-126: attachCustomKeyEventHandler + contextmenu listener |
| `src/renderer/TerminalPane.tsx` | `src/shared/flow-control.ts` | createWatermark import | WIRED | Line 18: import { createWatermark } from '../shared/flow-control'; line 169 call |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `TerminalPane.tsx` | `data` (PTY output) | `window.api.onPtyData(id, ...)` → main process `child.onData` → real node-pty PTY stream | YES — node-pty streams from /bin/zsh or $SHELL | FLOWING |
| `TerminalPane.tsx` | `id` (LogicalId) | `window.api.ptyCreate()` → `PtyManager.create()` → `newLogicalId()` | YES — minted by uuid-based factory | FLOWING |
| `TerminalPane.tsx` | keystrokes (`term.onData`) | User keyboard → xterm → `window.api.ptyWrite(ptyId, d)` → `pty.write(data)` | YES — written directly to PTY stdin | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests 29/29 GREEN | `npx vitest run` | 29 passed (6 files) in 218ms | PASS |
| Dependency versions correct | node -e dep-check | All 7 packages at exact pinned versions | PASS |
| EXPECTED_API_KEYS has all 8 methods | grep EXPECTED_API_KEYS window-config.ts | getVersion + 7 PTY methods all present | PASS |
| CR-01 fix present: ipcRegistered flag | grep ipcRegistered pty-manager.ts | Lines 84, 203, 204, 241 — flag and guard present | PASS |
| CR-02 fix present: paused edge bool | grep paused TerminalPane.tsx | Lines 170-181 — paused bool with edge-only toggle | PASS |
| WR-01 fix present: main flow-control.ts deleted | ls src/main/flow-control.ts | File does not exist; shared/flow-control.ts used | PASS |
| node-pty .node outside ASAR | find out/ -name pty.node | 4 prebuilds all in app.asar.unpacked/ | PASS |
| No forbidden imports in renderer | grep electron/node-pty TerminalPane.tsx | No direct electron or node-pty import (comments only) | PASS |
| Lifecycle cleanup: before-quit | grep before-quit index.ts | Lines 63-66: disposeAll() + unregisterIpc() | PASS |
| Security posture locked | grep contextIsolation window-config.ts | contextIsolation:true, nodeIntegration:false, sandbox:true | PASS |

---

### Probe Execution

Step 7c SKIPPED — no probe-*.sh scripts declared in PLAN files and this is not a migration/CLI-tooling phase. The equivalent automated checks are the E2E smoke suite (WDIO against the packaged Electron app) per orchestrator evidence: 4/4 spec files GREEN (boot, pty-roundtrip, pty-resize, pty-throughput).

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TERM-01 | 02-02, 02-03, 02-04 | Real interactive terminal surface: keyboard, stdout/stderr, Ctrl+C/D, arrows, copy/paste, resize, ANSI colors, long-running processes, interactive programs | SATISFIED | Full TerminalPane + PTY round-trip implemented; contextBridge surface validated; E2E GREEN |
| TERM-02 | 02-01, 02-02, 02-03 | Sessions run through a real PTY/pseudo-terminal layer | SATISFIED | node-pty spawned in main process via PtyManager; ipcRenderer bridge passes keystrokes; E2E pty-roundtrip GREEN |
| TERM-03 | 02-02 | User can open a normal shell session and launch tools from the working directory (PATH parity) | SATISFIED (automated) + NEEDS HUMAN | resolveShell() returns $SHELL with -l login flag (unit tests GREEN); PATH parity for claude/codex requires human verification on target machine |
| TERM-04 | 02-02 | Each session starts in its configured initial working directory | SATISFIED | PtyManager.create() uses opts.cwd ?? os.homedir() (D-02); cwd defaults verified in code |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/TerminalPane.tsx` | 131 | `(window as unknown as { __term?: Terminal }).__term = term` — test hook ships in production (IN-03) | Info | Low-risk in a local-only app; hook is cleaned up on unmount; gated only behind component mount. No BLOCKER. |
| `src/renderer/TerminalPane.tsx` | 113, 117, 125 | Clipboard calls (`void navigator.clipboard.writeText/readText`) have no `.catch` (WR-04) | Warning | Copy/paste silently fails if clipboard permission denied; no user feedback. Deferred per review. |
| `src/renderer/TerminalPane.tsx` | 83-95 | WebGL `onContextLoss` registered before `loadAddon`; no `webgl.dispose()` in catch path (IN-04) | Info | Minor cleanup gap; does not affect function. |
| `src/renderer/TerminalPane.tsx` | 187-189 | On PTY exit, `ptyId` remains set; subsequent keystrokes forwarded to a dead session (WR-03) | Warning | Functionally silent no-op (main ignores unknown id); UX gap only. Deferred. |
| `src/main/pty-manager.ts` | 101 | `opts.cwd` passed unchecked to pty.spawn (WR-05) | Warning | Renderer-compromise risk; cwd not validated as absolute path. Deferred. |

No `TBD`, `FIXME`, or `XXX` markers found in any Phase-2 modified files. No BLOCKER anti-patterns.

Deferred warnings WR-02 through WR-06 and IN-01 through IN-04 are explicitly tracked in `02-REVIEW.md` and `deferred-items.md`. None are blockers for phase goal achievement.

---

### Human Verification Required

#### 1. PATH Parity and claude --rc

**Test:** Launch `npm start`. At the shell prompt, run `echo $PATH` and `which claude` (or `which codex`). Compare with Terminal.app output. If `claude` is installed, run `claude --rc`.
**Expected:** PATH matches Terminal.app (Homebrew, nvm, asdf paths all present). `claude --rc` launches interactively — the canonical Core Value scenario.
**Why human:** Requires the tool installed on this machine. Login-shell sourcing of .zprofile/.zshrc/.zlogin (the purpose of the `-l` flag) cannot be verified by static analysis — only runtime confirms it.

#### 2. Interactive Program Fidelity (SC1)

**Test:** Run `vim` (type, navigate with arrows, `:q`), `python` (a few REPL lines, Ctrl+D to exit), `ssh localhost` or any host. Verify Ctrl+C kills `sleep 100` and Ctrl+D closes the Python REPL. Verify arrow keys navigate shell history.
**Expected:** Every program behaves exactly as in Terminal.app — prompts render, keyboard input is responsive, colors correct, interactive feel matches native.
**Why human:** Visual + interactive fidelity cannot be asserted by grep. The E2E confirms Ctrl+C (SIGINT) via sleep 100 + prompt return, but vim/python/ssh rendering quality requires eyes and keyboard.

#### 3. Truecolor, htop, CJK/emoji Cell Widths (SC4)

**Test:** Run a truecolor test script (e.g., `curl -s https://raw.githubusercontent.com/robertknight/...` or a local 24-bit gradient). Run `htop`. Run `echo "日本語 🛋️ 表示"`.
**Expected:** Smooth 24-bit color gradients (no banding). htop box-drawing borders intact and aligned. CJK characters occupy 2 cells without overlap; emoji glyph displays correctly. These confirm COLORTERM=truecolor and Unicode11 activeVersion='11' work end-to-end.
**Why human:** Pixel-level visual quality; no automated assertion can confirm gradient smoothness or glyph alignment.

#### 4. Bracketed Paste — Multi-line Does Not Auto-Execute (SC2)

**Test:** Copy a 3-line snippet from a text editor. Paste via Cmd+V. Paste again via right-click.
**Expected:** The 3 lines appear in the terminal input area but do NOT execute until the user presses Enter. This confirms term.paste() and DECSET 2004 are working correctly.
**Why human:** Requires clipboard interaction, timing observation, and shell DECSET 2004 support. The code wiring is verified (term.paste(), attachCustomKeyEventHandler) but the runtime behavior depends on shell configuration.

#### 5. Resize Reflow in vim/ncurses (SC3 visual)

**Test:** Open `vim` or `htop`, then resize the app window.
**Expected:** Content reflows correctly within ~1 second — no split lines, no misaligned borders.
**Why human:** The E2E pty-resize test confirms `tput cols` changes within 1s, but correct SIGWINCH rendering in full-screen programs requires visual inspection.

---

### Gaps Summary

No gaps blocking goal achievement. All 5 success criteria have automated evidence. The 5 human verification items are visual-only or interactive-only checks that the E2E suite cannot cover — they do not indicate missing implementation.

**CR-01 fix verified in source:** `ipcRegistered` flag at pty-manager.ts:84, idempotency guard at lines 203-204, `unregisterIpc()` at line 235, called from index.ts line 65 on `before-quit`. Commit `75fdf85` confirmed in git history with correct diff.

**CR-02 fix verified in source:** `paused` boolean at TerminalPane.tsx:170, edge-only toggle at lines 173-175 (pause on rising) and 179-181 (resume on falling). `createWatermark` from `src/shared/flow-control.ts` (not dead-code in main). Commit `cf10dba` confirmed.

**WR-01 fix verified:** `src/main/flow-control.ts` does not exist (deleted). `src/shared/flow-control.ts` is the real accountant, imported in TerminalPane.tsx line 18. Commit `4f00a0b` confirmed.

---

_Verified: 2026-06-04T17:45:00Z_
_Verifier: Claude (gsd-verifier)_
