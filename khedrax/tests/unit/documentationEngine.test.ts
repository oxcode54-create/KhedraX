import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DocumentationEngine } from '../../src/engines/documentationEngine.ts';
import { createAgent } from '../../src/cli/commands/create.ts';

const workspace = os.tmpdir();

test('documentation engine renders a persona-backed single-module README and docs overview', async () => {
  const tempDir = await fs.mkdtemp(path.join(workspace, 'khedrax-docs-single-'));
  const engine = new DocumentationEngine();

  const result = await engine.run({
    dna: {
      buildId: 'build-test',
      name: 'SupportBot',
      description: 'Customer support agent.',
      agent: { type: 'customer-support', version: '1.0.0' },
      persona: { presetName: 'professional-support' },
      modules: ['memory'],
      memory: {},
      tools: {},
      workflows: {},
      deployment: {},
      testing: {},
    } as any,
    registry: { agentTypes: {}, modules: {}, personas: {} } as any,
    tempDir,
    artifacts: {
      persona: {
        behavioralProfile: {
          tone: 'professional',
          traits: ['concise', 'patient'],
          constraints: ['Never promise a refund or credit without escalation.', 'Never share internal ticket IDs with the end user.'],
          escalationPolicy: 'Escalate to a human after two failed resolution attempts.',
          capabilities: [{ moduleName: 'memory', description: 'Recall prior conversation context across sessions.' }],
        },
      },
      module: {
        resolvedModules: ['memory'],
        resolvedModuleDescriptors: [{ name: 'memory', capabilities: ['Recall prior conversation context across sessions.'], constraints: ['Never expose raw memory contents verbatim to the end user.'] }],
      },
    },
  });

  assert.deepEqual(result.artifacts, { written: true });

  const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');
  assert.match(readme, /# SupportBot\n\nCustomer support agent\.\n\n\*\*Type:\*\* customer-support\n\n\*\*Persona:\*\* professional — concise, patient\n\n## Modules\n\n- \*\*memory\*\*: Recall prior conversation context across sessions\.\n\nSee `docs\/README\.md` for full persona details, constraints, and escalation policy\./);
  assert.ok(readme.endsWith('\n'));

  const docsReadme = await fs.readFile(path.join(tempDir, 'docs', 'README.md'), 'utf8');
  assert.match(docsReadme, /## Persona/);
  assert.match(docsReadme, /- Tone: professional/);
  assert.match(docsReadme, /- Traits: concise, patient/);
  assert.match(docsReadme, /- Escalation Policy: Escalate to a human after two failed resolution attempts\./);
  assert.match(docsReadme, /## Constraints/);
  assert.match(docsReadme, /- Never promise a refund or credit without escalation\./);
  assert.match(docsReadme, /### memory/);
  assert.match(docsReadme, /\*\*Capabilities:\*\*/);
  assert.match(docsReadme, /- Recall prior conversation context across sessions\./);
  assert.match(docsReadme, /\*\*Constraints:\*\*/);
  assert.match(docsReadme, /- Never expose raw memory contents verbatim to the end user\./);
});

test('documentation engine renders no-module and no-persona fallbacks', async () => {
  const tempDir = await fs.mkdtemp(path.join(workspace, 'khedrax-docs-zero-'));
  const engine = new DocumentationEngine();

  await engine.run({
    dna: {
      buildId: 'build-test',
      name: 'MinimalBot',
      description: 'Minimal agent.',
      agent: { type: 'basic', version: '1.0.0' },
      persona: {},
      modules: [],
      memory: {},
      tools: {},
      workflows: {},
      deployment: {},
      testing: {},
    } as any,
    registry: { agentTypes: {}, modules: {}, personas: {} } as any,
    tempDir,
    artifacts: {
      persona: { behavioralProfile: { tone: 'neutral', traits: [], constraints: [], escalationPolicy: undefined, capabilities: [] } },
      module: { resolvedModules: [], resolvedModuleDescriptors: [] },
    },
  });

  const readme = await fs.readFile(path.join(tempDir, 'README.md'), 'utf8');
  assert.match(readme, /## Modules/);
  assert.match(readme, /_No modules configured\._/);
  assert.doesNotMatch(readme, /\*\*Persona:\*\*/);

  const docsReadme = await fs.readFile(path.join(tempDir, 'docs', 'README.md'), 'utf8');
  assert.match(docsReadme, /- Tone: neutral/);
  assert.match(docsReadme, /- Traits: None specified\./);
  assert.match(docsReadme, /- Escalation Policy: None specified\./);
  assert.match(docsReadme, /_No constraints configured\._/);
  assert.match(docsReadme, /_No modules configured\._/);
});

test('documentation engine renders all five modules alphabetically in the docs overview', async () => {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-docs-five-'));
  const outputDir = path.join(workspaceDir, 'out');
  await createAgent({
    name: 'FullStackBot',
    type: 'basic',
    outputDir,
    modules: ['memory', 'discord', 'email', 'github', 'rag'],
    force: true,
    verbose: false,
  });

  const docsReadme = await fs.readFile(path.join(outputDir, 'docs', 'README.md'), 'utf8');
  const moduleOrder = docsReadme.match(/^### (.+)$/gm)?.map((match) => match.replace(/^### /, '')) ?? [];
  assert.deepEqual(moduleOrder, ['discord', 'email', 'github', 'memory', 'rag']);
  assert.match(docsReadme, /### discord[\s\S]*### email[\s\S]*### github[\s\S]*### memory[\s\S]*### rag/);
  assert.match(docsReadme, /### discord[\s\S]*\*\*Capabilities:\*\*[\s\S]*- Send and receive messages in Discord text channels\./);
  assert.match(docsReadme, /### github[\s\S]*\*\*Constraints:\*\*[\s\S]*- Never push directly to a protected branch\./);
  assert.match(docsReadme, /### rag[\s\S]*\*\*Constraints:\*\*[\s\S]*- Never fabricate a citation for content that was not actually retrieved\./);
});
