import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { ElectronAPI, PtyCreateOptions, PtyCreateResult } from '../shared/api-types';
import type { LogicalId } from '../shared/types';

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
// 03-01 NOTE: the ElectronAPI contract gained 4 lifecycle methods (ptyStop,
// ptyRestart, onPtyStatus, listSessions) this plan, but their PRELOAD WIRING is
// 03-02 scope (03-02 Task 1). Until then this object exposes the Phase-2 subset,
// so it is annotated `Omit<ElectronAPI, …the 4 new keys>` to stay tsc-clean
// WITHOUT prematurely wiring (or fake-stubbing) the new methods. 03-02 restores
// the full `ElectronAPI` annotation when it adds the real implementations — at
// which point security.guard.test.ts (which asserts the exposed surface equals
// the 12-key EXPECTED_API_KEYS) goes GREEN. It is intentionally RED in 03-01.
const api: Omit<
  ElectronAPI,
  'ptyStop' | 'ptyRestart' | 'onPtyStatus' | 'listSessions'
> = {
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
};

contextBridge.exposeInMainWorld('api', api);
