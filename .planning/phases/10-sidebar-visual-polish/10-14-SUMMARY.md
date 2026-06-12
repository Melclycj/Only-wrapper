---
phase: 10-sidebar-visual-polish
plan: 14
subsystem: renderer + main (agent-state sampling, PTY spawn locale, terminal font stack)
tags: [GAP-10-J, GAP-10-K, scroll-invariance, utf8-locale, cjk-font, gap-closure, tdd]
requires:
  - "src/renderer/agent-tick.ts decideAgentTick/classify seam (06.1-04, 10-07)"
  - "src/main/pty-manager.ts pty.spawn env (02-02..06-02)"
  - "src/renderer/tokens.css --font-mono single source (09-01/09-02)"
provides:
  - "scroll-position-independent agent-state (sidebar status no longer flips on scroll)"
  - "UTF-8 spawn locale so a Finder-launched app emits CJK"
  - "CJK monospace fallback in both --font-mono and the xterm fontFamily"
affects:
  - "the per-tick classify() sampling source (read-only region swap)"
  - "every spawned PTY child's env (locale additions, win32-noop)"
  - "the terminal text font stack (CSS + xterm)"
tech-stack:
  added: []
  patterns:
    - "pure DOM-free structurally-typed helper (sampleAgentFrame mirrors decideAgentTick)"
    - "pure env→additions resolver (resolvePtyLocale mirrors shell-resolver placement)"
    - "spread-after-process.env to honor inherited values without clobbering"
key-files:
  created:
    - src/renderer/agent-tick.ts (sampleAgentFrame export added to existing module)
    - src/renderer/__tests__/agent-frame-sample.test.ts
    - src/main/pty-locale.ts
    - src/main/__tests__/pty-locale.test.ts
  modified:
    - src/renderer/SessionView.tsx (viewportLines delegates to sampleAgentFrame; xterm fontFamily CJK fallback)
    - src/main/pty-manager.ts (spawn env spreads resolvePtyLocale)
    - src/renderer/tokens.css (--font-mono CJK fallback)
decisions:
  - "Sample the agent-state frame from buffer.baseY (live tail), not viewportY (visible top) — scroll-invariant by construction"
  - "Default en_US.UTF-8 ONLY when no UTF-8 locale is inherited; honor any existing UTF-8 LANG/LC_ALL; return {} on win32"
  - "CJK fallback uses OS-provided families ('PingFang SC' macOS, 'Microsoft YaHei' Windows) — no font file bundled; JetBrains Mono stays primary, monospace last"
metrics:
  duration: ~9min
  completed: 2026-06-12
  tasks: 3
  files: 7
---

# Phase 10 Plan 14: Round-5 Gap-Closure (GAP-10-J scroll-invariance + GAP-10-K locale/CJK font) Summary

**One-liner:** The sidebar agent-state is now scroll-position-independent (the classifier reads the live tail at `baseY`, not the scroll-moved `viewportY`), and the terminal renders Chinese — a UTF-8 spawn locale reaches Finder-launched children when none is inherited, and a CJK monospace fallback backs JetBrains Mono in both the CSS and the xterm font stacks. All three fixes are renderer + main only, with zero new bridge keys (EXPECTED_API_KEYS stays 20) and the xterm/PTY data path untouched.

## What Was Built

### Task 1 — GAP-10-J: scroll-invariant agent-state sampling (commit `e395509`)

