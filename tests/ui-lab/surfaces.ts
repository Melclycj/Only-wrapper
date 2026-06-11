// ui-lab surface registry — the ordered list of named app states the capture
// spec walks. ADDING A SURFACE = adding one entry here (see README "Adding a
// surface"). Surfaces run IN ORDER inside one app session and may build on
// state created by earlier surfaces (ctx.ids accumulates created sessions).
//
// Driver functions are reused from the smoke harness (tests/smoke/helpers/
// xterm-driver.ts) — one driving vocabulary across smoke + ui-lab.

/// <reference types="@wdio/globals/types" />
/// <reference types="@wdio/electron-service" />

import {
  clickAddSession,
  clickSidebarRow,
  openContextMenu,
  clickMenuItem,
  sendKeys,
  sendKeysTo,
  waitForText,
  pressFindChord,
  toggleCollapse,
  clickByTestId,
  hasTestId,
} from '../smoke/helpers/xterm-driver';

/** Mutable state shared across surfaces (sessions created so far, in order). */
export interface SurfaceContext {
  ids: string[];
}

/** Thrown by prepare() when a surface is legitimately unreachable — recorded
 *  as `skipped` in the manifest instead of failing the run. */
export class SkipSurface extends Error {}

export interface Surface {
  id: string;
  title: string;
  /** DESIGN.md anchors this surface is evaluated against. */
  designRefs: string[];
  /** One-line "what good looks like" — pointer into DESIGN-RUBRIC.md. */
  expects: string;
  /** Drive the app into this state. May throw SkipSurface. */
  prepare: (ctx: SurfaceContext) => Promise<void>;
  /** Optional pre-check; { ok: false } records a skip without mutating state. */
  available?: (ctx: SurfaceContext) => Promise<{ ok: boolean; reason?: string }>;
  /** Restore neutral state for the next surface (best-effort). */
  cleanup?: (ctx: SurfaceContext) => Promise<void>;
}

// ── local driving utilities ──────────────────────────────────────────────────

async function waitForTestId(testid: string, timeoutMs = 8000): Promise<void> {
  await browser.waitUntil(async () => hasTestId(testid), {
    timeout: timeoutMs,
    interval: 100,
    timeoutMsg: `[data-testid="${testid}"] did not appear within ${timeoutMs}ms`,
  });
}

async function waitForTestIdGone(testid: string, timeoutMs = 5000): Promise<void> {
  await browser.waitUntil(async () => !(await hasTestId(testid)), {
    timeout: timeoutMs,
    interval: 100,
    timeoutMsg: `[data-testid="${testid}"] did not close within ${timeoutMs}ms`,
  });
}

/** All sidebar row session ids, in DOM order. */
async function rowIds(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>('.sidebar-row[data-session-id]'),
    ).map((el) => el.getAttribute('data-session-id') ?? ''),
  );
}

/** Visible text content of the sidebar row for `id` (name + status label). */
async function rowText(id: string): Promise<string> {
  return browser.execute((sid: string) => {
    const row = document.querySelector<HTMLElement>(
      `.sidebar-row[data-session-id="${sid}"]`,
    );
    return (row?.textContent ?? '').trim();
  }, id);
}

/** Add a session and wait until a NEW sidebar row exists; returns its id. */
async function addSession(ctx: SurfaceContext): Promise<string> {
  const before = (await rowIds()).length;
  await clickAddSession();
  await browser.waitUntil(async () => (await rowIds()).length === before + 1, {
    timeout: 8000,
    interval: 100,
    timeoutMsg: 'new sidebar row did not appear after Add session',
  });
  const ids = await rowIds();
  const id = ids[ids.length - 1];
  ctx.ids.push(id);
  // Let the PTY spawn + first prompt paint before the next interaction.
  await browser.pause(900);
  return id;
}

/** Open the edit modal for `id` via the double-click affordance. */
async function openEditModal(id: string): Promise<void> {
  await browser.execute((sid: string) => {
    const row = document.querySelector<HTMLElement>(
      `.sidebar-row[data-session-id="${sid}"]`,
    );
    row?.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
    );
  }, id);
  await waitForTestId('session-edit-modal');
}

