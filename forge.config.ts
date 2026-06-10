import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';

const config: ForgeConfig = {
  packagerConfig: {
    // App identity + icon pipeline (D-07). `icon` carries NO extension — Forge
    // appends `.icns` on macOS and `.ico` on Windows automatically, resolving
    // assets/icon.icns / assets/icon.ico (placeholder art, swap-by-file later).
    name: 'Just-Wrapper',
    appBundleId: 'com.justwrapper.app',
    icon: 'assets/icon',
    // macOS signing / notarization slots (D-04). UNSIGNED by default: with no
    // APPLE_* env present both resolve to `undefined`, so Forge ships an
    // unsigned .app and skips notarization cleanly. Enabling real signing later
    // is a config-FREE flip — set the env vars in CI/locally; NEVER commit a
    // credential (all values read from process.env). `osxSign: {}` means "sign
    // with the default identity" when an identity env var is present.
    osxSign: process.env.APPLE_IDENTITY ? {} : undefined,
    // Guard all three notarize vars together: if APPLE_ID is set but either
    // companion is missing, fail FAST with a clear message instead of passing
    // `undefined` into Forge and surfacing an opaque "invalid credentials" error
    // deep in the notarization step (WR-01). No env → undefined → unsigned, clean.
    osxNotarize: ((): { appleId: string; appleIdPassword: string; teamId: string } | undefined => {
      const { APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID } = process.env;
      if (!APPLE_ID) return undefined;
      if (!APPLE_PASSWORD || !APPLE_TEAM_ID) {
        throw new Error(
          'osxNotarize: APPLE_ID is set but APPLE_PASSWORD and/or APPLE_TEAM_ID is missing. ' +
            'Set all three for notarization, or none for an unsigned build.',
        );
      }
      return { appleId: APPLE_ID, appleIdPassword: APPLE_PASSWORD, teamId: APPLE_TEAM_ID };
    })(),
    // node-pty's prebuilt .node binaries cannot be loaded from inside the ASAR
    // archive (CLAUDE.md "Loading .node native files from inside ASAR"; Pitfall 4).
    // unpack them so they land in app.asar.unpacked/ on the read-only resources dir.
    asar: {
      unpackDir: '**/node_modules/node-pty/**',
    },
    // The Vite plugin defaults packagerConfig.ignore to "exclude everything
    // except /.vite", which prunes ALL of node_modules — including node-pty,
    // a NATIVE module the main bundle require()s as an external (it cannot be
    // bundled). Without it the packaged app throws MODULE_NOT_FOUND for
    // 'node-pty' at startup. We override ignore to keep /.vite AND node-pty
    // (its prebuilds carry the platform .node binaries loaded via node-gyp-build).
    ignore: (file: string): boolean => {
      if (!file) return false; // keep the app root
      if (file.startsWith('/.vite')) return false; // Vite build output
      // Keep the node-pty package (and the path segments leading to it).
      if (
        file === '/node_modules' ||
        file === '/node_modules/node-pty' ||
        file.startsWith('/node_modules/node-pty/')
      ) {
        return false;
      }
      // Keep lowdb + its steno dependency (05-01, Pitfall 2). lowdb is marked
      // `external` in vite.main.config.ts so it is NOT bundled into /.vite — without
      // this keep-clause the packaged app would throw MODULE_NOT_FOUND lowdb at
      // runtime (surfaces at Phase 8 packaging). Mirrors the node-pty keep-clause.
      if (
        file === '/node_modules/lowdb' ||
        file.startsWith('/node_modules/lowdb/') ||
        file === '/node_modules/steno' ||
        file.startsWith('/node_modules/steno/')
      ) {
        return false;
      }
      return true; // prune everything else (matches the Vite plugin default)
    },
  },
  // node-pty 1.1.0 is an N-API addon: its prebuilt `prebuilds/<plat>-<arch>/pty.node`
  // is ABI-stable and loads under Electron 36 WITHOUT a from-source recompile
  // (verified in 02-01; see scripts/fix-node-pty.cjs). Forge's default packaging
  // rebuild invokes @electron/rebuild → node-gyp, which must download Electron
  // headers from the network and HARD-FAILS offline/firewalled (ECONNRESET).
  // `onlyModules: []` makes the packaging rebuild a no-op so we ship the prebuild.
  rebuildConfig: {
    onlyModules: [],
  },
  makers: [
    // Windows Setup.exe icon (D-07) — a REAL multi-size .ico, not a renamed PNG.
    // `windowsSign` is intentionally UNSET: a stray cert config makes Squirrel
    // invoke signtool and hang CI (Pitfall 4); unsigned is the D-04 lock.
    new MakerSquirrel({ setupIcon: 'assets/icon.ico' }),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({}),
    new MakerRpm({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}), // essential once node-pty arrives in Phase 2
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
        { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
      ],
    }),
  ],
};

export default config;
