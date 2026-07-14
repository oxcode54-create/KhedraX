import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createAgentWorkflow } from '../../src/workflow/createAgentWorkflow.ts';
import { getRegistrySnapshot } from '../../src/registry/agentTypeRegistry.ts';
import { buildAgentDNA } from '../../src/dna/loader.ts';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

test('create workflow generates a standalone project', async () => {
  const registry = await getRegistrySnapshot(khedraxRoot);
  const dna = await buildAgentDNA({
    name: 'SupportBot',
    type: 'customer-support',
    outputDir: path.join(os.tmpdir(), 'khedrax-e2e'),
    modules: [],
    force: true,
    verbose: false,
    resume: undefined,
  }, registry);
  const workflow = createAgentWorkflow();
  const tempDir = path.join(os.tmpdir(), 'khedrax-e2e-tmp');
  const result = await workflow.fn({ buildId: dna.buildId, completed: [], artifacts: {} } as any);
  assert.equal(result.artifacts?.generatedProjectPath ? true : false, true);
  await fs.rm(tempDir, { recursive: true, force: true });
});
