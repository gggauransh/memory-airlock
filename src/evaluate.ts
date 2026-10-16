import { Airlock, active, type Update } from './domain.ts';
import { LocalStore } from './store.ts';

export async function evaluate() {
  const started = performance.now();
  const checks: { name: string; passed: boolean; detail: string }[] = [];
  const input = (value: string, relation: Update['relation'] = 'ships_to', source: Update['source'] = 'policy') => ({ relation, value, source, evidence: `Verified synthetic policy update: ${value}.`, action: 'assert' });
  const app = new Airlock(new LocalStore()); await app.initialize();
  let p = await app.preview(input('Germany'));
  checks.push({ name: 'Adding a destination preserves existing destinations', passed: p.retires.length === 0, detail: 'Set-valued relationships are additive.' });
  await app.commit(p.id);
  checks.push({ name: 'France and Germany both remain active', passed: active(await app.state()).some(f => f.value === 'France') && active(await app.state()).some(f => f.value === 'Germany'), detail: 'Both are persisted as active facts.' });
  p = await app.preview(input('14', 'refund_days'));
  checks.push({ name: 'Policy replacement finds dependent decisions', passed: p.affected.length === 2, detail: `${p.affected.length} decisions found through graph dependencies.` });
  await app.commit(p.id);
  checks.push({ name: 'Old policy retained as history', passed: (await app.state()).facts.some(f => f.value === '30' && f.status === 'superseded'), detail: 'The original evidence remains inspectable.' });
  checks.push({ name: 'Unrelated shipping decision survives', passed: (await app.state()).decisions.find(d => d.id === 'decision-luca')?.status === 'current', detail: 'A refund update does not invalidate a shipping decision.' });
  p = await app.preview(input('365', 'refund_days', 'customer'));
  checks.push({ name: 'Customer claim cannot overwrite official policy', passed: p.outcome === 'blocked', detail: 'Authority is checked before a write is permitted.' });
  p = await app.preview(input('7', 'refund_days', 'operations'));
  checks.push({ name: 'Lower-authority conflict asks for clarification', passed: p.outcome === 'review' && !!p.question, detail: 'No silent guess about which source wins.' });
  p = await app.preview(input('14', 'refund_days'));
  checks.push({ name: 'Duplicate updates are idempotent', passed: p.outcome === 'noop', detail: 'No duplicate active policy is created.' });
  await app.restart();
  checks.push({ name: 'Facts survive workers stopping', passed: active(await app.state()).some(f => f.value === '14'), detail: 'Worker memory is separate from durable shared memory.' });
  await app.refresh();
  checks.push({ name: 'Rebuilt workers use the new policy', passed: (await app.state()).decisions.filter(d => d.status === 'current' && d.agentId !== 'agent-luca').every(d => d.text.includes('is not') && d.text.includes('14-day')), detail: 'A 20-day-old order is now outside the window.' });
  const stale = await app.preview(input('Spain')); const other = await app.preview(input('Italy')); await app.commit(other.id);
  let rejected = false; try { await app.commit(stale.id); } catch { rejected = true; }
  checks.push({ name: 'Outdated previews cannot commit', passed: rejected, detail: 'Compare-and-swap prevents a reviewed change from applying to different memory.' });
  const passed = checks.filter(c => c.passed).length;
  return { kind: 'deterministic-functional-checks', store: 'isolated local test graph', note: 'These checks measure our explicit rules, not LLM accuracy or an upstream library benchmark.', passed, total: checks.length, durationMs: Math.round(performance.now() - started), checks, ranAt: new Date().toISOString() };
}
