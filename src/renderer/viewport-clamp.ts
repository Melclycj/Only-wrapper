// RENDERER ONLY — the pure D-14 "keep a context menu inside the viewport" clamp math
// (Phase 10-01 Task 1). Consumed by ContextMenu.tsx in Plan 03 (measure-then-clamp: the
// menu measures its own width/height after mount, then calls this to snap its left/top
// inside the visible viewport with a uniform margin).
//
// Imports NOTHING from React/xterm/electron so the math is unit-testable in the Node/Vitest
// env (mirrors scrollback-clamp.ts). PURE — no I/O, no DOM, no electron.

/**
 * Clamp a menu's desired top-left (x, y) so the whole `w`×`h` box stays inside the
 * `vw`×`vh` viewport with at least `margin` px on every edge (D-14).
 *
 * For each axis: `pos = max(margin, min(desired, size - extent - margin))`.
 *
 * - fits as-is: clampToViewport(10, 10, 140, 200, 1280, 800, 8) → { left: 10, top: 10 }
 * - overflow right: x=1200, w=140, vw=1280, margin=8 → left = 1280-140-8 = 1132
 * - overflow bottom: y=700, h=200, vh=800, margin=8 → top = 800-200-8 = 592
 * - off the top-left: x=2, y=2, margin=8 → clamped up to { left: 8, top: 8 }
 * - menu larger than viewport: w=2000, vw=1280, margin=8 → left resolves to 8
 *   (margin wins; the inner min goes negative, the outer max pulls it back to margin)
 */
export function clampToViewport(
  x: number,
  y: number,
  w: number,
  h: number,
  vw: number,
  vh: number,
  margin: number,
): { left: number; top: number } {
  return {
    left: Math.max(margin, Math.min(x, vw - w - margin)),
    top: Math.max(margin, Math.min(y, vh - h - margin)),
  };
}
