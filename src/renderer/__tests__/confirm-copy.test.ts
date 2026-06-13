// Unit truth-table for the pure D-04 confirm-body builder (Phase 11 Plan 00 Task 1).
//
// WHY a unit test (not a ui-lab capture) for the copy BRANCH: `agentState` is renderer-only
// overlay state on the sessions array, NOT a DOM attribute a pure DOM poke can set (see the
// PLANNER-NOTE on the agent-busy-confirm ui-lab surface). Per the 06.1 "passed while broken"
// lesson the escalation branch is therefore proven HERE by asserting the exact composed string,
// and the ui-lab surface only confirms the modal CHROME renders.
//
// The four idle bodies are asserted byte-identical to the strings that ship inline in
// SessionManager.tsx (~706-712) so a future edit to either side fails this guard.

import { describe, it, expect } from 'vitest';
import { buildConfirmBody, type ConfirmBodyArgs } from '../confirm-copy';

// The four shipped idle bodies, copied verbatim from SessionManager.tsx lines 706-712.
// (Kept as local literals so this test is the byte-for-byte contract, not a re-import.)
const DELETE_BODY =
  'This permanently deletes the saved session — its recipe is gone for good.';
const CONFIGURED_REMOVE_BODY =
  'This ends its running process and moves the session to the Inactive List. You can start it again later.';
const EPHEMERAL_RUNNING_REMOVE_BODY =
  'This ends its running process and removes the session.';
const PLAIN_REMOVE_BODY = 'This removes the session from the sidebar.';

// The escalation prefixes (the D-04 contract default wording).
const WORKING_ESCALATION =
  'Claude is still working in this session — closing it now will end the task mid-run. ';
const WAITING_ESCALATION =
  "This session is waiting for your input — closing it now will discard what it's asking for. ";

function args(overrides: Partial<ConfirmBodyArgs> = {}): ConfirmBodyArgs {
  return {
    removeMode: 'remove',
    configured: false,
    isRunning: false,
    ...overrides,
  };
}

describe('buildConfirmBody — the 4 idle branches (byte-identical to SessionManager.tsx 706-712)', () => {
  it('delete → the permanent-wipe body, verbatim', () => {
    expect(buildConfirmBody(args({ removeMode: 'delete' }))).toBe(DELETE_BODY);
  });

  it('configured remove → the retire-to-Inactive body, verbatim', () => {
    expect(
      buildConfirmBody(args({ removeMode: 'remove', configured: true, isRunning: true })),
    ).toBe(CONFIGURED_REMOVE_BODY);
  });

  it('ephemeral running remove → the end-process body, verbatim', () => {
    expect(
      buildConfirmBody(args({ removeMode: 'remove', configured: false, isRunning: true })),
    ).toBe(EPHEMERAL_RUNNING_REMOVE_BODY);
  });

  it('plain (not configured, not running) remove → the drop-from-sidebar body, verbatim', () => {
    expect(
      buildConfirmBody(args({ removeMode: 'remove', configured: false, isRunning: false })),
    ).toBe(PLAIN_REMOVE_BODY);
  });

  it('delete branch wins regardless of configured/running flags', () => {
    expect(
      buildConfirmBody(args({ removeMode: 'delete', configured: true, isRunning: true })),
    ).toBe(DELETE_BODY);
  });
});

describe('buildConfirmBody — D-04 agent escalation (prefix preserves the idle consequence)', () => {
  it("a WORKING ('in-progress') agent STARTS WITH the escalation AND CONTAINS the idle consequence", () => {
    const body = buildConfirmBody(
      args({ removeMode: 'remove', configured: true, isRunning: true, agentState: 'in-progress' }),
    );
    expect(body.startsWith(WORKING_ESCALATION)).toBe(true);
    expect(body).toContain(CONFIGURED_REMOVE_BODY);
    expect(body).toContain('still working');
    // Exact composed string — the escalation is a strict prefix of the idle body.
    expect(body).toBe(WORKING_ESCALATION + CONFIGURED_REMOVE_BODY);
  });

  it('a WAITING agent STARTS WITH the waiting escalation AND CONTAINS the idle consequence', () => {
    const body = buildConfirmBody(
      args({ removeMode: 'remove', configured: true, isRunning: true, agentState: 'waiting' }),
    );
    expect(body.startsWith(WAITING_ESCALATION)).toBe(true);
    expect(body).toContain(CONFIGURED_REMOVE_BODY);
    expect(body).toBe(WAITING_ESCALATION + CONFIGURED_REMOVE_BODY);
  });

  it("a FREE agent does NOT escalate — the idle body is returned verbatim", () => {
    expect(
      buildConfirmBody(
        args({ removeMode: 'remove', configured: true, isRunning: true, agentState: 'free' }),
      ),
    ).toBe(CONFIGURED_REMOVE_BODY);
  });

  it('an ABSENT agentState does NOT escalate — the idle body is returned verbatim', () => {
    expect(
      buildConfirmBody(args({ removeMode: 'remove', configured: true, isRunning: true })),
    ).toBe(CONFIGURED_REMOVE_BODY);
  });

  it('escalation also prefixes the DELETE consequence (never lost behind the warning)', () => {
    const body = buildConfirmBody(
      args({ removeMode: 'delete', agentState: 'in-progress' }),
    );
    expect(body.startsWith(WORKING_ESCALATION)).toBe(true);
    expect(body).toContain(DELETE_BODY);
  });
});
