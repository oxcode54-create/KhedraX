import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';

export class PersonaEngine implements ProducerEngine {
  name = 'persona';

  async run(context: GenerationContext): Promise<ProducerResult> {
    return { artifacts: { persona: context.dna.persona } };
  }
}
