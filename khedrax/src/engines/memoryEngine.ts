import fs from 'node:fs/promises';
import path from 'node:path';
import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';

interface ModuleDescriptorLike {
  name: string;
  requiresMemory?: boolean;
}

export class MemoryEngine implements ProducerEngine {
  name = 'memory';

  async run(context: GenerationContext): Promise<ProducerResult> {
    const memoryDir = path.join(context.tempDir, 'memory');
    await fs.mkdir(memoryDir, { recursive: true });

    const backendName = context.dna.memory.backend && context.dna.memory.backend.length > 0 ? context.dna.memory.backend : 'in-memory';
    const backendDescriptor = context.registry.memoryBackends[backendName];
    const baseConfig = backendDescriptor?.configDefaults ?? {};
    const mergedConfig = { ...baseConfig, ...(context.dna.memory.config ?? {}) };

    const moduleArtifact = context.artifacts.module as {
      resolvedModuleDescriptors?: ModuleDescriptorLike[];
    } | undefined;
    const requiredByModules = (moduleArtifact?.resolvedModuleDescriptors ?? [])
      .filter((module) => module.requiresMemory === true)
      .map((module) => module.name)
      .sort((left, right) => left.localeCompare(right));

    const configPath = path.join(memoryDir, 'config.json');
    const readmePath = path.join(memoryDir, 'README.md');
    await fs.writeFile(configPath, JSON.stringify({ backend: backendName, config: mergedConfig }, null, 2) + '\n');

    const lines = [
      '# Memory',
      '',
      `Backend: ${backendName}`,
      '',
      'Configuration:',
      '```json',
      JSON.stringify(mergedConfig, null, 2),
      '```',
    ];
    if (requiredByModules.length > 0) {
      lines.push('', 'Required by modules:', ...requiredByModules.map((moduleName) => `- ${moduleName}`));
    }
    await fs.writeFile(readmePath, `${lines.join('\n')}\n`);

    return { artifacts: { written: true } };
  }
}
