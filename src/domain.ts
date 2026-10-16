import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const relations = {
  ships_to: { label: 'Shipping destinations', cardinality: 'many' },
  refund_days: { label: 'Refund window', cardinality: 'one' },
  support_email: { label: 'Support email', cardinality: 'one' },
} as const;
export const sources = {
  policy: { name: 'Official policy', authority: 3 },
  operations: { name: 'Operations handbook', authority: 2 },
  customer: { name: 'Customer message', authority: 0 },
} as const;
export const updateSchema = z.object({
  relation: z.enum(['ships_to', 'refund_days', 'support_email']),
  value: z.string().trim().min(1).max(120),
  source: z.enum(['policy', 'operations', 'customer']),
  evidence: z.string().trim().min(8).max(2000),
  action: z.enum(['assert', 'remove']).default('assert'),
}).strict().superRefine((v, ctx) => {
  if (v.relation === 'refund_days' && (!/^\d+$/.test(v.value) || +v.value < 1 || +v.value > 365))
    ctx.addIssue({ code: 'custom', message: 'Refund window must be 1–365 whole days.', path: ['value'] });
  if (v.relation === 'support_email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.value))
    ctx.addIssue({ code: 'custom', message: 'Enter a valid support email.', path: ['value'] });
});
export type Update = z.infer<typeof updateSchema>;
export type Relation = keyof typeof relations;
export type Fact = { id: string; relation: Relation; value: string; source: keyof typeof sources; evidence: string; status: 'active' | 'superseded' | 'removed'; createdAt: string; retiredAt?: string; replaces: string[]; restores?: string };
export type Agent = { id: string; name: string; role: string; color: string; state: 'synced' | 'stale' | 'offline'; revision: number; memoryIds: string[] };
export type Topic = 'returns' | 'shipping' | 'contact';
export type Assessment = { topic: Topic; outcome: string };
export type CaseRequest = { question: string; days: number; destination: string; topics: Topic[]; claim?: 'within_window' | 'outside_window' };
export type Decision = { id: string; agentId: string; text: string; factIds: string[]; decisionIds?: string[]; watches?: Relation[]; runId?: string; origin?: 'model' | 'replay'; citations?: string[]; assessments?: Assessment[]; corrections?: string[]; status: 'current' | 'recheck'; createdAt: string };
export type ToolTrace = { agentId: string; tool: string; revision: number; factIds: string[]; decisionIds: string[]; watchedRelations?: Relation[]; durationMs: number };
export type AgentRun = { id: string; caseId?: string; replacesRunId?: string; request?: CaseRequest; question: string; mode: 'model' | 'replay'; orchestration?: 'server-evidence' | 'model-tools'; model?: string; basedOnRevision: number; createdAt: string; durationMs: number; decisionIds: string[]; traces: ToolTrace[]; inputTokens?: number; outputTokens?: number };
export type ImpactPath = { decisionId: string; nodeIds: string[] };
export type Event = { id: string; title: string; detail: string; createdAt: string; kind: 'seed' | 'commit' | 'agents' | 'restart'; factIds: string[] };
export type State = { revision: number; facts: Fact[]; agents: Agent[]; decisions: Decision[]; events: Event[]; runs?: AgentRun[] };
export type Plan = { id: string; revision: number; createdAt: string; expiresAt: string; update: Update; outcome: 'add' | 'replace' | 'remove' | 'noop' | 'blocked' | 'review'; title: string; reason: string; retires: string[]; affected: string[]; preserved: string[]; paths?: ImpactPath[]; question?: string; restores?: string };
export type Edge = { from: string; to: string; kind: string };
export type GraphNode = { id: string; kind: string; payload: string };
export interface Store {
  mode: string;
  load(): Promise<State | null>;
  save(state: State, expectedRevision: number): Promise<void>;
  impact(factIds: string[]): Promise<string[]>;
  trace(nodeIds: string[], revision: number): Promise<ImpactPath[]>;
  evidence(relations: Relation[], revision: number): Promise<Fact[]>;
  close?(): Promise<void>;
}
export class Conflict extends Error { status = 409; }
export class Invalid extends Error { status = 422; }
export const now = () => new Date().toISOString();
export const id = (prefix: string) => `${prefix}-${randomUUID().slice(0, 12)}`;
export const active = (s: State) => s.facts.filter(f => f.status === 'active');
const sameValue = (a: string, b: string) => a.normalize('NFKC').toLowerCase().trim() === b.normalize('NFKC').toLowerCase().trim();

export function seed(): State {
  const createdAt = now();
  const facts: Fact[] = [
    { id: 'fact-france', relation: 'ships_to', value: 'France', source: 'policy', evidence: 'Shipping policy: we deliver to France.', status: 'active', createdAt, replaces: [] },
    { id: 'fact-uae', relation: 'ships_to', value: 'United Arab Emirates', source: 'policy', evidence: 'Shipping policy: we deliver to the United Arab Emirates.', status: 'active', createdAt, replaces: [] },
    { id: 'fact-refund', relation: 'refund_days', value: '30', source: 'policy', evidence: 'Refund policy v1: standard returns are accepted within 30 days.', status: 'active', createdAt, replaces: [] },
    { id: 'fact-email', relation: 'support_email', value: 'help@example.com', source: 'policy', evidence: 'Contact policy: the support address is help@example.com.', status: 'active', createdAt, replaces: [] },
  ];
  const agents: Agent[] = [
    { id: 'agent-ada', name: 'Ada', role: 'Customer support', color: 'green', state: 'synced', revision: 0, memoryIds: facts.map(f => f.id) },
    { id: 'agent-noor', name: 'Noor', role: 'Returns specialist', color: 'orange', state: 'synced', revision: 0, memoryIds: ['fact-refund', 'fact-email'] },
    { id: 'agent-luca', name: 'Luca', role: 'Shipping specialist', color: 'blue', state: 'synced', revision: 0, memoryIds: ['fact-france', 'fact-uae', 'fact-email'] },
  ];
  return { revision: 0, facts, agents, decisions: [
    { id: 'decision-ada', agentId: 'agent-ada', text: 'A 20-day-old purchase is within the standard return window.', factIds: ['fact-refund'], status: 'current', createdAt },
    { id: 'decision-noor', agentId: 'agent-noor', text: 'Draft the return response using the 30-day standard policy.', factIds: ['fact-refund', 'fact-email'], status: 'current', createdAt },
    { id: 'decision-luca', agentId: 'agent-luca', text: 'A customer in France can receive a delivery.', factIds: ['fact-france'], status: 'current', createdAt },
  ], events: [{ id: id('event'), title: 'Workspace ready', detail: 'Four verified facts shared by three agents. All customer examples are synthetic.', createdAt, kind: 'seed', factIds: facts.map(f => f.id) }] };
}

export function graphOf(s: State): { nodes: GraphNode[]; edges: Edge[] } {
  const nodes: GraphNode[] = [{ id: 'workspace', kind: 'workspace', payload: JSON.stringify({ revision: s.revision }) }];
  const edges: Edge[] = [];
  for (const [key, value] of Object.entries(sources)) nodes.push({ id: `source-${key}`, kind: 'source', payload: JSON.stringify(value) });
  for (const [key, value] of Object.entries(relations)) nodes.push({ id: `scope:${key}`, kind: 'scope', payload: JSON.stringify({ relation: key, ...value }) });
  for (const f of s.facts) {
    nodes.push({ id: f.id, kind: 'fact', payload: JSON.stringify(f) });
    edges.push({ from: `source-${f.source}`, to: f.id, kind: 'SUPPORTS' });
    for (const old of f.replaces) edges.push({ from: f.id, to: old, kind: 'SUPERSEDES' });
    if (f.restores) edges.push({ from: f.id, to: f.restores, kind: 'RESTORES' });
  }
  for (const a of s.agents) nodes.push({ id: a.id, kind: 'agent', payload: JSON.stringify(a) });
  for (const d of s.decisions) {
    nodes.push({ id: d.id, kind: 'decision', payload: JSON.stringify(d) });
    edges.push({ from: d.agentId, to: d.id, kind: 'MADE' });
    for (const factId of d.factIds) edges.push({ from: d.id, to: factId, kind: 'DEPENDS_ON' });
    for (const decisionId of d.decisionIds ?? []) edges.push({ from: d.id, to: decisionId, kind: 'DEPENDS_ON' });
    for (const relation of d.watches ?? []) edges.push({ from: d.id, to: `scope:${relation}`, kind: 'DEPENDS_ON' });
  }
  for (const run of s.runs ?? []) {
    nodes.push({ id: run.id, kind: 'run', payload: JSON.stringify(run) });
    for (const decisionId of run.decisionIds) edges.push({ from: run.id, to: decisionId, kind: 'PRODUCED' });
  }
  for (const event of s.events) {
    nodes.push({ id: event.id, kind: 'event', payload: JSON.stringify(event) });
    for (const factId of event.factIds) edges.push({ from: event.id, to: factId, kind: 'TOUCHED' });
  }
  return { nodes, edges };
}

export function stateFromNodes(nodes: GraphNode[], revision: number): State {
  const by = <T>(kind: string): T[] => nodes.filter(n => n.kind === kind).map(n => JSON.parse(n.payload));
  const runs = by<AgentRun>('run');
  return { revision, facts: by<Fact>('fact'), agents: by<Agent>('agent'), decisions: by<Decision>('decision'), events: by<Event>('event'), ...(runs.length ? { runs } : {}) };
}

// Breadth-first search returns one shortest evidence path per affected decision.
// Production uses the equivalent bounded Cypher traversal in FalkorDB.
export function traceInMemory(s: State, nodeIds: string[]): ImpactPath[] {
  const { edges } = graphOf(s), paths = new Map(nodeIds.map(key => [key, [key]]));
  const queue = [...nodeIds];
  for (let i = 0; i < queue.length; i++) {
    const target = queue[i], path = paths.get(target)!;
    if (path.length > 16) continue;
    for (const edge of edges) if (edge.kind === 'DEPENDS_ON' && edge.to === target && !paths.has(edge.from)) {
      paths.set(edge.from, [edge.from, ...path]); queue.push(edge.from);
    }
  }
  return s.decisions.filter(d => paths.has(d.id)).map(d => ({ decisionId: d.id, nodeIds: paths.get(d.id)! })).sort((a, b) => a.decisionId.localeCompare(b.decisionId));
}

// Walk the same directed dependency graph in both adapters. A shared noun never implies replacement.
export function impactInMemory(s: State, factIds: string[]): string[] {
  const { edges, nodes } = graphOf(s);
  const reachable = new Set(factIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) if (edge.kind === 'DEPENDS_ON' && reachable.has(edge.to) && !reachable.has(edge.from)) {
      reachable.add(edge.from); changed = true;
    }
  }
  return nodes.filter(n => n.kind === 'decision' && reachable.has(n.id)).map(n => n.id).sort();
}

