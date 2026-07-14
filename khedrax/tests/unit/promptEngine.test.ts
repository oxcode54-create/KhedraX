import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PromptEngine } from '../../src/engines/promptEngine.ts';
import { composePrompt } from '../../src/prompt/composePrompt.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspace = os.tmpdir();

test('PromptEngine writes composed prompt README and returns composedSections', async () => {
  const tempDir = await fs.mkdtemp(path.join(workspace, 'khedrax-prompt-'));
  const promptDir = path.join(tempDir, 'prompts', 'memory');
  await fs.mkdir(promptDir, { recursive: true });
  await fs.writeFile(path.join(promptDir, 'fragment.md'), 'Memory content.');

  const engine = new PromptEngine();
  const context = {
    tempDir,
    artifacts: {
      module: { resolvedModules: ['memory'] },
      persona: { behavioralProfile: {
        tone: 'friendly',
        traits: ['helpful'],
        constraints: ['Never share secrets.'],
        capabilities: [{ moduleName: 'memory', description: 'Recall prior conversation context across sessions.' }],
        escalationPolicy: 'Escalate when stuck.',
      } },
    },
  } as any;

  const result = await engine.run(context);
  const readme = await fs.readFile(path.join(tempDir, 'prompts', 'README.md'), 'utf8');
  assert.match(readme, /## Identity/);
  assert.deepEqual(result.artifacts?.composedSections, ['Identity', 'Constraints', 'Capabilities', 'Instructions', 'Escalation']);
});

test('PromptEngine propagates exclusive conflict errors out of run()', async () => {
  const tempDir = await fs.mkdtemp(path.join(workspace, 'khedrax-prompt-'));
  const promptA = path.join(tempDir, 'prompts', 'a');
  const promptB = path.join(tempDir, 'prompts', 'b');
  await fs.mkdir(promptA, { recursive: true });
  await fs.mkdir(promptB, { recursive: true });
  await fs.writeFile(path.join(promptA, 'fragment.md'), 'Alpha.');
  await fs.writeFile(path.join(promptB, 'fragment.md'), 'Beta.');
  await fs.writeFile(path.join(promptA, 'fragment.meta.json'), JSON.stringify({ section: 'custom', exclusive: true }));
  await fs.writeFile(path.join(promptB, 'fragment.meta.json'), JSON.stringify({ section: 'custom', exclusive: true }));

  const engine = new PromptEngine();
  const context = {
    tempDir,
    artifacts: {
      module: { resolvedModules: ['a', 'b'] },
      persona: { behavioralProfile: {
        tone: 'neutral',
        traits: [],
        constraints: [],
        capabilities: [],
      } },
    },
  } as any;

  await assert.rejects(
    async () => engine.run(context),
    {
      message: /Prompt composition conflict: modules "a", "b" both claim exclusive ownership of section "custom"\./,
    },
  );
});
