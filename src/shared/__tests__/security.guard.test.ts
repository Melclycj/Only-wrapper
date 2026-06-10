// Security guard — covers SC3 and D-07 (threats T-1-01, T-1-04).
// Two layers of REAL coverage:
//   1. buildWebPreferences() returns the locked-down webPreferences (D-07).
//   2. The ACTUAL preload (src/preload/index.ts) is imported with 'electron' mocked,
//      and we assert the contextBridge surface it registers is EXACTLY EXPECTED_API_KEYS.
//      => Adding ipcRenderer or any extra key to the real preload fails this test (CR-01).
//
// window-config.ts is electron-free, so it imports directly in the Node/Vitest env.
// The preload imports 'electron'; we mock it (vi.hoisted spy must exist before the
// hoisted vi.mock factory runs) and import the preload for its exposeInMainWorld side effect.

import { describe, it, expect, vi } from 'vitest';
import { buildWebPreferences, EXPECTED_API_KEYS } from '../../main/window-config';

const { exposeInMainWorld, invoke } = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke },
}));

// Side-effect import: executes contextBridge.exposeInMainWorld('api', api) once at load.
import '../../preload/index';

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
});

describe('preload contextBridge surface (SC3 — asserts the REAL preload)', () => {
  it('registers exactly one bridge, named "api"', () => {
    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(exposeInMainWorld.mock.calls[0][0]).toBe('api');
  });

  it('exposes exactly EXPECTED_API_KEYS — no ipcRenderer or extra keys leak through', () => {
    const exposed = exposeInMainWorld.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(exposed).sort()).toEqual([...EXPECTED_API_KEYS].sort());
    expect(exposed).not.toHaveProperty('ipcRenderer');
  });
});
