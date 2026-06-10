---
phase: 06-robustness-flow-control-polish
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/shared/agent-state.ts
  - src/shared/__tests__/agent-state.test.ts
  - src/main/switch-keys.ts
  - src/main/__tests__/switch-keys.test.ts
  - src/main/readiness-probe.ts
  - src/main/__tests__/readiness-probe.test.ts
  - src/main/index.ts
  - src/shared/api-types.ts
  - src/preload/index.ts
  - src/main/window-config.ts
  - src/shared/__tests__/security.guard.test.ts
  - src/main/__tests__/pty-spawn-error.test.ts
  - tests/smoke/alt-screen-reset.smoke.test.ts
  - tests/smoke/header-controls.smoke.test.ts
  - tests/smoke/pty-throughput.smoke.test.ts
  - tests/smoke/startup-command.smoke.test.ts
  - src/renderer/TerminalPane.tsx
  - tests/smoke/pty-roundtrip.smoke.test.ts
autonomous: true
requirements: [TERM-09, TERM-12]
must_haves:
  truths:
    - "classifyIdle() returns 'waiting' only when the last non-empty line matches the conservative prompt set (D-08/D-09)"
    - "matchClearKey returns {kind:'clear'} for Cmd+K (mac) / Ctrl+Shift+K (win) and null otherwise (D-13)"
    - "The contextBridge exposes exactly 19 keys including the new pickDirectory; security.guard.test.ts is GREEN"
    - "The readiness probe matcher no longer trips on the shell's echo line and its scan buffer is bounded (WR-02/WR-03)"
    - "The startup-command smoke anchors its restart assertion on the full '— restarted' separator string, not a brittle indexOf (IN-03)"
    - "TerminalPane.tsx is deleted and the build + roundtrip smoke still pass (dead-code removal, D-16)"
  artifacts:
    - path: "src/shared/agent-state.ts"
      provides: "Pure AgentState classifier — IDLE_MS, PROMPT_RE, lastNonEmptyLine(), classifyIdle()"
      exports: ["AgentState", "IDLE_MS", "PROMPT_RE", "lastNonEmptyLine", "classifyIdle"]
    - path: "src/shared/__tests__/agent-state.test.ts"
      provides: "RED→GREEN unit coverage of the classifier"
    - path: "src/main/__tests__/pty-spawn-error.test.ts"
      provides: "Wave 0 RED scaffold for SC2 cwd pre-validation (filled GREEN in Plan 02)"
    - path: "tests/smoke/alt-screen-reset.smoke.test.ts"
      provides: "Wave 0 RED smoke scaffold for SC3 (filled GREEN in Plan 04)"
    - path: "tests/smoke/header-controls.smoke.test.ts"
      provides: "Wave 0 RED smoke scaffold for SC5 (filled GREEN in Plan 04)"
  key_links:
    - from: "src/preload/index.ts"
      to: "src/main/window-config.ts EXPECTED_API_KEYS"
      via: "lockstep 19-key allowlist"
      pattern: "pickDirectory"
    - from: "src/main/index.ts before-input-event"
      to: "session:switch channel"
      via: "matchClearKey → {kind:'clear'} sent on the existing switch channel"
      pattern: "matchClearKey"
---

<objective>
Lay the Phase 6 foundation: all Wave 0 RED test scaffolds, the one pure new module
(`shared/agent-state.ts` classifier), the atomic bridge lockstep that adds the single
new `pickDirectory` key and the `{kind:'clear'}` Clear-chord intent, the main-process
plumbing those depend on (folder-picker handler + Clear-chord interception), the folded
05.1 readiness-probe fixes that live in main + tests (WR-02/WR-03 matcher+buffer, IN-02
comment, IN-03 smoke-anchor), and the dead-code deletion of `TerminalPane.tsx` (D-16).

This is the interface-first wave: it defines the contracts (classifier API, bridge keys,
Clear-chord intent shape, RED test files) that Plans 02/03/04 build against, with zero
user-visible renderer behavior change.

