# Deferred Items — Phase 02

Out-of-scope discoveries logged during execution. NOT fixed in the originating plan.

## From 02-04 execution

### pty-resize.smoke.test.ts — environment-sensitive ordering flakiness (out of scope)

- **Observed during:** 02-04 checkpoint pre-checks.
- **Symptom:** `pty-resize.smoke.test.ts` intermittently fails with
  `term.cols did not change within 1s of resize` when run immediately after other
  smoke specs in the same `wdio run` session (sequential, `maxInstances: 1`). It passes
  consistently (verified 3/3 + a clean full-suite 4/4) when the package is freshly built.
- **Cause:** The resize smoke drives `BrowserWindow.setSize(600, 800)` and asserts the
  column count changes within a tight 1-second SC3 budget. This is sensitive to leftover
  macOS window-manager state from preceding sequential Electron launches — not to any
  renderer logic. The resize wiring in `TerminalPane.tsx` (fit + debounced `ptyResize`)
  is from 02-03 and is **untouched by 02-04**. Confirmed by bisecting: the failure
  reproduces with Task-1-only and disappears on a clean rebuild, independent of the
  02-04 copy/paste change.
- **Disposition:** Out of scope for 02-04 (pre-existing test-harness sensitivity, not a
  product regression). Recommend hardening the resize smoke later: either bump the
  budget wait to retry the `setSize` once, or reset window geometry to a known-large
  size in a `beforeEach` so the shrink always crosses a column boundary.
