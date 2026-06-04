# Phase 4: Session Identity + Sidebar UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 4-Session Identity + Sidebar UI
**Areas discussed:** Create / edit flow, Icon picker, Sidebar collapse, Keyboard switching

---

## Create / Edit Flow

### Creation flow
| Option | Description | Selected |
|--------|-------------|----------|
| Form-first | "+ Add" opens a create form; PTY spawns on submit; matches canonical scenario; needs an empty-state/default-session path | |
| Quick-add, edit after | Keep instant-spawn with default name/icon; edit form does customization | ✓ |
| Instant-spawn + auto-open form | Spawn immediately AND auto-open edit form pre-filled | |

### Edit cwd/shell on a running session
| Option | Description | Selected |
|--------|-------------|----------|
| Apply on next restart | Name/icon live; cwd/shell/startup saved, take effect on restart (form labels them) | ✓ |
| Re-spawn immediately | Changing cwd/shell restarts the PTY right away (risk: silent kill) | |
| Restart, but ask first | Prompt to confirm restart before applying cwd/shell | |

### Edit entry point (SESS-04)
| Option | Description | Selected |
|--------|-------------|----------|
| Per-row Edit button | Add an Edit control next to Restart/Close | |
| Double-click row to edit | Double-click name opens form; single-click switches | |
| Right-click context menu | Right-click row → Edit / Restart / Close (new menu component) | ✓ |

### Session header (IDENT-03)
| Option | Description | Selected |
|--------|-------------|----------|
| Slim identity bar | Thin header above terminal: icon + name + status, no controls | ✓ |
| Identity bar + Edit affordance | Same bar but click-to-edit | |
| Skip a header; beef up active highlight | No header; does not satisfy IDENT-03 as written | |

### Form surface
| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog | Reuse ConfirmModal overlay + DESIGN.md tokens | ✓ |
| Side drawer | Slides in from the right | |
| Inline row expand | Row expands in place | |

### Shell field before Phase 5 discovery
| Option | Description | Selected |
|--------|-------------|----------|
| Default + editable path | Pre-fill resolved default shell, editable path; Phase 5 upgrades to dropdown | ✓ |
| Minimal platform list now | Small hardcoded list + custom path (throwaway) | |
| Pull shell discovery forward | Build Phase 5 discovery now (scope creep) | |

**User's choice:** Quick-add then edit; cwd/shell/startup apply on restart; edit via right-click context menu; slim identity-only header; modal form; default+editable shell path.
**Notes:** The form is effectively an edit form (no form-first create). Name/icon are the only fields that mutate a live session; everything else drives the next spawn. Context menu is reused as the collapsed-rail control surface.

---

## Icon Picker

### Icon kinds exposed (SESS-03)
| Option | Description | Selected |
|--------|-------------|----------|
| Emoji + color | Emoji + color badge; skip preset UI (type retains it) | ✓ |
| All three (emoji + presets + color) | Literal SESS-03; needs a defined preset set | |
| Emoji only | Simplest; drops color badge | |

### Emoji selection
| Option | Description | Selected |
|--------|-------------|----------|
| Curated grid + free-text | Hand-picked set + a field to type/paste any emoji | ✓ |
| Curated grid only | Hand-picked set, no free entry | |
| Full searchable library | Bundle emoji-mart-style picker (dependency/weight) | |

### Color picker
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed warm palette | Preset swatches from DESIGN.md (no arbitrary hex) | ✓ |
| Palette + custom hex | Swatches plus optional hex input | |
| Full native color input | Just an <input type=color> wheel | |

### Color badge content
| Option | Description | Selected |
|--------|-------------|----------|
| Colored badge + initial | Filled badge with first letter of session name | ✓ |
| Plain color swatch | Solid color dot (today's behavior) | |

**User's choice:** Emoji + color only; curated emoji grid + free-text fallback; fixed warm palette; color icon renders as a badge with the session's initial.
**Notes:** Initial-in-badge chosen specifically to keep color-kind sessions identifiable in the collapsed rail.

---

## Sidebar Collapse

### Collapse trigger / behavior (NAV-02)
| Option | Description | Selected |
|--------|-------------|----------|
| Pinned toggle button | Chevron toggles fold to icon-only / expand; state stays put | ✓ |
| Hover-to-expand | Stays collapsed, expands on hover (no persistent state) | |
| Toggle button + keyboard shortcut | Button plus Cmd/Ctrl+B (key competes with terminal) | |

### Collapsed rail content
| Option | Description | Selected |
|--------|-------------|----------|
| Icon + status dot + tooltip | Icon + status-color dot; hover shows name; controls via context menu | ✓ |
| Icon + status dot only | No tooltip; name only on expand | |
| Icon only | No status dot or tooltip (weakens NAV-01/02) | |

**User's choice:** Pinned toggle button; collapsed rail shows icon + status dot + hover tooltip; per-row controls via the right-click context menu.
**Notes:** The collapse decision pays off the context-menu choice from Area 1 — it's the control surface when row buttons are hidden.

---

## Keyboard Switching

### Next/previous scheme (NAV-05; positions = Cmd/Ctrl+1–9)
| Option | Description | Selected |
|--------|-------------|----------|
| Shift+[ / Shift+] | Cmd/Ctrl+Shift+[ prev, ] next (VS Code/browser convention) | ✓ |
| Ctrl+Tab cycling | Ctrl+Tab / Ctrl+Shift+Tab (higher terminal conflict) | |
| Cmd/Ctrl+Alt+Arrows | Arrow-based prev/next | |

### Capture policy
| Option | Description | Selected |
|--------|-------------|----------|
| App always wins | Shortcuts reserved app-wide, never reach the PTY (mac Cmd natural; Windows Ctrl intercepted) | ✓ |
| Terminal-first, shortcuts fallback | Terminal consumes keys first (inconsistent) | |

### Key coverage
| Option | Description | Selected |
|--------|-------------|----------|
| Switching only | Just position + next/prev (NAV-05 exactly) | ✓ |
| Add 'new session' key | Also bind Cmd/Ctrl+T or +N | |
| Add new + close keys | Full tab-style new + close (beyond NAV-05) | |

**User's choice:** Cmd/Ctrl+1–9 positions + Cmd/Ctrl+Shift+[ ] prev/next; app always wins; switching only.
**Notes:** Bracket keys chosen to dodge the tmux/vim/fzf conflict that Ctrl+Tab would risk. Mechanism of interception left to planning (Menu accelerators vs renderer capture vs xterm custom-key handler).

---

## Claude's Discretion

- Interception mechanism for "app always wins" shortcuts (D-13) on both platforms.
- The exact curated emoji set and warm color swatches, sourced from DESIGN.md.
- Context-menu component implementation; whether expanded-mode Restart/Close stay as buttons or fold into the menu.
- Form validation / empty-state behavior; presentation of the "applies on restart" hint.
- Whether collapse state is component-local (persistence deferred to Phase 5).

## Deferred Ideas

- Preset/built-in glyph icon kind UI (SESS-03 "built-in icon list") — not surfaced in v1 picker.
- Keyboard shortcuts for new/close session (Cmd/Ctrl+T, Cmd/Ctrl+W) — out of NAV-05 scope.
- Sidebar collapse-state persistence across restarts — Phase 5.
- Platform-aware shell discovery for the form dropdown — Phase 5.
- Session-order persistence (NAV-04) — Phase 5.
- TERM-05 startup-command auto-run — still deferred (form stores the field only).
- Session-header quick controls (clear/restart) — TERM-12 / Phase 6.
