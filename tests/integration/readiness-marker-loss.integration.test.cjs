#!/usr/bin/env node
/**
 * GAP-12-B DEBT-02 MARKER-LOSS regression (committed, runnable; the round-3 oracle).
 *
 * WHY A SEPARATE REGRESSION (not the heavy-init sleep driver): the CONFIRMED root cause
 * of GAP-12-B is NOT a latency budget — it is a one-shot MARKER-LOSS on cold/heavy rc
 * init. The in-app DIAG samples (.planning/spikes/005-restart-probe-timeout/) showed the
 * failing cold runs go QUIET at ~1.15s at an already-ready prompt (max silent gap ~1.5s,
 * far under the 8s idle window) and the `\n…<nonce>` match never comes: the typed-ahead
 * marker `: <nonce>\r`, queued before a cold zle finishes init, is NOT redrawn onto a
 * matchable produced line. The two prior rounds (fixed-4000ms → 8000/15000 dual-deadline)
 * tuned the WRONG, slow-but-MATCHING failure mode — a bigger timeout changes nothing for
 * a shell that is silent at a ready prompt. The heavy-init sleep driver
 * (readiness-probe-heavy-init.integration.test.cjs) reproduces that already-fixed mode,
 * so it is KEPT but does NOT cover marker-loss. THIS test models marker-loss directly.
 *
 * The failure is marker-DELIVERY, not latency, so this regression uses a FAKE pty-like
 * object (NOT a real slow shell): the failure mode is reproduced by SWALLOWING the first
 * typed-ahead marker and emitting non-matching cold rc output that goes quiet at a ready
 * prompt with NO `\n…<nonce>` line. A single-shot probe then idle-times-out at a ready
 * shell (the real failure). When the probe RE-SENDS the same marker, the fake echoes it
 * on a `\n`-preceded produced line → `\n[^\n]*<nonce>` matches (the fix recovers).
 *
 * Contract asserted:
 *   (a) WITHOUT the re-send (one-shot) the probe does NOT match the marker-loss fake
 *       (proving the bug class — a ready shell whose first marker was lost never matches).
 *   (b) WITH the re-send the probe MATCHES (proving the fix recovers a lost marker).
 *   (c) a NEVER-READY fake (swallows EVERY marker forever) still gives up via the HARD
 *       ceiling — the re-send cannot push past it (§6.5 R&C DoS guard).
 *
 * Timing: everything is driven off the fake's EMITTED BYTES and the probe OUTCOME — no
 * `sleep`/`waitForTimeout` is used as an assertion oracle (testing-policy.md). The probe
 * loop uses SCALED-DOWN budgets so the suite runs in <1s; the SHAPE (idle-extend + hard
 * ceiling + resend interval) mirrors the SHIPPED create() gate exactly, and the resend
 * interval mirrors the production READINESS_RESEND_INTERVAL_MS RATIO (resend < idle < hard).
 *
 * Run via `npm run test:integration:marker-loss` (and `npm run test:integration` runs both
 * regressions). Electron-free / src-free (no build step). Skips cleanly (exit 0) on no host
 * requirement — it uses a fake pty, so it runs everywhere, but the SKIP guard is kept for
 * parity with the heavy-init driver's convention.
 */
'use strict';

const crypto = require('node:crypto');

// ── Production-mirrored constants (keep in sync with pty-manager.ts) ─────────────
// The SHIPPED budgets are READINESS_RESEND_INTERVAL_MS=1300 / IDLE=8000 / HARD=15000.
// This regression is about marker-DELIVERY (does a re-send recover a lost marker?), not
// the absolute wall-clock numbers, so it uses SCALED-DOWN budgets that preserve the
// production RATIO (resend < idle, and a hard ceiling that bounds the resend loop) while
// keeping the suite sub-second. The shape mirrors create()'s gate exactly.
const READINESS_RESEND_INTERVAL_MS = 40; // mirrors prod resend cadence (scaled)
const READINESS_IDLE_TIMEOUT_MS = 120; // mirrors prod idle window (scaled)
const READINESS_HARD_TIMEOUT_MS = 300; // mirrors prod hard ceiling (scaled)

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

/**
 * A FAKE pty-like object modelling the MARKER-LOSS class.
 *
 * Behavior:
 *   - On the FIRST marker write: SWALLOW it (the cold-zle redraw loss). After a short
 *     beat it emits ~400 bytes of NON-MATCHING "cold rc output" then goes QUIET at a
 *     ready prompt — NO `\n…<nonce>` line is produced. So a single-shot probe idle-times-
 *     out at an already-ready shell (the real GAP-12-B failure).
 *   - On a RE-SENT marker (any marker write after the first): the shell is now at a ready
 *     prompt, so it ECHOES the marker back on a `\n`-preceded PRODUCED line →
 *     `\n[^\n]*<nonce>` matches. This models the redraw the cold shell could not do for
 *     the typed-ahead marker but CAN do once it is interactive.
 *
 * `markerText` is the probe's marker; the fake recognises a marker write by a substring
 * match on the bare nonce (which buildPosixProbe embeds in `marker`).
 */
