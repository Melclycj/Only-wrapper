#!/usr/bin/env node
/**
 * Re-classify a capture log under the CORRECTED rule (drop arrow_marker ❯ from the
 * waiting decision — real Claude Code shows ❯ persistently in its input caret).
 * Proves the fix on already-captured real data without re-running.
 *   node reanalyze.cjs capture-claude.jsonl
 */
const fs = require('fs');
const file = process.argv[2] || require('path').join(__dirname, 'capture-claude.jsonl');
const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

let ticks = 0, changed = 0, workingSpans = 0, prevChanged = false;
const settles = [];
for (const e of lines) {
  if (e.ev === 'tick') {
    ticks++; if (e.changed) { changed++; if (!prevChanged) workingSpans++; } prevChanged = e.changed;
  } else if (e.ev === 'settle' && e.threshold === 400) {
    settles.push(e);
  }
}

function corrected(sig, last) {
  const waiting = sig.numbered_menu || sig.yn_bracket || sig.trailing_question ||
                  sig.password_prompt || sig.claude_footer; // ❯ arrow_marker DROPPED
  if (sig.shell_prompt && !sig.trailing_question) return 'FREE(shell)';
  return waiting ? 'WAITING' : 'FREE';
}

console.log(`ticks=${ticks} changed=${changed} (${((changed / ticks) * 100).toFixed(0)}%) working-spans=${workingSpans}`);
console.log('— corrected timeline (❯ no longer decisive) —');
let waitCount = 0;
for (const e of settles) {
  const v = corrected(e.sig, e.last);
  if (v === 'WAITING') waitCount++;
  const fired = Object.entries(e.sig).filter(([, x]) => x).map(([k]) => k).join(',') || 'none';
  const flip = v !== e.verdict ? `   (was ${e.verdict})` : '';
  console.log(`@${(e.ms / 1000).toFixed(1)}s  ${v.padEnd(11)} [${fired}]${flip}`);
  console.log(`        ${JSON.stringify(e.last)}`);
}
console.log(`— ${settles.length} settles → ${waitCount} WAITING under corrected rule —`);