Purpose: Freeze every contract and seam the three vertical slices consume, so the slice
plans wire against fixed signatures instead of exploring the codebase.
Output: agent-state.ts + its GREEN unit test; matchClearKey + its GREEN unit test;
extended probe matcher + GREEN probe tests; 19-key bridge lockstep + GREEN guard test;
pickDirectory main handler + Clear-chord interception; 3 RED scaffold test files; SC1
throughput smoke extended to 100MB; IN-03 smoke anchor; TerminalPane deleted.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06-robustness-flow-control-polish/06-CONTEXT.md
@.planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md
@.planning/phases/06-robustness-flow-control-polish/06-PATTERNS.md
@.planning/phases/06-robustness-flow-control-polish/06-VALIDATION.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure agent-state classifier + Wave 0 RED scaffolds + SC1 throughput extension</name>
  <files>src/shared/agent-state.ts, src/shared/__tests__/agent-state.test.ts, src/main/__tests__/pty-spawn-error.test.ts, tests/smoke/alt-screen-reset.smoke.test.ts, tests/smoke/header-controls.smoke.test.ts, tests/smoke/pty-throughput.smoke.test.ts</files>
  <read_first>
    - src/shared/flow-control.ts (the pure-module purity header + named-constant + factory convention to mirror — lines 1-74)
    - src/shared/__tests__/flow-control.test.ts (the sibling-test convention)
    - src/main/__tests__/readiness-probe.test.ts (Vitest Node-env test style for main-side pure logic)
    - tests/smoke/pty-throughput.smoke.test.ts (the existing SC1 throughput smoke to extend)
    - tests/smoke/startup-command.smoke.test.ts (the canonical smoke driver patterns: ensureSession / readBuffer / window.__sessionTerms)
    - .planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md (§Code Examples "pure agent-state classifier" lines 383-403; §Pattern 1; A1 regex/IDLE_MS rationale)
    - .planning/phases/06-robustness-flow-control-polish/06-VALIDATION.md (Wave 0 Requirements + Per-Task Verification Map)
  </read_first>
  <behavior>
    - lastNonEmptyLine("...\x1b[32mok\x1b[0m\n\n") returns "ok" (ANSI stripped, trailing blank lines skipped)
    - classifyIdle("Continue? [y/N] ") returns 'waiting'
    - classifyIdle("Are you sure? ") returns 'waiting' (trailing '?')
    - classifyIdle("Proceed (yes/no): ") — verify against the chosen PROMPT_RE; document whether ':' suffix is in-set
    - classifyIdle("Selection ❯ ") returns 'waiting'
    - classifyIdle("user@host project %") returns 'free' (a naked shell prompt is NOT waiting — '$'/'%' must NOT be in the set)
    - classifyIdle("Why did this fail? Let me check the logs.") returns 'free' (mid-sentence '?' not at line end → no match because PROMPT_RE is anchored with \s*$)
    - classifyIdle("") returns 'free'
    - IDLE_MS is exported and equals 800
  </behavior>
  <action>
    Create `src/shared/agent-state.ts` as a pure, electron/xterm/node-pty/React-free module mirroring `flow-control.ts`'s header + named-constant + documented-contract convention. Export: the union `type AgentState = 'in-progress' | 'waiting' | 'free'`; `const IDLE_MS = 800` (D-08, Claude's discretion); `const PROMPT_RE` — a conservative, anchored regex matching ONLY at end-of-line (`\s*$`) for the curated set from D-09: trailing `?`, `[y/N]`/`[y/n]`/`[Y/n]` (case-insensitive), `(y/n)`/`(yes/no)`, and the arrow-menu marker `❯`; `function lastNonEmptyLine(tail: string): string` that strips ANSI (CSI/SGR/OSC) via a linear non-backtracking regex, splits on `\r?\n`, and returns the last line with non-whitespace content (trimEnd); `function classifyIdle(tail: string): AgentState` returning `'waiting'` when `PROMPT_RE.test(lastNonEmptyLine(tail))` else `'free'`. Do NOT add `'waiting'` to the `SessionStatus` union in `shared/types.ts` — agent-state is a presentation overlay (D-06), never a 6th process status, never persisted. Keep ANSI_RE and PROMPT_RE linear/anchored to avoid ReDoS on attacker-controlled output (Security V7).

    Create `src/shared/__tests__/agent-state.test.ts` covering every case in the behavior block plus the explicit false-positive guards ('$'/'%' prompts → free; mid-sentence '?' → free). This test is RED until agent-state.ts exists, then GREEN.

    Create the three remaining Wave 0 RED scaffold files as `describe.todo`/`it.todo` or skipped-with-comment stubs that import the (not-yet-extended) target so the file resolves: `src/main/__tests__/pty-spawn-error.test.ts` (SC2 cwd pre-validation + no-silent-home D-02 — filled GREEN in Plan 02), `tests/smoke/alt-screen-reset.smoke.test.ts` (SC3 — filled GREEN in Plan 04), `tests/smoke/header-controls.smoke.test.ts` (SC5 Clear/Restart + chord — filled GREEN in Plan 04). Each scaffold MUST name its target behavior and the plan that fills it in a header comment so the executor of that plan knows the contract.

    Extend `tests/smoke/pty-throughput.smoke.test.ts` for SC1: drive `cat /dev/urandom | head -c 100M` (macOS) — or the scaled `yes | head -n N` fallback already used by the Phase-2 smoke if 100M is too slow in CI — and assert no freeze (keyboard input still echoes after the burst), no crash (app still responsive), and lossless render. Reuse the existing throughput-smoke harness helpers; do not rebuild the watermark.
  </action>
  <verify>
    <automated>npm test -- src/shared/__tests__/agent-state.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `npm test -- src/shared/__tests__/agent-state.test.ts` passes all cases in the behavior block
    - `grep -n "'waiting'" src/shared/types.ts` returns NO match inside the `SessionStatus` union (agent-state is NOT a process status — D-06)
    - `grep -nE "import .*(electron|react|xterm|node-pty)" src/shared/agent-state.ts` returns nothing (purity preserved)
    - `src/shared/agent-state.ts` exports `IDLE_MS`, `PROMPT_RE`, `lastNonEmptyLine`, `classifyIdle`, and the `AgentState` type
    - The three RED scaffold files exist, import their targets, and resolve under Vitest/WDIO without import errors (todo/skipped tests do not fail the suite)
    - `tests/smoke/pty-throughput.smoke.test.ts` references a 100M (or documented scaled) high-throughput command and asserts post-burst input responsiveness
  </acceptance_criteria>
  <done>The pure classifier is GREEN; the three RED scaffolds resolve cleanly; the SC1 smoke is extended to 100M throughput.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Clear-chord matcher + main pickDirectory handler + Clear-chord interception + probe fixes (WR-02/WR-03/IN-02/IN-03)</name>
  <files>src/main/switch-keys.ts, src/main/__tests__/switch-keys.test.ts, src/main/index.ts, src/main/readiness-probe.ts, src/main/__tests__/readiness-probe.test.ts, tests/smoke/startup-command.smoke.test.ts</files>
  <read_first>
    - src/main/switch-keys.ts (SwitchIntent union lines 14-17; matchSwitchKey lines 52-67; KeyInput shape; the meta||control primary-key rule from Phase 4 — mirror it for matchClearKey)
    - src/main/__tests__/switch-keys.test.ts (the matcher test convention to extend)
    - src/main/index.ts (the before-input-event block lines 91-97 that runs matchSwitchKey and sends 'session:switch'; the ipcMain.handle('api:get-version') pattern line 118; the electron import line 1)
    - src/main/readiness-probe.ts (buildPosixProbe matcher line 71 — current `re` trips on the echo line, WR-02; the buffer scan, WR-03; the `void shellPath` seam lines 88/102, IN-02)
    - src/main/__tests__/readiness-probe.test.ts (existing probe tests to extend with WR-02/WR-03 cases)
    - tests/smoke/startup-command.smoke.test.ts (the restart assertion at line ~115 currently using indexOf('restarted') — IN-03 anchor it on the full separator string)
    - .planning/phases/05.1-term-05-startup-command-auto-run/05.1-REVIEW.md (WR-02/WR-03/IN-02/IN-03 finding detail)
    - .planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md (§State of the Art "8 folded 05.1 review findings" lines 473-483; §Code Examples folder-picker lines 458-468; §Architecture Pattern 4 bridge note lines 268-270)
    - .planning/phases/06-robustness-flow-control-polish/06-PATTERNS.md (§readiness-probe.ts; §main/index.ts; the Clear-chord recommendation (b))
  </read_first>
  <behavior>
    - matchClearKey returns {kind:'clear'} for key 'k'/code 'KeyK' with meta=true on macOS-style input (Cmd+K)
    - matchClearKey returns {kind:'clear'} for key 'k'/code 'KeyK' with control=true AND shift=true (Ctrl+Shift+K)
    - matchClearKey returns null for plain Ctrl+K (control=true, shift=false) — deliberately avoided on Windows (readline kill-line, D-13)
    - matchClearKey returns null for non-keyDown events and for keys other than K
    - The readiness-probe matcher returns false when fed ONLY the shell's echo of the typed marker line (WR-02) and true only when the nonce appears on a produced output line after a newline boundary
    - The readiness-probe scan buffer is bounded to the last N KB (8 KB) before matching (WR-03)
    - The startup-command restart assertion matches the full '— restarted ' separator literal, not a substring indexOf (IN-03)
  </behavior>
  <action>
    In `src/main/switch-keys.ts`: extend the `SwitchIntent` union with a `{ kind: 'clear' }` variant (Research Pattern 4 recommendation (b) — the Clear chord rides the EXISTING 'session:switch' channel so NO new bridge key is added; EXPECTED_API_KEYS stays driven by `pickDirectory` only). Add an exported `matchClearKey(i: KeyInput): SwitchIntent | null` mirroring `matchSwitchKey`'s structure and its `key`-OR-`code` defensive matching: return `{ kind: 'clear' }` for Cmd+K on macOS (`(meta) && (key==='k' || code==='KeyK')`) and for Ctrl+Shift+K on Windows (`(control && shift) && (key==='k' || code==='KeyK')`); return null for plain Ctrl+K (D-13 — Ctrl+K reserved for readline kill-line), for non-keyDown, and for any other key. Extend `src/main/__tests__/switch-keys.test.ts` with the matchClearKey cases from the behavior block.

    In `src/main/index.ts`: (a) add `dialog` to the electron import; register `ipcMain.handle('dialog:pick-directory', async () => { const r = await dialog.showOpenDialog({ properties: ['openDirectory'] }); return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0]; })` alongside the existing `api:get-version` handler. (b) Extend the existing `before-input-event` block: after the `matchSwitchKey` branch, also run `matchClearKey(input)`; on a `{kind:'clear'}` match call `event.preventDefault()` and send the intent on the SAME `'session:switch'` channel (so the chord never reaches xterm/PTY — Phase-4 "app-wins" D-13), exactly mirroring how the switch intent is currently sent.

    In `src/main/readiness-probe.ts`: fix WR-02 — change `buildPosixProbe`'s `re` (line 71) so the nonce must appear on a PRODUCED output line, not the echo line: require a newline boundary before the nonce (e.g. match `\n` + nonce) per Research §State-of-the-Art line 477; the matcher must return false for an echo-only chunk and true only after a real produced line. Fix WR-03 — bound the scanned buffer to the last 8 KB before calling `matches()` (keep only the bounded tail). IN-02 — leave the `void shellPath` seam as-is but add a one-line comment that per-shell behavior arrives in Phase 8. Extend `src/main/__tests__/readiness-probe.test.ts` with the WR-02 echo-line-false-positive case and the WR-03 bounded-buffer case from the behavior block.

    IN-03: in `tests/smoke/startup-command.smoke.test.ts`, replace the brittle `indexOf('restarted')` restart assertion (~line 115) with an anchor on the full `— restarted ` separator literal so the test is robust to incidental occurrences of the word.
  </action>
  <verify>
    <automated>npm test -- src/main/__tests__/switch-keys.test.ts src/main/__tests__/readiness-probe.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `npm test -- src/main/__tests__/switch-keys.test.ts` passes including the new matchClearKey cases (Cmd+K → clear, Ctrl+Shift+K → clear, plain Ctrl+K → null)
    - `npm test -- src/main/__tests__/readiness-probe.test.ts` passes including the WR-02 echo-line false-positive case and the WR-03 bounded-buffer case
    - `grep -n "kind: 'clear'\|kind:'clear'" src/main/switch-keys.ts` returns a match (the intent variant exists)
    - `grep -n "dialog:pick-directory" src/main/index.ts` returns a match (handler registered)
    - `grep -n "matchClearKey" src/main/index.ts` returns a match (chord wired into before-input-event)
    - The Clear chord is sent on the existing `'session:switch'` channel (no new channel string introduced for clear) — verify by grep that `session:clear` does NOT appear as a sent channel in index.ts
    - `grep -n "— restarted" tests/smoke/startup-command.smoke.test.ts` shows the IN-03 full-separator anchor (no bare indexOf('restarted'))
  </acceptance_criteria>
  <done>matchClearKey is GREEN and wired app-side; the folder-picker IPC handler is registered; the WR-02/WR-03 probe fixes are GREEN; the IN-02 comment + IN-03 smoke anchor are in.</done>
