import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRegistrySnapshot } from '../../src/registry/agentTypeRegistry.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

test('Registry discovery includes built-in agent types and modules, while skipping malformed entries', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  assert.ok(registry.agentTypes['customer-support']);
  assert.ok(registry.modules.memory);
  assert.ok(!registry.agentTypes['bad-entry']);
});
