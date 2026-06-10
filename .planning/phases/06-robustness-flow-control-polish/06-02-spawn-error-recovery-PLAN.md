---
phase: 06-robustness-flow-control-polish
plan: 02
type: execute
wave: 2
depends_on: [06-01]
files_modified:
  - src/main/pty-manager.ts
  - src/main/__tests__/pty-spawn-error.test.ts
  - src/renderer/IdleCard.tsx
  - src/renderer/SessionManager.tsx
  - src/renderer/SessionEditModal.tsx
autonomous: true
requirements: [TERM-12]
must_haves:
  truths:
    - "A session with an explicitly-configured-but-missing cwd → status 'error' with 'Working directory not found: <path>', never a silent spawn in ~ (SC2/D-01/D-02)"
    - "Any other spawn failure → status 'error' with 'Couldn't start session: <os reason>' (D-05 generic, sanitized of control chars per WR-04)"
    - "The error surfaces in BOTH the sidebar (red badge + message tooltip) AND an error card in the terminal pane with Edit + Retry (D-03/D-04)"
    - "'Start without command' spawns a bare shell in the saved cwd/shell, skipping the TERM-05 auto-run for that one launch (D-14)"
    - "The dead readiness-probe invisibility-scrub branch and stripProbeEcho helper are removed; probe output still never reaches the terminal (WR-01/IN-01)"
    - "The Browse… button fills the cwd field with an absolute path from the native folder picker; CR-01 still gates it (folded todo)"
    - "The edit modal prefills the session's saved cwd/shell/startupCommand from main's listSessions snapshot (folded todo)"
  artifacts:
    - path: "src/main/pty-manager.ts"
      provides: "create() cwd reshape (no silent home), D-01 pre-validate + try/catch spawn, abnormal-exit notice, skipStartupCommand flag, WR-05 trim"
    - path: "src/renderer/IdleCard.tsx"
      provides: "error branch with the specific message + Edit/Retry action row (D-03/D-04)"
    - path: "src/renderer/SessionManager.tsx"
      provides: "per-row errorMessage capture from notice, handleStartNoCmd, folder-picker wiring, edit-prefill hydration"
    - path: "src/renderer/SessionEditModal.tsx"
      provides: "Browse… button beside the cwd field"
  key_links:
    - from: "src/main/pty-manager.ts create()"
      to: "PtyStatusPayload.notice on the onPtyStatus channel"
      via: "setStatus(error) then send notice — zero new bridge keys"
      pattern: "Working directory not found"
    - from: "src/renderer/SessionManager.tsx onPtyStatus"
      to: "row.errorMessage → IdleCard + sidebar tooltip"
      via: "capture p.notice when status==='error'"
      pattern: "errorMessage"
    - from: "src/renderer/SessionEditModal.tsx Browse…"
      to: "window.api.pickDirectory()"
      via: "invoke → setCwd(path)"
      pattern: "pickDirectory"
---

<objective>
Vertical slice for SC2 (spawn/cwd error handling, D-01..D-05) plus the two main-side/renderer
folded todos that share these files (folder picker + edit-prefill) and the D-14 "Start without
command" escape hatch.

After this slice, a real user who configures a now-missing working directory and presses
Start sees an honest red error (in the sidebar AND an error card with Edit/Retry) instead
of a silent shell in their home directory — and can fix it via Browse… (native picker) or
Retry without recreating the session.

