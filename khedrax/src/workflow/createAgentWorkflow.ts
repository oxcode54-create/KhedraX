import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildAgentDNA } from '../dna/loader.ts';
import { getRegistrySnapshot } from '../registry/agentTypeRegistry.ts';
import { GenerationEngine } from '../generation/generationEngine.ts';
import { runWorkflow } from './runner.ts';
import type { WorkflowStep, Checkpoint } from './runner.ts';

export function createAgentWorkflow(): WorkflowStep {
  return {
    name: 'create-agent',
    async fn(checkpoint: Checkpoint) {
      const registry = await getRegistrySnapshot(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..'));
      const dna = await buildAgentDNA({
        name: 'SupportBot',
        type: 'customer-support',
        outputDir: path.join(os.tmpdir(), 'khedrax-e2e'),
        modules: [],
        force: true,
        verbose: false,
      }, registry);
      const engine = new GenerationEngine();
      const tempDir = path.join(os.tmpdir(), `khedrax-${dna.buildId}`);
      const result = await engine.run({ dna, registry, tempDir, artifacts: checkpoint.artifacts });
      return { artifacts: { generatedProjectPath: result.outputPath } };
    },
  };
}
