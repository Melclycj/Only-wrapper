# Phase 6: Robustness + Flow-Control Polish - Research

**Researched:** 2026-06-07
**Domain:** Electron 36 + node-pty 1.1.0 + @xterm/xterm 5.5 terminal session manager — failure-mode hardening, agent-state presentation layer, header controls
**Confidence:** HIGH (this is a brownfield phase against a codebase I read end-to-end; the few external facts are verified against the installed packages and an empirical node-pty spawn test)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Spawn / cwd error handling (SC2)**
- **D-01:** Detect via pre-validate cwd + try/catch spawn. Before `pty.spawn()`, pre-check the resolved `cwd` exists and is a directory (reuse the CR-01 guard in `pty-manager.ts` `updateProfile`, ~lines 713-718 / `isValidCwd` 778-785); ALSO wrap `pty.spawn()` itself in try/catch to catch everything else. Today `create()` calls `pty.spawn()` with neither guard.
- **D-02:** Failed spawn → status `error` + a clear message, never silent `~`. The resolved cwd must NOT silently fall back to home when a user-specified cwd is invalid — distinguish "no cwd given → home is fine" from "cwd given but missing → error".
- **D-03:** Surface in BOTH places — red `error` badge (with the message as a tooltip) AND an error card in the terminal pane (reuse the `IdleCard` placeholder pattern) with the full message.
- **D-04 (recovery):** Error card offers Edit + Retry. "Edit" opens the existing edit modal; "Retry"/Start re-attempts the spawn.
- **D-05 (message):** Specific for cwd, generic fallback otherwise. Missing cwd → `Working directory not found: <path>`; any other spawn failure → `Couldn't start session: <os reason>`.
- **Transport:** Message rides the existing `onPtyStatus` channel via the optional `PtyStatusPayload.notice` field (zero new bridge keys — mirrors the 05.1 ready-fail notice pattern).

**Agent-state status layer (SC4 / TERM-09)**
- **D-06:** NO new/separate needs-attention indicator. The existing status dot/badge gains DESIGN.md's agent-state presentation layer (an overlay over the 5 process statuses, NOT a 6th process status).
- **D-07:** Full running sub-states from one shared output-activity detector. A `running` session is one of three agent-states: **blue "In progress"** (output flowing), **amber "Waiting for you"** `oklch(0.66 0.15 60)` (idle AND last non-empty line matches a confirmation-prompt pattern = TERM-09/SC4), **slate "Free"** (idle, no prompt-pattern match). `exited`→green "Done", `not_started`/`stopped`→slate, `error`→red unchanged.
- **D-08:** Trigger = idle AND pattern (most conservative). Fire "Waiting" only when output has been quiet for the idle threshold AND the trailing line matches the prompt set.
- **D-09:** Curated agent prompt set. Trailing `?`, `[y/N]`/`[Y/n]` (case-insensitive), `(y/n)`/`(yes/no)`, and arrow-menu markers (`❯`). Exact regex may be research-tuned (stay conservative).
- **D-10:** State-driven clearing only (no acknowledge-on-view). Amber clears automatically when the session leaves the waiting condition. Computed for ALL running sessions, shown on every sidebar row + header; never nags because it is honest state.

**Header quick controls + lifecycle (SC5 / TERM-12)**
- **D-11:** Contextual controls in the header (`IdentityHeader.tsx`, identity-only today): **Clear** always; **Restart** when running; **Start ▶ when not running**. Destructive **Close** stays in the right-click context menu. No new non-destructive Stop (Phase-3 D-03a destructive Close stays intact).
- **D-12:** "Clear" = client-side xterm scrollback clear, no shell injection. Clear the kept-alive xterm buffer/scrollback (iTerm/VSCode Cmd+K semantics — current prompt preserved); do NOT inject `clear`/Ctrl+L. No separate main-side replay buffer exists (the kept-alive xterm IS the buffer).
- **D-13:** Keyboard — focusable buttons + a Clear chord: **Cmd+K (macOS) / Ctrl+Shift+K (Windows)** (Ctrl+K avoided on Windows — readline kill-line). Reuse the Phase-4 "app-wins" before-input-event interception. Restart stays button-only.
- **D-14:** "Start without running the command" (un-defers 05.1 D-07) = secondary menu item. Primary Start ▶ runs the saved startup command; "Start without command" spawns a bare shell skipping TERM-05 auto-run for that launch.

**Alt-screen reset (SC3)**
- **D-15:** Reset the terminal on restart AND on abnormal exit (exited/error not user-initiated). Restart resets before the new PTY's first output; abnormal exit also resets proactively. Mechanism (`term.reset()` vs explicit `\x1b[?1049l`/RIS) = research's call.

**Backpressure validation (SC1)**
- **D-16:** Validate, don't rebuild. The renderer HIGH/LOW watermark already exists. Prove SC1 under `cat /dev/urandom | head -c 100M` and resolve the flow-control duplication between `SessionView.tsx` and `TerminalPane.tsx`.

### Claude's Discretion
- The idle threshold for D-08 (sensible low-single-digit-seconds bound).
- Where the agent-state detector lives — main vs renderer. Constraint: never raw `ipcRenderer`; if a field is added, extend `PtyStatusPayload` like the 05.1 notice (no new key).
- Exact alt-screen reset mechanism (D-15) and exact prompt regex (D-09).
- Edit-modal prefill fix approach (keep main authoritative, prefer no new bridge key).
- The error-card / agent-state visual treatment from DESIGN.md tokens.

### Deferred Ideas (OUT OF SCOPE)
- Windows ready-detection + shell enumeration → Phase 8 (behind existing seams; Windows not runnable on dev machine).
- Non-destructive Stop (Start↔Stop keep-as-`stopped` cycle) — declined to keep Phase-3 D-03a intact.
- Terminal search (Ctrl+F) + scrollback-size config → Phase 7 (TERM-10/11).
- Reading agent/page *content* to detect generating-vs-idle — out of scope (privacy line). The SC4 heuristic uses PTY output-activity timing + last-line shape only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TERM-09 | Best-effort "waiting for input" / needs-attention indicator when a backgrounded session appears blocked awaiting user input (heuristic, best-effort) | Reframed into the agent-state layer (D-06/D-07). Research recommends a **renderer-side** output-activity detector per `SessionView` (zero IPC), an idle timer, a conservative trailing-line regex, and a lift of the per-session agent-state into `SessionManager` so the Sidebar dot + IdentityHeader show it. See §Architecture Pattern 1, §Code Examples. |
| TERM-12 | Session header provides quick clear-terminal and restart-session controls | Header control cluster in `IdentityHeader.tsx` (D-11). Clear = `term.clear()` (verified API), Restart = existing `handleRestart`, contextual Start = existing `handleStart`. Clear chord via the existing `before-input-event` "app-wins" seam + a new `'session:clear'` channel (NOT a bridge key — it mirrors `onSwitchSession`, see §Bridge surface). See §Architecture Pattern 4, §Code Examples. |
</phase_requirements>

## Summary

Phase 6 is almost entirely **brownfield hardening + presentation** against a mature, well-factored codebase. Four of the five success criteria touch code that already exists: SC1's watermark is built (`flow-control.ts` + `SessionView.tsx`), SC2's cwd validator exists (`PtyManager.isValidCwd`), SC2's transport channel exists (`PtyStatusPayload.notice`), SC2's error-card shape exists (`IdleCard.tsx` already renders an `error` branch), and SC5's Restart/Start handlers exist in `SessionManager`. The genuinely new code is: the SC4 agent-state detector + its color ramp, the SC3 alt-screen reset call, the header control cluster, the folder picker (one new bridge key), the edit-prefill round-trip, and the 8 deferred 05.1 review fixes.

