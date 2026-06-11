---
name: ui-lab
description: >
  Visual capture + self-evolve harness for the Just-Wrapper UI. Use whenever the
  task involves SEEING the running app: visual verification, UI polish loops,
  design-vs-implementation audits, before/after evidence, re-theme demos, or any
  "看看界面 / screenshot the app / does it look right / make it cozier" request.
  Gives the agent deterministic screenshots of named surfaces, a design rubric,
  and a fast CSS preview seam — instead of asking the human to eyeball everything.
---

# ui-lab — eyes on the running app

**Full protocol (read it before driving the loop):** `tests/ui-lab/README.md`
**Scoring standard:** `tests/ui-lab/DESIGN-RUBRIC.md` · **Design authority:** `.planning/DESIGN.md`

## Commands

```bash
npm run package                                  # build once (skip if out/ is current)
npm run ui:shots                                 # capture → artifacts/ui-lab/current/
UI_LAB_TAG=<tag> npm run ui:shots                # tagged run (before/after pairs)
UI_LAB_LIVE_CSS=1 npm run ui:shots               # preview repo CSS edits, no repackage
UI_LAB_OVERRIDE_CSS_FILE=<f> npm run ui:shots    # inject an experiment stylesheet
npm run ui:shots:fresh                           # package + capture (after TSX changes)
```

After a run: Read `artifacts/ui-lab/<tag>/manifest.json`, then Read the PNGs and
score them against the rubric (cite pixel evidence, not CSS source).

## The loop (summary)

baseline → evaluate vs rubric → gap table → edit (tokens.css first) →
`UI_LAB_LIVE_CSS=1` preview → re-look → iterate → `npm run package` + clean
capture (proof) → before/after report to the human.

## Hard rules

- No visual claim without a fresh capture; injection = preview, packaged = proof.
- DESIGN.md is the authority — never bend it (or the rubric) to match output.
- Tokens first (`src/renderer/tokens.css`); per-surface CSS second; TSX last.
- Value-preserving work: before/after PNGs must be visually identical.
- Keep `npm run test:unit` + `npx tsc --noEmit` green every cycle.
- Capture runs are safe alongside a dev instance (isolated userData seam).
