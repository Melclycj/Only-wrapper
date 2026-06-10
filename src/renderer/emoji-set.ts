// RENDERER ONLY — curated icon palette (04-01, D-08/D-09).
//
// A pure exported-const module (mirrors status-colors.ts's STATUS_STYLE map): no
// logic, no React/xterm/electron import. The IconPicker renders CURATED_EMOJI as a
// quick-pick grid (a free-text input still allows any emoji — Pitfall 6) and
// COLOR_SWATCHES as the warm color-badge row.
//
// Selection rationale (D-08/D-09, Claude's discretion per the planner note):
//   - CURATED_EMOJI is a cozy dev/tool set anchored by the canonical 🛋️ Parlour
//     and 🖥️ terminal glyphs (the latter is session-add.ts's DEFAULT_ICON), plus
//     common coding-agent / project / status motifs.
//   - COLOR_SWATCHES are warm oklch hues consistent with DESIGN.md's parlour
//     palette (cream/amber/clay/sage/blue/violet ring of the status ramps), so a
//     color badge reads as a cozy accent rather than a harsh primary.

/** Quick-pick emoji set for the IconPicker (free-text input allows any other). */
export const CURATED_EMOJI: readonly string[] = [
  '🛋️', // canonical Parlour scenario
  '🖥️', // terminal (DEFAULT_ICON)
  '💻',
  '⌨️',
  '🤖', // coding agent
  '🧠',
  '🐚', // shell
  '🐍', // python REPL
  '📦',
  '🚀', // dev server
  '🔧',
  '🛠️',
  '🧪', // tests
  '🔥',
  '✨',
  '🌱',
  '🌿',
  '☕', // cozy
  '📚',
  '🗂️',
  '🎯',
  '🐳', // docker
  '🌐',
  '🔌',
];

/** Warm oklch swatches for the color-badge icon kind (D-09). */
export const COLOR_SWATCHES: readonly string[] = [
  'oklch(0.66 0.15 60)', // amber (waiting accent)
  'oklch(0.70 0.13 40)', // warm clay
  'oklch(0.62 0.14 248)', // blue (running accent)
  'oklch(0.60 0.13 150)', // sage green (finished accent)
  'oklch(0.64 0.13 320)', // soft violet
  'oklch(0.68 0.12 20)', // rose
  'oklch(0.72 0.12 100)', // honey/olive
  'oklch(0.64 0.02 260)', // slate (idle accent)
];
