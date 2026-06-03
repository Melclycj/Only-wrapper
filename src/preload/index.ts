import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/api-types';

// The ONLY renderer↔main bridge (SC3, D-06, T-1-04)
// Renderer accesses main process ONLY via window.api — never raw ipcRenderer
//
// sandbox:true restricts this preload to: contextBridge, ipcRenderer only.
// No fs / child_process / npm modules are accessible here (T-1-05, RESEARCH Pitfall 3).
// Do NOT use __dirname here (sandbox context — RESEARCH Anti-Patterns).
const api: ElectronAPI = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('api:get-version'),
};

contextBridge.exposeInMainWorld('api', api);
