import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  ElectronAPI,
  PtyCreateOptions,
  PtyCreateResult,
  PtyStatusPayload,
} from '../shared/api-types';
import type {
  LogicalId,
  SessionRecord,
  SessionIconSpec,
} from '../shared/types';
import type { SwitchIntent } from '../main/switch-keys';
import type { DiscoveredShell } from '../main/shell-discovery';

// The ONLY renderer↔main bridge (SC3, D-06, T-1-04)
// Renderer accesses main process ONLY via window.api — never raw ipcRenderer
//
// sandbox:true restricts this preload to: contextBridge, ipcRenderer only.
// No fs / child_process / npm modules are accessible here (T-1-05, RESEARCH Pitfall 3).
// Do NOT use __dirname here (sandbox context — RESEARCH Anti-Patterns).
//
// 02-02 expansion: the 7 PTY methods join getVersion. The surface is mirrored in
// EXPECTED_API_KEYS (window-config.ts) and asserted by security.guard.test.ts —
// raw ipcRenderer is never exposed (only these narrow typed methods cross).
//
// 03-02 expansion: the 4 lifecycle methods (ptyStop, ptyRestart, onPtyStatus,
// listSessions) — whose CONTRACT was widened in 03-01 — are now wired here as
// real preload implementations mirroring the existing PTY methods (ptyStop ⟵
// ptyPause fire-and-forget; ptyRestart/listSessions ⟵ ptyCreate invoke;
// onPtyStatus ⟵ onPtyData id-filtered subscribe/unsubscribe). The object is once
// again annotated with the FULL `ElectronAPI`, so the surface is the 12-key set
// mirrored in EXPECTED_API_KEYS (window-config.ts). security.guard.test.ts —
// which asserts the exposed keys === EXPECTED_API_KEYS and never leaks raw
// ipcRenderer — now goes GREEN (it was the intended-RED 12-vs-8 failure in 03-01).
const api: ElectronAPI = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('api:get-version'),

  // ─── PTY surface (02-02) ────────────────────────────────────────────────────

  ptyCreate: (opts: PtyCreateOptions): Promise<PtyCreateResult> =>
    ipcRenderer.invoke('pty:create', opts),

  ptyWrite: (id: LogicalId, data: string): void => {
    ipcRenderer.send('pty:write', id, data);
  },

  ptyResize: (id: LogicalId, cols: number, rows: number): void => {
    ipcRenderer.send('pty:resize', id, cols, rows);
  },

  ptyPause: (id: LogicalId): void => {
    ipcRenderer.send('pty:pause', id);
  },

  ptyResume: (id: LogicalId): void => {
    ipcRenderer.send('pty:resume', id);
  },

  // onPtyData/onPtyExit filter by `id` so a session only sees its own stream,
  // and return an unsubscribe fn so the renderer can clean up listeners on unmount.
  onPtyData: (id: LogicalId, cb: (data: string) => void): (() => void) => {
    const listener = (
      _event: IpcRendererEvent,
      payload: { id: LogicalId; data: string },
    ): void => {
      if (payload.id === id) cb(payload.data);
    };
    ipcRenderer.on('pty:data', listener);
    return () => ipcRenderer.removeListener('pty:data', listener);
  },

  onPtyExit: (id: LogicalId, cb: (exitCode: number) => void): (() => void) => {
    const listener = (
      _event: IpcRendererEvent,
      payload: { id: LogicalId; exitCode: number },
    ): void => {
      if (payload.id === id) cb(payload.exitCode);
    };
    ipcRenderer.on('pty:exit', listener);
    return () => ipcRenderer.removeListener('pty:exit', listener);
  },

  // ─── Lifecycle surface (03-02 wiring of the 03-01 contract) ──────────────────

  // ptyStop mirrors ptyPause: fire-and-forget send; main runs the platform-aware
  // graceful kill and KEEPS the SessionRecord (status → 'stopped') for restart.
  ptyStop: (id: LogicalId): void => {
    ipcRenderer.send('pty:stop', id);
  },

  // ptyClose mirrors ptyStop: fire-and-forget send (D-03a, 13th key). Main kills
  // the PTY AND removes the SessionRecord (close+remove) — the row does not survive.
  ptyClose: (id: LogicalId): void => {
    ipcRenderer.send('pty:close', id);
  },

  // ptyRestart mirrors ptyCreate: request-response invoke. Main orchestrates
  // stop→await-exit→create-with-same-id, returning the new {id, ptyPid} (same
  // logicalId, new ptyPid — IDENT-02).
  ptyRestart: (id: LogicalId): Promise<PtyCreateResult> =>
    ipcRenderer.invoke('pty:restart', id),

  // listSessions mirrors ptyCreate: request-response invoke. Main is the source
  // of truth for the current session snapshot (initial render / after add).
  listSessions: (): Promise<SessionRecord[]> => ipcRenderer.invoke('pty:list'),

  // onPtyStatus is a VERBATIM structural copy of onPtyData: id-filtered subscribe
  // that returns an unsubscribe fn. Only the payload shape differs (status, not data).
  onPtyStatus: (
    id: LogicalId,
    cb: (p: PtyStatusPayload) => void,
  ): (() => void) => {
    const listener = (
      _event: IpcRendererEvent,
      payload: PtyStatusPayload,
    ): void => {
      if (payload.id === id) cb(payload);
    };
    ipcRenderer.on('pty:status', listener);
    return () => ipcRenderer.removeListener('pty:status', listener);
  },

  // ─── Identity surface (04-01) ────────────────────────────────────────────────

  // ptyUpdateProfile mirrors ptyClose: fire-and-forget send (the 14th key). Main
  // id-validates + type-guards each field before writing to the record; the
  // renderer never reaches the record store except through this narrow method.
  ptyUpdateProfile: (
    id: LogicalId,
    fields: {
      name?: string;
      icon?: SessionIconSpec;
      cwd?: string;
      shell?: string;
      startupCommand?: string;
    },
  ): void => {
    ipcRenderer.send('pty:update-profile', id, fields);
  },

  // onSwitchSession is a VERBATIM structural copy of onPtyStatus (the 15th key):
  // subscribe to the main→renderer 'session:switch' event, returning an unsubscribe
  // fn. No id filter — switch intents are app-level (the active session changes).
  onSwitchSession: (cb: (intent: SwitchIntent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, intent: SwitchIntent): void => {
      cb(intent);
    };
    ipcRenderer.on('session:switch', listener);
    return () => ipcRenderer.removeListener('session:switch', listener);
  },

  // ─── Persistence + discovery surface (05-01) ─────────────────────────────────

  // discoverShells mirrors listSessions: request-response invoke. Main runs the
  // platform shell discovery (filesystem read confined to main) and returns the
  // dropdown list — the renderer never touches fs (the 16th key).
  discoverShells: (): Promise<DiscoveredShell[]> =>
    ipcRenderer.invoke('shell:discover'),

  // persistOrder mirrors ptyUpdateProfile: fire-and-forget send (the 17th key).
  // Main VALIDATES the payload before any write (T-05-01) — the renderer never
  // reaches the store except through this narrow, main-validated method.
  persistOrder: (orders: { id: LogicalId; order: number }[]): void => {
    ipcRenderer.send('store:persist-order', orders);
  },

  // persistUiState mirrors ptyUpdateProfile: fire-and-forget send (the 18th key).
  // Main VALIDATES collapse/bounds/scrollback before any write (T-05-01/T-07-01).
  // 07-01: the payload is WIDENED with scrollback — SAME key, no new bridge key.
  persistUiState: (ui: {
    collapsed?: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
    scrollback?: number;
  }): void => {
    ipcRenderer.send('store:persist-ui', ui);
  },

  // ─── Folder picker (06-01) ────────────────────────────────────────────────────

  // pickDirectory mirrors discoverShells: request-response invoke (the 19th key). main
  // owns the native open-directory dialog and returns ONLY a string path (or null on
  // cancel) — the renderer never touches the filesystem (V12/T-06-01). The renderer
  // must NEVER reach raw ipcRenderer (the header no-raw-ipcRenderer contract holds).
  pickDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pick-directory'),

  // ─── UI-state boot read (07-01) ───────────────────────────────────────────────

  // getUiState mirrors pickDirectory: request-response invoke (the 20th key). main is
  // the source of truth and returns ONLY the already-validated UI prefs (collapse +
  // bounds + clamped scrollback) for the renderer's boot-read seed of the terminal
  // scrollback. READ-ONLY — it carries no fs handle and never reaches raw ipcRenderer.
  getUiState: (): Promise<{
    collapsed?: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
    scrollback?: number;
  }> => ipcRenderer.invoke('pty:get-ui-state'),
};

contextBridge.exposeInMainWorld('api', api);
