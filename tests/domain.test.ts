import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { Airlock, active, applyPlan, graphOf, impactInMemory, planUpdate, seed, stateFromNodes } from '../src/domain.ts';
import { LocalStore, FalkorStore } from '../src/store.ts';
import { evaluate } from '../src/evaluate.ts';

const update = (value = 'Germany', relation = 'ships_to', source = 'policy', action = 'assert') => ({ value, relation, source, action, evidence: 'Synthetic test evidence from the policy owner.' });
async function app() { const a = new Airlock(new LocalStore()); await a.initialize(); return a; }
test('additive facts preserve France and UAE', async () => {
 const a = await app(); const p = await a.preview(update()); assert.equal(p.outcome,'add'); assert.deepEqual(p.retires,[]); await a.commit(p.id);
 assert.deepEqual(active(await a.state()).filter(f => f.relation === 'ships_to').map(f => f.value).sort(),['France','Germany','United Arab Emirates']);
});
test('policy replacement preserves unrelated facts, decisions and historical evidence', async () => {
 const a = await app(); const p = await a.preview(update('14','refund_days')); assert.deepEqual(p.retires,['fact-refund']); assert.equal(p.affected.length,2); await a.commit(p.id);
 const s = await a.state(); assert.equal(s.facts.find(f => f.id === 'fact-refund')?.status,'superseded'); assert.ok(s.facts.find(f => f.id === 'fact-refund')?.evidence);
 assert.equal(active(s).filter(f => f.relation === 'refund_days').length,1); assert.equal(s.decisions.find(d => d.id === 'decision-luca')?.status,'current');
});
test('source authority cannot be forged', async () => { const a = await app(); await assert.rejects(a.preview({...update('365','refund_days','customer'),authority:99})); assert.equal((await a.state()).revision,0); });
test('customer writes are blocked for new and replacement facts', async () => {
 const a = await app(); for (const v of [update('365','refund_days','customer'),update('Spain','ships_to','customer')]) { const p = await a.preview(v); assert.equal(p.outcome,'blocked'); await assert.rejects(a.commit(p.id)); } assert.equal((await a.state()).revision,0);
});
test('lower authority conflict asks for clarification', async () => { const a = await app(); const p = await a.preview(update('14','refund_days','operations')); assert.equal(p.outcome,'review'); assert.match(p.question!,/official policy owner/); await assert.rejects(a.commit(p.id)); });
test('explicit removal preserves sibling facts', async () => {
 const a = await app(); const p = await a.preview(update('France','ships_to','policy','remove')); await a.commit(p.id); const s = await a.state(); assert.equal(s.facts.find(f => f.id === 'fact-france')?.status,'removed'); assert.ok(active(s).some(f => f.value === 'United Arab Emirates')); assert.deepEqual(p.affected,['decision-luca']);
});
test('normalized duplicate does not write', async () => { const a = await app(); const p = await a.preview(update(' france ')); assert.equal(p.outcome,'noop'); await assert.rejects(a.commit(p.id)); });
test('removing absent value is a no-op', async () => { const a = await app(); assert.equal((await a.preview(update('Spain','ships_to','policy','remove'))).outcome,'noop'); });
test('stale previews are rejected', async () => { const a = await app(); const first = await a.preview(update()); const second = await a.preview(update('Spain')); await a.commit(second.id); await assert.rejects(a.commit(first.id),/Memory changed/); assert.ok(!active(await a.state()).some(f => f.value === 'Germany')); });
test('parallel commits cannot overwrite each other', async () => { const a = await app(); const p1 = await a.preview(update()), p2 = await a.preview(update('Spain')); const results = await Promise.allSettled([a.commit(p1.id),a.commit(p2.id)]); assert.equal(results.filter(r => r.status === 'fulfilled').length,1); assert.equal((await a.state()).revision,1); });
test('preview is single-use', async () => { const a = await app(); const p = await a.preview(update()); await a.commit(p.id); await assert.rejects(a.commit(p.id),/not found/); });
test('expired preview cannot apply', () => { const s = seed(), p = planUpdate(s,update()); p.expiresAt = new Date(0).toISOString(); assert.throws(() => applyPlan(s,p),/expired/); });
test('caller cannot mutate server-stored preview', async () => { const a = await app(); const p = await a.preview(update()); p.update.value = 'attacker'; p.retires.push('fact-refund'); await a.commit(p.id); const s = await a.state(); assert.ok(active(s).some(f => f.value === 'Germany')); assert.ok(active(s).some(f => f.value === '30')); });
test('failed persistence leaves committed state intact', async () => { const store = new LocalStore(); const a = new Airlock(store); await a.initialize(); const p = await a.preview(update()); store.save = async () => { throw new Error('disk unavailable'); }; await assert.rejects(a.commit(p.id),/disk unavailable/); assert.equal((await a.state()).revision,0); });
test('worker caches are rebuilt using current policy', async () => { const a = await app(); const p = await a.preview(update('14','refund_days')); await a.commit(p.id); await a.restart(); assert.ok((await a.state()).agents.every(a => a.state === 'offline' && !a.memoryIds.length)); await a.refresh(); const s = await a.state(); assert.ok(s.agents.every(a => a.state === 'synced')); assert.ok(s.decisions.filter(d => d.status === 'current' && d.agentId !== 'agent-luca').every(d => d.text.includes('is not') && d.text.includes('14-day'))); });
test('removed policy makes workers ask instead of guess', async () => { const a = await app(); const p = await a.preview(update('30','refund_days','policy','remove')); await a.commit(p.id); await a.refresh(); assert.ok((await a.state()).decisions.filter(d => d.status === 'current' && d.agentId !== 'agent-luca').every(d => d.text.includes('No current refund window'))); });
test('state survives a new service object', async () => {
 const dir = await mkdtemp(join(tmpdir(),'airlock-test-'));
 try { const file = join(dir,'state.json'); const first = new Airlock(new LocalStore(file)); await first.initialize(); const p = await first.preview(update()); await first.commit(p.id); const second = new Airlock(new LocalStore(file)); await second.initialize(); assert.ok(active(await second.state()).some(f => f.value === 'Germany')); }
 finally { const target = relative(tmpdir(),dir); assert.ok(target.startsWith('airlock-test-') && !target.includes('..')); await rm(dir,{recursive:true,force:true}); }
});
test('independent workspaces do not share facts', async () => { const a = await app(), b = await app(); const p = await a.preview(update()); await a.commit(p.id); assert.ok(!active(await b.state()).some(f => f.value === 'Germany')); });
test('invalid values and missing evidence are rejected', async () => { const a = await app(); for (const v of [update('-1','refund_days'),update('14.5','refund_days'),update('999','refund_days'),update('x','invented'),update('x','ships_to','invented'),{...update(),evidence:''},update('bad-email','support_email')]) await assert.rejects(a.preview(v)); });
test('graph serialization preserves state and evidence edges', () => { const s = seed(), graph = graphOf(s); assert.deepEqual(stateFromNodes(graph.nodes,s.revision),s); assert.ok(graph.edges.some(e => e.kind === 'SUPPORTS')); assert.ok(graph.edges.some(e => e.kind === 'DEPENDS_ON')); });
test('dependency traversal follows actual links', () => { const s = seed(); assert.deepEqual(impactInMemory(s,['fact-refund']),['decision-ada','decision-noor']); assert.deepEqual(impactInMemory(s,['missing']),[]); });
test('reset expires existing previews', async () => { const a = await app(); const p = await a.preview(update()); await a.reset(); await assert.rejects(a.commit(p.id),/not found/); });
test('in-app functional evidence passes', async () => { const r = await evaluate(); assert.equal(r.passed,r.total); assert.equal(r.total,11); });
test('real FalkorDB persistence, dependency query and workspace isolation', {skip:!process.env.FALKORDB_TEST_URL}, async () => {
 const name = `airlock-test-${Date.now()}`;
 const first = await FalkorStore.connect(process.env.FALKORDB_TEST_URL!,name), isolated = await FalkorStore.connect(process.env.FALKORDB_TEST_URL!,`${name}-other`);
 try { const a = new Airlock(first), b = new Airlock(isolated); await a.initialize(); await b.initialize(); const p = await a.preview(update('14','refund_days')); assert.deepEqual(p.affected.sort(),['decision-ada','decision-noor']); const comparison=await a.simulate({kind:'return',days:20,previewId:p.id}); assert.equal(comparison.changed,true); assert.equal((await a.state()).revision,0); await a.commit(p.id); assert.equal(active(await b.state()).find(f => f.relation === 'refund_days')?.value,'30'); const reload = new Airlock(first); await reload.initialize(); assert.equal(active(await reload.state()).find(f => f.relation === 'refund_days')?.value,'14'); await reload.refresh(); const restore=await reload.restorePreview({factId:'fact-refund',source:'policy',evidence:'Policy owner verified restoration of the original standard window.'}); assert.equal(restore.affected.length,2); await reload.commit(restore.id); const persisted=await first.load(); assert.equal(active(persisted!).find(f=>f.relation==='refund_days')?.restores,'fact-refund'); assert.equal(active(persisted!).find(f=>f.relation==='refund_days')?.value,'30'); }
 finally { await first.close(); await isolated.close(); }
});

