import { defineConfig } from 'vite';

// Renderer process — ESM output (default Vite/React config)
// https://www.electronforge.io/config/plugins/vite
export default defineConfig({
  // Renderer sources (incl. index.html entry + the `/index.tsx` script the
  // HTML references) live under src/renderer/, so point Vite's root there.
  root: 'src/renderer',
  build: {
    // Vite resolves outDir relative to `root` (src/renderer). Forge injects
    // '.vite/renderer/main_window', which would land under src/renderer/ and
    // never get packaged. Climb back to the repo-root .vite/renderer/main_window
    // so electron-forge bundles it (main loads ../renderer/main_window/index.html).
    outDir: '../../.vite/renderer/main_window',
    emptyOutDir: true,
  },
  resolve: {
    // Ensure React JSX runtime resolves correctly
    mainFields: ['browser', 'module', 'main'],
  },
});
