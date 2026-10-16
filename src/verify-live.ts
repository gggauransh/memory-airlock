import { mkdir, writeFile } from 'node:fs/promises';
import { Airlock } from './domain.ts';
import { FalkorStore, LocalStore } from './store.ts';
import { runTeam, refreshAffected, readCurrentDraft } from './team.ts';

// Always local inference: running this proof cannot spend Gateway credits.
process.env.AIRLOCK_AI_PROVIDER = 'ollama'; process.env.AIRLOCK_ENABLE_AI = 'true';
const store = process.argv.includes('--local-store') ? new LocalStore() : await FalkorStore.connect(process.env.FALKORDB_URL!, `live-proof-${Date.now()}`);
try {
  const a = new Airlock(store); await a.initialize();
  const base = { days: 20, destination: 'Germany', mode: 'model' };
  console.log('Running local-model returns case...');
  const returns = await runTeam(a, { ...base, question: 'Check whether this purchase is within the current standard return window.', topics: ['returns'], claim: 'outside_window' });
  console.log('Returns case saved:', returns.run.model, returns.run.durationMs, 'ms');
  const shipping = await runTeam(a, { ...base, question: 'Is delivery to Germany supported by current verified policy?', topics: ['shipping'] });
  console.log('Shipping case saved:', shipping.run.durationMs, 'ms');
  const preview = await a.preview({ relation: 'refund_days', value: '14', source: 'policy', evidence: 'Synthetic policy owner confirms a 14-day standard return window.' });
  if (!returns.run.decisionIds.every(key => preview.affected.includes(key)) || shipping.run.decisionIds.some(key => preview.affected.includes(key))) throw new Error('Selectivity proof failed.');
  await a.commit(preview.id);
  let staleBlocked = false; try { await readCurrentDraft(a, { runId: returns.run.id }); } catch { staleBlocked = true; }
  if (!staleBlocked) throw new Error('Stale draft was reusable.');
  const refresh = await refreshAffected(a, {});
  if (refresh.refreshed.length !== 1) throw new Error('Refresh did not isolate the affected case.');
  const persisted = await new Airlock(store).state();
  const evidence = { ranAt: new Date().toISOString(), backend: store.mode, model: returns.run.model, staleBlocked, unchangedShippingDraft: await readCurrentDraft(a, { runId: shipping.run.id }), returns, shipping, preview, refresh, persistedRunCount: persisted.runs?.length };
  await mkdir('artifacts', { recursive: true }); await writeFile('artifacts/live-proof.json', JSON.stringify(evidence, null, 2));
  console.log('PASS: local inference, independent cases, stale-draft blocking, selective refresh and reload persistence. Evidence: artifacts/live-proof.json');
} catch (error) {
  const e = error as Error & { cause?: Error };
  console.error(e.name, e.message); if (e.cause) console.error('Cause:', e.cause.message);
  process.exitCode = 1;
} finally { await store.close?.(); }
