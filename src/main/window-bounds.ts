// Pure, electron-free window-bounds validation (D-12, Pitfall 5).
// `validateBounds` accepts the candidate `displays` array as an ARGUMENT rather
// than calling Electron's `screen.getAllDisplays()` itself, so Vitest (Node env)
// can pass mock display work-areas — no Electron process required (mirrors
// pty-manager.ts's pure clampDimension helper with a documented edge contract).
//
// Real wiring (Plan 05-02): index.ts restores `validateBounds(saved, screen
// .getAllDisplays().map(d => ({ workArea: d.workArea })))` BEFORE win.show() so a
// window saved on a now-disconnected monitor never opens invisibly off-screen.

/** A window rectangle (top-left origin + size), in screen coordinates. */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Sane default bounds when no valid saved bounds exist (first run, corrupt store,
 * or off-screen rejection). Top-left at 0,0 keeps the window guaranteed on-screen;
 * the OS/Electron will place it within the primary display.
 */
export const DEFAULT_BOUNDS: WindowBounds = {
  x: 0,
  y: 0,
  width: 1200,
  height: 800,
};

/**
 * Validate saved window bounds against the current displays (Pitfall 5).
 *
 * Contract:
 *   - `undefined` saved bounds → DEFAULT_BOUNDS (first run / no persisted value).
 *   - saved bounds whose TOP-LEFT (x,y) falls within SOME display's work-area →
 *     the saved bounds are returned verbatim (the window is on-screen).
 *   - saved bounds whose top-left falls within NO current display work-area (e.g.
 *     a monitor that was unplugged) → DEFAULT_BOUNDS (reject off-screen restore).
 *   - bounds with a non-positive width/height (malformed) → DEFAULT_BOUNDS.
 *
 * PURE — no electron, no I/O. Unit-tested with mock `displays` arrays.
 */
export function validateBounds(
  saved: WindowBounds | undefined,
  displays: { workArea: WindowBounds }[],
): WindowBounds {
  if (!saved) return DEFAULT_BOUNDS;
  if (!(saved.width > 0) || !(saved.height > 0)) return DEFAULT_BOUNDS;
  const onScreen = displays.some((d) => {
    const wa = d.workArea;
    return (
      saved.x >= wa.x &&
      saved.x < wa.x + wa.width &&
      saved.y >= wa.y &&
      saved.y < wa.y + wa.height
    );
  });
  return onScreen ? saved : DEFAULT_BOUNDS;
}
