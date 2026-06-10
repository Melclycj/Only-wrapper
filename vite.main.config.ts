import { defineConfig } from 'vite';

// Main process — must be CJS so node-pty can require() in Phase 2 (RESEARCH Q8)
// https://www.electronforge.io/config/plugins/vite
export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/index.ts',
      // package.json "main" expects .vite/build/main.js — force that output
      // filename. (Default Vite lib naming would derive it from the package
      // name, which Forge's packager cannot find.)
      fileName: () => 'main.js',
      formats: ['cjs'],
    },
    rollupOptions: {
      // node-pty external even before Phase 2 installs it.
      // lowdb (05-01, Pitfall 1): lowdb@7 is pure ESM with NO CJS entry. Marking it
      // external keeps the dynamic `import('lowdb')` in SessionStore (Plan 05-02)
      // resolving the real ESM package at runtime instead of being bundled/down-leveled
      // to require() → ERR_REQUIRE_ESM. Mirrors exactly how node-pty is treated.
      external: ['electron', 'node-pty', 'lowdb'],
    },
  },
});
