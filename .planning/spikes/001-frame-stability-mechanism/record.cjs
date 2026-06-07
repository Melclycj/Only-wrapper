#!/usr/bin/env node
/**
 * Frame-stability recorder (Spike 001/002).
 *
 * Replays a command's PTY output through a headless xterm (same emulator the app
 * uses, pinned to 5.5.0) and decides "WORKING vs SETTLED" by whether the rendered
 * VIEWPORT TEXT stops changing — NOT whether the byte stream goes silent.
 *
 * Usage:
 *   node record.cjs -- bash -c '<script>'        # non-interactive (synthetic 001)
 *   node record.cjs -- claude --rc               # interactive (real 002; drive it normally)
 *   node record.cjs -- vim                       # interactive
 *
 * Env knobs: TICK_MS (100), THRESHOLDS ("400,600,800,1000"), COLS, ROWS, LOG, MAX_MS.
 *
 * Output: a JSONL forensic log (default ./record.jsonl) + an end-of-run timeline.
 * Analysis is written ONLY to the log + final summary (never to stdout mid-run),
 * so a full-screen TUI on stdout is never corrupted.
 */
const fs = require('fs');
const path = require('path');
const pty = require('node-pty');
const { Terminal } = require('@xterm/headless');

const argv = process.argv.slice(2);
const sepIdx = argv.indexOf('--');
const cmdv = sepIdx >= 0 ? argv.slice(sepIdx + 1) : argv;
if (cmdv.length === 0) { console.error('usage: node record.cjs -- <command> [args...]'); process.exit(2); }

const TICK_MS = parseInt(process.env.TICK_MS || '100', 10);
const THRESHOLDS = (process.env.THRESHOLDS || '400,600,800,1000').split(',').map((n) => parseInt(n, 10));
const COLS = parseInt(process.env.COLS || (process.stdout.columns || 80), 10);
const ROWS = parseInt(process.env.ROWS || (process.stdout.rows || 30), 10);
const LOG = process.env.LOG || path.join(__dirname, 'record.jsonl');
const MAX_MS = parseInt(process.env.MAX_MS || '0', 10); // 0 = until process exits
const interactive = !!(process.stdin.isTTY);

const logStream = fs.createWriteStream(LOG, { flags: 'w' });
const t0 = Date.now();
const now = () => Date.now() - t0;
function log(obj) { logStream.write(JSON.stringify({ ms: now(), ...obj }) + '\n'); }

// ── headless emulator ───────────────────────────────────────────────────────
const term = new Terminal({ cols: COLS, rows: ROWS, scrollback: 2000, allowProposedApi: true });

function viewportLines() {
  const b = term.buffer.active;
  const top = b.viewportY;
  const out = [];
  for (let i = 0; i < term.rows; i++) {
    const ln = b.getLine(top + i);
    out.push(ln ? ln.translateToString(true) : '');
  }
  return out;
}
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}
function lastNonEmpty(lines) {
  for (let i = lines.length - 1; i >= 0; i--) { if (lines[i].trim() !== '') return lines[i]; }
  return '';
}

