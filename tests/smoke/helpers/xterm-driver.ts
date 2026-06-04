// WDIO in-page driver for the xterm.js (@xterm/xterm 5.5) terminal surface.
//
// The three Phase-2 PTY smoke tests (round-trip, resize, throughput) use this
// helper to send keystrokes into the live terminal and read its rendered buffer
// back out. Selectors target xterm 5.5's DOM:
//   - keystroke sink: textarea.xterm-helper-textarea (the hidden input xterm
//     focuses to receive keyboard events)
//   - rendered text:  .xterm-rows (each child row's textContent, joined by \n)
//
// `browser` is the global injected by @wdio/electron-service (see wdio.conf.ts).
// These helpers are intentionally resilient: readBuffer() falls back to a
// window-exposed terminal handle (window.__term) if the DOM rows are not yet
// present, so 02-03/02-04 can wire either path.

/// <reference types="@wdio/globals/types" />

/** Type `text` into the focused xterm terminal (keystroke-by-keystroke). */
export async function sendKeys(text: string): Promise<void> {
  // Focus xterm's hidden textarea so keystrokes route into the terminal, then
  // type. The textarea is intentionally rendered tiny + z-index:-5 (xterm hides
  // it under the canvas), so WDIO's .click() interactability check rejects it.
  // Focus it directly in-page instead (same effect, no interactability gate),
  // then dispatch real key events via browser.keys() — the same path a user's
  // keystrokes take through the PTY round-trip.
  await browser.execute(() => {
    const ta = document.querySelector<HTMLTextAreaElement>(
      'textarea.xterm-helper-textarea',
    );
    ta?.focus();
  });
  await browser.keys(text.split(''));
}

/**
 * Resize the app's BrowserWindow to `width`×`height` via the Electron main
 * process. The CDP `Browser.getWindowForTarget`/`setWindowBounds` path that
 * backs browser.getWindowSize()/setWindowSize() is unavailable under the
 * Electron service, so we drive the real BrowserWindow.setSize() instead — this
 * still fires the OS resize → fit addon → pty.resize → SIGWINCH chain (SC3).
 */
export async function resizeWindow(width: number, height: number): Promise<void> {
  await browser.electron.execute(
    (electron, w, h) => {
      const win = electron.BrowserWindow.getAllWindows()[0];
      win?.setSize(w, h);
    },
    width,
    height,
  );
}

/**
 * Read the currently-rendered visible buffer text from the xterm instance.
 * Joins every `.xterm-rows` row's textContent with newlines. Falls back to a
 * window-exposed terminal handle (window.__term.buffer) when present.
 */
export async function readBuffer(): Promise<string> {
  return browser.execute(() => {
    // Preferred: read the rendered DOM rows (renderer-agnostic; works for
    // WebGL/canvas/DOM renderers because xterm always maintains .xterm-rows).
    const rowsEl = document.querySelector('.xterm-rows');
    if (rowsEl) {
      return Array.from(rowsEl.children)
        .map((row) => (row as HTMLElement).textContent ?? '')
        .join('\n');
    }
    // Fallback: a terminal handle the renderer may expose for testing.
    const w = window as unknown as {
      __term?: { buffer?: { active?: { length: number; getLine: (i: number) => { translateToString: () => string } | undefined } } };
    };
    const active = w.__term?.buffer?.active;
    if (active) {
      const lines: string[] = [];
      for (let i = 0; i < active.length; i++) {
        lines.push(active.getLine(i)?.translateToString() ?? '');
      }
      return lines.join('\n');
    }
    return '';
  });
}

/**
 * Poll readBuffer() until `substr` appears or `timeoutMs` elapses.
 * Resolves true on success; rejects (via WDIO waitUntil) on timeout.
 */
export async function waitForText(substr: string, timeoutMs = 5000): Promise<boolean> {
  await browser.waitUntil(
    async () => (await readBuffer()).includes(substr),
    {
      timeout: timeoutMs,
      interval: 100,
      timeoutMsg: `Expected terminal buffer to contain "${substr}" within ${timeoutMs}ms`,
    }
  );
  return true;
}
