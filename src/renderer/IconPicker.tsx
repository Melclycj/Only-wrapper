// RENDERER ONLY — the session icon picker (04-02, D-07/D-08/D-09).
//
// A CONTROLLED component: the current SessionIconSpec + an onChange callback are
// props (the SessionEditModal owns the value). Three sub-controls:
//   (a) a CURATED_EMOJI quick-pick <button> grid (emoji-set.ts),
//   (b) a free-text emoji <input> (macOS Ctrl+Cmd+Space works in a focused input;
//       the full grapheme is stored VERBATIM — Pitfall 6 — via emojiSpec),
//   (c) a COLOR_SWATCHES <button> row → colorSpec.
// The `preset` kind stays in the type but is NOT surfaced here (D-07).
//
// Specs are built through the pure icon-spec.ts builders so the picker has no icon
// logic of its own; a live preview reuses the shared renderIcon (so the color badge
// shows its name-initial, D-09).

import type { SessionIconSpec } from '../shared/types';
import { colorSpec, emojiSpec } from './icon-spec';
import { COLOR_SWATCHES, CURATED_EMOJI } from './emoji-set';
import { renderIcon } from './Sidebar';

export interface IconPickerProps {
  /** The currently-selected icon spec. */
  value: SessionIconSpec;
  /** The session name (drives the color-badge initial in the live preview). */
  name: string;
  /** Emit a new spec when the user picks an emoji / types one / picks a color. */
  onChange: (spec: SessionIconSpec) => void;
}

export function IconPicker({
  value,
  name,
  onChange,
}: IconPickerProps): React.JSX.Element {
  // The free-text input mirrors the selected emoji value when the kind is emoji,
  // otherwise it shows empty (a color is selected). It is uncontrolled-friendly:
  // any typed grapheme is stored verbatim through emojiSpec.
  const emojiText = value.type === 'emoji' ? value.value : '';

  return (
    <div className="icon-picker" data-testid="icon-picker">
      <div className="icon-picker-preview" aria-label="Selected icon preview">
        {renderIcon(value, name)}
      </div>

      <div className="emoji-grid" role="group" aria-label="Curated emoji">
        {CURATED_EMOJI.map((glyph) => (
          <button
            key={glyph}
            type="button"
            className={
              value.type === 'emoji' && value.value === glyph
                ? 'emoji-cell selected'
                : 'emoji-cell'
            }
            aria-pressed={value.type === 'emoji' && value.value === glyph}
            onClick={() => onChange(emojiSpec(glyph))}
          >
            {glyph}
          </button>
        ))}
      </div>

      <input
        type="text"
        className="emoji-input"
        data-testid="edit-emoji-text"
        aria-label="Custom emoji"
        placeholder="Or type an emoji…"
        value={emojiText}
        onChange={(e) => onChange(emojiSpec(e.target.value))}
      />

      <div className="color-swatches" role="group" aria-label="Color icon">
        {COLOR_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            className={
              value.type === 'color' && value.value === color
                ? 'color-swatch selected'
                : 'color-swatch'
            }
            style={{ background: color }}
            aria-label={`Color ${color}`}
            aria-pressed={value.type === 'color' && value.value === color}
            onClick={() => onChange(colorSpec(color))}
          />
        ))}
      </div>
    </div>
  );
}