The single most important empirical finding: **node-pty's `pty.spawn()` on macOS does NOT throw synchronously for a non-existent cwd or a bad shell path — it forks-then-dies and emits `onExit({ exitCode: 1 })` ~tens of ms later** (verified by direct test, see §Common Pitfalls 1). This means D-01's *pre-validation* of cwd is not merely a nicety for a specific message — it is the only reliable way to produce the SC2 "Working directory not found: <path>" message at all, because the try/catch will almost never fire on macOS. The plan must handle both the synchronous pre-validation path (specific message, no spawn) AND the asynchronous abnormal-`onExit` path (generic fallback). It must also remove the current silent `os.homedir()` fallback when a cwd was *explicitly* supplied but invalid (D-02).

The second key finding: **`TerminalPane.tsx` is dead code.** The live renderer entry (`src/renderer/index.tsx`) renders `<SessionManager />`, which renders `<SessionView />` per session. `TerminalPane` is imported only by itself and by one stale smoke test (`pty-roundtrip.smoke.test.ts`). The flow-control "duplication" is therefore not a live ambiguity — `SessionView.tsx` is the only live path. The plan should delete `TerminalPane.tsx` (and migrate/retire the roundtrip smoke that uses it) to eliminate the confusion D-16 flagged, OR leave it and document it as dead. Recommendation: delete it, because keeping two divergent flow-control copies is a maintenance hazard and the CONTEXT explicitly asked to "resolve the duplication."

**Primary recommendation:** Compute agent-state **renderer-side** in `SessionView` from the `onPtyData` stream it already receives (zero IPC, no new bridge key, no `PtyStatusPayload` change), lift it via a callback into `SessionManager` state alongside `status`, and let `status-colors.ts` map `(processStatus, agentState)` → `{label, accent}`. For SC2, pre-validate cwd in `create()` and short-circuit to an `error` status + `notice` message before spawning. For SC3, call `term.reset()` on the kept-alive xterm at the restart/abnormal-exit seam already present in `SessionView`'s `onPtyStatus`/`onPtyExit` handlers. For SC5, add the control cluster to `IdentityHeader` and a `'session:clear'` main→renderer push for the chord.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spawn error detection (SC2) | Main (PtyManager) | — | cwd/shell cross the trust boundary and main is the sole spawn owner; validation must be main-side (matches CR-01 posture). |
| Spawn error message transport (SC2) | Main → Renderer via `onPtyStatus.notice` | — | Existing additive field; main owns the message text (V7 fixed/sanitized literals). |
| Error card + Edit/Retry UI (SC2/D-03/D-04) | Renderer (IdleCard) | — | Pure presentation reusing the dormant-card pattern; already has an `error` branch. |
| Agent-state detection (SC4) | **Renderer (SessionView)** | Main (alternative, rejected) | The renderer already receives every session's `onPtyData` for keep-alive; computing there is zero-IPC and avoids touching the validated bridge surface. |
| Agent-state aggregation + display (SC4) | Renderer (SessionManager → Sidebar/Header) | — | SessionManager already owns the per-session status state and subscriptions. |
| Alt-screen reset (SC3) | Renderer (SessionView, on the kept-alive xterm) | — | The stale alt-screen buffer lives in the renderer's xterm instance; main has no terminal buffer to reset. |
| Header controls (SC5) | Renderer (IdentityHeader + SessionManager handlers) | Main (Clear chord interception only) | Clear is a renderer xterm op; Restart/Start are existing renderer→main calls; the chord must be intercepted main-side ("app-wins"). |
| Clear-terminal op (SC5/D-12) | Renderer (xterm `term.clear()`) | — | No main-side replay buffer exists — the xterm instance IS the buffer. |
| Folder picker (folded todo) | Main (`dialog.showOpenDialog`) | Renderer (Browse button) | Native dialog is a main-only API; needs the one new `pickDirectory` bridge key. |
| Edit-prefill hydration (folded todo) | Renderer (SessionManager) reading main's `listSessions` snapshot | Main (source of truth) | Main owns the resolved cwd; renderer must re-read it after spawn / save. |

## Standard Stack

No new runtime dependencies are required for this phase. Everything is built on the pinned stack already installed and verified.

### Core (already installed — verified against `node_modules`)
| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| electron | 36.9.5 | `dialog.showOpenDialog` (folder picker), `before-input-event` (Clear chord) | Pinned per CLAUDE.md; `dialog` is the standard native folder-picker API. [VERIFIED: node_modules/electron/package.json] |
| node-pty | 1.1.0 | spawn error semantics (SC2) | Pinned per CLAUDE.md. Spawn-then-die behavior verified empirically this session. [VERIFIED: node_modules/node-pty/package.json + empirical test] |
| @xterm/xterm | 5.5.0 | `term.clear()` (SC5), `term.reset()` (SC3) | Pinned per CLAUDE.md. Both methods present in the installed typings. [VERIFIED: node_modules/@xterm/xterm/typings/xterm.d.ts] |

