#!/usr/bin/env node
/**
 * GAP-12-B DEBT-02 real-timing regression (committed, runnable; ported from
 * spike-005's drive-restart-probe-2.cjs heavy-init ZDOTDIR-sleep driver).
 *
 * WHY THIS, NOT THE FAST-ENV SMOKE: the wdio startup-command smoke spawns a shell in
 * a fast CI env whose rc matches in ~1s — it passes against BOTH the old fixed-4000ms
 * budget and the new dual-deadline budget, so it could not catch GAP-12-B. The bug
 * only manifests when the login-shell rc init exceeds the readiness budget (the
 * `\n…<nonce>` match can only fire AFTER the rc finishes and the shell re-prompts).
 * This test deterministically PRODUCES that timing with a ZDOTDIR `.zshrc` that
 * `sleep`s past the old 4000ms wall, then asserts the regression contract:
 *
 *   (a) CONTROL — the OLD fixed-4000ms budget TIMES OUT under a sleep>4 heavy init
 *       (proving the bug was real), AND
 *   (b) the NEW dual-deadline budget (idle-extend 8000 + hard ceiling 15000) MATCHES
 *       (injects) under the SAME heavy init, because the idle window extends on the
 *       rc's progress bytes, AND
 *   (c) a synthetic NEVER-PRODUCING stream still hits the 15000ms hard ceiling
 *       (the DoS guard — a chatty-but-never-ready shell cannot extend forever).
 *
 * The constants 8000/15000 below MIRROR pty-manager.ts's exported
 * READINESS_IDLE_TIMEOUT_MS / READINESS_HARD_TIMEOUT_MS (kept in sync by hand — this
 * driver is intentionally electron-free / src-free so it needs no build step). The
 * probe matcher is buildPosixProbe ported VERBATIM from src/main/readiness-probe.ts.
 *
 * Run via `npm run test:integration` (NOT wired into the default `test` script — it
 * spawns real shells + sleeps, so it is a manual/CI-opt-in regression). Skips cleanly
 * (exit 0, prints SKIPPED) on any host without POSIX `/bin/zsh` (Windows CI).
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ── Production-mirrored constants (keep in sync with pty-manager.ts) ─────────────
const OLD_FIXED_TIMEOUT_MS = 4000; // the retired READINESS_TIMEOUT_MS (control)
const READINESS_IDLE_TIMEOUT_MS = 8000; // mirrors the exported constant
const READINESS_HARD_TIMEOUT_MS = 15000; // mirrors the exported constant
const SHELL = '/bin/zsh';
const CWD = process.cwd();

// ── buildPosixProbe — ported VERBATIM from src/main/readiness-probe.ts (WR-02/WR-03)
const PROBE_SCAN_LIMIT = 8 * 1024;
function buildPosixProbe(nonce) {
  const safe = nonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\n[^\\n]*${safe}`);
  return {
    marker: `: ${nonce}\r`,
    nonce,
    matches: (buffer) => {
      const tail =
        buffer.length > PROBE_SCAN_LIMIT
          ? buffer.slice(buffer.length - PROBE_SCAN_LIMIT)
          : buffer;
      return re.test(tail);
    },
  };
}
const freshProbe = () =>
  buildPosixProbe(`__JW_READY_${crypto.randomBytes(8).toString('hex')}__`);

// ── Heavy-init ZDOTDIR: a .zshrc that sleeps to model a slow operator rc ─────────
function heavyInitEnv(sleepSecs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jw-heavy-'));
  fs.writeFileSync(path.join(dir, '.zshrc'), `sleep ${sleepSecs}\n`);
  fs.writeFileSync(path.join(dir, '.zprofile'), '');
  return dir;
}
function spawnHeavy(pty, zdotdir) {
  return pty.spawn(SHELL, ['-l', '-i'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: CWD,
    env: { ...process.env, ZDOTDIR: zdotdir, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
  });
}

/**
 * CONTROL probe loop = the OLD behavior: a single FIXED wall, never extended. This is
 * what create() did before GAP-12-B. Resolves { matched, ms }.
 */
