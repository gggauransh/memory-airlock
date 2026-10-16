import { mkdir, readFile, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Conflict, graphOf, impactInMemory, traceInMemory, active, stateFromNodes, type State, type Store, type GraphNode, type ImpactPath, type Relation, type Fact } from './domain.ts';

export class LocalStore implements Store {
  mode = 'local';
  file?: string;
  private memory: State | null = null;
  constructor(file?: string) { this.file = file; }
  async load(): Promise<State | null> {
    if (!this.file) return this.memory ? structuredClone(this.memory) : null;
    try {
      const contents = await readFile(this.file, 'utf8');
      // A trailing incomplete journal frame is ignored after interruption.
      const completed = contents.slice(0, contents.lastIndexOf('\n'));
      const frames = completed.split('\n').filter(line => line.trim());
      return frames.length ? JSON.parse(frames.at(-1)!) : null;
    }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
  }
  async save(s: State, expected: number) {
    const old = await this.load();
    if ((old?.revision ?? -1) !== expected) throw new Conflict('Concurrent update detected.');
    if (this.file) {
      await mkdir(dirname(this.file), { recursive: true });
      // Single-process, append-only demo journal. Each newline-terminated frame is a full revision.
      await appendFile(this.file, `\n${JSON.stringify(s)}\n`, { mode: 0o600 });
    } else this.memory = structuredClone(s);
  }
  async impact(ids: string[]) { const state = await this.load(); return state ? impactInMemory(state, ids) : []; }
  async trace(ids: string[], revision: number) { const state = await this.load(); if (!state || state.revision !== revision) throw new Conflict('Memory changed during dependency lookup.'); return traceInMemory(state, ids); }
  async evidence(requested: Relation[], revision: number) { const state = await this.load(); if (!state || state.revision !== revision) throw new Conflict('Memory changed during evidence lookup.'); return active(state).filter(f => requested.includes(f.relation)); }
  async close() {}
}

// Versioned nodes plus a compare-and-swap workspace pointer keep each snapshot atomic.
// Facts, evidence, decisions and their dependencies are first-class graph data, not a JSON blob mirror.
export class FalkorStore implements Store {
  mode = 'falkordb';
  private graph: any;
  private db: any;
  workspace: string;
  constructor(db: any, workspace: string) { this.db = db; this.workspace = workspace; this.graph = db.selectGraph('memory_airlock'); }
  static async connect(url: string, workspace = 'demo-shop') {
    const { FalkorDB } = await import('falkordb');
    const db = await FalkorDB.connect({ url, socket: { connectTimeout: 5000 } });
    const store = new FalkorStore(db, workspace);
    await store.graph.query('MERGE (w:AirlockWorkspace {id: $workspace}) ON CREATE SET w.revision = -1 RETURN w.revision AS revision', { params: { workspace } });
    return store;
  }
  async load(): Promise<State | null> {
    const result = await this.graph.roQuery('MATCH (w:AirlockWorkspace {id: $workspace}) RETURN w.revision AS revision', { params: { workspace: this.workspace } });
    const revision = Number(result.data?.[0]?.revision ?? -1);
    if (revision < 0) return null;
    const rows = await this.graph.roQuery('MATCH (n:AirlockNode {workspace: $workspace, revision: $revision}) RETURN n.key AS id, n.kind AS kind, n.payload AS payload', { params: { workspace: this.workspace, revision } });
    return stateFromNodes(rows.data as GraphNode[], revision);
  }
  async save(state: State, expected: number) {
    const { nodes, edges } = graphOf(state);
    const result = await this.graph.query(`MATCH (w:AirlockWorkspace {id: $workspace})
      WHERE w.revision = $expected
      SET w.revision = $revision
      WITH w UNWIND $nodes AS row
      CREATE (:AirlockNode {workspace: $workspace, revision: $revision, key: row.id, kind: row.kind, payload: row.payload})
      WITH DISTINCT w UNWIND $edges AS edge
      MATCH (a:AirlockNode {workspace: $workspace, revision: $revision, key: edge.from})
      MATCH (b:AirlockNode {workspace: $workspace, revision: $revision, key: edge.to})
      CREATE (a)-[:LINK {kind: edge.kind}]->(b)
      RETURN count(*) AS written`, { params: { workspace: this.workspace, expected, revision: state.revision, nodes, edges } });
    if (!result.data?.length || !Number(result.data[0].written)) throw new Conflict('Concurrent graph update detected.');
  }
  async impact(factIds: string[]): Promise<string[]> {
    const state = await this.load();
    return state ? (await this.trace(factIds, state.revision)).map(p => p.decisionId).sort() : [];
  }
  async trace(nodeIds: string[], revision: number): Promise<ImpactPath[]> {
    const result = await this.graph.roQuery(`MATCH p=(d:AirlockNode {workspace: $workspace, revision: $revision, kind: 'decision'})-[:LINK*1..16]->(target:AirlockNode {workspace: $workspace, revision: $revision})
      WHERE target.key IN $ids
        AND all(edge IN relationships(p) WHERE edge.kind = 'DEPENDS_ON')
        AND all(node IN nodes(p) WHERE node.workspace = $workspace AND node.revision = $revision)
      RETURN d.key AS decisionId, [node IN nodes(p) | node.key] AS nodeIds, length(p) AS hops
      ORDER BY hops`, { params: { workspace: this.workspace, revision, ids: nodeIds } });
    const shortest = new Map<string, ImpactPath>();
    for (const row of result.data ?? []) if (!shortest.has(row.decisionId)) shortest.set(row.decisionId, { decisionId: row.decisionId, nodeIds: row.nodeIds });
    return [...shortest.values()].sort((a, b) => a.decisionId.localeCompare(b.decisionId));
  }
  async evidence(requested: Relation[], revision: number): Promise<Fact[]> {
    // Evidence must be attached to a source in the graph; orphaned payloads cannot become model context.
    const result = await this.graph.roQuery(`MATCH (source:AirlockNode {workspace: $workspace, revision: $revision, kind: 'source'})-[r:LINK]->(fact:AirlockNode {workspace: $workspace, revision: $revision, kind: 'fact'})
      WHERE r.kind = 'SUPPORTS'
      RETURN fact.payload AS payload`, { params: { workspace: this.workspace, revision } });
    return (result.data ?? []).map((row: { payload: string }) => JSON.parse(row.payload) as Fact).filter((f: Fact) => f.status === 'active' && requested.includes(f.relation));
  }
  async close() { await this.db.close(); }
}
