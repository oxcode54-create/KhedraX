import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentTypeDescriptor, ModuleDescriptor, RegistrySnapshot } from './types.ts';

export async function getRegistrySnapshot(rootDir: string): Promise<RegistrySnapshot> {
  const agentTypesDir = path.join(rootDir, 'agentTypes');
  const modulesDir = path.join(rootDir, 'modules');

  const agentTypes: Record<string, AgentTypeDescriptor> = {};
  const modules: Record<string, ModuleDescriptor> = {};

  const [agentTypeEntries, moduleEntries] = await Promise.all([
    listDirectories(agentTypesDir),
    listDirectories(modulesDir),
  ]);

  for (const entry of agentTypeEntries) {
    const descriptorPath = path.join(agentTypesDir, entry, 'agentType.json');
    try {
      const content = JSON.parse(await fs.readFile(descriptorPath, 'utf8')) as AgentTypeDescriptor;
      agentTypes[entry] = {
        ...content,
        name: entry,
        defaultModules: content.defaultModules ?? [],
      };
    } catch {
      console.warn(`Skipping malformed agent type: ${entry}`);
    }
  }

  for (const entry of moduleEntries) {
    const descriptorPath = path.join(modulesDir, entry, 'module.json');
    try {
      const content = JSON.parse(await fs.readFile(descriptorPath, 'utf8')) as ModuleDescriptor;
      modules[entry] = {
        ...content,
        name: entry,
        path: path.join(modulesDir, entry),
      };
    } catch {
      console.warn(`Skipping malformed module: ${entry}`);
    }
  }

  return { agentTypes, modules };
}

async function listDirectories(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function getAgentTypeDescriptor(rootDir: string, typeName: string): Promise<AgentTypeDescriptor | undefined> {
  const snapshot = await getRegistrySnapshot(rootDir);
  return snapshot.agentTypes[typeName];
}