test('customer comparison previews a changed answer without changing memory or consuming approval', async () => {
 const a=await app(), state=await a.state(), p=await a.preview(update('14','refund_days'));
 const r=await a.simulate({kind:'return',days:20,previewId:p.id});
 assert.equal(r.before.outcome,'within_window'); assert.equal(r.after?.outcome,'outside_window'); assert.equal(r.changed,true);
 assert.ok(r.after?.facts[0].id.startsWith('proposed:')); assert.equal(r.before.facts[0].id,'fact-refund');
 assert.deepEqual(await a.state(),state); await a.commit(p.id); assert.equal((await a.state()).revision,1);
});
test('current policy checks include the exact boundary and reject invalid case inputs', async () => {
 const a=await app();
 for(const days of [0,30]) assert.equal((await a.simulate({kind:'return',days})).before.outcome,'within_window');
 assert.equal((await a.simulate({kind:'return',days:31})).before.outcome,'outside_window');
 for(const input of [{kind:'return',days:-1},{kind:'return',days:1.5},{kind:'return',days:'20'},{kind:'shipping',destination:''},{kind:'shipping',destination:'France',authority:99}]) await assert.rejects(a.simulate(input));
});
test('a missing destination requires confirmation instead of inventing a prohibition', async () => {
 const a=await app(), p=await a.preview(update());
 const r=await a.simulate({kind:'shipping',destination:'Germany',previewId:p.id});
 assert.equal(r.before.outcome,'needs_confirmation'); assert.equal(r.after?.outcome,'destination_verified'); assert.equal(r.changed,true);
 assert.equal((await a.simulate({kind:'shipping',destination:' france '})).before.outcome,'destination_verified');
 assert.ok((await a.state()).facts.every(f=>f.value!=='Germany'));
});
test('blocked proposals cannot alter customer answers', async () => {
 const a=await app(), p=await a.preview(update('365','refund_days','customer'));
 const r=await a.simulate({kind:'return',days:50,previewId:p.id});
 assert.equal(r.proposalApplied,false); assert.equal(r.proposalStatus,'blocked'); assert.equal(r.changed,false); assert.deepEqual(r.before,r.after);
});
test('a hypothetical removal never falls back to a retired refund policy', async () => {
 const a=await app(), p=await a.preview(update('30','refund_days','policy','remove'));
 const r=await a.simulate({kind:'return',days:20,previewId:p.id});
 assert.equal(r.after?.outcome,'needs_confirmation'); assert.deepEqual(r.after?.facts,[]); assert.equal((await a.state()).revision,0);
});
test('support contact changes are visible even when eligibility is unchanged', async () => {
 const a=await app(), p=await a.preview(update('returns@example.com','support_email'));
 const r=await a.simulate({kind:'return',days:20,previewId:p.id});
 assert.equal(r.before.outcome,r.after?.outcome); assert.equal(r.changed,true); assert.equal(r.before.contact?.value,'help@example.com'); assert.equal(r.after?.contact?.value,'returns@example.com');
});
test('comparisons reject stale, missing and expired previews', async t => {
 const a=await app(), p=await a.preview(update()); await a.refresh();
 await assert.rejects(a.simulate({kind:'return',days:20,previewId:p.id}),/stale/);
 await assert.rejects(a.simulate({kind:'return',days:20,previewId:'missing'}),/not found/);
 const fresh=await a.preview(update()); const future=Date.now()+16*60_000; t.mock.method(Date,'now',()=>future);
 await assert.rejects(a.simulate({kind:'return',days:20,previewId:fresh.id}),/expired/);
});
test('restoration creates new evidence linked to history and preserves unrelated facts', async () => {
 const a=await app(), original=structuredClone((await a.state()).facts.find(f=>f.id==='fact-refund'));
 const change=await a.preview(update('14','refund_days')); await a.commit(change.id); await a.refresh();
 const p=await a.restorePreview({factId:'fact-refund',source:'policy',evidence:'Owner approved returning to the earlier standard policy.'});
 assert.equal(p.outcome,'replace'); assert.equal(p.affected.length,2); assert.equal((await a.state()).revision,2);
 const comparison=await a.simulate({kind:'return',days:20,previewId:p.id}); assert.equal(comparison.before.outcome,'outside_window'); assert.equal(comparison.after?.outcome,'within_window');
 await a.commit(p.id); const state=await a.state(), restored=active(state).find(f=>f.relation==='refund_days')!;
 assert.notEqual(restored.id,'fact-refund'); assert.equal(restored.restores,'fact-refund'); assert.equal(restored.value,'30');
 assert.match(restored.evidence,/Owner approved/); assert.equal(state.facts.find(f=>f.id==='fact-refund')?.evidence,original?.evidence);
 assert.equal(state.facts.find(f=>f.id==='fact-refund')?.status,'superseded'); assert.ok(active(state).some(f=>f.value==='France'));
 assert.ok(graphOf(state).edges.some(e=>e.from===restored.id && e.to==='fact-refund' && e.kind==='RESTORES'));
});
test('restoration obeys current authority rather than borrowing historical authority', async () => {
 const a=await app(), change=await a.preview(update('14','refund_days')); await a.commit(change.id);
 for(const [source,outcome] of [['customer','blocked'],['operations','review']]) {
  const p=await a.restorePreview({factId:'fact-refund',source,evidence:'Request to restore the earlier policy.'}); assert.equal(p.outcome,outcome); await assert.rejects(a.commit(p.id));
 }
 assert.equal(active(await a.state()).find(f=>f.relation==='refund_days')?.value,'14');
});
test('restoring a removed shipping fact preserves other destinations', async () => {
 const a=await app(), remove=await a.preview(update('France','ships_to','policy','remove')); await a.commit(remove.id);
 const p=await a.restorePreview({factId:'fact-france',source:'policy',evidence:'Shipping owner approved service resuming in France.'}); assert.equal(p.outcome,'add');
 p.restores='fact-uae'; await a.commit(p.id); const s=await a.state();
 assert.deepEqual(active(s).filter(f=>f.relation==='ships_to').map(f=>f.value).sort(),['France','United Arab Emirates']);
 assert.equal(active(s).find(f=>f.value==='France')?.restores,'fact-france');
});
test('restore requests require real retired facts and fresh evidence', async () => {
 const a=await app();
 for(const input of [{factId:'missing',source:'policy',evidence:'Valid length evidence.'},{factId:'fact-refund',source:'policy',evidence:'Valid length evidence.'},{factId:'fact-refund',source:'policy',evidence:''}]) await assert.rejects(a.restorePreview(input));
 assert.equal((await a.state()).revision,0);
});
