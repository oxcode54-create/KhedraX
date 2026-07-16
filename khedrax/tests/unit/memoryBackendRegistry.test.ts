import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRegistrySnapshot } from '../../src/registry/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

test('memory backend registry discovers built-in backends and skips malformed entries', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  assert.ok(registry.memoryBackends['in-memory']);
  assert.ok(registry.memoryBackends['redis']);
  assert.ok(!registry.memoryBackends['bad-entry']);
});
