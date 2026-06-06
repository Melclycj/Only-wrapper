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

/**
 * Ensure at least one live terminal session exists before a single-pane test drives
 * sendKeys/readBuffer (05-03: boot no longer auto-spawns a default session — D-10).
 * If no `.xterm-rows` (a mounted terminal) is present, click "+ Add session" and wait
 * for the terminal to mount + the shell prompt to render. Idempotent — a no-op when a
 * session is already up (so multi-pane specs that add their own sessions are unaffected).
 */
export async function ensureSession(timeoutMs = 8000): Promise<void> {
  // Readiness signal: a mounted SessionView exposes its xterm at `window.__term`
  // (SessionView sets it on mount) AND renders the xterm helper textarea. The active
  // pane uses the WebGL renderer, which does NOT populate `.xterm-rows` (the single-pane
  // readBuffer reads `window.__term.buffer` in that case), so we key readiness off the
  // term handle + the helper textarea (which sendKeys focuses), not `.xterm-rows`.
  const ready = (): boolean =>
    document.querySelector('textarea.xterm-helper-textarea') !== null &&
    (window as unknown as { __term?: unknown }).__term !== undefined;
  const has = await browser.execute(ready);
  if (has) return;
  await clickAddSession();
  await browser.waitUntil(async () => browser.execute(ready), {
    timeout: timeoutMs,
    interval: 100,
    timeoutMsg: `no terminal mounted within ${timeoutMs}ms after Add session`,
  });
  // Let the login shell paint its first prompt so the first sendKeys lands at a prompt.
  await browser.pause(500);
}

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

// ─── N-pane addressing (Phase 3 multi-session) ───────────────────────────────
//
// The single-pane helpers above remain the ACTIVE-pane fast path. The helpers
// below address a SPECIFIC session by its LogicalId, keyed off the DOM that
// plan 03-02 produces:
//   - each per-session TERMINAL container is `.session-view[data-session-id]`
//     and wraps that session's own xterm (`.xterm-rows` inside it).
//   - each SIDEBAR row is `.sidebar-row[data-session-id]`.
//   - the add-session button carries `data-testid="add-session"`.
//
// DISAMBIGUATION (03-02): both the terminal pane AND the sidebar row carry the
// same `data-session-id`, so a bare `[data-session-id="<id>"]` selector is
// ambiguous — it returns whichever appears first in DOM order (the sidebar row).
// The pane helpers therefore scope to `.session-view[...]` (the xterm container)
// and the row helper to `.sidebar-row[...]`, so each resolves the right element.

/** Type `text` into the xterm of the session identified by `id`. */
export async function sendKeysTo(id: string, text: string): Promise<void> {
  // Focus the hidden helper-textarea INSIDE this session's TERMINAL pane, then type.
  await browser.execute((sid: string) => {
    const pane = document.querySelector<HTMLElement>(
      `.session-view[data-session-id="${sid}"]`,
    );
    const ta = pane?.querySelector<HTMLTextAreaElement>(
      'textarea.xterm-helper-textarea',
    );
    ta?.focus();
  }, id);
  await browser.keys(text.split(''));
}

/**
 * Read the rendered buffer text of the session identified by `id`.
 *
 * Prefers that session pane's `.xterm-rows` (DOM renderer). The ACTIVE pane,
 * however, runs the WebGL/canvas renderer (03-02, WebGL-on-active) which draws to
 * a canvas and leaves `.xterm-rows` empty — so we fall back to the renderer-
 * agnostic xterm buffer exposed per id at `window.__sessionTerms[id]` (mirrors the
 * single-pane `window.__term.buffer` fallback above).
 */
export async function readBufferOf(id: string): Promise<string> {
  return browser.execute((sid: string) => {
    const pane = document.querySelector<HTMLElement>(
      `.session-view[data-session-id="${sid}"]`,
    );
    const rowsEl = pane?.querySelector('.xterm-rows');
    if (rowsEl && rowsEl.children.length > 0) {
      const text = Array.from(rowsEl.children)
        .map((row) => (row as HTMLElement).textContent ?? '')
        .join('\n');
      if (text.trim().length > 0) return text;
    }
    // Renderer-agnostic fallback: read the xterm buffer for this id directly.
    const w = window as unknown as {
      __sessionTerms?: Record<
        string,
        {
          buffer?: {
            active?: {
              length: number;
              getLine: (i: number) => { translateToString: () => string } | undefined;
            };
          };
        }
      >;
    };
    const active = w.__sessionTerms?.[sid]?.buffer?.active;
    if (active) {
      const lines: string[] = [];
      for (let i = 0; i < active.length; i++) {
        lines.push(active.getLine(i)?.translateToString() ?? '');
      }
      return lines.join('\n');
    }
    return '';
  }, id);
}

/** Poll readBufferOf(id) until `substr` appears or `timeoutMs` elapses. */
export async function waitForTextIn(
  id: string,
  substr: string,
  timeoutMs = 5000,
): Promise<boolean> {
  await browser.waitUntil(
    async () => (await readBufferOf(id)).includes(substr),
    {
      timeout: timeoutMs,
      interval: 100,
      timeoutMsg: `Expected session ${id} buffer to contain "${substr}" within ${timeoutMs}ms`,
    },
  );
  return true;
}

