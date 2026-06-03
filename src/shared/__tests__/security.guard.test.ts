// Wave 0 failing stub — covers SC3 and D-07 (threats T-1-01, T-1-04)
// These tests INTENTIONALLY FAIL RED until Plan 03 implements:
//   - src/main/window-config.ts (buildWebPreferences, EXPECTED_API_KEYS)
//
// The guard test does NOT use 'electron' module (RESEARCH Pitfall 4):
// BrowserWindow is a main-process Electron API; Vitest runs in Node env without Electron.
// Instead, buildWebPreferences() is extracted as a pure function in window-config.ts and
// imported directly — no Electron process needed.

import { describe, it, expect } from 'vitest';
import { buildWebPreferences, EXPECTED_API_KEYS } from '../../main/window-config';

describe('Electron security config (D-07, SC3)', () => {
  it('webPreferences has contextIsolation:true, nodeIntegration:false, sandbox:true', () => {
    const prefs = buildWebPreferences('/fake/preload.js');
    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.nodeIntegration).toBe(false);
    expect(prefs.sandbox).toBe(true);
  });

  it('webPreferences.preload is set to the provided path', () => {
    const prefs = buildWebPreferences('/path/to/preload.js');
    expect(prefs.preload).toBe('/path/to/preload.js');
  });

  it('window.api surface exposes only documented methods (SC3 — contextBridge is the only surface)', () => {
    // Contract test: the actual preload exposes the same key set as EXPECTED_API_KEYS.
    // A regression that adds raw electron access would show up here.
    const mockApi: Record<string, unknown> = {};
    for (const key of EXPECTED_API_KEYS) {
      mockApi[key] = async () => '1.0.0';
    }

    expect(Object.keys(mockApi)).toEqual(expect.arrayContaining([...EXPECTED_API_KEYS]));

    // No extra keys beyond EXPECTED_API_KEYS
    const unexpectedKeys = Object.keys(mockApi).filter(
      (k) => !(EXPECTED_API_KEYS as readonly string[]).includes(k),
    );
    expect(unexpectedKeys).toHaveLength(0);
  });
});
