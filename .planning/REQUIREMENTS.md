# Requirements: Just-Wrapper

**Milestone:** v1.1 — UI Polish & Debt Cleanup
**Defined:** 2026-06-10
**Core Value:** Real terminal fidelity — a session inside the wrapper behaves exactly like a native local terminal (`claude --rc`, `codex`, `vim`, `ssh`, REPLs, `npm run dev` all work flawlessly). Stable session identity and non-destructive switching are the strong second priority.

> v1.1 is a **debt-cleanup + whole-app visual-polish** milestone. No major new features — APPR appearance + BROW browser companion stay deferred (see Future Requirements). `UI-*` / `SESS-*` are user-visible capabilities; `DEBT-*` / `VAL-*` / `WIN-*` are quality / debt-closure requirements — legitimate scope for a hardening milestone.

## v1.1 Requirements

Phase numbering continues from v1.0 (which ended at Phase 8). Each requirement maps to exactly one phase.

### Visual Design System

- [x] **UI-01**: The app applies a single, deliberately-chosen visual direction — one design-token system (palette, typography scale, spacing scale, surface/elevation, radius, motion) — consistently across every screen, replacing piecemeal styling. The visual direction itself is decided at plan time (UI-SPEC), then tokenized and applied; this requirement is the foundation the per-surface requirements build on.
- [x] **UI-02**: The session sidebar (expanded and collapsed) presents a clear visual hierarchy — icon, name, and the 5-state status are legible and intentionally styled, and the active session is unmistakably distinguished.
- [ ] **UI-03**: The terminal area chrome — session header, Working Area vs Inactive List, and the live-session controls (Clear / Remove / Restart, and Start on inactive entries) — is visually polished and clearly structured.
- [ ] **UI-04**: The create/edit session form is visually polished — grouped fields, clear labels, icon/color picker, and inline validation feedback — and reads as one designed surface.
- [ ] **UI-05**: Empty, loading, and error states across the app (no sessions yet, session starting, spawn/error cards, ready-fail notice) are intentionally designed and informative rather than raw or blank.
- [ ] **UI-06**: Interactive controls have consistent, designed hover / focus / active states, with a visible keyboard-focus indicator on every actionable element.

### Session-Edit UX

- [ ] **SESS-05**: When the user re-opens the Edit Session modal, the saved working directory and startup command are pre-filled — the form mirrors what is actually persisted in main — rather than shown empty. (pending todo: edit-modal-does-not-prefill-saved-cwd-and-startup-command)
- [ ] **SESS-06**: The session form provides a native "Browse…" folder picker for the working directory that fills the field with an absolute path; main remains the validator of record (CR-01 path guard still gates the value). (pending todo: add-folder-picker-for-working-directory-selection)
- [ ] **SESS-07**: The session lifecycle is simplified to Start / Remove / Clear — the restart verb is removed from the UI (the `ptyRestart` mechanism is kept hidden, so `EXPECTED_API_KEYS` stays 20). Recycling a session is the discoverable Remove → Start (fresh) path, consistent with the dormant-record Start ▶ promotion path, so the user is never forced to type `exit`. *(Amended 2026-06-13 — operator chose to remove restart rather than surface it; see Phase 11 `11-CONTEXT.md` D-01/D-02/D-05.)* (pending todo: improve-start-control-discoverability-for-live-sessions)

### Code-Review Debt

- [ ] **DEBT-01**: The Phase 05.1 deferred code-review findings (WR-01..05, IN-01..03 in `05.1-REVIEW.md`) are resolved or explicitly closed with rationale — notably WR-01 (the dead D-02 post-settle invisibility-scrub path) and WR-02 (the probe-matcher same-chunk-echo false-positive, an inject-before-ready risk), tuned against real cold zsh/bash captures. (pending todo: address-deferred-code-review-findings-phase-05-1)
- [ ] **DEBT-02**: The Phase 06.1 code-review criticals (CR-01 dock-relaunch quit-flag reset, CR-02 concurrent-restart lock cleared in `finally`, CR-03 failed-write-does-not-clear-dirty + follow-up write on in-flight mutation, CR-04 setOrder id-validate + clamp, WR-02 handleRestart `pid > 0` guard) are correctly redone with tests that exercise the **real** code path (including the failure/edge paths — failed respawn, write rejection), followed by a **mandatory user re-verify in the running app** (start / restart / quit→relaunch round-trip / rapid double-restart / mid-write durability). Automated green is not accepted as proof — the 2026-06-09 remediation passed the suite while actively broken and was reverted. (pending todo: redo-phase-06.1-code-review-criticals)

### Formal Validation

- [ ] **VAL-01**: The Nyquist validation flags for phases 01, 02, and 03 are flipped to compliant with backing evidence (formal closure only — the functional behavior of these phases was already verified during v1.0).

### Windows Verification

- [ ] **WIN-01**: A Windows real-hardware verification kit is prepared in-milestone — a UAT checklist (installer run, shell-dropdown enumeration, per-shell `claude --rc` auto-run, pre-1809 ConPTY dialog), the build artifacts, and run instructions — ready to execute without further setup.
- [ ] **WIN-02**: The Windows real-hardware run is executed and signed off. This is a **deferred human-UAT gate** the user performs when a Windows machine is available; the milestone delivers the kit (WIN-01), and the user's sign-off closes WIN-02. (carried v1.0 tail — `08-HUMAN-UAT.md` precedent)

