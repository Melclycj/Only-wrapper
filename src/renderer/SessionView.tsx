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

export interface SessionViewProps {
  /** The RESOLVED logical id of an already-spawned PTY (SessionManager owns the spawn). */
  id: LogicalId;
  /** Whether this is the currently-visible session (drives WebGL + visibility + focus). */
  active: boolean;
}

export function SessionView({ id, active }: SessionViewProps): React.JSX.Element {
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

    // Expose the ACTIVE-by-default term for the E2E smoke driver's fallback read
    // path (window.__term). The driver primarily reads per-session DOM rows via
    // data-session-id; this is a convenience fallback for the active pane.
    (window as unknown as { __term?: Terminal }).__term = term;

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
    const offData = window.api.onPtyData(id, (data) => {
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
    });

    // 6. Passive exit notice (D-04) — no auto-restart.
    const offExit = window.api.onPtyExit(id, () => {
      term.write('\r\n\x1b[2m[process exited]\x1b[0m\r\n');
    });

    // 7. Status subscription (TERM-08). On a 'running' status that is NOT the first
    //    spawn (hasRunBefore), this was a RESTART → insert the dim separator into
    //    the SAME instance, preserving scrollback (D-03). The restart/stop CONTROLS
    //    are wired in 03-03; this only establishes the seam + the separator.
    const offStatus = window.api.onPtyStatus(id, (p) => {
      if (p.status === 'running') {
        if (hasRunBeforeRef.current) {
          const hhmm = new Date().toTimeString().slice(0, 5);
          term.write(`\r\n\x1b[2m— restarted ${hhmm} —\x1b[0m\r\n`);
        }
        hasRunBeforeRef.current = true;
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
      offData();
      offExit();
      offStatus();
      onDataDisp.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      container.removeEventListener('contextmenu', onContextMenu);
      detachWebgl(webglRef.current);
      webglRef.current = null;
      if ((window as unknown as { __term?: Terminal }).__term === term) {
        delete (window as unknown as { __term?: Terminal }).__term;
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
