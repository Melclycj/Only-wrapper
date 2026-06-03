import { defineConfig } from 'vite';

// Preload process — must be CJS (sandboxed preload; RESEARCH Q8)
// https://www.electronforge.io/config/plugins/vite
export default defineConfig({
  build: {
    // Main process loads `../preload/index.js` relative to .vite/build, i.e.
    // .vite/preload/index.js — emit there instead of the default .vite/build.
    outDir: '.vite/preload',
    emptyOutDir: true,
    lib: {
      entry: 'src/preload/index.ts',
      fileName: () => 'index.js',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron'],
    },
  },
});
