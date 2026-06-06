// MAIN-PROCESS readiness probe — the platform-aware seam (D-03).
// The PURE helper (buildPosixProbe) is electron-free and node-pty-free and takes
// its nonce as an injected parameter, so Vitest (Node env) imports it directly
// with a fixed fixture nonce — no real PTY, no Electron process (mirrors
// shell-discovery.ts's electron-free + injected-dependency convention).
//
// The probe changes NO shell state (D-01: one-shot, transparent). It uses the
// POSIX ':' no-op builtin with a self-generated nonce as its argument — nothing
// executes, no env var is set, no rc file is edited, no persistent hook is left.
// Invisibility (D-02) is enforced by the CALLER (Plan 02's create() probe hook),
// which withholds every probe byte from the renderer; this module only defines
// WHAT to send and WHEN to consider the shell ready.
//
// Real implementation: macOS provider this phase (zsh + bash share the POSIX ':'
// builtin + CR semantics — one probe covers both — D-03). The Windows readiness
// probe is deferred to Phase 8 behind this same seam; UNLIKE WindowsShellProvider
// (which returns a safe default), WindowsReadinessProbe THROWS — there is NO safe
// no-op readiness probe to fall back to, so a Windows auto-run must fail loudly
// rather than silently mis-fire (PATTERNS line 40-41 / RESEARCH 277-281, D-03).

import crypto from 'node:crypto';

/**
 * Per-spawn readiness probe: a one-shot marker + a matcher. Changes NO shell
 * state (D-01). The SEND string (`marker`) is deliberately distinct from the
 * MATCHED token so the matcher never trips on the shell's bare echo of its own
 * input (pexpect's send-vs-match lesson — Pitfall 1).
 */
export interface ShellReadinessProbe {
  /** Bytes to write to the PTY to elicit a detectable round-trip (no env/rc changes). */
  readonly marker: string;
  /**
   * The bare nonce token embedded in `marker` (e.g. `__JW_READY_<hex>__`). The
   * caller (the create() probe hook) uses this to SCRUB any nonce-bearing bytes
   * that race past the match-settle so the sentinel can never appear in the
   * rendered scrollback under adversarial chunk timing (D-02 invisibility — RESEARCH
   * Open Q3). Distinct from `marker`, which carries the `: ` no-op prefix + CR.
   */
  readonly nonce: string;
  /** True once `buffer` shows the shell PROCESSED the marker (not merely echoed it). */
  matches(buffer: string): boolean;
}

/** The platform-aware readiness seam (D-03), mirroring ShellDiscovery. One provider per platform. */
export interface ReadinessProbeProvider {
  forShell(shellPath: string): ShellReadinessProbe;
}

/**
 * PURE — build a POSIX no-op readiness probe for a unique `nonce` (unit-tested
 * with a fixed nonce, no PTY).
 *
 *   - marker = `: ${nonce}\r` — `:` is the POSIX no-op builtin; the nonce is its
 *     argument, so NOTHING runs and NOTHING persists to env/rc (D-01). The
 *     terminator is `\r` (carriage return, NOT `\n`): a real Enter sends CR and
 *     the TTY line discipline (ICRNL) maps CR→NL so the shell sees a completed
 *     line (Pitfall 4 / termios ICRNL).
 *   - matches() implements the SEND-vs-MATCH split (Pitfall 1): it returns true
 *     only when the nonce appears on a line FOLLOWED by a newline (the shell
 *     processed the line and re-prompted), NOT merely on the echoed-input line.
 *
 * The exact regex is E2E-tunable (RESEARCH Open Q3) and will be tuned against
 * real cold zsh/bash byte captures during Plan 03's E2E bring-up.
 */
export function buildPosixProbe(nonce: string): ShellReadinessProbe {
  // Escape regex metacharacters in the nonce so a hex/sentinel nonce is matched
  // literally (the sentinel contains `_` which is safe, but keep this robust).
  const safe = nonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Ready when the nonce appears AFTER a newline boundary — i.e. on a produced
  // output/prompt line, not the bare echoed-input line. RESEARCH 265 shape.
  const re = new RegExp(`${safe}[^\\n]*\\n[\\s\\S]*`);
  return {
    marker: `: ${nonce}\r`,
    nonce,
    matches: (buffer: string): boolean => re.test(buffer),
  };
}

/**
 * macOS provider (D-03): zsh and bash share the POSIX ':' builtin + CR semantics,
 * so ONE probe covers both on macOS. The nonce is a `__JW_READY_<hex>__` sentinel
 * (crypto-random hex for uniqueness only — V6 n/a, no crypto-strength requirement)
 * so the smoke test's "nonce absent in scrollback" assertion has a stable prefix
 * (`__JW_READY_`) to grep for.
 */
export class MacReadinessProbe implements ReadinessProbeProvider {
  forShell(shellPath: string): ShellReadinessProbe {
    void shellPath; // zsh + bash share the probe on macOS — shell path is unused here.
    const nonce = `__JW_READY_${crypto.randomBytes(8).toString('hex')}__`;
    return buildPosixProbe(nonce);
  }
}

/**
 * Windows STUB (D-03) — real PowerShell/CMD/Git Bash/WSL readiness probes land at
 * Phase 8 behind this same seam. There is NO safe no-op readiness probe to fall
 * back to (unlike WindowsShellProvider, which returns a default), so this THROWS
 * rather than silently mis-firing an auto-run on an unverified Windows shell.
 */
export class WindowsReadinessProbe implements ReadinessProbeProvider {
  forShell(shellPath: string): ShellReadinessProbe {
    void shellPath; // No safe Windows readiness probe yet (Phase 8) — fail loudly.
    throw new Error('Windows readiness probe is implemented in Phase 8 (D-03 seam stub).');
  }
}

/** Pick the readiness probe provider for `platform` (D-03). win32 → Windows stub; else macOS. */
export function selectReadinessProbe(platform: NodeJS.Platform): ReadinessProbeProvider {
  return platform === 'win32' ? new WindowsReadinessProbe() : new MacReadinessProbe();
}
