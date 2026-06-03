/**
 * Shared TypeScript contract — stable identity and session record types.
 *
 * This module is consumed by every later phase (PTY, lifecycle, sidebar, persistence).
 * ALL fields are defined here even if unused until their phase wires them up, to prevent
 * type reshaping mid-project (D-01).
 *
 * DO NOT import electron or node modules here — this file is imported by the renderer.
 */

// ─── Identity (D-04) ─────────────────────────────────────────────────────────

/**
 * Branded nominal type for stable logical session identity.
 *
 * A bare `string` or a stringified PID cannot be assigned to LogicalId — this is
 * a compile-time error, enforcing IDENT-02 (identity never conflated with PTY PID).
 * Only `newLogicalId()` in src/shared/id-factory.ts may mint a LogicalId value.
 */
export type LogicalId = string & { readonly __brand: 'LogicalId' };

// ─── Status (D-02) ───────────────────────────────────────────────────────────

/**
 * String-literal union (NOT a TS enum) so it:
 *   - has zero runtime cost
 *   - narrows cleanly in a switch statement without a `default` branch
 *   - serializes to JSON as-is for lowdb persistence (Phase 5)
 *   - is free of the enum/isolatedModules friction under Vite + ESM
 */
export type SessionStatus =
  | 'not_started'
  | 'running'
  | 'stopped'
  | 'exited'
  | 'error';

// ─── Icon (D-03) ─────────────────────────────────────────────────────────────

/**
 * Discriminated union for session icon kinds (SESS-03).
 *
 * The `type` discriminant enables a clean render `switch` in the sidebar (Phase 4).
 * The canonical scenario icon `🛋️` is represented as `{ type: 'emoji', value: '🛋️' }`.
 */
export type SessionIconSpec =
  | { type: 'emoji'; value: string }
  | { type: 'preset'; value: string }
  | { type: 'color'; value: string };

// ─── Session Record (D-01) ───────────────────────────────────────────────────

/**
 * Full session record shape — all fields from PERS-01.
 *
 * Fields beyond `logicalId` and `ptyPid` are present as the stable contract for
 * Phases 2–5 (PTY, lifecycle, sidebar, persistence) even though they are unused
 * this phase. Defining them now prevents breaking type changes later.
 *
 * Key invariants (IDENT-01, IDENT-02, D-04):
 *   - `logicalId` is a branded LogicalId — a plain string or number cannot be assigned here
 *   - `ptyPid` is a plain `number?` — structurally distinct from `logicalId`
 *   - No code may conflate these two fields
 */
export interface SessionRecord {
  /** Stable logical identity — branded, minted only by newLogicalId() (D-04, IDENT-01) */
  logicalId: LogicalId;

  /** OS process ID of the live PTY — plain number, optional (absent when not_started) (IDENT-02) */
  ptyPid?: number;

  /** User-visible session name */
  name: string;

  /** Session icon — emoji, built-in preset, or color badge (D-03, SESS-03) */
  icon: SessionIconSpec;

  /** Working directory for the PTY spawn */
  cwd: string;

  /** Shell executable path (e.g. /bin/zsh, C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe) */
  shell: string;

  /** Optional startup command run on session creation (e.g. "claude --rc") */
  startupCommand?: string;

  /** Current session lifecycle state (D-02) */
  status: SessionStatus;

  /** Display order in the sidebar (0-indexed) */
  order: number;

  /** Unix timestamp (ms) of last user interaction — used for MRU ordering */
  lastActive: number;
}
