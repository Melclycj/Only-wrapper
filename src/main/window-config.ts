// Pure factory — NO import from 'electron'.
// Keeping this file electron-free lets Vitest (Node env) import it directly
// without an Electron process, so the security guard test can run standalone.
// RESEARCH Pitfall 4 / D-07 invariant.

export interface WebPreferencesConfig {
  contextIsolation: boolean;
  nodeIntegration: boolean;
  sandbox: boolean;
  preload: string;
}

/**
 * Returns the secure webPreferences object for BrowserWindow creation.
 * D-07 invariant: contextIsolation:true, nodeIntegration:false, sandbox:true.
 * The preload path is injected as a parameter so the factory stays pure and testable.
 */
export function buildWebPreferences(preloadPath: string): WebPreferencesConfig {
  return {
    contextIsolation: true,   // REQUIRED — isolates renderer from main context
    nodeIntegration: false,   // REQUIRED — no Node.js in renderer
    sandbox: true,            // REQUIRED — restricts preload to whitelisted modules
    preload: preloadPath,
  };
}

/**
 * The exhaustive list of method keys exposed via contextBridge.exposeInMainWorld('api', ...).
 * The security guard test asserts the actual preload surface matches this contract (SC3).
 * Only 'getVersion' is permitted in Phase 1.
 */
export const EXPECTED_API_KEYS = ['getVersion'] as const;
