// Wave 0 RED stub (04-01 Task 1) — covers SESS-01/02/04 / D-02 the edit split.
//
// INTENTIONALLY FAILS RED until 04-01 Task 2 implements src/renderer/session-edit.ts
// (splitEdit). Targets the React/xterm/electron-free pure reducer (mirrors
// session-close.test.ts) so it runs in the Node/Vitest env.

import { describe, it, expect } from 'vitest';
import { splitEdit } from '../session-edit';

describe('splitEdit live-vs-restart field reducer (D-02)', () => {
  it('splits a form payload into the live half (name/icon) and the restart half (cwd/shell/startupCommand)', () => {
    const result = splitEdit({
      name: 'API server',
      icon: { type: 'emoji', value: '🖥️' },
      cwd: '/tmp/project',
      shell: '/bin/bash',
      startupCommand: 'npm run dev',
    });
    expect(result).toEqual({
      live: { name: 'API server', icon: { type: 'emoji', value: '🖥️' } },
      restart: {
        cwd: '/tmp/project',
        shell: '/bin/bash',
        startupCommand: 'npm run dev',
      },
    });
  });

  it('keeps the live and restart halves disjoint (no field crossover)', () => {
    const result = splitEdit({
      name: 'web',
      icon: { type: 'color', value: '#abc' },
      cwd: '/w',
      shell: '/bin/zsh',
      startupCommand: '',
    });
    expect(Object.keys(result.live).sort()).toEqual(['icon', 'name']);
    expect(Object.keys(result.restart).sort()).toEqual([
      'cwd',
      'shell',
      'startupCommand',
    ]);
  });
});
