import type { FragmentMeta } from './types.ts';

export function parseFragmentMeta(raw: unknown): FragmentMeta {
  const obj = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  return {
    section: typeof obj.section === 'string' && obj.section.trim().length > 0 ? obj.section.trim() : 'instructions',
    priority: typeof obj.priority === 'number' && Number.isFinite(obj.priority) ? obj.priority : 0,
    exclusive: typeof obj.exclusive === 'boolean' ? obj.exclusive : false,
  };
}
