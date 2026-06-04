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
 *
 * Phase 3 (03-01) REVIEWED EXPANSION (threat_model T-03-06): the 4 lifecycle methods
 * (ptyStop, ptyRestart, onPtyStatus, listSessions) join the surface — a 12-key set.
 * The contextBridge is the dominant new threat surface this phase; the guard is the
 * reviewed tripwire that fails if any unreviewed key (e.g. raw ipcRenderer) leaks.
 * NOTE: this plan (03-01) updates the EXPECTED contract + the type surface only; the
 * actual preload wiring lands in 03-02, at which point security.guard.test.ts goes
 * GREEN again (it asserts preload-keys === EXPECTED_API_KEYS exactly).
 *
 * Phase 3 (03-03 gap-closure) REVIEWED EXPANSION (D-03a): the destructive `ptyClose`
 * method (kill PTY + remove the SessionRecord) joins the surface — a 13-key set. It
 * mirrors ptyStop's fire-and-forget shape; the guard test enforces the EXACT 13-key
 * set so no unreviewed key leaks. ptyStop is RETAINED ("keep the function, disable
 * the button") so both remain in the contract.
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
  'ptyStop',
  'ptyClose',
  'ptyRestart',
  'onPtyStatus',
  'listSessions',
] as const;
