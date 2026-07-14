import type { AgentDNA } from '../dna/schema.ts';
import type { RegistrySnapshot } from '../registry/types.ts';
import type { BehavioralProfile } from './types.ts';

export function resolvePersona(dna: AgentDNA, registry: RegistrySnapshot): Partial<BehavioralProfile> & { tone: string; traits: string[]; constraints: string[]; escalationPolicy?: string } {
  const personaInput = dna.persona ?? {};
  const preset = personaInput.presetName ? registry.personas?.[personaInput.presetName] : undefined;
  const tone = personaInput.tone ?? preset?.tone ?? 'neutral';
  const traits = dedupe([...(preset?.traits ?? []), ...(personaInput.traits ?? [])]);
  const constraints = dedupe([...(preset?.constraints ?? []), ...(personaInput.constraints ?? [])]);
  const escalationPolicy = preset?.escalationPolicy;
  return { tone, traits, constraints, escalationPolicy };
}

function dedupe(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}
