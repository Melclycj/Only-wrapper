// RENDERER ONLY — a dependency-free focus-trap hook for the 4 modal dialogs
// (DESIGN-AUDIT wave-2, P0-D). The 4 modals each hand-copy the same overlay/dialog/
// Esc/focus-on-open skeleton; this hook adds the two a11y pieces that were missing
// from all of them: (1) Tab/Shift+Tab are TRAPPED inside the dialog so focus never
// escapes an aria-modal="true" surface to the background app (WCAG 2.4.3 / 2.1.2), and
// (2) on close the focus is RESTORED to the element that opened the modal (so a keyboard
// user lands back where they were, not on <body>). Esc stays OWNED by each modal — this
// hook deliberately does not handle it (the modals already wire Esc=cancel/close).
//
// Returns a ref to attach to the dialog container <div> (the role="dialog" card). Call it
// unconditionally with the modal's open flag (Rules of Hooks): a modal that returns null
// when closed still calls useFocusTrap(open) every render; the ref attaches while open.

import { useEffect, useRef } from 'react';

// Tab-order focusables, then filtered to visible (offsetParent !== null skips
// display:none / hidden ancestors). Matches the audit-specified selector verbatim.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null,
  );
}

// Returns a ref typed `HTMLDivElement | null` — the accurate React 19 shape for a
// null-initialized ref; it still attaches directly to a `<div ref={…}>` dialog container.
export function useFocusTrap(
  active: boolean,
): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  // The element focused at open time, restored on close (guarded if it has since left
  // the DOM — e.g. the opener row was removed while the modal was up).
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    // Remember who had focus, then move focus inside: the first focusable, else the
    // container itself when it is programmatically focusable (has a tabindex).
    openerRef.current = document.activeElement;
    const first = focusableWithin(container)[0];
    if (first) first.focus();
    else if (container.hasAttribute('tabindex')) container.focus();

    // Trap Tab at the edges: Tab off the LAST wraps to first; Shift+Tab off the FIRST
    // wraps to last. Recomputed per keydown so a dynamic dialog (fields appearing/
    // disappearing) always wraps against the current focusable set.
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const focusables = focusableWithin(container);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    container.addEventListener('keydown', onKeyDown);

    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // Restore focus to the opener if it is still connected and focusable.
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [active]);

  return containerRef;
}
