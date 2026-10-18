import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Airlock, graphOf, relations, sources } from './domain.ts';
import { FalkorStore } from './store.ts';
import { evaluate } from './evaluate.ts';
import { explainWithAI } from './ai.ts';
import { ZodError } from 'zod';
import { runTeam, aiAvailable, refreshAffected, readCurrentDraft, modelName } from './team.ts';
import { benchmark } from './benchmark.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const mode = process.env.MEMORY_STORE || 'falkordb';
if (mode !== 'falkordb') throw new Error('This application requires FalkorDB. The local reference adapter is reserved for isolated tests and comparisons.');
if (!process.env.FALKORDB_URL) throw new Error('FALKORDB_URL is required. Start FalkorDB with Docker Compose or configure the existing Cloud instance. There is no storage fallback.');
const store = await FalkorStore.connect(process.env.FALKORDB_URL, process.env.AIRLOCK_WORKSPACE || 'demo-shop');
const airlock = new Airlock(store); await airlock.initialize();
const port = Number(process.env.PORT || 4317);
const sessionToken = (await import('node:crypto')).randomBytes(24).toString('hex');
let teamBusy = false, benchmarkBusy = false;
const files: Record<string, [string, string]> = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
files['/vendor/lucide.min.js'] = ['vendor/lucide.min.js', 'text/javascript'];
files['/vendor/manrope.woff2'] = ['vendor/manrope.woff2', 'font/woff2'];
files['/vendor/plex-mono.woff2'] = ['vendor/plex-mono.woff2', 'font/woff2'];

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const send = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
  try {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const host = req.headers.host || '';
    if (![ `localhost:${port}`, `127.0.0.1:${port}` ].includes(host)) return send(403, { error: 'This demo only accepts its local host.' });
    if (req.method === 'GET' && files[url.pathname]) {
      const [file, mime] = files[url.pathname];
      res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` }); res.end(await readFile(resolve(root, 'public', file))); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const state = await airlock.state();
      return send(200, { state, graph: graphOf(state), relations, sources, sessionToken, backend: store.mode, aiEnabled: aiAvailable(), aiProvider: process.env.AIRLOCK_AI_PROVIDER || 'ollama', model: modelName() });
    }
    if (req.method === 'GET' && url.pathname === '/api/export') return send(200, { application: 'Memory Airlock', exportedAt: new Date().toISOString(), backend: store.mode, state: await airlock.state() });
    if (req.method !== 'POST') return send(404, { error: 'Not found.' });
    if (req.headers.origin && req.headers.origin !== `http://${host}`) return send(403, { error: 'Cross-origin writes are not allowed.' });
    if (req.headers['x-airlock-token'] !== sessionToken) return send(403, { error: 'Reload the app before changing memory.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON body required.' });
    let raw = ''; for await (const chunk of req) { raw += chunk.toString(); if (Buffer.byteLength(raw) > 16_384) return send(413, { error: 'Request is too large.' }); }
    let body: any; try { body = JSON.parse(raw || '{}'); } catch { return send(400, { error: 'Invalid JSON.' }); }
    if (url.pathname === '/api/preview') return send(200, { plan: await airlock.preview(body) });
    if (url.pathname === '/api/restore-preview') return send(200, { plan: await airlock.restorePreview(body) });
    if (url.pathname === '/api/simulate') return send(200, await airlock.simulate(body));
    if (url.pathname === '/api/commit') {
      if (typeof body.previewId !== 'string') return send(400, { error: 'previewId is required.' });
      return send(200, { state: await airlock.commit(body.previewId) });
    }
    if (url.pathname === '/api/agents/refresh') return send(200, { state: await airlock.refresh() });
    if (url.pathname === '/api/agents/restart') return send(200, { state: await airlock.restart() });
    if (url.pathname === '/api/reset') return send(200, { state: await airlock.reset() });
    if (url.pathname === '/api/evaluate') return send(200, await evaluate());
    if (url.pathname === '/api/team/draft') return send(200, await readCurrentDraft(airlock, body));
    if (url.pathname === '/api/team/run' || url.pathname === '/api/team/refresh') {
      if (teamBusy) return send(409, { error: 'A team is already working. Wait for its result.' });
      teamBusy = true;
      try { return send(200, url.pathname === '/api/team/run' ? await runTeam(airlock, body) : await refreshAffected(airlock, body)); } finally { teamBusy = false; }
    }
    if (url.pathname === '/api/benchmark') {
      if (benchmarkBusy) return send(409, { error: 'The comparison is already running.' });
      benchmarkBusy = true;
      const namespace = `benchmark-${Date.now()}-${(await import('node:crypto')).randomBytes(4).toString('hex')}`;
      try { return send(200, await benchmark(async name => FalkorStore.connect(process.env.FALKORDB_URL!, `${namespace}-${name}`))); }
      finally { benchmarkBusy = false; }
    }
    if (url.pathname === '/api/ai') {
      if (typeof body.question !== 'string' || !body.question.trim() || body.question.length > 2000) return send(400, { error: 'Ask a question of 1–2000 characters.' });
      return send(200, await explainWithAI(airlock, body.question));
    }
    return send(404, { error: 'Not found.' });
  } catch (error) {
    if (error instanceof ZodError) return send(422, { error: error.issues.map(i => i.message).join(' ') });
    const e = error as Error & { status?: number };
    if (!e.status) console.error('Request failed:', e.name);
    return send(e.status || 500, { error: e.status ? e.message : 'The operation failed. Your last committed memory remains available. Check the local server for details.' });
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Memory Airlock: http://localhost:${port} | backend=${mode} | AI=${process.env.AIRLOCK_ENABLE_AI === 'true' ? 'configured' : 'off'}`));
async function shutdown() { server.close(); await store.close?.(); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
