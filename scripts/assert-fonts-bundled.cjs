#!/usr/bin/env node
/**
 * Packaged-font build-output assertion (SC4 / D-05 packaging guard).
 *
 * This script is the cheap, automated regression guard against RESEARCH
 * Pitfall 2: "works in dev, blank fonts in the packaged build". That trap is
 * caused by Vite's default `base: '/'` rewriting `@font-face url()` to absolute
 * `url(/assets/font.woff2)` paths, which 404 under the `file://` protocol the
 * packaged Electron app loads the renderer with.
 *
 * RESEARCH confirmed this repo already ships a RELATIVE base — the built
 * renderer references `./assets/...`, so the @fontsource woff2 resolve under
 * file://. This script LOCKS THAT IN: it runs against the freshly built renderer
 * output and fails loudly if a future Vite/Forge upgrade ever flips the base back
 * to absolute (re-introducing the blank-font trap).
 *
 * It is a pure-node, read-only check — it NEVER modifies the build, forge.config,
 * or vite config. It must be run AFTER a build (`npm run make` or `npm run
 * package`) so the renderer assets exist.
 *
 * Checks (against .vite/renderer/main_window/assets):
 *   1. The build output dir exists (else: instruct to run `npm run make` first).
 *   2. At least one *.woff2 is emitted (proves @fontsource fonts were bundled).
 *   3. No emitted renderer CSS contains an absolute font url — `url(/...woff2)`
 *      (the Pitfall-2 warning sign). Relative `url(./...)` / hashed names are OK.
 *
 * Exit codes:
 *   0  all checks passed
 *   1  a check failed (missing woff2, or an absolute font url was found)
 *   2  build output missing — run `npm run make` first
 */
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const rendererDir = path.join(repoRoot, '.vite', 'renderer', 'main_window');
const assetsDir = path.join(rendererDir, 'assets');

function rel(p) {
  return path.relative(repoRoot, p);
}

function fail(message, code) {
  console.error(`[assert-fonts-bundled] FAIL: ${message}`);
  process.exit(code);
}

function main() {
  console.log('[assert-fonts-bundled] checking packaged renderer font output...');
  console.log(`[assert-fonts-bundled] assets dir: ${rel(assetsDir)}`);

  // 1. Build output must exist.
  if (!fs.existsSync(assetsDir)) {
    console.error(
      '[assert-fonts-bundled] build output not found at ' + rel(assetsDir) + '.'
    );
    console.error(
      '[assert-fonts-bundled] Run `npm run make` (or `npm run package`) first, ' +
        'then re-run `npm run verify:fonts`.'
    );
    process.exit(2);
  }

  const entries = fs.readdirSync(assetsDir);

  // 2. At least one woff2 must be emitted.
  const woff2 = entries.filter((f) => f.toLowerCase().endsWith('.woff2'));
  if (woff2.length === 0) {
    fail(
      'no *.woff2 emitted under ' +
        rel(assetsDir) +
        ' — the @fontsource fonts were NOT bundled by Vite. ' +
        'Confirm the @fontsource imports are present and rebuild.',
      1
    );
  }
  const sampleNames = woff2.slice(0, 3).join(', ');
  console.log(
    `[assert-fonts-bundled] OK: ${woff2.length} woff2 emitted ` +
      `(e.g. ${sampleNames}${woff2.length > 3 ? ', …' : ''}).`
  );

  // 3. No emitted renderer CSS may reference a font via an absolute url(/...).
  //    This is the Pitfall-2 warning sign (absolute base -> 404 under file://).
  const cssFiles = entries.filter((f) => f.toLowerCase().endsWith('.css'));
  if (cssFiles.length === 0) {
    fail(
      'no emitted CSS found under ' +
        rel(assetsDir) +
        ' — cannot verify font url() are relative.',
      1
    );
  }

  // Match url(...) targeting a woff/woff2/ttf/otf/eot asset, then flag any whose
  // path begins with a leading slash (absolute) — but NOT a protocol/data url.
  const fontUrlRe = /url\(\s*(['"]?)([^)'"]+\.(?:woff2?|ttf|otf|eot))\1\s*\)/gi;
  const offenders = [];
  for (const cssFile of cssFiles) {
    const cssPath = path.join(assetsDir, cssFile);
    const css = fs.readFileSync(cssPath, 'utf8');
    let m;
    while ((m = fontUrlRe.exec(css)) !== null) {
      const target = m[2].trim();
      // Absolute path = leading slash that is not a protocol-relative `//` or a
      // data:/http(s): url. A leading single slash like `/assets/x.woff2` 404s.
      const isAbsolute = target.startsWith('/') && !target.startsWith('//');
      if (isAbsolute) {
        offenders.push(`${cssFile}: ${m[0]}`);
      }
    }
  }

  if (offenders.length > 0) {
    console.error(
      '[assert-fonts-bundled] absolute font url() found (Pitfall 2 regression — ' +
        'these 404 under file:// in the packaged app):'
    );
    for (const o of offenders) {
      console.error('  - ' + o);
    }
    fail(
      'renderer CSS references a font via an absolute `url(/...)` path. ' +
        'A Vite/Forge `base` change likely flipped the relative base to absolute.',
      1
    );
  }
  console.log(
    `[assert-fonts-bundled] OK: ${cssFiles.length} CSS file(s) scanned, ` +
      'no absolute font url(/...) — fonts resolve relative under file://.'
  );

  console.log(
    '[assert-fonts-bundled] PASS: fonts are emitted as relative-path renderer ' +
      'assets (SC4/D-05 packaging proof).'
  );
  process.exit(0);
}

main();
