#!/usr/bin/env node
/**
 * AUTONOMOUS driver for the GAP-10-D capture (spike 003).
 *
 * The spike-002 capture.sh / record.cjs recorder only forwards stdin when
 * process.stdin.isTTY — which is FALSE inside an agent Bash subprocess — so it
 * cannot be driven non-interactively from here. This driver spawns `claude --rc`
 * under a REAL node-pty (the SAME pseudo-terminal layer the app uses), tees the
 * output into an @xterm/headless Terminal (pinned 5.5.0 — byte-identical viewport
 * to production AND to record.cjs), and scripts an input sequence intended to reach
 * a real Web Search tool-permission prompt ("Do you want to proceed?" + ❯-numbered
 * options + "Esc to cancel · Tab to amend" footer).
 *
 * It is a THIN, bounded automation of the SAME mechanism record.cjs uses — it does
 * NOT hand-synthesize frames. Every line written to the capture is a real PTY frame
 * the headless emulator rendered from claude's real bytes. The capture format is the
 * SAME forensic JSONL as record.cjs (spawn / tick / settle / exit), PLUS — because
 * GAP-10-D needs the FULL multi-line region, not just the recorded `last` line — a
 * `frame` array of the last non-empty viewport lines on each settle, so the offline
 * regression test can reconstruct the genuine multi-line prompt region.
 *
 * Bounded: hard MAX_MS kill + a settle-watcher that exits a few seconds after it
 * sees a frame carrying the Web Search permission footer, so it never hangs.
 *
 * Usage (run from a real project dir so claude has context):
 *   node drive-claude-websearch.cjs
 * Env: PROMPT, MAX_MS, COLS, ROWS, LOG, REC_CWD.
 */
const fs = require('fs');
const path = require('path');
const pty = require('node-pty');
const { Terminal } = require('@xterm/headless');

const TICK_MS = 100;
const SETTLE_THRESHOLD_MS = 400;
const COLS = parseInt(process.env.COLS || '80', 10);
const ROWS = parseInt(process.env.ROWS || '40', 10);
const MAX_MS = parseInt(process.env.MAX_MS || '120000', 10);
const LOG = process.env.LOG || path.join(__dirname, 'capture-claude-websearch.jsonl');
const CWD = process.env.REC_CWD || process.cwd();
// A prompt that drives claude to make a real Web Search tool call → permission gate.
const PROMPT =
  process.env.PROMPT ||
  'Use the Web Search tool to find the latest stable version of node-pty on npm. You must use Web Search.';

const logStream = fs.createWriteStream(LOG, { flags: 'w' });
const t0 = Date.now();
const now = () => Date.now() - t0;
function log(obj) { logStream.write(JSON.stringify({ ms: now(), ...obj }) + '\n'); }

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
function classify(lines) {
  const nonEmpty = lines.filter((l) => l.trim() !== '');
  const last = nonEmpty.length ? nonEmpty[nonEmpty.length - 1] : '';
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
  let verdict;
  if (shell_prompt && !sig.trailing_question) verdict = 'FREE(shell)';
  else if (sig.numbered_menu || sig.yn_bracket || sig.trailing_question ||
           sig.password_prompt || sig.claude_footer) verdict = 'WAITING';
  else verdict = 'FREE';
  return { last, sig, verdict, region };
}

const child = pty.spawn('claude', ['--rc'], {
  name: 'xterm-256color', cols: COLS, rows: ROWS, cwd: CWD, env: process.env,
});
log({ ev: 'spawn', cmd: ['claude', '--rc'], cols: COLS, rows: ROWS, cwd: CWD });

child.onData((d) => { term.write(d); });

// ── scripted input sequence ──────────────────────────────────────────────────
// Wait for claude to finish booting (a stable frame), type the prompt, press
// Enter, then let it run until a Web Search permission prompt appears.
let promptSent = false;
let bootStableSince = null;
let sawWebSearchPrompt = false;
let webSearchSeenAt = null;
let trustAnswered = false; // fresh-cwd "trust this folder?" prompt handled once

let lastHash = null, changeAt = 0;
const settles = [];
const seenSettleKeys = new Set();

function lastNonEmptyFrame(lines) {
  return lines.filter((l) => l.trim() !== '').slice(-8);
}
// FULL viewport (all rows incl. blanks) — captured on the Web-Search settle so the
// diagnosis can see whether claude's persistent input box / status bar renders BELOW
// the footer (which would push it out of classify()'s last-4-non-empty window).
function fullViewport(lines) {
  return lines.slice();
}

