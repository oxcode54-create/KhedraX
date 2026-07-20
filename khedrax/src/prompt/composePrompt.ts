import fs from 'node:fs/promises';
import path from 'node:path';
import type { FragmentMeta, ModuleFragment, ComposedPrompt } from './types.ts';
import { readFragmentMeta } from './readFragmentMeta.ts';
import { detectExclusiveConflicts } from './detectExclusiveConflicts.ts';

export async function composePrompt(
  tempDir: string,
  resolvedModules: string[],
  behavioralProfile: { tone: string; traits: string[]; constraints: string[]; capabilities: Array<{ moduleName: string; description: string }>; escalationPolicy?: string },
): Promise<ComposedPrompt> {
  const fragments: ModuleFragment[] = [];
  for (const moduleName of resolvedModules) {
    const moduleDir = path.join(tempDir, 'prompts', moduleName);
    try {
      const content = await fs.readFile(path.join(moduleDir, 'fragment.md'), 'utf8');
      const meta: FragmentMeta = await readFragmentMeta(moduleDir);
      fragments.push({ moduleName, content, meta });
    } catch {
      // ignore missing fragments
    }
  }

  const sections: Array<{ name: string; content: string }> = [];

  const identityLines: string[] = [];
  identityLines.push(`Tone: ${behavioralProfile.tone}`);
  if (Array.isArray(behavioralProfile.traits) && behavioralProfile.traits.length > 0) {
    identityLines.push(`Traits: ${behavioralProfile.traits.join(', ')}`);
  }
  if (identityLines.length > 0) {
    sections.push({ name: 'Identity', content: identityLines.join('\n') });
  }

  if (Array.isArray(behavioralProfile.constraints) && behavioralProfile.constraints.length > 0) {
    sections.push({
      name: 'Constraints',
      content: behavioralProfile.constraints.map((constraint) => `- ${constraint}`).join('\n'),
    });
  }

  if (Array.isArray(behavioralProfile.capabilities) && behavioralProfile.capabilities.length > 0) {
    sections.push({
      name: 'Capabilities',
      content: behavioralProfile.capabilities.map((capability) => `- (${capability.moduleName}) ${capability.description}`).join('\n'),
    });
  }

  if (fragments.length > 0) {
    const fragmentsBySection = new Map<string, ModuleFragment[]>();
    for (const fragment of fragments) {
      const section = fragment.meta.section;
      const group = fragmentsBySection.get(section) ?? [];
      group.push(fragment);
      fragmentsBySection.set(section, group);
    }

    const instructionsGroups = Array.from(fragmentsBySection.entries()).sort(([leftSection], [rightSection]) => {
      if (leftSection === 'instructions') {
        return -1;
      }
      if (rightSection === 'instructions') {
        return 1;
      }
      return leftSection.localeCompare(rightSection);
    });

    const instructionLines: string[] = [];
    for (const [section, group] of instructionsGroups) {
      const conflictMessage = detectExclusiveConflicts(group.map((fragment) => ({
        moduleName: fragment.moduleName,
        section,
        exclusive: fragment.meta.exclusive,
      })));
      if (conflictMessage) {
        throw new Error(conflictMessage);
      }

      const exclusive = group.filter((fragment) => fragment.meta.exclusive);
      const included = exclusive.length === 1
        ? [exclusive[0]]
        : [...group].sort((a, b) => {
          if (b.meta.priority !== a.meta.priority) {
            return b.meta.priority - a.meta.priority;
          }
          return a.moduleName.localeCompare(b.moduleName);
        });

      if (section !== 'instructions') {
        instructionLines.push(`### ${section}`);
      }
      for (const fragment of included) {
        instructionLines.push(`#### ${fragment.moduleName}`);
        instructionLines.push(fragment.content);
      }
    }

    if (instructionLines.length > 0) {
      sections.push({ name: 'Instructions', content: instructionLines.join('\n') });
    }
  }

  if (behavioralProfile.escalationPolicy) {
    sections.push({ name: 'Escalation', content: behavioralProfile.escalationPolicy });
  }

  const markdown = sections.map((section) => `## ${section.name}\n${section.content}`).join('\n\n');

  return { sections, markdown };
}
