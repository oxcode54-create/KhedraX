import fs from 'node:fs/promises';
import path from 'node:path';
import type { PersonaDescriptor } from './types.ts';

export async function listPersonas(rootDir: string): Promise<Record<string, PersonaDescriptor>> {
  const personasDir = path.join(rootDir, 'personas');
  const personas: Record<string, PersonaDescriptor> = {};
  const entries = await listDirectories(personasDir);

  for (const entry of entries) {
    const descriptorPath = path.join(personasDir, entry, 'persona.json');
    try {
      const content = JSON.parse(await fs.readFile(descriptorPath, 'utf8')) as PersonaDescriptor;
      personas[entry] = {
        ...content,
        name: entry,
        traits: content.traits ?? [],
        constraints: content.constraints ?? [],
      };
    } catch {
      console.warn(`Skipping malformed persona: ${entry}`);
    }
  }

  return personas;
}

async function listDirectories(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}
