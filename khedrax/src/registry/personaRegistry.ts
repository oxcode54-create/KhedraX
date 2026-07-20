import fs from 'node:fs/promises';
import path from 'node:path';
import type { PersonaDescriptor } from './types.ts';
import { resolveCollisions } from './collisionPolicy.ts';

export async function listPersonas(rootDir: string, pluginRoots: string[] = []): Promise<Record<string, PersonaDescriptor>> {
  const candidateRoots = [path.resolve(rootDir), ...pluginRoots.map((pluginRoot) => path.resolve(pluginRoot))];
  const candidates: Array<{ name: string; descriptor: PersonaDescriptor; sourceRoot: string }> = [];

  for (const candidateRoot of candidateRoots) {
    const personasDir = path.join(candidateRoot, 'personas');
    const entries = await listDirectories(personasDir);

    for (const entry of entries) {
      const descriptorPath = path.join(personasDir, entry, 'persona.json');
      try {
        const content = JSON.parse(await fs.readFile(descriptorPath, 'utf8')) as PersonaDescriptor;
        candidates.push({
          name: entry,
          descriptor: {
            ...content,
            name: entry,
            traits: content.traits ?? [],
            constraints: content.constraints ?? [],
          },
          sourceRoot: candidateRoot,
        });
      } catch {
        console.warn(`Skipping malformed persona: ${entry}`);
      }
    }
  }

  const resolved = resolveCollisions(candidates);
  for (const warning of resolved.warnings) {
    console.warn(`Collision for persona "${warning.name}": using ${warning.winningRoot} over ${warning.shadowedRoot}`);
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
