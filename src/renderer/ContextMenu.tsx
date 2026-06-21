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

import { Fragment, useEffect, useRef, useState } from 'react';
import { clampToViewport } from './viewport-clamp';

/** A single menu entry: a visible label + the action to run when chosen. */
export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  /** D-15: render in the --color-danger ramp (destructive Remove/Delete). */
  danger?: boolean;
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

  // D-14: open at the raw cursor anchor, then measure-then-clamp so the whole menu
  // stays inside the viewport (it used to overlap the sidebar header on a top/left
  // right-click). `pos` starts at the raw anchor and is corrected after mount once
  // the menu's own width/height is measurable. Purely additive — the focus/Esc/
  // click-outside/roving-arrow logic below is untouched.
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: x,
    top: y,
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(
      clampToViewport(
        x,
        y,
        rect.width,
        rect.height,
        window.innerWidth,
        window.innerHeight,
        8,
      ),
    );
  }, [x, y]);

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
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={onKeyDown}
    >
      {items.map((it, i) => (
        <Fragment key={it.label}>
          {/* DESIGN-AUDIT wave-4 (P1 #10): a divider before the FIRST destructive item
              sets the permanent Remove/Delete apart from the safe actions above it. */}
          {it.danger && i > 0 && !items[i - 1].danger && (
            <div className="context-menu-sep" role="separator" />
          )}
          <button
            type="button"
            role="menuitem"
            className={
              'context-menu-item' +
              (it.danger ? ' context-menu-item-danger' : '')
            }
            onClick={() => {
              it.onSelect();
              onClose();
            }}
          >
            {it.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
