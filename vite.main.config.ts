import { defineConfig } from 'vite';

// Main process — must be CJS so node-pty can require() in Phase 2 (RESEARCH Q8)
// https://www.electronforge.io/config/plugins/vite
export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron', 'node-pty'], // node-pty external even before Phase 2 installs it
    },
  },
});
