import { contextBridge, ipcRenderer } from 'electron';

// The only renderer↔main bridge (SC3)
// Renderer accesses main process only via window.api — never raw ipcRenderer
const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('api:get-version'),
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
