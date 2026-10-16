import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { Airlock, active, graphOf } from '../src/domain.ts';
import { LocalStore, FalkorStore } from '../src/store.ts';
import { runTeam, refreshAffected, readCurrentDraft, latestCases } from '../src/team.ts';
import { benchmark } from '../src/benchmark.ts';

const request = { question: 'Can a Germany customer return a 20-day-old purchase under current policy?', days: 20, destination: 'Germany', topics: ['returns', 'shipping'], mode: 'replay' };
const update = (relation = 'refund_days', value = '14', source = 'policy') => ({ relation, value, source, evidence: 'Synthetic policy-owner change for integration testing.' });
async function app() { const store = new LocalStore(), a = new Airlock(store); await a.initialize(); return { a, store }; }
function model(options: { citation?: string; ignoreTools?: boolean; wrongResearch?: boolean; wrongReview?: boolean; hook?: (call: number) => Promise<void> } = {}) {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async input => {
      call++; await options.hook?.(call);
      const forced = input.toolChoice?.type === 'tool' && !options.ignoreTools;
      return {
        content: forced ? [{ type: 'tool-call' as const, toolCallId: `call-${call}`, toolName: input.toolChoice!.type === 'tool' ? input.toolChoice!.toolName : '', input: '{}' }] : [{ type: 'text' as const, text: JSON.stringify({ summary: 'The policy evidence supports a 30-day current standard return window.', citations: [options.citation ?? 'fact-refund'], assessments: [{topic:'returns',outcome: options.wrongResearch && call === 3 || options.wrongReview && call === 5 ? 'outside_window' : 'within_window'},{topic:'shipping',outcome:'needs_confirmation'}] }) }],
        finishReason: { unified: forced ? 'tool-calls' as const : 'stop' as const, raw: undefined },
        usage: { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 20, text: 20, reasoning: undefined } }, warnings: [],
      };
    },
  });
}

test('handoffs persist a three-hop decision chain and leave policy facts unchanged', async () => {
  const { a, store } = await app(), before = active(await a.state());
  const result = await runTeam(a, request);
  assert.equal(result.run.mode, 'replay'); assert.equal(result.run.traces.length, 4);
  assert.deepEqual(active(await a.state()), before);
  assert.equal(result.decisions[1].factIds.length, 0); assert.deepEqual(result.decisions[1].decisionIds, [result.decisions[0].id]);
  const reloaded = new Airlock(store), state = await reloaded.state();
  assert.equal(state.runs?.[0].id, result.run.id);
  const p = await reloaded.preview(update());
  assert.equal(result.run.decisionIds.filter(key => p.affected.includes(key)).length, 3);
  const path = p.paths!.find(path => path.decisionId === result.decisions[2].id)!;
  assert.equal(path.nodeIds.length, 4);
  assert.ok(graphOf(state).edges.some(edge=>edge.from === result.decisions[2].id && edge.to === result.decisions[1].id));
  await reloaded.commit(p.id);
  assert.ok((await a.state()).decisions.filter(d=>result.run.decisionIds.includes(d.id)).every(d=>d.status === 'recheck'));
});
test('relation watches invalidate an unverified-destination answer when knowledge is added', async () => {
  const { a } = await app(), r = await runTeam(a, request), p = await a.preview(update('ships_to', 'Germany'));
  assert.deepEqual(p.retires, []);
  assert.equal(r.run.decisionIds.filter(key=>p.affected.includes(key)).length, 3);
  assert.ok(p.paths?.some(path=>path.nodeIds.at(-1) === 'scope:ships_to'));
  await a.commit(p.id); const refreshed = await runTeam(a, request);
  assert.match(refreshed.decisions[2].text, /Germany is supported/);
});
test('blocked updates do not invalidate handoffs and template refresh cannot fabricate model answers', async () => {
  const { a } = await app(), r = await runTeam(a, request), blocked = await a.preview(update('refund_days','365','customer'));
  assert.equal(blocked.outcome, 'blocked'); assert.deepEqual(blocked.affected, []); assert.deepEqual(blocked.paths, []);
  await a.commit((await a.preview(update())).id); await a.refresh();
  assert.ok((await a.state()).decisions.filter(d=>r.run.decisionIds.includes(d.id)).every(d=>d.status === 'recheck'));
  assert.ok((await a.state()).agents.filter(a=>a.id.startsWith('team-')).every(a=>a.state === 'stale'));
});
test('SDK model loop executes evidence tools and records usage and validated citations', async () => {
  const { a } = await app(), mock = model(), r = await runTeam(a, { ...request, mode:'model' }, mock);
  assert.equal(mock.doGenerateCalls.length, 7); assert.equal(r.run.traces.length,4); assert.equal(r.run.inputTokens,70);
  assert.equal(r.run.mode,'model'); assert.ok(r.decisions.every(d=>d.origin==='model'));
  assert.equal(r.run.traces[0].tool,'read_returns_policy'); assert.equal(r.run.traces[3].tool,'read_reviewed_handoff');
  assert.deepEqual(r.decisions[2].citations,['fact-refund']);
});
test('unknown model citations reject the entire run with no partial decisions saved', async () => {
  const { a } = await app(), before = await a.state();
  await assert.rejects(runTeam(a, { ...request, mode:'model' }, model({citation:'invented-fact'})),/citations/);
  assert.deepEqual(await a.state(),before);
});

