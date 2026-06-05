// MAIN-side pure matcher (04-01, NAV-05, D-12/D-13).
//
// Imports NOTHING from electron or node-pty — it is a small pure function so it
// unit-tests in the Node/Vitest env (mirrors pty-manager.ts's deriveStatus /
// clampDimension pure helpers). main/index.ts casts the Electron `Input` to
// `KeyInput` and calls this inside `win.webContents.on('before-input-event')`.
//
// One rule covers BOTH platforms (D-12/D-13): the primary modifier is Cmd (meta)
// on macOS OR Ctrl (control) on Windows. Cmd/Ctrl+1-9 → position; Cmd/Ctrl+Shift+]
// → next; Cmd/Ctrl+Shift+[ → prev. Anything with Alt, no primary, or a non-keyDown
// event is NOT a switch chord (null) so it falls through to xterm/the PTY untouched.

/** The resolved switch intent (consumed by resolveSwitch in the renderer). */
export type SwitchIntent =
  | { kind: 'position'; index: number } // 0-based; Cmd/Ctrl+1..9
  | { kind: 'next' }
  | { kind: 'prev' };

/**
 * The subset of Electron's `Input` the matcher reads. Kept structural (not the
 * electron type) so this module stays electron-free; main/index.ts casts the real
 * Input to this shape. `code` is the physical-key name (e.g. 'Digit1',
 * 'BracketRight') — present so the A1 match can be made layout-robust in one line.
 */
export interface KeyInput {
  type: string;
  key: string;
  code?: string;
  control: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

// A1-defensive matchers: accept the logical `key` OR the physical `code`. Today
// the `key` path is asserted by the unit tests; the `code` fallback lets the
// NAV-05 E2E confirm the real Electron strings without a structural change.
function isNextBracket(i: KeyInput): boolean {
  return i.key === ']' || i.code === 'BracketRight';
}
function isPrevBracket(i: KeyInput): boolean {
  return i.key === '[' || i.code === 'BracketLeft';
}
function digit1to9(i: KeyInput): number | null {
  if (/^[1-9]$/.test(i.key)) return Number(i.key);
  // `code` form is 'Digit1'..'Digit9' (ignore 'Digit0' — not a switch position).
  const m = /^Digit([1-9])$/.exec(i.code ?? '');
  return m ? Number(m[1]) : null;
}

/**
 * Resolve a key event into a SwitchIntent, or null when it is not a switch chord.
 * Pure + electron-free (Node-testable). Never throws.
 */
export function matchSwitchKey(i: KeyInput): SwitchIntent | null {
  if (i.type !== 'keyDown') return null;
  const primary = i.meta || i.control; // macOS Cmd OR Windows Ctrl — one rule
  if (!primary || i.alt) return null; // Alt-held or no primary → not a chord
  if (i.shift) {
    if (isNextBracket(i)) return { kind: 'next' };
    if (isPrevBracket(i)) return { kind: 'prev' };
    return null;
  }
  const n = digit1to9(i);
  if (n !== null) return { kind: 'position', index: n - 1 };
  return null;
}
