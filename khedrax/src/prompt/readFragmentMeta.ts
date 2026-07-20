import fs from 'node:fs/promises';
import path from 'node:path';
import type { FragmentMeta } from './types.ts';
import { parseFragmentMeta } from './fragmentMetaDefaults.ts';

const DEFAULT_META: FragmentMeta = {
  section: 'instructions',
  priority: 0,
  exclusive: false,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function readFragmentMeta(moduleDir: string): Promise<FragmentMeta> {
  const metaPath = path.join(moduleDir, 'fragment.meta.json');
  try {
    const raw = await fs.readFile(metaPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) {
      console.warn(`Invalid fragment.meta.json for module at ${moduleDir}: expected an object.`);
      return DEFAULT_META;
    }

    const meta = parseFragmentMeta(parsed);

    if (typeof parsed.section !== 'undefined' && (typeof parsed.section !== 'string' || parsed.section.trim().length === 0)) {
      console.warn(`Invalid section in fragment.meta.json for module at ${moduleDir}; falling back to default '${DEFAULT_META.section}'.`);
    }
    if (typeof parsed.priority !== 'undefined' && !Number.isFinite(parsed.priority as number)) {
      console.warn(`Invalid priority in fragment.meta.json for module at ${moduleDir}; falling back to default ${DEFAULT_META.priority}.`);
    }
    if (typeof parsed.exclusive !== 'undefined' && typeof parsed.exclusive !== 'boolean') {
      console.warn(`Invalid exclusive flag in fragment.meta.json for module at ${moduleDir}; falling back to default ${DEFAULT_META.exclusive}.`);
    }

    return meta;
  } catch {
    return DEFAULT_META;
  }
}
