export interface CollisionCandidate<T> {
  name: string;
  descriptor: T;
  sourceRoot: string;
}

export interface CollisionWarning {
  name: string;
  winningRoot: string;
  shadowedRoot: string;
}

export interface ResolvedRegistry<T> {
  entries: Record<string, T>;
  warnings: CollisionWarning[];
}

export function resolveCollisions<T>(candidatesInScanOrder: CollisionCandidate<T>[]): ResolvedRegistry<T> {
  const entries: Record<string, T> = {};
  const warnings: CollisionWarning[] = [];
  const rootsByName: Record<string, string> = {};

  for (const candidate of candidatesInScanOrder) {
    if (rootsByName[candidate.name]) {
      warnings.push({
        name: candidate.name,
        winningRoot: rootsByName[candidate.name],
        shadowedRoot: candidate.sourceRoot,
      });
      continue;
    }

    rootsByName[candidate.name] = candidate.sourceRoot;
    entries[candidate.name] = candidate.descriptor;
  }

  return { entries, warnings };
}
