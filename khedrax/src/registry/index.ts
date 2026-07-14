import type { RegistrySnapshot } from './types.ts';
import { listAgentTypes } from './agentTypeRegistry.ts';
import { listModules } from './moduleRegistry.ts';
import { listPersonas } from './personaRegistry.ts';

export async function getRegistrySnapshot(rootDir: string): Promise<RegistrySnapshot> {
  const [agentTypes, modules, personas] = await Promise.all([listAgentTypes(rootDir), listModules(rootDir), listPersonas(rootDir)]);
  return { agentTypes, modules, personas };
}
