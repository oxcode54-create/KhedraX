import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PackagingEngine } from '../../src/engines/packagingEngine.ts';

test('Packaging engine rejects standalone references to KhedraX', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-pack-'));
  const tempDir = path.join(tempRoot, 'temp-project');
  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ dependencies: { 'khedrax-runtime': '1.0.0' } }, null, 2));
  await fs.writeFile(path.join(tempDir, 'README.md'), 'contains @khedrax/thing');

  const engine = new PackagingEngine();
  await assert.rejects(() => engine.run({ tempDir, outputDir: path.join(tempRoot, 'out'), name: 'Demo' }), /khedrax/i);
});