test('review audits incorrect model research rather than silently repeating its structured conclusion', async () => {
  const { a } = await app(), r = await runTeam(a, { ...request, mode: 'model' }, model({ wrongResearch: true }));
  assert.equal(r.decisions[0].assessments![0].outcome, 'outside_window');
  assert.equal(r.decisions[1].assessments![0].outcome, 'within_window');
  assert.match(r.decisions[1].corrections![0], /Research conclusion/);
});

test('a reviewer with real citations but an incorrect structured conclusion cannot publish a run', async () => {
  const { a } = await app(), before = await a.state();
  await assert.rejects(runTeam(a, { ...request, mode: 'model' }, model({ wrongReview: true })), /disagrees/);
  assert.deepEqual(await a.state(), before);
});
test('a blocked Gateway account returns actionable guidance and saves no partial run', async () => {
  const { a } = await app(), before = await a.state();
  const blocked = new MockLanguageModelV4({doGenerate:async()=>{throw Object.assign(new Error('AI Gateway requires a valid credit card on file.'),{statusCode:403});}});
  await assert.rejects(runTeam(a,{...request,mode:'model'},blocked), (error: Error & {status?:number})=>error.status===503 && /payment-card setup/.test(error.message));
  assert.deepEqual(await a.state(),before);
});
test('a model that skips its evidence tool cannot save an answer', async () => {
  const { a } = await app(), before=await a.state();
  await assert.rejects(runTeam(a,{...request,mode:'model'},model({ignoreTools:true})),/required tool|without reading/);
  assert.deepEqual(await a.state(),before);
});
test('memory change during inference rejects the run instead of publishing mixed revisions', async () => {
  const { a }=await app();
  const mock=model({hook:async call=>{if(call===2) await a.commit((await a.preview(update())).id);}});
  await assert.rejects(runTeam(a,{...request,mode:'model'},mock),/changed/);
  const state=await a.state(); assert.equal(state.revision,1); assert.equal(state.runs?.length ?? 0,0); assert.equal(state.decisions.length,3);
});
test('refreshing the real team uses current policy and preserves previous receipts as history', async () => {
  const { a }=await app(), old=await runTeam(a,request);
  await a.commit((await a.preview(update())).id);
  const fresh=await runTeam(a,request), state=await a.state();
  assert.match(fresh.decisions[2].text,/is outside the current 14-day/);
  assert.equal(state.runs?.length,2); assert.equal(state.runs?.[0].id,old.run.id);
  assert.ok(state.decisions.filter(d=>old.run.decisionIds.includes(d.id)).every(d=>d.status==='recheck'));
  assert.equal(state.decisions.filter(d=>fresh.run.decisionIds.includes(d.id) && d.status==='current').length,3);
});
test('synthetic benchmark detects indirect misses and excessive invalidation with an independent oracle', async () => {
  const r=await benchmark();
  assert.equal(r.cases,18); assert.equal(r.passed,18);
  const graph=r.methods.find(m=>m.method==='graph')!, direct=r.methods.find(m=>m.method==='direct')!, all=r.methods.find(m=>m.method==='all')!;
  assert.equal(graph.fn,0); assert.equal(graph.fp,0); assert.ok(direct.fn>=21); assert.ok(all.fp>=60); assert.equal(r.methods.find(m=>m.method==='reference')!.fn,0);
  assert.equal(Math.max(...r.rows.map(row=>row.longestPath)),6);
});
test('real FalkorDB traces transitive handoffs and scope dependencies after service reload', {skip:!process.env.FALKORDB_TEST_URL}, async () => {
  const store=await FalkorStore.connect(process.env.FALKORDB_TEST_URL!,`team-test-${Date.now()}`);
  try {
    const a=new Airlock(store);await a.initialize(); const r=await runTeam(a,request), reloaded=new Airlock(store), state=await reloaded.state();
    assert.equal(state.runs?.[0].id,r.run.id);
    const p=await reloaded.preview(update()), path=p.paths!.find(path=>path.decisionId===r.decisions[2].id)!;
    assert.equal(path.nodeIds.length,4);assert.equal(r.run.decisionIds.filter(key=>p.affected.includes(key)).length,3);
    const shipping=await reloaded.preview(update('ships_to','Germany'));
    assert.equal(r.run.decisionIds.filter(key=>shipping.affected.includes(key)).length,3);
    await reloaded.commit(p.id);assert.ok((await reloaded.state()).decisions.filter(d=>r.run.decisionIds.includes(d.id)).every(d=>d.status==='recheck'));
  } finally {await store.close();}
});
