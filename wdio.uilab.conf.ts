/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

// ui-lab visual-capture harness config.
//
// Boots the SAME packaged binary as the smoke suite (appBinaryPath re-exported
// from wdio.conf.ts) but against an ISOLATED, disposable userData directory via
// the JW_USER_DATA_DIR seam in src/main/index.ts. This guarantees:
//   1. deterministic surfaces (fresh boot = welcome empty-state, no real sessions)
//   2. zero risk to the developer's real session store — safe to run while a
//      dev instance (`npm start`) is open
//
// Run: npm run ui:shots          (requires a prior `npm run package`)
//      npm run ui:shots:fresh    (package + capture)
// Env: UI_LAB_TAG=<name>               output to artifacts/ui-lab/<name>/ (default: current)
//      UI_LAB_LIVE_CSS=1               inject repo tokens.css+terminal.css over the bundled CSS
//      UI_LAB_OVERRIDE_CSS_FILE=<path> inject an arbitrary extra stylesheet (e.g. SC3 demo)
// Protocol + invariants: tests/ui-lab/README.md
import fs from 'node:fs';
import path from 'node:path';
import { appBinaryPath } from './wdio.conf';

// Absolute path required by app.setPath('userData', ...). Lives under the
// gitignored artifacts/ tree; wiped fresh in onPrepare so every run boots clean.
const USER_DATA_DIR = path.resolve(process.cwd(), 'artifacts', 'ui-lab', '.userdata');
process.env.JW_USER_DATA_DIR = USER_DATA_DIR;

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./tests/ui-lab/**/*.uilab.test.ts'],
  maxInstances: 1,
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
  // A freshly-packaged unsigned .app can stall 60-90s on FIRST launch while
  // macOS Gatekeeper assesses the bundle — longer than the default ~60s session
  // timeout. Tolerate the cold start instead of failing the run.
  connectionRetryTimeout: 180000,
  connectionRetryCount: 2,
  mochaOpts: {
    // Captures build multi-session state (spawn PTYs, run commands, wait for
    // status transitions) — far slower than a single smoke assertion.
    timeout: 180000,
  },
  onPrepare: () => {
    // Fresh disposable store every run → empty-state surface is reproducible.
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  },
};
