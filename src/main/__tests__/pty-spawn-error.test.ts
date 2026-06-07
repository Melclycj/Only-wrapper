// Wave 0 RED scaffold — SC2 spawn-error pre-validation (filled GREEN in Plan 06-02).
//
// TARGET BEHAVIOR (Plan 06-02 fills these in):
//   - create() PRE-VALIDATES the resolved cwd before spawning the PTY: a non-existent
//     or non-directory cwd must NOT silently fall back to $HOME (D-02 no-silent-home).
//     Instead the session surfaces an 'error' status + a fixed informational notice on
//     the existing onPtyStatus channel (NO new bridge key), and node-pty is NEVER
//     spawned with a bad cwd.
//   - The empty/whitespace cwd → main resolves os.homedir() (the documented default,
//     NOT an error) — only an EXPLICIT bad path is an error (SC2).
//
// This file is a `describe.todo` stub so it RESOLVES under Vitest WITHOUT failing the
// suite (todo tests are pending, not failing). It imports PtyManager so the module
// graph is wired and Plan 06-02's executor inherits a compiling contract to flip GREEN.
// When Plan 06-02 lands the cwd pre-validation, replace `describe.todo` with the real
// FakeChild harness (mirror readiness-probe.test.ts Group 2) and delete this banner's
// "RED" note.

import { describe, expectTypeOf } from 'vitest';
// Type-only import of the target so the scaffold resolves against the real module
// graph WITHOUT loading node-pty/electron at runtime (a value import would execute
// pty-manager's native top-level imports under the Node test env). Plan 06-02
// instantiates PtyManager for real when it flips this GREEN.
import type { PtyManager } from '../pty-manager';

// Anchor the type import so it is genuinely consumed (lint-clean) and the contract is
// documented: Plan 06-02's create() pre-validates cwd before spawning.
expectTypeOf<PtyManager>().toHaveProperty('create');

describe.todo('PtyManager.create() cwd pre-validation (SC2 / D-02 — Plan 06-02)', () => {
  // it('surfaces an error status + notice for a non-existent explicit cwd (no silent $HOME)')
  // it('does NOT spawn node-pty when the explicit cwd is a file, not a directory')
  // it('resolves os.homedir() for an empty/undefined cwd (the documented default, not an error)')
});
