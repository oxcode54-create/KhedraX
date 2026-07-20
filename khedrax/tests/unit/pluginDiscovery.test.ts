import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { createAgent } from '../../src/cli/commands/create.ts';
import { getRegistrySnapshot } from '../../src/registry/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');
const examplePluginRoot = path.resolve(repoRoot, 'examples', 'example-plugin');

async function copyFixture(rootDir: string): Promise<void> {
  await fs.mkdir(rootDir, { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'agentTypes'), path.join(rootDir, 'agentTypes'), { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'modules'), path.join(rootDir, 'modules'), { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'templates'), path.join(rootDir, 'templates'), { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'personas'), path.join(rootDir, 'personas'), { recursive: true });
}

test('getRegistrySnapshot discovers a real example plugin module', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-plugin-discovery-'));
  const fixtureRoot = path.join(workspace, 'fixture');
  await copyFixture(fixtureRoot);

  const snapshot = await getRegistrySnapshot(fixtureRoot, [examplePluginRoot]);
  assert.ok(snapshot.modules.calendar);
  assert.equal(snapshot.modules.calendar.name, 'calendar');
});

test('createAgent can generate a project with a plugin module via CLI options', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-plugin-generate-'));
  const fixtureRoot = path.join(workspace, 'fixture');
  const outputDir = path.join(workspace, 'out');
  await copyFixture(fixtureRoot);

  await createAgent({
    name: 'PluginBot',
    type: 'basic',
    outputDir,
    modules: ['calendar'],
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
    pluginRoots: [examplePluginRoot],
  } as any);

  const docsReadme = await fs.readFile(path.join(outputDir, 'docs', 'README.md'), 'utf8');
  assert.match(docsReadme, /Schedule meetings and reminders\./i);
  const promptReadme = await fs.readFile(path.join(outputDir, 'prompts', 'README.md'), 'utf8');
  assert.match(promptReadme, /calendar scheduling scaffolding/i);
  const agentYaml = await fs.readFile(path.join(outputDir, 'agent.yaml'), 'utf8');
  const parsed = load(agentYaml) as Record<string, any>;
  assert.deepEqual(parsed.modules, ['calendar']);
});
