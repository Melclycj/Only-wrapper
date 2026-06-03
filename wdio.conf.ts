/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

// Boot smoke test harness using @wdio/electron-service (D-09)
// @wdio/electron-service auto-detects Electron Forge output paths at out/{appName}-{OS}-{arch}
// https://webdriver.io/docs/desktop-testing/electron/
// WebdriverIO.Config (vs Options.Testrunner) is the service-augmented config
// type that includes `capabilities` and `wdio:electronServiceOptions`.
export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./tests/smoke/**/*.smoke.test.ts'],
  maxInstances: 1,
  // The `electron` service requires at least one capability declaring
  // browserName: 'electron'. Forge auto-detection scans ./out, but Forge
  // names the bundle after productName ("Just-Wrapper"), so we pin
  // appBinaryPath explicitly to make the smoke run deterministic across
  // platforms/arches.
  capabilities: [
    {
      browserName: 'electron',
      'wdio:electronServiceOptions': {
        appBinaryPath:
          './out/Just-Wrapper-darwin-arm64/Just-Wrapper.app/Contents/MacOS/Just-Wrapper',
      },
    },
  ],
  services: ['electron'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    timeout: 30000,
  },
};
