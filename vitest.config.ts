import { defineConfig } from 'vitest/config';

// Guard tests run in Node environment — no Electron process required
// https://vitest.dev/guide/environment
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.guard.test.ts'],
    exclude: ['tests/smoke/**'], // WDIO smoke tests run separately via npm run test:smoke
  },
});
