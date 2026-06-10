# Milestones

## v1.0 MVP (Shipped: 2026-06-10)

**Phases completed:** 9 real phases (Phase 6 superseded by 6.1), 37 plans, 66 tasks
**Audit verdict:** `tech_debt` — 27/27 requirements satisfied, 20/20 cross-phase integration wired, no critical blockers. Full report: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md).

**Delivered:** A cross-platform (Windows + macOS) Electron desktop app that wraps multiple real, PTY-backed terminal sessions behind a sidebar — each with a stable identity and instant, non-destructive switching — built for coding-agent workflows (`claude --rc`, `codex`, REPLs, dev servers).

**Key accomplishments:**

1. **Real terminal fidelity (Core Value)** — node-pty PTY per session via a secure Electron main/preload/renderer split (contextIsolation, contextBridge-only, 20-key typed surface); `claude --rc`, vim, ssh, Python REPL, truecolor, CJK/emoji widths, resize, and a lossless 50 MB throughput path all behave like a native terminal. Human-verified on macOS.
2. **Stable session identity decoupled from process** — branded `LogicalId` permanently distinct from `ptyPid`; rename, re-icon, restart, and tab-switch all preserve the logical id (integration-verified through PtyManager restart + SessionStore hydrate).
3. **Multi-session lifecycle + two-bucket model** — N concurrent sessions, keep-alive on switch, a Working Area (live) + Inactive List (dormant "recipes") with no "Stop" verb, and frame-stability "waiting for you" amber detection so `claude --rc` is correctly amber on a confirmation prompt (Phase 6.1 redesign, replacing the failed output-silence model).
4. **Identity UI + persistence** — collapsible sidebar (icon + name + status, keyboard switching Cmd/Ctrl+1–9), create/edit form, lowdb-backed dormant-restore on reopen (debounced + quit-flushed), and drag-to-reorder that survives restart.
5. **Startup-command auto-run + in-terminal search + scrollback config** — readiness-probe injection of a saved command on start/restart (TERM-05), Cmd/Ctrl+F search overlay with N-of-M navigation, and a global scrollback-size setting.
6. **Cross-platform packaging** — `npm run make` → runnable macOS `.app` (ASAR-unpacked node-pty, ConPTY pre-1809 gate, env-gated/unsigned sign slots) + a 2-OS GitHub Actions matrix producing the Windows `.exe`/installer. macOS canonical `claude --rc` scenario user-verified; Windows real-hardware run deferred to v1.1.

**Known deferred items at close:** 13 (carried to v1.1 — see STATE.md Deferred Items). No critical blockers. The one substantive product tail is **Windows real-hardware verification** (dev is macOS-only; Windows is CI-built + PTY-smoke-proven). The rest is stale verification frontmatter (phases 02/05), Nyquist flags for phases 01–03, 4 UX/code-review todos, and 1 Windows-only UX warning.

---
