// Typed contextBridge surface — no runtime imports (pure types only)
// This file is importable in renderer without leaking any electron/node APIs into the renderer bundle
// Source: RESEARCH Pattern 3
//
// type-only import: LogicalId is a branded compile-time type with zero runtime
// footprint, so importing it here keeps api-types renderer-safe (ESLint enforces
// no electron/node import in shared/).

import type {
  LogicalId,
  SessionStatus,
  SessionRecord,
  SessionIconSpec,
} from './types';
// type-only: SwitchIntent is a plain discriminated union (no runtime electron) so
// importing it from the main-side pure matcher keeps api-types renderer-safe (04-01).
import type { SwitchIntent } from '../main/switch-keys';
// type-only: DiscoveredShell is a plain { path; label } interface (no runtime
// electron) so importing it from the main-side shell-discovery seam keeps
// api-types renderer-safe (05-01).
import type { DiscoveredShell } from '../main/shell-discovery';

// ─── PTY payload types (02-02) ───────────────────────────────────────────────

/**
 * Options for spawning a session PTY (renderer → main; validated in main).
 *
 * 03-01 additions:
 *   - `id?` — when present, RESTART reuses this LogicalId (IDENT-02). When absent,
 *     main mints a fresh LogicalId. The renderer never invents an id; it passes the
 *     id of the session being restarted, or undefined for a brand-new session.
 *     The renderer passes `cwd: undefined` for the default — MAIN resolves
 *     `os.homedir()`; the renderer never computes home.
 */
export type PtyCreateOptions = {
  cols: number;
  rows: number;
  cwd?: string;
  id?: LogicalId;
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
  /**
   * Optional transient, NON-lifecycle informational message (TERM-05 D-04 ready-fail).
   * Surfaced when the startup-command readiness probe times out: the command was NOT
   * auto-run and a bare usable shell remains. It rides this EXISTING onPtyStatus
   * subscription — it is NOT a new bridge key (EXPECTED_API_KEYS stays at 18) and is
   * a fixed literal in main (no command/nonce/buffer interpolation — V7). The renderer
   * renders it additively WITHOUT suppressing the lifecycle status badge.
   */
  notice?: string;
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
  /** Restart a session: SAME logicalId, NEW ptyPid. */
  ptyRestart: (id: LogicalId) => Promise<PtyCreateResult>;
  /** Subscribe to status transitions for `id` (id-filtered); returns unsubscribe. */
  onPtyStatus: (id: LogicalId, cb: (p: PtyStatusPayload) => void) => () => void;
  /** Snapshot of current sessions (initial render / after add) — main is source of truth. */
  listSessions: () => Promise<SessionRecord[]>;

  // ─── Identity surface (04-01) — 2 new keys mirrored in EXPECTED_API_KEYS ─────

  /**
   * Persist edited profile fields into main's record (fire-and-forget, mirrors
   * ptyClose, the 14th key). name/icon are mirrored so a restart (which rebuilds
   * the record from main's fields) does not revert a live edit; cwd/shell/
   * startupCommand take effect on the NEXT restart. startupCommand is STORED ONLY
   * — main never writes it to a PTY (TERM-05 auto-run deferred).
   */
  ptyUpdateProfile: (
    id: LogicalId,
    fields: {
      name?: string;
      icon?: SessionIconSpec;
      cwd?: string;
      shell?: string;
      startupCommand?: string;
    },
  ) => void;
  /**
   * Subscribe to app-level switch intents pushed from main's before-input-event
   * (the 15th key, mirrors onPtyStatus's subscribe-returns-unsubscribe shape).
   * Returns an unsubscribe fn. main → renderer, read-only inbound event.
   */
  onSwitchSession: (cb: (intent: SwitchIntent) => void) => () => void;

  // ─── Persistence + discovery surface (05-01) — 3 new keys in EXPECTED_API_KEYS ─

  /**
   * Discover the platform-available shells for the edit-form dropdown (the 16th
   * key, mirrors listSessions's request-response invoke). main runs the macOS
   * provider this phase (reads /etc/shells + always includes the resolved $SHELL,
   * filters to on-disk, de-dupes — D-05/D-06); the Windows enumeration is Phase 8.
   */
  discoverShells: () => Promise<DiscoveredShell[]>;
  /**
   * Persist the user's sidebar order (the 17th key, fire-and-forget send, mirrors
   * ptyUpdateProfile). main VALIDATES the payload before any write (T-05-01): each
   * `id` must be a known LogicalId AND `order` must be a finite number — a forged
   * payload is a silent no-op, never writing arbitrary data to disk (NAV-04/D-08).
   */
  persistOrder: (orders: { id: LogicalId; order: number }[]) => void;
  /**
   * Persist UI preferences — sidebar collapse + window bounds (the 18th key,
   * fire-and-forget send, mirrors ptyUpdateProfile). main VALIDATES before write
   * (T-05-01): each of x/y/width/height must be finite, collapsed must be boolean.
   * D-12 (collapse state + window size/position survive reopen).
   */
  persistUiState: (ui: {
    collapsed?: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
  }) => void;

  // ─── Folder picker (06-01) — the ONE new key this phase in EXPECTED_API_KEYS ───

  /**
   * Open the native open-directory dialog and resolve the chosen absolute path, or
   * null if the user cancels (the 19th key, mirrors discoverShells's request-response
   * invoke). main OWNS the dialog; it returns ONLY a string path, never an fs handle
   * (V12, T-06-01) — the renderer never touches the filesystem. Used by the session
   * edit form's cwd field (the "folder picker" UX surfaced in the 05.1 human-verify).
   */
  pickDirectory: () => Promise<string | null>;
};

// Window augmentation — import this in renderer entry point
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
