# Phase 11: Terminal Area Polish + Live Start/Restart - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 11-terminal-area-polish-live-start-restart
**Areas discussed:** Live-session restart/recycle model (SESS-07), Terminal-pane framing (Gap 2 / UI-03), Agent-aware close confirmation (todo fold), Restart-removal scope, Recycle path

---

## Live-session restart / recycle model (SESS-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Head 加 Restart ↻ | Live header gets a Restart ↻ reusing the existing scrollback-preserving handleRestart/ptyRestart; satisfies SC4 directly | |
| 只提升侧栏/菜单可发现性 | Keep header Clear+Remove; make the existing sidebar/menu Restart more discoverable | |
| Restart 起全新进程 | Recycle = fresh process, no scrollback (conflicts with SC4) | |
| **(Other / freeform)** | **"Remove restart functionality"** — eliminate the restart concept from the UI | ✓ |

**User's choice:** Free-text — **"Remove restart functionality."** The operator rejected all
three offered options and chose to remove restart entirely rather than surface it.
**Notes:** Surfaced that the scrollback-preserving restart machinery already exists and is
tested (TERM-07/SC3) but is only wired to the sidebar ↻ + context menu, not the live header —
the restart *duality* (preserve-in-place vs Remove→Start-fresh) was itself the confusion.

## Restart-removal scope (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| 全部移除（含机制+IPC） | Delete UI + main ptyRestart orchestration + IPC bridge key (20→19) + separator + tests | |
| **只移除 UI 入口，保留底层** | Remove all restart buttons/menu items; KEEP the ptyRestart mechanism hidden; bridge stays 20; low test churn | ✓ |
| 先不删，只是不往 header 加 | Keep current sidebar ↻ + menu Restart; just don't add to header | |

**User's choice:** **Remove the UI entry points, keep the underlying mechanism.** →
`EXPECTED_API_KEYS` stays 20, main untouched, accepted trade = temporarily-unreachable code.
**Notes:** Captured as D-01.

## Recycle path (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| **Remove → Start（全新、不留历史）** | Running session Remove → Inactive → Start fresh; SESS-07 reframes to Start discoverability | ✓ |
| 靠在 shell 里 exit 重开 | No dedicated recycle control; user types `exit` (the current SESS-07 complaint) | |

**User's choice:** **Remove → Start (fresh, no scrollback).** → Captured as D-02; drives the
SESS-07 reframe (D-05).

## Terminal-pane framing (Gap 2 / UI-03)

| Option | Description | Selected |
|--------|-------------|----------|
| **整块会话卡** | header + terminal as one 18px rounded card on cream bg, breathing room, --term-bg inside | ✓ |
| 终端圆角内嵌、header 分离 | Round only the terminal viewport + padding; header stays a separate strip | |
| 极简：留白+细边、不圆角 | Margin + thin border only, no rounded card | |

**User's choice:** **Unified session card** (header + terminal as one rounded surface). →
Captured as D-03 with the D-03a fidelity guardrail (container-layer only; xterm never clipped;
fit re-fits).

## Agent-aware close confirmation (todo fold)

| Option | Description | Selected |
|--------|-------------|----------|
| **Fold：仅升级措辞** | Escalate ConfirmModal copy when agentState ∈ {working, waiting} | ✓ |
| Fold：措辞 + 退出守卫 | Above + an app-quit-time confirm when an agent is busy | |
| 暂不 fold | Leave as a standalone todo | |

**User's choice:** **Fold copy-escalation only.** App-quit guard deferred. → Captured as D-04.

---

## Claude's Discretion

- Control-cluster exact styling (icon/order, Remove in the `--color-danger` danger ramp per
  Phase-10 D-15) — via the ui-lab loop + the Sidebar `.row-control` shape the header reuses.
- Exact card geometry (radius, padding/breathing-room steps, shadow tier, header-flush vs
  hairline cap) — tuned in the ui-lab loop against DESIGN-RUBRIC.md.
- "Working Area vs Inactive List" terminal-area clarity — reuse the Phase-10 sidebar split +
  the existing live/dormant terminal-area swap; no second inactive list inside the terminal.
- Whether to extract `terminal-area.css`; whether to add new ui-lab surfaces.

## Deferred Ideas

- App-quit-time agent-aware confirmation guard → deferred (only in-app close copy in scope).
- App-wide animation/motion system → Phase 13 / standalone.
- Empty/loading/error states + app-wide hover/focus/active → Phase 13.
- Real icon system → backlog. folder-picker + edit-prefill → Phase 12.
- 06.1 criticals + 05.1 findings → Phase 14. `npm run make` lowdb crash → separate build todo.
