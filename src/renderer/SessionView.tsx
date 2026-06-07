// RENDERER ONLY — per-session terminal view (03-02, refactor of TerminalPane).
//
// This is the multi-session evolution of TerminalPane: ONE xterm.js instance per
// session, created once and KEPT MOUNTED for the session's whole life. The PTY
// round-trip is identical to Phase 2 — keystroke → ptyWrite → shell → onPtyData →
// term.write → screen — but with three structural changes for N concurrent
// sessions (RESEARCH Patterns 7 & 8, D-01):
//
//   1. CONTROLLED VIEW (spawn ownership — T-03-09). SessionView NEVER calls
//      the spawn API. It receives an ALREADY-RESOLVED `id` prop from
//      SessionManager (the sole spawn owner) and binds onPtyData/onPtyExit/
//      onPtyStatus + ptyWrite/ptyResize to that id. Exactly one PTY per session.
//
//   2. WebGL ON ACTIVE ONLY. The WebGL addon is attached when this view becomes
//      active and disposed when it becomes inactive — so at most ONE WebGL context
//      exists across all sessions, dodging the Chromium ~16-context cap (Pattern 7).
//      Hidden sessions keep their xterm + buffer with NO GPU context.
//
//   3. HIDDEN-PANE-SAFE LAYOUT. Hidden panes use visibility:hidden / off-screen
//      (NOT display:none — fit()/proposeDimensions() silently no-op on display:none,
//      Pattern 8). term.write() runs even while hidden, so the buffer stays current
//      (SC1/SC2 keep-alive) with zero main-side replay. On activate we re-fit (the
//      container may have resized while hidden) and ptyResize, then focus.
//
// HARD RULE (CLAUDE.md / D-06): the renderer NEVER imports electron or node-pty.
// The ONLY bridge to main is window.api (contextBridge). xterm runs here; the PTY
// lives in main.

import { useEffect, useRef } from 'react';
import type { LogicalId } from '../shared/types';
import { createWatermark } from '../shared/flow-control';
import {
  type AgentState,
  classify,
  TICK_MS,
  SETTLE_MS,
} from '../shared/agent-state';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { CanvasAddon } from '@xterm/addon-canvas';
import '@xterm/xterm/css/xterm.css';
import './terminal.css';

// Terminal theme from DESIGN.md §"Terminal palette" (oklch → hex) — identical to
// TerminalPane (the container theme; programs drive their own ANSI/truecolor — SC4).
const TERMINAL_THEME = {
  background: '#1e232c',
  foreground: '#d8dfe6',
  cursor: '#d8dfe6',
} as const;

const RESIZE_DEBOUNCE_MS = 100;

// SEAM B (D-13): the mouse-mode-safe frame reset. A killed/restarted TUI never gets
// to send its own mouse-disable, so a TUI that turned ON mouse reporting
// (\x1b[?1000h/?1002h/?1003h + an SGR/UTF-8 encoding) would leave xterm routing the
// scroll-wheel to the dead shell as mouse-event escape bytes — the `[%30/]` garble —
// instead of scrolling its own buffer. xterm treats the alternate-screen mode (1049)
// as INDEPENDENT of the mouse-tracking modes, so `\x1b[?1049l` alone does NOT clear
// them. We therefore defensively disable EVERY mouse-tracking + encoding mode on every
// death/restart. These are FIXED literals (no interpolation — ASVS V5, no ANSI-
// injection surface). Order: disable mouse FIRST so no stray wheel report races the
// buffer restore. After this write `term.modes.mouseTrackingMode` reads 'none'.
const MOUSE_RESET =
  '\x1b[?1000l\x1b[?1001l\x1b[?1002l\x1b[?1003l' + // X10 / highlight / button-event / any-event tracking
  '\x1b[?1004l' + // focus reporting
  '\x1b[?1005l\x1b[?1006l\x1b[?1015l'; // UTF-8 / SGR / urxvt mouse encodings

