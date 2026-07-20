import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentTypeDescriptor } from './types.ts';
import { resolveCollisions } from './collisionPolicy.ts';

export async function listAgentTypes(rootDir: string, pluginRoots: string[] = []): Promise<Record<string, AgentTypeDescriptor>> {
  const candidateRoots = [path.resolve(rootDir), ...pluginRoots.map((pluginRoot) => path.resolve(pluginRoot))];
  const candidates: Array<{ name: string; descriptor: AgentTypeDescriptor; sourceRoot: string }> = [];

  for (const candidateRoot of candidateRoots) {
    const agentTypesDir = path.join(candidateRoot, 'agentTypes');
    const entries = await listDirectories(agentTypesDir);

    for (const entry of entries) {
      const descriptorPath = path.join(agentTypesDir, entry, 'agentType.json');
      try {
        const content = JSON.parse(await fs.readFile(descriptorPath, 'utf8')) as AgentTypeDescriptor;
        candidates.push({
          name: entry,
          descriptor: {
            ...content,
            name: entry,
            defaultModules: content.defaultModules ?? [],
          },
          sourceRoot: candidateRoot,
        });
      } catch {
        console.warn(`Skipping malformed agent type: ${entry}`);
      }
    }
  }

  const resolved = resolveCollisions(candidates);
  for (const warning of resolved.warnings) {
    console.warn(`Collision for agent type "${warning.name}": using ${warning.winningRoot} over ${warning.shadowedRoot}`);
  }
  return resolved.entries;
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
  const snapshot = await import('./index.ts').then((mod) => mod.getRegistrySnapshot(rootDir));
  return snapshot.agentTypes[typeName];
}