export function planUpdate(s: State, input: unknown, impacted: string[] = []): Plan {
  const update = updateSchema.parse(input);
  const facts = active(s).filter(f => f.relation === update.relation);
  const matching = facts.filter(f => sameValue(f.value, update.value));
  const many = relations[update.relation].cardinality === 'many';
  const plan: Plan = { id: id('preview'), revision: s.revision, createdAt: now(), expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), update, outcome: 'add', title: 'Add a new fact', reason: 'This update adds knowledge without retiring existing facts.', retires: [], affected: [], preserved: active(s).map(f => f.id) };
  if (sources[update.source].authority < 2) {
    return { ...plan, outcome: 'blocked', title: 'Source cannot change policy', reason: 'Customer statements are evidence to review, not authority to rewrite shared shop policy.', question: 'Can an authorized policy owner confirm this change?' };
  }
  if (update.action === 'assert' && matching.length) return { ...plan, outcome: 'noop', title: 'Already remembered', reason: 'This fact is already active. No facts or decisions will change.' };
  if (update.action === 'remove' && !matching.length) return { ...plan, outcome: 'noop', title: 'Nothing to remove', reason: 'No active fact matches this exact value.' };
  const retiring = update.action === 'remove' ? matching : many ? [] : facts;
  if (retiring.some(f => sources[f.source].authority > sources[update.source].authority))
    return { ...plan, outcome: 'review', title: 'Policy owner must clarify', reason: 'The incoming source has less authority than the active policy. Existing facts stay intact.', question: `Should the official policy owner approve ${update.value} as the new ${relations[update.relation].label.toLowerCase()}?` };
  plan.retires = retiring.map(f => f.id);
  plan.preserved = active(s).filter(f => !plan.retires.includes(f.id)).map(f => f.id);
  plan.affected = impacted.filter(d => s.decisions.some(item => item.id === d && item.status === 'current'));
  if (update.action === 'remove') Object.assign(plan, { outcome: 'remove', title: 'Retire this exact fact', reason: 'Only the explicitly named value is retired. Other facts stay intact.' });
  else if (retiring.length) Object.assign(plan, { outcome: 'replace', title: 'Replace one policy, preserve the rest', reason: 'This field has one current value. The previous value remains available in the audit history.' });
  else if (many) plan.reason = 'Shipping destinations form a set. Adding Germany does not mean that shipping to France has stopped.'.replace('Germany', update.value);
  return plan;
}

