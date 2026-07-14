import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export async function loadCheckpoint(buildId: string): Promise<any> {
  const checkpointPath = path.join(os.homedir(), '.khedrax', 'checkpoints', `${buildId}.json`);
  try {
    return JSON.parse(await fs.readFile(checkpointPath, 'utf8'));
  } catch {
    return null;
  }
}

export async function saveCheckpoint(buildId: string, state: Record<string, unknown>): Promise<void> {
  const checkpointPath = path.join(os.homedir(), '.khedrax', 'checkpoints', `${buildId}.json`);
  await fs.mkdir(path.dirname(checkpointPath), { recursive: true });
  await fs.writeFile(checkpointPath, JSON.stringify(state, null, 2));
}
