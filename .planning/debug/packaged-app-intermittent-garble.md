---
status: parked-pending-repro
severity: high
first_observed: 2026-06-15
recurs: true
component: packaged-app rendering (Electron renderer / GPU)
---

# Debug seed — packaged app opens with whole-window garble (intermittent, recurring)

> Parked pending reproduction + a screenshot. The user hits this intermittently; on
> 2026-06-15 it self-healed before capture ("package is correct now"). User will
> screenshot it next time. Resume via `/gsd-debug` when we have that evidence.

## Symptom

The **packaged** app (`npm run make` / `npm run package`) sometimes opens with the
**whole window garbled (乱码)** — not just the terminal. `npm start` (dev) is always fine.
Recurring across builds/sessions. Reported again 2026-06-15 during the Phase-12 human gate.

## RULED OUT (do not re-investigate these — proven sound at HEAD 272a5dd)

- **The build/bundle is NOT broken.** Proven three ways:
  1. `npm run ui:shots:fresh` capture of the **real packaged binary** (tag `p12-form-gate-postfix`)
     is pixel-crisp — every label/form/sidebar readable (see `artifacts/ui-lab/p12-form-gate-postfix/`).
  2. Launching the `.app` via the **real double-click path** (real userData) rendered the sidebar
     cleanly ("WORKING AREA · 0", "+ Add session").
  3. Built `index.html` uses **relative** asset paths (`./assets/...`), `charset=UTF-8`, fonts bundled
     (`scripts/assert-fonts-bundled.cjs`), `npm run make` exits 0, **zero stderr at boot**.
- **NOT a Phase-12 regression** — it predates Phase 12 and recurs independently. Phase-12 changed only
  `src/renderer` (form CSS/TSX) + tests; `src/main` is byte-untouched.
- Not an asset-path / font-404 / encoding-config problem (all healthy above).

## Leading hypothesis

Intermittent **GPU / Metal rendering corruption** in the packaged renderer.
- Host: **Apple M1**, macOS **13.5.2** (Ventura, 22G91), Metal 3, Retina 2560×1600.
- The terminal uses **xterm `WebglAddon`** (GPU) with a `CanvasAddon` fallback (`src/renderer/SessionView.tsx`).
- The app does **NOT** call `app.disableHardwareAcceleration()` anywhere in `src/main` — hardware accel is ON.
- Whole-window + intermittent + packaged-only + recurring fits a **GPU-process / compositor glitch**,
  not a DOM/asset failure. WDIO/automation launches with a throwaway profile and didn't reproduce it.

## Candidate fixes (decide AFTER confirming the cause — has a real tradeoff)

- `app.disableHardwareAcceleration()` — most robust for whole-window GPU garble, BUT it disables the
  WebGL terminal acceleration the app deliberately chose for high-throughput agent output (Core Value
  perf). **User tradeoff decision — do NOT flip silently.**
- Narrower options to evaluate first: a targeted GPU workaround switch (e.g. `disable-gpu-compositing`),
  forcing the xterm Canvas renderer in packaged mode, or a GPU-process-crash auto-recover.

## Capture checklist for NEXT recurrence (before it self-heals)

1. **Screenshot** of the garbled window — the *kind* decides the fix:
   tofu boxes `□□□` = font/glyph · mojibake (`Ã©`) = encoding · colored noise/smear = **GPU** (expected).
2. Which artifact was opened (fresh `out/...` vs a `make` zip vs an old `/Applications` copy).
3. Every-launch vs intermittent (Cmd+Q + reopen ×3 — ever clean?); external monitor? just woke from sleep?
4. `~/Library/Application Support/Just-Wrapper/` cache state (GPUCache/DawnCache) at the time.

Then: `/gsd-debug` with this note as the seed.