export function applyPlan(s: State, plan: Plan): State {
  if (s.revision !== plan.revision) throw new Conflict('Memory changed after this preview. Preview the update again.');
  if (Date.parse(plan.expiresAt) <= Date.now()) throw new Conflict('This preview expired. Preview the update again.');
  if (!['add', 'replace', 'remove'].includes(plan.outcome)) throw new Invalid('This change is not approved for application.');
  if (plan.restores && !s.facts.some(f => f.id === plan.restores && f.status !== 'active' && f.relation === plan.update.relation && sameValue(f.value, plan.update.value))) throw new Invalid('The historical fact does not match this restoration.');
  const next = structuredClone(s);
  const createdAt = now();
  next.revision++;
  for (const fact of next.facts) if (plan.retires.includes(fact.id)) {
    fact.status = plan.outcome === 'remove' ? 'removed' : 'superseded'; fact.retiredAt = createdAt;
  }
  const newIds: string[] = [];
  if (plan.outcome !== 'remove') {
    const fact: Fact = { id: id('fact'), relation: plan.update.relation, value: plan.update.value, source: plan.update.source, evidence: plan.update.evidence, createdAt, status: 'active', replaces: [...plan.retires] };
    if (plan.restores) fact.restores = plan.restores;
    next.facts.push(fact); newIds.push(fact.id);
  }
  for (const decision of next.decisions) if (plan.affected.includes(decision.id)) decision.status = 'recheck';
  for (const agent of next.agents) {
    const relevant = next.decisions.some(d => d.agentId === agent.id && plan.affected.includes(d.id)) || agent.id === 'agent-ada' || (agent.id === 'agent-noor' && plan.update.relation !== 'ships_to') || (agent.id === 'agent-luca' && plan.update.relation !== 'refund_days');
    if (relevant && agent.state !== 'offline') agent.state = 'stale';
  }
  next.events.unshift({ id: id('event'), title: plan.title, detail: `${plan.update.value} · ${sources[plan.update.source].name}. ${plan.affected.length} decision(s) require rechecking.`, createdAt, kind: 'commit', factIds: [...new Set([...plan.retires, ...newIds, ...(plan.restores ? [plan.restores] : [])])] });
  return next;
}

