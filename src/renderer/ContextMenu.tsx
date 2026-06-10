// RENDERER ONLY — a right-click context menu for a sidebar row (04-02, D-03).
//
// A CONTROLLED component (its open/x/y/items + onClose live in SessionManager, like
// `closingId`). It is the ONLY control surface when the sidebar is collapsed
// (Pitfall 5 / D-11), so it is opened from a `.sidebar-row`-level `onContextMenu`
// (which fires in both expanded and collapsed modes).
//
// It copies the ConfirmModal document-listener + Esc cleanup idiom (ConfirmModal.tsx:
// 36-47): a document `mousedown` (click-outside) + `keydown(Escape)` pair, both torn
// down on unmount. Items are `{ label, onSelect }` rendered as role="menuitem" buttons
// with arrow-key roving focus. Styled from DESIGN.md tokens (warm --surface card,
// --line border, Nunito) in terminal.css.

import { useEffect, useRef } from 'react';

/** A single menu entry: a visible label + the action to run when chosen. */
export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
}

export interface ContextMenuProps {
  /** Viewport x (clientX) the menu's left edge anchors to. */
  x: number;
  /** Viewport y (clientY) the menu's top edge anchors to. */
  y: number;
  items: ContextMenuItem[];
  /** Dismiss the menu (click-outside, Esc, or after an item runs). */
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: ContextMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside (document mousedown) + Esc dismiss, mirroring the ConfirmModal
  // add/remove listener pair. Focus the first item so arrow keys work immediately.
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLButtonElement>('.context-menu-item')
      ?.focus();
    const off = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', off);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  // Roving arrow-key focus across the menu items (a11y — role="menu").
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('.context-menu-item') ??
        [],
    );
    if (buttons.length === 0) return;
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const base = current < 0 ? 0 : current;
    const next = (base + delta + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  return (
    <div
      ref={ref}
      role="menu"
      className="context-menu"
      data-testid="context-menu"
      style={{ left: x, top: y }}
      onKeyDown={onKeyDown}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          className="context-menu-item"
          onClick={() => {
            it.onSelect();
            onClose();
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
