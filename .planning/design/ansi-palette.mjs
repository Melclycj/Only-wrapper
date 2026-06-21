// Wave-4 D: design a coordinated 16-color ANSI palette for the xterm terminal.
// oklch → linear sRGB → gamma sRGB → hex, + WCAG contrast vs the terminal bg (#1e232c)
// for legibility verification. Emits: console hex table + ratios, and a swatch HTML.
// Usage: node .planning/design/ansi-palette.mjs
import { writeFileSync } from 'node:fs';

function oklchToLinear(L, C, H) {
  const hr = (H * Math.PI) / 180, a = C * Math.cos(hr), b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const toHex = (L, C, H) =>
  '#' + oklchToLinear(L, C, H).map((v) => Math.round(gamma(clamp01(v)) * 255).toString(16).padStart(2, '0')).join('');
const lumLin = (L, C, H) => { const [r, g, b] = oklchToLinear(L, C, H).map(clamp01); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const Ybg = lumLin(0.255, 0.018, 264); // #1e232c
const ratio = (L, C, H) => { const y = lumLin(L, C, H); const hi = Math.max(y, Ybg), lo = Math.min(y, Ybg); return (hi + 0.05) / (lo + 0.05); };

// [name, normal(L C H), bright(L C H)] — hues aligned to brand: red≈danger 25,
// blue≈accent 248, green≈finished 150, yellow warm 85 (distinct from amber-60).
const SPEC = [
  ['black',   [0.42, 0.012, 264], [0.56, 0.012, 264]], // dim end of ramp; brightBlack(grey)=comments
  ['red',     [0.64, 0.150, 25 ], [0.72, 0.150, 25 ]],
  ['green',   [0.70, 0.130, 150], [0.78, 0.130, 150]],
  ['yellow',  [0.76, 0.130, 85 ], [0.84, 0.120, 85 ]],
  ['blue',    [0.64, 0.130, 248], [0.72, 0.130, 248]],
  ['magenta', [0.66, 0.150, 310], [0.74, 0.140, 310]],
  ['cyan',    [0.72, 0.100, 210], [0.80, 0.100, 210]],
  ['white',   [0.882, 0.008, 240], [0.96, 0.005, 250]], // normal white == shipped fg #d8dfe6 (value-preserving)
];
const BG = '#1e232c', FG = '#d8dfe6'; // KEEP the shipped default foreground (unchanged — most-used color)

const rows = SPEC.map(([name, n, b]) => ({
  name, normal: toHex(...n), bright: toHex(...b),
  rN: ratio(...n).toFixed(2), rB: ratio(...b).toFixed(2),
}));

console.log(`terminal bg ${BG}  fg(white-dim) ${FG}\n`);
console.log('name      normal   c:bg   bright   c:bg');
for (const r of rows)
  console.log(`${r.name.padEnd(8)} ${r.normal} ${String(r.rN).padStart(5)}  ${r.bright} ${String(r.rB).padStart(5)}`);
const min = Math.min(...rows.flatMap((r) => [parseFloat(r.rN), parseFloat(r.rB)]));
console.log(`\nmin contrast vs bg = ${min.toFixed(2)} (>=3.0 = legible UI text on dark)`);

// xterm theme object (ready to paste into SessionView.tsx TERMINAL_THEME)
const theme = { background: BG, foreground: FG, cursor: FG, cursorAccent: BG,
  black: rows[0].normal, brightBlack: rows[0].bright,
  red: rows[1].normal, brightRed: rows[1].bright,
  green: rows[2].normal, brightGreen: rows[2].bright,
  yellow: rows[3].normal, brightYellow: rows[3].bright,
  blue: rows[4].normal, brightBlue: rows[4].bright,
  magenta: rows[5].normal, brightMagenta: rows[5].bright,
  cyan: rows[6].normal, brightCyan: rows[6].bright,
  white: rows[7].normal, brightWhite: rows[7].bright };
console.log('\nTERMINAL_THEME =\n' + JSON.stringify(theme, null, 2));

// Swatch HTML — open in a browser to eyeball aesthetics in a terminal-like context.
const cell = (hex, label, r) =>
  `<div class="cell"><span class="sw" style="background:${hex}"></span><code>${label}</code><code class="hex">${hex}</code><code class="r">${r}:1</code></div>`;
const sample = (hex, name) => `<span style="color:${hex}">${name} the quick brown fox 0123</span>`;
const html = `<!doctype html><meta charset=utf8><title>ANSI swatch — Just-Wrapper Wave 4</title>
<style>
 body{background:#171b22;color:${FG};font:14px/1.6 -apple-system,system-ui,sans-serif;margin:0;padding:32px}
 h1{font-size:16px;font-weight:700} h2{font-size:13px;color:#9aa4b2;margin-top:28px;text-transform:uppercase;letter-spacing:.04em}
 .term{background:${BG};border-radius:12px;padding:20px 24px;font:14px/1.7 'JetBrains Mono',ui-monospace,monospace;margin:12px 0}
 .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 32px;max-width:760px}
 .cell{display:flex;align-items:center;gap:10px;font:13px 'JetBrains Mono',monospace}
 .sw{width:22px;height:22px;border-radius:6px;flex:0 0 auto}
 code{color:#c2cad6} .hex{color:#7d8794} .r{color:#5f6b7a;margin-left:auto}
</style>
<h1>Just-Wrapper — proposed terminal ANSI palette <span style="color:#7d8794">(bg ${BG})</span></h1>
<h2>Colors as terminal text (real usage)</h2>
<div class="term">
${rows.map((r) => sample(r.normal, r.name.padEnd(8))).join('<br>')}
<br>${rows.map((r) => sample(r.bright, ('bright' + r.name).padEnd(8))).join('<br>')}
</div>
<h2>Simulated git / ls output</h2>
<div class="term">
<span style="color:${FG}">$ git status</span><br>
<span style="color:${rows[2].bright}">On branch </span><span style="color:${rows[4].normal}">main</span><br>
<span style="color:${rows[1].normal}">  modified:   src/renderer/tokens.css</span><br>
<span style="color:${rows[2].normal}">  new file:   src/renderer/use-focus-trap.ts</span><br>
<span style="color:${FG}">$ ls</span><br>
<span style="color:${rows[4].bright}">src/</span>  <span style="color:${rows[6].normal}">README.md</span>  <span style="color:${rows[3].normal}">package.json</span>  <span style="color:${rows[5].normal}">node_modules/</span>
</div>
<h2>Swatches + contrast vs bg</h2>
<div class="grid">
${rows.map((r) => cell(r.normal, r.name, r.rN)).join('')}
${rows.map((r) => cell(r.bright, 'bright' + r.name, r.rB)).join('')}
</div>`;
writeFileSync('.planning/design/ansi-swatch.html', html);
console.log('\nswatch → .planning/design/ansi-swatch.html  (open in a browser)');