export function refreshAgents(s: State): State {
  const next = structuredClone(s); next.revision++;
  const facts = active(next);
  const refund = facts.find(f => f.relation === 'refund_days');
  const destinations = facts.filter(f => f.relation === 'ships_to');
  const email = facts.find(f => f.relation === 'support_email');
  for (const agent of next.agents) {
    // Model workers need a new verified run; a template refresh cannot regenerate their answers.
    if (agent.id.startsWith('team-')) continue;
    const relevant = facts.filter(f => agent.id === 'agent-ada' || (agent.id === 'agent-noor' && f.relation !== 'ships_to') || (agent.id === 'agent-luca' && f.relation !== 'refund_days'));
    agent.memoryIds = relevant.map(f => f.id); agent.revision = next.revision; agent.state = 'synced';
    for (const d of next.decisions.filter(d => d.agentId === agent.id)) d.status = 'recheck';
    const text = agent.id === 'agent-luca' ? `Current destinations: ${destinations.map(f => f.value).join(', ') || 'none verified'}.` : refund ? `A 20-day-old purchase ${20 <= +refund.value ? 'is' : 'is not'} within the current ${refund.value}-day standard return window.${email ? ` Contact: ${email.value}.` : ''}` : 'No current refund window is verified. Ask the policy owner before making a promise.';
    const usedFacts = agent.id === 'agent-luca' ? destinations : [refund, email].filter((f): f is Fact => !!f);
    next.decisions.push({ id: id('decision'), agentId: agent.id, text, factIds: usedFacts.map(f => f.id), status: 'current', createdAt: now() });
  }
  next.events.unshift({ id: id('event'), title: 'Three agents refreshed', detail: 'Workers reconstructed current policy from shared memory and rechecked their responses.', createdAt: now(), kind: 'agents', factIds: facts.map(f => f.id) });
  return next;
}

