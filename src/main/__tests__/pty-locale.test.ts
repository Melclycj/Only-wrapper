// GAP-10-K locale resolution unit coverage (10-14, round-5 gap-closure). The defect:
// a Finder-launched Electron app inherits NO UTF-8 locale, so the spawn env's child
// falls back to the C/POSIX (ASCII) locale and CLI tools won't emit CJK. The fix wires
// `resolvePtyLocale(process.env)` into pty.spawn's env so a UTF-8 LANG/LC_ALL reaches
// the child when none is inherited — while HONORING an existing UTF-8 locale (never
// clobbering a user's zh_CN.UTF-8) and injecting NO POSIX locale on win32 (ConPTY).
//
// resolvePtyLocale is PURE over an env object + an (overridable) platform string, so it
// needs no node-pty / electron mock — this test exercises the truth table directly.

import { describe, it, expect } from 'vitest';
import { resolvePtyLocale } from '../pty-locale';

describe('resolvePtyLocale — GAP-10-K UTF-8 spawn locale', () => {
  it('defaults a UTF-8 locale when none is inherited (the Finder-launch case, darwin)', () => {
    const result = resolvePtyLocale({}, 'darwin');
    expect(result).toEqual({ LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' });
  });

  it('HONORS an existing UTF-8 LANG (returns {} — never clobbers a user locale)', () => {
    const result = resolvePtyLocale({ LANG: 'zh_CN.UTF-8' }, 'darwin');
    expect(result).toEqual({});
  });

  it('HONORS an existing UTF-8 LC_ALL (returns {})', () => {
    const result = resolvePtyLocale({ LC_ALL: 'ja_JP.UTF-8' }, 'darwin');
    expect(result).toEqual({});
  });

  it('honors a case-variant UTF-8 spelling (utf8 / UTF8)', () => {
    expect(resolvePtyLocale({ LANG: 'en_GB.utf8' }, 'darwin')).toEqual({});
    expect(resolvePtyLocale({ LC_ALL: 'de_DE.UTF8' }, 'darwin')).toEqual({});
  });

  it('UPGRADES a non-UTF-8 C/POSIX locale to the UTF-8 default (darwin)', () => {
    const result = resolvePtyLocale({ LANG: 'C', LC_ALL: 'POSIX' }, 'darwin');
    expect(result).toEqual({ LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' });
  });

  it('also defaults on linux (the POSIX path is not darwin-specific)', () => {
    expect(resolvePtyLocale({}, 'linux')).toEqual({
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
    });
  });

  it('injects NO POSIX locale on win32 (returns {} — ConPTY/code-page path unchanged)', () => {
    // Even with an empty env, win32 must not be handed a POSIX LANG.
    expect(resolvePtyLocale({}, 'win32')).toEqual({});
    // And it must not clobber/inject when a (non-UTF-8) env is present either.
    expect(resolvePtyLocale({ LANG: 'C' }, 'win32')).toEqual({});
  });
});
