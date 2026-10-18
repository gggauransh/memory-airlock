import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

for (const selectedMode of [undefined, 'local']) {
  test(`application cannot silently start without FalkorDB (${selectedMode ?? 'default'} mode)`, () => {
    const localFile = join(tmpdir(), `airlock-config-test-${randomUUID()}.jsonl`);
    const env: NodeJS.ProcessEnv = { ...process.env, PORT: '0', AIRLOCK_LOCAL_FILE: localFile, AIRLOCK_ENABLE_AI: 'false' };
    delete env.FALKORDB_URL; delete env.MEMORY_STORE;
    if (selectedMode) env.MEMORY_STORE = selectedMode;
    try {
      const result = spawnSync(process.execPath, ['src/server.ts'], { env, encoding: 'utf8', timeout: 5000, windowsHide: true });
      assert.match(result.stderr, /requires FalkorDB|FALKORDB_URL is required/);
      assert.equal(result.status, 1);
      assert.ok(!result.stdout.includes('Memory Airlock:'));
    } finally { rmSync(localFile, { force: true }); }
  });
}