const restoreSchema = z.object({
  factId: z.string().min(1).max(100),
  source: z.enum(['policy', 'operations', 'customer']),
  evidence: z.string().trim().min(8).max(2000),
}).strict();
const simulationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('return'), days: z.number().int().min(0).max(3650), previewId: z.string().min(1).max(100).optional() }).strict(),
  z.object({ kind: z.literal('shipping'), destination: z.string().trim().min(1).max(120), previewId: z.string().min(1).max(100).optional() }).strict(),
]);
type CaseInput = z.infer<typeof simulationSchema>;
export function answerCase(state: State, input: CaseInput) {
  const facts = active(state), contact = facts.find(f => f.relation === 'support_email') ?? null;
  if (input.kind === 'return') {
    const policy = facts.find(f => f.relation === 'refund_days');
    if (!policy) return { outcome: 'needs_confirmation', label: 'Ask the policy owner', answer: 'No current refund window is verified. Do not promise eligibility.', facts: [] as Fact[], contact };
    const within = input.days <= Number(policy.value);
    return { outcome: within ? 'within_window' : 'outside_window', label: within ? 'Within the standard window' : 'Outside the standard window', answer: `A ${input.days}-day-old purchase is ${within ? 'within' : 'outside'} the current ${policy.value}-day standard return window.`, facts: [policy], contact };
  }
  const destinations = facts.filter(f => f.relation === 'ships_to');
  const match = destinations.find(f => sameValue(f.value, input.destination));
  return match
    ? { outcome: 'destination_verified', label: 'Destination verified', answer: `Shipping to ${match.value} is supported by current verified policy.`, facts: [match], contact }
    : { outcome: 'needs_confirmation', label: 'Destination unverified', answer: `Shipping to ${input.destination} is not verified in shared memory. Confirm with the policy owner before promising delivery.`, facts: destinations, contact };
}

