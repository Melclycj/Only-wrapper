---
phase: 12
slug: session-form-polish-edit-ux
status: verified
threats_open: 0
threats_total: 3
asvs_level: 1
created: 2026-06-15
register_authored_at_plan_time: true
---

# Phase 12 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified by direct mitigation-evidence check (orchestrator, 2026-06-15) — the plan-time
> STRIDE register (12-01/12-02/12-03) was authored, threats_open was 0, and the surface is
> small + grep-verifiable, so a heavyweight auditor spawn was not warranted. Each mitigation
> was confirmed against the implementation below.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| native OS dialog → renderer field (SESS-06) | Browse… returns only existing dirs from the OS folder dialog; the chosen path fills `edit-cwd` via the EXISTING `pickDirectory` bridge key | filesystem path (absolute) |
| renderer cwd → main `pty.spawn` (Start) | The form's cwd value (Browse… or free-text) reaches `pty.spawn` cwd via the EXISTING `create()` path, gated by CR-01 | filesystem path |
| renderer form ↔ main persistence | cwd/shell/startupCommand/configured persist via the EXISTING `ptyUpdateProfile`; rehydrate reads via the EXISTING `listSessions`; reject notice via the EXISTING `onPtyStatus` | session metadata |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-12-01 | Tampering | cwd path (Browse… OR free-text) → `pty.spawn` cwd | accept (mitigated by existing CR-01) | `PtyManager.create()` pre-validates the resolved cwd with `isValidCwd` (`src/main/pty-manager.ts:305`); an explicit-but-missing dir → status `error` + sanitized `Working directory not found: <path>` notice (`:310`), never a silent `~` spawn. Main is the validator of record; the renderer never gates. **`src/main` is byte-untouched by Phase 12** — the guard is intact. | closed |
| T-12-03 | Elevation of Privilege | IPC bridge surface | mitigate — NONE added | `EXPECTED_API_KEYS` = **20** entries (`src/main/window-config.ts`); Browse… reuses `pickDirectory` (key 19), SESS-05 reuses `ptyUpdateProfile`/`listSessions`, the reject notice reuses `onPtyStatus`. `security.guard.test.ts` GREEN. No new IPC channel. | closed |
| T-12-SC | Tampering (supply chain) | npm dependency tree | mitigate — NONE installed | `package.json` + `package-lock.json` are **untouched** by Phase 12 (zero new deps; verified via `git diff` base..HEAD). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Additional checks (defense-in-depth)

- **XSS / output encoding (ASVS V5):** no `innerHTML` / `dangerouslySetInnerHTML` in the changed renderer files (`SessionEditModal.tsx`, `SessionManager.tsx`). The CR-01 cwd-rejection notice renders as a React text node (auto-escaped); main also runs `sanitizeNotice` on it before sending. No injection path.
- **Reliability & Cost (R&C) lens** (per threat-modeling §6.5 — retry storms / concurrent invocation / unbounded resource / failure cascade / cost runaway / capacity ceiling): **N/A by scope.** Phase 12 is a local renderer form (prefill + inline validation) plus a native folder picker — no network egress, no scheduled/cron invocation, no LLM/paid-API cost path, no concurrent-invocation amplification, no unbounded resource. The only main-side action (a `pty.spawn` at Start) is the pre-existing, single, user-initiated path unchanged by this phase.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-12-01 | T-12-01 | The cwd field accepts free-text + Browse… paths, but the only authority that spawns a PTY is `PtyManager.create()`, which rejects a non-existent/invalid cwd via the unchanged CR-01 `isValidCwd` guard before any spawn. The renderer is intentionally not the validator of record (defense lives in main). The BLOCKING human-verify (12-03 Task 3) explicitly exercises this: hand-type a bad path → confirm main rejects inline. | orchestrator (pipeline) | 2026-06-15 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-15 | 3 | 3 | 0 | orchestrator (direct mitigation-evidence verification; ASVS L1, block_on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-15
