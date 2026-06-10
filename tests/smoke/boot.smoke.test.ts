// Wave 0 boot smoke test stub — covers SC1
// Boots the actual Electron app via @wdio/electron-service and asserts:
//   1. The window opened (getTitle() returns a truthy value)
//   2. No SEVERE console errors at startup (no nodeIntegration/contextIsolation/preload errors)
//
// Run separately from unit tests: npm run test:smoke (wdio run wdio.conf.ts)
// This test is intentionally FAILING RED until Plan 03 wires the full walking skeleton.

describe('Boot smoke test (SC1, D-09)', () => {
  it('app window appears with a title', async () => {
    // @wdio/electron-service boots the Electron app and provides `browser` as the Electron window
    const title = await browser.getTitle();
    // Window must have opened — any truthy title is acceptable
    expect(title).toBeTruthy();
  });

  it('no SEVERE console errors on startup (no nodeIntegration/contextIsolation/preload errors)', async () => {
    // Retrieve browser console logs and filter for SEVERE (error) level entries
    const logs = await browser.getLogs('browser');
    const errors = logs.filter((l: { level: string }) => l.level === 'SEVERE');
    expect(errors).toHaveLength(0);
  });
});