function makeMarkerLossFake(nonce) {
  let dataCb = null;
  let markerWrites = 0;
  const fake = {
    write: (data) => {
      if (typeof data !== 'string' || data.indexOf(nonce) === -1) return; // ignore non-marker writes
      markerWrites += 1;
      if (markerWrites === 1) {
        // FIRST (typed-ahead) marker is LOST: no `\n…<nonce>` redraw. Emit ~400 bytes of
        // cold rc output (no newline-preceded nonce) then go quiet at a ready prompt.
        setTimeout(() => {
          if (!dataCb) return;
          // chunk1: the bare marker echo (NOT newline-preceded — never matches, mirrors
          // the real cold sample's first 33-byte echo chunk).
          dataCb(`: ${nonce}`);
          // ~400 bytes of cold rc output across a few chunks, NONE newline-preceding the
          // nonce (mirrors the cold-fail sample's 89+123+89+72=373 bytes with no redraw).
          dataCb('precmd: loading nvm…\r\n');
          dataCb('direnv: export +FOO +BAR\r\n');
          dataCb('compinit: rebuilding cache' + 'x'.repeat(330) + '\r\n');
          // ready prompt — goes QUIET here. No `\n…<nonce>` line.
          dataCb('user@host project % ');
        }, 5);
      } else {
        // RE-SENT marker at a ready prompt: the shell echoes it on a PRODUCED line →
        // `\n[^\n]*<nonce>` matches (the fix recovers the lost marker).
        setTimeout(() => {
          if (!dataCb) return;
          dataCb(`\nuser@host project % : ${nonce}\r\n`);
        }, 5);
      }
    },
    onData: (cb) => {
      dataCb = cb;
      return { dispose: () => { dataCb = null; } };
    },
  };
  return fake;
}

/**
 * A FAKE that swallows EVERY marker forever (never reaches a redrawable ready prompt) but
 * stays chatty — it streams a non-matching byte every (idle - 1ms) so the idle window is
 * perpetually re-armed. Proves the HARD ceiling caps the re-send loop (§6.5 R&C DoS guard).
 */
function makeNeverReadyFake() {
  let dataCb = null;
  const fake = {
    write: () => {}, // swallow every marker (and re-send) forever — never redraws
    onData: (cb) => {
      dataCb = cb;
      return { dispose: () => { dataCb = null; } };
    },
  };
  return { fake, emit: (s) => dataCb && dataCb(s) };
}

/**
 * ONE-SHOT probe loop = the OLD (pre-12-11) create() behavior: write the marker ONCE,
 * idle-extend + hard ceiling, NO re-send. Used as the (a) control — proves a marker-loss
 * fake never matches without the re-send. Resolves { matched, ms, reason }.
 */
function runOneShotProbe(child, probe, { idleMs, hardMs }) {
  return new Promise((resolve) => {
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
      if (!settled) armIdle();
      if (!settled && probe.matches(buffer)) {
        settled = true;
        if (idleTimer) clearTimeout(idleTimer);
        clearTimeout(hardTimer);
        off.dispose();
        resolve({ matched: true, ms: Date.now() - t0, reason: 'match' });
      }
    });
    child.write(probe.marker); // ONE marker only — no re-send
    armIdle();
    const hardTimer = setTimeout(() => giveUp('hard'), hardMs);
  });
}

/**
 * RE-SEND probe loop = the SHIPPED (12-11) create() gate: write the marker, idle-extend +
 * hard ceiling, PLUS a re-send interval that re-writes the SAME marker while !settled,
 * bounded by the hard ceiling (the re-send NEVER resets it). Mirrors the production
 * timers: { idle, hard, resend } + clearTimers() semantics. Resolves { matched, ms, reason }.
 */
function runResendProbe(child, probe, { idleMs, hardMs, resendMs }) {
  return new Promise((resolve) => {
    let buffer = '';
    let settled = false;
    let idleTimer = null;
    let resendTimer = null;
    const t0 = Date.now();
    const clearAll = () => {
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(hardTimer);
      if (resendTimer) clearInterval(resendTimer); // cleared on match AND give-up
    };
    const giveUp = (reason) => {
      if (settled) return;
      settled = true;
      clearAll();
      off.dispose();
      resolve({ matched: false, ms: Date.now() - t0, reason });
    };
    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => giveUp('idle'), idleMs);
    };
    const off = child.onData((data) => {
      buffer += data;
      if (!settled) armIdle(); // extend-on-progress (hard + resend NOT reset)
      if (!settled && probe.matches(buffer)) {
        settled = true;
        clearAll();
        off.dispose();
        resolve({ matched: true, ms: Date.now() - t0, reason: 'match' });
      }
    });
    child.write(probe.marker);
    armIdle();
    const hardTimer = setTimeout(() => giveUp('hard'), hardMs);
    // The re-send: re-write the SAME marker while !settled. Bounded by the hard ceiling
    // (it does NOT reset hardTimer), cleared on match/give-up — mirrors create()'s gate.
    resendTimer = setInterval(() => {
      if (settled) return;
      child.write(probe.marker);
    }, resendMs);
  });
}

