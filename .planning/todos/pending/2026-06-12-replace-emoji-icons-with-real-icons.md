---
created: 2026-06-12T03:50:00.000Z
title: Replace emoji icon glyphs with a real icon system
area: ui
files:
  - src/renderer/Sidebar.tsx
  - src/renderer/sidebar.css
  - src/shared/types.ts
---

## Problem

Operator request at the Phase-10 gate attempt 3 (2026-06-12, verbatim): "later i
need to remove all emoji that represent icon and generate real icons."

Today every icon-like glyph in the chrome is an emoji or text character:

- Session icon tiles render emoji via the `SessionIconSpec` `emoji` kind
  (`renderIcon` in Sidebar.tsx — D-04 keeps three kinds: emoji | preset | color badge).
- Row controls are text glyphs: ▶ Start, ⏵ Start-without-command, ✎ Edit, ✕ Close,
  ↻ Restart, drag-handle dots.
- Emoji rendering varies by platform (macOS vs Windows) and fights the "calm,
  intentional" DESIGN.md chrome; cross-platform packaging (Phase 8 / WIN-01) makes
  this worse.

## Solution

TBD — sketch:
1. Pick an icon system (e.g. lucide/heroicons SVG set, or hand-drawn set matching
   the parlour brand) and an integration pattern (inline SVG components; no icon
   font).
2. Replace control glyphs (▶ ⏵ ✎ ✕ ↻, drag dots) first — they are chrome-owned and
   uncontroversial.
3. Decide the session-icon story: keep user-chosen emoji as ONE of the
   `SessionIconSpec` kinds (user data, can't silently drop) but add a curated
   real-icon preset library; keep the single `renderIcon` source.
4. Update @xterm/addon-unicode11 assumptions only if emoji leave the sidebar
   entirely (terminal content emoji are unaffected).
5. ui-lab captures re-baseline (all surfaces show control glyphs).

Candidate phase: design-token/visual follow-up after v1.1 UI phases (pairs with the
animation-system todo — both are "define the visual language" work).