### Supporting (already installed)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| @xterm/addon-fit, -webgl, -canvas, -web-links, -unicode11 | Unchanged from Phase 2/3 | No change this phase |
| @dnd-kit/* | Sidebar reorder | No change this phase |
| lowdb 7 | Persistence | No change this phase (edit-prefill reads main's in-memory snapshot, not the store) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Renderer-side agent-state detector | Main-side detector on the PTY data stream, broadcast via a new `PtyStatusPayload.agentState` field | Main-side keeps the heuristic centralized and survives a paused/backpressured renderer better, but it (a) requires extending `PtyStatusPayload` (touches api-types + the security guard's reasoning even if not the key list), (b) adds a per-chunk regex on the hot data path in main, and (c) duplicates the idle timer main already doesn't run. Renderer-side is zero-IPC, reuses the stream SessionView already consumes, and keeps the bridge surface frozen. **Rejected in favor of renderer-side** (see §Architecture Pattern 1). |
| `term.clear()` for SC5 Clear | `term.reset()` | `reset()` (RIS) wipes scrollback AND resets all terminal modes/colors/cursor — too aggressive for a user "Clear" (it would also clear the current prompt and reset the program's color state). `clear()` is the documented "keep the prompt line, drop scrollback above it" op — exactly iTerm/VSCode Cmd+K semantics (D-12). Use `clear()` for SC5, `reset()` for SC3. [CITED: xterm.d.ts] |
| `term.reset()` for SC3 alt-screen | Writing `\x1b[?1049l` (exit alt-screen) then `\x1bc` (RIS) manually | `reset()` IS `\x1bc` (RIS) per the xterm typings, which exits the alternate-screen buffer and clears all state — a single documented call. Writing the raw sequences is more surgical but more fragile. Use `term.reset()`. See §Architecture Pattern 2. [CITED: xterm.d.ts line 1252] |

**Installation:** None. (`npm install` unchanged.)

**Version verification (run this session):**
```
electron     36.9.5   [VERIFIED: node_modules]
node-pty     1.1.0    [VERIFIED: node_modules]
@xterm/xterm 5.5.0    [VERIFIED: node_modules]
```

## Package Legitimacy Audit

No external packages are installed this phase — all capabilities use already-pinned, already-audited dependencies. The Package Legitimacy Gate is **not applicable** (no `npm install` of new packages). slopcheck not run (nothing to check).

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none added) | — | N/A — phase adds no dependencies |

## Architecture Patterns

### System Architecture Diagram

```
                        ┌──────────────────────── MAIN PROCESS ────────────────────────┐
                        │                                                               │
  user types "Browse…"  │   PtyManager.create(opts)                                     │
        │               │     │                                                         │
        ▼               │     ├─ resolve cwd  ── opts.cwd? ──no──▶ os.homedir() (OK)     │
  ┌───────────┐ pickDir │     │                   │yes (explicit)                       │
  │ EditModal │────────▶│  dialog.showOpenDialog  ├─ isValidCwd(cwd)? ──no──┐           │
  └───────────┘◀────────│  → absolute path        │                        │ (SC2/D-01)│
        │  path         │                         ▼yes                      ▼           │
        │               │                 try { pty.spawn(shell,…) }   setStatus(error) │
        │               │                   │            │catch          + notice msg   │
        │               │           ┌────────┘            ▼                  │           │
        │               │           │             setStatus(error)+notice    │           │
        │               │           ▼  (success)                             │           │
        │               │   child.onData ─────────────┐                      │           │
        │               │   child.onExit(code≠0,!stop)─┼── setStatus(error)   │           │
        │               └──────────────┬──────────────┼──────────┬───────────┘           │
                                       │ pty:data      │ pty:status (status+notice)
                        ┌──────────────▼───────────────▼──────────▼──── RENDERER ────────┐
                        │  SessionView (per session, kept-alive xterm)                    │
                        │    onPtyData(data):                                             │
                        │      watermark.add/drain → ptyPause/ptyResume  (SC1, exists)    │
                        │      term.write(data)                                           │
                        │      ── agent-state detector (SC4, NEW) ──                      │
                        │         lastByteAt = now; clear idleTimer; agentState=in-progress│
                        │         setTimeout(IDLE_MS): lastLine = stripAnsi(buffer tail)  │
                        │           agentState = PROMPT_RE.test(lastLine)?waiting:free    │
                        │         onAgentState(id, agentState) ───────────┐               │
                        │    onPtyStatus(p):                              │               │
                        │      if p.notice && status==='error': (SC2 card path)           │
                        │      if 'running' & restart: term.reset() (SC3, NEW) +separator │
                        │    onPtyExit(): if abnormal: term.reset() (SC3, NEW)            │
                        │                                                 │               │
                        ├─────────────────────────────────────────────────▼──────────────┤
                        │  SessionManager                                                 │
                        │    sessions[]: {…, status, agentState}  ◀── onAgentState         │
                        │    onPtyStatus → status (+ notice → error card)                  │
                        │    handleClear(id) → window.__sessionTerms[id].clear() (SC5)     │
                        │    handleRestart / handleStart / handleStartNoCmd (SC5)          │
                        │    onSwitchSession-style 'session:clear' sub → handleClear       │
                        │       │                          │                               │
                        ▼       ▼                          ▼                               │
                   ┌─────────────┐            ┌──────────────────────┐                     │
                   │  Sidebar    │            │   IdentityHeader      │                     │
                   │  row dot =  │            │   [Clear][Restart|▶]  │ (SC5/D-11)          │
                   │  agentState │            │   badge = agentState  │                     │
                   └─────────────┘            └──────────────────────┘                     │
                        └───────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
No new files are strictly required, but the cleanest split is:
```
src/
├── shared/
│   └── agent-state.ts        # NEW — pure: PROMPT_RE, stripAnsi(lastLine), classifyAgentState()
│                             #        (electron/xterm-free → Vitest-importable, mirrors flow-control.ts)
├── renderer/
│   ├── SessionView.tsx       # EDIT — add the idle-timer agent-state detector + term.reset() (SC3/SC4)
│   ├── status-colors.ts      # EDIT — add agent-state ramp (amber waiting / blue in-progress / slate free)
│   ├── SessionManager.tsx    # EDIT — agentState state, handleClear, handleStartNoCmd, edit-prefill hydrate, 'session:clear' sub
│   ├── IdentityHeader.tsx    # EDIT — control cluster (Clear/Restart/Start) + agent-state badge
│   ├── Sidebar.tsx           # EDIT — row dot/badge consume agentState; "Start without command" context-menu item
│   ├── IdleCard.tsx          # EDIT — generic error message + Edit/Retry buttons (D-03/D-04)
│   ├── SessionEditModal.tsx  # EDIT — "Browse…" button next to cwd
│   └── TerminalPane.tsx      # DELETE (dead code — confirmed not in the live tree)
├── main/
│   ├── pty-manager.ts        # EDIT — D-01 pre-validate cwd, try/catch spawn, D-02 no-silent-home, D-15 abnormal-exit signal; WR-01..05/IN-* probe fixes
│   ├── readiness-probe.ts    # EDIT — WR-02 matcher, WR-03 bounded buffer, IN-02 note
│   ├── index.ts              # EDIT — pickDirectory handler + Clear-chord branch in before-input-event
│   └── window-config.ts      # EDIT — EXPECTED_API_KEYS += 'pickDirectory'
├── preload/index.ts          # EDIT — pickDirectory + (optionally) onSessionClear subscribe
└── shared/api-types.ts       # EDIT — ElectronAPI += pickDirectory (+ onSessionClear)
```

### Pattern 1: Renderer-side agent-state detector (SC4 / TERM-09) — RECOMMENDED

**What:** Compute the three running sub-states (in-progress / waiting / free) in `SessionView`, off the `onPtyData` stream it already subscribes to, using an idle timer + a conservative trailing-line regex. Lift the result up to `SessionManager` through a callback prop.

**When to use:** This is the recommended path (zero IPC, no bridge change, no `PtyStatusPayload` change, no hot-path regex in main).

**Mechanism:**
- On every `onPtyData` chunk: mark `lastByteAt = Date.now()`, set `agentState = 'in-progress'` (output is flowing), reset the idle timer to fire after `IDLE_MS`.
- Maintain a small rolling tail of recent output (cap ~4 KB — see WR-03 lesson) so the detector can read the last non-empty line without holding the whole scrollback.
- When the idle timer fires (no output for `IDLE_MS`): strip ANSI from the tail, take the last non-empty line, test it against `PROMPT_RE`. Match → `'waiting'`; no match → `'free'`.
- Call `onAgentState(id, next)` only when the value changes (avoid render churn).
- Only run the detector while the session's process status is `running` (no point classifying a dormant/exited session).

**Idle threshold (Claude's discretion, D-08):** **`IDLE_MS = 800`**. Rationale: an agent that has printed a `[y/N]` and is now blocked produces zero bytes; 800 ms is long enough that normal mid-stream pauses (network, thinking spinners that emit bytes) don't flip to "waiting", and short enough that a real prompt shows amber within ~1 s. Tune during E2E against real `claude --rc` output; keep it in the low-single-digit-seconds band the CONTEXT specified.

**Prompt regex (Claude's discretion, D-09 — conservative set):**
```ts
// src/shared/agent-state.ts  [pattern; tune against real captures during E2E]
// Test against the LAST NON-EMPTY line only, after ANSI strip + trailing-whitespace trim.
const PROMPT_RE = /(?:\?|\[y\/n\]|\[y\/N\]|\[Y\/n\]|\(y\/n\)|\(yes\/no\)|❯)\s*$/i;
```
Notes:
- Anchor with `\s*$` so the marker must be at the END of the line (a `?` mid-sentence in normal output does not match — fewer false positives, honoring "best-effort means conservative").
- The bare trailing `?` is the loosest member and the biggest false-positive risk (e.g. a comment ending in `?`). Keep it because the canonical agent confirmations use it, but it is gated behind `IDLE_MS` of silence (D-08) which removes most noise.
- A naked shell prompt (`%`, `$`, `❯` with no question) should read as **free**, not waiting — so do NOT add `$`/`%` to the set. `❯` is included because the agent arrow-menu uses it as a *selection* prompt, but this is the one debatable member; if E2E shows a plain zsh `❯ ` prompt false-positives, drop `❯` or require it be followed by menu-ish content.

### Pattern 2: Alt-screen reset on the kept-alive xterm (SC3 / D-15)

**What:** When a session restarts or exits abnormally, the kept-alive xterm may be stuck in the alternate-screen buffer (vim/less switched to it via `\x1b[?1049h` and never sent `\x1b[?1049l` because it was killed). Call `term.reset()` to perform a full RIS (`\x1bc`) which exits the alt-screen and clears all modes.

**Where to trigger (D-15 — two seams, both in `SessionView`):**
1. **On restart, before the new PTY's first output.** The restart path surfaces in `SessionView`'s `onPtyStatus` handler as a *second* `'running'` transition (`hasRunBeforeRef.current === true`). Call `term.reset()` there, *before* writing the `— restarted HH:MM —` separator, so the fresh prompt paints on a clean primary screen. (Note: the separator currently uses `term.write` AFTER what would be the reset — order matters; reset first, then write the separator.)
2. **On abnormal exit (exited/error, not user-stopped).** Surfaces in `SessionView`'s `onPtyExit` handler (or the `error`/`exited` `onPtyStatus`). The current handler writes `[process exited]`. For an abnormal exit, call `term.reset()` *then* write the notice, so a vim that was killed doesn't leave a frozen frame.

**Caveat to verify in the plan:** `onPtyExit` only carries `exitCode`, and `SessionView` does not currently know `userStopped`. A user-initiated **Close** is destructive (the SessionView unmounts), so the only `onPtyExit` a live SessionView sees is a self-exit or an abnormal exit — both of which warrant a reset of the *displayed* frame anyway (the process is gone; a clean frame is correct). A user **Restart** goes through the restart path (seam 1). A user **Stop** is retained-but-unbuttoned. So in practice: reset on the restart transition (seam 1) and on `onPtyExit` (seam 2) covers SC3 without needing `userStopped` in the renderer. Confirm there is no case where resetting on a clean `exit 0` is undesirable — it isn't, because `[process exited]` + a clean screen is the correct end state.

### Pattern 3: SC2 spawn-error short-circuit in `create()` (D-01/D-02/D-05)

**What:** Pre-validate an *explicitly supplied* cwd before spawning; if invalid, do NOT spawn and do NOT fall back to home — set `error` status and emit the specific notice. Wrap `pty.spawn()` in try/catch for the rare synchronous failure. Treat the async abnormal `onExit` as the generic fallback.

**The cwd-resolution change (D-02 — the subtle part):** today `create()` does:
```ts
const cwd = opts.cwd?.length ? opts.cwd
          : prior?.cwd?.length ? prior.cwd
          : os.homedir();
```
This conflates "no cwd → home is fine" with "stored cwd is set but now missing". The fix must distinguish: a cwd that came from `opts`/`prior` (user intent) and is now missing must error; an absent cwd legitimately defaults to home. See §Code Examples for the exact reshaping.

**Status + message:** reuse `setStatus(id, 'error', …)` and send the message via `PtyStatusPayload.notice` (the 05.1 field). The renderer already short-circuits on `p.notice` in `SessionView`; the SC2 path additionally needs `SessionManager` to capture the notice into the row so the **sidebar tooltip** (D-03) and the **error card** (D-03/D-04) can show it. Today `onPtyStatus` in `SessionManager` ignores `notice` — extend it to store the latest error message per session (a `errorMessage?: string` on the renderer-side row, or a parallel map). This is renderer-state only — no type/bridge change.

### Pattern 4: Header controls + Clear chord (SC5 / D-11/D-12/D-13)

**Controls (`IdentityHeader.tsx`):** add a right-aligned cluster of Tab-focusable `<button>`s:
- **Clear** (always): `onClick → handleClear(activeId)`. `handleClear` reaches the active session's xterm via the already-exposed `window.__sessionTerms[id]` handle and calls `.clear()`. (Alternative: thread a ref/imperative handle from SessionView — but `window.__sessionTerms` already exists for the E2E driver and is the lowest-friction path; the plan may choose a cleaner ref API.)
- **Restart** (when `status === 'running'`): `onClick → handleRestart(activeId)` (exists).
- **Start ▶** (when not running): `onClick → handleStart(activeId)` (exists).

**Keyboard (D-13):** the buttons are natively Enter/Space-activatable (satisfies "keyboard-accessible"). The global **Clear chord** (Cmd+K mac / Ctrl+Shift+K win) reuses the `before-input-event` "app-wins" interception in `main/index.ts`. Add a matcher branch (or a small `matchClearKey` mirroring `matchSwitchKey`) and push a `'session:clear'` event — the renderer subscribes exactly like `onSwitchSession` and calls `handleClear(activeId)`.

**Bridge surface note:** `'session:clear'` is a main→renderer *event* (like `'session:switch'`). It needs an `onSessionClear` subscribe method in the preload — which IS a new bridge key, so `EXPECTED_API_KEYS` would go to 20 (with `pickDirectory`). **Two options for the planner:**
- (a) Add `onSessionClear` as a second new key (lockstep update — clean, explicit, mirrors `onSwitchSession`).
- (b) Reuse the existing `onSwitchSession` channel shape by adding a `{ kind: 'clear' }` variant to `SwitchIntent` — **no new key**, the chord rides the existing `'session:switch'` event and `resolveSwitch`/`SessionManager` branch on `kind: 'clear'` to call `handleClear` instead of switching. This keeps `EXPECTED_API_KEYS` at 19 (only `pickDirectory` added). **Recommended: (b)** — it honors the CONTEXT's "minimize new keys" constraint and the chord is conceptually an app-level keyboard intent, same family as switch. The matcher returns `{ kind: 'clear' }`; `SessionManager`'s `onSwitchSession` handler dispatches clear vs switch.

### Anti-Patterns to Avoid
- **Injecting `clear`/Ctrl+L into the PTY for the Clear control.** D-12 is explicit: Clear is a client-side xterm op (`term.clear()`), not a shell command. Injecting would pollute shell history and behave differently per shell. Use `term.clear()`.
- **Adding a 6th `SessionStatus`.** The agent-state is a presentation overlay (D-06, DESIGN.md reconciliation). Never add `'waiting'` to the `SessionStatus` union in `shared/types.ts`.
- **Letting a notice-bearing `onPtyStatus` event be treated as a restart (CR-01 regression).** The SessionView guard already returns early on `p.notice`. The new SC2 error path must preserve that ordering — set the error status FIRST, then the notice, and ensure SessionManager distinguishes "error+notice" (show card) from "running+notice" (05.1 ready-fail inline line).
- **Computing the agent-state regex on the main hot path per chunk.** Rejected in favor of the renderer idle-timer approach (Pattern 1).
- **Resetting the terminal on a clean user Restart before the separator is preserved.** `term.reset()` clears scrollback — D-03's "preserve scrollback across restart" intent (Phase 3) must be weighed. **Resolution:** SC3 explicitly wants a *clean* frame on reopen of a killed alt-screen app, which conflicts with "preserve scrollback". Reset only clears the *visible alt-screen frame* problem but also drops scrollback. The plan should consider `\x1b[?1049l` (exit alt-screen only, preserve primary-screen scrollback) instead of full RIS *for the restart path*, and reserve full `reset()` for the abnormal-exit path. **This is the one real design tension — flag it for the planner.** See §Open Questions Q1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clear terminal scrollback | Manual buffer manipulation / writing many `\n` | `term.clear()` | Documented xterm API: "Clear the entire buffer, making the prompt line the new first line." Exactly D-12 semantics. [CITED: xterm.d.ts] |
| Exit alt-screen / full reset | Hand-written escape-sequence soup | `term.reset()` (= RIS `\x1bc`) or the single `\x1b[?1049l` for alt-screen-only | xterm provides `reset()`; the alt-screen toggle is a single well-known DECRST. |
| Folder selection | Custom path-input parsing / a renderer file tree | `dialog.showOpenDialog({ properties: ['openDirectory'] })` | Native OS picker, returns absolute paths, handles permissions; main-only API. |
| cwd validity check | New validator | `PtyManager.isValidCwd` (exists, lines 778-785) | Already written for CR-01: absolute + `fs.statSync().isDirectory()` in try/catch. Reuse verbatim for D-01. |
| Spawn-error message transport | New IPC channel/bridge key | `PtyStatusPayload.notice` (exists, 05.1) | Additive field already on the `onPtyStatus` channel; zero new keys. |
| Error placeholder card | New component | `IdleCard.tsx` (exists; already has an `error` branch, lines 88-93) | D-03/D-04 explicitly reuse the dormant-card pattern. |
| Watermark backpressure | New flow-control | `createWatermark` + the `SessionView` wiring (exists) | SC1 is built (D-16); this phase validates it. |
| Restart / Start orchestration | New lifecycle code | `handleRestart` / `handleStart` in SessionManager (exist) | SC5 wires existing handlers to header buttons. |
| ANSI stripping for the last-line check | A new ANSI parser | A small focused regex in `shared/agent-state.ts` | Full ANSI parsing is overkill; the detector only needs to strip CSI/SGR from a ~4 KB tail to read the last printable line. Keep it minimal and unit-test it. |

**Key insight:** This phase's risk is not "what library do I need" — it is "which existing seam do I extend, and where is the one subtle correctness trap." Almost every capability already has a home in the code; the planner's job is wiring + the SC2 cwd-resolution reshaping + the SC3 reset-vs-scrollback tension.

## Runtime State Inventory

This phase is feature work, not a rename/refactor/migration. No stored data keys, service configs, OS registrations, or secrets are renamed.

- **Stored data:** None changed. The lowdb `SessionRecord` shape is unchanged (no new persisted field — `agentState` is ephemeral renderer state, never persisted; `errorMessage` is ephemeral). Verified: no new field added to `shared/types.ts SessionRecord`.
- **Live service config:** None — local-only app, no external services.
- **OS-registered state:** The folder picker invokes a native macOS dialog at runtime; it registers nothing persistent.
- **Secrets/env vars:** None.
- **Build artifacts:** Deleting `TerminalPane.tsx` (dead code) requires no rebuild beyond the normal Vite bundle; the stale `pty-roundtrip.smoke.test.ts` that imports the live tree via `window.__term` must be checked — it drives the app generically (via `ensureSession`/`readBuffer`), so it likely still passes against `SessionView`'s `window.__term`. Verify the roundtrip smoke does not import `TerminalPane` directly (grep shows it references it only in a comment/text, not an import) before deleting.

## Common Pitfalls

### Pitfall 1: Assuming `pty.spawn()` throws synchronously on a bad cwd/shell (it does NOT on macOS)
**What goes wrong:** A try/catch around `pty.spawn()` is written expecting it to catch a missing cwd; it never fires, the session shows a generic exit, and the SC2 "Working directory not found" message never appears.
**Why it happens:** node-pty's `UnixTerminal` calls the native `pty.fork()` (forkpty + exec). A non-existent cwd or unexecutable shell fails in the *child* after fork, so the parent gets a successful-looking spawn followed by `onExit({ exitCode: 1 })` tens of ms later — NOT a synchronous JS throw.
**Verified this session:**
```
bad-cwd:   onExit code=1 signal=0   (no sync throw)
bad-shell: onExit code=1 signal=0   (no sync throw)
```
**How to avoid:** D-01's pre-validation is mandatory, not optional. For the *specific* message, validate `cwd` BEFORE spawning and short-circuit. Keep the try/catch (it catches the rare synchronous failure like an EACCES on the helper), and ALSO treat an immediate abnormal `onExit` as the generic fallback. The current `deriveStatus` already maps `exitCode≠0 && !userStopped → 'error'`, so the abnormal-exit path produces `error` — it just lacks a message; the pre-validation supplies the good message for the common case.
**Warning signs:** SC2 acceptance test passes only when you supply a *specific* bad cwd through validation, never through the catch.

### Pitfall 2: The silent home-directory fallback masks a user's missing cwd (D-02)
**What goes wrong:** A session configured with `cwd: /Users/me/project` that has since been deleted spawns silently in `~` instead of erroring — exactly what SC2 forbids.
**Why it happens:** The current `opts.cwd || prior.cwd || os.homedir()` chain treats "missing directory" and "no directory specified" identically.
**How to avoid:** Separate the two cases. If a cwd was *explicitly* provided (opts or stored on the record) and fails `isValidCwd`, that is an error (do not fall to home). If no cwd was provided at all, home is the correct default. See §Code Examples.
**Warning signs:** Deleting a session's configured directory and Starting it lands you in `~` with no error.

### Pitfall 3: `term.clear()` vs `term.reset()` confusion (SC5 vs SC3)
**What goes wrong:** Using `reset()` for the user Clear control wipes the current prompt and resets program colors (jarring); using `clear()` for the alt-screen fix leaves the terminal stuck in the alternate buffer (clear only clears the active buffer, doesn't exit alt-screen).
**How to avoid:** `clear()` for SC5 (keep prompt, drop scrollback). `reset()`/`\x1b[?1049l` for SC3 (exit alt-screen). They are not interchangeable.
**Warning signs:** Clear erases the live prompt; or a killed vim still shows its frame after restart.

### Pitfall 4: Resetting on restart destroys the Phase-3 scrollback-preservation intent (the SC3↔D-03 tension)
**What goes wrong:** Phase 3 D-03 deliberately preserves scrollback across restart (the `— restarted —` separator into the SAME instance). A blanket `term.reset()` on restart throws that scrollback away.
**How to avoid:** For the restart path, prefer the surgical `\x1b[?1049l` (exit alt-screen only) so primary-screen scrollback survives; reserve full `reset()` for abnormal exit where the frame is genuinely dead. **Flagged as Open Question Q1 — needs a planner/UX decision.**

### Pitfall 5: WR-02 probe matcher false-positive (folded 05.1 fix)
**What goes wrong:** The current readiness-probe regex `${nonce}[^\n]*\n[\s\S]*` matches the shell's *echo* of the typed marker line when the echo carries a trailing `\n` in the same chunk — injecting the startup command before the shell is genuinely ready (garbled keystrokes, the exact failure 05.1 existed to fix).
**How to avoid:** Require the nonce to appear on a *produced* line, not the echo line — match `\n` + nonce (nonce at the START of an output line) or require the nonce a second time. Tune against real cold zsh/bash captures. See §State of the Art / the 05.1-REVIEW findings table below.

### Pitfall 6: Agent-state idle timer leaking across unmount / status change
**What goes wrong:** The `setTimeout` idle timer in SessionView outlives a session that exits or unmounts, firing `onAgentState` on a dead id, or stacking timers on rapid output.
**How to avoid:** Single-slot timer ref (clear before re-arming on each chunk), clear it in the effect cleanup, and gate the whole detector on `status === 'running'`. Mirror the disciplined `timerRef` pattern already used in `pty-manager.ts`'s probe timeout.

## Code Examples

### SC2 — cwd resolution that errors instead of silently using home (D-02)
```ts
// src/main/pty-manager.ts — inside create(), replacing the current cwd chain.
// Distinguish "no cwd given (home OK)" from "cwd given but missing (error)".
const requestedCwd = opts.cwd?.length ? opts.cwd
                   : prior?.cwd?.length ? prior.cwd
                   : undefined;            // no cwd specified anywhere

if (requestedCwd !== undefined && !this.isValidCwd(requestedCwd)) {
  // D-01/D-02/D-05: explicit cwd is missing → ERROR, never silent ~.
  // Build/keep the record in 'error' state (so the row + IdleCard render it),
  // do NOT spawn, and ride the message on the existing notice field.
  this.setStatus(id, 'error', /* extra */ {});           // red badge
  this.send(PTY_CHANNELS.status, {
    id, status: 'error',
    notice: `Working directory not found: ${requestedCwd}`, // D-05 specific
  });
  return { id, pid: -1 }; // no live pty; caller handles the error result
}
const cwd = requestedCwd ?? os.homedir(); // only home when truly unspecified

