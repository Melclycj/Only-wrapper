import { defineConfig } from 'vite';

// Preload process — must be CJS (sandboxed preload; RESEARCH Q8)
// https://www.electronforge.io/config/plugins/vite
export default defineConfig({
  build: {
    lib: {
      entry: 'src/preload/index.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron'],
    },
  },
});
