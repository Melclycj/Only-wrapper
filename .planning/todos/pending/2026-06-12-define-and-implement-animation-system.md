---
created: 2026-06-12T03:50:00.000Z
title: Define the application's animation/motion system and implement it
area: ui
files:
  - src/renderer/tokens.css
  - src/renderer/sidebar.css
  - src/renderer/terminal.css
---

## Problem

Operator request at the Phase-10 gate attempt 3 (2026-06-12, verbatim): "I also
want to define the animation of this application and implement them in the future."

There is currently no defined motion language. Existing choices are deliberately
static (locked D-09: amber waiting treatment is "Static — no pulsing/animation";
DESIGN.md north star is calm, low-contrast chrome). Any future motion must be
DEFINED first (a motion spec) rather than sprinkled ad hoc, or it will fight the
parlour calm.

## Solution

TBD — sketch:
1. Motion spec first: duration/easing tokens in tokens.css
   (`--duration-fast/normal`, `--ease-out-*`), what moves (sidebar
   collapse/expand, row hover reveal, status transitions, modal/menu open,
   drag-reorder) and what NEVER moves (terminal content, waiting amber per D-09
   unless explicitly re-decided).
2. Compositor-friendly properties only (transform/opacity); respect
   `prefers-reduced-motion` from day one.
3. Implement in slices per surface; ui-lab captures stay static-friendly (capture
   at rest state or after animation settle).
4. Cross-check D-09's "no pulsing" lock before animating any status treatment —
   changing that requires an explicit operator re-decision.

Candidate phase: pairs with the real-icons todo as a "visual language v2" phase
after v1.1's planned UI work.