// ... then:
let child: IPty;
try {
  child = pty.spawn(shell, args, { name: 'xterm-256color',
    cols: clampDimension(opts.cols), rows: clampDimension(opts.rows), cwd, env: {…} });
} catch (err) {
  this.send(PTY_CHANNELS.status, {
    id, status: 'error',
    notice: `Couldn't start session: ${(err as Error).message}`, // D-05 generic
  });
  this.setStatus(id, 'error', {});
  return { id, pid: -1 };
}
// NOTE: the async abnormal-exit path (onExit code≠0) already → 'error' via deriveStatus;
// supply a generic notice there too if no notice was sent, for the SC2 message in the card.
```
*Source: synthesized from existing `create()` + `isValidCwd` (pty-manager.ts) + the empirical spawn test. [VERIFIED: pty-manager.ts read + node-pty empirical test]*

### SC4 — pure agent-state classifier (new `shared/agent-state.ts`)
```ts
// src/shared/agent-state.ts — pure, electron/xterm-free (mirrors flow-control.ts).
export type AgentState = 'in-progress' | 'waiting' | 'free';

// Strip CSI/SGR/OSC escapes so the trailing-line shape test sees printable text only.
const ANSI_RE = /[\x1b\x9b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PR-TZcf-ntqry=><~]/g;
export function lastNonEmptyLine(tail: string): string {
  const clean = tail.replace(ANSI_RE, '');
  const lines = clean.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trimEnd();
    if (t.trim().length > 0) return t;
  }
  return '';
}
// D-09 conservative set; tune against real claude --rc / codex captures during E2E.
const PROMPT_RE = /(?:\?|\[y\/n\]|\(y\/n\)|\(yes\/no\)|❯)\s*$/i;
export function classifyIdle(tail: string): AgentState {
  return PROMPT_RE.test(lastNonEmptyLine(tail)) ? 'waiting' : 'free';
}
```
*Source: pattern synthesized from D-08/D-09 + the WR-* lessons. [ASSUMED] — regex shape is a starting point, must be E2E-tuned (see Assumptions Log A1).*

### SC4 — detector wiring inside SessionView's onPtyData (sketch)
```ts
// Inside the mount effect, alongside the existing watermark logic:
const IDLE_MS = 800;                      // Claude's discretion (D-08); tune in E2E
let tail = '';                            // rolling ~4KB tail (WR-03 lesson: bound it)
const idleRef: { t?: ReturnType<typeof setTimeout> } = {};
const offData = window.api.onPtyData(id, (data) => {
  // … existing watermark.add / pause / term.write …
  tail = (tail + data).slice(-4096);
  onAgentState(id, 'in-progress');        // output flowing
  if (idleRef.t) clearTimeout(idleRef.t);
  idleRef.t = setTimeout(() => {
    onAgentState(id, classifyIdle(tail)); // waiting | free
  }, IDLE_MS);
});
// cleanup: if (idleRef.t) clearTimeout(idleRef.t);
```
*Source: synthesized from SessionView's existing onPtyData. [VERIFIED: SessionView.tsx read]*

### SC4 — status-colors mapping with the agent-state overlay
```ts
// src/renderer/status-colors.ts — add the agent-state layer over the 5 process states.
export const AGENT_STYLE = {
  'in-progress': { label: 'In progress',     accent: 'oklch(0.62 0.14 248)' }, // blue
  'waiting':     { label: 'Waiting for you', accent: 'oklch(0.66 0.15 60)'  }, // amber (TERM-09)
  'free':        { label: 'Free',            accent: 'oklch(0.64 0.02 260)' }, // slate
} as const;
// presentation resolver: agent-state only overrides while the process status is 'running'.
export function presentation(status: SessionStatus, agent?: AgentState) {
  if (status === 'running' && agent) return AGENT_STYLE[agent];
  return STATUS_STYLE[status]; // exited→green Done, error→red, not_started/stopped→slate
}
```
*Source: DESIGN.md §"Status system" ramps (oklch values verified) + status-colors.ts. [CITED: DESIGN.md lines 55-59]*

### SC3 — alt-screen reset at the restart seam
```ts
// src/renderer/SessionView.tsx — in the onPtyStatus 'running' branch (restart path):
if (p.status === 'running') {
  if (hasRunBeforeRef.current) {
    term.write('\x1b[?1049l');            // exit alt-screen, PRESERVE scrollback (Pitfall 4)
    const hhmm = new Date().toTimeString().slice(0, 5);
    term.write(`\r\n\x1b[2m— restarted ${hhmm} —\x1b[0m\r\n`);
  }
  hasRunBeforeRef.current = true;
}
// in onPtyExit (abnormal frame is dead): term.reset() then write the exit notice.
```
*Source: SessionView.tsx + xterm typings. [VERIFIED: SessionView.tsx + xterm.d.ts] — note Q1 tension.*

### Folder picker — main handler + bridge (one new key)
```ts
// src/main/index.ts — register inside whenReady or alongside api:get-version:
import { dialog } from 'electron';
ipcMain.handle('dialog:pick-directory', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
});
// src/preload/index.ts:  pickDirectory: () => ipcRenderer.invoke('dialog:pick-directory'),
// src/shared/api-types.ts:  pickDirectory: () => Promise<string | null>;
// src/main/window-config.ts:  EXPECTED_API_KEYS += 'pickDirectory'  (→ 19 keys)
// src/shared/__tests__/security.guard.test.ts: GREEN automatically (asserts === EXPECTED_API_KEYS)
```
*Source: Electron `dialog` API + the existing bridge lockstep pattern. [CITED: existing preload/window-config/api-types lockstep]*

## State of the Art

### The 8 folded 05.1 review findings (WR-01..05, IN-01..03) — concrete fixes
| Finding | File / loc | Fix |
|---------|-----------|-----|
| **WR-01** dead invisibility-scrub path | pty-manager.ts 353-385 | On match, `offProbe.dispose()` runs, so the `settled` scrub branch (356-366) is unreachable. Either remove the dead scrub branch + the `stripProbeEcho` call (simplest — the discard-on-match already guarantees invisibility), OR keep the listener alive past match and route through the scrub. **Recommend: remove the dead branch + `stripProbeEcho` (and its unit test marked IN-01) since the match path already discards the buffer.** |
| **WR-02** matcher false-positive on echo-line | readiness-probe.ts 71 | Change `re` so the nonce must appear on a *produced* line: e.g. `new RegExp(`\\n[^\\n]*${safe}`)` (nonce after a newline boundary) or require the prompt-shaped suffix. Tune against real cold zsh/bash. |
| **WR-03** unbounded probe buffer | pty-manager.ts 368 | Cap `buffer` to the last N KB (e.g. 8 KB — enough for marker + prompt) before `probe.matches()`; keep only the bounded tail. |
| **WR-04** notice ctrl-char sanitize | SessionView.tsx 225-226 / preload | The renderer writes `p.notice` raw with ANSI wrappers. Strip control chars from `notice` before `term.write` (defense-in-depth; main only sends fixed literals today, but SC2 adds a cwd-path-bearing notice — sanitize it). |
| **WR-05** store-vs-inject trim | pty-manager.ts 338-339, updateProfile | Canonicalize: trim `startupCommand` at persist time in `updateProfile` so the stored value matches what is injected (`cmd + '\r'`). Document the chosen semantics. |
| **IN-01** `stripProbeEcho` unreachable | pty-manager.ts 124-130 | Folds into WR-01 — remove the helper if the dead branch is removed. |
| **IN-02** `void shellPath` unused | readiness-probe.ts 88,102 | Leave as-is (intentional seam shape); add a comment that per-shell behavior arrives in Phase 8. No code change required. |
| **IN-03** smoke ordering brittleness | startup-command.smoke.test.ts 115 | Anchor the assertion on the full `— restarted` separator string instead of `indexOf('restarted')`. Low risk; cheap. |

### Terminal / dead-code state
| Old | Current | Impact |
|-----|---------|--------|
| `TerminalPane.tsx` was the single-pane Phase-2 view | `SessionView.tsx` (per-session, kept-alive) is the live view; `index.tsx` renders `SessionManager` only | `TerminalPane` is dead. D-16's "duplication" is resolved by deleting it. The flow-control logic lives only in `SessionView` now. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `PROMPT_RE` set (`?`, `[y/n]`, `(y/n)`, `(yes/no)`, `❯`) and `IDLE_MS=800` correctly classify real `claude --rc`/`codex` confirmation prompts vs normal output | Pattern 1 / Code Examples | False positives (amber when not waiting) or misses (no amber when blocked). Best-effort by design; mitigated by E2E tuning + the conservative idle-AND-pattern gate (D-08). MUST be tuned against real captures before sign-off. |
| A2 | `\x1b[?1049l` (exit alt-screen) preserves primary-screen scrollback while clearing the stale vim/less frame on the restart path | Pattern 2 / Pitfall 4 | If it doesn't fully clear the frame, SC3 fails and a full `term.reset()` (losing scrollback) is needed — directly conflicts with Phase-3 D-03 scrollback preservation. Verify empirically in E2E (kill vim, restart, inspect). |
| A3 | The `pty-roundtrip.smoke.test.ts` drives the app generically (via `ensureSession`/`window.__term`) and does not import `TerminalPane`, so deleting `TerminalPane.tsx` won't break it | Runtime State Inventory | If it imports TerminalPane directly, deletion breaks the build; grep before delete (the grep this session showed only a comment reference, not an import). |
| A4 | Reusing `SwitchIntent` with a `{ kind: 'clear' }` variant for the Clear chord keeps `EXPECTED_API_KEYS` at 19 (only `pickDirectory` new) | Pattern 4 / Bridge note | If the planner prefers a dedicated `onSessionClear` key, the guard test + EXPECTED_API_KEYS go to 20 — both are valid; this is a design choice, not a correctness risk. |

## Open Questions (RESOLVED)

1. **SC3 reset mechanism: full `term.reset()` vs surgical `\x1b[?1049l` on the RESTART path (the SC3↔D-03 scrollback tension).**
   - What we know: `reset()` exits alt-screen but wipes scrollback; `\x1b[?1049l` exits alt-screen and preserves the primary buffer. Phase 3 D-03 deliberately preserves scrollback across restart.
   - What's unclear: whether `\x1b[?1049l` alone reliably clears a killed-vim frame, or whether residual cursor/mode state needs more.
   - Recommendation: use `\x1b[?1049l` on the restart path (preserve scrollback, satisfy D-03) and full `term.reset()` on the abnormal-exit path (frame is dead, scrollback-of-a-dead-process is less precious). Verify both in E2E. Flag to the planner as a checkpoint:human-verify item.
   - **RESOLVED:** Adopted in Plan 06-04/T2 (`\x1b[?1049l` on restart, `term.reset()` on abnormal exit); empirical confirmation gated to the Plan 06-04/T4 checkpoint:human-verify task.

2. **Where does the SC2 error message live in renderer state so BOTH the sidebar tooltip (D-03) and the error card (D-03/D-04) show it?**
   - What we know: `onPtyStatus` carries `notice`; SessionManager currently drops it.
   - Recommendation: store a per-session `errorMessage?: string` in SessionManager's row state (renderer-only, no type/bridge change), set from the error-status `notice`, passed to both Sidebar (tooltip) and IdleCard (card body). Planner to confirm the row-state shape.
   - **RESOLVED:** Adopted in Plan 06-02/T2 — per-session `errorMessage?` row state set from the error-status `notice`, fed to both the Sidebar tooltip and the IdleCard error card. No type/bridge change.

3. **Edit-prefill hydration timing.** `session-add.ts` mints `cwd: ''`; main resolves the real cwd. After spawn (onAdd) and after `onSaveProfile`, the renderer row's `cwd`/`shell` are stale.
   - Recommendation: after `onAdd`'s spawn resolves AND after `onSaveProfile`, re-read `window.api.listSessions()` and merge the authoritative `cwd`/`shell`/`startupCommand` into the matching row (main is source of truth; no new bridge key — `listSessions` exists). Planner to confirm this doesn't disturb the optimistic status updates.
   - **RESOLVED:** Adopted in Plan 06-02/T2 — re-read `window.api.listSessions()` after `onAdd` spawn resolves and after `onSaveProfile`, merging authoritative `cwd`/`shell`/`startupCommand`. No new bridge key.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node-pty (built against Electron 36 ABI) | SC1/SC2 spawn behavior | ✓ | 1.1.0 | — |
| @xterm/xterm | SC3 reset, SC5 clear | ✓ | 5.5.0 | — |
| Electron `dialog` | folder picker | ✓ (main process, Electron 36.9.5) | 36.9.5 | text input (current cwd field) remains as the fallback if picker is descoped |
| `/dev/urandom`, `cat`, `head` | SC1 validation command | ✓ (macOS) | — | `yes | head -n N` (already used by the Phase-2 throughput smoke) |
| WebdriverIO + @wdio/electron-service + xterm-driver | E2E validation | ✓ (existing smoke harness) | — | manual human-verify checkpoint |
| Vitest | unit tests (pure modules) | ✓ | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None blocking.

## Validation Architecture

> nyquist_validation is enabled (no `.planning/config.json` override found disabling it; the project has run Nyquist sign-offs every prior phase).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit, Node env) + WebdriverIO with `@wdio/electron-service` (E2E smoke) |
| Config file | `vitest.config.*` + `wdio.conf.*` (existing; Phase 1 Wave 0) |
| Quick run command | `npm test` (Vitest unit suite — 147+ tests) |
| Full suite command | `npm test` + the WDIO smoke suite (`tests/smoke/*.smoke.test.ts`) |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|--------------|
| SC1 (TERM-09 adj.) | 100MB throughput no freeze/crash/drop; watermark pause+resume | E2E smoke (extend existing) | reuse/extend `tests/smoke/pty-throughput.smoke.test.ts` with `cat /dev/urandom | head -c 100M` (or scaled `yes | head`) | ✅ exists (Phase 2) — extend |
| SC2 | Missing cwd → `error` + `Working directory not found: <path>`, never `~` | Unit (cwd-resolution + pre-validate) + E2E | `pytest`-equiv: Vitest on a new `create()`-cwd unit OR a `pty-manager` spawn-error test; E2E: configure a bad cwd, Start, assert error card | ❌ Wave 0 — `src/main/__tests__/pty-spawn-error.test.ts` + smoke |
| SC3 | Killed vim/less → clean prompt on reopen | E2E smoke | new `tests/smoke/alt-screen-reset.smoke.test.ts`: open vim, kill PTY, restart, assert no alt-screen frame remnants in buffer | ❌ Wave 0 |
| SC4 (TERM-09) | Idle-after-prompt → amber "Waiting for you"; flowing → blue; idle-no-prompt → free | Unit (pure classifier) + E2E | Vitest on `shared/agent-state.ts` (`classifyIdle`, `lastNonEmptyLine`, regex cases); E2E: emit a `[y/N]`, wait IDLE_MS, assert the sidebar dot accent | ❌ Wave 0 — `src/shared/__tests__/agent-state.test.ts` + smoke |
| SC5 (TERM-12) | Header Clear + Restart work; Clear chord (Cmd+K) clears; keyboard-accessible | Unit (matcher) + E2E | Vitest on the Clear-chord matcher (mirror `switch-keys.test.ts`); E2E: click Clear → buffer cleared but prompt preserved; press Cmd+K → same; click Restart → new pty | ❌ Wave 0 — extend `switch-keys.test.ts` + new `header-controls.smoke.test.ts` |
| Folder picker | Browse fills an absolute path; CR-01 still gates | E2E (or mock) | dialog is hard to drive in WDIO — assert the wiring via the security guard (key present) + a unit that the handler returns the dialog result; manual human-verify for the actual picker | ⚠ partial — guard test auto-covers the key; picker UX → human-verify |
| 05.1 fixes (WR-02/03/05) | Probe matcher no longer trips on echo; bounded buffer; trim consistency | Unit | extend `readiness-probe.test.ts` + a `pty-manager` probe test | ✅ `readiness-probe.test.ts` exists — extend |

### Sampling Rate
- **Per task commit:** `npm test` (Vitest quick suite) green.
- **Per wave merge:** Vitest full + the relevant smoke test(s) green.
- **Phase gate:** Full Vitest + full smoke suite green before `/gsd-verify-work`; PLUS a blocking **human-verify checkpoint** for SC4 (amber prompt feel) and the SC3 alt-screen reset (the Q1 reset-vs-scrollback decision), mirroring the 05.1 canonical `🛋️ Parlour Claude RC` human-verify precedent.

### Wave 0 Gaps
- [ ] `src/shared/__tests__/agent-state.test.ts` — covers SC4 classifier (pure)
- [ ] `src/main/__tests__/pty-spawn-error.test.ts` — covers SC2 cwd pre-validation + no-silent-home (D-02)
- [ ] `tests/smoke/alt-screen-reset.smoke.test.ts` — covers SC3
- [ ] `tests/smoke/header-controls.smoke.test.ts` — covers SC5 Clear/Restart + chord
- [ ] extend `tests/smoke/pty-throughput.smoke.test.ts` — SC1 at 100MB / `/dev/urandom`
- [ ] extend `src/main/__tests__/readiness-probe.test.ts` — WR-02/03 (echo-line false-positive, bounded buffer)
- [ ] extend `src/main/__tests__/switch-keys.test.ts` (or new `clear-key.test.ts`) — Clear-chord matcher
- [ ] Framework install: none needed (Vitest + WDIO already configured)

## Security Domain

> `security_enforcement` is implicitly enabled (the project has enforced a security posture — validate-in-main, V5/V7, the security guard test — every phase).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | contextBridge-only seam preserved; node-pty + all PTY I/O in main only; one new key (`pickDirectory`) added in lockstep with the guard test |
| V5 Input Validation | yes | Folder-picker result (an absolute path from the native dialog) still flows through CR-01 `isValidCwd` before any spawn (absolute + existing-directory). SC2 cwd pre-validation IS input validation. `persistOrder`/`updateProfile` validation unchanged. |
| V6 Cryptography | no | No new crypto. The probe nonce uses `crypto.randomBytes` for uniqueness only (existing). |
| V7 Error Handling / Logging | yes | SC2's `notice` now carries a user-supplied cwd path — sanitize control chars (WR-04) before `term.write`; NEVER log PTY data, the probe nonce, or buffered bytes (existing posture). The generic spawn-error message interpolates an OS error string — sanitize it too. |
| V12 File/Resource | yes | `dialog.showOpenDialog` is main-only; the renderer never touches `fs` (it receives a string path). |

### Known Threat Patterns for Electron + node-pty + xterm
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged IPC payload sets an arbitrary spawn cwd/shell | Tampering / EoP | Validate-in-main (CR-01 `isValidCwd`/`isValidShell`); the picker doesn't bypass it — the returned path still passes through validation. |
| Attacker-influenced `notice` writes raw escape sequences into the terminal | Tampering (terminal injection) | WR-04: strip control chars from `notice` before `term.write`; main sends only sanitized/derived strings. |
| New `pickDirectory` key widens the bridge surface | EoP | Lockstep update of `EXPECTED_API_KEYS` + the `security.guard.test.ts` assertion (it asserts exposed keys === EXPECTED_API_KEYS exactly, so an unreviewed extra key fails). |
| Agent-state regex on attacker-controlled output (renderer-side) | DoS (ReDoS) | Keep `PROMPT_RE` and `ANSI_RE` linear/anchored; run only on a bounded ~4 KB tail, not the whole buffer (WR-03 lesson). No catastrophic backtracking in the proposed patterns. |

## Sources

### Primary (HIGH confidence)
- Codebase read end-to-end this session: `src/main/pty-manager.ts`, `readiness-probe.ts`, `index.ts`, `window-config.ts`, `switch-keys.ts`; `src/renderer/SessionView.tsx`, `TerminalPane.tsx`, `SessionManager.tsx`, `IdentityHeader.tsx`, `IdleCard.tsx`, `Sidebar.tsx`, `SessionEditModal.tsx`, `session-add.ts`, `status-colors.ts`; `src/shared/types.ts`, `api-types.ts`, `flow-control.ts`; `src/preload/index.ts`; `src/shared/__tests__/security.guard.test.ts`; `tests/smoke/*`.
- `node_modules/@xterm/xterm/typings/xterm.d.ts` — `clear()` (line 1206), `reset()` = RIS `\x1bc` (line 1252) — [VERIFIED]
- Empirical node-pty 1.1.0 spawn test (this session): bad cwd / bad shell → `onExit code=1`, NO synchronous throw — [VERIFIED]
- `node_modules/{electron,node-pty,@xterm/xterm}/package.json` — versions 36.9.5 / 1.1.0 / 5.5.0 — [VERIFIED]
- `.planning/phases/06-robustness-flow-control-polish/06-CONTEXT.md` — locked decisions D-01..D-16 — [CITED]
- `.planning/DESIGN.md` §"Status system" + §"Reconciliation notes" — agent-state ramps incl. amber `oklch(0.66 0.15 60)` — [CITED]
- `.planning/phases/05.1-.../05.1-REVIEW.md` — WR-01..05, IN-01..03 — [CITED]
- `.planning/ROADMAP.md` §Phase 6, `.planning/REQUIREMENTS.md` (TERM-09/TERM-12), `.planning/STATE.md` accumulated context — [CITED]

### Secondary (MEDIUM confidence)
- node-pty `lib/unixTerminal.js` source read — confirms `pty.fork()` is native, errors surface via the child/`onExit`, not a JS throw (corroborates the empirical test).

### Tertiary (LOW confidence)
- The exact `PROMPT_RE` membership and `IDLE_MS` value (A1) — based on reasoning about agent CLI output, NOT verified against real captures. Must be E2E-tuned.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all versions verified against `node_modules`.
- Architecture: HIGH — every seam read in source; the recommended approaches reuse existing patterns.
- SC2 spawn semantics: HIGH — verified empirically.
- SC4 heuristic specifics (regex/threshold): MEDIUM-LOW — sound shape, but tuning is an E2E/human-verify task (A1).
- SC3 reset mechanism: MEDIUM — `reset()`/`\x1b[?1049l` are documented; the reset-vs-scrollback choice (Q1) needs a UX decision + empirical check (A2).
- Pitfalls / 05.1 fixes: HIGH — derived directly from the review report + source.

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable — pinned stack, brownfield; the only volatile items are the A1 regex tuning and the Q1 reset decision, both resolved during execution/E2E, not by external change).
