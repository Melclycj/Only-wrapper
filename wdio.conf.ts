import type { Options } from '@wdio/types';

// Boot smoke test harness using @wdio/electron-service (D-09)
// @wdio/electron-service auto-detects Electron Forge output paths at out/{appName}-{OS}-{arch}
// https://webdriver.io/docs/desktop-testing/electron/
export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./tests/smoke/**/*.smoke.test.ts'],
  maxInstances: 1,
  services: [
    [
      'electron',
      {
        // Electron Forge auto-detection: out/just-wrapper-darwin-arm64/Just-Wrapper.app etc.
        // appEntryPoint only needed if auto-detection fails:
        // appEntryPoint: '.vite/build/main.js',
      },
    ],
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    timeout: 30000,
  },
};
