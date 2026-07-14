import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAgentDNA } from '../../src/dna/loader.ts';
import { getRegistrySnapshot } from '../../src/registry/agentTypeRegistry.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
