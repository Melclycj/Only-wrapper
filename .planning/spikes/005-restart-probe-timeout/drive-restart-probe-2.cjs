#!/usr/bin/env node
/**
 * GAP-12-B spike 005, driver 2 — tighten the reproduction.
 *
 * Driver 1 showed a bare zsh -l respawn matches the probe in ~1-1.5s (4/4) — so the
 * timeout is NOT a generic "restart is always slow". This driver isolates the
 * RESTART-SPECIFIC differences from a dormant Start:
 *
 *   D. respawn INSIDE the old child's onExit callback (exactly what restart() does),
 *      measuring whether running create() from inside that callback (vs a clean tick)
 *      changes the probe timing — event-loop / native-teardown contention.
 *   E. heavy-init simulation: prepend a synthetic delay to the shell rc to model a
 *      slower operator machine, and find the threshold where a respawn probe exceeds
 *      4000ms (and confirm a dormant Start with the SAME init also exceeds it — i.e.
 *      whether the threshold is restart-specific or shell-init-specific).
 *   F. the EXACT order restart() uses: stop() is called AFTER off=onExit is attached,
 *      and create()/probe runs in the onExit closure. Replicate verbatim and capture.
 *
 * Goal: determine whether the timeout is (i) a restart-specific event-loop/IO penalty,
 * or (ii) purely shell-init latency that is ~equal for restart and dormant Start (in
 * which case the "works on dormant Start" observation is explained by COLD-vs-WARM OS
 * caching, not a code difference).
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const pty = require('node-pty');

const READINESS_TIMEOUT_MS = 4000;
const STOP_GRACE_MS = 800;
const SHELL = '/bin/zsh';
const CWD = process.cwd();
const LOG = path.join(__dirname, 'capture-restart-probe-2.jsonl');
const logStream = fs.createWriteStream(LOG, { flags: 'w' });
const log = (o) => logStream.write(JSON.stringify(o) + '\n');

const PROBE_SCAN_LIMIT = 8 * 1024;
function buildPosixProbe(nonce) {
  const safe = nonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\n[^\\n]*${safe}`);
  return {
    marker: `: ${nonce}\r`,
    matches: (b) => re.test(b.length > PROBE_SCAN_LIMIT ? b.slice(-PROBE_SCAN_LIMIT) : b),
    nonce,
  };
}
const freshProbe = () => buildPosixProbe(`__JW_READY_${crypto.randomBytes(8).toString('hex')}__`);
const inspectBuf = (b) => JSON.stringify(b.length > 800 ? b.slice(-800) : b);

function spawnShell(extraArgs = []) {
  return pty.spawn(SHELL, ['-l', ...extraArgs], {
    name: 'xterm-256color', cols: 80, rows: 24, cwd: CWD,
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
  });
}

function runProbe(child, label) {
  return new Promise((resolve) => {
    const probe = freshProbe();
    let buffer = '', settled = false;
    const t0 = Date.now();
    const off = child.onData((data) => {
      buffer += data;
      if (!settled && probe.matches(buffer)) {
        settled = true; clearTimeout(timer); off.dispose();
        resolve({ matched: true, ms: Date.now() - t0, buffer });
      }
    });
    child.write(probe.marker);
    const timer = setTimeout(() => {
      if (settled) return; settled = true; off.dispose();
      resolve({ matched: false, ms: READINESS_TIMEOUT_MS, buffer });
    }, READINESS_TIMEOUT_MS);
  });
}

function stopAndAwaitExit(child) {
  return new Promise((resolve) => {
    let kt = null;
    const off = child.onExit(() => { if (kt) clearTimeout(kt); off.dispose(); resolve(); });
    child.kill('SIGTERM');
    kt = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* */ } }, STOP_GRACE_MS);
  });
}

