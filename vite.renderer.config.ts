import { defineConfig } from 'vite';

// Renderer process — ESM output (default Vite/React config)
// https://www.electronforge.io/config/plugins/vite
export default defineConfig({
  resolve: {
    // Ensure React JSX runtime resolves correctly
    mainFields: ['browser', 'module', 'main'],
  },
});
