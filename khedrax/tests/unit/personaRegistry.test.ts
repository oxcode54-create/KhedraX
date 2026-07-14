import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRegistrySnapshot } from '../../src/registry/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

test('persona registry discovers personas from the filesystem', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  assert.ok(registry.personas['professional-support']);
  assert.ok(registry.personas['friendly-assistant']);
});