## Future Requirements

Acknowledged but deferred. Not in the v1.1 roadmap.

### Appearance (v2)

- **APPR-01**: Configurable terminal font family and size
- **APPR-02**: Light/dark theme selection (the app ships a hardcoded sensible default; v1.1 polish locks one cohesive direction but does not add user-selectable themes)

### Browser Companion (v2, separate optional feature)

- **BROW-01**: Browser extension can link the current browser tab to a terminal session
- **BROW-02**: App displays the linked tab's title, URL/domain, favicon, and active/closed status
- **BROW-03**: (Exploratory) For ChatGPT, detect whether the page is idle or generating — without reading conversation content

### Command Composer / Agent Shell (v2 — to evaluate)

- **COMP-01** *(evaluate whether to do)*: A Warp-style command composer — a fixed bottom input editor (multi-line, expand-to-~7-lines then scroll) at the shell prompt, backed by shell integration (OSC 133) for command blocks, with an **automatic fall-back to a raw pass-through terminal whenever a full-screen TUI (`claude --rc` / `codex` / `vim`) takes the alt-screen**. This is a deliberate evolution of the Core Value (from "keystroke-identical to a native terminal" → "TUI full-fidelity **+** an enhanced shell-prompt layer") and would overturn the "Warp-style blocks" out-of-scope line below. Full mechanism + work breakdown: [`.planning/v2-ideas/command-composer-agent-shell.md`](v2-ideas/command-composer-agent-shell.md). *(Raised + deferred 2026-06-14 during Phase 11; the alt-screen fall-back already has a foundation in `SessionView.tsx`.)*

## Out of Scope

Explicitly excluded for v1.1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| User-selectable themes / font config (APPR-01/02) | v1.1 polish locks ONE cohesive visual direction; user-tunable appearance is a v2 feature, not part of "make it look designed" |
| Browser companion (BROW-01/02/03) | Stays a separate optional v2 feature, kept out of the polish + debt milestone |
| New terminal/session capabilities | v1.1 adds no new product surface — it polishes and hardens what v1.0 shipped |
| ChatGPT / page content reading | Privacy-sensitive; deliberately never reads conversation content (unchanged from v1.0) |
| Cloud sync / multi-device / SSH management / plugins / Warp-style blocks / custom icon uploads / live-process recovery | Carried v1.0 exclusions — unchanged |
| Linux as a target platform | Windows + macOS only; code avoids actively precluding Linux but it is untested |

## Definition of Done

v1.1 is complete when:

1. **Visual polish (UI-01..06)** — the app presents one cohesive, intentionally-designed visual direction across the sidebar, terminal area, create/edit form, and empty/loading/error + interaction states, **verified by the user in the running app** (it looks designed, not piecemeal).
2. **Session-edit UX (SESS-05..07)** — editing a session pre-fills the saved cwd + startup command, a native folder picker fills the working directory, and a live session exposes a discoverable Start/Restart control.
3. **Code-review debt (DEBT-01/02)** — the Phase 05.1 deferred findings and the Phase 06.1 criticals are correctly redone with real-path tests and a user re-verify, with no regression in persistence or lifecycle.
4. **Validation (VAL-01)** — the Nyquist flags for phases 01/02/03 are compliant with evidence.
5. **Windows (WIN-01 / WIN-02)** — the real-hardware verification kit exists and is ready; the real-hardware run is executed and signed off when a Windows machine is available (WIN-02 deferred gate).

Core Value (terminal fidelity) must not regress at any point — the polish and hardening work leaves every v1.0 fidelity guarantee intact.

## Traceability

Each v1.1 requirement maps to exactly one phase. Phase numbering continues from v1.0 (Phases 1–8); v1.1 phases are 9–15.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 9 — Design Token Foundation | Complete |
| UI-02 | Phase 10 — Sidebar Visual Polish | Complete |
| UI-03 | Phase 11 — Terminal Area Polish + Live Start/Restart | Pending |
| SESS-07 | Phase 11 — Terminal Area Polish + Live Start/Restart | In progress (11-01 landed: restart UI removed, recycle path GREEN; gated on 11-03 human-verify) |
| UI-04 | Phase 12 — Session Form: Polish + Edit UX | Pending |
| SESS-05 | Phase 12 — Session Form: Polish + Edit UX | Pending |
| SESS-06 | Phase 12 — Session Form: Polish + Edit UX | Pending |
| UI-05 | Phase 13 — State & Interaction Design | Pending |
| UI-06 | Phase 13 — State & Interaction Design | Pending |
| DEBT-01 | Phase 14 — Code-Review Debt Closure | Pending |
| DEBT-02 | Phase 14 — Code-Review Debt Closure | Pending |
| VAL-01 | Phase 15 — Formal Validation + Windows Verification Kit | Pending |
| WIN-01 | Phase 15 — Formal Validation + Windows Verification Kit | Pending |
| WIN-02 | Phase 15 — Formal Validation + Windows Verification Kit (deferred human-UAT gate) | Pending |

**Coverage:**

- v1.1 requirements: 14 total
- Mapped to phases: 14 / 14 ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-10 — milestone v1.1 UI Polish & Debt Cleanup. Traceability populated by roadmapper 2026-06-10 (14/14 mapped, 0 orphans).*