// F. VERBATIM restart(): attach onExit (guarded once), then stop(); respawn+probe
//    INSIDE the onExit closure — the create() probe runs from within the dying child's
//    exit callback, exactly as pty-manager.ts restart() orchestrates it.
function restartVerbatim(oldChild, label) {
  return new Promise((resolve) => {
    let respawned = false;
    const off = oldChild.onExit(() => {
      if (respawned) return;
      respawned = true; off.dispose();
      // respawn() — synchronously create() a new child INSIDE this callback
      const newChild = spawnShell();
      log({ scenario: label, ev: 'respawn-in-onExit', pid: newChild.pid });
      runProbe(newChild, label).then((res) => {
        try { newChild.kill(); } catch { /* */ }
        resolve(res);
      });
    });
    // stop(): SIGTERM then SIGKILL grace (no await — onExit drives the respawn)
    oldChild.kill('SIGTERM');
    setTimeout(() => { try { oldChild.kill('SIGKILL'); } catch { /* */ } }, STOP_GRACE_MS);
  });
}

// E. heavy-init: write a temp ZDOTDIR rc that sleeps before prompting, to model a
//    slower operator machine. Returns the spawn fn bound to that ZDOTDIR.
function heavyInitEnv(sleepSecs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jw-heavy-'));
  // .zshrc runs on interactive shells; add a sleep to model heavy plugin/conda init.
  fs.writeFileSync(path.join(dir, '.zshrc'), `sleep ${sleepSecs}\n`);
  // login shells read .zprofile too; keep it minimal.
  fs.writeFileSync(path.join(dir, '.zprofile'), '');
  return dir;
}
function spawnHeavy(zdotdir) {
  return pty.spawn(SHELL, ['-l', '-i'], {
    name: 'xterm-256color', cols: 80, rows: 24, cwd: CWD,
    env: { ...process.env, ZDOTDIR: zdotdir, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
  });
}
function runProbeOn(child, label) { return runProbe(child, label); }

(async () => {
  const out = [];

  // F: verbatim restart() (respawn inside onExit) — 3 runs
  for (let i = 0; i < 3; i++) {
    const oldChild = spawnShell();
    await new Promise((r) => { const o = oldChild.onData(() => {}); setTimeout(() => { o.dispose(); r(); }, 1200); });
    const res = await restartVerbatim(oldChild, `F_restart_verbatim_${i}`);
    out.push({ label: `F_restart_verbatim_${i}`, ...res });
  }

  // E: heavy-init threshold — model a slow machine. Compare a DORMANT start vs a
  //    RESTART respawn under the SAME heavy init at a few sleep levels.
  for (const sleep of [3, 4, 5]) {
    const zdot = heavyInitEnv(sleep);
    // dormant start (single clean spawn) under heavy init
    {
      const c = spawnHeavy(zdot);
      const res = await runProbeOn(c, `E_dormant_sleep${sleep}`);
      try { c.kill(); } catch { /* */ }
      out.push({ label: `E_dormant_sleep${sleep}`, ...res });
    }
    // restart respawn under heavy init
    {
      const oldC = spawnHeavy(zdot);
      await new Promise((r) => { const o = oldC.onData(() => {}); setTimeout(() => { o.dispose(); r(); }, 1500); });
      await stopAndAwaitExit(oldC);
      const newC = spawnHeavy(zdot);
      const res = await runProbeOn(newC, `E_restart_sleep${sleep}`);
      try { newC.kill(); } catch { /* */ }
      out.push({ label: `E_restart_sleep${sleep}`, ...res });
    }
    try { fs.rmSync(zdot, { recursive: true, force: true }); } catch { /* */ }
  }

  logStream.end();
  process.stdout.write('\n━━━ drive-restart-probe-2 (GAP-12-B) ━━━\n');
  for (const r of out) {
    process.stdout.write(
      `${r.label.padEnd(24)} matched=${String(r.matched).padEnd(5)} at=${String(r.ms).padStart(5)}ms` +
      (r.matched ? '' : `  TIMEOUT tail=${inspectBuf(r.buffer)}`) + '\n',
    );
  }
  process.stdout.write(`log: ${LOG}\n`);
  process.exit(0);
})();
