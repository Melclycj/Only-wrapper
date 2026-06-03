// Typed contextBridge surface — no runtime imports (pure types only)
// This file is importable in renderer without leaking any electron/node APIs into the renderer bundle
// Source: RESEARCH Pattern 3

export type ElectronAPI = {
  getVersion: () => Promise<string>;
};

// Window augmentation — import this in renderer entry point
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
