// Unit test for buildAppMenuTemplate (12-05, GAP-12-D). The builder returns plain data
// (type-only electron import), so this runs in the Node/Vitest env with no electron
// runtime — it asserts on the template structure directly.
import { describe, it, expect } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import { buildAppMenuTemplate } from '../app-menu';

/** Collect the `role` of every item in the "Edit" submenu. */
function editRoles(template: MenuItemConstructorOptions[]): string[] {
  const edit = template.find((m) => m.label === 'Edit');
  const submenu = (edit?.submenu ?? []) as MenuItemConstructorOptions[];
  return submenu
    .map((i) => i.role)
    .filter((r): r is NonNullable<typeof r> => typeof r === 'string');
}

/** Collect every explicit `accelerator` string anywhere in the template (recursive). */
function allAccelerators(template: MenuItemConstructorOptions[]): string[] {
  const accels: string[] = [];
  const walk = (items: MenuItemConstructorOptions[]): void => {
    for (const i of items) {
      if (typeof i.accelerator === 'string') accels.push(i.accelerator);
      if (Array.isArray(i.submenu)) {
        walk(i.submenu as MenuItemConstructorOptions[]);
      }
    }
  };
  walk(template);
  return accels;
}

const EDITING_ROLES = ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'];

describe('buildAppMenuTemplate', () => {
  it('darwin: the Edit submenu carries the standard editing roles', () => {
    const roles = editRoles(buildAppMenuTemplate('darwin'));
    for (const role of EDITING_ROLES) {
      expect(roles).toContain(role);
    }
  });

  it('win32: the Edit submenu is present with the same editing roles', () => {
    const roles = editRoles(buildAppMenuTemplate('win32'));
    for (const role of EDITING_ROLES) {
      expect(roles).toContain(role);
    }
  });

  it('darwin: includes the standard appMenu + windowMenu', () => {
    const roles = buildAppMenuTemplate('darwin').map((m) => m.role);
    expect(roles).toContain('appMenu');
    expect(roles).toContain('windowMenu');
  });

  it('defines NO accelerator colliding with the before-input-event chords (1-9 / K / F)', () => {
    for (const platform of ['darwin', 'win32'] as NodeJS.Platform[]) {
      const accels = allAccelerators(buildAppMenuTemplate(platform));
      for (const accel of accels) {
        expect(accel).not.toMatch(/(CmdOrCtrl|Cmd|Ctrl)\+([1-9]|K|F)$/i);
      }
    }
  });
});
