import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MemoryEngine } from '../../src/engines/memoryEngine.ts';
import { validateAgentDNA } from '../../src/validation/validateDna.ts';
import { getRegistrySnapshot } from '../../src/registry/index.ts';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

const workspace = os.tmpdir();

test('memory engine resolves the default in-memory backend and merges config', async () => {
  const tempDir = await fs.mkdtemp(path.join(workspace, 'khedrax-memory-default-'));
  const registry = await getRegistrySnapshot(khedraxRoot);
  const engine = new MemoryEngine();

  await engine.run({
    dna: {
      buildId: 'build-test',
      name: 'Agent',
      description: 'Agent',
      agent: { type: 'basic', version: '1.0.0' },
      persona: {},
      modules: [],
      memory: {},
      tools: {},
      workflows: {},
      deployment: {},
      testing: {},
    } as any,
    registry,
    tempDir,
    artifacts: { module: { resolvedModuleDescriptors: [] } },
  });

  const config = JSON.parse(await fs.readFile(path.join(tempDir, 'memory', 'config.json'), 'utf8'));
  assert.deepEqual(config, { backend: 'in-memory', config: { maxEntries: 1000 } });

  const readme = await fs.readFile(path.join(tempDir, 'memory', 'README.md'), 'utf8');
  assert.match(readme, /Backend: in-memory/);
  assert.match(readme, /"maxEntries": 1000/);
  assert.doesNotMatch(readme, /Required by modules:/);
});

test('memory engine merges overrides and reports required modules', async () => {
  const tempDir = await fs.mkdtemp(path.join(workspace, 'khedrax-memory-merged-'));
  const registry = await getRegistrySnapshot(khedraxRoot);
  const engine = new MemoryEngine();

  await engine.run({
    dna: {
      buildId: 'build-test',
      name: 'Agent',
      description: 'Agent',
      agent: { type: 'basic', version: '1.0.0' },
      persona: {},
      modules: ['memory'],
      memory: { backend: 'redis', config: { port: 6380 } },
      tools: {},
      workflows: {},
      deployment: {},
      testing: {},
    } as any,
    registry,
    tempDir,
    artifacts: { module: { resolvedModuleDescriptors: [{ name: 'memory', requiresMemory: true }] } },
  });

  const config = JSON.parse(await fs.readFile(path.join(tempDir, 'memory', 'config.json'), 'utf8'));
  assert.deepEqual(config, {
    backend: 'redis',
    config: {
      host: 'localhost',
      port: 6380,
      ttlSeconds: 86400,
    },
  });

  const readme = await fs.readFile(path.join(tempDir, 'memory', 'README.md'), 'utf8');
  assert.match(readme, /Backend: redis/);
  assert.match(readme, /Required by modules:/);
  assert.match(readme, /- memory/);
});

test('validation rejects invalid memory backends before memory engine runs', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = {
    buildId: 'build-test',
    name: 'Agent',
    description: 'Agent',
    agent: { type: 'basic', version: '1.0.0' },
    persona: {},
    modules: ['memory'],
    memory: { backend: 'bogus' },
    tools: {},
    workflows: {},
    deployment: {},
    testing: {},
  } as any;

  const validation = validateAgentDNA(dna, registry);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes('Unknown memory backend')));
});
