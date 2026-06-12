---
created: 2026-06-12T05:45:00.000Z
title: npm run make build crashes on open — lowdb browser LocalStorage/WebStorage module resolution
area: build
files:
  - forge.config.ts
  - vite.main.config.ts
  - src/main/session-store.ts
---

## Problem

Surfaced 2026-06-12 during the Phase-10 round-4 human gate. The operator ran
`npm run make` and, on opening the produced app, got a runtime error showing lowdb's
**browser** adapter source instead of the UI booting:

```
import { WebStorage } from './WebStorage.js';
export declare class LocalStorage extends WebStorage { constructor(key: string); }
import { WebStorage } from './WebStorage.js';
export class LocalStorage extends WebStorage { constructor(key) { super(key …
```

The app does **not** use lowdb's browser `LocalStorage`/`WebStorage` adapter anywhere —
persistence is main-process only via `lowdb/node`'s `JSONFile` (`session-store.ts`:
lowdb is marked `external` in `vite.main.config.ts` + loaded via a dynamic
`await import('lowdb')` / `import('lowdb/node')`, the "Pitfall 1" pattern). So this is a
**module-resolution bug specific to the `make` distributable path**: in the packaged
(ASAR / make) context the ESM `external` lowdb resolves under the wrong conditional
export (browser instead of node), pulling `LocalStorage`/`WebStorage` and crashing.

**Scoping (important):**
- `npm run package` build is **fine** — smoke 15/15 + a boot-verify launch are GREEN; the
  ui-lab capture ran against it. The bug is `make`-only.
- **Pre-existing / not Phase-10**: `forge.config.ts` (Jun 10) + vite configs (Jun 4-6)
  predate the Phase-10 gap-closure rounds; no sidebar work touched persistence/packaging.
- This is a **distribution/installer** concern (real users install the `make` output), so it
  matters for a shippable v1.1 build, but it is out of the Phase-10 sidebar scope.
- **Operator decision 2026-06-12:** keep this as a SEPARATE todo (NOT folded into Phase-10
  round 5, which is GAP-10-J + GAP-10-K only).

## Solution

TBD — diagnose then pin. Sketch:
1. Reproduce: `npm run make`, open `out/make/...` (or the `.app` it rebuilds), capture the
   exact failing module + the resolver path (which `lowdb` `exports` condition won).
2. Root-cause the conditional-exports resolution: in the packaged main bundle the dynamic
   `import('lowdb')` should resolve to the **node** entry, not browser. Check forge ASAR /
   `auto-unpack-natives` coverage for the lowdb ESM, the `package`-vs-`make` delta, and
   whether Electron's import conditions (`browser`/`node`/`import`) need pinning.
3. Fix candidates: import `lowdb/node` specifically and avoid the bare `lowdb` browser-prone
   entry; or force the node export condition; or ASAR-unpack lowdb; or bundle it instead of
   `external` for the packaged build. Keep the `session-store.ts` "Pitfall 1" ESM contract intact.
4. Verify: `npm run make`, open the produced app, confirm it boots + persistence works; add a
   make-output boot check if feasible.

A natural home is **Phase 15 (Formal Validation + Windows Verification Kit)** if not done sooner —
that phase already owns packaging/validation. Until then it stays here as a tracked todo.
