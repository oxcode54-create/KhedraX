import path from 'node:path';
import { buildAgentDNA } from '../../dna/loader.ts';
import { getRegistrySnapshot } from '../../registry/index.ts';
import { validateAgentDNA } from '../../validation/validateDna.ts';
import { GenerationEngine } from '../../generation/generationEngine.ts';
import { runWorkflow } from '../../workflow/runner.ts';
import { loadCheckpoint, saveCheckpoint } from '../../workflow/checkpoint.ts';
import type { CreateAgentOptions } from '../../dna/schema.ts';
import type { Checkpoint, WorkflowStep } from '../../workflow/runner.ts';

export interface CreateAgentRequest extends CreateAgentOptions {
  rootDir?: string;
  pluginRoots?: string[];
}

export function buildCreateAgentStep(options: CreateAgentRequest): WorkflowStep {
  return {
    name: 'create-agent',
    async fn(checkpoint) {
      const rootDir = options.rootDir ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
      const registry = await getRegistrySnapshot(rootDir, options.pluginRoots ?? []);
      const dna = await buildAgentDNA(options, registry);
      const validation = validateAgentDNA(dna, registry, options.outputDir, options.force);
      if (!validation.valid) {
        throw new Error(validation.errors.join('\n'));
      }
      const engine = new GenerationEngine();
      const tempDir = path.join(path.dirname(options.outputDir), `.khedrax-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const result = await engine.run({ dna, registry, tempDir, outputDir: options.outputDir, artifacts: checkpoint.artifacts, force: options.force, khedraxRootDir: rootDir });
      return { artifacts: { outputPath: result.outputPath, dna, validation } };
    },
  };
}

export async function createAgent(options: CreateAgentRequest): Promise<{ outputPath: string }> {
  const buildId = options.resume ?? `build-${Date.now()}`;
  const checkpoint = (await loadCheckpoint(buildId)) ?? { buildId, completed: [], artifacts: {} } satisfies Checkpoint;
  const workflow = await runWorkflow([buildCreateAgentStep(options)], checkpoint);
  await saveCheckpoint(buildId, workflow);
  const createAgentArtifacts = workflow.artifacts['create-agent'] as { outputPath?: string } | undefined;
  const outputPath = createAgentArtifacts?.outputPath;
  if (!outputPath) {
    throw new Error('Generation did not produce an output path.');
  }
  return { outputPath };
}
