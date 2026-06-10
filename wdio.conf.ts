/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

// Boot smoke test harness using @wdio/electron-service (D-09)
// @wdio/electron-service auto-detects Electron Forge output paths at out/{appName}-{OS}-{arch}
// https://webdriver.io/docs/desktop-testing/electron/
// WebdriverIO.Config (vs Options.Testrunner) is the service-augmented config
// type that includes `capabilities` and `wdio:electronServiceOptions`.
import os from 'node:os';

// OS-conditional packaged-binary path (D-08). Forge names the output dir
// out/Just-Wrapper-<platform>-<arch>; the macOS bundle nests the executable at
// .app/Contents/MacOS/Just-Wrapper while Windows is a bare Just-Wrapper.exe. The
// Windows leg is consumed by the CI matrix (Plan 03); macOS runs locally.
const appBinaryPath =
  process.platform === 'win32'
    ? `./out/Just-Wrapper-win32-${os.arch()}/Just-Wrapper.exe`
    : `./out/Just-Wrapper-darwin-${os.arch()}/Just-Wrapper.app/Contents/MacOS/Just-Wrapper`;

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./tests/smoke/**/*.smoke.test.ts'],
  maxInstances: 1,
  // The `electron` service requires at least one capability declaring
  // browserName: 'electron'. Forge auto-detection scans ./out, but Forge
  // names the bundle after productName ("Just-Wrapper"), so we pin
  // appBinaryPath explicitly to make the smoke run deterministic across
  // platforms/arches (now OS-conditional — D-08).
  capabilities: [
    {
      browserName: 'electron',
      'wdio:electronServiceOptions': {
        appBinaryPath,
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
