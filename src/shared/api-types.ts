// Typed contextBridge surface — no runtime imports (pure types only)
// This file is importable in renderer without leaking any electron/node APIs into the renderer bundle
// Source: RESEARCH Pattern 3
//
// type-only import: LogicalId is a branded compile-time type with zero runtime
// footprint, so importing it here keeps api-types renderer-safe (ESLint enforces
// no electron/node import in shared/).

import type { LogicalId } from './types';

// ─── PTY payload types (02-02) ───────────────────────────────────────────────

/** Options for spawning a session PTY (renderer → main; validated in main). */
export type PtyCreateOptions = {
  cols: number;
  rows: number;
  cwd?: string;
};

/** Result of a successful spawn — stable logical id + the live OS PID (IDENT-02). */
export type PtyCreateResult = {
  id: LogicalId;
  pid: number;
};

/** main → renderer: a chunk of UTF-8 PTY output for session `id`. */
export type PtyDataPayload = {
  id: LogicalId;
  data: string;
};

/** main → renderer: session `id`'s shell exited with `exitCode`. */
export type PtyExitPayload = {
  id: LogicalId;
  exitCode: number;
};

export type ElectronAPI = {
  getVersion: () => Promise<string>;

  // ─── PTY surface (02-02) — the 7 methods mirrored in EXPECTED_API_KEYS ──────

  /** Spawn a login PTY; resolves with the stable LogicalId + OS PID. */
  ptyCreate: (opts: PtyCreateOptions) => Promise<PtyCreateResult>;
  /** Forward keystroke bytes to a PTY (fire-and-forget). */
  ptyWrite: (id: LogicalId, data: string) => void;
  /** Resize a PTY (cols/rows clamped main-side). */
  ptyResize: (id: LogicalId, cols: number, rows: number) => void;
  /** Pause a PTY (backpressure — SC5). */
  ptyPause: (id: LogicalId) => void;
  /** Resume a paused PTY (SC5). */
  ptyResume: (id: LogicalId) => void;
  /** Subscribe to PTY output for `id`; returns an unsubscribe function. */
  onPtyData: (id: LogicalId, cb: (data: string) => void) => () => void;
  /** Subscribe to PTY exit for `id`; returns an unsubscribe function. */
  onPtyExit: (id: LogicalId, cb: (exitCode: number) => void) => () => void;
};

// Window augmentation — import this in renderer entry point
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
