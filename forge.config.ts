import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';

const config: ForgeConfig = {
  packagerConfig: {
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
    new MakerSquirrel({}),
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