function runFixedProbe(child, fixedMs) {
  return new Promise((resolve) => {
    const probe = freshProbe();
    let buffer = '';
    let settled = false;
    const t0 = Date.now();
    const off = child.onData((data) => {
      buffer += data;
      if (!settled && probe.matches(buffer)) {
        settled = true;
        clearTimeout(timer);
        off.dispose();
        resolve({ matched: true, ms: Date.now() - t0 });
      }
    });
    child.write(probe.marker);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      off.dispose();
      resolve({ matched: false, ms: fixedMs });
    }, fixedMs);
  });
}

/**
 * NEW dual-deadline probe loop = the post-GAP-12-B create() budget: an IDLE timer
 * re-armed on every produced byte (extend-on-progress) PLUS a HARD absolute ceiling
 * (never reset) from probe-arm. Both call the same give-up. Resolves
 * { matched, ms, reason }. `injectNonce` (when false) models a chatty-but-never-ready
 * stream that produces bytes forever but never re-prompts the nonce.
 */
function runDualDeadlineProbe(child, { idleMs, hardMs }) {
  return new Promise((resolve) => {
    const probe = freshProbe();
    let buffer = '';
    let settled = false;
    let idleTimer = null;
    const t0 = Date.now();
    const giveUp = (reason) => {
      if (settled) return;
      settled = true;
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(hardTimer);
      off.dispose();
      resolve({ matched: false, ms: Date.now() - t0, reason });
    };
    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => giveUp('idle'), idleMs);
    };
    const off = child.onData((data) => {
      buffer += data;
      if (!settled) armIdle(); // extend-on-progress (hard ceiling is NOT reset)
      if (!settled && probe.matches(buffer)) {
        settled = true;
        if (idleTimer) clearTimeout(idleTimer);
        clearTimeout(hardTimer);
        off.dispose();
        resolve({ matched: true, ms: Date.now() - t0, reason: 'match' });
      }
    });
    child.write(probe.marker);
    armIdle();
    const hardTimer = setTimeout(() => giveUp('hard'), hardMs);
  });
}

/**
 * A synthetic never-producing stream: a fake pty-like object whose onData fires a
 * non-matching byte every (idle - 1ms) forever, so the idle window is perpetually
 * re-armed. Used to prove the hard ceiling caps a chatty-but-never-ready shell
 * WITHOUT spawning a pathological real shell. Resolves the dual-deadline outcome.
 */
function runNeverReadyStream({ idleMs, hardMs }) {
  return new Promise((resolve) => {
    let dataCb = null;
    const fake = {
      write: () => {},
      onData: (cb) => {
        dataCb = cb;
        return { dispose: () => { dataCb = null; } };
      },
    };
    const p = runDualDeadlineProbe(fake, { idleMs, hardMs });
    // Push a non-matching byte every (idle - 1ms) so the idle timer never expires.
    const tick = setInterval(() => {
      if (dataCb) dataCb('chatty-never-ready% ');
    }, idleMs - 1);
    p.then((res) => {
      clearInterval(tick);
      resolve(res);
    });
  });
}

function fail(msg) {
  process.stderr.write(`\n✗ FAIL: ${msg}\n`);
  process.exit(1);
}

