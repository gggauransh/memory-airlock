import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Airlock } from '../src/domain.ts';
import { LocalStore, FalkorStore } from '../src/store.ts';
import { runTeam, refreshAffected, readCurrentDraft, latestCases, configuredModel } from '../src/team.ts';

const returns = { question: 'Check the current return window for this purchase.', days: 20, destination: 'France', topics: ['returns'], mode: 'replay' };
const shipping = { ...returns, question: 'Can we ship to Germany under current policy?', destination: 'Germany', topics: ['shipping'] };
const change = (relation = 'refund_days', value = '14') => ({ relation, value, source: 'policy', evidence: 'Policy owner confirms this synthetic policy change.' });
async function app() { const a = new Airlock(new LocalStore()); await a.initialize(); return a; }

test('separate cases remain current and unconsulted contact evidence never leaks into returns', async () => {
  const a = await app(), r = await runTeam(a, returns), s = await runTeam(a, shipping);
  assert.equal(latestCases((await a.state()).runs).length, 2);
  assert.deepEqual(r.decisions[0].factIds, ['fact-refund']);
  assert.deepEqual(r.decisions[0].watches, ['refund_days']);
  assert.equal(r.run.traces.length, 3);
  assert.ok(!JSON.stringify(r.decisions).includes('fact-email'));
  assert.equal((await readCurrentDraft(a, { runId: r.run.id })).text, r.decisions[2].text);
  const p = await a.preview(change('support_email', 'new@example.com'));
  assert.ok([...r.run.decisionIds, ...s.run.decisionIds].every(key => !p.affected.includes(key)));
});

test('refund update stales only the returns case, blocks its draft, and selective refresh preserves shipping', async () => {
  const a = await app(), r = await runTeam(a, returns), s = await runTeam(a, shipping);
  const plan = await a.preview(change());
  assert.ok(r.run.decisionIds.every(key => plan.affected.includes(key)));
  assert.ok(s.run.decisionIds.every(key => !plan.affected.includes(key)));
  await a.commit(plan.id);
  await assert.rejects(readCurrentDraft(a, { runId: r.run.id }), /stale/);
  const unaffected = await readCurrentDraft(a, { runId: s.run.id });
  const refreshed = await refreshAffected(a, {});
  assert.equal(refreshed.refreshed.length, 1); assert.equal(refreshed.preservedCases, 1);
  assert.equal(refreshed.refreshed[0].run.replacesRunId, r.run.id);
  assert.equal(refreshed.refreshed[0].run.caseId, r.run.caseId);
  assert.match(refreshed.refreshed[0].decisions[2].text, /outside.*14-day/);
  assert.equal((await readCurrentDraft(a, { runId: s.run.id })).text, unaffected.text);
  assert.equal(latestCases((await a.state()).runs).length, 2);
  await assert.rejects(readCurrentDraft(a, { runId: r.run.id }), /superseded/);
  assert.equal((await refreshAffected(a, {})).refreshed.length, 0);
});

test('empty policy reads watch later additions without borrowing unrelated facts as citations', async () => {
  const a = await app(); await a.commit((await a.preview({ ...change('refund_days', '30'), action: 'remove' })).id);
  const r = await runTeam(a, returns);
  assert.deepEqual(r.decisions[0].factIds, []); assert.deepEqual(r.decisions[2].citations, []);
  assert.equal(r.decisions[2].assessments![0].outcome, 'needs_confirmation');
  const p = await a.preview(change());
  assert.ok(r.run.decisionIds.every(key => p.affected.includes(key)));
  assert.ok(p.paths!.some(p => p.nodeIds.at(-1) === 'scope:refund_days'));
});

test('review records an unsupported customer claim; writer follows verified conclusion', async () => {
  const a = await app(), r = await runTeam(a, { ...returns, days: 45, claim: 'within_window' });
  assert.match(r.decisions[1].corrections![0], /Customer claims within_window/);
  assert.equal(r.decisions[1].assessments![0].outcome, 'outside_window');
  assert.match(r.decisions[2].text, /45-day-old.*outside.*30-day/);
  assert.equal((await a.state()).facts.find(f => f.id === 'fact-refund')!.value, '30');
});

test('ambiguous or duplicate topic payloads and cross-topic claims are rejected', async () => {
  const a = await app(), before = await a.state();
  await assert.rejects(runTeam(a, { ...returns, topics: ['returns', 'returns'] }));
  await assert.rejects(runTeam(a, { ...shipping, claim: 'within_window' }));
  assert.deepEqual(await a.state(), before);
});

test('local inference cannot be redirected to an external or credential-bearing URL', () => {
  const previous = { provider: process.env.AIRLOCK_AI_PROVIDER, base: process.env.OLLAMA_BASE_URL };
  try {
    process.env.AIRLOCK_AI_PROVIDER = 'ollama'; process.env.OLLAMA_BASE_URL = 'https://example.com/v1';
    assert.throws(configuredModel, /loopback/);
    process.env.OLLAMA_BASE_URL = 'http://user:password@localhost:11434/v1'; assert.throws(configuredModel, /loopback/);
  } finally {
    if (previous.provider === undefined) delete process.env.AIRLOCK_AI_PROVIDER; else process.env.AIRLOCK_AI_PROVIDER = previous.provider;
    if (previous.base === undefined) delete process.env.OLLAMA_BASE_URL; else process.env.OLLAMA_BASE_URL = previous.base;
  }
});

test('real FalkorDB keeps independent cases current through selective refresh and reload', { skip: !process.env.FALKORDB_TEST_URL }, async () => {
  const store = await FalkorStore.connect(process.env.FALKORDB_TEST_URL!, `selectivity-${Date.now()}`);
  try {
    const a = new Airlock(store); await a.initialize();
    const r = await runTeam(a, returns), s = await runTeam(a, shipping);
    await a.commit((await a.preview(change())).id);
    await assert.rejects(readCurrentDraft(new Airlock(store), { runId: r.run.id }), /stale/);
    const refresh = await refreshAffected(new Airlock(store), {});
    assert.equal(refresh.refreshed.length, 1);
    assert.match((await readCurrentDraft(new Airlock(store), { runId: s.run.id })).text, /Germany.*not verified/);
    const p = await a.preview(change('ships_to', 'Germany'));
    assert.ok(s.run.decisionIds.every(key => p.affected.includes(key)));
    assert.ok(refresh.refreshed[0].run.decisionIds.every(key => !p.affected.includes(key)));
  } finally { await store.close(); }
});
