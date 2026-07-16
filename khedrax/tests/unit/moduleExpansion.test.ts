import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAgent } from '../../src/cli/commands/create.ts';

const moduleNames = ['memory', 'discord', 'email', 'github', 'rag'];

test('multi-module composition assembles five modules without collisions', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-module-expansion-'));
  const outputDir = path.join(workspace, 'out');

  const result = await createAgent({
    name: 'FullStackBot',
    type: 'basic',
    outputDir,
    modules: moduleNames,
    force: true,
    verbose: false,
  });

  assert.equal(result.outputPath, outputDir);

  const agentYamlPath = path.join(outputDir, 'agent.yaml');
  const agentYaml = await fs.readFile(agentYamlPath, 'utf8');
  assert.match(agentYaml, /modules: \n  - memory\n  - discord\n  - email\n  - github\n  - rag/);

  const implementationDir = path.join(outputDir, 'implementation');
  const configurationDir = path.join(outputDir, 'configuration');
  const testsDir = path.join(outputDir, 'tests');

  for (const dir of [implementationDir, configurationDir, testsDir]) {
    const entries = await fs.readdir(dir);
    const moduleEntries = entries.filter((entry) => entry !== 'README.md');
    assert.deepEqual(moduleEntries.sort(), moduleNames.slice().sort());
  }

  const promptReadmePath = path.join(outputDir, 'prompts', 'README.md');
  const promptReadme = await fs.readFile(promptReadmePath, 'utf8');
  const capabilityLines = promptReadme.split('\n').filter((line) => line.startsWith('- '));
  const capabilityEntries = capabilityLines.filter((line) => line.includes('(memory)') || line.includes('(discord)') || line.includes('(email)') || line.includes('(github)') || line.includes('(rag)'));
  assert.equal(capabilityEntries.length, 9);

  assert.match(promptReadme, /## Instructions\n#### discord\nThis module provides Discord integration scaffolding/);
  assert.match(promptReadme, /#### email\nThis module provides email scaffolding/);
  assert.match(promptReadme, /#### github\nThis module provides GitHub integration scaffolding/);
  assert.match(promptReadme, /#### memory\nThis module provides memory scaffolding/);
  assert.match(promptReadme, /#### rag\nThis module provides retrieval-augmented generation scaffolding/);

  const constraintsSection = promptReadme.split('## Constraints\n')[1]?.split('\n## ')[0] ?? '';
  const rawConstraints = constraintsSection.split('\n').filter(Boolean);
  const uniqueConstraints = Array.from(new Set(rawConstraints));
  assert.equal(uniqueConstraints.length, 9);
  assert.equal(rawConstraints.length, uniqueConstraints.length);
  assert.ok(uniqueConstraints.some((line) => line.includes('Never expose raw memory contents verbatim to the end user.')));
  assert.ok(uniqueConstraints.some((line) => line.includes('Never DM a user without an explicit trigger from that user.')));
});
