---
phase: 06-robustness-flow-control-polish
plan: 04
type: execute
wave: 4
depends_on: [06-01, 06-02, 06-03]
files_modified:
  - src/renderer/IdentityHeader.tsx
  - src/renderer/SessionManager.tsx
  - src/renderer/SessionView.tsx
  - tests/smoke/header-controls.smoke.test.ts
  - tests/smoke/alt-screen-reset.smoke.test.ts
  - .planning/phases/06-robustness-flow-control-polish/06-VALIDATION.md
autonomous: false
requirements: [TERM-12, TERM-09]
must_haves:
  truths:
    - "The session header shows Clear (always), Restart (when running), and Start ▶ (when not running) — single-click and keyboard-accessible (SC5/D-11)"
    - "Clear = client-side term.clear() on the active session's kept-alive xterm — drops scrollback, preserves the current prompt, no shell injection (D-12)"
    - "The Clear chord Cmd+K (mac) / Ctrl+Shift+K (win) clears the active session and never reaches xterm/PTY (D-13)"
    - "Restarting a session exits the alt-screen with \\x1b[?1049l (preserving scrollback) before the — restarted HH:MM — separator (SC3/D-15)"
    - "An abnormally-exited vim/less session resets the frame (term.reset()) so reopening shows a clean prompt, not a frozen alt-screen frame (SC3/D-15)"
    - "100MB high-throughput output does not freeze/crash/drop; the watermark visibly pauses+resumes (SC1/D-16)"
  artifacts:
    - path: "src/renderer/IdentityHeader.tsx"
      provides: "the D-11 control cluster (Clear/Restart/Start) wired to SessionManager handlers"
    - path: "src/renderer/SessionManager.tsx"
      provides: "handleClear + the Clear-chord dispatch ({kind:'clear'} on the switch channel)"
    - path: "src/renderer/SessionView.tsx"
      provides: "alt-screen reset on restart (\\x1b[?1049l) + on abnormal exit (term.reset()) + WR-04 notice sanitize"
    - path: "tests/smoke/header-controls.smoke.test.ts"
      provides: "GREEN E2E for Clear/Restart + chord"
    - path: "tests/smoke/alt-screen-reset.smoke.test.ts"
      provides: "GREEN E2E for SC3"
  key_links:
    - from: "src/renderer/IdentityHeader.tsx Clear button"
      to: "SessionManager.handleClear → window.__sessionTerms[id].clear()"
      via: "onClick handler"
      pattern: "handleClear"
    - from: "src/renderer/SessionManager.tsx onSwitchSession"
      to: "handleClear when intent.kind==='clear'"
      via: "branch clear-vs-switch on the existing switch channel"
      pattern: "kind === 'clear'"
    - from: "src/renderer/SessionView.tsx onPtyStatus restart branch"
      to: "term.write('\\x1b[?1049l') before the separator"
      via: "alt-screen exit on the second running transition"
      pattern: "1049l"
---

<objective>
Final vertical slice: the session-header quick controls (SC5/TERM-12), the alt-screen reset
behavior (SC3), the SC1 backpressure validation, and the phase-gate E2E + human-verify +
Nyquist sign-off.

After this slice, a user back in a session gets one-click (or Cmd+K) Clear, contextual
Restart/Start in the header (fixing the folded Start-discoverability todo), a killed vim no
longer leaves a frozen frame on reopen, and the 100MB throughput case is proven lossless and
responsive. This completes Phase 6.

