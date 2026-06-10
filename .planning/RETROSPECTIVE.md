# Project Retrospective: Just-Wrapper

Living retrospective, appended at each milestone close.

## Milestone: v1.0 — MVP

**Shipped:** 2026-06-10
**Phases:** 9 real (Phase 6 superseded by 6.1) | **Plans:** 37 | **Tasks:** 66
**Audit verdict:** `tech_debt` (27/27 requirements satisfied, 20/20 integration wired, no critical blockers)

### What Was Built

A cross-platform Electron terminal-session manager: real PTY-backed sessions (node-pty) behind a secure main/preload/renderer split, stable logical identity decoupled from process id, multi-session keep-alive, a two-bucket Working-Area/Inactive-List lifecycle with frame-stability agent-state detection, lowdb persistence with dormant restore, startup-command auto-run, in-terminal search + scrollback config, and a 2-OS packaging pipeline (macOS `.app` verified, Windows `.exe` CI-built).

### What Worked

- **Interface-first / Wave 0 RED scaffolds.** Freezing the IPC contract before implementation kept the contextBridge surface stable — `EXPECTED_API_KEYS` held at 20 across phases 5–8 ("zero new bridge keys" recurs in nearly every late summary). The security guard test caught drift automatically.
- **Human-verify checkpoints caught real defects** that automated suites missed: the Phase-6 output-silence idle model failed hands-on and was redesigned (6.1); the Phase-7 search highlights were invisible due to an `oklch()` color-format bug xterm can't parse; the Phase-3 "Stop" verb was reframed to a destructive Close at the verify checkpoint.
- **macOS-dev / CI-Windows split (D-01).** A single codebase shipped both platforms with platform differences confined to the edges (shell list, paths, packaging); Windows CI even caught the `resolveShell` `/bin/zsh` spawn bug before any human touched Windows.
- **Pure electron-free modules** (classifiers, key matchers, reducers, os-gate) made core logic unit-testable in Node without jsdom/Electron.

### What Was Inefficient

- **Phase 6 was a full abandoned phase.** The output-silence "waiting for input" heuristic failed human-verify and required a ground-up redesign (6.1) — the largest single piece of rework in the milestone. The lesson (frame-stability over output-silence) was only learnable by building the wrong thing first.
- **Verification bookkeeping drifted.** Phases 02 and 05 were human-verified in practice but their VERIFICATION.md frontmatter was never flipped from `human_needed`; phases 01–03 never had `nyquist_compliant` flipped from draft. This surfaced as noise at milestone close (the audit had to disentangle "stale frontmatter" from "real gap").
- **Search needed a second verify round** (5 display defects G1–G5) — the root cause was a color-format bug found only by reading the xterm bundle, not by guessing.

### Patterns Established

- **"Zero new bridge keys" discipline** — additive features ride existing IPC channels (search + scrollback + clear all rode `session:switch` / `persistUiState`); the bridge surface is a guarded contract.
- **Readiness-probe over settle-delay** — inject startup commands when the shell is genuinely ready (invisible nonce round-trip), never on a fixed timer.
- **Two-bucket lifecycle** — live "Working Area" vs dormant "Inactive List" recipes, no "Stop" verb; identity/recipe sessions persist, ephemeral ones vanish.

### Key Lessons

- Output-silence is the wrong signal for agent-state; **frame-stability** is right (`claude --rc`'s footer repaints forever, so it never "settles").
- **Color formats matter for xterm decorations** — `oklch()` is unparseable by `css.toColor`; use `rgba()`/hex.
- **Flip verification/Nyquist flags at sign-off**, not "later" — deferred bookkeeping becomes milestone-close noise.
- Develop-on-macOS / verify-Windows-in-CI is viable, but **real-hardware verification cannot be skipped** — it's the one honest tail of v1.0.

### Cost Observations

- Model mix / session count: not instrumented for this milestone (GSD-executed; no telemetry captured).
- Notable: the abandoned Phase 6 → 6.1 redesign was the dominant cost sink; earlier/cheaper human-verify on the idle-detection spike could have surfaced the flaw before a full phase was built.

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases (real) | 9 |
| Plans | 37 |
| Abandoned/redesigned phases | 1 (Phase 6 → 6.1) |
| Requirements satisfied | 27/27 |
| Audit verdict | tech_debt |
| Substantive deferred tail | Windows real-hardware UAT |

*(Trends accumulate as later milestones close.)*
