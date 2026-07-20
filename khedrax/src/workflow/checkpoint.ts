import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Checkpoint } from './runner.ts';

export async function loadCheckpoint(buildId: string): Promise<Checkpoint | null> {
  const checkpointPath = path.join(os.homedir(), '.khedrax', 'checkpoints', `${buildId}.json`);
  try {
    return JSON.parse(await fs.readFile(checkpointPath, 'utf8'));
  } catch {
    return null;
  }
}

export async function saveCheckpoint(buildId: string, state: Checkpoint): Promise<void> {
  const checkpointPath = path.join(os.homedir(), '.khedrax', 'checkpoints', `${buildId}.json`);
  await fs.mkdir(path.dirname(checkpointPath), { recursive: true });
  await fs.writeFile(checkpointPath, JSON.stringify(state, null, 2));
}
