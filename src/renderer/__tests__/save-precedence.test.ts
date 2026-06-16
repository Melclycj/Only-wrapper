// GAP-12-E save-time PRECEDENCE regression (12-12) — pins the rule the
// handleSaveProfile handler must implement: the cwd-drop check is decided BEFORE the
// restart-to-apply prompt, and a drop SUPPRESSES the prompt + keeps the modal open.
//
// Like session-restart-prompt.test.ts / cwd-save-outcome.test.ts this targets the
// React/xterm/electron-free pure reducers so it runs in the `node` Vitest env with no
// jsdom. Rather than reach into React internals, it MODELS the handler's precedence by
// composing the two reducers exactly as handleSaveProfile does:
//
//   promptId = restartPromptIdFor(preSaveRow, submittedFields)   // synchronous, pre-save
//   notice   = cwdDropNoticeFor(id, submittedFields.cwd, persisted)  // post-rehydrate truth
//
// and then applying the gate the handler enforces: the prompt is SET (and the modal
// closes) ONLY when `notice === null`. This is the ordering the bug violated — the old
// code SET the prompt synchronously before the drop-check resolved.

import { describe, it, expect } from 'vitest';
import {
  restartPromptIdFor,
  type LaunchFields,
} from '../session-restart-prompt';
import { cwdDropNoticeFor, CWD_DROPPED_NOTICE } from '../cwd-save-outcome';
import type { LogicalId, SessionRecord } from '../../shared/types';

const PERSISTED_CWD = '/Users/dev/proj';

const base: LaunchFields = {
  cwd: PERSISTED_CWD,
  shell: '/bin/zsh',
  startupCommand: 'npm run dev',
};

function makeRow(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    logicalId: 'r1' as LogicalId,
    ptyPid: 1000,
    name: 'r1',
    icon: { type: 'emoji', value: '🖥️' },
    cwd: base.cwd,
    shell: base.shell,
    startupCommand: base.startupCommand,
    status: 'running',
    order: 0,
    lastActive: 0,
    ...overrides,
  };
}

/**
 * Model the handler's save-time outcome by composing the two reducers and applying the
 * precedence gate handleSaveProfile must enforce. `closesModal` and `restartPromptId`
 * are derived from the SAME `notice === null` gate, so this proves the drop-check decides
 * the close AND the prompt — the prompt can never fire ahead of (or over) a drop.
 */
function saveOutcome(args: {
  preSaveRow: SessionRecord | null;
  submitted: LaunchFields;
  persistedCwd: string | undefined;
}): { notice: string | null; closesModal: boolean; restartPromptId: LogicalId | null } {
  const { preSaveRow, submitted, persistedCwd } = args;
  // 1. promptId is computed SYNCHRONOUSLY from the PRE-save row (before ptyUpdateProfile
  //    overwrites the launch fields).
  const promptId = restartPromptIdFor(preSaveRow, submitted);
  // 2. notice is computed from main's POST-save authoritative snapshot.
  const id = preSaveRow?.logicalId ?? 'r1';
  const persisted =
    persistedCwd === undefined ? [] : [{ logicalId: id, cwd: persistedCwd }];
  const notice = cwdDropNoticeFor(id, submitted.cwd, persisted);
  // 3. THE GATE: only a clean save (notice === null) closes the modal AND applies the
  //    deferred prompt. A drop does NEITHER.
  const clean = notice === null;
  return {
    notice,
    closesModal: clean,
    restartPromptId: clean ? promptId : null,
  };
}

describe('save-time precedence (GAP-12-E)', () => {
  it('DROP on a running session with changed launch fields: notice shows, modal STAYS OPEN, prompt SUPPRESSED', () => {
    // The user changed the cwd to an invalid dir AND changed the shell (a launch delta
    // that would otherwise prompt). The drop must win: no prompt, modal stays open.
    const outcome = saveOutcome({
      preSaveRow: makeRow({ status: 'running' }),
      submitted: { ...base, cwd: '/no/such/dir', shell: '/bin/bash' },
      persistedCwd: PERSISTED_CWD, // main kept the prior dir → dropped
    });
    expect(outcome.notice).toBe(CWD_DROPPED_NOTICE);
    expect(outcome.closesModal).toBe(false);
    expect(outcome.restartPromptId).toBeNull();
  });

  it('DROP wins even when ONLY the cwd changed (no other launch delta)', () => {
    const outcome = saveOutcome({
      preSaveRow: makeRow({ status: 'running' }),
      submitted: { ...base, cwd: '/no/such/dir' },
      persistedCwd: PERSISTED_CWD,
    });
    expect(outcome.notice).toBe(CWD_DROPPED_NOTICE);
    expect(outcome.closesModal).toBe(false);
    expect(outcome.restartPromptId).toBeNull();
  });

  it('CLEAN save + changed live launch fields: modal CLOSES and the restart prompt is SET', () => {
    // A valid cwd change on a running session → no drop → close + prompt.
    const outcome = saveOutcome({
      preSaveRow: makeRow({ status: 'running' }),
      submitted: { ...base, cwd: '/Users/dev/other' },
      persistedCwd: '/Users/dev/other', // main accepted it
    });
    expect(outcome.notice).toBeNull();
    expect(outcome.closesModal).toBe(true);
    expect(outcome.restartPromptId).toBe('r1');
  });

  it('CLEAN save + no launch-field change: modal CLOSES, NO prompt', () => {
    const outcome = saveOutcome({
      preSaveRow: makeRow({ status: 'running' }),
      submitted: { ...base }, // identical launch payload
      persistedCwd: PERSISTED_CWD,
    });
    expect(outcome.notice).toBeNull();
    expect(outcome.closesModal).toBe(true);
    expect(outcome.restartPromptId).toBeNull();
  });

  it('CLEAN save on a DORMANT session with a launch change: modal CLOSES, NO prompt (next Start applies it)', () => {
    const outcome = saveOutcome({
      preSaveRow: makeRow({ status: 'not_started' }),
      submitted: { ...base, cwd: '/Users/dev/other' },
      persistedCwd: '/Users/dev/other',
    });
    expect(outcome.notice).toBeNull();
    expect(outcome.closesModal).toBe(true);
    expect(outcome.restartPromptId).toBeNull();
  });

  it('DROP on a DORMANT session: still blocks the close (notice gates the close regardless of status)', () => {
    const outcome = saveOutcome({
      preSaveRow: makeRow({ status: 'not_started' }),
      submitted: { ...base, cwd: '/no/such/dir' },
      persistedCwd: PERSISTED_CWD,
    });
    expect(outcome.notice).toBe(CWD_DROPPED_NOTICE);
    expect(outcome.closesModal).toBe(false);
    expect(outcome.restartPromptId).toBeNull();
  });
});
