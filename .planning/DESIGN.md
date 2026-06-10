---
kind: design-reference
product_name_in_mockup: Switchboard
source: .planning/design/switchboard-mockup.html (Claude standalone artifact — React; JS bundled gzip+base64 in the file)
captured: 2026-06-04
status: north-star reference (visual authority). ROADMAP.md + REQUIREMENTS.md remain the SCOPE authority.
scope_note: The mockup is built against the FULL product (incl. v2). This file extracts the v1-usable subset and explicitly defers the rest. Do NOT build v2 elements during v1 phases.
---

# Just-Wrapper — Design Reference

The user generated a high-fidelity design ("Switchboard") covering the whole product. This document is the **visual north star** for v1: the design *system* applies to every v1 screen; the *component subset* below is mapped to the phase that owns it; everything under **Deferred (v2)** is captured but must not be built during v1.

**Rule:** DESIGN.md is the *visual* authority. ROADMAP.md / REQUIREMENTS.md are the *scope* authority. When they appear to conflict (e.g. the mockup shows a browser panel), scope wins — defer it.

---

## Aesthetic direction

Warm, rounded, **cozy** — a "parlour," not a cold dev tool (fits the canonical `🛋️ Parlour Claude RC` scenario). Soft cream/ivory surfaces, generous rounding (18px cards, pill chips), friendly geometric sans for UI, monospace only inside terminals. Calm, low-contrast chrome so the terminal content is the focus. Agent-centric: a session's headline state is *"is it waiting for me / running / done / idle,"* surfaced with color + label, not just a process flag.

---

## Design tokens — the v1 design system (applies to ALL v1 UI)

