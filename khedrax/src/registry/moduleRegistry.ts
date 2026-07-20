import fs from 'node:fs/promises';
import path from 'node:path';
import type { ModuleDescriptor } from './types.ts';
import { parseFragmentMeta } from '../prompt/fragmentMetaDefaults.ts';
import { resolveCollisions } from './collisionPolicy.ts';

export async function listModules(rootDir: string, pluginRoots: string[] = []): Promise<Record<string, ModuleDescriptor>> {
  const candidateRoots = [path.resolve(rootDir), ...pluginRoots.map((pluginRoot) => path.resolve(pluginRoot))];
  const candidates: Array<{ name: string; descriptor: ModuleDescriptor; sourceRoot: string }> = [];

  for (const candidateRoot of candidateRoots) {
    const modulesDir = path.join(candidateRoot, 'modules');
    const entries = await listDirectories(modulesDir);

    for (const entry of entries) {
      const descriptorPath = path.join(modulesDir, entry, 'module.json');
      try {
        const content = JSON.parse(await fs.readFile(descriptorPath, 'utf8')) as ModuleDescriptor;
        const promptsDir = path.join(modulesDir, entry, 'prompts');
        let promptSection: string | undefined;
        let promptExclusive: boolean | undefined;
        try {
          const raw = JSON.parse(await fs.readFile(path.join(promptsDir, 'fragment.meta.json'), 'utf8'));
          const meta = parseFragmentMeta(raw);
          promptSection = meta.section;
          promptExclusive = meta.exclusive;
        } catch {
          const meta = parseFragmentMeta(undefined);
          promptSection = meta.section;
          promptExclusive = meta.exclusive;
        }

        candidates.push({
          name: entry,
          descriptor: {
            ...content,
            name: entry,
            path: path.join(modulesDir, entry),
            promptSection,
            promptExclusive,
          },
          sourceRoot: candidateRoot,
        });
      } catch {
        console.warn(`Skipping malformed module: ${entry}`);
      }
    }
  }

  const resolved = resolveCollisions(candidates);
  for (const warning of resolved.warnings) {
    console.warn(`Collision for module "${warning.name}": using ${warning.winningRoot} over ${warning.shadowedRoot}`);
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
