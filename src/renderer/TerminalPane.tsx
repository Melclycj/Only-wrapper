// RENDERER ONLY — the consumer side of the live PTY round-trip (02-03).
//
// This component owns a single xterm.js (@xterm/xterm 5.5) instance and closes
// the Core-Value loop end to end:
//   keystroke → term.onData → window.api.ptyWrite → main pty.write → shell
//   shell → main pty.onData → pty:data → window.api.onPtyData → term.write → screen
//
// HARD RULE (CLAUDE.md / ESLint / D-06): the renderer NEVER imports electron or
// the native PTY module. The ONLY bridge to main is window.api (contextBridge).
// xterm + its addons run here in the renderer; the PTY lives in main.
//
// Design (DESIGN.md "Terminal palette"): full-window pane, charcoal-indigo
// --term-bg, JetBrains Mono, --term-text. v1 = full-window terminal only; no
// sidebar/tabs (Phase 4).

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

// Terminal theme pulled from DESIGN.md §"Terminal palette" (oklch → hex):
//   --term-bg  oklch(0.255 0.018 264) → #1e232c (soft charcoal-indigo, NOT pure black)
//   --term-text oklch(0.90 0.012 250) → #d8dfe6
// Programs drive their own ANSI/truecolor (SC4); this only themes the container.
const TERMINAL_THEME = {
  background: '#1e232c',
  foreground: '#d8dfe6',
  cursor: '#d8dfe6',
} as const;

// Resize debounce budget — well inside the SC3 1-second reflow budget (Pattern 5).
const RESIZE_DEBOUNCE_MS = 100;

// Flow-control watermark (SC5, RESEARCH Pattern 4 — the canonical xterm.js write
// callback ↔ node-pty pause/resume backpressure). When xterm's parse queue backs
// up past HIGH we pause the main-side PTY; as term.write callbacks drain the queue
// below LOW we resume it. This keeps a 50MB `cat` responsive and lossless. We do
// NOT use node-pty's built-in XON/XOFF flow control — that is child-driven and
// the wrong layer (RESEARCH Alternatives); the renderer watermark is UI-driven.
const FLOW_HIGH = 100000; // pause once buffered bytes exceed this
const FLOW_LOW = 10000; // resume once drained below this

export function TerminalPane(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. The xterm instance. scrollback 10000 (D-04); allowProposedApi is
    //    REQUIRED for the unicode11 addon (Pitfall 3); block cursor + monospace
    //    per CONTEXT.md; theme from DESIGN.md.
    const term = new Terminal({
      scrollback: 10000,
      allowProposedApi: true,
      cursorStyle: 'block',
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 14,
      theme: TERMINAL_THEME,
    });

    // 2. Addons. fit (resize), web-links (clickable URLs in agent output),
    //    unicode11 (correct CJK/emoji cell widths — SC4, Pitfall 3).
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    const uni = new Unicode11Addon();
    term.loadAddon(uni);
    term.unicode.activeVersion = '11';

    // Renderer: prefer WebGL (GPU); fall back to canvas both on load failure and
    // on a later WebGL context loss (Pitfall 5). Default DOM renderer is the last
    // resort if even canvas fails.
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl.dispose();
        term.loadAddon(new CanvasAddon());
      });
      term.loadAddon(webgl);
    } catch {
      try {
        term.loadAddon(new CanvasAddon());
      } catch {
        // Both GPU paths unavailable — xterm falls back to its DOM renderer.
      }
    }

    // 3. Open + fit BEFORE creating the PTY so the PTY is spawned at the right
    //    cols/rows (skipping the initial fit mis-sizes the PTY — Pitfall).
    term.open(container);
    fit.fit();

    // 3b. macOS copy/paste + bracketed paste (D-03, SC2, RESEARCH Pattern 6).
    //   - Cmd+C copies the current selection (only when there is one).
    //   - Cmd+V and right-click paste via term.paste(), which honors bracketed-
    //     paste mode (DECSET 2004) so a multi-line paste does NOT auto-execute
    //     until the user presses Enter (SC2). Raw text is never fed to onData.
    //   - Returning true for everything else means Ctrl+C is NOT intercepted —
    //     xterm forwards \x03 to the PTY as SIGINT (D-03: Cmd+C ≠ Ctrl+C).
    //   - No copy-on-select handler (D-03).
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

    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault();
      void navigator.clipboard.readText().then((t) => term.paste(t));
    };
    container.addEventListener('contextmenu', onContextMenu);

    // Expose the terminal for the E2E smoke driver's fallback read path
    // (xterm-driver.readBuffer window.__term). DOM rows are the primary path.
    (window as unknown as { __term?: Terminal }).__term = term;

    // State captured once ptyCreate resolves (async). Cleanup must be safe even
    // if the component unmounts before the PTY id arrives.
    let ptyId: LogicalId | null = null;
    let offData: (() => void) | null = null;
    let offExit: (() => void) | null = null;
    let disposed = false;

    const onDataDisp = term.onData((d) => {
      if (ptyId) window.api.ptyWrite(ptyId, d);
    });

    // 4. Auto-start the single session (D-02); cwd defaults to home in main.
    void window.api
      .ptyCreate({ cols: term.cols, rows: term.rows })
      .then(({ id }) => {
        if (disposed) {
          // Unmounted before spawn resolved — nothing to wire; the window-close
          // / before-quit hooks in main will reap the PTY.
          return;
        }
        ptyId = id;

        // 5. Stream PTY output to the terminal with watermark backpressure (SC5,
        //    RESEARCH Pattern 4). Count bytes queued into xterm; pause the main
        //    PTY above FLOW_HIGH and resume it once term.write callbacks have
        //    drained the queue below FLOW_LOW. No bytes are dropped — pause only
        //    stops the source; buffered chunks are still parsed and resumed.
        //
        //    CR-02: track an explicit `paused` edge and toggle ONLY on the
        //    transition. Pausing/resuming on the rising/falling edge (and never
        //    while already in that state) eliminates the lost-resume deadlock and
        //    the resume spam: ptyResume is sent exactly once, only when we are
        //    actually paused AND the parse queue has drained below LOW. The
        //    pause check runs SYNCHRONOUSLY before queuing (add then test); the
        //    resume check runs in the write callback after the chunk is parsed
        //    (drain then test) — so a stale resume can never overtake a pause.
        const watermark = createWatermark(FLOW_HIGH, FLOW_LOW);
        let paused = false;
        offData = window.api.onPtyData(id, (data) => {
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

        // 8. Passive exit notice (D-04) — no auto-restart.
        offExit = window.api.onPtyExit(id, () => {
          term.write('\r\n\x1b[2m[process exited]\x1b[0m\r\n');
        });

        term.focus();
      });

    // 7. Debounced resize → fit → pty.resize (Pattern 5, SC3).
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = (): void => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fit.fit();
        if (ptyId) window.api.ptyResize(ptyId, term.cols, term.rows);
      }, RESIZE_DEBOUNCE_MS);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', onResize);

    // Cleanup (Pitfall 6): unsubscribe streams, dispose handlers/observers/term.
    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      offData?.();
      offExit?.();
      onDataDisp.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      container.removeEventListener('contextmenu', onContextMenu);
      delete (window as unknown as { __term?: Terminal }).__term;
      term.dispose();
    };
  }, []);

  return <div ref={containerRef} className="terminal-pane" />;
}
