import fs from 'node:fs/promises';
import path from 'node:path';
import type { MemoryBackendDescriptor } from './types.ts';
import { resolveCollisions } from './collisionPolicy.ts';

export async function listMemoryBackends(rootDir: string, pluginRoots: string[] = []): Promise<Record<string, MemoryBackendDescriptor>> {
  const candidateRoots = [path.resolve(rootDir), ...pluginRoots.map((pluginRoot) => path.resolve(pluginRoot))];
  const candidates: Array<{ name: string; descriptor: MemoryBackendDescriptor; sourceRoot: string }> = [];

  for (const candidateRoot of candidateRoots) {
    const memoryBackendsDir = path.join(candidateRoot, 'memoryBackends');
    const entries = await listDirectories(memoryBackendsDir);

    for (const entry of entries) {
      const descriptorPath = path.join(memoryBackendsDir, entry, 'backend.json');
      try {
        const content = JSON.parse(await fs.readFile(descriptorPath, 'utf8')) as MemoryBackendDescriptor;
        candidates.push({
          name: entry,
          descriptor: {
            ...content,
            name: entry,
            configDefaults: content.configDefaults ?? {},
          },
          sourceRoot: candidateRoot,
        });
      } catch {
        console.warn(`Skipping malformed memory backend: ${entry}`);
      }
    }
  }

  const resolved = resolveCollisions(candidates);
  for (const warning of resolved.warnings) {
    console.warn(`Collision for memory backend "${warning.name}": using ${warning.winningRoot} over ${warning.shadowedRoot}`);
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
