import path from 'node:path';
import { buildAgentDNA } from '../../dna/loader.ts';
import { getRegistrySnapshot } from '../../registry/agentTypeRegistry.ts';
import { validateAgentDNA } from '../../validation/validateDna.ts';
import { GenerationEngine } from '../../generation/generationEngine.ts';
import type { CreateAgentOptions } from '../../dna/schema.ts';

export async function createAgent(options: CreateAgentOptions): Promise<{ outputPath: string }> {
  const registry = await getRegistrySnapshot(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..'));
  const dna = await buildAgentDNA(options, registry);
  const validation = validateAgentDNA(dna, registry);
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }
  const engine = new GenerationEngine();
  const result = await engine.run({ dna, registry, tempDir: path.join(options.outputDir, '.tmp'), artifacts: {} });
  return { outputPath: result.outputPath };
}