</task>

<task type="auto">
  <name>Task 3: Atomic bridge lockstep (pickDirectory, 19 keys) + delete dead TerminalPane.tsx</name>
  <files>src/shared/api-types.ts, src/preload/index.ts, src/main/window-config.ts, src/shared/__tests__/security.guard.test.ts, src/renderer/TerminalPane.tsx, tests/smoke/pty-roundtrip.smoke.test.ts</files>
  <read_first>
    - src/shared/api-types.ts (the discoverShells type addition line 158; PtyStatusPayload lines 66-80; the SwitchIntent import line 17 — onSwitchSession will now also carry {kind:'clear'})
    - src/preload/index.ts (the discoverShells invoke lines 155-159; the onSwitchSession subscribe lines 142-151; the no-raw-ipcRenderer header lines 16-34)
    - src/main/window-config.ts (EXPECTED_API_KEYS array lines 76-95 — currently 18 keys; the per-phase doc-comment convention lines 51-74)
    - src/shared/__tests__/security.guard.test.ts (asserts exposed keys === EXPECTED_API_KEYS exactly)
    - src/renderer/TerminalPane.tsx (the dead Phase-2 single-pane view to delete)
    - src/renderer/index.tsx (confirm it renders SessionManager only, never TerminalPane)
    - tests/smoke/pty-roundtrip.smoke.test.ts (confirm it drives via ensureSession/window.__term generically and does NOT import TerminalPane — Research A3)
    - .planning/phases/06-robustness-flow-control-polish/06-PATTERNS.md (§Bridge lockstep lines 214-222 — the four-file template)
    - .planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md (§State of the Art dead-code table lines 485-488; Runtime State Inventory line 303 — grep before delete)
  </read_first>
  <action>
    Update all four bridge files in ONE atomic change (the established lockstep): (1) `src/shared/api-types.ts` — add `pickDirectory: () => Promise<string | null>;` to `ElectronAPI` with a per-phase doc comment matching the `discoverShells` style; the existing `SwitchIntent` import already covers the new `{kind:'clear'}` variant added in Task 2, so `onSwitchSession`'s type now carries it with no signature change. (2) `src/preload/index.ts` — add `pickDirectory: () => ipcRenderer.invoke('dialog:pick-directory')` mirroring the `discoverShells` invoke; the renderer must NEVER touch raw ipcRenderer (preserve the header contract). (3) `src/main/window-config.ts` — append `'pickDirectory'` to `EXPECTED_API_KEYS` (→ 19 keys) and add the per-phase doc-comment block documenting it as the one new key this phase (mirror the discoverShells/onSwitchSession doc style). (4) `src/shared/__tests__/security.guard.test.ts` — it asserts `exposed keys === EXPECTED_API_KEYS`, so it goes GREEN automatically; add/confirm the count expectation is 19 if the test hardcodes a count.

    Then delete the dead `src/renderer/TerminalPane.tsx` (D-16). FIRST grep the repo to confirm no live `import` of TerminalPane exists (only self-reference + comment/text references are acceptable per Research A3); if any live import is found, STOP and report rather than breaking the build. Confirm `tests/smoke/pty-roundtrip.smoke.test.ts` drives the app generically (ensureSession / window.__term) and does not `import` TerminalPane — if it does import it, migrate the smoke to SessionView's `window.__sessionTerms`/`window.__term` driver instead of deleting blindly.
  </action>
  <verify>
    <automated>npm test -- src/shared/__tests__/security.guard.test.ts && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `npm test -- src/shared/__tests__/security.guard.test.ts` is GREEN (exposed keys === EXPECTED_API_KEYS)
    - `grep -c "'" src/main/window-config.ts` — the EXPECTED_API_KEYS array contains exactly 19 entries including `'pickDirectory'` (verify: `grep -n "pickDirectory" src/main/window-config.ts` matches; the array length is 19)
    - `grep -n "pickDirectory" src/shared/api-types.ts src/preload/index.ts` returns a match in BOTH files (lockstep complete)
    - `test ! -f src/renderer/TerminalPane.tsx` (file deleted)
    - `grep -rn "import.*TerminalPane" src/ tests/` returns NO live import (build is not broken by the deletion)
    - `npm run build` completes without error (the deletion did not break the bundle)
  </acceptance_criteria>
  <done>The bridge surface is exactly 19 keys with pickDirectory; the guard test is GREEN; TerminalPane.tsx is deleted with no broken imports and a clean build.</done>
