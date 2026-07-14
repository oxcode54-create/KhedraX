import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GenerationEngine } from '../../src/generation/generationEngine.ts';
import { getRegistrySnapshot } from '../../src/registry/agentTypeRegistry.ts';
import { buildAgentDNA } from '../../src/dna/loader.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

test('Generation engine wires all producer engines in the required order', async () => {
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
  const engine = new GenerationEngine();
  const order = engine.getProducerOrder();
  assert.deepEqual(order, ['template', 'module', 'persona', 'prompt', 'memory', 'documentation']);

  const context = {
    dna,
    registry,
    tempDir: '/tmp/khedrax-temp',
    artifacts: {},
  };
  const result = await engine.run(context);
  assert.equal(result.outputPath.includes('SupportBot'), true);
});