function fail(msg) {
  process.stderr.write(`\n✗ FAIL: ${msg}\n`);
  process.exit(1);
}

(async () => {
  // Parity SKIP guard with the heavy-init driver. This test uses a FAKE pty (no real
  // shell), so it runs everywhere — but keep the convention.
  process.stdout.write('━━━ GAP-12-B marker-loss readiness regression ━━━\n');
  process.stdout.write(
    `marker-loss fake: first typed-ahead marker SWALLOWED, ready prompt, no \\n…<nonce>  |  ` +
      `resend=${READINESS_RESEND_INTERVAL_MS}ms idle=${READINESS_IDLE_TIMEOUT_MS}ms hard=${READINESS_HARD_TIMEOUT_MS}ms\n`,
  );

  // ── (a) ONE-SHOT does NOT match the marker-loss fake (proves the bug class) ──────
  {
    const probe = freshProbe();
    const fake = makeMarkerLossFake(probe.nonce);
    const res = await runOneShotProbe(fake, probe, {
      idleMs: READINESS_IDLE_TIMEOUT_MS,
      hardMs: READINESS_HARD_TIMEOUT_MS,
    });
    process.stdout.write(
      `(a) ONE-SHOT (no resend) : matched=${res.matched} at=${res.ms}ms reason=${res.reason}\n`,
    );
    if (res.matched) {
      fail(
        'the ONE-SHOT probe UNEXPECTEDLY matched the marker-loss fake — the bug class is ' +
          'not reproduced (the fake must NOT redraw the first typed-ahead marker onto a ' +
          '`\\n…<nonce>` line, so a single marker can never match).',
      );
    }
  }

  // ── (b) RE-SEND DOES match the marker-loss fake (proves the fix recovers) ────────
  {
    const probe = freshProbe();
    const fake = makeMarkerLossFake(probe.nonce);
    const res = await runResendProbe(fake, probe, {
      idleMs: READINESS_IDLE_TIMEOUT_MS,
      hardMs: READINESS_HARD_TIMEOUT_MS,
      resendMs: READINESS_RESEND_INTERVAL_MS,
    });
    process.stdout.write(
      `(b) RE-SEND              : matched=${res.matched} at=${res.ms}ms reason=${res.reason}\n`,
    );
    if (!res.matched) {
      fail(
        `the RE-SEND probe did NOT match the marker-loss fake (reason=${res.reason}) — the ` +
          'GAP-12-B marker re-send does not recover a lost typed-ahead marker as expected.',
      );
    }
    // The match must arrive BEFORE the hard ceiling (a re-send, not a fluke late byte).
    if (res.ms >= READINESS_HARD_TIMEOUT_MS) {
      fail(`the re-send matched at ${res.ms}ms — at/after the hard ceiling; not a clean recover.`);
    }
  }

  // ── (c) a NEVER-READY fake still hits the HARD ceiling (re-send is bounded) ──────
  {
    const probe = freshProbe();
    const { fake, emit } = makeNeverReadyFake();
    const p = runResendProbe(fake, probe, {
      idleMs: READINESS_IDLE_TIMEOUT_MS,
      hardMs: READINESS_HARD_TIMEOUT_MS,
      resendMs: READINESS_RESEND_INTERVAL_MS,
    });
    // Keep the idle window perpetually re-armed with a non-matching byte so ONLY the hard
    // ceiling can stop it — proving the re-send cannot push past the absolute cap.
    const tick = setInterval(() => emit('chatty-never-ready% '), READINESS_IDLE_TIMEOUT_MS - 1);
    const res = await p;
    clearInterval(tick);
    process.stdout.write(
      `(c) never-ready fake     : matched=${res.matched} at=${res.ms}ms reason=${res.reason}\n`,
    );
    if (res.matched) fail('the never-ready fake UNEXPECTEDLY matched — it should never settle.');
    if (res.reason !== 'hard') {
      fail(
        `the never-ready fake gave up via '${res.reason}', not the 'hard' ceiling — the ` +
          're-send + idle-extend let it postpone the absolute cap (§6.5 R&C DoS guard broken).',
      );
    }
    if (res.ms < READINESS_HARD_TIMEOUT_MS - 50 || res.ms > READINESS_HARD_TIMEOUT_MS + 200) {
      fail(`the hard ceiling fired at ${res.ms}ms, expected ≈${READINESS_HARD_TIMEOUT_MS}ms.`);
    }
  }

  process.stdout.write('\n✓ PASS — one-shot=no-match, re-send=match, never-ready=hard-ceiling\n');
  process.exit(0);
})().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
