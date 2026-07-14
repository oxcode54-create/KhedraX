import fs from 'node:fs/promises';
import path from 'node:path';
import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';
import { composePrompt } from '../prompt/composePrompt.ts';

export class PromptEngine implements ProducerEngine {
  name = 'prompt';

  async run(context: GenerationContext): Promise<ProducerResult> {
    const resolvedModules = (context.artifacts.module as { resolvedModules?: string[] } | undefined)?.resolvedModules ?? [];
    const behavioralProfile = (context.artifacts.persona as { behavioralProfile?: unknown } | undefined)?.behavioralProfile;
    if (!behavioralProfile || typeof behavioralProfile !== 'object') {
      throw new Error('Missing behavioralProfile artifact for prompt composition.');
    }

    const composed = await composePrompt(context.tempDir, resolvedModules, behavioralProfile as {
      tone: string;
      traits: string[];
      constraints: string[];
      capabilities: Array<{ moduleName: string; description: string }>;
      escalationPolicy?: string;
    });

    const promptDir = path.join(context.tempDir, 'prompts');
    await fs.mkdir(promptDir, { recursive: true });
    await fs.writeFile(path.join(promptDir, 'README.md'), composed.markdown);
    return { artifacts: { written: true, composedSections: composed.sections.map((section) => section.name) } };
  }
}
