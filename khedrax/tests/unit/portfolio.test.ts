import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
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

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function assertPortfolioAgent(caseName: string, agentType: string, modules: string[], expectedPersona?: string): Promise<void> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), `khedrax-portfolio-${caseName}-`));
  const fixtureRoot = path.join(workspace, 'fixture');
  const outputDir = path.join(workspace, 'out');
  await copyFixture(fixtureRoot);
  const agentName = caseName
    .split(/[-\s]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');

  await createAgent({
    name: `${agentName}Bot`,
    type: agentType,
    outputDir,
    modules,
    force: true,
    verbose: false,
    rootDir: fixtureRoot,
  } as any);

  const agentYaml = await fs.readFile(path.join(outputDir, 'agent.yaml'), 'utf8');
  const parsed = load(agentYaml) as Record<string, any>;

  assert.equal(parsed.agent?.type, agentType);
  if (expectedPersona) {
    assert.equal(parsed.persona?.presetName, expectedPersona);
  }
  assert.deepEqual(parsed.modules, modules);

  const docsReadme = await fs.readFile(path.join(outputDir, 'docs', 'README.md'), 'utf8');
  const promptReadme = await fs.readFile(path.join(outputDir, 'prompts', 'README.md'), 'utf8');

  if (expectedPersona) {
    const personaJson = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'personas', expectedPersona, 'persona.json'), 'utf8'));
    assert.match(docsReadme, new RegExp(personaJson.tone, 'i'));
  }

  for (const moduleName of modules) {
    const moduleDir = path.join(fixtureRoot, 'modules', moduleName);
    const moduleJson = JSON.parse(await fs.readFile(path.join(moduleDir, 'module.json'), 'utf8'));
    for (const capability of moduleJson.capabilities ?? []) {
      assert.match(docsReadme, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
    for (const constraint of moduleJson.constraints ?? []) {
      assert.match(docsReadme, new RegExp(constraint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
    const promptFragment = await fs.readFile(path.join(moduleDir, 'prompts', 'fragment.md'), 'utf8');
    assert.match(promptReadme, new RegExp(promptFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }

  const files = await collectFiles(outputDir);
  const allContent = await Promise.all(files.map((file) => fs.readFile(file, 'utf8').catch(() => '')));
  const combined = allContent.join('\n');
  assert.equal(combined.toLowerCase().includes('khedrax'), false);
}

test('portfolio agent: discord moderator', async () => {
  await assertPortfolioAgent('discord-moderator', 'discord-moderator', ['discord', 'memory'], 'vigilant-moderator');
});

test('portfolio agent: github review bot', async () => {
  await assertPortfolioAgent('github-review-bot', 'github-review-bot', ['github', 'memory'], 'meticulous-reviewer');
});

test('portfolio agent: research agent', async () => {
  await assertPortfolioAgent('research-agent', 'research', ['rag'], 'rigorous-researcher');
});

test('portfolio agent: documentation assistant', async () => {
  await assertPortfolioAgent('documentation-assistant', 'documentation-assistant', ['rag', 'github'], 'clear-communicator');
});

test('portfolio agent: sales assistant', async () => {
  await assertPortfolioAgent('sales-assistant', 'sales-assistant', ['email', 'memory'], 'consultative-seller');
});

test('portfolio agent: devops automation agent', async () => {
  await assertPortfolioAgent('devops-automation', 'devops-automation', ['github', 'infrastructure', 'memory'], 'cautious-operator');
});

test('portfolio agent: social media manager', async () => {
  await assertPortfolioAgent('social-media-manager', 'social-media-manager', ['memory', 'social-media'], 'engaging-brand-voice');
});

test('portfolio agent: customer support agent', async () => {
  await assertPortfolioAgent('customer-support', 'customer-support', ['memory', 'email'], 'professional-support');
});
