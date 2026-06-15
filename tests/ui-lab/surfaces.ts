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

/**
 * Set a text input's value (by data-testid) so React's `onChange` ACTUALLY fires.
 *
 * A bare `input.value = v; dispatchEvent('input')` sets the DOM value but React 19's
 * controlled-input value tracker suppresses the synthetic onChange (the same
 * tracker-bypass the edit modal's ref-read handleSave is built to tolerate). For
 * SAVE that is fine — handleSave reads the live DOM via refs. But the inline
 * D-04 VALIDATION notices are derived from React STATE (`name`/`cwd`), so a
 * tracker-suppressed fill leaves state at the seeded values and the hints NEVER
 * render — the `edit-modal-validation` capture would show a form with no hints,
 * a false-negative against the rubric. Driving the field through the native value
 * setter (`HTMLInputElement.prototype.value`'s setter) defeats the tracker so
 * onChange fires and the validation state updates — the standard React testing
 * idiom. Used by every surface; required for the validation surface to be honest.
 */
async function setInputByTestId(testid: string, value: string): Promise<void> {
  await browser.execute(
    (tid: string, v: string) => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-testid="${tid}"]`,
      );
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(input) as object,
        'value',
      )?.set;
      if (setter) {
        setter.call(input, v);
      } else {
        input.value = v;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
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

/** GAP-10-H (spike 004): machine-check that the ACTIVE/selected dormant row presents
 *  EXACTLY ONE Start-labeled affordance across the sidebar row + the active terminal
 *  area. The pure `startAffordances` reducer is correct in every state, but only a unit
 *  test pinned it — this counts the rendered Start `data-testid`s in the LIVE DOM so a
 *  render-path regression (the operator's "the start button on the inactive task does
 *  not remove the original start button") FAILS the run loudly instead of being
 *  eye-scored from a PNG. Throws a descriptive Error (NOT SkipSurface). Same style as
 *  `assertNameNotCrushed`. */
async function assertSingleStartAffordance(id: string): Promise<void> {
  const counts = await browser.execute((sid: string) => {
    const row = document.querySelector<HTMLElement>(
      `.sidebar-row[data-session-id="${sid}"]`,
    );
    const inRow = row
      ? row.querySelectorAll(
          '[data-testid="start-session"], [data-testid="start-no-cmd-session"]',
        ).length
      : 0;
    // The IdleCard ▶ lives in the terminal area, not the row — count it globally
    // (only the active session's card is mounted, so this is unambiguous).
    const idleCard = document.querySelectorAll(
      '[data-testid="idle-start-session"]',
    ).length;
    return { rowFound: row !== null, inRow, idleCard };
  }, id);
  if (!counts.rowFound) {
    throw new Error(
      `assertSingleStartAffordance: no .sidebar-row for ${id} — the selected dormant row is missing entirely`,
    );
  }
  const total = counts.inRow + counts.idleCard;
  if (total !== 1) {
    throw new Error(
      `duplicate-Start regression (GAP-10-H): the ACTIVE/selected dormant row ${id} ` +
        `renders ${total} Start-labeled controls (sidebar=${counts.inRow}, ` +
        `idle-card=${counts.idleCard}) — expected EXACTLY 1 (the IdleCard ▶; the ` +
        `sidebar ▶ and ⏵ must be DOM-suppressed for the selected dormant row).`,
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

/** WR-04: the row id the `sidebar-waiting` surface poked `data-agent='waiting'`
 *  onto, recorded in prepare() so cleanup() targets the exact row (the ctx.ids
 *  list keeps growing in later surfaces, so an index lookup would be wrong). */
let waitingPokedId: string | null = null;

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
      // GAP-10-H (spike 004): with the dormant row selected and its IdleCard observably
      // mounted (waitForTestId above — gated on real DOM state, not a bare pause), assert
      // the live DOM paints EXACTLY ONE Start-labeled control for it. A duplicate (the
      // operator's round-3 report) now FAILS the run loudly.
      await assertSingleStartAffordance(idB);
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
    id: 'edit-modal-validation',
    title: 'Session edit form — inline validation (cwd + name hints)',
    designRefs: [
      '12-UI-SPEC.md §Color (danger reserved for a genuine validation error)',
      '12-CONTEXT.md D-04 inline validation',
    ],
    expects:
      'Danger-ramp helper text under the cwd field; name hint in ink-faint; calm overall.',
    prepare: async (ctx) => {
      await openEditModal(ctx.ids[0]);
      // Drive a non-absolute cwd to trigger the renderer format hint, and clear the
      // name to trigger the neutral empty-name hint (the validation-display testids
      // land in Plan 02 — this Wave-0 scaffold still captures the modal state).
      await setInputByTestId('edit-cwd', 'not-absolute');
      await setInputByTestId('edit-name', '');
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
      'A waiting row carries a light amber tint WASH ONLY (no edge bar) (D-09, amended ' +
      '2026-06-12 GAP-10-I) — static, no pulse. Driven via a deterministic STYLING-ONLY ' +
      'data-agent seam.',
    prepare: async (ctx) => {
      // IN-05 deterministic seam: the amber [data-agent='waiting'] CSS rule fires on the
      // attribute ALONE, so we make the styling capturable WITHOUT a real agent process by
      // poking data-agent='waiting' directly onto a real row's DOM node. This is a
      // PRESENTATION-ONLY proof ("does the CSS render amber") — it deliberately does NOT
      // exercise the real frame-stability detector. Detector EMISSION is covered elsewhere:
      // the agent-state-replay oracle (classify() emits exactly 1 WAITING from the real
      // claude --rc capture) + the WR-02 chain trace in 10-05-SUMMARY + the manual gate.
      const id = await addSession(ctx);
      // WR-04: record the poked id so cleanup() removes the fabricated attribute from
      // the EXACT row we touched (not ctx.ids[length-1], which the list may outgrow
      // before cleanup runs) — stops the amber leaking into later captures.
      waitingPokedId = id;
      await browser.execute((sid: string) => {
        const row = document.querySelector<HTMLElement>(
          `.sidebar-row[data-session-id="${sid}"]`,
        );
        row?.setAttribute('data-agent', 'waiting');
      }, id);
      // WR-05: assert the attribute actually LANDED before capturing. A silent no-op
      // (selector miss / stale id) would otherwise produce a false-success screenshot of
      // a plain row. Gate on observable DOM state, not a sleep.
      await browser.waitUntil(
        async () =>
          browser.execute((sid: string) => {
            const row = document.querySelector<HTMLElement>(
              `.sidebar-row[data-session-id="${sid}"]`,
            );
            return row?.getAttribute('data-agent') === 'waiting';
          }, id),
        {
          timeout: 2000,
          interval: 100,
          timeoutMsg: `data-agent='waiting' did not land on row ${id} — the amber seam is a silent no-op`,
        },
      );
      // IN-01: the waitUntil above subsumes most of the old pause(300) hedge; keep only a
      // short settle for the WebGL amber edge-bar/wash paint to flush before capture.
      await browser.pause(120);
    },
    // WR-04: remove the fabricated data-agent so it never leaks into the
    // inactive-recipes / sidebar-collapsed captures that run after this surface.
    cleanup: async () => {
      if (!waitingPokedId) return;
      const pokedId = waitingPokedId;
      await browser.execute((sid: string) => {
        document
          .querySelector<HTMLElement>(`.sidebar-row[data-session-id="${sid}"]`)
          ?.removeAttribute('data-agent');
      }, pokedId);
      waitingPokedId = null;
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
    id: 'terminal-card',
    title: 'Inset terminal well + breathing + breadcrumb header (UI-03, GAP-11-A)',
    designRefs: [
      '.planning/design/rendered/switchboard-ide-view.png (the mockup IDE view)',
      '11-UI-SPEC.md §Interaction Contract (live unified card)',
    ],
    expects:
      "A white --surface card on the warm cream --bg with the breadcrumb header " +
      "(local / name / cwd + status) above an INSET ROUNDED charcoal WELL with white " +
      "breathing room around it (NOT flush edge-to-edge); the cwd segment reads as the " +
      "configured working dir (dotted-underline hint), not the live pwd; no glyph clipped " +
      "by a corner; Clear + Remove cluster visible; no Restart; no top status-pill strip " +
      "(removed 2026-06-14).",
    prepare: async (ctx) => {
      // Reuse the terminal-running idiom: activate the first running session so the shot
      // shows a live focal terminal inside the inset well. Pause for the WebGL/term paint.
      await clickSidebarRow(ctx.ids[0]);
      await browser.pause(400);
    },
  },
  // PLANNER-NOTE (agent-busy-confirm seam): this surface is a VISUAL confirmation of the
  // modal CHROME only (the 18px card-family dialog renders correctly). The D-04 copy BRANCH is proven by
  // the Task-1 unit test — `agentState` is renderer-only state in the sessions array, NOT a
  // DOM attribute a pure DOM poke can set, so a styling seam cannot drive the escalated copy.
  // The unit truth-table (confirm-copy.test.ts) is the machine-checkable proof of the
  // escalation prefix; this capture scores the modal frame against the RUBRIC.
  {
    id: 'agent-busy-confirm',
    title: 'Agent-busy Remove confirm modal (D-04, escalated copy)',
    designRefs: [
      '11-UI-SPEC.md §Copywriting Contract (confirm-modal copy)',
      'DESIGN.md §Design tokens (--radius, --shadow-dialog)',
    ],
    expects:
      'The Remove confirm modal for a busy agent shows the escalated copy prefix before ' +
      'the normal consequence sentence; the modal chrome is the same 18px card family ' +
      '(--radius, --shadow-dialog).',
    prepare: async (ctx) => {
      // Drive the live Remove confirm via the IdentityHeader Remove glyph (header-remove),
      // following the inactive-recipes confirm-driving idiom. The escalated COPY itself is
      // unit-proven (see PLANNER-NOTE above); this drives the modal open for a chrome shot.
      await clickSidebarRow(ctx.ids[0]);
      await browser.pause(200);
      await clickByTestId('header-remove');
      await waitForTestId('confirm-modal');
      await browser.pause(300);
    },
    cleanup: async () => {
      await clickByTestId('confirm-cancel');
      await waitForTestIdGone('confirm-modal');
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
