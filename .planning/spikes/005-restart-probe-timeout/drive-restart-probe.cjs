#!/usr/bin/env node
/**
 * AUTONOMOUS driver for GAP-12-B (spike 005) — restart-to-apply readiness-probe timeout.
 *
 * Reproduces the LIVE timing the passing wdio smoke (DEBT-02) masks. It ports the
 * EXACT create()-probe + restart() sequence from src/main/pty-manager.ts into a
 * standalone node-pty driver (node-pty v1.1.0 loads in plain node) and measures, for
 * each spawn scenario, whether the readiness probe `\n…<nonce>` match fires within
 * READINESS_TIMEOUT_MS (4000ms) — i.e. whether the startup command WOULD auto-run.
 *
 * Three scenarios, all on /bin/zsh -l (the macOS default the app spawns):
 *   A. DORMANT-START control: a single clean create()+probe (the known-WORKING path).
 *   B. RESTART respawn: stop(SIGTERM)→await old exit→create()+probe on the SAME shell
 *      kind (the FAILING path). This is what restart() orchestrates.
 *   C. RESTART respawn but the probe.marker write is DELAYED past first onData
 *      (a control to test "the new shell wasn't reading input yet" — hypothesis a).
 *
 * It does NOT hand-synthesize the result: for each scenario it captures the REAL raw
 * probe buffer the matcher saw and prints whether buildPosixProbe.matches() returned
 * true and at what ms. The buffer is logged (probe nonce only — no user secrets) so the
 * diagnosis can SEE why the match did/didn't land.
 *
 * Usage: node drive-restart-probe.cjs   (run from the repo root)
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const pty = require('node-pty');

const READINESS_TIMEOUT_MS = 4000; // mirror pty-manager.ts
const STOP_GRACE_MS = 800; // mirror pty-manager.ts
const SHELL = process.env.JW_SHELL || '/bin/zsh';
const ARGS = ['-l']; // resolveShell() launches the login shell
const CWD = process.env.JW_CWD || process.cwd(); // a REAL existing dir (the failing-run condition)
const LOG = path.join(__dirname, 'capture-restart-probe.jsonl');
const logStream = fs.createWriteStream(LOG, { flags: 'w' });

function log(obj) {
  logStream.write(JSON.stringify(obj) + '\n');
}

// ── buildPosixProbe ported VERBATIM from src/main/readiness-probe.ts ──────────────
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
function freshProbe() {
  return buildPosixProbe(`__JW_READY_${crypto.randomBytes(8).toString('hex')}__`);
}

// Render a raw buffer for human inspection: show control bytes as escapes, cap length.
function inspectBuf(buf) {
  return JSON.stringify(buf.length > 1200 ? buf.slice(-1200) : buf);
}

/**
 * Run ONE create()-probe over an already-spawned `child`. Mirrors create()'s probe
 * block: a transient onData buffers bytes, write the marker, arm a 4000ms timer,
 * resolve {matched, ms, buffer} when matches() fires OR the timer expires.
 *
 * `delayMarkerUntilFirstData` (scenario C): defer the marker write until the first
 * onData chunk arrives from the shell (a crude "wait until the shell is talking").
 */
function runProbe(child, label, { delayMarkerUntilFirstData = false } = {}) {
  return new Promise((resolve) => {
    const probe = freshProbe();
    let buffer = '';
    let settled = false;
    const t0 = Date.now();
    let markerWrittenAt = null;
    let markerSent = false;

    const sendMarker = () => {
      if (markerSent) return;
      markerSent = true;
      markerWrittenAt = Date.now() - t0;
      child.write(probe.marker);
      log({ scenario: label, ev: 'marker-write', atMs: markerWrittenAt });
    };

    const off = child.onData((data) => {
      buffer += data;
      log({ scenario: label, ev: 'data', atMs: Date.now() - t0, chunk: inspectBuf(data) });
      if (delayMarkerUntilFirstData && !markerSent) sendMarker();
      if (!settled && probe.matches(buffer)) {
        settled = true;
        const ms = Date.now() - t0;
        clearTimeout(timer);
        off.dispose();
        log({ scenario: label, ev: 'MATCH', atMs: ms, markerWrittenAt });
        resolve({ matched: true, ms, markerWrittenAt, buffer, nonce: probe.nonce });
      }
    });

    if (!delayMarkerUntilFirstData) sendMarker();

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      off.dispose();
      log({
        scenario: label,
        ev: 'TIMEOUT',
        atMs: READINESS_TIMEOUT_MS,
        markerWrittenAt,
        bufferTail: inspectBuf(buffer),
      });
      resolve({
        matched: false,
        ms: READINESS_TIMEOUT_MS,
        markerWrittenAt,
        buffer,
        nonce: probe.nonce,
      });
    }, READINESS_TIMEOUT_MS);
  });
}

