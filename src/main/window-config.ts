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
 *
 * Phase 2 (02-02) REVIEWED EXPANSION (threat_model T-02-07): the 7 PTY methods are
 * added to the Phase-1 'getVersion'-only surface. This DELIBERATELY loosens the
 * Phase-1 invariant, but the security guard test still enforces the EXACT new set —
 * so no UNREVIEWED key (e.g. raw ipcRenderer) can leak through. The locked
 * webPreferences (contextIsolation/sandbox/nodeIntegration) are NOT touched.
 */
export const EXPECTED_API_KEYS = [
  'getVersion',
  'ptyCreate',
  'ptyWrite',
  'ptyResize',
  'ptyPause',
  'ptyResume',
  'onPtyData',
  'onPtyExit',
] as const;
