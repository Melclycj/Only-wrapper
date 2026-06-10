# Phase 9: Design Token Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 9-Design Token Foundation
**Areas discussed:** Foundation scope & file split, Color single source of truth, Scales & naming, Font loading

---

## Pre-discussion routing decision

| Option | Description | Selected |
|--------|-------------|----------|
| Proceed as planned | Tokenize the already-locked Switchboard design (DESIGN.md) and wire app-wide; visual direction not re-opened | ✓ |
| Revisit visual direction first | Re-explore style before locking tokens (prototyping-ui-directions) | |
| Plan only, don't run | Print the remaining pipeline; user triggers steps manually | |

**User's choice:** Proceed as planned.
**Notes:** DESIGN.md is the user's own high-fidelity mockup, marked "north-star reference (visual authority)" — defaulting to tokenize-as-locked was the intended path.

---

## Foundation scope & file split

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid — migrate global primitives now | accent/error/shadow/font/radius/motion migrated to tokens now + extract tokens.css; per-surface spacing deferred to 10–13 | ✓ |
| Tokens-only layer | Define full token set but don't touch existing raw instances; smallest blast radius but 28× blue still scattered | |
| Full migration | All raw→token in terminal.css now; biggest blast radius, collides with 10–13 same-file edits | |

**User's choice:** Hybrid — migrate global primitives now.
**Notes:** UI-01 frames tokens as "the foundation the per-surface requirements build on"; the cross-cutting duplicated primitives (28× blue, unloaded fonts) are the real debt to unify before per-surface work, while spacing is inherently per-surface (10–13). Extract a dedicated `tokens.css`; `terminal.css` staying >800 lines is accepted tracked debt.

---

## Color single source of truth

| Option | Description | Selected |
|--------|-------------|----------|
| CSS token as source | Values move to :root; status-colors.ts returns var(--accent-*); labels stay in TS; status-colors.test.ts updated | ✓ |
| Token + TS mirror + guard test | Keep oklch in both CSS and TS, add a drift-guard test; explicit but duplicated | |
| TS module as source | Needs a build step / CSS-in-JS for CSS to read TS; too heavy for a plain-CSS app | |

**User's choice:** CSS token as source.
**Notes:** App is plain CSS; Chromium resolves inline `var()` natively; `STATUS_STYLE.accent` is already injected as the per-row inline `--accent` custom property, so switching its value from a literal to a `var()` reference is a natural fit.

---

## Scales & naming

| Option | Description | Selected |
|--------|-------------|----------|
| Numeric (4px base) spacing + semantic rest | --space-1..12, --radius-sm/md/lg, --shadow-pop/dialog/menu, --font-ui/mono, --color-accent; derived from existing px values | ✓ |
| All t-shirt (xs/sm/md/lg) | Consistent but can't express the intermediate spacing values already used (2/6/10/14) | |
| You derive from existing values, don't ask | Generate the scale directly from terminal.css px values | |

**User's choice:** Numeric (4px base) spacing + semantic rest.
**Notes:** Matches the token examples in `~/.claude/rules/web/coding-style.md`; existing px values fall cleanly on a 4px base. Spacing scale is *defined* this phase but spacing values are *not migrated* (per the hybrid scope).

---

## Font loading

| Option | Description | Selected |
|--------|-------------|----------|
| Self-host via @fontsource now | npm @fontsource packages, latin subset, Nunito 400/600/700 + JetBrains Mono 400/700, font-display swap, local bundle (no CDN) | ✓ |
| Self-host, extract woff2 from mockup | No new dependency; manually extract embedded base64 fonts from switchboard-mockup.html | |
| Defer font bundling | Leave to a later UI phase; but Phase 9 foundation would ship without the signature typography | |

**User's choice:** Self-host via @fontsource now.
**Notes:** Critical finding — `@font-face` count is 0 and there are 0 font files in the repo, so the cozy Nunito/JetBrains Mono identity is not currently rendering (system-ui fallback). @fontsource is versioned/licensed (SIL OFL) and cleaner than scraping base64. Local-only constraint forbids CDN/Google Fonts.

## Claude's Discretion
- Exact `--space-*` step membership + precise radius name↔value map (value-preserving, derived from existing px values).
- Whether `--radius` (18px) is kept as an alias or renamed to `--radius-xl` in lockstep.
- Vite/Electron font-asset emit verification for the packaged app.
- Optional drift-guard test asserting every `var(--accent-*)` is defined in `tokens.css`.

## Deferred Ideas
- Per-surface spacing/layout retuning → Phases 10–13.
- Per-surface CSS file extraction → as 10–13 polish each surface.
- Dark mode / theme switch / configurable fonts + density → v2 (APPR-01/02).
- 5 keyword-matched todos (folder picker, start control, edit prefill, 06.1 criticals, 05.1 deferred) → reviewed, not folded; already assigned to Phases 11/12/14.