- **NEW pure export `sampleAgentFrame(buffer: AgentFrameBuffer, rows): string[]`** in `src/renderer/agent-tick.ts`. It reads `rows` lines from `buffer.baseY + i` (the LIVE tail), where the old code read `b.viewportY + i` (the VISIBLE top). `viewportY` moves into scrollback when the user scrolls up, so the old sampling re-read OLD frames and the status flipped (free → in-progress → waiting) purely from scrolling. `baseY === viewportY` only at the bottom; reading `baseY` makes the sampled frame — and the sidebar status — scroll-position-independent. DOM-free / xterm-free via a minimal structural `AgentFrameBuffer` interface (`{ baseY, getLine }`), so it unit-tests with a fake buffer (mirrors `decideAgentTick`). Missing-line → `''` (preserves the original `ln ? … : ''` semantics).
- **`src/renderer/SessionView.tsx` `viewportLines()` now delegates**: `const viewportLines = (): string[] => sampleAgentFrame(term.buffer.active, term.rows);` — xterm's real `IBuffer` satisfies `AgentFrameBuffer` structurally (no cast). Both call sites (the `decideAgentTick` tick AND the dev-only `__AGENT_TRACE` block) now read the same `baseY` source through this one helper.
- **NEW regression `src/renderer/__tests__/agent-frame-sample.test.ts`** drives the pure helper with a fake buffer: an OLD permission menu (classify → 'waiting') in SCROLLBACK rows 0..3, a plain shell tail (classify → 'free') at `baseY=200`. Asserts: (a) the sampled frame is **deeply equal** for `viewportY === baseY` (bottom) vs `viewportY = 0` (scrolled up); (b) `classify(sampleAgentFrame(...))` is **'free' (not 'waiting')** for BOTH scroll positions; (c) a buffer whose **live tail at baseY actually holds a menu** still classifies **'waiting'**; (d) lines past the buffer end yield `''`.

`viewportY` now appears in `agent-tick.ts` / `SessionView.tsx` only inside explanatory comments — the sampling CODE reads `baseY` exclusively.

### Task 2 — GAP-10-K locale: UTF-8 spawn locale (commit `ad8971f`)

- **NEW pure `resolvePtyLocale(env, platform = process.platform)`** in `src/main/pty-locale.ts` (no node-pty / electron import). Truth table:

  | env (POSIX unless noted) | platform | result | rationale |
  |---|---|---|---|
  | `{}` (empty) | darwin | `{ LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' }` | Finder-launch: default a UTF-8 locale |
  | `{ LANG: 'zh_CN.UTF-8' }` | darwin | `{}` | honor existing UTF-8 LANG (never clobber) |
  | `{ LC_ALL: 'ja_JP.UTF-8' }` | darwin | `{}` | honor existing UTF-8 LC_ALL |
  | `{ LANG: 'en_GB.utf8' }` / `{ LC_ALL: 'de_DE.UTF8' }` | darwin | `{}` | case-variant utf8 spelling honored |
  | `{ LANG: 'C', LC_ALL: 'POSIX' }` | darwin | UTF-8 default | upgrade a bare C/POSIX locale |
  | `{}` | linux | UTF-8 default | POSIX path is not darwin-specific |
  | `{}` / `{ LANG: 'C' }` | win32 | `{}` | ConPTY/code-page model — inject no POSIX locale |

  UTF-8 detection is a case-insensitive `.utf-8` / `utf8` substring (`isUtf8Locale`). LC_ALL is checked before LANG (POSIX precedence).
- **`src/main/pty-manager.ts` spawn env** now spreads `...resolvePtyLocale(process.env)` **AFTER** `...process.env`, so an inherited UTF-8 LANG is preserved (resolver returns `{}` → overrides nothing) and an absent/C locale is upgraded. No other spawn-arg change; no bridge edit.
- **NEW `src/main/__tests__/pty-locale.test.ts`** pins all eight truth-table rows.

### Task 3 — GAP-10-K font: CJK monospace fallback (commit `0cd0662`)

- `src/renderer/tokens.css` `--font-mono`: `'JetBrains Mono', monospace` → `'JetBrains Mono', 'PingFang SC', 'Microsoft YaHei', monospace`.
- `src/renderer/SessionView.tsx` xterm `fontFamily`: same stack (xterm cannot read CSS custom properties, so it must carry the identical fallback).
- JetBrains Mono stays the PRIMARY (Latin) identity; `'PingFang SC'` (macOS) + `'Microsoft YaHei'` (Windows) are OS-provided (NOT bundled — no new font file) and only catch glyphs JetBrains Mono lacks; generic `monospace` stays last. `@xterm/addon-unicode11` already gives CJK the correct 2-cell width. No `@fontsource` import change in index.tsx.

