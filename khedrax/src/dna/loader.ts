import { getDefaultDNA } from './defaults.ts';
import type { AgentDNA, CreateAgentOptions } from './schema.ts';
import type { RegistrySnapshot } from '../registry/types.ts';

export async function buildAgentDNA(options: CreateAgentOptions, registry: RegistrySnapshot): Promise<AgentDNA> {
  const base = getDefaultDNA(options.name, options.type) as unknown as AgentDNA;
  const mergedModules = new Set<string>(base.modules);
  const persona = { ...base.persona };

  for (const agentType of Object.values(registry.agentTypes)) {
    if (agentType.name === options.type) {
      for (const moduleName of agentType.defaultModules) {
        mergedModules.add(moduleName);
      }
      if (agentType.persona?.presetName && !persona.presetName) {
        persona.presetName = agentType.persona.presetName;
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
    persona,
    memory: base.memory ?? {},
  };
  return dna;
}

export { validateAgentDNA } from '../validation/validateDna.ts';
