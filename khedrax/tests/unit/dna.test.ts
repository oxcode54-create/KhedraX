import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentDNA, validateAgentDNA } from '../../src/dna/loader.ts';
import { getRegistrySnapshot } from '../../src/registry/agentTypeRegistry.ts';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

test('DNA validation accepts a valid name and known agent type', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = await buildAgentDNA({
    name: 'SupportBot',
    type: 'customer-support',
    outputDir: '/tmp/khedrax-out',
    modules: [],
    force: false,
    verbose: false,
    resume: undefined,
  }, registry);

  const result = validateAgentDNA(dna, registry);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('DNA validation rejects invalid names and unknown types', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const invalidName = await buildAgentDNA({
    name: 'test',
    type: 'customer-support',
    outputDir: '/tmp/khedrax-out',
    modules: [],
    force: false,
    verbose: false,
    resume: undefined,
  }, registry);
  const invalidType = await buildAgentDNA({
    name: 'SupportBot',
    type: 'missing-type',
    outputDir: '/tmp/khedrax-out',
    modules: [],
    force: false,
    verbose: false,
    resume: undefined,
  }, registry);

  assert.equal(validateAgentDNA(invalidName, registry).valid, false);
  assert.match(validateAgentDNA(invalidName, registry).errors.join('\n'), /reserved|name/i);
  assert.equal(validateAgentDNA(invalidType, registry).valid, false);
  assert.match(validateAgentDNA(invalidType, registry).errors.join('\n'), /type/i);
});
