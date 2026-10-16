import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { benchmark } from './benchmark.ts';
import { FalkorStore, LocalStore } from './store.ts';

const mode = process.env.MEMORY_STORE || 'local';
if (!['local', 'falkordb'].includes(mode)) throw new Error('Choose local or falkordb for MEMORY_STORE.');
if (mode === 'falkordb' && !process.env.FALKORDB_URL) throw new Error('FALKORDB_URL is required; there is no local fallback.');
const namespace = `benchmark-${randomUUID().slice(0, 12)}`;
const result = await benchmark(async name => mode === 'falkordb' ? FalkorStore.connect(process.env.FALKORDB_URL!, `${namespace}-${name}`) : new LocalStore());
const folder = resolve('artifacts');
await mkdir(folder, { recursive: true });
await writeFile(resolve(folder, 'benchmark-results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ backend: result.backend, passed: result.passed, cases: result.cases, durationMs: result.durationMs, methods: result.methods, saved: 'artifacts/benchmark-results.json' }, null, 2));
if (result.passed !== result.cases) process.exitCode = 1;
