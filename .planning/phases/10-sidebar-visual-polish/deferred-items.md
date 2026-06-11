# Phase 10 — Deferred Items (out-of-scope discoveries)

These were found during Plan 10-02 execution but are NOT caused by this plan's changes.
Logged per the executor scope boundary; NOT fixed here.

## Pre-existing lint errors in `.planning/spikes/*.cjs`

`npm run lint` reports 8 errors in spike record/analysis scripts that pre-date this
branch (present at base commit `2d365a8`):

- `.planning/spikes/001-frame-stability-mechanism/record.cjs` — `no-require-imports` (×4), `no-unused-vars` (`lastNonEmpty`)
- `.planning/spikes/002-real-agent-frames/reanalyze.cjs` — `no-require-imports` (×2), `no-unused-vars` (`last`)

These are throwaway spike instrumentation scripts (CommonJS `.cjs`), unrelated to the
sidebar restyle. `npx eslint src/renderer/Sidebar.tsx` and `src/renderer/sidebar.css`
are clean. Not fixed (out of scope). Candidate for a lint-ignore on `.planning/spikes/`
or deletion of the spike scripts in a future cleanup task.