const tick = setInterval(() => {
  const lines = viewportLines();
  const joined = lines.join('\n');
  const h = fnv1a(joined);
  const changed = h !== lastHash;
  log({ ev: 'tick', hash: h, changed });
  if (changed) {
    lastHash = h; changeAt = now();
  } else {
    const stableMs = now() - changeAt;
    if (stableMs >= SETTLE_THRESHOLD_MS) {
      const c = classify(lines);
      const key = h; // one settle per stable frame
      if (!seenSettleKeys.has(key)) {
        seenSettleKeys.add(key);
        const frame = lastNonEmptyFrame(lines);
        const evt = {
          ev: 'settle', threshold: SETTLE_THRESHOLD_MS, stableMs,
          last: c.last, verdict: c.verdict, sig: c.sig, frame,
          fullViewport: fullViewport(lines),
        };
        log(evt);
        settles.push({ at: now(), ...evt });
      }
    }
  }

  const liveRegion = viewportLines().filter((l) => l.trim() !== '').slice(-10).join('\n');

  // Fresh-cwd "trust this folder?" gate — answer "1" (Yes, trust) ONCE so we proceed
  // to the real task. This is NOT the target frame (it is a startup trust gate, not a
  // tool-permission prompt), so we dismiss it rather than capture it.
  if (!trustAnswered && /trust this folder/i.test(liveRegion)) {
    trustAnswered = true;
    log({ ev: 'driver', action: 'trust-folder-yes' });
    child.write('1');
    setTimeout(() => child.write('\r'), 200);
  }

  // Boot detection: send the prompt once the frame has been stable ~1.2s after spawn
  // AND the trust prompt (if any) is past. Require the /rc-active idle input frame.
  if (!promptSent && (trustAnswered || !/trust this folder/i.test(liveRegion))) {
    const booted = /\/rc active|for agents/i.test(liveRegion);
    if (!changed && booted) {
      if (bootStableSince === null) bootStableSince = now();
      else if (now() - bootStableSince >= 1000 && now() >= 2000) {
        promptSent = true;
        child.write(PROMPT);
        setTimeout(() => child.write('\r'), 300); // submit
        log({ ev: 'driver', action: 'prompt-sent', prompt: PROMPT });
      }
    } else {
      bootStableSince = null;
    }
  }

  // Detect the Web Search permission prompt SPECIFICALLY — require a Web-Search /
  // proceed marker, NOT just any footer (the trust prompt also has an Esc footer).
  if (promptSent && !sawWebSearchPrompt) {
    const region = liveRegion;
    const footer = /(esc to (cancel|interrupt)|tab to amend)/i.test(region);
    const proceed = /do you want to proceed/i.test(region);
    const webSearch = /web\s*search/i.test(region) && /\bproceed\b|❯\s*1\./i.test(region);
    const dontAskAgain = /don'?t ask again/i.test(region);
    if (footer && (proceed || webSearch || dontAskAgain) && !/trust this folder/i.test(region)) {
      sawWebSearchPrompt = true;
      webSearchSeenAt = now();
      // Capture the FULL viewport (every row, incl. anything BELOW the footer such as
      // claude's persistent input box / status bar) so the diagnosis can see exactly
      // what the live app's viewportLines() would feed classify().
      log({ ev: 'driver', action: 'websearch-prompt-detected', at: webSearchSeenAt, fullViewport: fullViewport(viewportLines()) });
      // Hold the prompt on screen ~3s (let it settle deterministically), then exit
      // WITHOUT answering (Esc to cancel, then Ctrl-C / exit) so we never approve a
      // real Web Search side effect.
      setTimeout(() => {
        log({ ev: 'driver', action: 'esc-then-exit' });
        child.write('\x1b');           // Esc to cancel the permission prompt
        setTimeout(() => child.write('\x03'), 400); // Ctrl-C
        setTimeout(() => { try { child.write('/exit\r'); } catch {} }, 900);
        setTimeout(() => { try { child.kill(); } catch {} }, 2500);
      }, 3200);
    }
  }
}, TICK_MS);

const hardKill = setTimeout(() => { log({ ev: 'driver', action: 'max-ms-kill' }); try { child.kill(); } catch {} }, MAX_MS);

function finish(code) {
  clearInterval(tick);
  clearTimeout(hardKill);
  log({ ev: 'exit', code, sawWebSearchPrompt, webSearchSeenAt });
  logStream.end();
  const wsSettles = settles.filter((s) =>
    /(esc to (cancel|interrupt)|tab to amend)/i.test((s.frame || []).join('\n')));
  process.stdout.write(
    `\n━━━ drive-claude-websearch done ━━━\n` +
    `exit=${code} sawWebSearchPrompt=${sawWebSearchPrompt} settles=${settles.length} ws-footer-settles=${wsSettles.length}\n` +
    `log: ${LOG}\n`);
  process.exit(sawWebSearchPrompt ? 0 : 3);
}
child.onExit(({ exitCode }) => finish(exitCode));
process.on('SIGINT', () => { try { child.kill(); } catch {} });
