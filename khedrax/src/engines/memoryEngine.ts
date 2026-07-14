import fs from 'node:fs/promises';
import path from 'node:path';
import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';

export class MemoryEngine implements ProducerEngine {
  name = 'memory';

  async run(context: GenerationContext): Promise<ProducerResult> {
    const memoryDir = path.join(context.tempDir, 'memory');
    await fs.mkdir(memoryDir, { recursive: true });
    const shape = context.dna.memory && Object.keys(context.dna.memory).length > 0 ? context.dna.memory : { backend: 'memory' };
    await fs.writeFile(path.join(memoryDir, 'README.md'), `# Memory\n\nConfigured shape:\n${JSON.stringify(shape, null, 2)}\n`);
    return { artifacts: { written: true } };
  }
}