(async () => {
  // Skip cleanly on any host without POSIX /bin/zsh (Windows CI). exit 0.
  if (process.platform === 'win32' || !fs.existsSync(SHELL)) {
    process.stdout.write('SKIPPED — integration test requires POSIX /bin/zsh (macOS/Linux only)\n');
    process.exit(0);
  }
  let pty;
  try {
    pty = require('node-pty');
  } catch {
    process.stdout.write('SKIPPED — node-pty not available in this environment\n');
    process.exit(0);
  }

  const SLEEP_SECS = 5; // > the old 4000ms wall; the rc re-prompt arrives at ~5s
  process.stdout.write('━━━ GAP-12-B heavy-init readiness regression ━━━\n');
  process.stdout.write(
    `heavy init: ZDOTDIR .zshrc \`sleep ${SLEEP_SECS}\`  |  ` +
      `old=${OLD_FIXED_TIMEOUT_MS}ms  idle=${READINESS_IDLE_TIMEOUT_MS}ms  hard=${READINESS_HARD_TIMEOUT_MS}ms\n`,
  );

  // ── (a) CONTROL: the OLD fixed-4000ms budget TIMES OUT under sleep>4 ────────────
  {
    const zdot = heavyInitEnv(SLEEP_SECS);
    const child = spawnHeavy(pty, zdot);
    const res = await runFixedProbe(child, OLD_FIXED_TIMEOUT_MS);
    try { child.kill(); } catch { /* */ }
    try { fs.rmSync(zdot, { recursive: true, force: true }); } catch { /* */ }
    process.stdout.write(
      `(a) CONTROL old-${OLD_FIXED_TIMEOUT_MS}ms : matched=${res.matched} at=${res.ms}ms\n`,
    );
    if (res.matched) {
      fail(
        `the OLD fixed-${OLD_FIXED_TIMEOUT_MS}ms budget UNEXPECTEDLY matched under a ` +
          `sleep-${SLEEP_SECS} heavy init — the regression cannot be reproduced on this host ` +
          `(rc too fast). The bug premise (rc-init > old wall) was not met.`,
      );
    }
  }

  // ── (b) NEW dual-deadline budget MATCHES (injects) under the SAME heavy init ─────
  {
    const zdot = heavyInitEnv(SLEEP_SECS);
    const child = spawnHeavy(pty, zdot);
    const res = await runDualDeadlineProbe(child, {
      idleMs: READINESS_IDLE_TIMEOUT_MS,
      hardMs: READINESS_HARD_TIMEOUT_MS,
    });
    try { child.kill(); } catch { /* */ }
    try { fs.rmSync(zdot, { recursive: true, force: true }); } catch { /* */ }
    process.stdout.write(
      `(b) NEW dual-deadline   : matched=${res.matched} at=${res.ms}ms reason=${res.reason}\n`,
    );
    if (!res.matched) {
      fail(
        `the NEW dual-deadline budget did NOT match under a sleep-${SLEEP_SECS} heavy init ` +
          `(reason=${res.reason}) — the GAP-12-B fix does not extend the idle window as ` +
          `expected for a progressing rc.`,
      );
    }
  }

  // ── (c) a synthetic NEVER-PRODUCING stream still hits the 15000ms hard ceiling ──
  {
    const res = await runNeverReadyStream({
      idleMs: READINESS_IDLE_TIMEOUT_MS,
      hardMs: READINESS_HARD_TIMEOUT_MS,
    });
    process.stdout.write(
      `(c) never-ready stream  : matched=${res.matched} at=${res.ms}ms reason=${res.reason}\n`,
    );
    if (res.matched) fail('the never-ready stream UNEXPECTEDLY matched — it should never settle.');
    if (res.reason !== 'hard') {
      fail(`the never-ready stream gave up via '${res.reason}', not the 'hard' ceiling — the ` +
        `idle-extend let it postpone the absolute cap (T-12-08-01 DoS guard broken).`);
    }
    // The hard ceiling fired at ~READINESS_HARD_TIMEOUT_MS (allow generous slack).
    if (res.ms < READINESS_HARD_TIMEOUT_MS - 500 || res.ms > READINESS_HARD_TIMEOUT_MS + 2000) {
      fail(`the hard ceiling fired at ${res.ms}ms, expected ≈${READINESS_HARD_TIMEOUT_MS}ms.`);
    }
  }

  process.stdout.write('\n✓ PASS — control(old)=timeout, new=match, never-ready=hard-ceiling\n');
  process.exit(0);
})().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