Colors are **oklch** (Electron's Chromium supports it natively). Ship these as CSS custom properties; reuse everywhere.

### Surface / ink (from the mockup `TOKENS`)
| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `oklch(0.975 0.008 85)` | warm-white app interior |
| `--bg-sunk` | `oklch(0.955 0.01 85)` | recessed areas |
| `--surface` | `#ffffff` | cards / panels |
| `--ink` | `oklch(0.32 0.012 70)` | primary text (warm charcoal) |
| `--ink-soft` | `oklch(0.50 0.012 70)` | secondary text |
| `--ink-faint` | `oklch(0.66 0.01 75)` | tertiary/labels |
| `--line` | `oklch(0.91 0.008 80)` | borders |
| `--line-soft` | `oklch(0.94 0.006 80)` | hairlines |
| `--radius` | `18px` | card radius (chips = 999px, inputs ≈ 8px) |

### Terminal palette (Phase 2/3 — feeds the xterm theme)
| Token | Value | Use |
|-------|-------|-----|
| `--term-bg` | `oklch(0.255 0.018 264)` | soft charcoal-indigo terminal background (NOT pure black) |
| `--term-text` | `oklch(0.90 0.012 250)` | terminal foreground |
| `--term-faint` | `oklch(0.66 0.02 255)` | dim/secondary terminal text |

> Line-kind tints seen in the mockup's mini-terminal: `cmd` (prompt), `out` (normal), `ok` (green ✓), `warn` (amber ⚠), `prompt` (attention). In v1 the real xterm renders raw ANSI — use this palette for the **container/theme**, let programs drive their own colors (truecolor per SC4).

### Status system (agent-state — maps onto v1 statuses; see reconciliation)
Four states with `strong / deep / tint / ring` ramps, ordered by attention (`rank`):

| Mockup state | Label / short | Accent (`strong`) | v1 meaning |
|--------------|---------------|-------------------|------------|
| `waiting` (rank 0) | "Waiting for you" / "Waiting" | amber `oklch(0.66 0.15 60)` | **TERM-09** needs-attention heuristic (best-effort) — an overlay, not a core process status |
| `in-progress` (rank 1) | "In progress" / "Running" | blue `oklch(0.62 0.14 248)` | TERM-08 `running` |
| `finished` (rank 2) | "Finished" / "Done" | green `oklch(0.60 0.13 150)` | TERM-08 `exited` (clean) |
| `free` (rank 3) | "Free" / "Idle" | slate `oklch(0.64 0.02 260)` | TERM-08 `not_started` / running-but-idle shell |
| *(add for v1)* | "Stopped" / "Error" | reuse slate / a red ramp | TERM-08 `stopped` / `error` — not in the mockup; derive a red ramp consistent with the palette |

Each state also has `tint` (background wash), `ring` (focus/border) — use for the sidebar row, status dot, and badge.

### Typography
| Role | Family | Notes |
|------|--------|-------|
| UI | **Nunito** | primary; rounded geometric sans |
| Accent/Display | Quicksand, Varela Round | headings/playful accents |
| Terminal / code | **JetBrains Mono** | the only monospace; the xterm font |

Bundle these as local woff2 (the mockup embeds them; they're in `.planning/design/switchboard-mockup.html`). Note: user-configurable UI/terminal font is **v2** (APPR-01) — v1 ships these as fixed defaults.

---

## v1 component inventory → owning phase

Build only these, each in its phase, styled from the tokens above:

| Component (mockup name) | What it is | v1 phase | Requirement |
|-------------------------|-----------|----------|-------------|
| Terminal pane / `MiniTerminal` → real xterm | full-window terminal: `--term-bg`, JetBrains Mono, prompt, "process exited" notice | **Phase 2–3** | TERM-01..04 |
| `IdeLayout` (sidebar + terminal) | THE v1 layout — collapsible left rail of sessions + active terminal on the right | **Phase 4** | NAV-01/02/03 |
| `SessionCard` / `IdeSidebarRow` | sidebar row: icon + name + status dot/label (+ cwd/host secondary) | **Phase 4** | NAV-01, SESS-02/03, IDENT-03 |
| Collapsed rail icon (`RailIcon`/`IconTile`) | icon-only identity when sidebar is folded | **Phase 4** | NAV-02, SESS-03 |
| Session create/edit form | name · icon (emoji/preset/color) · cwd · shell · startup cmd | **Phase 4** | SESS-01..04 |
| Status dot / badge (`Dot`, `Bar`) | the status color language above | **Phase 3–4** | TERM-08 |
| Needs-attention treatment (`ApproveDeny`, "Needs your attention", `prompt`) | amber "waiting for you" surfacing of a blocked/awaiting-input session | **Phase 3–4** | TERM-09 (best-effort) |
| Session header / quick controls (clear, restart) | per-session header actions | **Phase 3–4** | TERM-12 |
| `HostChip` (subset) | small per-session meta chip | Phase 4 | optional (local only in v1) |

---

## Deferred to v2 / out of v1 scope — capture, do NOT build

These appear in the mockup but are **not** v1 (per REQUIREMENTS.md §Out of Scope / v2):

- **Browser companion** — `BrowserView`, "Browser mode", "Switchboard — browser", URL bar, "New tab", fold-panel-and-open-browser → **v2 BROW-\***.
- **Alternate session layouts** — `BentoLayout`, `GridLayout` (terminal previews), `KanbanLayout`, `OrbitLayout`, "Mission control", `LayoutSwitcher` → v1 ships **only** the IDE (sidebar+terminal) layout.
- **Appearance / Tweaks panel** — theme, dark/light mode, palette, **wallpaper**, density, UI-font + font-size pickers, "Default layout" → **v2 APPR-01/02** (v1 ships a single fixed warm theme + fixed fonts).
- **Docs / help section** — `MockDocs`, "Switchboard Docs", "Getting started", "Shortcuts", "About" → not a v1 requirement.
- **`host: 'web'` / remote sessions**, per-session **git branch** chip, per-session **progress %** → not in the v1 `SessionRecord`; treat as v2/nice-to-have (v1 sessions are local; SessionRecord fields are fixed by D-01).

---

## Reconciliation notes (design ↔ locked v1 decisions)

- **Status taxonomy:** the mockup's *agent* states (waiting/in-progress/finished/free) are an attention-oriented **presentation layer** over v1's *process* statuses (D-02: `not_started|running|stopped|exited|error`). Keep the v1 model as the source of truth; map it to the mockup's color/label language. "Waiting for you" = the TERM-09 best-effort heuristic, not a 6th process status. v1 must also style `stopped` and `error` (no mockup state — derive a red ramp).
- **Icon:** the mockup uses emoji icons; v1's `SessionIconSpec` (D-03) already supports `emoji | preset | color` — the sidebar row must render all three `kind`s, not just emoji.
- **Terminal:** the mockup's `lines[{t,text}]` is a *mock*; v1 renders a **real xterm** over the PTY. Use the mockup only for the terminal *theme* (`--term-*`, JetBrains Mono), not its line model.
- **Product name:** the mockup brands the app "Switchboard." v1's name is **Just-Wrapper** (window title shows "Just-Wrapper vX"). Treat "Switchboard" as mockup-only naming unless the user decides to adopt it.
- **Fonts/theme are fixed in v1** (configurability is v2 APPR-01/02).

---

## How downstream phases consume this

- **Phase 4 (Session Identity + Sidebar UI)** — the big payoff. When you run `/gsd-ui-phase 4`, this file is a canonical input: the UI-SPEC should realize `IdeLayout` + `SessionCard` + create/edit form + status language from the tokens above.
- **Phase 2–3 (terminal)** — adopt the `--term-*` palette + JetBrains Mono for the xterm theme and the "process exited" notice. Cheap to apply now; no rework later. (Plans 02-03/02-04 build `TerminalPane.tsx` — the executor can pull the theme from here.)
- **Phase 3 (lifecycle/status)** — use the status color/label language for TERM-08 statuses and the TERM-09 needs-attention treatment.
- Add `DESIGN.md` (and `.planning/design/switchboard-mockup.html`) to the canonical_refs of those phases' CONTEXT.md when they're discussed.
