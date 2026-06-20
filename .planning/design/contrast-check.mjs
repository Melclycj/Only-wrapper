// Design-audit contrast checker — oklch → linear sRGB → WCAG relative luminance → contrast ratio.
// Reusable across remediation waves. Usage: node .planning/design/contrast-check.mjs
// Björn Ottosson oklab→linear-sRGB matrices; WCAG 2.x contrast = (Ll+0.05)/(Ld+0.05).

function oklchToLinearSRGB(L, C, H) {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  let R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [R, G, B].map((v) => Math.min(1, Math.max(0, v)));
}
const lum = ([R, G, B]) => 0.2126 * R + 0.7152 * G + 0.0722 * B;
const Ywhite = 1.0; // #fff
function ratio(Ya, Yb) {
  const hi = Math.max(Ya, Yb), lo = Math.min(Ya, Yb);
  return (hi + 0.05) / (lo + 0.05);
}
const Yok = (L, C, H) => lum(oklchToLinearSRGB(L, C, H));
const f = (n) => n.toFixed(2);
const pass = (r) => (r >= 4.5 ? 'PASS AA' : r >= 3 ? 'pass(large/UI only)' : 'FAIL');

// Backgrounds
const Ysurface = Ywhite;                 // --surface #ffffff
const Ybg = Yok(0.95, 0.022, 74);        // --bg cream
const Ybgsunk = Yok(0.955, 0.01, 85);

console.log('=== WHITE TEXT ON ACCENT (button labels) — need >=4.5 ===');
for (const L of [0.62, 0.56, 0.55, 0.54, 0.53, 0.52, 0.5]) {
  const C = L >= 0.6 ? 0.14 : 0.15;
  const r = ratio(Ywhite, Yok(L, C, 248));
  console.log(`  --color-accent oklch(${L} ${C} 248): white-on = ${f(r)}  ${pass(r)}`);
}
console.log('  (current 0.62/0.14 is the 3.62 failure; danger red ref below)');
console.log(`  white on --color-danger oklch(0.58 0.16 25) = ${f(ratio(Ywhite, Yok(0.58,0.16,25)))}`);

console.log('\n=== INK TEXT ON --surface (#fff) — need >=4.5 for body ===');
for (const [name, L, C, H] of [
  ['--ink        ', 0.32, 0.012, 70],
  ['--ink-soft cur', 0.5, 0.012, 70],
  ['--ink-soft 0.48', 0.48, 0.012, 70],
  ['--ink-soft 0.46', 0.46, 0.012, 70],
  ['--ink-faint cur', 0.66, 0.01, 75],
  ['--ink-faint 0.60', 0.6, 0.012, 75],
  ['--ink-faint 0.56', 0.56, 0.012, 75],
  ['--ink-faint 0.54', 0.54, 0.012, 75],
]) {
  const r = ratio(Ysurface, Yok(L, C, H));
  console.log(`  ${name} on #fff = ${f(r)}  ${pass(r)}`);
}

console.log('\n=== same inks on --bg cream (breadcrumb may sit on cream) ===');
for (const [name, L, C, H] of [
  ['--ink-soft 0.50', 0.5, 0.012, 70],
  ['--ink-soft 0.48', 0.48, 0.012, 70],
  ['--ink-faint 0.54', 0.54, 0.012, 75],
]) {
  const r = ratio(Ybg, Yok(L, C, H));
  console.log(`  ${name} on cream = ${f(r)}  ${pass(r)}`);
}

console.log('\n=== running-status blue vs darkened accent — distinguishable? ===');
console.log(`  --accent-running oklch(0.62 0.14 248) lum=${f(Yok(0.62,0.14,248))}`);
console.log(`  --color-accent  oklch(0.53 0.15 248) lum=${f(Yok(0.53,0.15,248))}`);
console.log(`  L gap 0.62 vs 0.53 = 0.09 (perceptual) — distinct.`);
