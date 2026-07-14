import fs from 'node:fs/promises';
import path from 'node:path';
import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';

export class PromptEngine implements ProducerEngine {
  name = 'prompt';

  async run(context: GenerationContext): Promise<ProducerResult> {
    const resolvedModules = context.artifacts.module?.resolvedModules ?? [];
    const promptDir = path.join(context.tempDir, 'prompts');
    await fs.mkdir(promptDir, { recursive: true });
    const lines: string[] = [];
    for (const moduleName of resolvedModules as string[]) {
      const moduleDir = path.join(context.tempDir, 'prompts', moduleName);
      try {
        const content = await fs.readFile(path.join(moduleDir, 'fragment.md'), 'utf8');
        lines.push(`## ${moduleName}`);
        lines.push(content);
      } catch {
        // ignore missing fragments
      }
    }
    await fs.writeFile(path.join(promptDir, 'README.md'), lines.join('\n\n'));
    return { artifacts: { written: true } };
  }
}
