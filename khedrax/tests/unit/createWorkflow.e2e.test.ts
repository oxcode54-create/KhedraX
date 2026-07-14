import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgent } from '../../src/cli/commands/create.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const khedraxRoot = path.resolve(repoRoot, 'khedrax');

async function copyFixture(rootDir: string): Promise<void> {
  await fs.mkdir(rootDir, { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'agentTypes'), path.join(rootDir, 'agentTypes'), { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'modules'), path.join(rootDir, 'modules'), { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'templates'), path.join(rootDir, 'templates'), { recursive: true });
  await fs.cp(path.join(khedraxRoot, 'personas'), path.join(rootDir, 'personas'), { recursive: true });
}

test('createAgent produces a standalone project from the real entry point', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-e2e-'));
  const fixtureRoot = path.join(workspace, 'fixture');
  const outputDir = path.join(workspace, 'out');
  await copyFixture(fixtureRoot);

  const result = await createAgent({
    name: 'SupportBot',
    type: 'customer-support',
    outputDir,
    modules: [],
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any);

  assert.ok(result.outputPath);
  const generatedFiles = await fs.readdir(result.outputPath);
  assert.ok(generatedFiles.includes('agent.yaml'));

  const payload = await fs.readFile(path.join(result.outputPath, 'agent.yaml'), 'utf8');
  assert.equal(payload.includes('khedrax'), false);

  const readme = await fs.readFile(path.join(result.outputPath, 'README.md'), 'utf8');
  assert.equal(readme.includes('khedrax'), false);
});