// Exit the alternate-screen buffer, restoring the PRIMARY screen + its scrollback
// (D-07: never RIS / a full terminal reset, which wipes scrollback).
const ALT_SCREEN_EXIT = '\x1b[?1049l';

// Per-instance flow-control watermark (SC5) — see TerminalPane for the rationale.
const FLOW_HIGH = 100000;
const FLOW_LOW = 10000;

// WebGL lifecycle helpers (RESEARCH Pattern 7). attachWebgl is called when the view
// becomes active; detachWebgl frees the GPU context on deactivate so we stay under
// the Chromium ~16-context cap (D-01). The onContextLoss → canvas fallback (Pitfall
// 5) is preserved inside attachWebgl.
function attachWebgl(term: Terminal): WebglAddon | null {
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => {
      webgl.dispose();
      term.loadAddon(new CanvasAddon());
    });
    term.loadAddon(webgl);
    return webgl;
  } catch {
    try {
      term.loadAddon(new CanvasAddon());
    } catch {
      // Both GPU paths unavailable — xterm falls back to its DOM renderer.
    }
    return null;
  }
}

function detachWebgl(webgl: WebglAddon | null): void {
  // dispose() frees the GPU context immediately (≤16 cap). The xterm instance and
  // its buffer survive — only the WebGL renderer is detached (NOT the term).
  webgl?.dispose();
}

// WR-04 (T-06-12) renderer-side defense-in-depth: a status `notice` (the SC2 error
// path now carries a user-supplied cwd path / OS reason) is written into the terminal
// inside ANSI wrappers. Strip C0 (0x00–0x1F incl. ESC 0x1B), DEL (0x7F), and C1
// (0x80–0x9F) control characters first so a crafted path can't smuggle its own escape
// sequences (terminal/ANSI injection). Tabs/newlines are control chars too, but a
// notice is a single inline line so dropping them is correct (main also sanitizes —
// this is layered defense). Pure string transform; never throws.
function sanitizeNotice(notice: string): string {
  return notice.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
}

export interface SessionViewProps {
  /** The RESOLVED logical id of an already-spawned PTY (SessionManager owns the spawn). */
  id: LogicalId;
  /** Whether this is the currently-visible session (drives WebGL + visibility + focus). */
  active: boolean;
  /**
   * Lift the computed agent-state up to SessionManager's per-row state (TERM-09 / SC4 —
   * D-06/D-10). Called ONLY when the value CHANGES (debounced, change-only) so the
   * parent does not churn. Zero IPC: the state is computed renderer-side off the
   * onPtyData stream this view already consumes — no bridge change.
   */
  onAgentState: (id: LogicalId, state: AgentState) => void;
}