export class Airlock {
  store: Store;
  private previews = new Map<string, Plan>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(store: Store) { this.store = store; }
  private serialize<T>(fn: () => Promise<T>): Promise<T> { const task = this.queue.then(fn, fn); this.queue = task.catch(() => {}); return task; }
  async state(): Promise<State> { const state = await this.store.load(); if (!state) throw new Invalid('Workspace is not initialized.'); return state; }
  initialize() { return this.serialize(async () => { const state = await this.store.load(); if (!state) await this.store.save(seed(), -1); return this.state(); }); }
  private async preparePreview(state: State, input: unknown, restores?: string) {
    const draft = planUpdate(state, input);
    const writable = ['add', 'replace', 'remove'].includes(draft.outcome);
    const paths = writable ? await this.store.trace([...draft.retires, `scope:${draft.update.relation}`], state.revision) : [];
    const plan = planUpdate(state, input, paths.map(p => p.decisionId));
    plan.paths = paths.filter(p => plan.affected.includes(p.decisionId));
    if (restores) { plan.restores = restores; plan.title = `Restore a previous ${relations[plan.update.relation].label.toLowerCase()}`; }
    for (const [key, p] of this.previews) if (Date.parse(p.expiresAt) <= Date.now()) this.previews.delete(key);
    if (this.previews.size >= 100) this.previews.delete(this.previews.keys().next().value!);
    this.previews.set(plan.id, structuredClone(plan)); return plan;
  }
  preview(input: unknown) { return this.serialize(async () => this.preparePreview(await this.state(), input)); }
  async readEvidence(requested: Relation[], revision: number) {
    if ((await this.state()).revision !== revision) throw new Conflict('Memory changed while the team was working. Run the case again.');
    return this.store.evidence(requested, revision);
  }
  recordRun(run: AgentRun, decisions: Decision[], agents: Agent[]) { return this.serialize(async () => {
    const state = await this.state();
    if (state.revision !== run.basedOnRevision) throw new Conflict('Memory changed during the agent run. Nothing was saved. Run the case again.');
    if (decisions.length !== 3 || run.decisionIds.join() !== decisions.map(d => d.id).join() || (state.runs ?? []).some(r => r.id === run.id)) throw new Invalid('Invalid agent run.');
    const available = new Set(state.decisions.filter(d => d.status === 'current').map(d => d.id));
    const facts = new Set(active(state).map(f => f.id));
    for (const d of decisions) {
      if (state.decisions.some(old => old.id === d.id) || available.has(d.id) || !agents.some(a => a.id === d.agentId) || d.runId !== run.id || d.origin !== run.mode || !d.text.trim() || d.text.length > 8000 || d.factIds.some(f => !facts.has(f)) || (d.decisionIds ?? []).some(key => !available.has(key)) || (d.watches ?? []).some(r => !(r in relations))) throw new Invalid('An agent returned an invalid evidence dependency.');
      available.add(d.id);
    }
    const next = structuredClone(state); next.revision++;
    // A new run supersedes this team's old answers. Invalidate all their downstream consumers too.
    const oldIds = next.decisions.filter(d => agents.some(a => a.id === d.agentId) && d.status === 'current').map(d => d.id);
    const invalid = new Set([...oldIds, ...traceInMemory(next, oldIds).map(p => p.decisionId)]);
    for (const d of next.decisions) if (invalid.has(d.id)) d.status = 'recheck';
    next.decisions.push(...structuredClone(decisions));
    for (const agent of agents) {
      const existing = next.agents.findIndex(a => a.id === agent.id);
      const saved = { ...agent, state: 'synced' as const, revision: next.revision };
      if (existing < 0) next.agents.push(saved); else next.agents[existing] = saved;
    }
    next.runs = [...next.runs ?? [], structuredClone(run)];
    next.events.unshift({ id: id('event'), title: run.mode === 'model' ? 'Live agent team completed' : 'Deterministic handoff replay completed', detail: `Three linked decisions saved with ${run.traces.length} tool traces. Policy facts were not changed.`, createdAt: now(), kind: 'agents', factIds: [...new Set(decisions.flatMap(d => d.factIds))] });
    await this.store.save(next, state.revision); return next;
  }); }
  restorePreview(input: unknown) { return this.serialize(async () => {
    const request = restoreSchema.parse(input), state = await this.state();
    const historical = state.facts.find(f => f.id === request.factId);
    if (!historical || historical.status === 'active') throw new Invalid('Choose a retired fact from this workspace history.');
    return this.preparePreview(state, { relation: historical.relation, value: historical.value, source: request.source, evidence: request.evidence, action: 'assert' }, historical.id);
  }); }
  simulate(input: unknown) { return this.serialize(async () => {
    const request = simulationSchema.parse(input), state = await this.state();
    const before = answerCase(state, request);
    if (!request.previewId) return { revision: state.revision, before, after: null, changed: false, proposalApplied: false, proposalStatus: null };
    const plan = this.previews.get(request.previewId);
    if (!plan) throw new Conflict('Preview not found. Review the proposed change again.');
    if (state.revision !== plan.revision || Date.parse(plan.expiresAt) <= Date.now()) throw new Conflict('The preview is stale or expired. Review the proposed change again.');
    const applicable = ['add', 'replace', 'remove'].includes(plan.outcome);
    const projected = applicable ? applyPlan(state, plan) : state;
    // Hypothetical evidence is explicitly named; it is never a committed graph fact.
    for (const fact of projected.facts) if (!state.facts.some(f => f.id === fact.id)) fact.id = `proposed:${plan.id}`;
    const after = answerCase(projected, request);
    return { revision: state.revision, before, after, changed: before.outcome !== after.outcome || before.answer !== after.answer || before.contact?.value !== after.contact?.value, proposalApplied: applicable, proposalStatus: plan.outcome };
  }); }
  commit(previewId: string) { return this.serialize(async () => {
    const plan = this.previews.get(previewId); if (!plan) throw new Conflict('Preview not found. Preview this update first.');
    const state = await this.state(); const next = applyPlan(state, plan);
    await this.store.save(next, state.revision); this.previews.delete(previewId); return next;
  }); }
  refresh() { return this.serialize(async () => { const state = await this.state(); const next = refreshAgents(state); await this.store.save(next, state.revision); return next; }); }
  restart() { return this.serialize(async () => { const state = await this.state(); const next = structuredClone(state); next.revision++;
    for (const agent of next.agents) { agent.state = 'offline'; agent.memoryIds = []; agent.revision = -1; }
    next.events.unshift({ id: id('event'), title: 'Workers stopped', detail: 'Worker caches were cleared. Durable facts and evidence remain in the store.', createdAt: now(), kind: 'restart', factIds: [] });
    await this.store.save(next, state.revision); return next;
  }); }
  reset() { return this.serialize(async () => { const state = await this.state(); const next = seed(); next.revision = state.revision + 1; for (const a of next.agents) a.revision = next.revision; await this.store.save(next, state.revision); this.previews.clear(); return next; }); }
}
