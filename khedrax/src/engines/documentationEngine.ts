import fs from 'node:fs/promises';
import path from 'node:path';
import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';

export class DocumentationEngine implements ProducerEngine {
  name = 'documentation';

  async run(context: GenerationContext): Promise<ProducerResult> {
    const readmePath = path.join(context.tempDir, 'README.md');
    const content = `# ${context.dna.name}\n\nType: ${context.dna.agent.type}\n\nModules: ${context.dna.modules.join(', ')}\n`;
    await fs.writeFile(readmePath, content);
    return { artifacts: { written: true } };
  }
}
