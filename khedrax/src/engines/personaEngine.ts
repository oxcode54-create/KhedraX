import { deriveConstraints } from '../persona/deriveConstraints.ts';
import { mapCapabilities } from '../persona/mapCapabilities.ts';
import { resolvePersona } from '../persona/resolvePersona.ts';
import type { GenerationContext, ProducerEngine, ProducerResult } from '../generation/types.ts';

export class PersonaEngine implements ProducerEngine {
  name = 'persona';

  async run(context: GenerationContext): Promise<ProducerResult> {
    const resolvedPersona = resolvePersona(context.dna, context.registry);
    const moduleArtifact = context.artifacts.module as {
      resolvedModules?: string[];
      resolvedModuleDescriptors?: Array<{ name: string; capabilities?: string[]; constraints?: string[] }>;
    } | undefined;

    const resolvedModules = (
      (moduleArtifact?.resolvedModuleDescriptors ?? (
        (moduleArtifact?.resolvedModules ?? []).map((moduleName) => context.registry.modules[moduleName]).filter(Boolean) as Array<{ name: string; capabilities?: string[]; constraints?: string[] }>
      ))
    ).map((module) => ({
      name: module.name,
      capabilities: module.capabilities ?? [],
      constraints: module.constraints ?? [],
    }));
    const constraints = deriveConstraints(
      resolvedPersona,
      resolvedModules.flatMap((module) => module?.constraints ?? []),
    );
    const capabilities = mapCapabilities(resolvedModules.map((module) => ({ name: module.name, capabilities: module.capabilities }))); 

    return {
      artifacts: {
        behavioralProfile: {
          tone: resolvedPersona.tone,
          traits: resolvedPersona.traits,
          constraints,
          escalationPolicy: resolvedPersona.escalationPolicy,
          capabilities,
        },
      },
    };
  }
}
