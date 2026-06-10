// RENDERER ONLY — the pure switch reducer (04-01, NAV-05, D-12).
//
// Imports NOTHING from React or xterm so the (sessions, activeId, intent) → next
// activeId mapping is unit-testable in the Node/Vitest env (mirrors session-close.ts).
// The type-only import of SwitchIntent from ../main/switch-keys is renderer-SAFE:
// it carries no runtime electron code. SessionManager subscribes to main's
// `session:switch` via window.api.onSwitchSession and applies this reducer.

import type { LogicalId, SessionRecord } from '../shared/types';
import type { SwitchIntent } from '../main/switch-keys';

/**
 * Map a switch intent to the next active LogicalId.
 *   - position: the session at that index, or `activeId` unchanged if out-of-range.
 *   - next/prev: wrap around the current index (an unknown activeId is treated as
 *     index 0 — defensive, mirrors session-close.ts's unknown-id handling).
 *   - empty list: `activeId` unchanged.
 * Never throws; always returns a valid (or unchanged) id.
 */
export function resolveSwitch(
  sessions: SessionRecord[],
  activeId: LogicalId | null,
  intent: SwitchIntent,
): LogicalId | null {
  if (sessions.length === 0) return activeId;
  if (intent.kind === 'position') {
    return sessions[intent.index]?.logicalId ?? activeId;
  }
  const cur = sessions.findIndex((s) => s.logicalId === activeId);
  const base = cur < 0 ? 0 : cur;
  const n = sessions.length;
  const next =
    intent.kind === 'next' ? (base + 1) % n : (base - 1 + n) % n;
  return sessions[next].logicalId;
}
