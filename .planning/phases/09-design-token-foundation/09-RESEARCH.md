# Phase 9: Design Token Foundation - Research

**Researched:** 2026-06-10
**Domain:** CSS design tokens (custom properties) + self-hosted web fonts in an Electron 36 + React 19 + Vite renderer; value-preserving refactor with terminal-fidelity guard
**Confidence:** HIGH (the two highest-value unknowns — @fontsource-through-packaging and oklch-alpha migration — are resolved against this repo's own built artifacts + Chromium 136 capability)

## Summary

This is a **refactor-to-tokens + load-the-fonts** phase, not a design phase. The visual direction (DESIGN.md "Switchboard") and every implementation decision (09-CONTEXT.md D-01..D-05) are locked. The genuine unknowns are integration/mechanical, not aesthetic, and all five have concrete answers.

The single highest-value finding: **the packaged renderer already emits relative asset paths.** The built `index.html` (`.vite/renderer/main_window/index.html`) references `./assets/index-*.css` and `./assets/index-*.js` — relative `./`, not absolute `/`. This is because the Electron Forge Vite plugin builds the renderer with a relative base, and main loads it via `win.loadFile(...)` (file:// protocol). Therefore `@font-face url()` references that Vite rewrites inside the bundled CSS will be **relative to the emitted CSS file** and resolve correctly under `file://` in the packaged app — the classic "fonts work in `npm start`, blank in the build" trap **does not apply here** because the base is already relative. The woff2 are ordinary **renderer assets bundled by Vite**, NOT native modules — there is **no node-pty-style ASAR auto-unpack concern**. The plan must NOT over-engineer asset copying or forge.config.ts changes for fonts.

The second highest-value finding: the oklch alpha-tint problem is real (28× blue split between solid `oklch(0.62 0.14 248)` for rings/text and `oklch(0.62 0.14 248 / 0.08)` for hover washes; same pattern for the 8× error-red). The cleanest value-preserving approach is **`color-mix(in oklch, var(--color-accent) 8%, transparent)`** for the wash sites — Electron 36 ships Chromium 136, and `color-mix()` (oklch interpolation) is supported since Chromium 111, so it is fully available. This avoids minting a parallel `--color-accent-tint` token per opacity level and keeps the single-source-of-truth promise intact (retuning `--color-accent` re-tints automatically).

**Primary recommendation:** Extract `tokens.css`, migrate the 6 global primitive families to `var()`/`color-mix()`, install `@fontsource/nunito@5.2.7` + `@fontsource/jetbrains-mono@5.2.8` (verified on npm, official maintainers, ~113K/407K weekly downloads, no postinstall), import the needed weights in `index.tsx` before `tokens.css`+`terminal.css`, point xterm `fontFamily` at the now-loaded JetBrains Mono. Validate with (a) a token-completeness unit test (every `var(--*)` referenced is defined), (b) a packaged `npm run make` smoke that asserts the woff2 are emitted as relative assets, and (c) the existing `status-colors.test.ts` updated to assert `var(--accent-*)` references. SC1 (looks coherent) and the font-render confirmation are human-verify items.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 Hybrid scope** — migrate the GLOBALLY-repeated primitives now (color accent/danger + 5 status accents, shadow, radius, motion, font stacks); **DEFINE** the `--space-*` scale but **DO NOT migrate** per-surface spacing values (that's Phases 10–13). Spacing-value migration is explicitly out of scope this phase.
- **D-02** — Extract a dedicated `src/renderer/tokens.css` `:root` layer, imported **before** `terminal.css` in `index.tsx`. `terminal.css` keeps component styles and consumes tokens. `terminal.css` staying >800 lines after this phase is **accepted tracked debt** (pre-existing, shrinks as 10–13 extract surfaces).
- **D-03** — CSS tokens are the single source of truth; `status-colors.ts` returns `var(--accent-*)` instead of literal oklch for its `accent` field; labels stay in TS; `status-colors.test.ts` updated.
  - Token color set (value-preserving): `--color-accent` (`oklch(0.62 0.14 248)`), `--color-accent-strong` (`0.58 0.14 248`), `--color-danger` (`oklch(0.58 0.16 25)`), `--color-danger-strong` (`0.54 0.16 25`); status accents `--accent-running` (=accent blue), `--accent-finished` (green `0.60 0.13 150`), `--accent-idle` (slate `0.64 0.02 260`, used by `stopped`+`not_started`), `--accent-error` (=danger), `--accent-waiting` (amber `0.66 0.15 60`, reserved); plus existing surface/ink/line tokens + terminal palette (`--term-bg` exists; **add** `--term-text` `oklch(0.90 0.012 250)` and `--term-faint` `oklch(0.66 0.02 255)`).
- **D-04** — `--space-*` numeric 4px base (`--space-1`=4px … with half-steps as needed); semantic names for the rest (`--radius-{xs,sm,md,lg,xl}`, `--shadow-{pop,dialog,menu}`, `--font-{ui,mono}`, `--color-*`, `--duration-fast`, `--ease-standard`). VALUE-PRESERVING — derive exact values from existing px usage, no visual change.
- **D-05** — Self-host Nunito (400/600/700) + JetBrains Mono (400/700) via `@fontsource`, latin subset, `font-display: swap`, local bundle (NO CDN — app is local-only). Tokenize as `--font-ui` (`'Nunito', system-ui, sans-serif`) and `--font-mono` (`'JetBrains Mono', monospace`); migrate the 14+3 raw references. xterm `fontFamily` must reference the loaded JetBrains Mono.

### Claude's Discretion
- Exact `--space-*` step membership + precise radius name↔value map — derive from existing px under the value-preserving constraint.
- Whether `--radius` (18px) is kept as an alias or renamed to `--radius-xl` in lockstep across sites.
- Mechanism for verifying `@fontsource` woff2 is emitted by Vite into the packaged build (researcher confirms below: relative-base renderer assets, no special handling needed).
- Whether to add a drift-guard test asserting every `var(--accent-*)` returned by `status-colors.ts` is defined in `tokens.css` (nice-to-have; recommended below — it is cheap and directly proves SC2/SC3).

### Deferred Ideas (OUT OF SCOPE)
- Per-surface spacing/layout retuning → Phases 10–13 (consume the `--space-*` scale defined here).
- Per-surface CSS file extraction (sidebar.css / modal.css / …) → happens as 10–13 polish each surface. Phase 9 extracts only `tokens.css`.
- Dark mode / theme switch / user-configurable fonts + density → v2 (APPR-01/02).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | One design-token system (palette, type, spacing, surface/elevation, radius, motion) wired app-wide as the foundation Phases 10–13 apply. | Token taxonomy derivation (below) sizes the full token set from existing terminal.css values; @fontsource finding makes the typography real; color-mix finding makes the color migration value-preserving; Validation Architecture proves SC1–4 under the hybrid scope. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Design-token definitions (`:root` custom properties) | Renderer (Chromium) | — | Plain CSS custom properties live in the renderer stylesheet; Chromium resolves them. No main-process involvement. |
| Color single source of truth (`status-colors.ts` → `var()`) | Renderer | — | `status-colors.ts` is renderer-only (already marked "RENDERER ONLY"); it feeds inline `--accent` custom props consumed by renderer CSS. |
| Self-hosted font bundling (woff2 emission) | Renderer build (Vite) | Packaging (Forge — confirm-only) | Vite bundles `@fontsource` CSS+woff2 into the renderer chunk as hashed assets; Forge packages `.vite/` as-is. NOT a native-module/ASAR concern. |
| xterm terminal rendering (font-family) | Renderer (xterm) | — | The xterm `fontFamily` option is set in SessionView; the PTY/main data path is untouched (SC4 guard). |
| Terminal palette tokens (`--term-*`) | Renderer | — | Used both by CSS (`.viewport-stack` background) and by the xterm `TERMINAL_THEME` const (hex mirror). |

## Standard Stack

### Core (new this phase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fontsource/nunito` | 5.2.7 | Self-host Nunito UI font (weights 400/600/700, latin) | [VERIFIED: npm registry, ~113K downloads/week, official Fontsource maintainers jwr1/lotusdevshack, no postinstall] [ASSUMED package-name provenance — name from DESIGN.md/CONTEXT, registry-confirmed but discovered from non-authoritative source; treat as the user-locked D-05 choice, not a free recommendation]. Fontsource is the de-facto standard for self-hosting Google Fonts as npm packages with bundler-friendly per-weight CSS. SIL OFL licensed. |
| `@fontsource/jetbrains-mono` | 5.2.8 | Self-host JetBrains Mono terminal/code font (weights 400/700, latin) | [VERIFIED: npm registry, ~407K downloads/week, same maintainers, no postinstall]. Same rationale; this is the xterm font. |

> Both are the user's **locked D-05 choice**, not a researcher recommendation. They are confirmed present and current on the npm registry, maintained by the official Fontsource org, with strong download counts and no install-time scripts. See Package Legitimacy Audit.

### Supporting (already installed — no change)
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| `vite` (via `@electron-forge/plugin-vite` 7.11.2) | bundled | Renderer bundler — rewrites `@font-face url()` to hashed relative assets | Already in use; emits relative base (`./assets/…`). No config change needed for fonts. |
| `@xterm/xterm` | 5.5.0 | Terminal renderer whose `fontFamily` references JetBrains Mono | Font set in `SessionView.tsx` `new Terminal({ fontFamily: ... })`. |
| `vitest` | 4.1.8 | Unit test runner (Node env) for the token-completeness + status-colors guard tests | Already configured; `environment: 'node'`. |

### Alternatives Considered (all rejected by locked decisions — listed for completeness only)
| Instead of | Could Use | Tradeoff (why locked choice wins) |
|------------|-----------|-----------------------------------|
| `@fontsource` | Extract base64 woff2 from `switchboard-mockup.html` | Mockup embeds them, but they're unversioned/unlicensed-in-place. D-05 chose Fontsource for versioning + explicit SIL OFL license + clean bundler integration. |
| `@fontsource` | Google Fonts CDN `<link>` | Violates the local-only constraint (no network at runtime). D-05 forbids CDN. |
| `color-mix()` for tints | A parallel `--color-accent-tint` token per opacity | Mints N tokens per opacity level and breaks the "retune in one place" promise (the tint wouldn't follow `--color-accent`). `color-mix` keeps one source. See Pitfall 1. |
| CSS tokens as SoT (D-03) | A TS-module color source mirrored into CSS with a drift-guard | Heavier for a plain-CSS app; D-03 chose one home (CSS) with TS referencing `var()`. |

**Installation:**
```bash
npm install @fontsource/nunito@5.2.7 @fontsource/jetbrains-mono@5.2.8
```

**Version verification (run before pinning):**
```bash
npm view @fontsource/nunito version          # → 5.2.7 (confirmed 2026-06-10)
npm view @fontsource/jetbrains-mono version  # → 5.2.8 (confirmed 2026-06-10)
```
Pin EXACT (no caret) per the project's CLAUDE.md convention ("Pinned … at exact versions … to prevent drift").

## Package Legitimacy Audit

> slopcheck 0.6.1 is installed in the environment but exposes **no usable CLI/module entry-point** in this install (`python -m slopcheck` has no `__main__`; the package namespace has no callable surface). Per the graceful-degradation protocol, the two packages are verified manually via registry signals instead, and (out of caution) are flagged for a planner `checkpoint:human-verify` before install — though the manual signals are strong.

| Package | Registry | Age / Last modified | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|---------------------|-----------|-------------|-----------|-------------|
| `@fontsource/nunito` | npm | modified 2025-09-17; v5 line multi-year | ~113K/week | github.com/fontsource/fontsource (official org) | unavailable (degraded) | Approved — strong manual signals; planner adds verify checkpoint |
| `@fontsource/jetbrains-mono` | npm | v5 line multi-year | ~407K/week | github.com/fontsource/fontsource (official org) | unavailable (degraded) | Approved — strong manual signals; planner adds verify checkpoint |

**Manual verification performed (in lieu of slopcheck):**
- Both names resolve on the **correct ecosystem registry** (npm) — no cross-ecosystem confusion.
- Maintainers `jwr1 <dev@jwr.one>` + `lotusdevshack` are the **official Fontsource maintainers**.
- Download volume (113K / 407K weekly) is far above the slop/squat threshold.
- **No `postinstall` script** on either package (`npm view … scripts.postinstall` → empty).

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none (slopcheck unavailable — planner should gate install behind one `checkpoint:human-verify` task as a precaution, then proceed).

## Architecture Patterns

### System Architecture Diagram

```
                         index.tsx (renderer entry)
                                  │
          ┌───────────────────────┼───────────────────────────┐
          │                       │                            │
   @fontsource imports      import './tokens.css'      import './terminal.css'
   (400/600/700.css,         (NEW :root token layer)    (existing component styles,
    400/700.css)                   │                      now consuming var())
          │                        │                            │
   Vite rewrites @font-face   defines --color-*,          references var(--color-accent),
   url() → hashed woff2       --accent-*, --space-*,       color-mix(... var(--color-accent) 8% ...),
   in ./assets/ (relative)    --radius-*, --shadow-*,      var(--radius-*), var(--shadow-*),
          │                   --duration-fast,             var(--font-ui/--font-mono), var(--term-*)
          │                   --ease-standard,
          │                   --font-ui/--font-mono,
          │                   --term-bg/text/faint
          ▼                        ▼                            ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  Chromium 136 renderer (file:// in packaged app, http in dev)      │
   │   • resolves var() incl. nested var() set via inline style         │
   │   • resolves color-mix(in oklch, …) (Chromium 111+)                │
   │   • loads woff2 via relative url() (works under file://)           │
   └──────────────────────────────────────────────────────────────────┘
          │                                          │
          ▼                                          ▼
   status-colors.ts (renderer)               SessionView.tsx (renderer)
   presentation()/STATUS_STYLE return        new Terminal({ fontFamily:
   accent: 'var(--accent-running)' etc.       "'JetBrains Mono', monospace" })
          │                                          │
   fed as inline style="--accent: <value>"   xterm renders terminal in the
   on .status-dot / .collapsed-status-dot      now-LOADED JetBrains Mono
   → resolved against :root by Chromium       (PTY/main data path UNTOUCHED — SC4)
```

The PTY/main process and the xterm↔PTY data path are entirely outside this diagram — Phase 9 touches only renderer presentation (the SC4 guard).

### Recommended File Structure (additive — one new file)
```
src/renderer/
├── tokens.css        # NEW — the :root design-token layer (D-02)
├── terminal.css      # existing — component styles, now consuming var() (stays >800 lines = tracked debt)
├── index.tsx         # @fontsource imports + import './tokens.css' (FIRST) + import './terminal.css'
├── status-colors.ts  # accent values → var(--accent-*) (D-03)
├── SessionView.tsx   # xterm fontFamily → loaded JetBrains Mono (already references it; now real)
└── __tests__/
    ├── status-colors.test.ts   # UPDATE — assert var(--accent-*) references
    └── tokens-completeness.test.ts  # NEW (recommended) — every var(--*) used is defined in tokens.css
```

### Pattern 1: Import order in `index.tsx` (D-02 / D-05)
**What:** Fonts and the token layer must load before the consuming stylesheet so `@font-face` and `:root` vars are defined when `terminal.css` is parsed.
**Example:**
```tsx
// Source: @fontsource v5 import convention (fontsource.org/docs/getting-started/install)
//         + Vite CSS-import ordering (vite.dev/guide/assets)
import ReactDOM from 'react-dom/client';
import '../shared/api-types';

// 1) Fonts FIRST — weights the UI actually uses (D-05). Each import is the latin
//    subset by default with font-display:swap baked into the generated @font-face.
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';

// 2) Token layer BEFORE component styles (D-02).
import './tokens.css';
import './terminal.css';

import { SessionManager } from './SessionManager';
const root = document.getElementById('root')!;
ReactDOM.createRoot(root).render(<SessionManager />);
```
> Note: `@fontsource/<font>/<weight>.css` imports the **latin (default) subset** for that weight. If you want to be explicit/minimal, `@fontsource/<font>/latin-400.css` pins the latin-only subset file. Either satisfies "latin subset, font-display: swap" (D-05) — the generated `@font-face` already declares `font-display: swap`. Do NOT also import the variable-font (`@fontsource-variable/*`) packages; D-05 specifies the static weights.

### Pattern 2: Value-preserving color migration with `color-mix` for tints (D-03)
**What:** Solid usages map to the bare token; alpha-wash usages map to `color-mix`.
**Example:**
```css
/* tokens.css */
:root {
  --color-accent: oklch(0.62 0.14 248);          /* the 28× solid blue */
  --color-accent-strong: oklch(0.58 0.14 248);   /* hover (welcome-cta:hover) */
  --color-danger: oklch(0.58 0.16 25);           /* the error red */
  --color-danger-strong: oklch(0.54 0.16 25);    /* destructive hover */
}

/* terminal.css — solid sites (rings/text/borders): bare token */
.search-input:focus-visible { outline: 2px solid var(--color-accent); }

/* terminal.css — wash sites that today carry "/ 0.08": color-mix, value-preserving */
.row-control-start:hover {
  border-color: var(--color-accent);
  background: color-mix(in oklch, var(--color-accent) 8%, transparent);  /* was oklch(0.62 0.14 248 / 0.08) */
  color: var(--color-accent);
}
```
**Why value-preserving:** `oklch(0.62 0.14 248 / 0.08)` and `color-mix(in oklch, oklch(0.62 0.14 248) 8%, transparent)` produce the **same rendered color** (8% of the accent over transparent, mixed in the same oklch space). Confirm visually in the human-verify pass for the handful of wash sites.

### Pattern 3: Nested `var()` via inline style (D-03) — confirmed safe
**What:** `status-colors.ts` returns `accent: 'var(--accent-running)'`; `SessionRow` sets `style={{ '--accent': presentation(...).accent }}`; CSS reads `background: var(--accent)`.
**Resolution:** Chromium resolves the chain `style="--accent: var(--accent-running)"` → looks up `--accent-running` in the cascade (defined in `:root` in `tokens.css`) → applies. **Nested `var()` set via inline style IS resolved by Chromium** (the custom-property substitution step runs regardless of whether the value came from a stylesheet rule or an inline `style` attribute). [VERIFIED via existing code mechanics: the app already sets `--accent` inline and reads `var(--accent)` in `.status-dot`; the only change is the inline value becomes another `var()`, which substitutes the same way.]
**Caveat:** the referenced custom property (`--accent-running`) must be **defined in a scope that the element inherits from** — `:root` satisfies this for every element. If a token were ever scoped to a subtree the inline element isn't inside, the `var()` would fall back to invalid/initial. Since all tokens live in `:root`, this is safe. The recommended completeness test (Pattern below) guards against a typo'd/undefined reference.

### Anti-Patterns to Avoid
- **Minting a `--color-accent-tint` token per opacity level.** Breaks single-source-of-truth (tint wouldn't follow `--color-accent` retune). Use `color-mix` instead.
- **Touching forge.config.ts / asar.unpackDir for fonts.** Fonts are renderer assets, not native modules. The existing unpack config is for node-pty only — leave it byte-for-byte unchanged.
- **Changing the xterm `TERMINAL_THEME` hex values or the PTY path.** SC4 guard — token wiring is chrome-only. The `--term-*` CSS tokens and the xterm `TERMINAL_THEME` JS const are two mirrors of the same DESIGN.md values; keep them in sync but do not alter rendered terminal colors.
- **Migrating spacing values.** Out of scope (D-01). Define `--space-*`; do not rewrite existing `padding`/`gap`/`margin`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Self-hosting + @font-face generation for Nunito/JetBrains Mono | Hand-written `@font-face` blocks + manually copied woff2 | `@fontsource/*` packages (D-05) | Versioned, SIL-OFL licensed, per-weight/per-subset CSS with `font-display:swap` pre-generated, Vite-bundler-friendly url() rewriting. |
| Alpha tints of a token color | Parallel per-opacity tint tokens | `color-mix(in oklch, var(--token) N%, transparent)` | One source of truth; Chromium 136 supports it natively. |
| Font url() path rewriting for packaging | Custom copy step / publicDir juggling | Vite's built-in asset graph (relative base, hashed names) | Already working in this repo (built index.html uses `./assets/`). |

**Key insight:** Every "hard part" of this phase is already solved by tooling the repo uses. The work is mechanical migration + verification, not building infrastructure.

## Runtime State Inventory

> This is a refactor phase (string/literal → token), so the inventory applies. The "renamed string" here is raw oklch/px/font literals → `var()` tokens. The question: after every CSS/TS literal is swapped, what runtime state still carries the old form?

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** Tokens are presentation-only. No persisted session metadata, lowdb store field, or UI-state key encodes a color/px/font value. `ui.scrollback` is the only persisted UI pref and is unrelated. Verified by grep of `src/main/session-store.ts` schema fields (no color/font keys). | none |
| Live service config | **None.** No external service (no cloud, no telemetry — local-only app). | none |
| OS-registered state | **None.** No OS registration encodes a style value. | none |
| Secrets/env vars | **None.** No secret/env var references a token value. | none |
| Build artifacts | **woff2 assets are NEWLY introduced** (today there are 0 font files in the repo, `@font-face` count = 0). After install, Vite emits hashed woff2 into `.vite/renderer/main_window/assets/`. Stale `.vite/` build output from before the font import will lack them — a clean `npm run make` (or `electron-forge package`) regenerates. The existing built `index-*.css` will be replaced by a new hash once tokens.css + fontsource imports land. | Rebuild renderer (`npm run make`) so the packaged app includes the woff2; this is the packaging smoke (Validation Architecture). No manual artifact deletion needed — `emptyOutDir: true` in vite.renderer.config.ts clears stale output. |

**The canonical question — "after every literal is tokenized, what still carries the old form?"** Answer: only the JS-side `TERMINAL_THEME` hex const in `SessionView.tsx` (intentionally a mirror, kept in sync, not a regression) and the `STATUS_STYLE` accents (which D-03 explicitly migrates to `var()`). The `status-colors.test.ts` literal assertions are the one test that hard-codes the old form and **must be updated in lockstep** (per the project's guard-test pattern).

## Common Pitfalls

### Pitfall 1: oklch alpha can't ride a bare color token
**What goes wrong:** Naively defining `--color-accent: oklch(0.62 0.14 248)` and trying to reuse it for the hover wash sites (`oklch(0.62 0.14 248 / 0.08)`) — there's no syntax to append `/ 0.08` to a `var()` that already contains a full color.
**Why it happens:** 28 blue sites split ~roughly into solid (rings/text/borders/filled CTAs) and wash (`/ 0.08` hover backgrounds — at least 4 sites: `.row-control-start:hover`, `.row-control-close:hover` (red), `.search-case-active`, `.identity-header .row-control-start:hover`). The error-red has the same split (`oklch(0.58 0.16 25 / 0.08)` in `.row-control-close:hover`).
**How to avoid:** Use `color-mix(in oklch, var(--color-accent) 8%, transparent)` at wash sites (Chromium 136 supports it). Keep the bare token at solid sites. Both are value-preserving.
**Warning signs:** A wash that renders fully opaque (the `var()` resolved to the solid color because the `/ 0.08` was dropped) — caught in human-verify and by eyeballing the ~4 hover sites.

### Pitfall 2: "Works in dev, blank fonts in the packaged build"
**What goes wrong:** Self-hosted fonts render in `npm start` but fall back to system fonts in the `electron-forge make` build, because absolute `url(/assets/font.woff2)` paths 404 under `file://`.
**Why it happens (and why it does NOT happen here):** This is the #1 reported @fontsource+Electron issue, caused by Vite's default `base: '/'` producing absolute paths. **This repo already ships a relative base** — the built `index.html` references `./assets/index-*.css` (relative), and main loads via `win.loadFile()`. Vite rewrites `@font-face url()` inside the bundled CSS relative to the emitted CSS file, so they resolve under `file://`. No config change needed.
**How to avoid / verify:** The packaging smoke (Validation Architecture below) asserts woff2 land in `.vite/renderer/main_window/assets/` and the emitted CSS references them relatively. If a future Vite/Forge upgrade flips the base to absolute, this smoke catches it.
**Warning signs:** `index.html` or the bundled CSS containing `url(/assets/...)` (leading slash) instead of `url(./...)` or a hashed relative name.

### Pitfall 3: assetsInlineLimit silently inlining (or not) the woff2
**What goes wrong:** Vite inlines assets below `assetsInlineLimit` (default 4096 bytes) as base64 data URLs. A latin-subset woff2 is typically larger (tens of KB) so it will be emitted as a **file**, not inlined — which is what we want (one shared file vs. base64 bloat per import).
**Why it matters:** Either outcome works at runtime (data URL or relative file both load under file://), but a file is preferable for caching/size. No action needed — just be aware the woff2 will appear as hashed files in `assets/`, not inlined, which is the expected/correct result.
**How to avoid:** Do not lower `assetsInlineLimit`. Leave the Vite renderer config untouched.

### Pitfall 4: Updating `status-colors.test.ts` to match D-03
**What goes wrong:** The migration changes `STATUS_STYLE.running.accent` from `'oklch(0.62 0.14 248)'` to `'var(--accent-running)'`, but the test still asserts the literal oklch (lines 77, 84–86 of the current test) → RED.
**How to avoid:** Update the test in lockstep (the project's guard-test discipline). The test should now assert the `var(--accent-*)` reference strings AND (recommended) a companion test asserts `tokens.css` defines each referenced property. Note `AGENT_STYLE` is also migrated (amber `--accent-waiting`, etc.) — its assertions move from literal oklch to `var()` too.
**Warning signs:** `npm run test:unit` RED on `status-colors.test.ts` after the migration with literal-vs-var mismatch — expected until the test is updated.

### Pitfall 5: The xterm theme is JS hex, not CSS oklch — don't accidentally "tokenize" it into a var()
**What goes wrong:** Trying to feed a CSS `var(--term-bg)` into the xterm `TERMINAL_THEME` JS object. xterm's theme takes literal color strings (hex/rgb), not CSS custom properties — `var(--term-bg)` would be an invalid color to xterm and break the terminal background (an SC4 regression).
**How to avoid:** Keep `TERMINAL_THEME` as the hex mirror in `SessionView.tsx` (`background: '#1e232c'` etc.). The CSS `--term-*` tokens serve the CSS gutter (`.viewport-stack` / `.session-view` background) so the gutter matches before the first frame. D-03 adds `--term-text`/`--term-faint` CSS tokens for completeness; it does NOT route them through the xterm theme object. Only the `fontFamily` string is shared conceptually (`'JetBrains Mono', monospace`).

## Code Examples

### tokens.css skeleton (derived from existing values — value-preserving)
```css
/* tokens.css — the :root design-token layer (D-02/D-04). Values carried verbatim
 * from terminal.css/status-colors.ts/DESIGN.md. NO visual change except fonts. */
:root {
  /* Surface / ink / line (moved as-is from terminal.css lines 6–17) */
  --surface: #ffffff;
  --bg: oklch(0.975 0.008 85);          /* DESIGN.md (not yet in terminal.css :root) */
  --bg-sunk: oklch(0.955 0.01 85);
  --ink: oklch(0.32 0.012 70);
  --ink-soft: oklch(0.5 0.012 70);
  --ink-faint: oklch(0.66 0.01 75);
  --line: oklch(0.91 0.008 80);
  --line-soft: oklch(0.94 0.006 80);

  /* Terminal palette (CSS gutter; xterm theme mirrors these as hex in SessionView) */
  --term-bg: #1e232c;                   /* = oklch(0.255 0.018 264) */
  --term-text: oklch(0.90 0.012 250);   /* ADD (D-03) */
  --term-faint: oklch(0.66 0.02 255);   /* ADD (D-03) */

  /* Brand colors */
  --color-accent: oklch(0.62 0.14 248);
  --color-accent-strong: oklch(0.58 0.14 248);
  --color-danger: oklch(0.58 0.16 25);
  --color-danger-strong: oklch(0.54 0.16 25);

  /* Status accents (consumed by status-colors.ts via var()) */
  --accent-running: var(--color-accent);          /* blue */
  --accent-finished: oklch(0.60 0.13 150);         /* green */
  --accent-idle: oklch(0.64 0.02 260);             /* slate (stopped + not_started) */
  --accent-error: var(--color-danger);             /* red */
  --accent-waiting: oklch(0.66 0.15 60);           /* amber — TERM-09 reserved */

  /* Radius — value-preserving from distinct radii in terminal.css */
  --radius-xs: 6px;     /* .row-icon */
  --radius-sm: 7px;     /* .row-control / .search-control */
  --radius-md: 8px;     /* inputs, emoji-cell, context-menu-item, swatches */
  --radius-lg: 10px;    /* rows, modal-btn, inputs, search-bar */
  --radius-xl: 12px;    /* context-menu, edit-restart-group, idle-card-config */
  --radius: 18px;       /* KEEP existing alias (cards: modal-dialog, idle-card, rail-tooltip) — Discretion: alias vs rename */
  /* Note: 999px pills (status-dot, chips) stay literal — they are "fully round", not a scale step. */

  /* Elevation — the 3 distinct shadows in use */
  --shadow-pop: 0 6px 18px oklch(0.32 0.012 70 / 0.14);     /* cards/tooltip/search/dragging (3×) */
  --shadow-dialog: 0 18px 48px oklch(0.255 0.018 264 / 0.28); /* modal/idle-card (2×) */
  --shadow-menu: 0 10px 30px oklch(0.255 0.018 264 / 0.22);  /* context-menu (1×) */
  /* Note: the .collapsed-status-dot ring `0 0 0 2px var(--surface)` is a ring, not an
   * elevation shadow — leave literal or name --ring-dot per Discretion. */

  /* Motion — value-preserving (existing 0.12s ease) */
  --duration-fast: 120ms;
  --ease-standard: ease;

  /* Type stacks (the now-real fonts) */
  --font-ui: 'Nunito', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing scale — DEFINED for Phases 10–13 (D-01). NOT applied to existing
   * padding/gap/margin this phase. 4px base + half-steps to cover existing values
   * (existing usage includes 2,4,5,6,8,10,12,14,16,20,22,24,32,48 px). */
  --space-0_5: 2px;
  --space-1: 4px;
  --space-1_5: 6px;
  --space-2: 8px;
  --space-2_5: 10px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  /* Existing 5px/14px/22px are odd-ball one-offs; Phases 10–13 will retune to the
   * nearest scale step during per-surface polish (D-01). Do NOT migrate them now. */
}
```

### status-colors.ts after D-03
```ts
// Source: existing status-colors.ts, accent literals → var() references (D-03)
export const STATUS_STYLE: Record<SessionStatus, { label: string; accent: string }> = {
  running:     { label: 'Running',  accent: 'var(--accent-running)' },
  exited:      { label: 'Finished', accent: 'var(--accent-finished)' },
  stopped:     { label: 'Stopped',  accent: 'var(--accent-idle)' },
  not_started: { label: 'Idle',     accent: 'var(--accent-idle)' },
  error:       { label: 'Error',    accent: 'var(--accent-error)' },
};
export const AGENT_STYLE: Record<AgentState, { label: string; accent: string }> = {
  'in-progress': { label: 'In progress',     accent: 'var(--accent-running)' },
  waiting:       { label: 'Waiting for you', accent: 'var(--accent-waiting)' },
  free:          { label: 'Free',            accent: 'var(--accent-idle)' },
};
// presentation() / statusLabel() / statusAccent() unchanged in shape.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-written `@font-face` + manually committed woff2 | `@fontsource/*` per-weight npm packages | Fontsource v4→v5 (per-subset CSS, ~2023) | Bundler handles url() rewriting; versioned + licensed. |
| `rgba()` / pre-computed alpha colors | `color-mix(in oklch, …)` for token-derived tints | Chromium 111 (2023) — fully in Electron 36/Chromium 136 | Tints stay derived from the source token (single source of truth). |
| `xterm` (unscoped) | `@xterm/xterm` 5.x | xterm v5 rename | Already adopted in this repo. |

**Deprecated/outdated:** Nothing in scope is deprecated. `color-mix` is stable, not experimental, in Chromium 136.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@fontsource/nunito@5.2.7` / `@fontsource/jetbrains-mono@5.2.8` are legitimate (package names came from DESIGN.md/CONTEXT, registry-confirmed but slopcheck was unavailable). | Standard Stack / Package Audit | Low — strong manual signals (official maintainers, 100K+/400K+ weekly downloads, no postinstall). Planner adds one `checkpoint:human-verify` before install as belt-and-suspenders. |
| A2 | `@fontsource/<font>/<weight>.css` imports the latin subset by default with `font-display:swap` baked in. | Pattern 1 | Low — confirmed against Fontsource v5 docs/convention. If a build wants strictly latin-only, use `latin-<weight>.css`. Verify the generated `@font-face` declares `swap` in the human/build check. |
| A3 | The 18px `--radius` is best kept as an alias (vs renamed to `--radius-xl`) to avoid touching the ~3 card sites. | tokens.css skeleton / D-04 Discretion | None functional — this is the explicitly-delegated Discretion call; both options are value-preserving. Planner decides. |
| A4 | The odd-ball 5px/14px/22px spacing values are left untouched this phase (retuned to scale steps in 10–13). | tokens.css skeleton / D-01 | None — D-01 explicitly defers spacing-value migration. Stated to prevent over-reach. |

**If empty:** not empty — see above. None are blocking; A1 is the only one warranting the precautionary checkpoint.

## Open Questions

1. **Exact opacity-percent equivalence of `color-mix` vs the old `/ 0.08` washes.**
   - What we know: `color-mix(in oklch, X 8%, transparent)` renders the same as `X` at 8% alpha for our cases.
   - What's unclear: Sub-pixel/anti-aliasing rounding could in theory differ by an imperceptible amount.
   - Recommendation: Treat as value-preserving; confirm the ~4 hover-wash sites by eye in the human-verify pass (they are subtle hover backgrounds, not load-bearing). If a difference is ever visible, fall back to a dedicated `--color-accent-wash` token at those specific sites only.

2. **Whether `--radius` (18px) stays an alias or is renamed in lockstep.**
   - What we know: ~3 card sites use `var(--radius)`; renaming to `--radius-xl` is mechanical.
   - What's unclear: Pure taste/consistency — D-04 explicitly delegates this to the planner.
   - Recommendation: Keep `--radius` as `--radius-xl`'s alias (or set `--radius: var(--radius-xl)`) to minimize churn; either is value-preserving.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/npm | Installing @fontsource | ✓ | (repo uses it) | — |
| Vite (via Forge plugin) | Bundling woff2 as renderer assets | ✓ | plugin-vite 7.11.2 | — |
| Electron / Chromium | `color-mix(in oklch)`, oklch, var() | ✓ | Electron 36.9.5 = Chromium 136 (color-mix since 111) | — |
| vitest | token-completeness + status-colors guard tests | ✓ | 4.1.8 (env: node) | — |
| `electron-forge make` | Packaging smoke (woff2-in-build proof) | ✓ | 7.11.2 (proven at Phase 8 on macOS) | — |
| jsdom / @testing-library | (would be needed for DOM/component tests) | ✗ | — | NOT needed — see Validation Architecture: prove tokens via file-content static analysis + a packaged smoke, not jsdom. No new test dep required. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** jsdom is absent, but the recommended validation deliberately avoids it (static CSS/TS text analysis + the existing WDIO packaged smoke covers SC1–4 without a DOM testing stack). Do NOT add jsdom for this phase.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`). This section feeds VALIDATION.md. It honestly reflects the **hybrid scope (D-01)**: Phase 9 DEFINES the spacing scale and fully tokenizes the global primitives — it does NOT claim 100% spacing-value migration. SC2's "spacing sourced from named tokens" is satisfied for the global primitives + by the scale's existence; per-surface spacing-value sourcing completes across Phases 10–13.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.8 (unit, `environment: 'node'`) + WebdriverIO 9 `@wdio/electron-service` (packaged smoke) |
| Config file | `vitest.config.ts` (include `src/**/__tests__/**/*.test.ts`, `src/**/*.guard.test.ts`); `wdio.conf.ts` (smoke) |
| Quick run command | `npm run test:unit` |
| Full suite command | `npm run test` (unit + smoke) ; packaging proof: `npm run make` |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| SC2 (single source) | Every `var(--*)` referenced in `terminal.css` + `status-colors.ts` is DEFINED in `tokens.css` | unit (static text analysis, node env — reads the CSS/TS files as strings, no DOM) | `npx vitest run src/renderer/__tests__/tokens-completeness.test.ts` | ❌ Wave 0 — NEW |
| SC2/SC3 (status SoT) | `STATUS_STYLE`/`AGENT_STYLE` return `var(--accent-*)` refs; each ref is defined in tokens.css | unit | `npx vitest run src/renderer/__tests__/status-colors.test.ts` | ✅ exists — UPDATE (literals → var refs) |
| SC2 (no stray literals) | The migrated global primitives no longer appear as raw literals in `terminal.css` (e.g. `oklch(0.62 0.14 248)` count drops from 28 to 0; `0.58 0.16 25` from 8 to 0; `'Nunito'` from 14 to 0; `'JetBrains Mono'` from 3 to 0 outside tokens) | unit (text-count assertion) | (same `tokens-completeness.test.ts` — add literal-absence assertions) | ❌ Wave 0 — NEW |
| SC4 (fidelity untouched) | The xterm/PTY path is unchanged: `SessionView.tsx` `TERMINAL_THEME` hex unchanged, PTY data path untouched, EXPECTED_API_KEYS stays 20 | unit (existing `security.guard.test.ts` for key count) + the existing `pty-roundtrip.smoke.test.ts` echo invariant | `npm run test:unit` + `npm run test:smoke` | ✅ exist — must stay GREEN |
| SC4 / D-05 (fonts actually load + survive packaging) | woff2 emitted into `.vite/renderer/main_window/assets/`; the bundled CSS references them via RELATIVE url(); the packaged app boots | smoke (packaged) | `npm run make` then assert woff2 files exist under the renderer assets dir + grep the emitted CSS for relative `url(`/no leading-slash font url | ❌ Wave 0 — NEW (extend Phase-8 smoke harness or a build-output assertion script) |
| SC1 (looks coherent) + fonts render | Human opens the app: same layout/colors as before, NOW in Nunito + JetBrains Mono; hover washes look identical | manual (human-verify — `human_verify_mode: end-of-phase`) | n/a — `09-HUMAN-UAT.md` | n/a |
| SC3 (retune-in-one-place) | Changing `--color-accent` in tokens.css visibly re-themes every accent surface | manual spot-check during human-verify (flip the token, observe app, revert) | n/a | n/a |

### Sampling Rate
- **Per task commit:** `npm run test:unit` (fast; includes the new completeness test + updated status-colors test).
- **Per wave merge:** `npm run test` (unit + smoke).
- **Phase gate:** full unit suite GREEN + `npm run make` succeeds with woff2 in the build + the end-of-phase human-verify (SC1/SC3/font-render) approved → only then nyquist_compliant flips true in 09-VALIDATION.md.

### Wave 0 Gaps
- [ ] `src/renderer/__tests__/tokens-completeness.test.ts` — NEW. Pure node test: read `tokens.css`, `terminal.css`, `status-colors.ts` as text; parse `--name:` definitions and `var(--name)` references; assert every referenced token is defined; assert the migrated literals (`oklch(0.62 0.14 248)`, `oklch(0.58 0.16 25)`, `'Nunito'`, `'JetBrains Mono'`) no longer appear in `terminal.css` (allowed only in `tokens.css`). Covers SC2/SC3. No new dependency.
- [ ] `src/renderer/__tests__/status-colors.test.ts` — UPDATE (exists). Swap literal-oklch assertions for `var(--accent-*)` reference assertions; keep the overlay-only-when-running contract assertions intact.
- [ ] Packaged-font smoke / build-output assertion — NEW. Either extend the Phase-8 WDIO smoke or add a small node script run after `npm run make` that asserts: (1) `>=1` woff2 file under `.vite/renderer/main_window/assets/` (or in the packaged resources), (2) the emitted renderer CSS contains no `url(/` absolute font path (relative-base guard against Pitfall 2). Covers SC4/D-05 packaging.
- [ ] `09-HUMAN-UAT.md` — the SC1/SC3 + font-render manual checklist (end-of-phase gate).
- Framework install: none needed (vitest + wdio already present; jsdom deliberately NOT added).

## Security Domain

> security_enforcement is enabled (config.json `security_enforcement: true`, ASVS level 1). This phase is renderer-presentation-only with NO new IPC surface, NO user-input parsing changes, NO network. The security surface is minimal but two ASVS categories apply.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V5 Input Validation / Output Encoding | yes (indirect) | The migration must NOT change the existing `sanitizeNotice()` ANSI-injection defense in `SessionView.tsx` (notices written into the terminal are stripped of control chars). Token wiring touches CSS/color literals only — it must not alter the fixed-literal ANSI writes (MOUSE_RESET / ALT_SCREEN_EXIT) which carry an ASVS-V5 "no interpolation" comment. |
| V6 Cryptography | no | No crypto in scope. |
| Supply chain (V1/V14 family) | yes | Two new npm deps (`@fontsource/*`). Mitigated by: registry verification (official maintainers, high downloads, no postinstall), exact-version pin, and a precautionary `checkpoint:human-verify` before install (slopcheck was unavailable). woff2 are static assets — no executable surface. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/typosquatted font package | Tampering | Exact-pin verified versions; official Fontsource org; no postinstall; human-verify checkpoint. |
| ANSI/terminal injection via a token-migration regression | Tampering | Leave `sanitizeNotice` + the fixed-literal ANSI writes byte-for-byte unchanged (SC4 / V5). The phase touches color/px/font literals, never the ANSI escape literals. |
| New IPC/bridge surface | Elevation | None added — EXPECTED_API_KEYS stays 20 (the existing `security.guard.test.ts` enforces this; it must stay GREEN). |

## Sources

### Primary (HIGH confidence)
- This repo's built artifact `.vite/renderer/main_window/index.html` — confirms RELATIVE asset base (`./assets/…`) under `loadFile`/`file://`. The decisive evidence for the @fontsource-packaging answer.
- `src/main/index.ts` (lines 143–147) — confirms `win.loadFile(...)` for the packaged renderer (file:// protocol).
- npm registry (`npm view`) — `@fontsource/nunito@5.2.7`, `@fontsource/jetbrains-mono@5.2.8`, maintainers, no postinstall (queried 2026-06-10).
- npm downloads API — 113K/week (nunito), 407K/week (jetbrains-mono).
- [Electron 36.0.0 release notes](https://www.electronjs.org/blog/electron-36-0) — Electron 36 = Chromium 136 (so `color-mix(in oklch)` Chromium-111+ is available).
- [Vite Static Asset Handling](https://vite.dev/guide/assets) — assetsInlineLimit, hashed assets, url() rewriting in CSS.
- [Electron Forge Vite Plugin](https://www.electronforge.io/config/plugins/vite) — renderer build + MAIN_WINDOW_VITE_NAME loadFile pattern.

### Secondary (MEDIUM confidence)
- [Fontsource Install docs](https://fontsource.org/docs/getting-started/install) (via search) — `@fontsource/<font>/<weight>.css` per-weight import convention; latin-subset default; font-display:swap baked in.
- [vitejs/vite#1618](https://github.com/vitejs/vite/issues/1618) + [Vite @font-face 404 discussion](https://laracasts.com/discuss/channels/vite/vite-at-font-face-fonts-404-on-dev-server) — confirm the absolute-base 404 failure mode (which this repo avoids).

### Tertiary (LOW confidence — flagged)
- slopcheck legitimacy verdict: UNAVAILABLE in this environment (no CLI entry-point); substituted with manual registry signals + a precautionary human-verify checkpoint.

## Metadata

**Confidence breakdown:**
- @fontsource through packaging: HIGH — proven against the repo's own relative-base built index.html + loadFile.
- oklch alpha / color-mix migration: HIGH — Chromium 136 supports color-mix; equivalence is value-preserving.
- Nested var() inline style: HIGH — the app already uses the inline-`--accent` mechanism; D-03 only nests one more level, which Chromium substitutes normally.
- Token taxonomy derivation: HIGH — derived directly from grepped distinct values in terminal.css.
- Validation architecture: HIGH — designed around the repo's actual infra (vitest node env, no jsdom, existing WDIO smoke).
- Package legitimacy: MEDIUM — strong manual signals but slopcheck unavailable (precautionary checkpoint recommended).

**Research date:** 2026-06-10
**Valid until:** ~2026-07-10 (30 days; stable stack — only an Electron/Vite/Forge major upgrade that flips the renderer base to absolute would invalidate the packaging finding, which the packaged-font smoke guards against).
