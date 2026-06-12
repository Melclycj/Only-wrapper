// THROWAWAY diagnosis driver for GAP-10-H (not a shipped path; lint-deferred like 003-*).
// Re-implements the start-affordances reducer (pure, no React) to trace the EXACT
// {sidebarStart, startNoCmd, idleCardStart, totalStartCount} for every dormant-row state,
// then maps each to the rendered Start data-testids the Sidebar/IdleCard JSX would paint.
function startAffordances(input) {
  const dormant = input.status === 'not_started';
  const idleCardStart = dormant && input.isActive && input.activeIsCard;
  const sidebarStart = dormant && !idleCardStart;
  const startNoCmd =
    dormant && !idleCardStart && (input.startupCommand ?? '').trim().length > 0;
  const primaryStartCount = (sidebarStart ? 1 : 0) + (idleCardStart ? 1 : 0);
  const totalStartCount = primaryStartCount + (startNoCmd ? 1 : 0);
  return { sidebarStart, idleCardStart, startNoCmd, primaryStartCount, totalStartCount };
}
// Sidebar row-local activeIsCard: isActive && (not_started || error)
function rowActiveIsCard(isActive, status) {
  return isActive && (status === 'not_started' || status === 'error');
}
// IdleCard render gate (SessionManager): activeIsCard && activeRecord!=null
// idle-start-session testid renders ONLY for the not_started branch (error → error-card-retry).
function idleTestids(isActive, status) {
  const activeIsCard = status === 'not_started' || status === 'error';
  if (!isActive || !activeIsCard) return [];
  if (status === 'error') return ['error-card-retry']; // NOT a Start-labeled ▶
  return ['idle-start-session']; // the dormant card's ▶
}
const states = [
  { name: '1. non-active dormant @rest, no cmd',          status: 'not_started', isActive: false, cmd: undefined },
  { name: '1b. non-active dormant @rest, WITH cmd',       status: 'not_started', isActive: false, cmd: 'claude --rc' },
  { name: '2. ACTIVE/selected dormant, no cmd',           status: 'not_started', isActive: true,  cmd: undefined },
  { name: '2b. ACTIVE/selected dormant, WITH cmd',        status: 'not_started', isActive: true,  cmd: 'claude --rc' },
  { name: '3. dormant @hover (= state 1, CSS only)',      status: 'not_started', isActive: false, cmd: 'claude --rc' },
  { name: '4. just-after-Start (optimistic running flip)',status: 'running',     isActive: true,  cmd: 'claude --rc' },
];
console.log('STATE | sidebar▶(start-session) | ⏵(start-no-cmd-session) | IdleCard(idle-start-session) | TOTAL Start-labeled');
for (const s of states) {
  const aic = rowActiveIsCard(s.isActive, s.status);
  const ctl = startAffordances({ status: s.status, isActive: s.isActive, activeIsCard: aic, startupCommand: s.cmd });
  const idle = idleTestids(s.isActive, s.status);
  const rendered = [];
  if (ctl.sidebarStart) rendered.push('start-session');
  if (ctl.startNoCmd) rendered.push('start-no-cmd-session');
  for (const t of idle) if (t === 'idle-start-session') rendered.push('idle-start-session');
  const startLabeled = rendered.length;
  console.log(`${s.name}\n   sidebar▶=${ctl.sidebarStart} ⏵=${ctl.startNoCmd} idle=${idle.join('|')||'-'} | rendered=[${rendered.join(', ')||'-'}] | TOTAL=${startLabeled}`);
}

// ── Transition trace: the just-after-Start sequence for an ACTIVE dormant RECIPE row.
// handleStart is async: ptyCreate() awaits, THEN setSessions flips status→'running'.
// Between the click and the await resolving, the row is STILL not_started + active.
console.log('\n── TRANSITION: active dormant recipe row, user clicks the IdleCard ▶ ──');
function snap(label, status, isActive, cmd) {
  const aic = isActive && (status === 'not_started' || status === 'error');
  const ctl = startAffordances({ status, isActive, activeIsCard: aic, startupCommand: cmd });
  const rendered = [];
  if (ctl.sidebarStart) rendered.push('start-session');
  if (ctl.startNoCmd) rendered.push('start-no-cmd-session');
  if (isActive && status === 'not_started') rendered.push('idle-start-session');
  console.log(`  ${label}: rendered=[${rendered.join(', ')||'-'}] TOTAL=${rendered.length}`);
}
snap('t0 pre-click (active dormant)      ', 'not_started', true, 'claude --rc');
snap('t1 click→await ptyCreate (no flip) ', 'not_started', true, 'claude --rc');
snap('t2 setSessions status→running flip ', 'running',     true, 'claude --rc');
