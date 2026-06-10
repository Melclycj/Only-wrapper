---
created: 2026-06-06T15:15:00.000Z
title: Address deferred code-review findings from phase 05.1
area: general
files:
  - .planning/phases/05.1-term-05-startup-command-auto-run/05.1-REVIEW.md
  - src/main/pty-manager.ts
  - src/main/readiness-probe.ts
  - src/renderer/SessionView.tsx
  - tests/smoke/startup-command.smoke.test.ts
---

## Problem

Phase 05.1 (TERM-05) code review found 10 issues. The 2 BLOCKERs (CR-01, CR-02)
were fixed during execution (commits 9ca8cbb, 83b67b4). The 5 WARNING + 3 INFO
findings were deferred (advisory) and remain in
`.planning/phases/05.1-term-05-startup-command-auto-run/05.1-REVIEW.md`:

- WR-01 / IN-01: the D-02 post-settle scrub branch (and `stripProbeEcho`) is dead on
  the match path — `offProbe.dispose()` runs the moment `settled` is true, so the
  promised adversarial-chunk scrubbing never executes in production (unit-tested only).
- WR-02: probe matcher regex can false-positive on the shell's same-chunk echo of the
  marker line (trailing `\n`), defeating the send-vs-match split — inject-before-ready risk.
- WR-03: unbounded probe buffer growth over the 4s window; `re.test()` re-run on the
  full growing string each chunk. Cap to a bounded tail.
- WR-04: `p.notice` written to the terminal verbatim with ANSI wrappers, no control-char
  sanitization (defense-in-depth; only the fixed literal is sent today).
- WR-05: startup command stored untrimmed but injected trimmed — latent store-vs-inject
  inconsistency; pick one canonical form.
- IN-02: `void shellPath` unused in both probes (seam note for the Windows probe phase).
- IN-03: smoke test ordering assertion via `lastIndexOf`/`indexOf` is brittle; anchor on
  the full "— restarted" separator string.

## Solution

TBD — work through the WARNING items first (WR-02 and WR-01 are the most behaviorally
meaningful: matcher robustness and the dead invisibility-scrub path). Tune WR-02
against real cold zsh/bash captures. INFO items are low-priority polish. Full detail
and recommended fixes are in 05.1-REVIEW.md.
