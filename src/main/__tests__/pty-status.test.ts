// Wave 0 failing stub — covers SC4 / TERM-08 (status derivation).
//
// These tests INTENTIONALLY FAIL RED until Task 3 of plan 03-01 implements:
//   - src/main/pty-manager.ts → export function deriveStatus({ exitCode, userStopped })
//
// The pure status-derivation contract (RESEARCH Pattern 3):
//   - userStopped:true        → 'stopped'  (regardless of exitCode)
//   - exitCode === 0          → 'exited'
//   - exitCode !== 0 (any nz) → 'error'
//   - NEVER branches on `signal` (undefined on Windows / clean exit).
//
// When Task 3 turns these GREEN, delete this comment block.

import { describe, it, expect } from 'vitest';
import { deriveStatus } from '../pty-manager';

describe('deriveStatus — pure status mapping (SC4, TERM-08, RESEARCH Pattern 3)', () => {
  it("maps a user-initiated stop to 'stopped' regardless of exitCode 0", () => {
    expect(deriveStatus({ exitCode: 0, userStopped: true })).toBe('stopped');
  });

  it("maps a user-initiated stop to 'stopped' even with a non-zero exitCode (SIGKILL)", () => {
    // A SIGKILL'd process reports a non-zero exitCode, but userStopped wins.
    expect(deriveStatus({ exitCode: 137, userStopped: true })).toBe('stopped');
  });

  it("maps a clean exit (exitCode 0, not user-stopped) to 'exited'", () => {
    expect(deriveStatus({ exitCode: 0, userStopped: false })).toBe('exited');
  });

  it("maps a non-zero exit (exitCode 1, not user-stopped) to 'error'", () => {
    expect(deriveStatus({ exitCode: 1, userStopped: false })).toBe('error');
  });

  it("maps another non-zero exit (exitCode 137, not user-stopped) to 'error'", () => {
    expect(deriveStatus({ exitCode: 137, userStopped: false })).toBe('error');
  });

  it('never reads a `signal` field — passing one does not change the mapping', () => {
    // Even if a stray `signal` is present on the input, status is derived purely
    // from exitCode + userStopped (Pattern 3 — signal is undefined on Windows).
    const withSignal = { exitCode: 0, userStopped: false, signal: 9 } as unknown as {
      exitCode: number;
      userStopped: boolean;
    };
    expect(deriveStatus(withSignal)).toBe('exited');
    const errWithSignal = { exitCode: 2, userStopped: false, signal: 15 } as unknown as {
      exitCode: number;
      userStopped: boolean;
    };
    expect(deriveStatus(errWithSignal)).toBe('error');
  });
});
