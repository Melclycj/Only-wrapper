#!/usr/bin/env node
/* eslint-disable */
/**
 * ════════════════════════════════════════════════════════════════════════════════════
 *  GAP-12-B OPERATOR DIAGNOSTIC — measure the REAL readiness-probe timeline on YOUR machine
 * ════════════════════════════════════════════════════════════════════════════════════
 *
 * WHY YOU ARE RUNNING THIS
 * ------------------------
 * In Just-Wrapper, when a session has a "Startup command", the app must wait until your
 * login shell has finished starting up before it auto-types that command. It does this
 * with an invisible "readiness probe". On your machine that probe is TIMING OUT, so the
 * command never auto-runs and you see "shell wasn't ready in time".
 *
 * We have guessed the timeout budget TWICE and it still fails on your real machine — so
 * we are DONE guessing. This script measures EXACTLY what your shell does, with
 * millisecond timestamps, so we can tune the budget to YOUR reality instead of a guess.
 *
 * It is SAFE: it only starts your normal login shell (`zsh -l`), writes one harmless
 * no-op marker (the POSIX `:` builtin — runs nothing, changes nothing, sets no variables,
 * edits no files), watches the output, and exits. It is the EXACT mechanism the app uses,
 * ported into a tiny standalone script — no Electron, no install, no app build.
 *
 * WHAT IT MIRRORS (kept byte-identical to the shipped app)
 * --------------------------------------------------------
 *   • buildPosixProbe  — the same marker `: <nonce>\r` and the same match rule
 *                        (`\n…<nonce>` — the nonce must appear on a PRODUCED line, not the
 *                        bare echo of what we typed).
 *   • READINESS_IDLE_TIMEOUT_MS = 8000   (the idle window — RESETS on every output byte)
 *   • READINESS_HARD_TIMEOUT_MS = 15000  (the absolute ceiling — NEVER resets)
 *   These two numbers are copied from src/main/pty-manager.ts. If this script times out,
 *   the app times out the SAME way.
 *
 * ════════════════════════════════════════════════════════════════════════════════════
 *  HOW TO RUN  (copy-paste, ~30 seconds)
 * ════════════════════════════════════════════════════════════════════════════════════
 *
 *   1. Open a terminal and `cd` into the Just-Wrapper project folder (the one with
 *      package.json), so `node-pty` is available:
 *
 *        cd /path/to/Just-wrapper
 *
 *   2. Run it, pointing it at the SAME directory you were editing the session into when
 *      it failed (per-directory shell init — direnv / nvm-from-.nvmrc / conda — matters):
 *
 *        node .planning/spikes/005-restart-probe-timeout/operator-probe-timeline.cjs "/the/cwd/you/edited/into"
 *
 *      If you just want your default/home behavior, omit the path:
 *
 *        node .planning/spikes/005-restart-probe-timeout/operator-probe-timeline.cjs
 *
 *      It runs the probe THREE times (a fresh "dormant Start" each run) so we can see if
 *      the timing is consistent or jittery.
 *
 *   3. PASTE BACK the whole block it prints between the two ═══ lines (the human summary),
 *      AND attach the file it writes:
 *
 *        .planning/spikes/005-restart-probe-timeout/operator-timeline.jsonl
 *
 *      (The jsonl contains ONLY: byte sizes, timing, and the first/last few characters of
 *      each output chunk — no full output, no secrets. Skim it; if anything looks private,
 *      tell us and we'll adjust.)
 *
 * That's it. We tune the real budget from your numbers and re-verify.
 * ════════════════════════════════════════════════════════════════════════════════════
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let pty;
try {
  pty = require('node-pty');
} catch (err) {
  console.error(
    '\n[GAP-12-B diagnostic] Could not load node-pty.\n' +
      'Run this from INSIDE the Just-Wrapper project folder (the one with package.json),\n' +
      'so its node_modules/node-pty is on the require path. Example:\n\n' +
      '    cd /path/to/Just-wrapper\n' +
      '    node .planning/spikes/005-restart-probe-timeout/operator-probe-timeline.cjs\n',
  );
  console.error('Underlying error:', err && err.message ? err.message : err);
  process.exit(1);
}

// ── Production constants, copied VERBATIM from src/main/pty-manager.ts ─────────────────
const READINESS_IDLE_TIMEOUT_MS = 8000; // re-armed on every output byte (extend-on-progress)
const READINESS_HARD_TIMEOUT_MS = 15000; // absolute ceiling, NEVER reset
const PROBE_SCAN_LIMIT = 8 * 1024; // last-8KB scan window (readiness-probe.ts WR-03)

// The shell the app launches on macOS: the user's login shell with the login flag.
// We honor $SHELL if present (matches resolveShell()'s default), else /bin/zsh.
const SHELL = process.env.JW_SHELL || process.env.SHELL || '/bin/zsh';
const ARGS = ['-l']; // login shell — same as the app (rc files run on a login shell)

// cwd: the operator passes the directory they were editing into (per-dir init matters).
const CWD = process.argv[2] || process.env.JW_CWD || os.homedir();

const RUNS = 3; // repeat so jitter is visible (consistent slow vs occasional slow)

const LOG = path.join(__dirname, 'operator-timeline.jsonl');
const logStream = fs.createWriteStream(LOG, { flags: 'w' });
function jlog(obj) {
  logStream.write(JSON.stringify(obj) + '\n');
}

// ── buildPosixProbe — ported VERBATIM from src/main/readiness-probe.ts ─────────────────
function buildPosixProbe(nonce) {
  const safe = nonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\n[^\\n]*${safe}`); // nonce on a PRODUCED line, not the echo
  return {
    marker: `: ${nonce}\r`,
    nonce,
    matches(buffer) {
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

// Render a chunk for the (safe) jsonl: size + first/last few visible chars, control bytes
// escaped. Never log the full chunk — only enough to see the shape of the round-trip.
function chunkPeek(s) {
  const esc = (x) => JSON.stringify(x);
  const head = s.slice(0, 24);
  const tail = s.length > 24 ? s.slice(-24) : '';
  return { bytes: s.length, head: esc(head), tail: tail ? esc(tail) : undefined };
}

/**
 * Run ONE readiness probe over a freshly-spawned shell, mirroring create()'s probe block
 * AND the GAP-12-B dual-deadline EXACTLY: an idle timer re-armed on every output byte
 * (extend-on-progress) PLUS a hard absolute ceiling that never resets. Returns a rich
 * timeline of what actually happened.
 */
