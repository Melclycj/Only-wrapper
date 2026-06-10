---
phase: quick-260605-ki7
plan: 01
subsystem: renderer-sidebar-ui
tags: [ui-polish, sidebar, icons, collapsed-rail, NAV-02, SESS-03]
requires: [Sidebar.tsx onEdit prop (existing), .row-controls hide rule (existing)]
provides:
  - "Collapsed-aware add-session label ('+' collapsed / '+ Add session' expanded)"
  - "Icon-glyph row controls: Restart ↻ · Edit ✎ · Delete ✕"
  - "Inline edit-session affordance (data-testid edit-session) wired to existing onEdit"
  - "Compact square monochrome .row-control icon-button styling"
affects: [src/renderer/Sidebar.tsx, src/renderer/terminal.css]
tech-stack:
  added: []
  patterns: ["render-only presentational change", "aria-hidden glyph + aria-label button pattern"]
key-files:
  created: []
  modified:
    - src/renderer/Sidebar.tsx
    - src/renderer/terminal.css
decisions:
  - "Trash intent conveyed by ✕ glyph + existing .row-control-close red-ramp hover (no emoji, crisp monochrome currentColor)"
  - "Inline pencil reuses the existing onEdit prop — no new prop/handler/import; collapsed rail still hides the whole cluster via the unchanged .row-controls hide rule (context menu remains the collapsed control surface, D-11)"
metrics:
  duration: ~4min
  completed: 2026-06-05
requirements: [NAV-02, SESS-03]
---

# Quick 260605-ki7: Phase-4 Sidebar UI Polish (collapsed add + icon row controls) Summary

Presentational-only sidebar polish from Phase-4 UAT: the collapsed rail's add button now shows just `+`, and each row's text controls became a calm, always-legible icon cluster — Restart `↻` · Edit `✎` (new inline pencil) · Delete `✕` — with no behavior, IPC, SessionManager, or context-menu changes.

## What Was Built

Three render-only edits across two files (one atomic code commit, `0ea3d68`):

- **CHANGE 1 — collapsed add label (Sidebar.tsx):** The `.add-session` button child is now `<span>{collapsed ? '+' : '+ Add session'}</span>`, gated by the existing `collapsed` prop. Added `aria-label="Add session"` so the collapsed `+`-only state stays accessible. `type`, `className="add-session"`, `data-testid="add-session"`, and `onClick={onAdd}` unchanged.
- **CHANGE 2 — icon-glyph row controls (Sidebar.tsx):** Render order is Restart (if `!running`) · Edit · Delete.
  - Restart: visible child swapped `Restart` → `<span aria-hidden="true">↻</span>`; kept `!running &&` conditional, `data-testid="restart-session"`, `data-action="restart"`, `aria-label`, `title`, and `onClick` (stopPropagation → `onRestart`).
  - Edit (NEW, always rendered): `data-testid="edit-session"`, `data-action="edit"`, `title="Edit session"`, `aria-label={`Edit ${s.name}`}`, child `<span aria-hidden="true">✎</span>`, `onClick={(e) => { e.stopPropagation(); onEdit(s.logicalId); }}` — reuses the existing `onEdit` prop (no new prop/handler).
  - Delete: visible child swapped `Close` → `<span aria-hidden="true">✕</span>`; kept `data-testid="close-session"`, `data-action="close"`, both classes `row-control row-control-close`, `aria-label`, `title`, and `onClick` (stopPropagation → `onClose`).
- **CHANGE 3 — compact icon-button CSS (terminal.css):** `.sidebar-row .row-control` restyled from a text pill (`padding: 2px 8px`, `border: 1px solid var(--line)`, `font-size: 11px`) into a 24×24 square monochrome icon button: `display:inline-flex` centered, `padding:0`, `border-radius:7px`, `border-color: transparent`, `background: transparent`, `color: var(--ink-soft)`, `font-size:14px`, `line-height:1`. The existing `.row-control:hover` warm treatment, the `.row-control-close:hover` destructive red ramp, the `.row-controls` reveal-on-hover, and the `.sidebar.collapsed .row-controls { display:none }` hide rule were all left untouched (so the new pencil stays hidden in the collapsed rail).

Only DESIGN.md tokens used (`--ink-soft`, `--ink`, `--bg-sunk`, `--line`); no new colors, no hardcoded hex. Renderer remains free of any electron/node-pty import.

## Verification

- `npm run test:unit` → 82/82 GREEN (no regression; assertions are testid-based, unaffected by the text→glyph swap).
- `npx tsc --noEmit` → clean.
- Plan grep acceptance checks all pass: `edit-session` testid present + wired to `onEdit(s.logicalId)`; `add-session`/`close-session`/`restart-session` preserved; `collapsed ?` gates the add label; no `>Restart<` / `>Close<` literal button text remains; `terminal.css` still contains `row-controls`; the `.sidebar.collapsed` hide block still lists `.row-controls`.
- The 3 Phase-4 E2E smoke tests reach Edit via the context menu (`clickMenuItem('Edit')`) and assert on testids, so the inline-pencil swap cannot affect them — heavy E2E suite not required per plan.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/renderer/Sidebar.tsx (modified, `data-testid="edit-session"` present)
- FOUND: src/renderer/terminal.css (modified, compact `.row-control` present)
- FOUND: commit 0ea3d68
