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

/** Read the `.row-name` geometry + computed text-overflow for a row. */
async function rowNameMetrics(
  id: string,
): Promise<{ found: boolean; scrollWidth: number; clientWidth: number; text: string; textOverflow: string }> {
  return browser.execute((sid: string) => {
    const name = document.querySelector<HTMLElement>(
      `.sidebar-row[data-session-id="${sid}"] .row-name`,
    );
    if (!name) {
      return { found: false, scrollWidth: 0, clientWidth: 0, text: '', textOverflow: '' };
    }
    return {
      found: true,
      // scrollWidth = the content's full width; clientWidth = the visible box.
      // scrollWidth <= clientWidth ⇒ the name is fully shown (NOT truncated).
      scrollWidth: name.scrollWidth,
      clientWidth: name.clientWidth,
      text: (name.textContent ?? '').trim(),
      textOverflow: getComputedStyle(name).textOverflow,
    };
  }, id);
}

/** GAP-10-F: machine-check that a name that SHOULD fit is not crushed.
 *  Throws a descriptive Error (NOT SkipSurface) so a name-crush regression
 *  FAILS the run loudly instead of being eye-scored from a PNG. */
async function assertNameNotCrushed(id: string): Promise<void> {
  const m = await rowNameMetrics(id);
  if (!m.found) {
    throw new Error(
      `assertNameNotCrushed: no .row-name element for row ${id} — the name surface is missing entirely`,
    );
  }
  if (m.scrollWidth > m.clientWidth) {
    throw new Error(
      `name-crush regression: ".row-name" for "${m.text}" is truncated ` +
        `(scrollWidth=${m.scrollWidth} > clientWidth=${m.clientWidth}). ` +
        `A medium-length name must render in full at rest.`,
    );
  }
}

/** GAP-10-F: a deliberately overlong name must degrade GRACEFULLY via ellipsis
 *  — allowed to truncate, but only through `text-overflow: ellipsis`, with a
 *  bounded content box and no layout break. Throws on a hard crush. */
async function assertLongNameDegradesGracefully(id: string): Promise<void> {
  const m = await rowNameMetrics(id);
  if (!m.found) {
    throw new Error(
      `assertLongNameDegradesGracefully: no .row-name element for row ${id}`,
    );
  }
  if (m.clientWidth <= 0) {
    throw new Error(
      `long-name layout break: ".row-name" for "${m.text}" collapsed to clientWidth=${m.clientWidth} (expected a bounded, > 0 content box)`,
    );
  }
  if (m.textOverflow !== 'ellipsis') {
    throw new Error(
      `long-name overflow is not handled by ellipsis: computed text-overflow="${m.textOverflow}" (expected "ellipsis") for "${m.text}"`,
    );
  }
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
      // GAP-10-F: machine-check the canonical MEDIUM name is shown in full
      // (no truncation) at rest — gated on the observable rename landing above,
      // not a bare pause. A name-crush regression now FAILS the run loudly.
      await assertNameNotCrushed(idB);

      // GAP-10-F long-name fixture: a deliberately overlong name must degrade
      // gracefully via ellipsis (bounded box, no layout break), NOT hard-crush
      // the rest of the row. Exercises the ellipsis budget the rail relies on.
      const idLong = await addSession(ctx);
      const longName = 'Marketing Parlour Long Session Name For Overflow Test';
      await openEditModal(idLong);
      await setInputByTestId('edit-name', longName);
      await clickByTestId('edit-save');
      await waitForTestIdGone('session-edit-modal');
      await browser.waitUntil(
        async () => (await rowText(idLong)).includes('Marketing Parlour'),
        { timeout: 5000, interval: 100, timeoutMsg: 'long-name rename did not land' },
      );
      await assertLongNameDegradesGracefully(idLong);

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
    id: 'sidebar-waiting',
    title: 'Waiting row amber treatment (D-09)',
    designRefs: [
      'DESIGN.md §Status system (waiting=amber, reserved)',
      '10-UI-SPEC.md §Interaction Contract (Waiting row)',
    ],
    expects:
      'A waiting row carries an amber left edge bar + a light amber tint wash (D-09) — ' +
      'static, no pulse. Driven via a deterministic STYLING-ONLY data-agent seam.',
    prepare: async (ctx) => {
      // IN-05 deterministic seam: the amber [data-agent='waiting'] CSS rule fires on the
      // attribute ALONE, so we make the styling capturable WITHOUT a real agent process by
      // poking data-agent='waiting' directly onto a real row's DOM node. This is a
      // PRESENTATION-ONLY proof ("does the CSS render amber") — it deliberately does NOT
      // exercise the real frame-stability detector. Detector EMISSION is covered elsewhere:
      // the agent-state-replay oracle (classify() emits exactly 1 WAITING from the real
      // claude --rc capture) + the WR-02 chain trace in 10-05-SUMMARY + the manual gate.
      const id = await addSession(ctx);
      await browser.execute((sid: string) => {
        const row = document.querySelector<HTMLElement>(
          `.sidebar-row[data-session-id="${sid}"]`,
        );
        row?.setAttribute('data-agent', 'waiting');
      }, id);
      // Let the amber edge bar + wash paint before capture.
      await browser.pause(300);
    },
  },
  {
    id: 'inactive-recipes',
    title: 'Inactive List dashed recipe cards (ghost ▶ Start)',
    designRefs: [
      'DESIGN.md §Status system (idle/slate ramp)',
      'DESIGN.md §v1 component inventory (IdeSidebarRow)',
    ],
    expects:
      'Inactive List rows are dashed eggshell recipe cards: icon + name (line 1) + the ' +
      'startup-command secondary (line 2), with an always-visible circular ghost ▶ Start ' +
      'that fills brand-blue on hover (D-11/D-13, Gap 5 closed).',
    prepare: async (ctx) => {
      // Create a session, configure it (name + emoji + a saved startup command so it is
      // a CONFIGURED recipe), then Remove it — a configured Remove keeps the recipe and
      // optimistically flips the row to not_started, landing it in the Inactive List as a
      // dashed recipe card with the ghost ▶ and the startup-command secondary line.
      const idR = await addSession(ctx);
      await openEditModal(idR);
      await setInputByTestId('edit-name', 'Dev Server');
      await setInputByTestId('edit-emoji-text', '🌱');
      await setInputByTestId('edit-startup', 'npm run dev');
      await clickByTestId('edit-save');
      await waitForTestIdGone('session-edit-modal');
      // Right-click → Remove (configured live row → keep recipe → Inactive List).
      await openContextMenu(idR);
      await waitForTestId('context-menu');
      const labels = await contextMenuLabels();
      if (!labels.includes('Remove')) {
        await pressEscape();
        await waitForTestIdGone('context-menu');
        throw new SkipSurface(
          `context menu has no "Remove" item (items: ${labels.join(', ')})`,
        );
      }
      await clickMenuItem('Remove');
      // Confirm the Remove (the existing ConfirmModal — confirm button = confirm-close).
      await waitForTestId('confirm-modal');
      await clickByTestId('confirm-close');
      await waitForTestIdGone('confirm-modal');
      // Wait until the row has moved into the Inactive List (dashed recipe card).
      await browser.waitUntil(
        async () =>
          browser.execute((sid: string) => {
            const container = document.querySelector(
              '[data-testid="inactive-list"]',
            );
            return !!container?.querySelector(
              `.sidebar-row[data-session-id="${sid}"]`,
            );
          }, idR),
        {
          timeout: 8000,
          interval: 150,
          timeoutMsg: 'recipe row did not move into the Inactive List after Remove',
        },
      );
      await browser.pause(400);
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
