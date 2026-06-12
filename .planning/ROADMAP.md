### Phase 10: Sidebar Visual Polish

**Goal**: The session sidebar presents an intentional visual hierarchy in both expanded and collapsed modes — icon, name, and 5-state status are legible and clearly styled, and the active session is unmistakably distinguished.
**Depends on**: Phase 9
**Requirements**: UI-02
**Success Criteria** (what must be TRUE):

  1. A human scanning the sidebar can instantly tell which session is active — it is visually distinct from inactive rows at a glance.
  2. Each row's icon, name, and status badge read with clear hierarchy; the 5 statuses (not started / running / stopped / exited / error) are legible and distinguishable by their styling.
  3. In collapsed (icon-only) mode the active session and per-row status remain identifiable, and the layout stays clean at the narrow rail width.
  4. Sidebar interactions (click-to-switch, drag-to-reorder, keyboard switching) continue to work unchanged and the terminal keep-alive on switch is not regressed.

**Plans**: 13 plans (4 original + 2 gap-closure r1 + 4 gap-closure r2 + 1 gap-closure r3 + 2 gap-closure r4)
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

**Phase status**: OPEN — UI-02 not yet satisfied; `nyquist_compliant: false`. GAP-10-H and GAP-10-I are CLOSED (operator-approved at gate attempt 4), but new GAP-10-J (scroll→status) + GAP-10-K (CJK) are open. Phase closes only on an explicit unqualified human "approved" after GAP-10-J is closed and re-verified in the running app (round 5 → 10-14).

**UI hint**: yes
