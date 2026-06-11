# Phase 10 — Deferred Items

Out-of-scope discoveries logged during execution. Do NOT fix in this plan.

## Pre-existing lint errors in `.planning/spikes/*.cjs` (found during Plan 10-03)

`npm run lint` (eslint .) reports 8 errors, all in spike research scripts that
pre-date this phase and are unrelated to any Phase-10 source change:

- `.planning/spikes/001-frame-stability-mechanism/record.cjs` — 4× `@typescript-eslint/no-require-imports`, 1× `no-unused-vars` (`lastNonEmpty`)
- `.planning/spikes/002-real-agent-frames/reanalyze.cjs` — 2× `no-require-imports`, 1× `no-unused-vars` (`last`)

These `.cjs` spike scripts use CommonJS `require()` which the flat ESLint config
forbids. They exist on the base commit (2d365a8) and are not touched by Plan 10-03
(which edits only ContextMenu.tsx / SessionManager.tsx / terminal.css). Scoped lint
on the three changed files is clean. Out of scope per the executor scope boundary.
