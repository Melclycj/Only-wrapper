# App Icons (placeholders — D-07)

These are **placeholder** icons (a simple "JW" mark on a dark terminal-slate
rounded square). They exist to wire the Forge icon pipeline end-to-end; swapping
in a real branded icon later is a **file replacement with no config change**
(D-07 deferred-idea).

| File | Purpose | How it was made |
|------|---------|-----------------|
| `icon.icns` | macOS `.app` icon | `iconutil -c icns` from a sips-resized iconset (16–512 @1x/@2x) |
| `icon.ico` | Windows `Setup.exe` / `.exe` icon (`setupIcon`) | Real multi-size ICO (16/32/48/64/128/256), PNG-compressed entries — NOT a renamed PNG |
| `icon.png` | Base 512px PNG (Linux / fallback) | `sips -z 512` from the 1024px source |

## Wiring (do not change to swap the artwork)

- `forge.config.ts` → `packagerConfig.icon: 'assets/icon'` (no extension — Forge
  appends `.icns` on macOS / `.ico` on Windows).
- `forge.config.ts` → `MakerSquirrel({ setupIcon: 'assets/icon.ico' })`.

To replace the placeholder: regenerate `icon.icns` / `icon.ico` / `icon.png`
from a 1024px source and commit them over these files. The config above stays
untouched.

> **`.ico` must stay a real multi-size ICO** — Forge/Squirrel reject a PNG that
> has merely been renamed to `.ico`. Verify with `file assets/icon.ico` (must
> report "MS Windows icon resource").