</task>

</tasks>

<artifacts_this_phase_produces>
Symbols/files this plan introduces (downstream drift-verification excludes these as newly-created):
- `src/shared/agent-state.ts` — new file; exports: type `AgentState`, const `IDLE_MS` (800), const `PROMPT_RE`, fn `lastNonEmptyLine(tail)`, fn `classifyIdle(tail)`
- `src/main/switch-keys.ts` — new export `matchClearKey(i: KeyInput)`; extended `SwitchIntent` union member `{ kind: 'clear' }`
- IPC channel string `'dialog:pick-directory'` (main handler) — consumed by the new bridge key
- Bridge key `pickDirectory: () => Promise<string | null>` (in `ElectronAPI`, `preload/index.ts`, and `EXPECTED_API_KEYS` → 19 keys)
- New test files: `src/shared/__tests__/agent-state.test.ts`, `src/main/__tests__/pty-spawn-error.test.ts` (RED scaffold), `tests/smoke/alt-screen-reset.smoke.test.ts` (RED scaffold), `tests/smoke/header-controls.smoke.test.ts` (RED scaffold)
- Deleted: `src/renderer/TerminalPane.tsx`
</artifacts_this_phase_produces>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer → main (contextBridge) | The renderer requests a native folder dialog via the new `pickDirectory` key; main owns the dialog and returns only a string path. |
| main → renderer (before-input-event) | The Clear chord is intercepted in main and dispatched as an app-level intent; raw key events never widen the bridge. |
| PTY output → readiness-probe matcher | Untrusted shell output is scanned for the readiness nonce; a too-loose matcher injects the startup command prematurely (the 05.1 failure mode). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-01 | Elevation of Privilege | New `pickDirectory` bridge key widens the renderer→main surface | mitigate | Lockstep update of `EXPECTED_API_KEYS` + `security.guard.test.ts` (asserts exposed keys === allowlist exactly); the handler returns ONLY a string path, never an fs handle (V12). |
| T-06-02 | Tampering | Forged IPC could request the folder dialog repeatedly | accept | `dialog.showOpenDialog` is a user-gated native modal (no silent filesystem access); spamming it only opens dialogs the user dismisses — low value, no data exposure. |
| T-06-03 | Denial of Service (ReDoS) | `PROMPT_RE` / `ANSI_RE` run on attacker-controlled PTY output | mitigate | Keep both regexes linear and anchored (`\s*$`), no nested quantifiers / catastrophic backtracking; the Plan-03 detector runs them only on a bounded ~4 KB tail. |
| T-06-04 | Tampering | Readiness-probe matcher false-positive on the echo line injects the startup command before the shell is ready (WR-02) | mitigate | Require the nonce on a PRODUCED line after a newline boundary; bound the scan buffer to 8 KB (WR-03). Covered by the extended probe unit tests. |
| T-06-SC | Tampering | npm/pip/cargo installs | mitigate | None — this phase adds NO new dependencies (06-RESEARCH §Package Legitimacy Audit: N/A); no install task, so no slopcheck/legitimacy gate required. |
</threat_model>

<verification>
- `npm test -- src/shared/__tests__/agent-state.test.ts` GREEN (classifier)
- `npm test -- src/main/__tests__/switch-keys.test.ts` GREEN (matchClearKey)
- `npm test -- src/main/__tests__/readiness-probe.test.ts` GREEN (WR-02/WR-03)
- `npm test -- src/shared/__tests__/security.guard.test.ts` GREEN (19-key bridge)
- `npm run build` succeeds with TerminalPane.tsx deleted
- The three RED scaffold files resolve under the test runner without import errors
</verification>

<success_criteria>
- The pure agent-state classifier exists, is purity-clean, and passes all behavior cases
- matchClearKey + the folder-picker handler + the Clear-chord interception are wired in main
- The probe matcher no longer trips on the echo line and its buffer is bounded; IN-02 comment + IN-03 smoke anchor in
- The bridge is exactly 19 keys (one new: pickDirectory); the guard test is GREEN
- TerminalPane.tsx is deleted; the build and roundtrip smoke still pass
- Wave 0 RED scaffolds for SC2/SC3/SC5 exist for Plans 02/04 to fill GREEN
</success_criteria>

<output>
Create `.planning/phases/06-robustness-flow-control-polish/06-01-SUMMARY.md` when done
</output>
