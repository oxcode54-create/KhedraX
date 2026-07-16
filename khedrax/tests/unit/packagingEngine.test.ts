import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PackagingEngine } from '../../src/engines/packagingEngine.ts';
import type { AgentDNA } from '../../src/dna/schema.ts';

async function makeTempDir(prefix: string): Promise<{ tempRoot: string; tempDir: string; outputDir: string }> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const tempDir = path.join(tempRoot, 'temp-project');
  const outputDir = path.join(tempRoot, 'out');
  await fs.mkdir(tempDir, { recursive: true });
  return { tempRoot, tempDir, outputDir };
}

function createDNA(overrides: Partial<AgentDNA> = {}): AgentDNA {
  return {
    buildId: 'build-123',
    name: 'SupportBot',
    description: 'Test agent',
    agent: { type: 'customer-support', version: '1.0.0' },
    persona: {},
    modules: ['memory'],
    memory: {},
    tools: {},
    workflows: {},
    deployment: {},
    testing: {},
    ...overrides,
  };
}

test('Packaging engine writes an exact dependency manifest for a populated project', async () => {
  const { tempDir, outputDir } = await makeTempDir('khedrax-pack-manifest-');
  await fs.writeFile(path.join(tempDir, 'README.md'), 'hello world');

  const engine = new PackagingEngine();
  const result = await engine.run({
    tempDir,
    outputDir,
    name: 'SupportBot',
    dna: createDNA(),
    resolvedModuleDescriptors: [{ name: 'memory', version: '1.0.0' }],
    khedraxRootDir: '/workspaces/KhedraX',
  } as any);

  assert.equal(result.standalone, true);
  const manifestPath = path.join(outputDir, 'PACKAGE_MANIFEST.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  assert.deepEqual(manifest, {
    name: 'SupportBot',
    agentType: 'customer-support',
    agentVersion: '1.0.0',
    buildId: 'build-123',
    modules: [{ name: 'memory', version: '1.0.0' }],
  });
});

test('Packaging engine writes an empty modules array for zero-module projects', async () => {
  const { tempDir, outputDir } = await makeTempDir('khedrax-pack-empty-');

  const engine = new PackagingEngine();
  await engine.run({
    tempDir,
    outputDir,
    name: 'SupportBot',
    dna: createDNA({ modules: [] }),
    resolvedModuleDescriptors: [],
    khedraxRootDir: '/workspaces/KhedraX',
  } as any);

  const manifest = JSON.parse(await fs.readFile(path.join(outputDir, 'PACKAGE_MANIFEST.json'), 'utf8'));
  assert.deepEqual(manifest.modules, []);
});

test('Packaging engine rejects leaked absolute build-time paths independently of substring checks', async () => {
  const { tempDir, outputDir } = await makeTempDir('khedrax-pack-path-');
  await fs.writeFile(path.join(tempDir, 'README.md'), 'contains /opt/build-env-7/metadata but no khedrax word');

  const engine = new PackagingEngine();
  await assert.rejects(() => engine.run({
    tempDir,
    outputDir,
    name: 'Demo',
    dna: createDNA(),
    resolvedModuleDescriptors: [],
    khedraxRootDir: '/opt/build-env-7',
  } as any), /leaked build-time path/i);
});

test('Packaging engine rejects standalone references to KhedraX', async () => {
  const { tempDir, outputDir } = await makeTempDir('khedrax-pack-');
  await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ dependencies: { 'khedrax-runtime': '1.0.0' } }, null, 2));
  await fs.writeFile(path.join(tempDir, 'README.md'), 'contains @khedrax/thing');

  const engine = new PackagingEngine();
  await assert.rejects(() => engine.run({
    tempDir,
    outputDir,
    name: 'Demo',
    dna: createDNA(),
    resolvedModuleDescriptors: [],
    khedraxRootDir: '/workspaces/KhedraX',
  } as any), /khedrax/i);
});

test('Packaging engine skips .git and node_modules directories during the scan', async () => {
  const { tempDir, outputDir } = await makeTempDir('khedrax-pack-skip-');
  await fs.mkdir(path.join(tempDir, '.git'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'node_modules', 'pkg'), { recursive: true });
  await fs.writeFile(path.join(tempDir, '.git', 'config'), 'contains khedrax-runtime');
  await fs.writeFile(path.join(tempDir, 'node_modules', 'pkg', 'index.js'), 'contains @khedrax/thing');
  await fs.writeFile(path.join(tempDir, 'README.md'), 'safe content');

  const engine = new PackagingEngine();
  const result = await engine.run({
    tempDir,
    outputDir,
    name: 'Demo',
    dna: createDNA(),
    resolvedModuleDescriptors: [{ name: 'memory', version: '1.0.0' }],
    khedraxRootDir: '/workspaces/KhedraX',
  } as any);

  assert.equal(result.standalone, true);
});