function runOneProbe(runIndex) {
  return new Promise((resolve) => {
    const probe = freshProbe();
    let buffer = '';
    let settled = false;
    const t0 = Date.now();
    const now = () => Date.now() - t0;

    let firstByteAt = null; // first output byte from the shell at all
    let firstPromptAt = null; // first time we see a non-echo produced line (best-effort)
    let markerWrittenAt = null;
    let lastByteAt = null;
    let byteEvents = 0;
    let totalBytes = 0;
    let maxIdleGap = 0; // the LONGEST silent gap between two output bytes (the key signal)
    let maxIdleGapStart = 0;
    let idleResets = 0; // how many times the idle timer was re-armed

    let idleTimer = null;
    let hardTimer = null;
    const clearTimers = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (hardTimer) clearTimeout(hardTimer);
    };

    const finish = (outcome, detail) => {
      if (settled) return;
      settled = true;
      clearTimers();
      off.dispose();
      const result = {
        run: runIndex,
        outcome, // 'match' | 'idle-timeout' | 'hard-timeout'
        outcomeDetail: detail,
        matchedAtMs: outcome === 'match' ? now() : null,
        firstByteAtMs: firstByteAt,
        firstPromptAtMs: firstPromptAt,
        markerWrittenAtMs: markerWrittenAt,
        lastByteAtMs: lastByteAt,
        byteEvents,
        totalBytes,
        idleResets,
        maxIdleGapMs: maxIdleGap, // ← if this exceeds 8000 and we idle-timed-out, the shell
        maxIdleGapStartMs: maxIdleGapStart, //   went silent mid-init: reset-on-byte is wrong
        nlNonceEverSeen: new RegExp(
          `\\n[^\\n]*${probe.nonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        ).test(buffer),
        nonceEchoedAtAll: buffer.includes(probe.nonce),
      };
      jlog({ ev: 'run-result', ...result });
      try {
        child.kill();
      } catch {
        /* already gone */
      }
      resolve(result);
    };

    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () =>
          finish('idle-timeout', {
            reason: `no output byte for ${READINESS_IDLE_TIMEOUT_MS}ms (the idle window). ` +
              `Longest silent gap observed: ${maxIdleGap}ms starting at ${maxIdleGapStart}ms.`,
          }),
        READINESS_IDLE_TIMEOUT_MS,
      );
    };

    const child = pty.spawn(SHELL, ARGS, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: CWD,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    });
    jlog({ ev: 'spawn', run: runIndex, pid: child.pid, shell: SHELL, args: ARGS, cwd: CWD });

    const off = child.onData((data) => {
      const at = now();
      buffer += data;
      byteEvents += 1;
      totalBytes += data.length;
      if (firstByteAt === null) firstByteAt = at;
      // Track the longest SILENT gap between successive output bytes — the single most
      // diagnostic signal: a gap > 8000ms with the shell still alive means the idle timer
      // fires mid-init even though work is happening (reset-on-byte is the wrong signal).
      if (lastByteAt !== null) {
        const gap = at - lastByteAt;
        if (gap > maxIdleGap) {
          maxIdleGap = gap;
          maxIdleGapStart = lastByteAt;
        }
      }
      lastByteAt = at;
      // Best-effort "first prompt": the first PRODUCED line (a chunk containing a newline
      // that is NOT merely the bare echo of our marker). Informational only.
      if (firstPromptAt === null && /\n/.test(data) && !data.includes(probe.nonce)) {
        firstPromptAt = at;
      }
      jlog({ ev: 'data', run: runIndex, atMs: at, ...chunkPeek(data) });

      // GAP-12-B extend-on-progress: re-arm the idle timer on each new byte (mirrors prod).
      if (!settled) {
        idleResets += 1;
        armIdle();
      }
      // The match: the nonce appears on a PRODUCED line → the shell finished rc + re-prompted.
      if (!settled && probe.matches(buffer)) {
        jlog({ ev: 'MATCH', run: runIndex, atMs: at, markerWrittenAtMs: markerWrittenAt });
        finish('match');
      }
    });

    // Write the no-op marker (mirrors create(): the marker is written at probe-arm time,
    // BEFORE the shell has necessarily finished rc — that is the whole point of the probe).
    markerWrittenAt = now();
    child.write(probe.marker);
    jlog({ ev: 'marker-write', run: runIndex, atMs: markerWrittenAt });

    // Arm BOTH deadlines from the probe-arm point (mirrors prod).
    armIdle();
    hardTimer = setTimeout(
      () =>
        finish('hard-timeout', {
          reason: `total elapsed reached the ${READINESS_HARD_TIMEOUT_MS}ms absolute ceiling ` +
            `(rc init has not produced a re-prompt line in time).`,
        }),
      READINESS_HARD_TIMEOUT_MS,
    );
  });
}

// A small one-shot "what is your raw first-prompt latency?" control: spawn a bare login
// shell, write NOTHING, and just record when the first output byte and the first produced
// line arrive — the pure rc-init cost with no probe in the loop. Informational baseline.
function measureFirstPrompt() {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let firstByteAt = null;
    let firstNewlineAt = null;
    let settled = false;
    const child = pty.spawn(SHELL, ARGS, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: CWD,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    });
    const done = (reason) => {
      if (settled) return;
      settled = true;
      off.dispose();
      try {
        child.kill();
      } catch {
        /* */
      }
      const r = {
        firstByteAtMs: firstByteAt,
        firstNewlineAtMs: firstNewlineAt,
        reason,
      };
      jlog({ ev: 'first-prompt-control', ...r });
      resolve(r);
    };
    const off = child.onData((data) => {
      const at = Date.now() - t0;
      if (firstByteAt === null) firstByteAt = at;
      if (firstNewlineAt === null && /\n/.test(data)) {
        firstNewlineAt = at;
        // Give it a moment past the first newline, then stop — we have the prompt latency.
        setTimeout(() => done('first-newline-seen'), 200);
      }
    });
    // Safety cap: if the shell never emits a newline within the hard ceiling, stop anyway.
    setTimeout(() => done('cap-reached'), READINESS_HARD_TIMEOUT_MS + 1000);
  });
}

(async () => {
  jlog({
    ev: 'diagnostic-start',
    when: new Date().toISOString(),
    shell: SHELL,
    args: ARGS,
    cwd: CWD,
    idleMs: READINESS_IDLE_TIMEOUT_MS,
    hardMs: READINESS_HARD_TIMEOUT_MS,
    platform: process.platform,
    nodeVersion: process.version,
  });

  process.stdout.write(
    `\n[GAP-12-B diagnostic] shell=${SHELL} ${ARGS.join(' ')}  cwd=${CWD}\n` +
      `Mirroring the shipped budget: idle=${READINESS_IDLE_TIMEOUT_MS}ms (resets on output), ` +
      `hard=${READINESS_HARD_TIMEOUT_MS}ms (absolute). Running ${RUNS} probe runs…\n`,
  );

  const firstPrompt = await measureFirstPrompt();

  const results = [];
  for (let i = 1; i <= RUNS; i++) {
    process.stdout.write(`  • run ${i}/${RUNS}…\n`);
    const r = await runOneProbe(i);
    results.push(r);
  }

  logStream.end();

  // ── Human-readable summary (this is the block the operator pastes back) ──────────────
  const fmt = (v) => (v === null || v === undefined ? '—' : `${v}ms`);
  const lines = [];
  lines.push('═══════════════════════════════════════════════════════════════════════════');
  lines.push(' GAP-12-B PROBE TIMELINE — paste this whole block back');
  lines.push('═══════════════════════════════════════════════════════════════════════════');
  lines.push(`shell:            ${SHELL} ${ARGS.join(' ')}`);
  lines.push(`cwd:              ${CWD}`);
  lines.push(`platform/node:    ${process.platform} / ${process.version}`);
  lines.push(`budget mirrored:  idle=${READINESS_IDLE_TIMEOUT_MS}ms  hard=${READINESS_HARD_TIMEOUT_MS}ms`);
  lines.push('');
  lines.push(`bare first-prompt control:  first byte ${fmt(firstPrompt.firstByteAtMs)}, ` +
    `first produced line ${fmt(firstPrompt.firstNewlineAtMs)}  (pure rc-init cost, no probe)`);
  lines.push('');
  lines.push('per run:');
  for (const r of results) {
    lines.push(
      `  run ${r.run}: ${r.outcome.toUpperCase().padEnd(13)} ` +
        `match@${fmt(r.matchedAtMs)}  firstByte@${fmt(r.firstByteAtMs)}  ` +
        `firstPrompt@${fmt(r.firstPromptAtMs)}  marker@${fmt(r.markerWrittenAtMs)}  ` +
        `lastByte@${fmt(r.lastByteAtMs)}`,
    );
    lines.push(
      `         bytes=${r.totalBytes} in ${r.byteEvents} chunks  idleResets=${r.idleResets}  ` +
        `MAX-SILENT-GAP=${r.maxIdleGapMs}ms (from ${fmt(r.maxIdleGapStartMs)})  ` +
        `nl-nonce-seen=${r.nlNonceEverSeen}`,
    );
    if (r.outcomeDetail && r.outcomeDetail.reason) {
      lines.push(`         → ${r.outcomeDetail.reason}`);
    }
  }
  lines.push('');
  // The verdict hints — which of the three open questions the data answers.
  const anyMatch = results.some((r) => r.outcome === 'match');
  const anyIdle = results.some((r) => r.outcome === 'idle-timeout');
  const anyHard = results.some((r) => r.outcome === 'hard-timeout');
  const worstGap = Math.max(0, ...results.map((r) => r.maxIdleGapMs));
  lines.push('reading:');
  if (anyMatch && !anyIdle && !anyHard) {
    lines.push('  • All runs MATCHED with the shipped budget on THIS cwd. If the app still');
    lines.push('    fails, the failing cwd is likely a DIFFERENT directory with heavier per-dir');
    lines.push('    init — re-run pointing at the exact folder you edited into when it failed.');
  }
  if (anyIdle) {
    lines.push(`  • An IDLE-timeout fired. Longest silent gap seen: ${worstGap}ms.`);
    lines.push('    If that gap is > 8000ms while the shell was still alive, your rc goes SILENT');
    lines.push('    mid-init (a network/compinit/per-dir step that prints nothing) → resetting');
    lines.push('    the timer on each byte is the WRONG signal; the fix is a larger idle window');
    lines.push('    or a different liveness signal (NOT another guessed number).');
  }
  if (anyHard) {
    lines.push('  • A HARD-ceiling timeout fired → your TOTAL rc init exceeds 15000ms. The fix');
    lines.push('    is to raise the ceiling (and/or reconsider auto-running a 15s+ startup vs a');
    lines.push('    "press Enter to run" affordance).');
  }
  lines.push('═══════════════════════════════════════════════════════════════════════════');
  lines.push(`(full timeline written to: ${LOG})`);
  lines.push('═══════════════════════════════════════════════════════════════════════════');

  process.stdout.write('\n' + lines.join('\n') + '\n');
  process.exit(0);
})();
