import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgentDNA } from '../../src/dna/loader.ts';
import { getRegistrySnapshot } from '../../src/registry/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

test('Validation reports a warning for memory-required modules without memory config', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = {
    buildId: '1',
    name: 'SupportBot',
    description: 'desc',
    agent: { type: 'customer-support', version: '1.0.0' },
    persona: {},
    modules: ['memory'],
    memory: {},
    tools: {},
    workflows: {},
    deployment: {},
    testing: {},
  };

  const result = validateAgentDNA(dna, registry);
  assert.equal(result.valid, true);
  assert.match(result.warnings.join('\n'), /memory/i);
});

test('Validation rejects duplicate modules in the requested list', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = {
    buildId: '1',
    name: 'SupportBot',
    description: 'desc',
    agent: { type: 'customer-support', version: '1.0.0' },
    persona: {},
    modules: ['memory', 'memory'],
    memory: {},
    tools: {},
    workflows: {},
    deployment: {},
    testing: {},
  };

  const result = validateAgentDNA(dna, registry);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /Duplicate module\(s\) in modules list: memory\./);
});

test('Validation rejects exclusive prompt conflicts before generation starts', async () => {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-validation-'));
  await fs.mkdir(path.join(fixtureRoot, 'agentTypes', 'basic'), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, 'modules', 'conflict-a', 'prompts'), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, 'modules', 'conflict-b', 'prompts'), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, 'agentTypes', 'basic', 'agentType.json'), JSON.stringify({ name: 'basic', version: '1.0.0', defaultModules: [] }, null, 2));
  await fs.writeFile(path.join(fixtureRoot, 'modules', 'conflict-a', 'module.json'), JSON.stringify({ name: 'conflict-a', version: '1.0.0', path: path.join(fixtureRoot, 'modules', 'conflict-a') }, null, 2));
  await fs.writeFile(path.join(fixtureRoot, 'modules', 'conflict-b', 'module.json'), JSON.stringify({ name: 'conflict-b', version: '1.0.0', path: path.join(fixtureRoot, 'modules', 'conflict-b') }, null, 2));
  await fs.writeFile(path.join(fixtureRoot, 'modules', 'conflict-a', 'prompts', 'fragment.meta.json'), JSON.stringify({ section: 'custom', exclusive: true }, null, 2));
  await fs.writeFile(path.join(fixtureRoot, 'modules', 'conflict-b', 'prompts', 'fragment.meta.json'), JSON.stringify({ section: 'custom', exclusive: true }, null, 2));

  const registry = await getRegistrySnapshot(fixtureRoot);
  const dna = {
    buildId: '1',
    name: 'SupportBot',
    description: 'desc',
    agent: { type: 'basic', version: '1.0.0' },
    persona: {},
    modules: ['conflict-a', 'conflict-b'],
    memory: {},
    tools: {},
    workflows: {},
    deployment: {},
    testing: {},
  };

  const result = validateAgentDNA(dna, registry);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /Prompt composition conflict: modules "conflict-a", "conflict-b" both claim exclusive ownership of section "custom"\./);
});
