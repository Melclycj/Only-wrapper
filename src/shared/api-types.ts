// Typed contextBridge surface — no runtime imports (pure types only)
// This file is importable in renderer without leaking any electron/node APIs into the renderer bundle
// Source: RESEARCH Pattern 3
//
// type-only import: LogicalId is a branded compile-time type with zero runtime
// footprint, so importing it here keeps api-types renderer-safe (ESLint enforces
// no electron/node import in shared/).

import type { LogicalId, SessionStatus, SessionRecord } from './types';

// ─── PTY payload types (02-02) ───────────────────────────────────────────────

/**
 * Options for spawning a session PTY (renderer → main; validated in main).
 *
 * 03-01 additions:
 *   - `id?` — when present, RESTART reuses this LogicalId (IDENT-02). When absent,
 *     main mints a fresh LogicalId. The renderer never invents an id; it passes the
 *     id of the session being restarted, or undefined for a brand-new session.
 *   - `startupCommand?` — written into the PTY as visible keystrokes once the shell
 *     settles (D-05, TERM-05). The renderer passes `cwd: undefined` for the default —
 *     MAIN resolves `os.homedir()`; the renderer never computes home.
 */
export type PtyCreateOptions = {
  cols: number;
  rows: number;
  cwd?: string;
  id?: LogicalId;
  startupCommand?: string;
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

/**
 * main → renderer: session `id` transitioned to `status` (03-01, SC4/TERM-08).
 *   - `ptyPid` present on a fresh spawn (status 'running').
 *   - `exitCode` present on a terminal transition ('exited'/'error').
 * Status is derived from exitCode + a userStopped flag in main — never from `signal`.
 */
export type PtyStatusPayload = {
  id: LogicalId;
  status: SessionStatus;
  ptyPid?: number;
  exitCode?: number;
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

  // ─── Lifecycle surface (03-01) — 4 new methods mirrored in EXPECTED_API_KEYS ──

  /**
   * Stop a session (fire-and-forget). POSIX: SIGTERM→SIGKILL grace; win32: ConPTY
   * unconditional kill. KEEPS the SessionRecord (status → 'stopped') for restart.
   * Retained per D-03a ("keep the function, disable the button") but no longer
   * surfaced as a UI control — the destructive Close (ptyClose) replaced it.
   */
  ptyStop: (id: LogicalId) => void;
  /**
   * Destructively CLOSE a session (fire-and-forget, D-03a, the 13th key): main
   * kills the PTY AND removes the SessionRecord (close+remove). Unlike ptyStop, the
   * row does NOT survive — it vanishes from listSessions() so reconcile won't re-add.
   */
  ptyClose: (id: LogicalId) => void;
  /** Restart a session: SAME logicalId, NEW ptyPid; re-runs startupCommand. */
  ptyRestart: (id: LogicalId) => Promise<PtyCreateResult>;
  /** Subscribe to status transitions for `id` (id-filtered); returns unsubscribe. */
  onPtyStatus: (id: LogicalId, cb: (p: PtyStatusPayload) => void) => () => void;
  /** Snapshot of current sessions (initial render / after add) — main is source of truth. */
  listSessions: () => Promise<SessionRecord[]>;
};

// Window augmentation — import this in renderer entry point
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
