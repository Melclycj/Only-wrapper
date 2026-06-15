### Phase 10: Sidebar Visual Polish

**Goal**: The session sidebar presents an intentional visual hierarchy in both expanded and collapsed modes — icon, name, and 5-state status are legible and clearly styled, and the active session is unmistakably distinguished.
**Depends on**: Phase 9
**Requirements**: UI-02
**Success Criteria** (what must be TRUE):

  1. A human scanning the sidebar can instantly tell which session is active — it is visually distinct from inactive rows at a glance.
  2. Each row's icon, name, and status badge read with clear hierarchy; the 5 statuses (not started / running / stopped / exited / error) are legible and distinguishable by their styling.
  3. In collapsed (icon-only) mode the active session and per-row status remain identifiable, and the layout stays clean at the narrow rail width.
  4. Sidebar interactions (click-to-switch, drag-to-reorder, keyboard switching) continue to work unchanged and the terminal keep-alive on switch is not regressed.

**Plans**: 15 plans (4 original + 2 gap-closure r1 + 4 gap-closure r2 + 1 gap-closure r3 + 2 gap-closure r4 + 2 gap-closure r5)
**Wave 1**

  - [x] 10-01-PLAN.md — Pure modules (row-secondary D-03 + viewport-clamp D-14) with tests + extract sidebar CSS → sidebar.css and wire the 3 touch-points (Wave 1)

