import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Airlock } from '../src/domain.ts';
import { LocalStore } from '../src/store.ts';
import { runTeam, readCurrentDraft } from '../src/team.ts';

test('local SDK boundary performs three real HTTP generations after server-mandated scoped reads, without Gateway', async () => {
  const requests: any[] = [], old = { ...process.env };
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); requests.push({ body, authorization: req.headers.authorization });
    const context = JSON.parse(body.messages.at(-1).content);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'local-contract', object: 'chat.completion', model: 'contract-model', created: 1,
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ summary: requests.length === 1 ? 'The researcher incorrectly concludes this purchase is outside the window.' : requests.length === 3 ? 'France has a special 90-day refund policy. We promise a full refund.' : 'This purchase is within the verified current 30-day standard window.', citations: context.requiredCitationIds, assessments: requests.length === 1 ? [{topic:'returns',outcome:'outside_window'}] : context.requiredAssessments }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address() as { port: number };
    process.env.AIRLOCK_ENABLE_AI = 'true'; process.env.AIRLOCK_AI_PROVIDER = 'ollama';
    process.env.OLLAMA_MODEL = 'contract-model'; process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
    const a = new Airlock(new LocalStore()); await a.initialize();
    const r = await runTeam(a, { question: 'Can this purchase be returned?', days: 20, destination: 'France', topics: ['returns'], mode: 'model' });
    assert.equal(requests.length, 3); assert.equal(r.run.orchestration, 'server-evidence');
    assert.equal(r.run.inputTokens, 30); assert.equal(r.run.outputTokens, 60);
    assert.equal(r.run.traces.length, 3); assert.deepEqual(r.decisions[0].factIds, ['fact-refund']);
    assert.equal(r.decisions[0].assessments![0].outcome, 'outside_window');
    assert.equal(r.decisions[1].assessments![0].outcome, 'within_window');
    assert.match(r.decisions[1].corrections!.join(' '), /Research conclusion/);
    const reusable = await readCurrentDraft(a, { runId: r.run.id });
    assert.equal(reusable.text, 'A 20-day-old purchase is within the current 30-day standard return window.');
    assert.equal(reusable.generatedText, 'France has a special 90-day refund policy. We promise a full refund.');
    assert.equal(reusable.basis, 'verified-policy');
    assert.deepEqual(reusable.citations, ['fact-refund']);
    const research = JSON.parse(requests[0].body.messages.at(-1).content);
    assert.equal(research.requiredAssessments, undefined, 'Research must derive its own outcome, not receive the answer.');
    assert.equal(research.contexts[0].checks, undefined, 'Evidence reads must not leak precomputed answers.');
    assert.equal(research.contexts[0].evidence[0].value, '30');
    const researchSchema = JSON.stringify(requests[0].body.response_format);
    assert.ok(researchSchema.includes('outside_window'), 'The research schema must permit a disagreement for the reviewer to detect.');
    assert.ok(!researchSchema.includes('shipping'), 'A returns-only generation must not be offered unrelated assessment topics.');
    const review = JSON.parse(requests[1].body.messages.at(-1).content);
    assert.equal(review.contexts[0].handoff.summary, undefined, 'Unverified research prose must not contaminate the verified review.');
    assert.equal(review.contexts[0].handoff.assessments[0].outcome, 'outside_window');
    for (const { body, authorization } of requests) {
      assert.equal(body.model, 'contract-model'); assert.equal(authorization, undefined);
      assert.equal(body.tools, undefined); assert.equal(body.reasoning_effort, 'none');
      assert.equal(body.response_format.type, 'json_schema');
      assert.ok(!JSON.stringify(body).includes('fact-email'));
    }
  } finally {
    for (const key of ['AIRLOCK_ENABLE_AI','AIRLOCK_AI_PROVIDER','OLLAMA_MODEL','OLLAMA_BASE_URL']) {
      if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key];
    }
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