/** Click the "add session" button (creates a new session via the sidebar). */
export async function clickAddSession(): Promise<void> {
  await browser.execute(() => {
    const btn = document.querySelector<HTMLElement>(
      '[data-testid="add-session"]',
    );
    btn?.click();
  });
}

/** Click the sidebar row for the session identified by `id` (switches active). */
export async function clickSidebarRow(id: string): Promise<void> {
  await browser.execute((sid: string) => {
    const row = document.querySelector<HTMLElement>(
      `.sidebar-row[data-session-id="${sid}"]`,
    );
    row?.click();
  }, id);
}

// ─── Phase 4 identity / context-menu / collapse / switch-key helpers ─────────
//
// Plans 02/03/04 produce the DOM these helpers address (Wave 0 E2E stubs use them
// and go GREEN as those plans land). The contract:
//   - a row's context menu opens on right-click at `.sidebar-row[data-session-id]`
//     (Pitfall 5 / D-11 — the row, NOT the per-row buttons, is the collapsed-mode
//     control surface).
//   - menu items are `.context-menu-item` buttons addressed by visible text.
//   - the collapse toggle carries `data-testid="sidebar-collapse"`.
//   - the active session's identity header is `.identity-header`.

/** Right-click the sidebar row for `id` to open its context menu. */
export async function openContextMenu(id: string): Promise<void> {
  await browser.execute((sid: string) => {
    const row = document.querySelector<HTMLElement>(
      `.sidebar-row[data-session-id="${sid}"]`,
    );
    row?.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
    );
  }, id);
}

/** Click the open context-menu item whose visible text matches `label`. */
export async function clickMenuItem(label: string): Promise<void> {
  await browser.execute((text: string) => {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>('.context-menu-item'),
    );
    const match = items.find(
      (el) => (el.textContent ?? '').trim() === text,
    );
    match?.click();
  }, label);
}

/** Toggle the sidebar collapse state via its `data-testid="sidebar-collapse"` control. */
export async function toggleCollapse(): Promise<void> {
  await browser.execute(() => {
    const btn = document.querySelector<HTMLElement>(
      '[data-testid="sidebar-collapse"]',
    );
    btn?.click();
  });
}

/**
 * Drive the global switch chord for `intent` so it reaches the MAIN-process
 * `before-input-event` interceptor (04-03, NAV-05/D-13).
 *
 * A1 EMPIRICAL FINDING (this is the proof the plan's A1 assumption asked for):
 * WDIO's CDP-backed `browser.keys` injects synthetic key events at the page/DOM
 * level — they do NOT traverse Electron's native `before-input-event` pipeline, so
 * a `browser.keys([Meta, '2'])` chord NEVER fires the main-side interceptor (verified:
 * the hook recorded zero events). The reliable native path is
 * `webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })`, which DOES
 * reach `before-input-event`. We therefore drive the chord through the main process.
 *
 * Confirmed real Electron `Input` strings via the interceptor (A1 resolved):
 *   - Cmd/Ctrl+2 → { key: '2', code: 'Digit2', meta/control: true }            (digit path)
 *   - Cmd/Ctrl+Shift+] → { key: '}', code: 'BracketRight', meta: true, shift: true }
 *   - Cmd/Ctrl+Shift+[ → { key: '{', code: 'BracketLeft',  meta: true, shift: true }
 * Note: holding Shift mutates the LOGICAL `key` (] → }, [ → {), so matchSwitchKey's
 * `code`-fallback (BracketRight/BracketLeft) is what actually matches — confirming the
 * Plan-01 `key`-OR-`code` defensive matcher was necessary. No matcher change was needed.
 *
 * Position intents send Cmd/Ctrl+<n> (1-based); next/prev send Cmd/Ctrl+Shift+]/[.
 * The primary modifier is chosen by `process.platform` (meta on macOS, control else).
 */
export async function pressSwitchChord(
  intent: { kind: 'position'; index: number } | { kind: 'next' } | { kind: 'prev' },
): Promise<void> {
  const primary = process.platform === 'darwin' ? 'meta' : 'control';
  const keyCode =
    intent.kind === 'position'
      ? String(intent.index + 1)
      : intent.kind === 'next'
        ? ']'
        : '[';
  const modifiers = intent.kind === 'position' ? [primary] : [primary, 'shift'];
  await browser.electron.execute(
    (electron, kc: string, mods: string[]) => {
      const win = electron.BrowserWindow.getAllWindows()[0];
      win?.webContents.sendInputEvent({
        type: 'keyDown',
        keyCode: kc,
        modifiers: mods as Electron.InputEvent['modifiers'],
      } as Electron.InputEvent);
    },
    keyCode,
    modifiers,
  );
}

/** Read the visible text of the active session's identity header (`.identity-header`). */
export async function readIdentityHeader(): Promise<string> {
  return browser.execute(() => {
    const el = document.querySelector<HTMLElement>('.identity-header');
    return (el?.textContent ?? '').trim();
  });
}
