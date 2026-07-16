import fs from 'node:fs/promises';
import path from 'node:path';
import type { MemoryBackendDescriptor } from './types.ts';

export async function listMemoryBackends(rootDir: string): Promise<Record<string, MemoryBackendDescriptor>> {
  const memoryBackendsDir = path.join(rootDir, 'memoryBackends');
  const memoryBackends: Record<string, MemoryBackendDescriptor> = {};
  const entries = await listDirectories(memoryBackendsDir);

  for (const entry of entries) {
    const descriptorPath = path.join(memoryBackendsDir, entry, 'backend.json');
    try {
      const content = JSON.parse(await fs.readFile(descriptorPath, 'utf8')) as MemoryBackendDescriptor;
      memoryBackends[entry] = {
        ...content,
        name: entry,
        configDefaults: content.configDefaults ?? {},
      };
    } catch {
      console.warn(`Skipping malformed memory backend: ${entry}`);
    }
  }

  return memoryBackends;
}

async function listDirectories(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}
