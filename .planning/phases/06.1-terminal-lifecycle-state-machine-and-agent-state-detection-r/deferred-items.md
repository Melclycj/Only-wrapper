# Deferred Items — Phase 06.1

## Out-of-scope lint errors (pre-existing, NOT introduced by 06.1-04 gap-closure)

`npm run lint` (`eslint .`) reports 8 errors, ALL in spike `.cjs` scratch files that
predate this work (last touched in the spike-001 / spike-002 validation commits; see
`git log -- .planning/spikes/...`). They are unrelated to the 06.1-04 fixes and out of
scope per the executor deviation-rule scope boundary (do not fix pre-existing failures
in unrelated files):

- `.planning/spikes/001-frame-stability-mechanism/record.cjs`
  - `@typescript-eslint/no-require-imports` (lines 20–23) — Node CJS `require()` in a
    standalone spike recorder script.
  - `@typescript-eslint/no-unused-vars` — `lastNonEmpty` (line 61).
- `.planning/spikes/002-real-agent-frames/reanalyze.cjs`
  - `@typescript-eslint/no-require-imports` (lines 8–9).
  - `@typescript-eslint/no-unused-vars` — `last` (line 22).

Verified: `npx eslint src/ tests/` (the production + test surface) is CLEAN (exit 0).
Verified: these same 8 errors are present at the prior phase commit `e8b7bd1` before any
06.1-04 change. Recommended resolution (future, optional): add `.planning/spikes/**` to
the ESLint ignore set, or convert the spike scripts to ESM — neither is a 06.1-04 concern.
