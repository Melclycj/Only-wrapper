// Wave 0 RED stub (04-01 Task 1) — covers NAV-05 / D-12 / D-13 the key matcher.
//
// INTENTIONALLY FAILS RED until 04-01 Task 2 implements src/main/switch-keys.ts
// (matchSwitchKey). Targets the pure, electron-free matcher (mirrors the pure
// helpers in pty-manager.ts: deriveStatus/clampDimension) so it runs in the
// Node/Vitest env with no Electron process.
//
// A1 (open question): the `[`/`]`/digit `key` strings are asserted here via the
// production `key` field; the matcher is written defensively (accept `key` OR
// `code`) so a later empirical NAV-05 E2E tweak is one line — these tests use
// the `key` path which holds on both macOS and Windows for these chords.

import { describe, it, expect } from 'vitest';
import { matchSwitchKey, type KeyInput } from '../switch-keys';

function key(partial: Partial<KeyInput>): KeyInput {
  return {
    type: 'keyDown',
    key: '',
    control: false,
    meta: false,
    shift: false,
    alt: false,
    ...partial,
  };
}

describe('matchSwitchKey (NAV-05, D-12/D-13)', () => {
  it('Cmd+1 (macOS) resolves to position index 0', () => {
    expect(matchSwitchKey(key({ meta: true, key: '1' }))).toEqual({
      kind: 'position',
      index: 0,
    });
  });

  it('Ctrl+9 (Windows) resolves to position index 8', () => {
    expect(matchSwitchKey(key({ control: true, key: '9' }))).toEqual({
      kind: 'position',
      index: 8,
    });
  });

  it('Cmd+Shift+] resolves to a next intent', () => {
    expect(matchSwitchKey(key({ meta: true, shift: true, key: ']' }))).toEqual({
      kind: 'next',
    });
  });

  it('Ctrl+Shift+[ resolves to a prev intent', () => {
    expect(
      matchSwitchKey(key({ control: true, shift: true, key: '[' })),
    ).toEqual({ kind: 'prev' });
  });

  it('returns null when Alt is also held (not a switch chord)', () => {
    expect(matchSwitchKey(key({ meta: true, alt: true, key: '1' }))).toBeNull();
  });

  it('returns null with no primary modifier (bare digit)', () => {
    expect(matchSwitchKey(key({ key: '1' }))).toBeNull();
  });

  it('returns null for a non-keyDown event (e.g. keyUp)', () => {
    expect(
      matchSwitchKey(key({ type: 'keyUp', meta: true, key: '1' })),
    ).toBeNull();
  });

  it('returns null for Cmd+0 (only 1-9 are switch positions)', () => {
    expect(matchSwitchKey(key({ meta: true, key: '0' }))).toBeNull();
  });
});