## Verification Evidence (real stdout)

**Aggregate test run (Tasks 1+2+3, all gated files):**
```
$ npx vitest run src/renderer/__tests__/agent-frame-sample.test.ts \
    src/renderer/__tests__/agent-tick.test.ts \
    src/main/__tests__/pty-locale.test.ts \
    src/main/__tests__/pty-spawn-error.test.ts \
    src/renderer/__tests__/tokens-completeness.test.ts

 Test Files  5 passed (5)
      Tests  45 passed (45)
   Duration  221ms
```

**TDD RED proof — Task 1** (before `sampleAgentFrame` existed):
```
 FAIL  src/renderer/__tests__/agent-frame-sample.test.ts > ... yields empty strings ...
TypeError: sampleAgentFrame is not a function
 Test Files  1 failed (1)   Tests  4 failed (4)
```
**TDD RED proof — Task 2** (before `src/main/pty-locale.ts` existed): the import of `../pty-locale` failed to resolve → `Test Files 1 failed (1) / Tests no tests`.

**Task 3 font-stack node check:**
```
$ node -e "<font-stack assertion>"
OK: --font-mono + xterm fontFamily carry a CJK fallback; JetBrains Mono primary; monospace last
```

**pty-lifecycle (no spawn-path regression):**
```
 Test Files  1 passed (1)   Tests  16 passed (16)
```

**Type check (final):**
```
$ npx tsc --noEmit
TSC_EXIT=0
```

**No new font asset:** `git status --short | grep -iE '\.(ttf|otf|woff|woff2)$'` → `(no new font asset)`.

## Cross-Cutting Invariants Held

- **EXPECTED_API_KEYS stays 20** — `src/main/window-config.ts` has no diff (`git diff src/main/window-config.ts` empty); no preload/bridge file modified.
- **No `data-testid` / class rename**; the xterm/PTY DATA path (`term.write`, `onPtyData`, `ptyWrite`) is byte-for-byte unchanged — all three fixes touch the sampling SOURCE, the spawn-env, and the font-stack only.
- **`src/main/pty-locale.ts` is pure** (`git grep "node-pty|from 'electron'"` empty).
- **CLOSED GAP-10-A..I untouched** — no edit to the closed-gap files (sidebar.css control-reveal selectors, start-affordances, name-completeness, GAP-10-D gate). `agent-tick.test.ts` (the FIX-1 settle-independent path) stays GREEN.
- The full suite + packaged `ui:shots:fresh` run in the **10-15 gate plan**, not here (per plan scope). The `npm run make` lowdb crash is a separate tracked todo, explicitly out of scope and not touched.

## Deviations from Plan

None — plan executed exactly as written. TDD RED→GREEN followed for Tasks 1 & 2; Task 3 verified via the plan's node-based font check.

## Commits

- `e395509` fix(10-14): sample agent-state from live tail baseY not viewportY (GAP-10-J)
- `ad8971f` fix(10-14): default UTF-8 spawn locale when none inherited (GAP-10-K locale)
- `0cd0662` fix(10-14): append CJK monospace fallback to font stack (GAP-10-K font)

## Self-Check: PASSED

- Files created: `src/renderer/__tests__/agent-frame-sample.test.ts`, `src/main/pty-locale.ts`, `src/main/__tests__/pty-locale.test.ts` — all FOUND.
- Files modified: `src/renderer/agent-tick.ts`, `src/renderer/SessionView.tsx`, `src/main/pty-manager.ts`, `src/renderer/tokens.css` — all FOUND.
- Commits `e395509`, `ad8971f`, `0cd0662` — all FOUND in `git log`.
