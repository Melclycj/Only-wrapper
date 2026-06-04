// Wave 0 RED E2E smoke stub — covers SC5 / TERM-05 (startup-command injection,
// D-05 visibility: the command is typed as VISIBLE keystrokes, echoed + run).
//
// SEAM: window.api.ptyCreate({ shell, cwd: undefined, startupCommand: 'echo STARTUP_OK' })
// called directly from the WDIO browser context — no form UI (Phase 4).
//
// This deliberately drives the ONE concrete pre-existing seam — the signed bridge
// contract that plan 03-01 Task 2 defines (`PtyCreateOptions.startupCommand?` +
// `cwd: undefined` meaning "MAIN resolves os.homedir()"). There is NO create/edit
// form in Phase 3 (the form is Phase 4 scope and MUST NOT be introduced here), so
// the test calls ptyCreate DIRECTLY via browser.execute and then reads the
// resulting session's xterm buffer by the returned `id` (N-pane driver).
//
// INTENTIONALLY FAILS RED until plan 03-01 Task 2 (the `startupCommand` field on
// the bridge contract) AND Task 3 (PtyManager.scheduleStartupCommand settle-delay
// injection) land, AND 03-02 renders the per-session pane with `data-session-id`
// so `readBufferOf(id)` can read it. When those land, this goes GREEN.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import { readBufferOf, waitForTextIn } from './helpers/xterm-driver';

describe('Startup-command injection smoke (SC5 / TERM-05, D-05)', () => {
  it('injects a configured startup command as visible keystrokes after the shell settles', async () => {
    // SEAM (verbatim): direct bridge call, no form UI.
    //   window.api.ptyCreate({ shell, cwd: undefined, startupCommand: 'echo STARTUP_OK' })
    const id = await browser.execute(async () => {
      // The renderer never resolves home — it passes cwd: undefined and MAIN
      // defaults to os.homedir(). `shell` is likewise resolved in main; the
      // renderer-facing contract here is cols/rows + the new startupCommand.
      const result = await window.api.ptyCreate({
        cols: 80,
        rows: 24,
        cwd: undefined,
        startupCommand: 'echo STARTUP_OK',
      });
      return result.id as string;
    });

    expect(id).toBeTruthy();

    // The command runs after the settle-delay; its OUTPUT (STARTUP_OK) appears.
    await waitForTextIn(id, 'STARTUP_OK', 8000);
    const buffer = await readBufferOf(id);

    // D-05 visibility: BOTH the command's output (STARTUP_OK) AND the literal
    // echoed command text (`echo STARTUP_OK`) appear — it was typed as keystrokes.
    expect(buffer).toContain('STARTUP_OK');
    expect(buffer).toContain('echo STARTUP_OK');
  });
});
