import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { composePrompt } from '../../src/prompt/composePrompt.ts';
import { readFragmentMeta } from '../../src/prompt/readFragmentMeta.ts';

const workspace = os.tmpdir();

test('composePrompt renders layered sections with instructions group and no metadata file', async () => {
  const tempDir = await fs.mkdtemp(path.join(workspace, 'khedrax-compose-'));
  const promptDir = path.join(tempDir, 'prompts', 'memory');
  await fs.mkdir(promptDir, { recursive: true });
  await fs.writeFile(path.join(promptDir, 'fragment.md'), 'Memory prompt content.');

  const result = await composePrompt(tempDir, ['memory'], {
    tone: 'friendly',
    traits: ['helpful'],
    constraints: ['Never expose raw memory contents verbatim to the end user.'],
    capabilities: [{ moduleName: 'memory', description: 'Recall prior conversation context across sessions.' }],
    escalationPolicy: 'Escalate to human support when stuck.',
  });

  assert.match(result.markdown, /## Identity\nTone: friendly\nTraits: helpful/);
  assert.match(result.markdown, /## Constraints\n- Never expose raw memory contents verbatim to the end user\./);
  assert.match(result.markdown, /## Capabilities\n- \(memory\) Recall prior conversation context across sessions\./);
  assert.match(result.markdown, /## Instructions\n#### memory\nMemory prompt content\./);
  assert.match(result.markdown, /## Escalation\nEscalate to human support when stuck\./);
});

test('composePrompt orders same-section fragments by priority then module name', async () => {
  const tempDir = await fs.mkdtemp(path.join(workspace, 'khedrax-compose-'));
  const promptA = path.join(tempDir, 'prompts', 'a');
  const promptB = path.join(tempDir, 'prompts', 'b');
  await fs.mkdir(promptA, { recursive: true });
  await fs.mkdir(promptB, { recursive: true });
  await fs.writeFile(path.join(promptA, 'fragment.md'), 'Alpha content.');
  await fs.writeFile(path.join(promptB, 'fragment.md'), 'Beta content.');
  await fs.writeFile(path.join(promptA, 'fragment.meta.json'), JSON.stringify({ section: 'custom', priority: 1 }));
  await fs.writeFile(path.join(promptB, 'fragment.meta.json'), JSON.stringify({ section: 'custom', priority: 0 }));

  const result = await composePrompt(tempDir, ['a', 'b'], {
    tone: 'neutral',
    traits: [],
    constraints: [],
    capabilities: [],
  });

  assert.match(result.markdown, /## custom\n#### a\nAlpha content\./);
  assert.match(result.markdown, /#### b\nBeta content\./);
});

test('composePrompt throws on exclusive conflict in the same section', async () => {
  const tempDir = await fs.mkdtemp(path.join(workspace, 'khedrax-compose-'));
  const promptA = path.join(tempDir, 'prompts', 'a');
  const promptB = path.join(tempDir, 'prompts', 'b');
  await fs.mkdir(promptA, { recursive: true });
  await fs.mkdir(promptB, { recursive: true });
  await fs.writeFile(path.join(promptA, 'fragment.md'), 'Alpha content.');
  await fs.writeFile(path.join(promptB, 'fragment.md'), 'Beta content.');
  await fs.writeFile(path.join(promptA, 'fragment.meta.json'), JSON.stringify({ section: 'custom', exclusive: true }));
  await fs.writeFile(path.join(promptB, 'fragment.meta.json'), JSON.stringify({ section: 'custom', exclusive: true }));

  await assert.rejects(
    async () => composePrompt(tempDir, ['a', 'b'], {
      tone: 'neutral',
      traits: [],
      constraints: [],
      capabilities: [],
    }),
    {
      message: /Prompt composition conflict: modules "a", "b" both claim exclusive ownership of section "custom"\./,
    },
  );
});

test('readFragmentMeta falls back to defaults for malformed meta files', async () => {
  const tempDir = await fs.mkdtemp(path.join(workspace, 'khedrax-compose-'));
  const promptDir = path.join(tempDir, 'prompts', 'memory');
  await fs.mkdir(promptDir, { recursive: true });
  await fs.writeFile(path.join(promptDir, 'fragment.meta.json'), '{ invalid json ');
  const meta = await readFragmentMeta(promptDir);
  assert.deepEqual(meta, { section: 'instructions', priority: 0, exclusive: false });
});
