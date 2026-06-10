// Wave 4 best-effort search-bar smoke (07-04 Task 1) — covers TERM-10 / SC1 / SC3
// (the DRIVABLE subset). Boots the real Electron build, starts a session, drives the
// native Find chord (Cmd+F mac / Ctrl+F win) through `webContents.sendInputEvent`, and
// asserts the search-bar overlay opens, the search-input is present + focusable, and
// Esc dismisses the bar (and does not interfere once closed).
//
// ── Drive path (NOT browser.keys) ────────────────────────────────────────────
// The Find chord rides the EXISTING 'session:switch' channel as { kind: 'search' }
// (Plan 01, zero new bridge key), intercepted MAIN-side by before-input-event. WDIO's
// CDP `browser.keys` does NOT traverse Electron's native before-input-event pipeline
// (the A1 empirical finding in xterm-driver.pressSwitchChord) — so this spec drives the
// chord via `pressFindChord()` (webContents.sendInputEvent), the only path that reaches
// the interceptor. This is the same proven native-chord pattern keyboard-switch.smoke
// uses for the switch chords.
//
// ── MANUAL-ONLY deferrals (07-VALIDATION.md §Manual-Only Verifications) ───────
// The "N of M" match count, the Aa case toggle, and next/prev navigation are NOT
// asserted here. They depend on a rendered xterm over a WebGL canvas, and the
// match-count (onDidChangeResults against a live buffer) is brittle to assert
// headless — that is the documented manual-only rationale in 07-VALIDATION.md and
// 07-RESEARCH.md (§Validation Architecture). Those behaviors are owned by the
// macOS-first manual checklist (07-04 Task 2 / 07-VALIDATION.md), not by this smoke.
// This spec deliberately scopes to the reliably-drivable structural assertions:
//   • the find chord OPENS the overlay (the chord→channel→renderer→searchOpenId path)
//   • the search-input is present and focusable
//   • Esc CLOSES the overlay (SC3 dismiss)
//   • once closed, the bar no longer exists (SC3 no-interference precondition)
// Do NOT add a flaky headless match-count assertion here — the manual checklist owns it.

/// <reference types="@wdio/electron-service" />
/// <reference types="@wdio/mocha-framework" />

import { ensureSession, pressFindChord } from './helpers/xterm-driver';

/** Whether the search-bar overlay is currently mounted in the DOM. */
async function searchBarPresent(): Promise<boolean> {
  return browser.execute(
    () => document.querySelector('[data-testid="search-bar"]') !== null,
  );
}

/** Whether the search-input is the active (focused) element. */
async function searchInputFocused(): Promise<boolean> {
  return browser.execute(() => {
    const input = document.querySelector('[data-testid="search-input"]');
    return input !== null && document.activeElement === input;
  });
}

/** Dispatch a real Escape keydown at the focused search-input (the SC3 dismiss path). */
async function pressEscapeOnSearchInput(): Promise<void> {
  await browser.execute(() => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="search-input"]',
    );
    input?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

describe('Search bar smoke (TERM-10 / SC1 / SC3 — drivable subset)', () => {
  it('Cmd/Ctrl+F opens the search bar, focuses the input, and Esc dismisses it', async () => {
    await ensureSession();

    // The bar must NOT be open before the chord (precondition).
    expect(await searchBarPresent()).toBe(false);

    // SC1: the native Find chord opens the overlay over the active session.
    await pressFindChord();
    await browser.waitUntil(async () => searchBarPresent(), {
      timeout: 3000,
      timeoutMsg: 'Cmd/Ctrl+F did not open the search-bar overlay',
    });
    expect(await searchBarPresent()).toBe(true);

    // The search-input auto-focuses on open (so the user can type immediately).
    await browser.waitUntil(async () => searchInputFocused(), {
      timeout: 3000,
      timeoutMsg: 'search-input did not receive focus on open',
    });
    expect(await searchInputFocused()).toBe(true);

    // SC3: Esc dismisses the overlay; the bar unmounts (no lingering input sink).
    await pressEscapeOnSearchInput();
    await browser.waitUntil(async () => !(await searchBarPresent()), {
      timeout: 3000,
      timeoutMsg: 'Esc did not dismiss the search-bar overlay',
    });
    expect(await searchBarPresent()).toBe(false);
  });
});
