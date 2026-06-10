# Deferred Items — Phase 06

Out-of-scope discoveries logged during execution (not fixed in their discovering plan).

## [06-04] pty-resize.smoke flake under full-suite load
- **Discovered:** Plan 06-04 Task 3 full-smoke regression run.
- **Symptom:** `tests/smoke/pty-resize.smoke.test.ts` ("reports a new column count via tput cols within 1s of a window resize") intermittently fails under the FULL parallel smoke suite with "term.cols did not change within 1s of resize"; PASSES reliably in isolation.
- **Root cause (suspected):** the 1s budget for window resize → fit addon → pty.resize → SIGWINCH → `tput cols` round-trip is too tight under concurrent Electron-boot load. Pre-existing; unrelated to the 06-04 header/alt-screen/clear changes (no resize code touched).
- **Disposition:** OUT OF SCOPE for 06-04. Candidate fix: widen the resize-assertion timeout (1s → ~3s) or serialize the resize spec. Verify in a dedicated robustness pass.
