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
      external: ['electron', 'node-pty'], // node-pty external even before Phase 2 installs it
    },
  },
});
