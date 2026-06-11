# ui-lab — visual capture + self-evolve harness

Gives an agent **eyes on the running app**: deterministic screenshots of named
surfaces, a design rubric to score them against, and a fast preview seam so the
agent can iterate `look → critique → edit → re-look` against
`.planning/DESIGN.md` when given a direction.

Built on the existing WebdriverIO + `@wdio/electron-service` smoke stack — same
packaged binary, same driver vocabulary (`tests/smoke/helpers/xterm-driver.ts`).

## Quick start

```bash
npm run package        # build the app once (skip if out/ is current)
npm run ui:shots       # capture all surfaces → artifacts/ui-lab/current/
```

Outputs per run: one PNG per surface + `manifest.json` (run metadata, per-surface
status/designRefs, skip reasons). The manifest is the first file an evaluating
agent reads; the PNGs are read directly (multimodal Read).

## Modes

| Mode | Command | What it captures | Use for |
|------|---------|------------------|---------|
| **Baseline / proof** | `npm run ui:shots` | Packaged app, no injection | Ground truth. The ONLY mode that proves anything. |
| **Tagged baseline** | `UI_LAB_TAG=before-phase10 npm run ui:shots` | Same, into `artifacts/ui-lab/before-phase10/` | Before/after evidence pairs. |
| **Live-CSS preview** | `UI_LAB_LIVE_CSS=1 npm run ui:shots` | Packaged app + current repo `tokens.css`+`terminal.css` injected over the bundled CSS | Fast iteration on CSS edits WITHOUT repackaging (~seconds vs minutes). |
| **Override demo** | `UI_LAB_OVERRIDE_CSS_FILE=/tmp/x.css npm run ui:shots` | Packaged app + an extra stylesheet injected last | Token experiments (e.g. SC3 re-theme demo) with zero source edits. |
| **Fresh** | `npm run ui:shots:fresh` | `npm run package` + baseline capture | After TSX/structure changes (injection can't preview those). |

Modes compose: `UI_LAB_TAG=accent-green UI_LAB_OVERRIDE_CSS_FILE=/tmp/green.css npm run ui:shots`.

### Injection caveats (why preview ≠ proof)

- Injection appends a `<style id="ui-lab-override">` AFTER the bundled CSS:
  additions and value changes win, but rules **deleted** from source still apply
  from the bundled sheet underneath. Stale-deletion artifacts are possible.
- The xterm terminal CONTENT is canvas/WebGL-rendered — CSS injection restyles
  the chrome around it, not the terminal text/theme (that's a JS theme change →
  needs repackage).
- Therefore: **always finish with a packaged, no-injection capture** before
  claiming a visual result.

## The self-evolve loop (agent protocol)

Given a DIRECTION from the human (e.g. "make the sidebar cozier, more contrast
on the active card"):

```
0. Baseline   UI_LAB_TAG=<dir>-before npm run ui:shots   (packaged, no injection)
1. Evaluate   Read manifest + PNGs → score vs DESIGN-RUBRIC.md + DESIGN.md
              → gap table (surface | line | verdict | evidence | severity | fix route)
2. Translate  DIRECTION + gaps → concrete edits. Tokens FIRST (tokens.css —
              re-themes everywhere), per-surface CSS second, TSX last.
3. Edit       src/renderer/tokens.css / terminal.css (value edits, additions)
4. Preview    UI_LAB_LIVE_CSS=1 UI_LAB_TAG=<dir>-iter-N npm run ui:shots
5. Re-look    Read new PNGs → re-score the gap lines. Not better? → back to 2.
6. Prove      npm run package && UI_LAB_TAG=<dir>-after npm run ui:shots
              (no injection — ground truth)
7. Report     Present before/after PNG pairs + the gap-table delta to the human.
              The human gives the next direction or signs off.
```

### Hard rules (invariants)

1. **No claim without a capture.** "Should look better" is banned; every visual
   claim cites a PNG from a fresh run.
2. **Injection is preview, packaged is proof.** Step 6 is mandatory before
   reporting success.
3. **DESIGN.md is the authority.** The rubric operationalizes it; never edit
   DESIGN.md (or the rubric's intent) to match the current output. Direction
   changes come only from the human.
4. **Tokens first.** If a fix can live in `tokens.css`, it must — that's the
   single-source-of-truth contract (guarded by `tokens-completeness.test.ts`).
5. **Value-preserving work** (refactors): capture before + after with the same
   tag pair and verify the PNGs are visually identical — any diff is a regression.
6. **Keep the suite green.** `npm run test:unit` (incl. token completeness) and
   `npx tsc --noEmit` after every edit cycle.

## How it stays safe / deterministic

- `wdio.uilab.conf.ts` sets `JW_USER_DATA_DIR` → the seam in `src/main/index.ts`
  redirects `userData` to `artifacts/ui-lab/.userdata` (wiped per run).
  - fresh boot ⇒ reproducible `empty-state`
  - **never touches the developer's real session store** — safe to run while a
    dev instance (`npm start`) is open
- Window fixed at 1280×800; captures wait for `document.fonts.status === 'loaded'`.
- Surfaces run in one app session, in registry order; a failing surface records
  an `error` entry and the run continues (partial evidence > no evidence).

## Adding a surface

Add one entry to `SURFACES` in `tests/ui-lab/surfaces.ts`:

```ts
{
  id: 'my-surface',                  // → my-surface.png
  title: 'Human-readable state name',
  designRefs: ['DESIGN.md §...'],    // what it's judged against
  expects: 'One line of what good looks like.',
  prepare: async (ctx) => { /* drive the app into the state */ },
  cleanup: async (ctx) => { /* restore neutral state (best-effort) */ },
}
```

Then add a matching checklist section to `DESIGN-RUBRIC.md`. Reuse drivers from
`tests/smoke/helpers/xterm-driver.ts`; prefer `data-testid` selectors. Surfaces
may throw `SkipSurface('reason')` when legitimately unreachable.

## File map

| File | Role |
|------|------|
| `wdio.uilab.conf.ts` (root) | Harness config: isolated userData, spec glob, timeouts |
| `tests/ui-lab/surfaces.ts` | THE surface registry (ordered, extensible) |
| `tests/ui-lab/capture.uilab.test.ts` | Walks the registry, shoots, writes manifest |
| `tests/ui-lab/helpers.ts` | Fonts-ready, CSS injection, manifest, output layout |
| `tests/ui-lab/DESIGN-RUBRIC.md` | Screenshot-checkable expectations + eval protocol |
| `artifacts/ui-lab/<tag>/` | Run outputs (gitignored): PNGs + manifest.json |
| `src/main/index.ts` (seam) | `JW_USER_DATA_DIR` userData redirect (env-guarded) |
