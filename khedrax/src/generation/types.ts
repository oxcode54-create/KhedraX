import type { AgentDNA } from '../dna/schema.ts';
import type { RegistrySnapshot } from '../registry/types.ts';

export interface GenerationContext {
  dna: AgentDNA;
  registry: RegistrySnapshot;
  tempDir: string;
  outputDir?: string;
  artifacts: Record<string, unknown>;
  force?: boolean;
  khedraxRootDir?: string;
}

export interface ProducerResult {
  artifacts?: Record<string, unknown>;
}

export interface ProducerEngine {
  name: string;
  run: (context: GenerationContext) => Promise<ProducerResult>;
}
