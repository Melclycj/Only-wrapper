import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  ElectronAPI,
  PtyCreateOptions,
  PtyCreateResult,
  PtyStatusPayload,
} from '../shared/api-types';
import type { LogicalId, SessionRecord } from '../shared/types';

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
};

contextBridge.exposeInMainWorld('api', api);
