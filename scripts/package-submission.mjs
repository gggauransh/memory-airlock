import { readdir, readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..'), target = resolve(root, 'artifacts/submission/source');
const directories = ['src', 'tests', 'public', 'agent', 'docs'];
const roots = ['README.md', 'CONTRIBUTIONS.md', 'AGENTS.md', 'CLAUDE.md', 'compose.yaml', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', '.env.example', '.gitignore'];
const files = [...roots, 'scripts/package-submission.mjs'];
for (const folder of directories) {
  for (const entry of await readdir(resolve(root, folder), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = relative(root, resolve(entry.parentPath, entry.name)).replaceAll('\\', '/');
    if (/\.(mp4|webm|wav)$/.test(path)) continue;
    files.push(path);
  }
}
const env = await readFile(resolve(root, '.env'), 'utf8').catch(() => '');
const secrets = env.split(/\r?\n/).filter(line => /^(AI_GATEWAY_API_KEY|FALKORDB_URL|FALKORDB_TEST_URL)=/.test(line)).map(line => line.slice(line.indexOf('=') + 1).trim()).filter(v => v.length > 12);
for (const path of files) {
  if (path !== '.env.example' && /(^|\/)\.env/.test(path)) throw Error('Environment file in public package.');
  const bytes = await readFile(resolve(root, path));
  if (secrets.some(secret => bytes.includes(Buffer.from(secret)))) throw Error('Configured secret found in public file: ' + path);
  await mkdir(dirname(resolve(target, path)), { recursive: true });
  await copyFile(resolve(root, path), resolve(target, path));
}
await writeFile(resolve(root, 'artifacts/submission/manifest.json'), JSON.stringify({ files: files.sort(), count: files.length, secretsChecked: true }, null, 2));
console.log(`Prepared ${files.length} files with configured-secret scan. Excluded .env, credentials, data, Git internals, screenshots and local services.`);