Purpose: Turn the identity-only header into a control surface, harden the terminal frame
against alt-screen lock-up, and prove the already-built watermark under load.
Output: the header cluster + Clear chord + alt-screen reset, the two GREEN smoke tests, the
extended SC1 throughput proof, and the human-verify sign-off flipping nyquist_compliant true.
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
@.planning/phases/06-robustness-flow-control-polish/06-UI-SPEC.md
@.planning/phases/06-robustness-flow-control-polish/06-VALIDATION.md
@.planning/phases/06-robustness-flow-control-polish/06-01-SUMMARY.md
@.planning/phases/06-robustness-flow-control-polish/06-02-SUMMARY.md
@.planning/phases/06-robustness-flow-control-polish/06-03-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Header control cluster + handleClear + Clear-chord dispatch</name>
  <files>src/renderer/IdentityHeader.tsx, src/renderer/SessionManager.tsx</files>
  <read_first>
    - src/renderer/IdentityHeader.tsx (the identity-only header lines 19-38; badge now uses presentation() from Plan 03; the leading comment lines 1-8 noting controls are Phase 6/TERM-12)
    - src/renderer/Sidebar.tsx (the .row-controls cluster lines 228-289 — the EXACT contextual Start(▶)/Restart(↻) button markup, data-testid/data-action/aria-label/title conventions, e.stopPropagation() before handler — copy this shape)
    - src/renderer/SessionManager.tsx (handleStart/handleRestart lines 130-162; handleStartNoCmd added in Plan 02; the onSwitchSession subscription effect lines 296-301 — extend to branch on {kind:'clear'}; window.__sessionTerms registration referenced from SessionView lines 173-178)
    - src/renderer/SessionView.tsx (window.__sessionTerms[id] handle the Clear reaches; the active-session model)
    - src/main/switch-keys.ts (the {kind:'clear'} SwitchIntent variant from Plan 01 — the chord arrives via onSwitchSession)
    - .planning/phases/06-robustness-flow-control-polish/06-UI-SPEC.md (§Interaction 3 lines 170-181 — control layout, testids, contextual visibility, keyboard; §Copywriting header rows lines 130-132; §Color lines 106-108 — Clear/Restart neutral, Start blue)
    - .planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md (§Pattern 4 lines 259-270; §Anti-Patterns line 273 — do NOT inject clear/Ctrl+L)
    - .planning/phases/06-robustness-flow-control-polish/06-PATTERNS.md (§IdentityHeader.tsx lines 119-134; §SessionManager.tsx handleClear lines 107 + Clear-chord wiring line 111)
  </read_first>
  <action>
    In `src/renderer/SessionManager.tsx`: (a) add `handleClear(id)` beside handleRestart (lines 130-141): reach the active session's kept-alive xterm via `window.__sessionTerms[id]` (the handle SessionView registers at lines 173-178) and call `.clear()` (D-12 — drops scrollback, preserves the current prompt; NO shell injection, NO Ctrl+L). (b) Extend the EXISTING `onSwitchSession` effect (lines 296-301): the chord now also delivers `{ kind: 'clear' }` on the same channel (Plan 01); branch on `intent.kind === 'clear'` → call `handleClear(activeId)` reading the live active id via the existing sessionsRef/activeId pattern; otherwise keep the existing switch resolution. This keeps EXPECTED_API_KEYS at 19 (Research Pattern 4(b) — no new key). (c) Pass `onClear`, `onRestart`, `onStart` (and the contextual status) down to IdentityHeader.

    In `src/renderer/IdentityHeader.tsx`: add a right-aligned `.header-controls` cluster (`display: inline-flex; gap: 4px; margin-left: auto`) AFTER the badge, copying the Sidebar `.row-controls` button markup verbatim (glyphs, data-testid/aria-label/title, e.stopPropagation()). Controls (contextual per D-11): **Clear** ALWAYS — a text-labelled "Clear" button (`8px 16px` pad, radius 10px, 13px/700, neutral `--ink-soft` → warm on hover), `data-testid="clear-terminal"`, `aria-label="Clear terminal"`, onClick → onClear(activeId); **Restart** when `status === 'running'` — ↻ glyph 24×24 `.row-control` neutral button, `data-testid="header-restart"`, `aria-label="Restart session"`, onClick → onRestart(activeId); **Start ▶** when NOT running (not_started/stopped/exited/error) — ▶ glyph with the blue `.row-control-start` accent, `data-testid="header-start"`, `aria-label="Start session"`, onClick → onStart(activeId). NO Stop button (D-11 — Close stays in the context menu, unchanged). All controls are native Tab-focusable `<button>`s with the consistent 2px blue `:focus-visible` outline (satisfies SC5 "keyboard-accessible").
  </action>
  <verify>
    <automated>npm test 2>&1 | tail -10 && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "handleClear" src/renderer/SessionManager.tsx` shows the handler reaching window.__sessionTerms[id].clear()
    - `grep -n "kind === 'clear'\|kind==='clear'" src/renderer/SessionManager.tsx` shows the chord branch on the existing switch channel
    - `grep -n "data-testid=\"clear-terminal\"\|data-testid=\"header-restart\"\|data-testid=\"header-start\"" src/renderer/IdentityHeader.tsx` returns ALL THREE testids
    - The Clear path uses term.clear() and never injects into the PTY: `grep -n "ptyWrite\|\\\\x0c\|Ctrl+L" src/renderer/SessionManager.tsx` shows NO clear-related PTY write (D-12 anti-pattern avoided)
    - Restart renders only when running; Start renders only when not running (contextual — verify the conditional render in the component)
    - `npm test` full Vitest suite GREEN; `npm run build` succeeds
  </acceptance_criteria>
  <done>The header control cluster (Clear/Restart/Start) is wired to handlers, Clear is a pure xterm op, and the Clear chord clears the active session via the existing switch channel — full suite GREEN.</done>
</task>

<task type="auto">
  <name>Task 2: Alt-screen reset on restart + abnormal exit + WR-04 notice sanitize</name>
  <files>src/renderer/SessionView.tsx</files>
  <read_first>
    - src/renderer/SessionView.tsx (the onPtyStatus 'running' branch lines 229-235 with hasRunBeforeRef — the restart seam; the onPtyExit handler lines 207-209 currently writing [process exited] — the abnormal-exit seam; the notice short-circuit lines 225-228 `if (p.notice) {…; return;}` — MUST preserve this ordering; lines 225-226 write p.notice raw inside ANSI wrappers — WR-04 sanitize point)
    - node_modules/@xterm/xterm/typings/xterm.d.ts (clear() vs reset()=RIS \x1bc — reset exits alt-screen + wipes scrollback; \x1b[?1049l exits alt-screen preserving primary scrollback)
    - .planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md (§Pattern 2 lines 235-243; §Code Examples "alt-screen reset at the restart seam" lines 442-454; §Common Pitfalls 3 lines 324-327 + Pitfall 4 lines 329-331 — the SC3↔D-03 scrollback tension; §Open Questions Q1 lines 501-504; WR-04 line 479; A2 line 495)
    - .planning/phases/06-robustness-flow-control-polish/06-UI-SPEC.md (§Interaction 5 lines 188-194 — restart uses \x1b[?1049l preserving scrollback, abnormal exit uses term.reset(); reset-then-separator ordering)
    - .planning/phases/06-robustness-flow-control-polish/06-PATTERNS.md (§SessionView.tsx SC3 reset lines 63-77; notice-short-circuit ordering line 75; WR-04 line 77)
  </read_first>
  <action>
    In `src/renderer/SessionView.tsx`, extend the EXISTING `onPtyStatus` 'running' branch (lines 229-235): on the restart transition (`hasRunBeforeRef.current === true`), write `\x1b[?1049l` (exit the alternate-screen buffer, PRESERVING primary-screen scrollback — honors Phase-3 D-03 scrollback preservation, per Open Q1 recommendation) BEFORE writing the existing `— restarted HH:MM —` separator. Reset-then-separator ordering matters (the separator must paint on the clean primary screen). Do NOT use full `term.reset()` here — that would wipe scrollback (the SC3↔D-03 tension; Pitfall 4).

    Extend the `onPtyExit` handler (lines 207-209): for an abnormal exit (the frame is genuinely dead — a killed vim/less), call `term.reset()` (full RIS) BEFORE writing the exit notice, so a frozen alt-screen frame never survives (SC3/D-15). A clean `exit 0` + a clean frame is the correct end state, so resetting here is safe.

    WR-04 (folded fix): the notice short-circuit at lines 225-228 (`if (p.notice) {…; return;}`) MUST keep running BEFORE the running branch (so an SC2 error notice is never treated as a restart — Research Anti-Pattern). Strip control characters from `p.notice` before `term.write` (the SC2 path now sends a cwd-path-bearing notice — defense-in-depth, even though main also sanitizes).
  </action>
  <verify>
    <automated>npm test 2>&1 | tail -10 && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "1049l" src/renderer/SessionView.tsx` shows the alt-screen exit on the restart seam
    - The `\x1b[?1049l` write occurs BEFORE the `— restarted` separator write (verify ordering in the running branch)
    - `grep -n "term.reset()\|\\.reset()" src/renderer/SessionView.tsx` shows reset() in the onPtyExit abnormal-exit handler (NOT in the restart branch)
    - The notice short-circuit still runs before the running branch (the `if (p.notice) … return` ordering preserved — grep shows it above the status==='running' check)
    - A control-char sanitize is applied to p.notice before term.write (WR-04)
    - `npm test` full Vitest suite GREEN; `npm run build` succeeds
  </acceptance_criteria>
  <done>Restart exits the alt-screen preserving scrollback, abnormal exit resets the dead frame, and the SC2 notice is sanitized and never mistaken for a restart — full suite GREEN.</done>
</task>

<task type="auto">
  <name>Task 3: Fill SC5 + SC3 smoke tests GREEN; validate SC1 at 100MB</name>
  <files>tests/smoke/header-controls.smoke.test.ts, tests/smoke/alt-screen-reset.smoke.test.ts</files>
  <read_first>
    - tests/smoke/header-controls.smoke.test.ts (the RED scaffold from Plan 01 to fill GREEN)
    - tests/smoke/alt-screen-reset.smoke.test.ts (the RED scaffold from Plan 01 to fill GREEN)
    - tests/smoke/keyboard-switch.smoke.test.ts (the WDIO driver for the before-input-event chord path: webContents.sendInputEvent — browser.keys does NOT reach before-input-event, per Phase 4 finding; mirror this for the Cmd+K Clear chord)
    - tests/smoke/startup-command.smoke.test.ts (ensureSession / readBuffer / window.__sessionTerms patterns; the cold-spawn driver)
    - tests/smoke/pty-throughput.smoke.test.ts (the SC1 throughput smoke extended in Plan 01 — confirm it now drives 100M and asserts responsiveness)
    - tests/smoke/helpers (the shared smoke driver helpers)
    - src/renderer/IdentityHeader.tsx + src/renderer/SessionManager.tsx + src/renderer/SessionView.tsx (the testids/behaviors to assert: clear-terminal, header-restart, header-start, the 1049l/reset behavior)
    - .planning/phases/06-robustness-flow-control-polish/06-VALIDATION.md (Per-Task Verification Map SC1/SC3/SC5 rows; Wave 0 Requirements)
    - .planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md (§Validation Architecture lines 539-549)
  </read_first>
  <action>
    Fill `tests/smoke/header-controls.smoke.test.ts` GREEN (SC5): boot the app, ensure a running session, write some output to build scrollback, click the `clear-terminal` button → assert the buffer is cleared but the current prompt line is preserved (term.clear() semantics — not a blank/dead terminal); drive the Cmd+K chord via `webContents.sendInputEvent` (the before-input-event path, mirroring keyboard-switch.smoke) → assert the same clear result; click `header-restart` on a running session → assert a new pty pid (restart) with the same logical id; confirm `header-start` appears for a not-running session and starts it.

    Fill `tests/smoke/alt-screen-reset.smoke.test.ts` GREEN (SC3): open a session, launch `vim` (or `less` on a file) so the terminal enters the alternate screen, kill the PTY abnormally (or trigger restart), then reopen/restart and assert the rendered buffer shows a clean prompt with NO residual alt-screen frame remnants (assert the vim status-line/tilde-column artifacts are gone). Exercise BOTH seams: the restart path (assert scrollback is preserved across `\x1b[?1049l`) and the abnormal-exit path (assert the dead frame is gone after term.reset()).

    Confirm SC1: run the extended `tests/smoke/pty-throughput.smoke.test.ts` (100M / `/dev/urandom`, or the documented scaled fallback) and assert no freeze (post-burst input still echoes), no crash, lossless render, and observable watermark pause+resume. If the assertion was left partial in Plan 01, complete it here.
  </action>
  <verify>
    <automated>npx wdio run wdio.conf.* --spec tests/smoke/header-controls.smoke.test.ts --spec tests/smoke/alt-screen-reset.smoke.test.ts --spec tests/smoke/pty-throughput.smoke.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `tests/smoke/header-controls.smoke.test.ts` is GREEN: Clear button + Cmd+K chord both clear (prompt preserved); Restart yields a new pid same logical id; Start appears + starts a not-running session
    - `tests/smoke/alt-screen-reset.smoke.test.ts` is GREEN: a killed vim/less shows a clean prompt on reopen (no alt-screen frame remnants); restart preserves scrollback; abnormal exit clears the dead frame
    - `tests/smoke/pty-throughput.smoke.test.ts` is GREEN at 100M (or documented scaled): no freeze/crash/drop, watermark pause+resume observed (SC1/D-16)
    - Neither smoke is left as `.todo`/`.skip` (the Wave 0 scaffolds are now real assertions)
    - The full smoke suite passes (no regression in boot/multi-session/persistence/reorder/session-edit/keyboard-switch smokes)
  </acceptance_criteria>
  <done>SC5, SC3, and SC1 are proven by GREEN smoke tests; no Wave 0 scaffold remains a stub.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Human-verify — agent-state feel + alt-screen reset/scrollback decision (A1/A2/Q1) + Nyquist sign-off</name>
  <what-built>
    The full Phase 6 surface: amber "Waiting for you" agent-state overlay (SC4), the header
    Clear/Restart/Start cluster + Cmd+K chord (SC5), the spawn/cwd error card with Edit/Retry
    (SC2), the alt-screen reset on restart/abnormal-exit (SC3), and the validated 100MB
    backpressure (SC1). Two heuristic/UX choices need a human eye: the PROMPT_RE + IDLE_MS
    tuning (A1) and the restart \x1b[?1049l vs abnormal-exit term.reset() scrollback behavior (Q1/A2).
  </what-built>
  <how-to-verify>
    Run the app (`npm start`). Then:
    1. **SC4 amber feel (A1):** Create `🛋️ Parlour Claude RC` (Icon 🛋️, a real project dir, Command `claude --rc`). Start it, trigger an action that ends in a `[y/N]` / `?` confirmation, then switch to ANOTHER session. Confirm: the Parlour row dot goes amber "Waiting for you" within ~1s of the prompt, WITHOUT false-positives mid-stream (it should read blue "In progress" while output flows, slate "Free" when quiet without a prompt). Confirm it clears state-driven when you answer / new output arrives — NOT merely by viewing it. If amber fires on normal output or misses real prompts, report the PROMPT_RE/IDLE_MS adjustment needed.
    2. **SC3 reset + scrollback (Q1/A2):** Open a session, run `vim`, kill the PTY (or use header Restart). On RESTART confirm: a clean prompt AND the prior scrollback is still scrollable above the `— restarted —` separator (\x1b[?1049l preserved it). On an ABNORMAL exit (kill the process) confirm: the killed-vim frame is gone (clean frame). If the restart path still shows a frozen vim frame, the surgical exit-alt-screen is insufficient and a full reset() is needed there — report which.
    3. **SC5 controls:** In the header, click Clear (scrollback drops, prompt preserved), press Cmd+K (same), click Restart on a running session (new process), and confirm Start ▶ appears + works on a not-running session. Confirm all four are reachable by Tab + Enter/Space.
    4. **SC2 error card:** Edit a session's cwd to a non-existent path, Start it. Confirm: red "Error" badge + tooltip in the sidebar AND an error card "Working directory not found: <path>" with Edit + Retry; confirm it did NOT silently open in your home directory; use Browse… to pick a real dir, then Retry → it starts.
    After confirming (and applying any A1/Q1 tuning the executor makes in response), set `06-VALIDATION.md` frontmatter `nyquist_compliant: true` and `wave_0_complete: true`.
  </how-to-verify>
  <resume-signal>Type "approved" to sign off Phase 6, or describe the issues (amber false-positives, reset-vs-scrollback behavior, control problems) to fix before sign-off.</resume-signal>
</task>

</tasks>

<artifacts_this_phase_produces>
Symbols this plan introduces (downstream drift-verification excludes these as newly-created):
- `src/renderer/SessionManager.tsx`: new handler `handleClear(id)`; new `{kind:'clear'}` branch in the onSwitchSession dispatch
- `src/renderer/IdentityHeader.tsx`: new `.header-controls` cluster; new props `onClear`/`onRestart`/`onStart`; new testids `clear-terminal`, `header-restart`, `header-start`
- `src/renderer/SessionView.tsx`: new alt-screen exit `\x1b[?1049l` on restart; new `term.reset()` on abnormal exit; notice control-char sanitize
- Smoke tests filled GREEN: `tests/smoke/header-controls.smoke.test.ts`, `tests/smoke/alt-screen-reset.smoke.test.ts`
(Note: `pickDirectory`, `matchClearKey`, `{kind:'clear'}` intent, agent-state symbols are produced by Plans 01/03, not here.)
</artifacts_this_phase_produces>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| main → renderer (Clear chord) | The Cmd+K chord is intercepted in main and dispatched as an app intent; it never reaches xterm/PTY (works inside vim/tmux). |
| main → renderer (notice) | The SC2 error notice carrying a user path/OS string is written into the terminal. |
| PTY → terminal frame | A killed alt-screen app can leave a stale frame that must be reset on the renderer side. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-12 | Tampering (terminal/ANSI injection) | The notice (cwd path / OS reason) is written into the terminal via term.write | mitigate | Strip control characters from `p.notice` before write (WR-04, renderer-side defense-in-depth on top of main's sanitize). |
| T-06-13 | Spoofing / EoP | The Clear chord could be abused to widen the bridge with a new key | mitigate | The chord reuses the EXISTING `session:switch` channel with a `{kind:'clear'}` variant (Plan 01) — EXPECTED_API_KEYS stays 19; no new key, guard test unchanged. |
| T-06-14 | Tampering | Clear injecting `clear`/Ctrl+L into the PTY would pollute shell history / behave per-shell | mitigate | Clear is a client-side `term.clear()` only (D-12); no PTY write — enforced by acceptance criteria grep. |
| T-06-15 | Denial of Service | A killed alt-screen app leaves the terminal frame locked (usability DoS) | mitigate | Alt-screen reset on restart (`\x1b[?1049l`) and abnormal exit (`term.reset()`) guarantees a clean reopen (SC3). |
| T-06-SC | Tampering | npm/pip/cargo installs | accept | No new dependencies this phase (06-RESEARCH §Package Legitimacy Audit: N/A); no install task. |
</threat_model>

<verification>
- `npm test` full Vitest suite GREEN (header wiring + reset logic, no regression)
- `tests/smoke/header-controls.smoke.test.ts` GREEN (SC5)
- `tests/smoke/alt-screen-reset.smoke.test.ts` GREEN (SC3)
- `tests/smoke/pty-throughput.smoke.test.ts` GREEN at 100M (SC1)
- Full smoke suite GREEN (no regression)
- Human-verify checkpoint approved; `06-VALIDATION.md` nyquist_compliant: true + wave_0_complete: true
</verification>

<success_criteria>
- Header Clear (always) / Restart (running) / Start ▶ (not running) work via click AND keyboard; Cmd+K / Ctrl+Shift+K clears (SC5/TERM-12)
- Clear is term.clear() (scrollback dropped, prompt preserved); no PTY injection (D-12)
- Restart exits alt-screen preserving scrollback; abnormal exit resets the dead frame → clean prompt on reopen (SC3/D-15)
- 100MB throughput is responsive + lossless with visible watermark pause+resume (SC1/D-16)
- TERM-09 + TERM-12 fully delivered; human-verify signs off; Nyquist flips compliant
</success_criteria>

<output>
Create `.planning/phases/06-robustness-flow-control-polish/06-04-SUMMARY.md` when done
</output>