// ── candidate "waiting" signals (we report which fire; 002 tells us which to trust) ──
function classify(lines) {
  // window the last non-empty lines (the active region) — NOT raw bottom rows,
  // which are blank padding for normal-buffer output (001 finding #1).
  const nonEmpty = lines.filter((l) => l.trim() !== '');
  const last = nonEmpty.length ? nonEmpty[nonEmpty.length - 1] : '';
  // tight cursor-region window (last 4 non-empty lines) — a broad scan false-positives
  // on stale menus still scrolled in the viewport (001 finding #2).
  const region = nonEmpty.slice(-4).join('\n');
  const shell_prompt = /[$%#]\s*$/.test(last) || /\w[^>]>\s*$/.test(last);
  const sig = {
    trailing_question: /\?\s*$/.test(last),
    yn_bracket: /\[y\/n\]|\(y\/n\)|\(yes\/no\)/i.test(region),
    arrow_marker: /❯/.test(region),
    numbered_menu: (region.match(/^\s*[❯>]?\s*\d+\.\s+\S/gm) || []).length >= 2,
    claude_footer: /(esc to (cancel|interrupt)|tab to amend|ctrl\+e to|↑↓ to|enter to)/i.test(region),
    shell_prompt,
    password_prompt: /(password|passphrase).*:\s*$/i.test(last),
  };
  // a shell prompt on the ACTIVE line is authoritative FREE (a scrolled-up menu
  // above it does not mean the session is waiting).
  // NOTE: arrow_marker (❯) is recorded but NOT decisive — real Claude Code shows ❯
  // persistently in its input caret, so it false-positives on idle/thinking (002 finding).
  let verdict;
  if (shell_prompt && !sig.trailing_question) verdict = 'FREE(shell)';
  else if (sig.numbered_menu || sig.yn_bracket || sig.trailing_question ||
           sig.password_prompt || sig.claude_footer) verdict = 'WAITING';
  else verdict = 'FREE';
  return { last, sig, verdict };
}

// ── spawn ─────────────────────────────────────────────────────────────────────
const child = pty.spawn(cmdv[0], cmdv.slice(1), {
  name: 'xterm-256color', cols: COLS, rows: ROWS,
  cwd: process.env.REC_CWD || process.cwd(), env: process.env,
});
log({ ev: 'spawn', cmd: cmdv, cols: COLS, rows: ROWS, interactive });

child.onData((d) => {
  if (interactive) process.stdout.write(d); // user sees the real TUI
  term.write(d);                            // tee into the analyzer
});

if (interactive) {
  try { process.stdin.setRawMode(true); } catch {}
  process.stdin.resume();
  process.stdin.on('data', (d) => child.write(d.toString('utf8')));
}

// ── tick analyzer ───────────────────────────────────────────────────────────
let lastHash = null, changeAt = 0, state = 'INIT';
const settlesFired = new Set(); // threshold keys already logged for the current stable run
const timeline = [];            // settle events for the end summary

const tick = setInterval(() => {
  const lines = viewportLines();
  const h = fnv1a(lines.join('\n'));
  log({ ev: 'tick', hash: h, changed: h !== lastHash });
  if (h !== lastHash) {
    if (state !== 'WORKING') { state = 'WORKING'; log({ ev: 'state', state }); }
    lastHash = h; changeAt = now(); settlesFired.clear();
  } else {
    const stableMs = now() - changeAt;
    for (const th of THRESHOLDS) {
      if (stableMs >= th && !settlesFired.has(th)) {
        settlesFired.add(th);
        const c = classify(lines);
        const evt = { ev: 'settle', threshold: th, stableMs, last: c.last, verdict: c.verdict, sig: c.sig };
        log(evt);
        if (th === THRESHOLDS[0]) timeline.push({ at: now(), ...evt, frame: lines.filter((l) => l.trim() !== '').slice(-6) });
        if (state !== 'SETTLED') { state = 'SETTLED'; }
      }
    }
  }
}, TICK_MS);

if (MAX_MS > 0) setTimeout(() => { try { child.kill(); } catch {} }, MAX_MS);

function finish(code) {
  clearInterval(tick);
  log({ ev: 'exit', code });
  logStream.end();
  if (interactive) { try { process.stdin.setRawMode(false); } catch {}; process.stdin.pause(); }
  // ── end-of-run timeline (the evidence) ──
  const out = [];
  out.push('');
  out.push('━━━ frame-stability timeline ━━━');
  if (timeline.length === 0) out.push('(no settle events — frame never stabilized for the smallest threshold)');
  for (const e of timeline) {
    const fired = Object.entries(e.sig).filter(([, v]) => v).map(([k]) => k);
    out.push(`@${(e.at / 1000).toFixed(1)}s  SETTLED ${e.threshold}ms  →  ${e.verdict}   [${fired.join(', ') || 'no-signals'}]`);
    out.push(`        last line: ${JSON.stringify(e.last)}`);
  }
  out.push(`━━━ ${timeline.length} settle event(s) · log: ${LOG} ━━━`);
  process.stdout.write(out.join('\n') + '\n');
  process.exit(0);
}
child.onExit(({ exitCode }) => finish(exitCode));
process.on('SIGINT', () => { try { child.kill(); } catch {} });
