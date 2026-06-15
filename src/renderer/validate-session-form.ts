// RENDERER ONLY — the pure inline-validation helper (12-01, D-04).
//
// Imports nothing external — no UI-framework, platform, or shared-types dependency —
// so the validation rules unit-test in the Node/Vitest env (mirrors session-edit.ts).
// Main's CR-01 guard remains the validator of record; these are convenience-only UX
// hints (0 new IPC). The copy strings are FROZEN by 12-UI-SPEC §Copywriting.

/** hint → neutral (--ink-faint); error → --color-danger. */
export type FieldTone = 'hint' | 'error';

export interface FieldNotice {
  tone: FieldTone;
  message: string;
}

/** The three free-text fields the form validates (icon/shell are picker/select). */
export interface FormFieldValues {
  name: string;
  cwd: string;
  startupCommand: string;
}

/**
 * Cross-platform absolute-path FORMAT check (renderer-safe — no `path` module under
 * the sandbox). Accepts POSIX `/…`, Windows drive `C:\…` / `C:/…`, and UNC `\\…`.
 * A format hint only — never an existence check (an absolute-but-missing path is
 * main's CR-01 job to reject, not the renderer's).
 */
function isAbsolutePathish(s: string): boolean {
  return /^\//.test(s) || /^[A-Za-z]:[/\\]/.test(s) || /^\\\\/.test(s);
}

/**
 * Pure, renderer-cheap pre-checks. Returns one notice per field that has something to
 * say. Empty name is a HINT (a valid choice — Phase-4 discretion preserved), not an
 * error. A non-empty, non-absolute cwd gets a neutral format hint. startupCommand is
 * optional and never validated.
 */
export function validateSessionForm(
  f: FormFieldValues,
): Partial<Record<keyof FormFieldValues, FieldNotice>> {
  const out: Partial<Record<keyof FormFieldValues, FieldNotice>> = {};
  if (f.name.trim().length === 0) {
    out.name = { tone: 'hint', message: 'Keeps the current name' };
  }
  if (f.cwd.trim().length > 0 && !isAbsolutePathish(f.cwd)) {
    out.cwd = { tone: 'hint', message: 'Enter an absolute path, or use Browse…' };
  }
  // startupCommand: optional — no validation; empty is valid (D-04).
  return out;
}
