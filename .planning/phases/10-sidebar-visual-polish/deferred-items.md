# Phase 10 — Deferred Items (out-of-scope discoveries)

Out-of-scope discoveries logged during execution. NOT fixed in this phase.
Independently found by both Plan 10-02 and Plan 10-03 executors.

## Pre-existing lint errors in `.planning/spikes/*.cjs`

`npm run lint` (eslint .) reports 12 errors, all in spike research scripts that
are unrelated to any Phase-10 *source* change. The first two files pre-date this
phase (present at base commit `2d365a8`); the third was added by Plan 10-07 as
bounded autonomous diagnosis instrumentation (same throwaway-`.cjs` class, not a
shipped path):

- `.planning/spikes/001-frame-stability-mechanism/record.cjs` — 4× `@typescript-eslint/no-require-imports`, 1× `no-unused-vars` (`lastNonEmpty`)
- `.planning/spikes/002-real-agent-frames/reanalyze.cjs` — 2× `no-require-imports`, 1× `no-unused-vars` (`last`)
- `.planning/spikes/003-live-amber-repro/drive-claude-websearch.cjs` — 4× `no-require-imports` (added 10-07; the GAP-10-D real-frame capture driver)

These `.cjs` spike scripts use CommonJS `require()` which the flat ESLint config
forbids. They are throwaway spike instrumentation, untouched by Phase 10 (10-02
edits Sidebar.tsx / sidebar.css / ui-lab files; 10-03 edits ContextMenu.tsx /
SessionManager.tsx / terminal.css). Scoped lint on all changed files is clean.

Candidate fixes for a future cleanup task: add a lint-ignore for
`.planning/spikes/`, or delete the spike scripts.
