import type { AgentDNA } from '../dna/schema.ts';
import type { RegistrySnapshot } from '../registry/types.ts';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const RESERVED_NAMES = new Set(['test', 'khedrax', 'node_modules']);

export function validateAgentDNA(dna: AgentDNA, registry: RegistrySnapshot): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!dna.name || !/^[A-Z][A-Za-z0-9]{2,49}$/.test(dna.name)) {
    errors.push('AgentDNA.name must be PascalCase and 3-50 characters.');
  }
  if (RESERVED_NAMES.has(String(dna.name).toLowerCase())) {
    errors.push('AgentDNA.name cannot be a reserved word.');
  }

  if (!registry.agentTypes[dna.agent.type]) {
    errors.push(`AgentDNA.agent.type '${dna.agent.type}' is not registered.`);
  }

  for (const moduleName of dna.modules) {
    if (!registry.modules[moduleName]) {
      errors.push(`Unknown module '${moduleName}'.`);
    }
  }

  if (dna.modules.includes('memory') && Object.keys(dna.memory).length === 0) {
    warnings.push('Memory module selected without memory configuration; a minimal shape will be scaffolded.');
  }

  return { valid: errors.length === 0, errors, warnings };
}
