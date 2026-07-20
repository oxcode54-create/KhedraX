export interface ExclusivityEntry {
  moduleName: string;
  section: string;
  exclusive: boolean;
}

export function detectExclusiveConflicts(entries: ExclusivityEntry[]): string | null {
  const bySection = new Map<string, ExclusivityEntry[]>();

  for (const entry of entries) {
    const group = bySection.get(entry.section) ?? [];
    group.push(entry);
    bySection.set(entry.section, group);
  }

  for (const [section, group] of bySection.entries()) {
    const exclusive = group.filter((entry) => entry.exclusive);
    if (exclusive.length > 1) {
      const moduleNames = exclusive.map((entry) => entry.moduleName).sort();
      return `Prompt composition conflict: modules "${moduleNames.join('", "')}" both claim exclusive ownership of section "${section}".`;
    }
  }

  return null;
}
