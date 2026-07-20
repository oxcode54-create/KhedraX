import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { composePrompt } from '../../src/prompt/composePrompt.ts';
import { detectExclusiveConflicts } from '../../src/prompt/detectExclusiveConflicts.ts';

test('detectExclusiveConflicts returns null for non-conflicting entries', () => {
  assert.equal(detectExclusiveConflicts([]), null);
  assert.equal(detectExclusiveConflicts([{ moduleName: 'a', section: 'custom', exclusive: false }]), null);
});

test('detectExclusiveConflicts returns the same message as composePrompt for an exclusive conflict', async () => {
  const expected = 'Prompt composition conflict: modules "a", "b" both claim exclusive ownership of section "custom".';
  assert.equal(detectExclusiveConflicts([{ moduleName: 'a', section: 'custom', exclusive: true }, { moduleName: 'b', section: 'custom', exclusive: true }]), expected);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-exclusive-'));
  const promptA = path.join(tempDir, 'prompts', 'a');
  const promptB = path.join(tempDir, 'prompts', 'b');
  await fs.mkdir(promptA, { recursive: true });
  await fs.mkdir(promptB, { recursive: true });
  await fs.writeFile(path.join(promptA, 'fragment.md'), 'Alpha content.');
  await fs.writeFile(path.join(promptB, 'fragment.md'), 'Beta content.');
  await fs.writeFile(path.join(promptA, 'fragment.meta.json'), JSON.stringify({ section: 'custom', exclusive: true }));
  await fs.writeFile(path.join(promptB, 'fragment.meta.json'), JSON.stringify({ section: 'custom', exclusive: true }));

  let thrown: string | null = null;
  try {
    await composePrompt(tempDir, ['a', 'b'], {
      tone: 'neutral',
      traits: [],
      constraints: [],
      capabilities: [],
    });
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error);
  }

  assert.equal(thrown, expected);
});