export function SessionView({
  id,
  active,
  onAgentState,
}: SessionViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // Live xterm + fit handles, shared between the mount effect and the activate
  // effect. Refs (not state) so toggling `active` never tears down the instance.
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const webglRef = useRef<WebglAddon | null>(null);
  // Tracks whether this session has reached 'running' at least once. A SECOND
  // 'running' status is a RESTART (not the first spawn) → write the dim separator
  // into the SAME instance, preserving scrollback (D-03).
  const hasRunBeforeRef = useRef(false);

  // Stable indirection for the agent-state callback so the mount effect (keyed on
  // `id` only) never re-binds — and thus never tears down the term — when the parent
  // re-renders with a fresh onAgentState closure. The detector inside the effect calls
  // through this ref. (Pattern 1, Pitfall 6.)
  const onAgentStateRef = useRef(onAgentState);
  onAgentStateRef.current = onAgentState;

  // ── Mount effect: create the xterm once, bind to the prop `id`, keep alive. ──
  // Keyed on `id` only (NOT `active`) so switching tabs never disposes the term.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. The xterm instance — verbatim from TerminalPane (scrollback 10000,
    //    allowProposedApi for unicode11, JetBrains Mono, TERMINAL_THEME).
    const term = new Terminal({
      scrollback: 10000,
      allowProposedApi: true,
      cursorStyle: 'block',
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 14,
      theme: TERMINAL_THEME,
    });
    termRef.current = term;

    // 2. Addons — fit, web-links, unicode11 (verbatim). WebGL is NOT loaded here;
    //    it is attached/detached by the activate effect (Pattern 7).
    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    const uni = new Unicode11Addon();
    term.loadAddon(uni);
    term.unicode.activeVersion = '11';

    // 3. Open + initial fit, guarded with proposeDimensions() so a not-yet-
    //    measurable container (e.g. a hidden pane on first mount) does not mis-size
    //    the terminal (Pattern 8). The activate effect re-fits + resizes the PTY.
    term.open(container);
    if (fit.proposeDimensions()) {
      fit.fit();
      window.api.ptyResize(id, term.cols, term.rows);
    }

    // 3b. macOS copy/paste + bracketed paste — verbatim from TerminalPane (D-03,
    //     SC2). Cmd+C copies selection; Cmd+V / right-click paste via term.paste()
    //     (honors bracketed-paste so multi-line paste doesn't auto-execute); Ctrl+C
    //     is NOT intercepted → forwarded to the PTY as SIGINT.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      if (e.metaKey && e.code === 'KeyC' && term.hasSelection()) {
        void navigator.clipboard.writeText(term.getSelection());
        return false;
      }
      if (e.metaKey && e.code === 'KeyV') {
        void navigator.clipboard.readText().then((t) => term.paste(t));
        return false;
      }
      return true;
    });

    const onContextMenu = (ev: MouseEvent): void => {
      ev.preventDefault();
      void navigator.clipboard.readText().then((t) => term.paste(t));
    };
    container.addEventListener('contextmenu', onContextMenu);

    // Expose this session's term for the E2E smoke driver's renderer-agnostic
    // fallback read path. The WebGL/canvas renderer (active panes) draws to a
    // canvas and does NOT populate `.xterm-rows`, so the driver's DOM-row read
    // returns empty for the active session; reading term.buffer is renderer-
    // agnostic (mirrors the single-pane window.__term fallback). We key it by id
    // (window.__sessionTerms[id]) so readBufferOf(id) can resolve the right
    // instance, and also set window.__term to the most-recently-mounted term for
    // the single-pane helpers' backward-compatible fallback.
    const w = window as unknown as {
      __term?: Terminal;
      __sessionTerms?: Record<string, Terminal>;
    };
    w.__term = term;
    w.__sessionTerms = { ...(w.__sessionTerms ?? {}), [id]: term };

    // 4. Keystrokes → main. The PTY already exists (spawned by SessionManager); we
    //    bind directly to the prop `id` (we never spawn here — T-03-09 spawn ownership).
    const onDataDisp = term.onData((d) => {
      window.api.ptyWrite(id, d);
    });

    // 5. PTY output → terminal with per-instance watermark backpressure (SC5).
    //    term.write runs UNCONDITIONALLY (no `active` guard) — a hidden session
    //    keeps buffering so its scrollback stays current (SC1/SC2 keep-alive).
    const watermark = createWatermark(FLOW_HIGH, FLOW_LOW);
    let paused = false;

    // ── Agent-state detector (TERM-09 / SC4 — D-09/D-10, zero IPC). SEAM A:
    //    FRAME-STABILITY, not output-silence. A setInterval tick (every TICK_MS)
    //    reads the live `term.buffer.active` viewport, FNV-1a-hashes the visible
    //    text, and decides:
    //      - hash CHANGED since last tick → the frame is churning (an animated
    //        "Thinking…" repaints continuously) → 'in-progress' (the property the
    //        old byte-silence model lacked, which left `claude --rc` permanently
    //        blue), and re-arm the settle window.
    //      - hash UNCHANGED for >= SETTLE_MS → the frame SETTLED → classify() the
    //        settled viewport cursor region ('waiting' | 'free').
    //    The detector is GATED on the session being 'running' (agentRunning, flipped
    //    by the status handler below) so a dormant/exited session is never classified
    //    (D-12). We emit only on CHANGE (lastAgent) to avoid parent render churn. The
    //    tick reads buffer.active even on a HIDDEN pane (term.write runs
    //    unconditionally below, and reading the buffer needs no WebGL context) — a
    //    backgrounded `claude --rc` can therefore still settle to amber (D-12). ──
    let agentRunning = false;
    let lastAgent: AgentState | null = null;
    let lastHash: string | null = null;
    let changeAt = performance.now();
    const emitAgent = (state: AgentState): void => {
      if (state === lastAgent) return;
      lastAgent = state;
      onAgentStateRef.current(id, state);
    };

    // Read the live VIEWPORT (not scrollback) as clean, ANSI-interpreted text —
    // ported verbatim from the spike reference `record.cjs` (viewportLines). Reading
    // only viewportY..+rows avoids the 001 stale-menu false positive; reading the
    // viewport requires no WebGL context so it works on hidden panes too.
    const viewportLines = (): string[] => {
      const b = term.buffer.active;
      const top = b.viewportY;
      const out: string[] = [];
      for (let i = 0; i < term.rows; i++) {
        const ln = b.getLine(top + i);
        out.push(ln ? ln.translateToString(true) : '');
      }
      return out;
    };

    // FNV-1a — a fast, non-crypto frame-equality hash (record.cjs). NOT a security
    // control (T-06.1: this is a frame-change check, not a digest).
    const fnv1a = (s: string): string => {
      let h = 0x811c9dc5;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return (h >>> 0).toString(16);
    };

    // The frame-stability tick (D-09). Armed once per mount (the effect is keyed on
    // `id` only — Pitfall 7), gated on agentRunning, cleared in the effect cleanup.
    // On an in-place restart the SAME term persists, so the interval keeps running;
    // the status handler resets lastHash/changeAt so the restart's fresh frame is
    // re-evaluated from scratch.
    const agentTick = setInterval(() => {
      if (!agentRunning) return;
      const lines = viewportLines();
      const h = fnv1a(lines.join('\n'));
      if (h !== lastHash) {
        lastHash = h;
        changeAt = performance.now();
        emitAgent('in-progress');
      } else if (performance.now() - changeAt >= SETTLE_MS) {
        emitAgent(classify(lines));
      }
    }, TICK_MS);

    const offData = window.api.onPtyData(id, (data) => {
      // Backpressure watermark (SC5) — unchanged.
      watermark.add(data.length);
      if (!paused && watermark.shouldPause()) {
        paused = true;
        window.api.ptyPause(id);
      }
      term.write(data, () => {
        watermark.drain(data.length);
        if (paused && watermark.shouldResume()) {
          paused = false;
          window.api.ptyResume(id);
        }
      });

      // Agent-state detection is no longer driven off the onPtyData byte stream
      // (the old output-silence model — SEAM A replaced it with the frame-stability
      // `agentTick` above, which reads the rendered viewport, not raw bytes).
    });

    // 6. Passive exit notice (D-04) — no auto-restart. onPtyExit fires whenever the
    //    process behind this session DIES — on a crash/kill (abnormal exit) AND on
    //    EVERY in-place Restart (which kills-then-respawns the same logical id). This is
    //    the ONE reliably-delivered death signal for a live SessionView: unlike the
    //    'running' status (whose initial + first-restart broadcasts race ahead of this
    //    subscription binding — the documented timing the restart smokes rely on), the
    //    exit event always reaches the bound handler.
    //
    //    SEAM B (D-13): emit MOUSE_RESET here so a dying process that left mouse
    //    tracking hot (a killed/restarted alt-screen TUI that never sent its own mouse-
    //    disable) immediately releases the scroll-wheel — otherwise the wheel keeps
    //    garbling as `[%30/]` mouse-report bytes. This is scrollback-PRESERVING (just
    //    DECRST sequences, never a full terminal reset / RIS — D-07) and idempotent (a
    //    no-op when mouse mode is already off). It is the reliable counterpart to the
    //    alt-screen exit done on the next 'running' transition.
    const offExit = window.api.onPtyExit(id, () => {
      term.write(MOUSE_RESET);
      term.write('\r\n\x1b[2m[process exited]\x1b[0m\r\n');
    });

    // 7. Status subscription (TERM-08). On a 'running' status that is NOT the first
    //    spawn (hasRunBefore), this was a RESTART → insert the dim separator into
    //    the SAME instance, preserving scrollback (D-03). The restart/stop CONTROLS
    //    are wired in 03-03; this only establishes the seam + the separator.
    const offStatus = window.api.onPtyStatus(id, (p) => {
      // TERM-05 D-04: a transient ready-fail notice (the startup-command probe
      // timed out → the command was NOT auto-run, a bare usable shell remains).
      // Render it as a dim inline line, consistent with the [process exited] /
      // restart-separator treatment — additive and informational. The notice
      // rides this same onPtyStatus event but carries the *current* live status
      // (typically 'running'), so it must short-circuit BEFORE the running-
      // transition branch: a notice event is informational only, NOT a lifecycle
      // restart, and treating it as one writes a spurious "— restarted —" line.
      // The saved command stays on the IdleCard as the manual-run fallback.
      if (p.notice) {
        // WR-04 (T-06-12): sanitize the notice of control chars before writing it inside
        // the ANSI wrappers — defense-in-depth against ANSI injection via the cwd-bearing
        // SC2 notice. This short-circuit MUST stay BEFORE the running branch (a notice
        // event carries the CURRENT live status, usually 'running', and is informational
        // only — treating it as a restart would write a spurious "— restarted —" line).
        term.write(`\r\n\x1b[2m— ${sanitizeNotice(p.notice)} —\x1b[0m\r\n`);
        return;
      }
      if (p.status === 'running') {
        // SEAM B restart seam (D-07/D-13). MOUSE_RESET fires on EVERY 'running'
        // transition this view observes — NOT gated on hasRunBeforeRef. Rationale:
        // main broadcasts the INITIAL spawn's 'running' BEFORE this subscription binds
        // (the documented race the restart smokes rely on), so the FIRST 'running' the
        // view actually sees is already a RESTART whose prior process may have left mouse
        // tracking hot. Gating MOUSE_RESET on hasRunBeforeRef would therefore skip the
        // user's first restart and leave the wheel garbling as `[%30/]` bytes (D-13).
        // Writing MOUSE_RESET when the mode is already 'none' is a harmless no-op (the
        // DECRST sequences are idempotent), so emitting it unconditionally is safe and
        // correct. We exit the alternate-screen buffer ONLY when actually in it
        // (`buffer.active.type === 'alternate'`) so a plain-shell restart does NOT
        // needlessly toggle the alt-buffer and trim primary scrollback (D-07). NEVER
        // RIS / a full terminal reset here — it wipes the scrollback the restart must
        // preserve. These writes are FIXED literals (ASVS V5 — no interpolation).
        term.write(
          MOUSE_RESET +
            (term.buffer.active.type === 'alternate' ? ALT_SCREEN_EXIT : ''),
        );
        // The "— restarted —" separator, by contrast, IS gated on hasRunBeforeRef so a
        // genuinely-fresh dormant Start shows no separator (D-08). It must paint AFTER
        // the alt-screen exit, on the clean primary screen.
        if (hasRunBeforeRef.current) {
          const hhmm = new Date().toTimeString().slice(0, 5);
          term.write(`\r\n\x1b[2m— restarted ${hhmm} —\x1b[0m\r\n`);
        }
        hasRunBeforeRef.current = true;
        // Open the agent-state detector gate (D-12): classify only while running.
        agentRunning = true;
      } else {
        // SEAM B abnormal-exit seam (D-13 / RESEARCH Open Q1): a genuinely-dead frame
        // ('exited'/'error', i.e. a killed vim/less or a crash — NOT 'stopped', which
        // precedes a user restart). The dead TUI never sent its own mouse-disable, so
        // we emit MOUSE_RESET so the scroll-wheel scrolls the buffer instead of garbling
        // as `[%30/]` mouse-report bytes, and ALT_SCREEN_EXIT so a frozen alt-screen
        // frame never survives the reopen. This is scrollback-PRESERVING (no RIS / full
        // terminal reset anywhere — D-07): the prior scrollback stays visible above the
        // [process exited] notice. Main broadcasts this status BEFORE the onPtyExit
        // event, so the notice paints on the clean primary screen.
        // NOTE (human-verify flag): this prefers scrollback-preserving over a
        // guaranteed-blank crash frame (RESEARCH Open Q1 recommendation).
        if (p.status === 'exited' || p.status === 'error') {
          term.write(MOUSE_RESET + ALT_SCREEN_EXIT);
        }
        // Leaving 'running' (stopped/exited/error): close the gate so the
        // frame-stability tick stops classifying, and reset the change-tracker so the
        // overlay does not linger (D-12 — SessionManager also clears its per-row
        // agentState on this transition). We do NOT clear `agentTick` here: the SAME
        // term persists across an in-place restart (keep-alive xterm), so the interval
        // keeps running and is simply gated by `agentRunning`. Resetting
        // lastHash/changeAt means a later restart's fresh frame is re-evaluated from
        // scratch (Pitfall 7).
        agentRunning = false;
        lastHash = null;
        changeAt = performance.now();
        lastAgent = null;
      }
    });

    // 8. Debounced resize → fit → ptyResize (Pattern 5, SC3). Guarded with
    //    proposeDimensions() so a hidden-then-resized pane doesn't mis-size.
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = (): void => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (fit.proposeDimensions()) {
          fit.fit();
          window.api.ptyResize(id, term.cols, term.rows);
        }
      }, RESIZE_DEBOUNCE_MS);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', onResize);

    // Cleanup (Pitfall 6): only on PERMANENT removal (no delete-session UI this
    // phase) — NOT on hide. Unsubscribe streams, dispose handlers/observers, free
    // the WebGL context, then dispose the term.
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      clearInterval(agentTick);
      offData();
      offExit();
      offStatus();
      onDataDisp.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      container.removeEventListener('contextmenu', onContextMenu);
      detachWebgl(webglRef.current);
      webglRef.current = null;
      const wc = window as unknown as {
        __term?: Terminal;
        __sessionTerms?: Record<string, Terminal>;
      };
      if (wc.__term === term) delete wc.__term;
      if (wc.__sessionTerms && wc.__sessionTerms[id] === term) {
        delete wc.__sessionTerms[id];
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [id]);

  // ── Activate effect: hand WebGL + focus to/from this view as `active` flips. ──
  // On becoming active: attach WebGL, re-fit (container may have changed size while
  // hidden), ptyResize the PTY, and focus. On becoming inactive: detach WebGL.
  useEffect(() => {
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;

    if (active) {
      if (!webglRef.current) {
        webglRef.current = attachWebgl(term);
      }
      // Re-fit on show — the container may have resized while hidden (Pattern 8).
      if (fit.proposeDimensions()) {
        fit.fit();
        window.api.ptyResize(id, term.cols, term.rows);
      }
      term.focus();
    } else {
      detachWebgl(webglRef.current);
      webglRef.current = null;
    }
  }, [active, id]);

  // visibility-based hiding (NOT display:none — Pattern 8). The `active` class +
  // `hidden-pane` attribute drive the CSS in terminal.css. data-session-id is the
  // DOM contract the E2E xterm-driver reads (multi-session-keepalive).
  return (
    <div
      ref={containerRef}
      className={active ? 'session-view active' : 'session-view'}
      data-session-id={id}
      {...(active ? {} : { 'hidden-pane': '' })}
    />
  );
}
