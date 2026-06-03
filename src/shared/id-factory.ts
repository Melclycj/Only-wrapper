/**
 * MAIN-PROCESS ONLY — do NOT import this module in renderer or preload.
 *
 * Sandboxed preloads cannot require() uuid (RESEARCH Pitfall 3).
 * The renderer obtains version info through the typed contextBridge (window.api),
 * never by calling this factory directly.
 *
 * This file is the ONLY sanctioned location for minting a LogicalId value.
 * No other module may cast a string to LogicalId — all logical IDs are created here.
 */

import { v4 as uuidv4 } from 'uuid';
import type { LogicalId } from './types';

/**
 * Mint a new stable logical session identity.
 *
 * Wraps uuid v4 and casts the result to the branded LogicalId type (D-04).
 * Two calls are guaranteed to return distinct values (uuid v4 uniqueness).
 *
 * Usage (main process only):
 *   const id = newLogicalId();  // LogicalId
 */
export function newLogicalId(): LogicalId {
  return uuidv4() as LogicalId;
}