function spawnShell() {
  return pty.spawn(SHELL, ARGS, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: CWD,
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
  });
}

/** stop(): SIGTERM then SIGKILL after STOP_GRACE_MS (POSIX) — mirror pty-manager.ts. */
function stopAndAwaitExit(child) {
  return new Promise((resolve) => {
    let killTimer = null;
    const offExit = child.onExit(() => {
      if (killTimer) clearTimeout(killTimer);
      offExit.dispose();
      resolve();
    });
    child.kill('SIGTERM');
    killTimer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already dead */
      }
    }, STOP_GRACE_MS);
  });
}

async function scenarioDormantStart() {
  const label = 'A_dormant_start';
  const child = spawnShell();
  log({ scenario: label, ev: 'spawn', pid: child.pid });
  const res = await runProbe(child, label);
  try { child.kill(); } catch { /* */ }
  return { label, ...res };
}

async function scenarioRestart(delayMarker) {
  const label = delayMarker ? 'C_restart_delayed_marker' : 'B_restart_respawn';
  // Spawn an OLD shell, let it settle (so it is a genuine LIVE session), then
  // restart(): stop→await exit→respawn under a NEW child, probe the NEW child.
  const oldChild = spawnShell();
  log({ scenario: label, ev: 'old-spawn', pid: oldChild.pid });
  // Drain the old shell's boot output so the restart respawn faces a realistic
  // "a live shell was just here" timeline (matches the operator's flow: a running
  // session is restarted). Buffer-and-ignore for ~1.2s.
  await new Promise((r) => {
    const off = oldChild.onData(() => {});
    setTimeout(() => { off.dispose(); r(); }, 1200);
  });
  log({ scenario: label, ev: 'stop-begin', atMs: 0 });
  const stopT0 = Date.now();
  await stopAndAwaitExit(oldChild);
  log({ scenario: label, ev: 'old-exit', stopMs: Date.now() - stopT0 });
  // respawn() — create() under the same logical session (here: just a new child).
  const newChild = spawnShell();
  log({ scenario: label, ev: 'respawn', pid: newChild.pid });
  const res = await runProbe(newChild, label, { delayMarkerUntilFirstData: delayMarker });
  try { newChild.kill(); } catch { /* */ }
  return { label, ...res };
}

(async () => {
  log({ ev: 'driver-start', shell: SHELL, args: ARGS, cwd: CWD, timeoutMs: READINESS_TIMEOUT_MS });
  const results = [];
  // Run scenarios SERIALLY (each owns a real PTY; avoid fd contention).
  results.push(await scenarioDormantStart());
  results.push(await scenarioRestart(false));
  results.push(await scenarioRestart(true));

  // Repeat B a few times — a timing race may be intermittent. Capture the rate.
  let bMatched = 0;
  const REPEATS = 4;
  for (let i = 0; i < REPEATS; i++) {
    const r = await scenarioRestart(false);
    if (r.matched) bMatched++;
    log({ scenario: 'B_repeat', i, matched: r.matched, ms: r.ms });
  }

  logStream.end();

  const fmt = (r) =>
    `${r.label.padEnd(26)} matched=${String(r.matched).padEnd(5)} at=${String(r.ms).padStart(5)}ms  markerWrittenAt=${r.markerWrittenAt}ms`;
  process.stdout.write('\n━━━ drive-restart-probe (GAP-12-B) ━━━\n');
  for (const r of results) process.stdout.write(fmt(r) + '\n');
  process.stdout.write(`\nB_restart_respawn repeats: ${bMatched}/${REPEATS} matched\n`);
  process.stdout.write(`log: ${LOG}\n`);

  // For each result, print whether a \n<nonce> line EVER appeared and the buffer tail.
  process.stdout.write('\n── per-scenario probe buffer analysis ──\n');
  for (const r of results) {
    const hasEchoNonce = r.buffer.includes(r.nonce);
    const hasNlNonce = new RegExp(`\\n[^\\n]*${r.nonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(r.buffer);
    process.stdout.write(
      `${r.label}: nonce-present=${hasEchoNonce} nl-nonce(match-pattern)=${hasNlNonce}\n` +
      `   buffer.tail=${inspectBuf(r.buffer)}\n`,
    );
  }

  const dormant = results.find((r) => r.label === 'A_dormant_start');
  const restart = results.find((r) => r.label === 'B_restart_respawn');
  // Exit 0 only if we REPRODUCED a divergence (dormant matched, restart timed out),
  // OR clearly showed both match (in which case the live failure is something else).
  process.stdout.write(
    `\nVERDICT: dormant.matched=${dormant.matched} restart.matched=${restart.matched}\n`,
  );
  process.exit(0);
})();
