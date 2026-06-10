#!/usr/bin/env node
/**
 * postinstall: ensure node-pty's native binary is usable against the
 * Electron 36.9.5 ABI.
 *
 * node-pty 1.1.0 is an N-API addon. N-API binaries are ABI-stable across
 * Node/Electron versions, so the prebuilt `prebuilds/<platform>-<arch>/pty.node`
 * that ships in the npm tarball already loads under Electron 36 without a
 * from-source recompile. We therefore prefer the prebuild and only attempt a
 * from-source `electron-rebuild` when the Electron headers host is reachable.
 *
 * Two things this script guarantees:
 *   1. The prebuilt `spawn-helper` keeps its execute bit (npm tarball
 *      extraction drops it, which makes pty.fork() fail with
 *      "posix_spawnp failed"). We re-chmod +x every prebuild's spawn-helper.
 *   2. An optional, NON-FATAL from-source rebuild for environments that have
 *      network access to artifacts.electronjs.org (CI / dev machines). If the
 *      headers download is blocked, the prebuild is used and install still
 *      succeeds (exit 0).
 *
 * CLAUDE.md still mandates electron-rebuild on machines with network access;
 * this wrapper preserves that behavior while not hard-failing offline/firewalled
 * environments where the ABI-stable N-API prebuild is sufficient.
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ptyRoot = path.resolve(__dirname, '..', 'node_modules', 'node-pty');

function ensureSpawnHelperExecutable() {
  const prebuildsDir = path.join(ptyRoot, 'prebuilds');
  if (!fs.existsSync(prebuildsDir)) return;
  for (const entry of fs.readdirSync(prebuildsDir)) {
    const helper = path.join(prebuildsDir, entry, 'spawn-helper');
    if (fs.existsSync(helper)) {
      try {
        fs.chmodSync(helper, 0o755);
        console.log('[fix-node-pty] chmod +x', path.relative(process.cwd(), helper));
      } catch (e) {
        console.warn('[fix-node-pty] could not chmod', helper, e.message);
      }
    }
  }
}

function tryFromSourceRebuild() {
  // Best-effort: only useful when Electron headers are reachable. Never fatal.
  try {
    execFileSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['electron-rebuild', '-f', '-w', 'node-pty'],
      { stdio: 'inherit', timeout: 5 * 60 * 1000 }
    );
    console.log('[fix-node-pty] electron-rebuild succeeded (from-source build)');
  } catch (e) {
    console.warn(
      '[fix-node-pty] electron-rebuild skipped/failed (likely no network to ' +
        'artifacts.electronjs.org). Falling back to the ABI-stable N-API ' +
        'prebuild — this is expected and supported. Reason:',
      (e && e.message) || e
    );
  }
}

function main() {
  if (!fs.existsSync(ptyRoot)) {
    console.warn('[fix-node-pty] node-pty not installed; nothing to do.');
    return;
  }
  // Attempt a real rebuild first (CLAUDE.md), then always repair prebuild perms
  // so the resulting binary (built or prebuilt) is usable.
  tryFromSourceRebuild();
  ensureSpawnHelperExecutable();
}

main();
