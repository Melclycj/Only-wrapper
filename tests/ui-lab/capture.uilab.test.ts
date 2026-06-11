// ui-lab capture spec — walks the surface registry in order, screenshots each
// surface, and writes the machine-readable run manifest.
//
// One mocha `it` per surface so a single broken surface fails loudly WITHOUT
// aborting the rest of the run (mocha continues across failed its) — an
// evaluating agent still gets a partial manifest + the other screenshots.
//
// Protocol + invariants: tests/ui-lab/README.md

/// <reference types="@wdio/globals/types" />
/// <reference types="@wdio/electron-service" />

import { resizeWindow } from '../smoke/helpers/xterm-driver';
import {
  type CaptureRecord,
  RUN_TAG,
  OUT_DIR,
  ensureOutDir,
  waitForFonts,
  applyCssOverride,
  resolveOverrideCss,
  shoot,
  gitSha,
  writeManifest,
} from './helpers';
import { SURFACES, SkipSurface, type SurfaceContext } from './surfaces';
import { appBinaryPath } from '../../wdio.conf';

const WINDOW = { width: 1280, height: 800 };

describe(`ui-lab visual capture (tag: ${RUN_TAG})`, () => {
  const records: CaptureRecord[] = [];
  const ctx: SurfaceContext = { ids: [] };
  const override = resolveOverrideCss();

  before(async () => {
    ensureOutDir();
    await resizeWindow(WINDOW.width, WINDOW.height);
    await waitForFonts();
    if (override) {
      await applyCssOverride(override.css);
    }
    await browser.pause(400);
  });

  for (const surface of SURFACES) {
    it(`captures ${surface.id}`, async () => {
      try {
        if (surface.available) {
          const check = await surface.available(ctx);
          if (!check.ok) {
            records.push({
              id: surface.id,
              title: surface.title,
              status: 'skipped',
              reason: check.reason,
              designRefs: surface.designRefs,
              expects: surface.expects,
            });
            return;
          }
        }
        await surface.prepare(ctx);
        const file = await shoot(surface.id);
        records.push({
          id: surface.id,
          title: surface.title,
          status: 'captured',
          file,
          designRefs: surface.designRefs,
          expects: surface.expects,
        });
      } catch (error: unknown) {
        if (error instanceof SkipSurface) {
          records.push({
            id: surface.id,
            title: surface.title,
            status: 'skipped',
            reason: error.message,
            designRefs: surface.designRefs,
            expects: surface.expects,
          });
          return;
        }
        records.push({
          id: surface.id,
          title: surface.title,
          status: 'error',
          reason: error instanceof Error ? error.message : String(error),
          designRefs: surface.designRefs,
          expects: surface.expects,
        });
        throw error;
      } finally {
        // Best-effort neutral-state restore so one broken surface does not
        // poison the next one's preconditions.
        await surface.cleanup?.(ctx).catch(() => undefined);
      }
    });
  }

  after(async () => {
    const manifest = writeManifest(records, {
      tag: RUN_TAG,
      capturedAt: new Date().toISOString(),
      gitSha: gitSha(),
      binary: appBinaryPath,
      window: WINDOW,
      cssOverride: override ? { sources: override.sources } : null,
      outDir: OUT_DIR,
      rubric: 'tests/ui-lab/DESIGN-RUBRIC.md',
      designAuthority: '.planning/DESIGN.md',
    });
    // The manifest path is the one line an agent needs from the runner output.
    console.log(`\n[ui-lab] manifest: ${manifest}\n`);
  });
});