**Wave 2** *(blocked on Wave 1; the two run in parallel — disjoint files)*

  - [x] 10-02-PLAN.md — Sidebar.tsx two-line restructure + sidebar.css visual rules (active card/edge bar, amber waiting wash, icon tile, dashed recipe cards, ghost ▶, section counts, collapsed continuity) + ui-lab evidence surfaces (Wave 2)
  - [x] 10-03-PLAN.md — ContextMenu D-14 viewport clamp + D-15 danger-ramp Remove/Delete + SessionManager wiring + danger CSS (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

  - [x] 10-04-PLAN.md — Full suite + packaged ui-lab capture scored against the rubric + blocking end-of-phase human-verify (SC1-SC4) phase gate (Wave 3) — verdict NOT_APPROVED; 3 gaps routed to gap-closure

**Gap-closure** *(human gate NOT_APPROVED — closing GAP-10-A name-crush + GAP-10-B amber-waiting + WR-03/WR-04/IN-05; GAP-10-C resolved by user, no code change)*

**Wave 4 (gap-closure code fixes)**

  - [x] 10-05-PLAN.md — Collapse hover-control box to zero width at rest (GAP-10-A/WR-01) + running-gate the data-agent seam & unit-test it & trace the WR-02 live chain (GAP-10-B/WR-03) + order-independent waiting-beats-active edge bar (WR-04) + unblock the ui-lab sidebar-waiting capture seam (IN-05) (Wave 4)

**Wave 5 (gap-closure gate; blocked on Wave 4)**

  - [x] 10-06-PLAN.md — Full suite + fresh packaged no-injection capture (incl. the unblocked sidebar-waiting surface) + rescore SC2/D-09 + BLOCKING human re-verify of the two live-app items (closes P04-T1/P04-T3, flips the Nyquist gate only on explicit "approved") (Wave 5)

**Gap-closure round 2** *(2nd human gate NOT_APPROVED_PARTIAL — closing GAP-10-D live-amber blocker + GAP-10-E gutter + GAP-10-F harness + WR-01..WR-05)*

**Wave 6 (gap-closure r2 code/harness fixes — 3 plans, disjoint files, parallel)**

  - [x] 10-07-PLAN.md — DEBUG-FIRST: reproduced the real claude --rc Web Search frame (spike 003), DISPROVED the recognizer hypothesis (classify() reads it 'waiting'), diagnosed the single broken link = the SessionView agentRunning GATE (create()/mount race), fixed via agentGateOpen() seeded from the authoritative running prop, locked with a RED→GREEN regression (GAP-10-D — live confirmation owned by 10-10) (Wave 6)
  - [x] 10-08-PLAN.md — Compact the leading gutter (drag handle + icon tile + row gap) so the name reclaims width (GAP-10-E) + make zero-width-at-rest real (WR-01) + kill dormant-row trailing gap (WR-02) — sidebar.css only (Wave 6)
  - [x] 10-09-PLAN.md — Deterministic name-completeness assertion in the ui-lab harness (GAP-10-F) + fix the broken type-import (WR-03) + sidebar-waiting cleanup hook (WR-04) + assert-the-attribute-landed (WR-05) (Wave 6)

**Gap-closure round 3** *(10-10 Task-1 caught GAP-10-G via the new 10-09 machine check — the ACTIVE row's permanently-revealed Edit/Close controls (52px) crush a medium name; "Parlour Claude" scrollWidth=98 > clientWidth=51, deterministic 10/11)*

**Wave 7 (gap-closure r3 CSS fix; blocked on Wave 6)**

  - [x] 10-11-PLAN.md — Collapse the ACTIVE row's controls to zero reserved width at rest (remove .sidebar-row.active from the two control-reveal selector groups so it mirrors the rest-state zero-collapse — D-02; reveals on hover/focus only) so a medium name reads in full on the active row; prove with `ui:shots:fresh` completing 11/11 surfaces + the 10-09 assertNameNotCrushed passing — sidebar.css only (GAP-10-G) (Wave 7)

**Wave 8 (gap-closure gate; blocked on Wave 7)**

  - [x] 10-10-PLAN.md — Full suite GREEN against the packaged app + fresh packaged ui-lab capture (now 11/11, enforcing name-completeness incl. the active row, no leaked amber) + BLOCKING human re-verify of live amber / gutter / names; flips the Nyquist gate ONLY on an explicit unqualified "approved" (Wave 8) — **gate attempt 3 NOT_APPROVED (QUALIFIED)**: ITEM A/B/C all CONFIRMED live (GAP-10-D/E/F/G closed) but a NEW defect (GAP-10-H — duplicate Start affordance on inactive/dormant rows) qualifies the verdict → round 4 (10-12). Nyquist gate stays FALSE; UI-02 OPEN.

**Gap-closure round 4** *(3rd human gate NOT_APPROVED_QUALIFIED — A/B/C confirmed live; closing GAP-10-H = the duplicate Start affordance on inactive/dormant rows + the sanctioned GAP-10-I D-09 amendment = waiting wash-only, no edge bar; then a NEW gate plan 10-13 re-runs the evidence chain + BLOCKING human gate, attempt 4)*

**Wave 9 (gap-closure r4 code/spec fixes; blocked on Wave 7's 10-11)**

  - [x] 10-12-PLAN.md — DIAGNOSE-FIRST GAP-10-H: reproduce + root-cause the duplicate Start affordance on an inactive/dormant row (enumerate rest / selected / hover / just-started states), fix the one broken link, pin it with a startAffordances truth-table regression (+ a ui-lab dormant-selected single-Start assertion if it was a render-path defect); AND GAP-10-I (sanctioned D-09 amendment): waiting = amber wash only, drop the amber edge bar (expanded + collapsed mirror), remove the obsolete WR-04 compound selector, update the sidebar-waiting capture expectation — renderer-only, Sidebar.tsx + sidebar.css + start-affordances.test.ts + surfaces.ts (Wave 9) — **DONE** (spike 004 diagnosed GAP-10-H as a render-path VERIFICATION gap, not a pure-predicate defect; fix = activeIsCard byte-lock + unit truth-table (`totalStartCount===1`) + a live-DOM `assertSingleStartAffordance`; GAP-10-I waiting wash-only landed, active edge bar D-05/D-06 preserved; tsc 0, unit 11/11, tokens 14/14, bridge stays 20, GAP-10-D/E/F/G untouched). Awaiting the 10-13 round-4 gate.

**Wave 10 (gap-closure gate; blocked on Wave 9)**

  - [x] 10-13-PLAN.md — Discharge the deferred rounds 2-4 gsd-code-review delta pass (fix Critical/High pre-gate) + full suite GREEN against the packaged app + fresh packaged ui-lab capture (NEW tag, name-completeness enforced, amended wash-only waiting, dormant single-Start) + BLOCKING human re-verify (attempt 4): GAP-10-H single Start live + GAP-10-I wash-only live + the active-bar-amber confirm-or-extend question + GAP-10-D/E/F/G no-regression sweep; flips the Nyquist gate ONLY on an explicit unqualified "approved" (Wave 10) — **gate attempt 4 NOT_APPROVED (QUALIFIED)**: delta review CLEAN (0 Crit/0 High), full suite green (unit 373, smoke 15/15 w/ 1 isolated-confirmed flake), packaged capture rescored; ITEM H (GAP-10-H single Start) + ITEM I (GAP-10-I wash-only) APPROVED + CLOSED; but NEW defect **GAP-10-J** (scrolling history flips the sidebar status — `SessionView.tsx` samples `viewportY` not `baseY`) + **GAP-10-K** (terminal CJK: no UTF-8 LANG + no CJK font) → round 5 (10-14). Nyquist gate stays FALSE; UI-02 OPEN.

**Gap-closure round 5** *(4th human gate NOT_APPROVED_QUALIFIED — H/I confirmed live + CLOSED; closing GAP-10-J = scrolling history flips the sidebar status (sample the live tail at `baseY`, not the visible `viewportY`) + GAP-10-K = terminal CJK does not render (UTF-8 spawn locale + a CJK font fallback); then a NEW gate plan 10-15 re-runs the evidence chain + BLOCKING human gate, attempt 5. The `npm run make` lowdb crash is a SEPARATE todo, out of round-5 scope.)*

**Wave 11 (gap-closure r5 code fixes; blocked on Wave 10)**

  - [x] 10-14-PLAN.md — GAP-10-J: extract a pure DOM-free `sampleAgentFrame(buffer, rows)` that reads the LIVE tail (`buffer.active.baseY`, not `viewportY`), delegate `SessionView.viewportLines()` to it so the classified agent-state is scroll-position-independent, pin with a deterministic scroll-invariance regression (sampled frame identical across viewportY; an OLD scrollback menu no longer classifies as waiting). GAP-10-K: add a pure `resolvePtyLocale(env)` (honor an inherited UTF-8 LANG, default a UTF-8 locale only when absent, return `{}` on win32 — cross-platform-safe) + wire it into the `pty.spawn` env + unit-pin its truth table; AND append a CJK-capable monospace fallback to `--font-mono` (tokens.css) + the xterm `fontFamily` (SessionView.tsx), JetBrains Mono primary, generic monospace last, NO bundled font. Renderer + main only; no data-testid/class rename; EXPECTED_API_KEYS stays 20; tokens-only CSS; GAP-10-A..I untouched (Wave 11)

**Wave 12 (gap-closure gate; blocked on Wave 11)**

  - [x] 10-15-PLAN.md — Round-5 gsd-code-review delta pass (GAP-10-J + GAP-10-K deltas; fix Critical/High pre-gate) + full suite GREEN against the packaged app (incl. the two new round-5 regression tests) + fresh packaged ui-lab capture (NEW tag `p10-gapfix-round5-gate`, name-completeness enforced, wash-only waiting; the `idle-card` skip is the documented pre-existing harness limitation) + BLOCKING human re-verify (attempt 5): ITEM J (scrolling history no longer flips the status — idle AND live-waiting cases) + ITEM K (Chinese renders as real glyphs, e.g. `echo 你好世界`) + GAP-10-D/E/F/G/H/I no-regression sweep; flips the Nyquist gate ONLY on an explicit unqualified "approved" (Wave 12)

**Phase status**: ✅ COMPLETE (2026-06-13) — UI-02 SATISFIED; `nyquist_compliant: true`. GAP-10-A through GAP-10-K are ALL CLOSED and operator-approved live across five human gates; gate attempt 5 (plan 10-15) returned an explicit unqualified "approve all three" (ITEM J scroll-invariant status + ITEM K CJK rendering + GAP-10-D/E/F/G/H/I no-regression sweep). Backlog (non-gate, carried): real icons · app-wide animation system · metadata-based agent-state capture · the `npm run make` lowdb `LocalStorage` crash (separate todo — `npm run package` boots clean).

**UI hint**: yes

### Phase 11: Terminal Area Polish + Live Start/Restart

> **Amended 2026-06-13** (operator decision at `11-discuss`): the **restart UI is removed**, not added. Lifecycle vocabulary becomes Start / Remove / Clear; recycling a session is Remove → Start (fresh). The original "Live Start/Restart" framing + the discoverable-restart / scrollback-preserving criteria are superseded below. The `ptyRestart` mechanism is kept hidden (`EXPECTED_API_KEYS` stays 20). See `11-CONTEXT.md` D-01/D-02/D-05. (Heading text kept verbatim so the phase dir slug stays stable.)
**Goal**: The terminal-area chrome is visually polished and clearly structured — the active session reads as one framed, breathing session card (header + terminal), the dormant IdleCard reads as its sibling, and the live-session controls (Clear / Remove, plus Start on inactive entries) read as a designed cluster. The session lifecycle is simplified to Start / Remove / Clear — the confusing restart duality is removed, and recycling a session (Remove → Start) no longer requires typing `exit`.
**Depends on**: Phase 9
**Requirements**: UI-03, SESS-07
**Success Criteria** (what must be TRUE):

  1. A human sees a clearly structured terminal area — the active session is a framed, breathing terminal card (not an edge-to-edge rectangle), the dormant IdleCard reads as its sibling, and the live-session controls (Clear / Remove) read as a designed cluster.
  2. The Working Area (live terminal) vs Inactive List (dormant entries) distinction is obvious at a glance, and Start ▶ on inactive entries vs the live controls are unambiguous.
  3. The live lifecycle is Start / Remove / Clear with no restart control anywhere; recycling a session is the discoverable Remove → Start (fresh) path — the user is never forced to type `exit`.
  4. Removing the restart UI does not regress terminal fidelity (no scroll / alt-screen / fit regression), the hidden `ptyRestart` mechanism + the IPC bridge budget (`EXPECTED_API_KEYS` = 20) are unchanged, and a configured session keeps its logical id + recipe across the Remove → Start recycle.**Plans**: 4 plans

**Wave 1**

- [x] 11-00-PLAN.md — Wave-0 foundation: pure `buildConfirmBody` (D-04) + O-1 A1 recycle-path guard + ui-lab evidence surfaces

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-01-PLAN.md — Restart-UI deletion (sidebar ↻ + context-menu Restart) + D-04 confirm copy wiring + restart-smoke rewrites (SESS-07/D-01/D-02)
- [x] 11-02-PLAN.md — Unified session-card framing (terminal-area.css) + IdleCard sibling + Remove danger ramp + D-03a fidelity guardrail (UI-03/D-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 11-03-PLAN.md — Phase gate: full packaged suite + fresh ui:shots:fresh capture + BLOCKING end-of-phase human-verify (DONE 2026-06-14 — first gate NOT_APPROVED_QUALIFIED: SC1-CV/SC2/SC3/SC4/D-04 PASS, SC1 FAIL → GAP-11-A)

**Wave 4** *(gap-closure r2 — GAP-11-A mockup-faithful redesign)*

- [x] 11-04-PLAN.md — GAP-11-A: inset terminal well + breathing + warmer cream (≈#f3e6d6) + breadcrumb header + top status-summary pills (faithfully matching the mockup IDE view; fidelity held, full gate GREEN, fresh proof tag p11-gapfix-a) — round-3 refinements then removed the top status pills + tightened the outer gutter + lightened the cream + added the cwd hint; operator approved SC1 at the re-gate 2026-06-14
- [x] 11-05-PLAN.md — GAP-11-A re-gate: BLOCKING end-of-phase human-verify (DONE — operator approved SC1 LIVE 2026-06-14 after rounds 2-3; nyquist_compliant TRUE; UI-03 + SESS-07 CLOSED)

**UI hint**: yes

### Phase 12: Session Form — Polish + Edit UX

**Goal**: The create/edit session form reads as one designed surface (grouped fields, clear labels, icon/color picker, inline validation), the Edit modal pre-fills the actually-persisted working directory and startup command, and the working-directory field offers a native Browse… folder picker.
**Depends on**: Phase 9
**Requirements**: UI-04, SESS-05, SESS-06
**Success Criteria** (what must be TRUE):

  1. A human opening the create/edit form sees one cohesive designed surface — grouped fields, clear labels, a real icon/color picker, and inline validation feedback rather than a raw stack of inputs.
  2. Re-opening the Edit Session modal shows the saved working directory and startup command already filled in, matching exactly what is persisted in main (the renderer record is refreshed from main after spawn / save, fixing the empty-field root cause).
  3. A native "Browse…" folder picker fills the working-directory field with an absolute path, and main still validates the value (the CR-01 path guard still gates it).
  4. Any new IPC bridge surface added for the folder picker is accounted for against the security key budget, and the EXPECTED_API_KEYS guard stays green.

**Plans**: 3 plans
- [ ] 12-01-PLAN.md — Wave-0 foundation: extract mergeAuthoritativeProfiles + validateSessionForm pure reducers (RED→GREEN) + add the edit-modal-validation ui-lab surface + DESIGN-RUBRIC update
- [ ] 12-02-PLAN.md — Renderer composition: SessionEditModal D-02 two-group restructure + IconPicker polish + D-04 inline validation + blue Save + form.css extract + SESS-05 rehydrate rewire
- [ ] 12-03-PLAN.md — Gate: SESS-05 round-trip smoke + Save-label lockstep + packaged ui:shots:fresh capture + BLOCKING end-of-phase human-verify (SC1 / O-1 / O-2)
**UI hint**: yes

### Phase 13: State & Interaction Design

**Goal**: Empty, loading, and error states across the app are intentionally designed and informative, and every interactive control has consistent, designed hover / focus / active states with a visible keyboard-focus indicator.
**Depends on**: Phase 10, Phase 11, Phase 12
**Requirements**: UI-05, UI-06
**Success Criteria** (what must be TRUE):

  1. A human sees designed, informative empty / loading / error states — no-sessions-yet, session-starting, spawn/error cards, and the ready-fail notice all communicate clearly instead of appearing raw or blank.
  2. Hovering, focusing, and activating any control produces consistent, intentional visual feedback across the whole app.
  3. Keyboard-only navigation shows a visible focus indicator on every actionable element, so a human tabbing through can always see where focus is.
  4. These interaction states layer onto the existing surfaces without regressing terminal focus behavior or the app-wins keyboard switching.

**Plans**: TBD
**UI hint**: yes

### Phase 14: Code-Review Debt Closure

**Goal**: The Phase 05.1 deferred code-review findings are resolved or explicitly closed with rationale, and the Phase 06.1 lifecycle criticals are correctly redone with tests that exercise the real code path (including failure/edge paths) followed by a mandatory user re-verify in the running app. Automated green is explicitly NOT accepted as proof of the lifecycle fixes — the 2026-06-09 remediation passed the suite while broken and was reverted.
**Depends on**: Phase 8 (reads `05.1-REVIEW.md` + `06.1-REVIEW.md` artifacts; independent of the UI phases)
**Requirements**: DEBT-01, DEBT-02
**Success Criteria** (what must be TRUE):

  1. Every Phase 05.1 deferred finding (WR-01..05, IN-01..03) is either fixed or explicitly closed with written rationale — notably WR-01 (dead D-02 invisibility-scrub path) and WR-02 (probe-matcher same-chunk-echo false-positive), tuned against real cold zsh/bash captures.
  2. The Phase 06.1 criticals (CR-01 dock-relaunch quit-flag reset, CR-02 concurrent-restart lock cleared in `finally`, CR-03 failed-write-does-not-clear-dirty + follow-up write, CR-04 setOrder id-validate + clamp, WR-02 handleRestart `pid > 0` guard) are redone with tests that exercise the real failure/edge paths (failed respawn, write rejection), not a suite that can pass while broken.
  3. A human re-verifies the lifecycle in the running app — start / restart / quit→relaunch round-trip / rapid double-restart / mid-write durability — and signs off; the fix is not considered done on automated green alone.
  4. No regression in persistence or lifecycle, and terminal fidelity is unchanged.

**Plans**: TBD

### Phase 15: Formal Validation + Windows Verification Kit

**Goal**: The Nyquist validation flags for phases 01/02/03 are flipped to compliant with backing evidence (formal closure only — the functional behavior already passed during v1.0), and a ready-to-run Windows real-hardware verification kit is delivered. The actual Windows real-hardware run (WIN-02) is carried as an explicit deferred human-UAT sign-off gate the user executes on real Windows hardware (mirroring the existing `08-HUMAN-UAT.md` pattern); it does not block this phase's delivery.
**Depends on**: Phase 8 (reads phase 01/02/03 evidence + phase 08 packaging artifacts); independent of the UI phases
**Requirements**: VAL-01, WIN-01, WIN-02
**Success Criteria** (what must be TRUE):

  1. The `nyquist_compliant` flags for phases 01, 02, and 03 are flipped to true with the backing evidence cited (the functional verification that already passed during v1.0).
  2. A Windows real-hardware verification kit exists and is ready to execute without further setup — a UAT checklist (installer run, shell-dropdown enumeration, per-shell `claude --rc` auto-run, pre-1809 ConPTY dialog), the build artifacts, and run instructions.
  3. WIN-02 is recorded as an explicit deferred human-UAT gate (e.g. a `HUMAN-UAT.md`) the user runs on real Windows hardware and signs off, mirroring the `08-HUMAN-UAT.md` precedent; the milestone delivers the kit and earlier phases are not blocked on it.
  4. The kit-building work leaves the app runnable on macOS and does not regress terminal fidelity.

**Plans**: TBD