/** Set a text input's value (by data-testid) through React's onChange path. */
async function setInputByTestId(testid: string, value: string): Promise<void> {
  await browser.execute(
    (tid: string, v: string) => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-testid="${tid}"]`,
      );
      if (input) {
        input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    testid,
    value,
  );
}

async function pressEscape(): Promise<void> {
  await browser.keys(['Escape']);
}

/** Visible labels of the open context menu's items. */
async function contextMenuLabels(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>('.context-menu-item'),
    ).map((el) => (el.textContent ?? '').trim()),
  );
}

// ── the surface registry (ordered) ───────────────────────────────────────────

export const SURFACES: Surface[] = [
  {
    id: 'empty-state',
    title: 'Welcome empty state (fresh boot, no sessions)',
    designRefs: ['DESIGN.md §Aesthetic direction', 'DESIGN.md §Design tokens'],
    expects:
      'Warm parlour welcome: cozy copy, soft cream bg, accent CTA pill, Nunito.',
    available: async () => {
      const ids = await rowIds();
      return ids.length === 0
        ? { ok: true }
        : { ok: false, reason: 'sidebar not empty (reused userData?)' };
    },
    prepare: async () => {
      await waitForTestId('welcome-empty-state');
    },
  },
  {
    id: 'terminal-running',
    title: 'Active running session (terminal is the focal point)',
    designRefs: [
      'DESIGN.md §Terminal palette',
      'DESIGN.md §Typography',
      'DESIGN.md §Aesthetic direction (calm chrome, terminal focus)',
    ],
    expects:
      'Charcoal-indigo terminal (NOT pure black), JetBrains Mono, calm chrome around it.',
    prepare: async (ctx) => {
      await addSession(ctx);
      await sendKeys("echo 'cozy parlour — ui-lab capture'");
      await browser.keys(['Enter']);
      await waitForText('cozy parlour', 8000);
      await browser.pause(300);
    },
  },
  {
    id: 'sidebar-populated',
    title: 'Sidebar with identity + status variety (running / named / finished)',
    designRefs: [
      'DESIGN.md §Status system',
      'DESIGN.md §v1 component inventory (SessionCard/IdeSidebarRow)',
    ],
    expects:
      'Rows read icon + name + status dot/label; active row clearly ringed; status colors match the ramp table.',
    prepare: async (ctx) => {
      // Session B: named identity (🛋️ Parlour Claude) — the canonical scenario.
      const idB = await addSession(ctx);
      await openEditModal(idB);
      await setInputByTestId('edit-name', 'Parlour Claude');
      await setInputByTestId('edit-emoji-text', '🛋️');
      await clickByTestId('edit-save');
      await waitForTestIdGone('session-edit-modal');
      await browser.waitUntil(
        async () => (await rowText(idB)).includes('Parlour Claude'),
        { timeout: 5000, interval: 100, timeoutMsg: 'rename did not land' },
      );
      // Session C: exits cleanly → "Finished" status ramp.
      const idC = await addSession(ctx);
      await sendKeysTo(idC, 'exit');
      await browser.keys(['Enter']);
      await browser.waitUntil(
        async () => (await rowText(idC)).includes('Finished'),
        {
          timeout: 10000,
          interval: 200,
          timeoutMsg: 'session C did not reach Finished',
        },
      );
      // Activate session A so the populated shot shows a running focal terminal.
      await clickSidebarRow(ctx.ids[0]);
      await browser.pause(400);
    },
  },
  {
    id: 'idle-card',
    title: 'Dormant session IdleCard (Start CTA)',
    designRefs: [
      'DESIGN.md §Status system (free/Idle ramp)',
      'DESIGN.md §Aesthetic direction',
    ],
    expects:
      'Idle parlour card with accent Start CTA — inviting, not an error state.',
    prepare: async (ctx) => {
      const idB = ctx.ids[1];
      await openContextMenu(idB);
      await waitForTestId('context-menu');
      const labels = await contextMenuLabels();
      if (!labels.includes('Stop')) {
        await pressEscape();
        await waitForTestIdGone('context-menu');
        throw new SkipSurface(
          `context menu has no "Stop" item (items: ${labels.join(', ')})`,
        );
      }
      await clickMenuItem('Stop');
      await clickSidebarRow(idB);
      await waitForTestId('idle-card', 10000);
      await browser.pause(400);
    },
  },
  {
    id: 'context-menu',
    title: 'Sidebar row context menu',
    designRefs: ['DESIGN.md §Design tokens (radius, shadow-menu)'],
    expects:
      'Rounded menu card with the menu elevation shadow; items in Nunito; calm hover.',
    prepare: async (ctx) => {
      await openContextMenu(ctx.ids[0]);
      await waitForTestId('context-menu');
      await browser.pause(250);
    },
    cleanup: async () => {
      await pressEscape();
      await waitForTestIdGone('context-menu');
    },
  },
  {
    id: 'edit-modal',
    title: 'Session create/edit form',
    designRefs: [
      'DESIGN.md §v1 component inventory (create/edit form)',
      'DESIGN.md §Design tokens (radius: cards 18px, inputs ≈8px)',
    ],
    expects:
      '18px dialog card + dialog shadow; labeled fields; ~8px inputs; pill buttons; Nunito.',
    prepare: async (ctx) => {
      await openEditModal(ctx.ids[0]);
      await browser.pause(300);
    },
    cleanup: async () => {
      await clickByTestId('edit-cancel');
      await waitForTestIdGone('session-edit-modal');
    },
  },
  {
    id: 'preferences-modal',
    title: 'Preferences dialog',
    designRefs: ['DESIGN.md §Design tokens'],
    expects: 'Same dialog language as the edit form — one family, not a stranger.',
    prepare: async () => {
      await clickByTestId('open-preferences');
      await waitForTestId('preferences-modal');
      await browser.pause(300);
    },
    cleanup: async () => {
      await clickByTestId('preferences-done');
      await waitForTestIdGone('preferences-modal');
    },
  },
  {
    id: 'search-bar',
    title: 'Terminal search bar (active match state)',
    designRefs: [
      'DESIGN.md §Design tokens',
      'DESIGN.md §Aesthetic direction (calm chrome)',
    ],
    expects:
      'Compact search chrome docked to the terminal; accent focus ring; match count legible.',
    prepare: async (ctx) => {
      await clickSidebarRow(ctx.ids[0]);
      await browser.pause(200);
      await pressFindChord();
      await waitForTestId('search-bar');
      await setInputByTestId('search-input', 'cozy');
      await browser.pause(400);
    },
    cleanup: async () => {
      await clickByTestId('search-close');
      await waitForTestIdGone('search-bar');
    },
  },
  {
    id: 'sidebar-collapsed',
    title: 'Collapsed icon rail',
    designRefs: [
      'DESIGN.md §v1 component inventory (RailIcon/IconTile)',
      'DESIGN.md §Status system',
    ],
    expects:
      'Icon-only rail keeps identity (emoji tiles) + status dots; terminal gains the space.',
    prepare: async () => {
      await toggleCollapse();
      await browser.pause(500);
    },
    cleanup: async () => {
      await toggleCollapse();
      await browser.pause(300);
    },
  },
];
