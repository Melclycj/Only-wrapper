---
phase: 10
slug: sidebar-visual-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | {pytest 7.x / jest 29.x / vitest / go test / other} |
| **Config file** | {path or "none — Wave 0 installs"} |
| **Quick run command** | `{quick command}` |
| **Full suite command** | `{full command}` |
| **Estimated runtime** | ~{N} seconds |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `{tests/test_file.py}` — stubs for REQ-{XX}
- [ ] `{tests/conftest.py}` — shared fixtures
- [ ] `{framework install}` — if no framework detected

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | REQ-{XX} | {reason} | {steps} |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — human gate NOT APPROVED (see Human Gate History below)

---

## Human Gate History

`nyquist_compliant` stays **false** until the operator gives an explicit, unqualified "approved" in the running app (06.1/08 visual-phase precedent). Automated green is NOT proof.

| Attempt | Plan | Date | Verdict | Outcome |
|---------|------|------|---------|---------|
| 1 | 10-04 | 2026-06-11 | **NOT APPROVED** | step 4 (name crush) + step 5 (amber waiting) failed → GAP-10-A/B/C routed to 10-05 code fixes |
| 2 | 10-06 | 2026-06-11 | **NOT APPROVED (PARTIAL)** | ITEM 1 (name legibility) APPROVED with one minor adjustment; ITEM 2 (live amber waiting) FAILED — amber never fired on a real `claude --rc` permission prompt → GAP-10-D (blocker) + GAP-10-E/F (minor) routed to 10-07 |

**Current state:** `nyquist_compliant: false` (verified unchanged). Requirement **UI-02 stays OPEN**. The blocking open item is **GAP-10-D** (the live recognizer does not classify the current `claude --rc` permission frame as "waiting"). The gate flips true only after the 10-07 gap-closure plan resolves the open items and the operator re-verifies with an explicit unqualified "approved".
