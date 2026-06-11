// ui-lab capture helpers — Node-side utilities shared by the capture spec.
//
// Responsibilities: output-dir layout (tag-scoped), font readiness, CSS
// override injection (the fast-preview mechanism), screenshotting, and the
// machine-readable manifest an evaluating agent consumes after a run.
//
// Protocol + invariants: tests/ui-lab/README.md

/// <reference types="@wdio/globals/types" />
/// <reference types="@wdio/electron-service" />

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

/** One captured (or skipped/failed) surface in the run manifest. */
export interface CaptureRecord {
  id: string;
  title: string;
  status: 'captured' | 'skipped' | 'error';
  /** Repo-relative png path when status === 'captured'. */
  file?: string;
  /** Why the surface was skipped or errored. */
  reason?: string;
  /** DESIGN.md anchors this surface is evaluated against. */
  designRefs: string[];
  /** One-line "what good looks like" — pointer into DESIGN-RUBRIC.md. */
  expects: string;
}

/** Tag-scoped output dir: artifacts/ui-lab/<tag>/ (default tag: current). */
export const RUN_TAG = process.env.UI_LAB_TAG ?? 'current';
export const OUT_DIR = path.resolve(
  process.cwd(),
  'artifacts',
  'ui-lab',
  RUN_TAG,
);

export function ensureOutDir(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

/**
 * Wait until the document's web fonts (Nunito / JetBrains Mono via @fontsource)
 * have finished loading, so captures never show the system-fallback flash.
 */
export async function waitForFonts(timeoutMs = 15000): Promise<void> {
  await browser.waitUntil(
    async () => browser.execute(() => document.fonts.status === 'loaded'),
    {
      timeout: timeoutMs,
      interval: 200,
      timeoutMsg: `web fonts did not reach status=loaded within ${timeoutMs}ms`,
    },
  );
}

/**
 * Inject (or replace) the ui-lab override <style> tag at the END of <head>, so
 * its rules win over the bundled stylesheet at equal specificity. This is the
 * FAST-PREVIEW seam: token/value changes show up without repackaging.
 *
 * Limitation (documented in README): rules DELETED from the source CSS still
 * apply from the bundled sheet underneath — injection previews additions and
 * value changes only. The final proof capture must be a packaged run with no
 * injection.
 */
export async function applyCssOverride(css: string): Promise<void> {
  await browser.execute((text: string) => {
    document.getElementById('ui-lab-override')?.remove();
    const style = document.createElement('style');
    style.id = 'ui-lab-override';
    style.textContent = text;
    document.head.appendChild(style);
  }, css);
}

export interface OverrideResolution {
  css: string;
  sources: string[];
}

/**
 * Resolve the override CSS from the environment:
 *  - UI_LAB_LIVE_CSS=1               → current repo tokens.css + terminal.css
 *  - UI_LAB_OVERRIDE_CSS_FILE=<path> → an arbitrary extra stylesheet, appended last
 * Returns null when neither is set (clean packaged capture — the proof mode).
 */
export function resolveOverrideCss(): OverrideResolution | null {
  const sources: string[] = [];
  let css = '';
  if (process.env.UI_LAB_LIVE_CSS === '1') {
    for (const rel of ['src/renderer/tokens.css', 'src/renderer/terminal.css']) {
      css += `${fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')}\n`;
      sources.push(rel);
    }
  }
  const overrideFile = process.env.UI_LAB_OVERRIDE_CSS_FILE;
  if (overrideFile) {
    css += fs.readFileSync(path.resolve(overrideFile), 'utf8');
    sources.push(overrideFile);
  }
  return sources.length > 0 ? { css, sources } : null;
}

/** Screenshot the app window into the run dir; returns the absolute png path. */
export async function shoot(surfaceId: string): Promise<string> {
  const file = path.join(OUT_DIR, `${surfaceId}.png`);
  await browser.saveScreenshot(file);
  return file;
}

/** Short git sha of the working tree the capture ran against. */
export function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Write the run manifest — the single file an evaluating agent reads first.
 * Contains run metadata (tag, sha, overrides, window size) + per-surface records.
 */
export function writeManifest(
  records: CaptureRecord[],
  meta: Record<string, unknown>,
): string {
  const file = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(file, `${JSON.stringify({ ...meta, surfaces: records }, null, 2)}\n`);
  return file;
}
