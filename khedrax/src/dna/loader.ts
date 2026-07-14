import fs from 'node:fs/promises';
import path from 'node:path';
import { getDefaultDNA } from './defaults.ts';
import type { AgentDNA, CreateAgentOptions } from './schema.ts';
import type { RegistrySnapshot } from '../registry/types.ts';
import type { ValidationResult } from '../validation/validateDna.ts';
import { validateAgentDNA } from '../validation/validateDna.ts';

export async function buildAgentDNA(options: CreateAgentOptions, registry: RegistrySnapshot): Promise<AgentDNA> {
  const base = getDefaultDNA(options.name, options.type) as AgentDNA;
  const mergedModules = new Set<string>(base.modules);
  for (const agentType of Object.values(registry.agentTypes)) {
    if (agentType.name === options.type) {
      for (const moduleName of agentType.defaultModules) {
        mergedModules.add(moduleName);
      }
    }
  }
  if (options.modules.length > 0) {
    for (const moduleName of options.modules) {
      mergedModules.add(moduleName);
    }
  }
  const dna: AgentDNA = {
    ...base,
    modules: Array.from(mergedModules),
    memory: base.memory ?? {},
  };
  return dna;
}

export async function writeAgentSpec(tempDir: string, dna: AgentDNA): Promise<void> {
  const content = [
    `buildId: ${dna.buildId}`,
    `name: ${dna.name}`,
    `description: ${dna.description ?? ''}`,
    'agent:',
    `  type: ${dna.agent.type}`,
    `  version: ${dna.agent.version}`,
    'persona: {}',
    `modules: ${dna.modules.join(', ')}`,
    'memory: {}',
    'tools: {}',
    'workflows: {}',
    'deployment: {}',
    'testing: {}',
  ].join('\n');
  await fs.mkdir(path.join(tempDir, 'configuration'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'agent.yaml'), content);
}

export { validateAgentDNA } from '../validation/validateDna.ts';
