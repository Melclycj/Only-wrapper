// Packaged-app PTY round-trip smoke (SC3 / TERM-02, plus SC4 + SIGINT on POSIX).
//
// GREEN against the `npm run make` output: it proves a PTY round-trips from
// INSIDE the ASAR-packaged app — node-pty's native helper (spawn-helper on
// macOS / conpty.node on Windows) loads from app.asar.unpacked. The primary,
// cross-platform SC3 invariant is the `echo hello` round-trip — it works
// identically in cmd / PowerShell / bash / zsh. CI runners lack `claude`, so
// the smoke deliberately uses a shell echo stand-in (NOT `claude`); the
// canonical `claude --rc` launch (SC2) is the end-of-phase human-verify.
//
// $TERM=xterm-256color and Ctrl+C/SIGINT are POSIX-shaped (cmd has no $TERM and
// different signal semantics), so those two cases are guarded to non-win32. The
// Windows leg of the matrix (Plan 03) still asserts the SC3 echo round-trip.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import {
  sendKeys,
  readBuffer,
  waitForText,
  ensureSession,
} from './helpers/xterm-driver';

const isWin = process.platform === 'win32';

describe('PTY round-trip smoke (SC3, TERM-02, SC4)', () => {
  // 05-03: boot no longer auto-spawns (D-10) — explicitly create the session this
  // single-pane test drives.
  before(async () => {
    await ensureSession();
  });

  // Cross-platform SC3 invariant: PTY echo round-trips inside the packaged ASAR
  // app (`echo hello` is identical across cmd/PowerShell/bash/zsh).
  it('echoes typed input back through the packaged-app PTY (echo hello — SC3)', async () => {
    await sendKeys('echo hello');
    await browser.keys(['Enter']);
    await waitForText('hello', 5000);
    expect(await readBuffer()).toContain('hello');
  });

  // POSIX-only: cmd.exe has no $TERM. Guarded so the Windows CI leg skips it
  // (the SC3 echo round-trip above is the Windows-relevant assertion).
  (isWin ? it.skip : it)(
    'reports TERM=xterm-256color from the PTY environment (SC4, POSIX)',
    async () => {
      await sendKeys('echo $TERM');
      await browser.keys(['Enter']);
      await waitForText('xterm-256color', 5000);
      expect(await readBuffer()).toContain('xterm-256color');
    },
  );

  // POSIX-only: Ctrl+C/SIGINT semantics differ on Windows; the SC3 echo
  // round-trip is the cross-platform proof, so this stays guarded to non-win32.
  (isWin ? it.skip : it)(
    'forwards Ctrl+C (0x03) as SIGINT and returns to the prompt (POSIX)',
    async () => {
    await sendKeys('sleep 100');
    await browser.keys(['Enter']);
    // Send the raw Ctrl+C byte (ETX, 0x03) to interrupt the foreground job.
    await browser.keys(['']);
    // After SIGINT the shell prompt returns; a fresh echo must round-trip.
    await sendKeys('echo BACK_AT_PROMPT');
    await browser.keys(['Enter']);
    await waitForText('BACK_AT_PROMPT', 5000);
    expect(await readBuffer()).toContain('BACK_AT_PROMPT');
    },
  );
});
