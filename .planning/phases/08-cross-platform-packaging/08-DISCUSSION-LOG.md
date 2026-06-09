# Phase 8: Cross-Platform Packaging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 8-cross-platform-packaging
**Areas discussed:** Windows production & verification, Windows shell discovery + readiness probe, macOS signing/notarization, ConPTY gate + rebuild, App icon & metadata, Packaged-app verification

---

## Windows production & verification

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions CI matrix | windows-latest + macos-latest runners each `npm run make` + smoke; CI truly produces the Windows installer | ✓ |
| You build on your Windows machine | macOS green here; hand user a make+verify checklist to run on their own Windows box | |
| macOS full-verify + Windows best-effort | macOS fully packaged/verified; Windows config written but marked unverified-on-hardware | |

**User's choice:** GitHub Actions CI matrix
**Notes:** Dev/test is macOS-only, so CI is the canonical producer + verifier of the real Windows artifact. Resolves how SC1/SC2/SC3 can be claimed on the Windows side.

---

## Windows shell discovery + readiness probe

| Option | Description | Selected |
|--------|-------------|----------|
| Fill the stubs | Real Windows shell enumeration (PowerShell/CMD/Git Bash/WSL) + Windows readiness probe behind the existing seams | ✓ |
| Keep packaging pure, keep deferring | Phase 8 = packaging only; Windows dropdown shows only the default; auto-run stays throwing / graceful-degrade | |

**User's choice:** Fill the stubs (shell enumeration + readiness probe)
**Notes:** Closes the PROJECT.md "Active" deferral and both stubs' own "deferred to Phase 8" comments, so the Windows build is actually usable for the canonical scenario, not just bootable. Per-shell readiness markers (POSIX `:` does not apply to CMD/PowerShell) flagged for research.

---

## macOS signing / notarization

| Option | Description | Selected |
|--------|-------------|----------|
| True stub + local-open doc | Unsigned `.app`; document right-click→Open / `xattr` de-quarantine; wire sign/notarize config slots for a later flip | ✓ |
| env-gated notarize wiring | Wire @electron/notarize behind env-var creds (no secrets committed); skip when creds absent | |
| Full signing now | Developer ID signing + notarization now; needs the $99 Apple Developer membership | |

**User's choice:** True stub + local-open instructions
**Notes:** No Apple Developer account assumed (STATE.md blocker: ~$99/yr). Local-only MVP, no distribution pipeline. Config slots wired so real signing later is a config-flip + env-gated creds.

---

## ConPTY gate + rebuild approach

| Option | Description | Selected |
|--------|-------------|----------|
| Native dialog pre-window gate + keep ship-prebuild | whenReady os.release() < 17763 → `dialog.showErrorBox` + quit before window; rebuild stays no-op, CI postinstall opportunistically rebuilds when online | ✓ |
| In-app error screen + keep ship-prebuild | Same rebuild stance, but the 1809 error renders in-app (relies on renderer booting) | |
| Native dialog + restore CI rebuild per roadmap | Honor roadmap's literal "@electron/rebuild in CI"; conflicts with the verified N-API ship-prebuild decision | |

**User's choice:** Native dialog pre-window gate + keep ship-prebuild (recommended)
**Notes:** User initially asked to learn the topic ("i dont know how to pick them, need to learn about it"). Explained: (A) the gate is just *where the error renders* — native `showErrorBox` is most robust on the exact OS-too-old case; (B) the roadmap's "@electron/rebuild in CI" is stale — node-pty 1.1.0 is N-API (ABI-stable prebuild, verified Phase 2), node-gyp rebuild hard-fails offline, and `scripts/fix-node-pty.cjs` postinstall ALREADY does opportunistic rebuild-when-online so the CI choice already satisfies the intent. CONTEXT.md flags the stale roadmap text for the planner.

---

## App icon & metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Wire icon pipeline + metadata, placeholder icon | `packagerConfig.icon`/maker slots → `assets/icon.*`, simple placeholder now, swap files later; set appId/author | ✓ |
| Real icon now + full metadata | Generate a real app icon via a design skill + full metadata | |
| All-default, just appId/author | Electron default icon; only fill required appId/author | |

**User's choice:** Wire icon pipeline + metadata, placeholder for now
**Notes:** No icon asset exists today (the `out/` `electron.icns` is Electron's default). `productName` already "Just-Wrapper"; `author` empty, no `appId`. Pipeline-ready so a nicer icon later is a file swap.

---

## Packaged-app verification

| Option | Description | Selected |
|--------|-------------|----------|
| Automated packaged-smoke + canonical human-verify | Reuse WDIO (already points at packaged `.app`) for ASAR PTY round-trip (SC3) on both OSes; blocking human-verify for canonical `claude --rc` (SC2) | ✓ |
| Pure human-verify both SCs | No automated packaged-smoke; manual verification of SC2 + SC3 | |

**User's choice:** Automated packaged-smoke + canonical human-verify
**Notes:** `wdio.conf.ts` already targets the packaged binary, so packaged-app automation is half-built. CI runners lack `claude`, so SC2's interactive-agent launch is inherently human-verify; CI smoke uses a stand-in PTY round-trip command. Consistent with every prior phase's end-of-phase human-verify (nyquist gate).

---

## Claude's Discretion

- Exact CI workflow YAML structure
- The placeholder icon's actual artwork
- Windows shell enumeration order/labels
- The `os.release()` build-number parse helper

## Deferred Ideas

- Real branded app icon (file-swap later; config wired)
- Real macOS Developer ID signing + notarization (needs Apple Developer membership; config slots wired)
- macOS universal binary (`--arch=universal`) — only if user wants one Intel+ARM artifact
- The 5 pending todos (folder-picker, edit-modal-prefill, Start-discoverability, 05.1 deferred code-review, 06.1 code-review criticals) — reviewed, none packaging-related, out of scope
- Awareness: ROADMAP shows Phase 6 at 3/4 (06-04 unchecked) but 6.1 superseded it; Phase 8 depends only on Phase 7 (complete), so not a gate