Purpose: Turn a silent failure mode (the SC2 anti-behavior) into a fixable, surfaced state
end-to-end, and close the edit-prefill + folder-picker UX gaps that block that fix loop.
Output: the reshaped main spawn path with honest error transport, the error-card recovery
UI, the folder picker, and the edit-prefill hydration — all GREEN.
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
@.planning/phases/06-robustness-flow-control-polish/06-01-SUMMARY.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Main spawn-error path — D-01 cwd pre-validate + try/catch, cwd reshape, abnormal-exit notice, skipStartupCommand, WR-05 trim, WR-01/IN-01 dead-scrub removal</name>
  <files>src/main/pty-manager.ts, src/main/__tests__/pty-spawn-error.test.ts</files>
  <read_first>
    - src/main/pty-manager.ts (create() lines 229-300; the cwd-resolution chain lines 254-259 — the load-bearing change; the pty.spawn() call line 261; isValidCwd lines 778-785 — reuse verbatim; setStatus lines 474-485 — the broadcast pattern; deriveStatus lines 162-173 — already maps exitCode≠0 && !userStopped → 'error'; the startupCommand injection block lines 322-345; updateProfile line 766-768 — WR-05 un-trimmed store; PtyCreateOptions interface lines 133-147)
    - src/main/__tests__/pty-spawn-error.test.ts (the RED scaffold from Plan 01 to fill GREEN)
    - src/main/__tests__/pty-validation.test.ts (existing main-side validation test style + how it stubs node-pty)
    - src/shared/api-types.ts (PtyStatusPayload.notice lines 66-80 — the transport field; PTY_CHANNELS.status)
    - .planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md (§Pattern 3 lines 245-257; §Code Examples "cwd resolution that errors" lines 343-379; §Common Pitfalls 1 lines 307-316 — spawn does NOT throw synchronously on macOS; Pitfall 2 lines 318-322; WR-05 line 480)
    - .planning/phases/06-robustness-flow-control-polish/06-PATTERNS.md (§pty-manager.ts lines 162-186)
    - src/main/pty-manager.ts (the dead invisibility-scrub branch lines 353-385 + the unreachable stripProbeEcho helper lines 124-130 — WR-01/IN-01; the match path at ~line 353 already disposes offProbe so the scrub branch is unreachable)
    - .planning/phases/05.1-term-05-startup-command-auto-run/05.1-REVIEW.md (WR-01 dead-scrub + IN-01 stripProbeEcho finding detail)
  </read_first>
  <behavior>
    - create() with opts.cwd = '/Users/me/deleted-dir' (a path that fails isValidCwd) → returns a result with no live pty (pid -1), sets status 'error', and sends a notice 'Working directory not found: /Users/me/deleted-dir' on the status channel; node-pty.spawn is NOT called
    - create() with a stored (prior) cwd that is now missing and opts.cwd undefined → same error path (the explicit prior cwd is honored as user intent, not silently replaced by home)
    - create() with NO cwd anywhere (opts.cwd undefined AND prior.cwd empty) → spawns in os.homedir() with NO error (home is the legitimate default only when truly unspecified — D-02)
    - create() where pty.spawn() throws synchronously (mock throw) → caught; status 'error'; notice 'Couldn't start session: <message>'; no unhandled throw escapes
    - create({ id, skipStartupCommand: true }) → wires normal forwarding and does NOT run the readiness probe / inject the startup command, even when a startupCommand is stored (D-14)
    - updateProfile stores startupCommand trimmed so the persisted value matches what is later injected (cmd + '\r') — WR-05
    - The readiness-probe success path discards the probe buffer (invisibility guaranteed by discard-on-match); no dead scrub branch and no stripProbeEcho helper remain — WR-01/IN-01
  </behavior>
  <action>
    D-01 (detection mechanism — pre-validate cwd): in `src/main/pty-manager.ts create()`, replace the cwd chain at lines 254-259 with the D-02-correct resolution: compute `requestedCwd = opts.cwd?.length ? opts.cwd : (prior?.cwd?.length ? prior.cwd : undefined)`. If `requestedCwd !== undefined && !this.isValidCwd(requestedCwd)` → do NOT spawn and do NOT fall back to home: call `this.setStatus(id, 'error', {})` then `this.send(PTY_CHANNELS.status, { id, status: 'error', notice: 'Working directory not found: ' + requestedCwd })` (the D-05 specific message) and `return { id, pid: -1 }`. Only when `requestedCwd === undefined` use `const cwd = os.homedir()`; otherwise `const cwd = requestedCwd`. Per D-01, reuse the existing CR-01 `isValidCwd` guard (lines 778-785) verbatim — do not write a new validator (Don't Hand-Roll).

    D-01 (second half — try/catch the spawn): wrap the `pty.spawn(...)` call (line 261) in try/catch (it is for the RARE synchronous EACCES — on macOS a bad cwd/shell does NOT throw synchronously, it forks-then-dies, per the empirical finding). On catch: `this.send(PTY_CHANNELS.status, { id, status: 'error', notice: 'Couldn\'t start session: ' + sanitize((err as Error).message) })` (the D-05 generic fallback) then `this.setStatus(id, 'error', {})` and `return { id, pid: -1 }`. Sanitize the OS message of control characters before it rides the notice (WR-04 — the notice now interpolates non-literal text). For the ASYNC abnormal-exit path (onExit code≠0 && !userStopped, already → 'error' via deriveStatus): if no notice has been sent for that error, send a generic `'Couldn\'t start session: the shell exited immediately'`-style notice (D-05 generic) so the SC2 error card has a message in the fork-then-die case too.

    Add `skipStartupCommand?: boolean` to the main-side `PtyCreateOptions` interface (lines 133-147). In the startupCommand injection block (lines 322-345): when `opts.skipStartupCommand === true`, wire normal forwarding and SKIP the readiness probe + injection entirely (D-14 — the "Start without command" launch is a bare shell even when a startupCommand is stored). Do NOT remove the stored startupCommand — it must still run on the next normal Start.

    WR-05: in `updateProfile` (lines 766-768) trim `startupCommand` at persist time so the stored value equals what is injected (`trimmed + '\r'`); document the chosen trim semantics in a comment.

    WR-01/IN-01 (dead invisibility-scrub removal): the readiness-probe success path at ~lines 353-385 already calls `offProbe.dispose()` AND discards the probe buffer on match, so the `settled` scrub branch (lines 356-366) and the `stripProbeEcho` helper (lines 124-130) are unreachable. Remove the dead scrub branch and delete the now-unused `stripProbeEcho` helper (and any test asserting it, IN-01) — discard-on-match already guarantees invisibility (D-02 nonce-absence stays proven by the existing cold-spawn E2E). Do NOT change the visible behavior: the probe output must still never reach the terminal.

    Fill `src/main/__tests__/pty-spawn-error.test.ts` (the Plan-01 RED scaffold) GREEN with every case in the behavior block. Mock node-pty consistent with `pty-validation.test.ts`.
  </action>
  <verify>
    <automated>npm test -- src/main/__tests__/pty-spawn-error.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `npm test -- src/main/__tests__/pty-spawn-error.test.ts` passes every behavior-block case
    - `grep -n "requestedCwd" src/main/pty-manager.ts` shows the new resolution distinguishing explicit-missing-cwd from no-cwd
    - `grep -n "Working directory not found" src/main/pty-manager.ts` returns a match (D-05 specific message)
    - `grep -n "Couldn't start session\|Couldn\\\\'t start session" src/main/pty-manager.ts` returns a match (D-05 generic message)
    - `grep -n "skipStartupCommand" src/main/pty-manager.ts` returns a match in both the interface and the injection guard
    - An explicitly-configured-but-missing cwd never reaches `pty.spawn` (assert in the unit test that the spawn mock was NOT called for that case)
    - `grep -n "stripProbeEcho" src/main/pty-manager.ts` returns NO match (dead helper removed — WR-01/IN-01); the readiness scrub branch (formerly lines 356-366) is gone
    - `npm test` (full Vitest suite) stays GREEN (no regression in pty-lifecycle/pty-status/pty-update-profile)
  </acceptance_criteria>
  <done>The main spawn path errors honestly on a missing explicit cwd (no silent home), surfaces messages via notice, supports skipStartupCommand, and trims stored startupCommand — all GREEN.</done>
</task>

<task type="auto">
  <name>Task 2: Renderer error surfacing + recovery — IdleCard error card, SessionManager errorMessage/handleStartNoCmd/prefill, edit-modal Browse…</name>
  <files>src/renderer/IdleCard.tsx, src/renderer/SessionManager.tsx, src/renderer/SessionEditModal.tsx</files>
  <read_first>
    - src/renderer/IdleCard.tsx (the existing error branch lines 88-93; the idle-start-button lines 96-103; the .idle-card-value JetBrains-Mono role lines 54-58; the onStart prop lines 20-25)
    - src/renderer/SessionManager.tsx (the onPtyStatus subscription effect lines 269-284 — currently drops notice; handleStart/handleRestart lines 130-162; the onAdd spawn block lines 233-247; handleSaveProfile lines 215-223; the ContextMenu items block lines 406-425; how id/active are passed to SessionView lines 381-385)
    - src/renderer/SessionEditModal.tsx (the cwd field block lines 176-189; the discoverShells() invoke line 85 — the invoke+setState pattern to mirror for pickDirectory; how it reads its fields from refs at save time)
    - src/renderer/Sidebar.tsx (the row title= tooltip + .status-badge so the errorMessage tooltip lands on the right element)
    - src/shared/api-types.ts (PtyStatusPayload.notice; pickDirectory key added in Plan 01)
    - .planning/phases/06-robustness-flow-control-polish/06-UI-SPEC.md (§Interaction 2 error card lines 157-168; §Interaction 4 Browse… lines 183-186; §Copywriting error/Browse rows lines 123-134)
    - .planning/phases/06-robustness-flow-control-polish/06-RESEARCH.md (§Pattern 3 line 257 — capture notice into per-row errorMessage; Open Q2 line 506; Open Q3 line 510 edit-prefill via listSessions)
    - .planning/phases/06-robustness-flow-control-polish/06-PATTERNS.md (§IdleCard.tsx lines 146-150; §SessionManager.tsx lines 101-115; §SessionEditModal.tsx lines 154-158)
  </read_first>
  <action>
    In `src/renderer/SessionManager.tsx`: (a) extend the per-session row state with a renderer-only `errorMessage?: string` (no type/bridge change — Research Open Q2). In the `onPtyStatus` effect (lines 269-284), when `p.status === 'error'` capture `p.notice` into the matching row's `errorMessage`; clear it when the row transitions away from `error`. Pass `errorMessage` down to the IdleCard (error branch) and ensure the sidebar row receives it for the `title=` tooltip (D-03 — both places). (b) Add `handleStartNoCmd(id)` beside `handleStart` (lines 150-162): call the same create/start path but pass the skip flag through `ptyCreate` so main spawns a bare shell skipping TERM-05 injection (D-14); thread the flag via the existing PtyCreateOptions bridge shape (it already carries `id`; the skip flag flows through to main's create which Task 1 made honor `skipStartupCommand`). (c) Add a "Start without command" secondary item to the ContextMenu items array (lines 411-423), shown only for a startable row that has a saved startupCommand, calling `handleStartNoCmd` (D-14). (d) Edit-prefill hydration (Research Open Q3): after the `onAdd` spawn resolves (lines 233-247) AND after `handleSaveProfile` (lines 215-223), re-read `window.api.listSessions()` and merge authoritative `cwd`/`shell`/`startupCommand` into the matching row (main is source of truth; `listSessions` already exists — no new bridge key). Do not disturb optimistic status updates. (e) Wire the IdleCard error card's Edit → open the existing SessionEditModal for that session (D-04), and Retry → the existing Start path (handleStart) for that session (D-04).

    In `src/renderer/IdleCard.tsx`: extend the `error` branch (lines 88-93) per UI-SPEC §Interaction 2 (D-03/D-04). Render the specific message (passed via prop / row.errorMessage) in the `.idle-card-value` JetBrains-Mono role; add the helper line "Check the working directory and shell, then fix them or try again." in `--ink-faint` 12px/400; add a two-button action row (gap 8px): **Edit** (neutral, `data-testid="error-card-edit"`) and **Retry** (primary blue, reusing the idle-start-button blue treatment, `data-testid="error-card-retry"`). Add `onEdit`/`onRetry` props beside the existing `onStart`. Both buttons Tab-focusable with the blue focus ring.

    In `src/renderer/SessionEditModal.tsx`: add a "Browse…" button inline-end of the cwd `<input>` (lines 180-188) per UI-SPEC §Interaction 4. On click: `void window.api.pickDirectory().then((p) => { if (p) setCwd(p); })` (mirror the discoverShells invoke line 85). `data-testid="browse-cwd"`, neutral secondary button matching `.edit-input` height. Cancel returns null → field unchanged. CR-01 still gates the value on save (main-side, unchanged).
  </action>
  <verify>
    <automated>npm test 2>&1 | tail -15 && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "errorMessage" src/renderer/SessionManager.tsx src/renderer/IdleCard.tsx` returns matches in both (notice captured + rendered)
    - `grep -n "data-testid=\"error-card-edit\"\|data-testid=\"error-card-retry\"" src/renderer/IdleCard.tsx` returns BOTH testids
    - `grep -n "handleStartNoCmd\|Start without command" src/renderer/SessionManager.tsx` returns matches (D-14 wired into the context menu)
    - `grep -n "pickDirectory" src/renderer/SessionEditModal.tsx` returns a match AND `grep -n "data-testid=\"browse-cwd\"" src/renderer/SessionEditModal.tsx` returns a match
    - `grep -n "listSessions" src/renderer/SessionManager.tsx` shows the post-add and post-save re-read (edit-prefill hydration)
    - `npm test` full Vitest suite GREEN; `npm run build` succeeds
    - The error message rendered in the card uses the JetBrains-Mono `.idle-card-value` role (the failing path reads as a literal — UI-SPEC)
  </acceptance_criteria>
  <done>The error card shows the specific message with Edit/Retry, the sidebar tooltip carries it, "Start without command" + Browse… are wired, and the edit modal prefills from main's truth — full suite GREEN.</done>
</task>

</tasks>

<artifacts_this_phase_produces>
Symbols/fields this plan introduces (downstream drift-verification excludes these as newly-created):
- `src/main/pty-manager.ts`: new field `skipStartupCommand?: boolean` on the main `PtyCreateOptions` interface; new local `requestedCwd`; new error-notice strings `'Working directory not found: <path>'` and `'Couldn't start session: <reason>'`
- `src/renderer/SessionManager.tsx`: new renderer-only per-row field `errorMessage?: string`; new handler `handleStartNoCmd(id)`; new context-menu item "Start without command"
- `src/renderer/IdleCard.tsx`: new props `onEdit`/`onRetry`; new testids `error-card-edit`, `error-card-retry`
- `src/renderer/SessionEditModal.tsx`: new "Browse…" button, testid `browse-cwd`
</artifacts_this_phase_produces>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer → main spawn (cwd/shell) | The configured working directory and shell cross into the sole spawn owner; an invalid/forged cwd must be validated in main, not silently substituted. |
| main → renderer error message | The spawn-error notice now interpolates a user-supplied path and an OS error string into terminal-rendered text. |
| native folder dialog → renderer | The picker returns a filesystem path string that becomes a spawn cwd. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-05 | Tampering / EoP | Forged IPC sets an arbitrary or missing spawn cwd | mitigate | Validate-in-main with the existing `isValidCwd` (absolute + statSync().isDirectory()); an explicit invalid cwd errors (status 'error'), it is NEVER silently replaced by home (D-01/D-02). |
| T-06-06 | Tampering (terminal/ANSI injection) | The error `notice` carries a user-supplied cwd path and an OS error string into `term.write`/React text | mitigate | Sanitize control characters from the path + OS message before they ride the notice (WR-04); the renderer additionally strips control chars before write (Plan 04 sanitize seam). The specific cwd message echoes only the user's own configured path. |
| T-06-07 | Information Disclosure | The error message reveals a filesystem path | accept | The path shown is the one the user themselves configured for that session (no new disclosure beyond their own input); local-only app, no remote exfil surface. |
| T-06-08 | EoP | The folder-picker'd path bypasses validation | mitigate | The returned absolute path still flows through CR-01 `isValidCwd` on save and through the create() pre-validate before any spawn — the picker does not bypass validation (V5). |
| T-06-SC | Tampering | npm/pip/cargo installs | accept | No new dependencies this phase (06-RESEARCH §Package Legitimacy Audit: N/A); no install task. |
</threat_model>

<verification>
- `npm test -- src/main/__tests__/pty-spawn-error.test.ts` GREEN (SC2 main path)
- `npm test` full Vitest suite GREEN (no lifecycle/status/update-profile regression)
- `npm run build` succeeds
- Manual/E2E (deferred to Plan 04 phase gate): configure a missing cwd, Start → error card with Edit/Retry + red sidebar badge; Browse… fills an absolute path; Start without command runs a bare shell
</verification>

<success_criteria>
- A missing explicit cwd → status 'error' + 'Working directory not found: <path>', never a silent home spawn (SC2/D-01/D-02)
- Other spawn failures → 'Couldn't start session: <os reason>' (D-05), sanitized (WR-04)
- The error surfaces in the sidebar (red badge + tooltip) AND an error card with Edit + Retry (D-03/D-04)
- "Start without command" spawns a bare shell skipping TERM-05 for that launch (D-14)
- Browse… fills the cwd field via the native picker, still CR-01-gated (folded todo)
- The edit modal prefills saved cwd/shell/startupCommand from main's listSessions (folded todo)
</success_criteria>

<output>
Create `.planning/phases/06-robustness-flow-control-polish/06-02-SUMMARY.md` when done
</output>
