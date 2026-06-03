import { defineConfig } from 'vite';

// Renderer process — ESM output (default Vite/React config)
// https://www.electronforge.io/config/plugins/vite
export default defineConfig({
  // Renderer sources (incl. index.html entry) live under src/renderer/.
  // Forge's Vite plugin resolves the HTML entry relative to this root.
  root: 'src/renderer',
  resolve: {
    // Ensure React JSX runtime resolves correctly
    mainFields: ['browser', 'module', 'main'],
  },
});
